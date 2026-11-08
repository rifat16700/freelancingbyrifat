<?php
/**
 * ============================================================================
 * RANONEX UNIVERSAL PROXY HOSTING ENGINE (PHP Edition)
 * Works on: AlwaysData, cPanel, DirectAdmin, CyberPanel, Plesk, InfinityFree, VPS
 * ============================================================================
 * শুধু নিচের ৪টি লাইন পরিবর্তন করুন (অথবা আপনার সাইটের /stup-site পেজ থেকে জেনারেট করুন):
 */
define('ALLOWED_SITE_URL',   'https://ranonex.shop');          // 1. আপনার মেইন সাইটের URL (Whitelist)
define('CF_ACCOUNT_ID',      'YOUR_CLOUDFLARE_ACCOUNT_ID');    // 2. Cloudflare Account ID
define('CF_D1_DATABASE_ID',  'YOUR_D1_DATABASE_ID');           // 3. Cloudflare D1 Database ID
define('CF_API_TOKEN',       'YOUR_CF_API_TOKEN_D1_READ');     // 4. Cloudflare API Token (D1:Read Permission)

define('CACHE_TTL_SECONDS',  300);                             // 5 মিনিট (300s) JSON Database Cache
define('CHUNK_SIZE',         100);                             // প্রতি চ্যাঙ্কে ১০০টি করে প্রোডাক্ট

// ============================================================================
// 1. STRICT DOMAIN WHITELIST & CORS PROTECTION
// ============================================================================
$allowedHost = strtolower(preg_replace('/^www\./i', '', parse_url(ALLOWED_SITE_URL, PHP_URL_HOST) ?: ''));
$origin      = isset($_SERVER['HTTP_ORIGIN']) ? trim($_SERVER['HTTP_ORIGIN']) : '';
$referer     = isset($_SERVER['HTTP_REFERER']) ? trim($_SERVER['HTTP_REFERER']) : '';

$reqHost = '';
if ($origin) {
    $reqHost = strtolower(preg_replace('/^www\./i', '', parse_url($origin, PHP_URL_HOST) ?: ''));
} elseif ($referer) {
    $reqHost = strtolower(preg_replace('/^www\./i', '', parse_url($referer, PHP_URL_HOST) ?: ''));
}

$isAllowedOrigin = false;
if (!$allowedHost || $allowedHost === 'your-domain.com') {
    $isAllowedOrigin = true;
} elseif ($reqHost && ($reqHost === $allowedHost || substr($reqHost, -strlen('.' . $allowedHost)) === '.' . $allowedHost)) {
    $isAllowedOrigin = true;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: ' . ($origin && $isAllowedOrigin ? $origin : ALLOWED_SITE_URL));
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Max-Age: 86400');
    http_response_code(204);
    exit;
}

// Block unauthorized cross-origin abuse if Origin/Referer is present and doesn't match ALLOWED_SITE_URL
if (($origin || $referer) && !$isAllowedOrigin) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error'   => 'Forbidden: Domain not whitelisted on this Proxy Server.'
    ]);
    exit;
}

header('Access-Control-Allow-Origin: ' . ($origin && $isAllowedOrigin ? $origin : ALLOWED_SITE_URL));
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=60, s-maxage=' . CACHE_TTL_SECONDS . ', stale-while-revalidate=600');

// ============================================================================
// 2. JSON FILE DATABASE CACHE HELPERS (json_db/)
// ============================================================================
$jsonDbDir = __DIR__ . '/json_db';
if (!is_dir($jsonDbDir)) {
    @mkdir($jsonDbDir, 0755, true);
}

function safeCacheName($str) {
    return preg_replace('/[^a-zA-Z0-9_-]/', '_', strtolower((string)$str)) ?: 'main';
}

function readJsonCache($key) {
    global $jsonDbDir;
    if (!empty($_GET['nocache'])) return null;
    $file = $jsonDbDir . '/' . $key . '.json';
    if (is_file($file) && (time() - filemtime($file)) < CACHE_TTL_SECONDS) {
        $raw = @file_get_contents($file);
        if ($raw !== false && strlen($raw) > 2) return $raw;
    }
    return null;
}

function writeJsonCache($key, $jsonString) {
    global $jsonDbDir;
    $file = $jsonDbDir . '/' . $key . '.json';
    $tmp  = $file . '.tmp.' . getmypid();
    if (@file_put_contents($tmp, $jsonString) !== false) {
        @rename($tmp, $file);
    }
}

// ============================================================================
// 3. CLOUDFLARE D1 REST API QUERY ENGINE (WITH D1:READ TOKEN)
// ============================================================================
function d1Query($sql, $params = []) {
    $url = 'https://api.cloudflare.com/client/v4/accounts/' . CF_ACCOUNT_ID . '/d1/database/' . CF_D1_DATABASE_ID . '/query';
    $payload = json_encode(['sql' => $sql, 'params' => array_values($params)]);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . CF_API_TOKEN,
            'Content-Type: application/json'
        ],
        CURLOPT_TIMEOUT        => 15
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code !== 200 || !$res) return [];
    $decoded = json_decode($res, true);
    if (empty($decoded['success']) || empty($decoded['result'][0]['results'])) return [];
    return $decoded['result'][0]['results'];
}

// ============================================================================
// 4. BRAND & SHARED CATEGORY FILTERING HELPERS
// ============================================================================
function parseSharedBrands($cat) {
    if (empty($cat['shared_brand_ids'])) return [];
    $arr = is_array($cat['shared_brand_ids']) ? $cat['shared_brand_ids'] : json_decode($cat['shared_brand_ids'], true);
    return is_array($arr) ? array_map('strval', $arr) : [];
}

function isCatVisibleOnBrand($cat, $brandId) {
    $cBrand = isset($cat['brand_id']) ? trim((string)$cat['brand_id']) : '';
    if (!$brandId) return $cBrand === '';
    if ($cBrand === (string)$brandId) return true;
    return in_array((string)$brandId, parseSharedBrands($cat), true);
}

function mergeBrandSettings($rawSettings, $brand) {
    if (!$brand) return $rawSettings;
    $merged = $rawSettings;
    if (!empty($brand['name']))     $merged['store_name']  = $brand['name'];
    if (!empty($brand['tagline']))  $merged['tagline']     = $brand['tagline'];
    if (!empty($brand['logo_url'])) $merged['logo_url']    = $brand['logo_url'];
    if (!empty($brand['favicon_url'])) $merged['favicon_url'] = $brand['favicon_url'];
    if (!empty($brand['footer_text'])) $merged['footer_about'] = $brand['footer_text'];
    return $merged;
}

// ============================================================================
// 5. ROUTE DISPATCHER
// ============================================================================
$reqUri   = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$endpoint = isset($_GET['endpoint']) ? $_GET['endpoint'] : $reqUri;
$brandSlug = trim($_GET['brand'] ?? $_GET['brand_id'] ?? '');
$productId = trim($_GET['product_id'] ?? '');
$chunkNum  = isset($_GET['chunk']) ? max(1, (int)$_GET['chunk']) : 0;

// ----------------------------------------------------------------------------
// ROUTE A: /api/public-reviews?product_id=<id> (Targeted Product Reviews Only)
// ----------------------------------------------------------------------------
if (strpos($endpoint, 'public-reviews') !== false) {
    if (!$productId) {
        echo json_encode(['success' => true, 'data' => []]);
        exit;
    }
    $cacheKey = 'reviews_' . safeCacheName($productId);
    $cached   = readJsonCache($cacheKey);
    if ($cached !== null) {
        echo $cached;
        exit;
    }
    $rows = d1Query(
        "SELECT * FROM reviews WHERE product_id = ? AND is_approved = 1 ORDER BY created_at DESC LIMIT 50",
        [$productId]
    );
    $out = json_encode(['success' => true, 'data' => $rows], JSON_UNESCAPED_UNICODE);
    writeJsonCache($cacheKey, $out);
    echo $out;
    exit;
}

// ----------------------------------------------------------------------------
// ROUTE B: /api/checkout-data (Targeted Checkout Data Only — NO Full Product DB!)
// ----------------------------------------------------------------------------
if (strpos($endpoint, 'checkout-data') !== false) {
    $cacheKey = 'checkout_' . safeCacheName($brandSlug ?: 'main');
    $cached   = readJsonCache($cacheKey);
    if ($cached !== null) {
        echo $cached;
        exit;
    }

    $allBrands   = d1Query("SELECT * FROM brands WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC");
    $activeBrand = null;
    if ($brandSlug) {
        foreach ($allBrands as $b) {
            if (strtolower($b['slug'] ?? '') === strtolower($brandSlug) || ($b['id'] ?? '') === $brandSlug) {
                $activeBrand = $b;
                break;
            }
        }
    }

    $settingsRows = d1Query("SELECT * FROM settings WHERE id = 1");
    $rawSettings  = $settingsRows[0] ?? [];
    $zones        = d1Query("SELECT * FROM delivery_zones");
    $addons       = d1Query("SELECT * FROM addons WHERE is_active = 1 ORDER BY created_at");
    $promos       = d1Query("SELECT * FROM promos WHERE is_active = 1 LIMIT 500");

    if ($activeBrand) {
        $addOnce = d1Query(
            "SELECT id,name,base_price,flash_sale_price,gallery_images,variants,brand_id FROM products WHERE is_add_once = 1 AND is_active = 1 AND brand_id = ?",
            [$activeBrand['id']]
        );
    } else {
        $addOnce = d1Query(
            "SELECT id,name,base_price,flash_sale_price,gallery_images,variants,brand_id FROM products WHERE is_add_once = 1 AND is_active = 1 AND (brand_id IS NULL OR brand_id = '' OR show_on_main = 1)"
        );
    }

    $out = json_encode([
        'success' => true,
        'data'    => [
            'settings' => mergeBrandSettings($rawSettings, $activeBrand),
            'brand'    => $activeBrand,
            'brands'   => $allBrands,
            'zones'    => $zones,
            'addons'   => $addons,
            'promos'   => $promos,
            'add_once' => $addOnce
        ]
    ], JSON_UNESCAPED_UNICODE);

    writeJsonCache($cacheKey, $out);
    echo $out;
    exit;
}

// ----------------------------------------------------------------------------
// ROUTE C: /api/public-data?product_id=<id> (Targeted Single Product Only — NO Full DB!)
// ----------------------------------------------------------------------------
if ($productId !== '') {
    $cacheKey = 'product_' . safeCacheName($productId) . '_' . safeCacheName($brandSlug ?: 'main');
    $cached   = readJsonCache($cacheKey);
    if ($cached !== null) {
        echo $cached;
        exit;
    }

    $pidLower    = strtolower($productId);
    $foundRows   = d1Query(
        "SELECT * FROM products WHERE is_active = 1 AND (id = ? OR lower(sku) = ? OR lower(slug) = ?) LIMIT 1",
        [$productId, $pidLower, $pidLower]
    );
    $found       = $foundRows[0] ?? null;
    $allBrands   = d1Query("SELECT * FROM brands WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC");
    $settingsRow = d1Query("SELECT * FROM settings WHERE id = 1");
    $rawSettings = $settingsRow[0] ?? [];
    $categories  = d1Query("SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order");
    $prodCats    = d1Query("SELECT * FROM product_categories");

    $activeBrand = null;
    if ($brandSlug) {
        foreach ($allBrands as $b) {
            if (strtolower($b['slug'] ?? '') === strtolower($brandSlug) || ($b['id'] ?? '') === $brandSlug) {
                $activeBrand = $b;
                break;
            }
        }
    }

    $related = [];
    if ($found) {
        if (!empty($found['brand_id'])) {
            $related = d1Query(
                "SELECT * FROM products WHERE is_active = 1 AND id != ? AND brand_id = ? ORDER BY is_featured DESC, created_at DESC LIMIT 12",
                [$found['id'], $found['brand_id']]
            );
        } else {
            $related = d1Query(
                "SELECT * FROM products WHERE is_active = 1 AND id != ? ORDER BY is_featured DESC, created_at DESC LIMIT 12",
                [$found['id']]
            );
        }
    }

    $prodBrand = $activeBrand;
    if ($found && !empty($found['brand_id'])) {
        foreach ($allBrands as $b) {
            if (($b['id'] ?? '') === $found['brand_id']) {
                $found['brand_slug'] = $b['slug'];
                $found['brand_name'] = $b['name'];
                if (!$prodBrand) $prodBrand = $b;
                break;
            }
        }
    }

    $out = json_encode([
        'success'            => true,
        'product'            => $found,
        'related_products'   => $related,
        'brand'              => $prodBrand,
        'brands'             => $allBrands,
        'settings'           => mergeBrandSettings($rawSettings, $prodBrand),
        'categories'         => array_values(array_filter($categories, function($c) use ($prodBrand) {
            return isCatVisibleOnBrand($c, $prodBrand ? $prodBrand['id'] : null);
        })),
        'product_categories' => $prodCats
    ], JSON_UNESCAPED_UNICODE);

    writeJsonCache($cacheKey, $out);
    echo $out;
    exit;
}

// ----------------------------------------------------------------------------
// ROUTE D: /api/public-data (Master JSON with 100-Product Chunks)
// ----------------------------------------------------------------------------
$brandKey = safeCacheName($brandSlug ?: 'main');

// If specific 100-product chunk requested (?chunk=1)
if ($chunkNum > 0) {
    $chunkCacheKey = 'chunk_' . $brandKey . '_' . $chunkNum;
    $cachedChunk   = readJsonCache($chunkCacheKey);
    if ($cachedChunk !== null) {
        echo $cachedChunk;
        exit;
    }
}

$masterCacheKey = 'master_' . $brandKey;
$cachedMaster   = readJsonCache($masterCacheKey);
if ($cachedMaster !== null && $chunkNum === 0) {
    echo $cachedMaster;
    exit;
}

// Fetch from Cloudflare D1 and build 100-product chunks + Master JSON
$allBrands   = d1Query("SELECT * FROM brands WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC");
$activeBrand = null;
if ($brandSlug) {
    foreach ($allBrands as $b) {
        if (strtolower($b['slug'] ?? '') === strtolower($brandSlug) || ($b['id'] ?? '') === $brandSlug) {
            $activeBrand = $b;
            break;
        }
    }
}

$brandMap = [];
foreach ($allBrands as $b) {
    $brandMap[$b['id']] = $b;
}

$settingsRows = d1Query("SELECT * FROM settings WHERE id = 1");
$rawSettings  = $settingsRows[0] ?? [];
$mainStoreName = $rawSettings['store_name'] ?? 'Ranonex';
$categories   = d1Query("SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order");
$products     = d1Query("SELECT * FROM products WHERE is_active = 1 ORDER BY is_featured DESC, created_at DESC");
$prodCats     = d1Query("SELECT * FROM product_categories");

if ($activeBrand) {
    $banners  = d1Query("SELECT * FROM banners WHERE is_active = 1 AND brand_id = ? ORDER BY sort_order", [$activeBrand['id']]);
    $sections = d1Query("SELECT * FROM home_sections WHERE is_active = 1 AND brand_id = ? ORDER BY sort_order", [$activeBrand['id']]);
} else {
    $banners  = d1Query("SELECT * FROM banners WHERE is_active = 1 AND (brand_id IS NULL OR brand_id = '') ORDER BY sort_order");
    $sections = d1Query("SELECT * FROM home_sections WHERE is_active = 1 AND (brand_id IS NULL OR brand_id = '') ORDER BY sort_order");
}

// Filter categories and products for brand context (including shared categories)
$activeBrandId = $activeBrand ? $activeBrand['id'] : null;
$filteredCategories = array_values(array_filter($categories, function($c) use ($activeBrandId) {
    return isCatVisibleOnBrand($c, $activeBrandId);
}));

$sharedCatModes = [];
if ($activeBrandId) {
    foreach ($categories as $c) {
        $inc = !empty($c['share_include_products']) && ($c['share_include_products'] == 1 || $c['share_include_products'] === true);
        if ($inc && in_array((string)$activeBrandId, parseSharedBrands($c), true)) {
            $sharedCatModes[(string)$c['id']] = (($c['share_url_mode'] ?? 'brand') === 'main') ? 'main' : 'brand';
        }
    }
}

$prodCatLookup = [];
foreach ($prodCats as $pc) {
    $pid = (string)($pc['product_id'] ?? '');
    $cid = (string)($pc['category_id'] ?? '');
    if ($pid && $cid) $prodCatLookup[$pid][] = $cid;
}

$filteredProducts = [];
foreach ($products as $p) {
    $pBrandId = !empty($p['brand_id']) ? (string)$p['brand_id'] : '';
    $ownerBrand = ($pBrandId && isset($brandMap[$pBrandId])) ? $brandMap[$pBrandId] : null;
    if ($pBrandId && !$ownerBrand) continue;

    $pidsCats = $prodCatLookup[(string)$p['id']] ?? [];
    if (!empty($p['category_id'])) $pidsCats[] = (string)$p['category_id'];

    if ($activeBrandId) {
        $isOwn = ($pBrandId === (string)$activeBrandId);
        $matchedSharedMode = null;
        if (!$isOwn) {
            foreach ($pidsCats as $cid) {
                if (isset($sharedCatModes[$cid])) {
                    $matchedSharedMode = $sharedCatModes[$cid];
                    break;
                }
            }
        }
        if (!$isOwn && !$matchedSharedMode) continue;

        if (!$isOwn && $matchedSharedMode === 'brand') {
            $p['brand_slug'] = $activeBrand['slug'];
            $p['brand_name'] = $activeBrand['name'];
            $p['canonical_url_mode'] = 'brand';
        } elseif (!$isOwn && $matchedSharedMode === 'main') {
            $p['brand_slug'] = $ownerBrand ? $ownerBrand['slug'] : '';
            $p['brand_name'] = $ownerBrand ? $ownerBrand['name'] : $mainStoreName;
            $p['canonical_url_mode'] = 'main';
        } else {
            $p['brand_slug'] = $ownerBrand ? $ownerBrand['slug'] : $activeBrand['slug'];
            $p['brand_name'] = $ownerBrand ? $ownerBrand['name'] : $activeBrand['name'];
            $p['canonical_url_mode'] = 'brand';
        }
    } else {
        if ($pBrandId && empty($p['show_on_main'])) continue;
        $p['brand_slug'] = $ownerBrand ? $ownerBrand['slug'] : '';
        $p['brand_name'] = $ownerBrand ? $ownerBrand['name'] : $mainStoreName;
        $p['canonical_url_mode'] = $ownerBrand ? 'brand' : 'main';
    }
    $filteredProducts[] = $p;
}

// Organize products into 100-product chunks & save chunk JSON files
$rawChunks = array_chunk($filteredProducts, CHUNK_SIZE);
$productChunks = [];
foreach ($rawChunks as $idx => $slice) {
    $cNum = $idx + 1;
    $chunkObj = [
        'chunk'    => $cNum,
        'count'    => count($slice),
        'products' => $slice
    ];
    $productChunks[] = $chunkObj;

    $singleChunkJson = json_encode([
        'success'        => true,
        'chunk'          => $cNum,
        'count'          => count($slice),
        'total_products' => count($filteredProducts),
        'has_more'       => ($cNum < count($rawChunks)),
        'next_chunk'     => ($cNum < count($rawChunks)) ? ($cNum + 1) : null,
        'products'       => $slice
    ], JSON_UNESCAPED_UNICODE);
    writeJsonCache('chunk_' . $brandKey . '_' . $cNum, $singleChunkJson);
}

if ($chunkNum > 0) {
    $cachedChunk = readJsonCache('chunk_' . $brandKey . '_' . $chunkNum);
    echo $cachedChunk ?: json_encode(['success' => true, 'chunk' => $chunkNum, 'count' => 0, 'products' => []]);
    exit;
}

$masterPayload = [
    'success' => true,
    'data'    => [
        'settings'           => mergeBrandSettings($rawSettings, $activeBrand),
        'main_settings'      => [
            'store_name'  => $mainStoreName,
            'logo_url'    => $rawSettings['logo_url'] ?? '',
            'favicon_url' => $rawSettings['favicon_url'] ?? ''
        ],
        'brand'              => $activeBrand,
        'brands'             => $allBrands,
        'banners'            => $banners,
        'categories'         => $filteredCategories,
        'product_chunks'     => $productChunks,
        'total_products'     => count($filteredProducts),
        'chunk_size'         => CHUNK_SIZE,
        'total_chunks'       => count($productChunks),
        'home_sections'      => $sections,
        'product_categories' => $prodCats
    ]
];

$masterJson = json_encode($masterPayload, JSON_UNESCAPED_UNICODE);
writeJsonCache($masterCacheKey, $masterJson);
echo $masterJson;
