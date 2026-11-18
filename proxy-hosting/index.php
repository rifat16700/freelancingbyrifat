<?php
/**
 * ============================================================================
 * RANONEX UNIVERSAL STATELESS PROXY ENGINE (PHP Edition)
 * Works on: AlwaysData, cPanel, DirectAdmin, CyberPanel, Plesk, InfinityFree, VPS
 * ============================================================================
 * প্রক্সির কাজ শুধুমাত্র Cache Miss হলে D1 থেকে ডাটা ফেচ করে JSON আকারে ইউজার ও Cloudflare-কে দেওয়া।
 * ক্যাশ করে রাখার সম্পূর্ণ কাজ Cloudflare Edge Cache (5 মিনিট) এবং ব্রাউজারের।
 *
 * শুধু নিচের ৪টি লাইন পরিবর্তন করুন (অথবা আপনার সাইটের /stup-site পেজ থেকে জেনারেট করুন):
 */
define('ALLOWED_SITE_URL',   'https://ranonex.shop');          // 1. আপনার মেইন সাইটের URL (Whitelist)
define('CF_ACCOUNT_ID',      'YOUR_CLOUDFLARE_ACCOUNT_ID');    // 2. Cloudflare Account ID
define('CF_D1_DATABASE_ID',  'YOUR_D1_DATABASE_ID');           // 3. Cloudflare D1 Database ID
define('CF_API_TOKEN',       'YOUR_CF_API_TOKEN_D1_READ');     // 4. Cloudflare API Token (D1 Read + Write Permission)

define('ADMIN_USERNAME',     getenv('ADMIN_USERNAME') ?: 'admin');
define('ADMIN_PASSWORD',     getenv('ADMIN_PASSWORD') ?: 'admin123');
define('ADMIN_SECRET_TOKEN', getenv('ADMIN_SECRET_TOKEN') ?: (getenv('JWT_SECRET') ?: 'fbr-secure-ecommerce-secret-key-2026'));
define('TELEGRAM_BOT_TOKEN', getenv('TELEGRAM_BOT_TOKEN') ?: ($_ENV['TELEGRAM_BOT_TOKEN'] ?? ($_SERVER['TELEGRAM_BOT_TOKEN'] ?? '')));
define('TELEGRAM_CHAT_ID',   getenv('TELEGRAM_CHAT_ID') ?: ($_ENV['TELEGRAM_CHAT_ID'] ?? ($_SERVER['TELEGRAM_CHAT_ID'] ?? '')));

define('CACHE_TTL_SECONDS',  300);                             // Cloudflare 5 মিনিট (300s) Edge Cache TTL
define('INITIAL_PRODUCT_COUNT', 20);                            // ১ম রিকোয়েস্টে ২০টি প্রোডাক্ট (ব্লাজিং ফাস্ট ১ম ইম্প্রেশন)
define('CHUNK_SIZE',            50);                            // ব্যাকগ্রাউন্ডের প্রতি চ্যাঙ্কে ৫০টি করে প্রোডাক্ট

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
} elseif ($reqHost && (strpos($reqHost, 'alwaysdata.net') !== false || strpos($reqHost, 'pages.dev') !== false || $reqHost === 'localhost' || $reqHost === '127.0.0.1')) {
    $isAllowedOrigin = true;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: ' . ($origin && $isAllowedOrigin ? $origin : ALLOWED_SITE_URL));
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Token, X-Requested-With');
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
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Token, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');
header('X-Data-Source: alwaysdata_proxy');
header('X-Proxy-Engine: Ranonex-AlwaysData-PHP');

// ============================================================================
// 2. CLOUDFLARE D1 REST API QUERY & WRITE ENGINE + STATELESS HMAC AUTH
// ============================================================================
function d1Exec($sql, $params = []) {
    $cleanParams = [];
    foreach (array_values($params) as $v) {
        $cleanParams[] = ($v === null || $v === false) ? ($v === false ? 0 : null) : $v;
    }
    $url = 'https://api.cloudflare.com/client/v4/accounts/' . CF_ACCOUNT_ID . '/d1/database/' . CF_D1_DATABASE_ID . '/query';
    $payload = json_encode(['sql' => $sql, 'params' => $cleanParams]);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . CF_API_TOKEN,
            'Content-Type: application/json'
        ],
        CURLOPT_TIMEOUT        => 20
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if (!$res) {
        return ['success' => false, 'results' => [], 'error' => 'D1 connection failed'];
    }
    $decoded = json_decode($res, true);
    if ($code !== 200 || empty($decoded['success'])) {
        $errMsg = $decoded['errors'][0]['message'] ?? ('D1 HTTP ' . $code);
        return ['success' => false, 'results' => [], 'error' => $errMsg];
    }
    $first = $decoded['result'][0] ?? [];
    return [
        'success' => true,
        'results' => $first['results'] ?? [],
        'meta'    => $first['meta'] ?? []
    ];
}

function d1Query($sql, $params = []) {
    $res = d1Exec($sql, $params);
    return $res['success'] ? $res['results'] : [];
}

// ============================================================================
// 2B. ALWAYSDATA PRIVATE STORAGE ENGINE (OUTSIDE PUBLIC WEB ROOT)
//     Stores: Master Admin hash/PIN, Staff Accounts, Activity Logs, Signing Key
// ============================================================================
// TODO [Site Users / Future Customer Auth]:
// আগে কাস্টমার/সাইট ইউজার একাউন্ট (register/login/OTP/session) তৈরি করার জন্য
// Cloudflare KV ব্যবহারের পরিকল্পনা ছিল। পরবর্তীতে সাইট ইউজার সিস্টেম চালু করলে
// KV-এর পরিবর্তে এই AlwaysData প্রাইভেট স্টোরেজ ডিরেক্টরি (ranonex_data/site_users.json
// বা SQLite) ব্যবহার করা হবে। আপাতত এখানে কোনো সাইট ইউজার কোড লেখা হয়নি।
// ============================================================================
function getPrivateDataDir() {
    static $dir = null;
    if ($dir !== null) return $dir;
    $outside = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'ranonex_data';
    if (!is_dir($outside)) {
        @mkdir($outside, 0700, true);
    }
    if (is_dir($outside) && is_writable($outside)) {
        $dir = $outside;
        return $dir;
    }
    $fallback = __DIR__ . DIRECTORY_SEPARATOR . '.ranonex_private';
    if (!is_dir($fallback)) {
        @mkdir($fallback, 0700, true);
    }
    if (is_dir($fallback) && !file_exists($fallback . DIRECTORY_SEPARATOR . '.htaccess')) {
        @file_put_contents($fallback . DIRECTORY_SEPARATOR . '.htaccess', "Require all denied\nDeny from all\n");
    }
    $dir = $fallback;
    return $dir;
}

function readJsonStore($fileName, $default = []) {
    $path = getPrivateDataDir() . DIRECTORY_SEPARATOR . $fileName;
    if (!file_exists($path)) return $default;
    $raw = @file_get_contents($path);
    if (!$raw) return $default;
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : $default;
}

function writeJsonStore($fileName, $data) {
    $path = getPrivateDataDir() . DIRECTORY_SEPARATOR . $fileName;
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    return @file_put_contents($path, $json, LOCK_EX) !== false;
}

function getServerSigningSecret() {
    $envSec = getenv('ADMIN_SECRET_TOKEN') ?: getenv('JWT_SECRET');
    if ($envSec && strlen($envSec) >= 16) return $envSec;
    $keyFile = getPrivateDataDir() . DIRECTORY_SEPARATOR . 'secret.key';
    if (file_exists($keyFile)) {
        $k = trim((string)@file_get_contents($keyFile));
        if (strlen($k) >= 32) return $k;
    }
    $newKey = bin2hex(random_bytes(32));
    @file_put_contents($keyFile, $newKey, LOCK_EX);
    return $newKey;
}

function hashSecretPbkdf2($plain) {
    $salt = random_bytes(16);
    $saltHex = bin2hex($salt);
    $hashHex = hash_pbkdf2('sha256', (string)$plain, $salt, 100000, 64, false);
    return $saltHex . ':' . $hashHex;
}

function verifySecretPbkdf2($plain, $stored) {
    $stored = (string)$stored;
    if ($stored === '') return false;
    if (strpos($stored, ':') !== false) {
        list($saltHex, $hashHex) = explode(':', $stored, 2);
        $saltBin = @hex2bin($saltHex);
        if ($saltBin === false) return false;
        $calcHex = hash_pbkdf2('sha256', (string)$plain, $saltBin, 100000, 64, false);
        return hash_equals(strtolower($hashHex), strtolower($calcHex));
    }
    return hash_equals($stored, (string)$plain);
}

function getClientIpAddr() {
    return (string)($_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

function getClientUaHash() {
    $ua = trim((string)($_SERVER['HTTP_USER_AGENT'] ?? 'unknown'));
    return substr(hash('sha256', $ua), 0, 24);
}

function getClientUaLabel() {
    return mb_substr(trim((string)($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown Browser')), 0, 120);
}

// ============================================================================
// 2C. TELEGRAM 2FA OTP ENGINE (Master Creation, Master Login & Staff Login)
// ============================================================================
function getEnvAny($keys) {
    foreach ($keys as $k) {
        if (defined($k)) {
            $v = trim((string)constant($k));
            if ($v !== '') return $v;
        }
        $v = getenv($k);
        if ($v !== false && trim((string)$v) !== '') return trim((string)$v);
        if (isset($_ENV[$k]) && trim((string)$_ENV[$k]) !== '') return trim((string)$_ENV[$k]);
        if (isset($_SERVER[$k]) && trim((string)$_SERVER[$k]) !== '') return trim((string)$_SERVER[$k]);
    }
    return '';
}

function getTelegram2FaConfig() {
    $envBot  = getEnvAny(['TELEGRAM_BOT_TOKEN', 'ADMIN_TELEGRAM_BOT_TOKEN', 'TG_BOT_TOKEN', 'TELEGRAM_BOT_API', 'BOT_TOKEN']);
    $envChat = getEnvAny(['TELEGRAM_CHAT_ID', 'ADMIN_TELEGRAM_CHAT_ID', 'TG_CHAT_ID', 'MASTER_TELEGRAM_CHAT_ID', 'ADMIN_CHAT_ID', 'CHAT_ID']);
    $saved   = readJsonStore('telegram_config.json', []);
    if (!is_array($saved)) $saved = [];

    $botToken     = $envBot !== '' ? $envBot : trim((string)($saved['bot_token'] ?? ''));
    $masterChatId = $envChat !== '' ? $envChat : trim((string)($saved['master_chat_id'] ?? ''));
    $source       = ($envBot !== '' && $envChat !== '') ? 'env' : (($botToken !== '' && $masterChatId !== '') ? 'alwaysdata_storage' : 'partial');

    // Optional fallback from D1 settings table if ENV / AlwaysData storage is not set yet
    if ($botToken === '' || $masterChatId === '') {
        $rows = d1Query("SELECT telegram_main_bot, telegram_main_chats FROM settings WHERE id = 1 LIMIT 1");
        if (!empty($rows[0])) {
            if ($botToken === '' && !empty($rows[0]['telegram_main_bot'])) {
                $botToken = trim((string)$rows[0]['telegram_main_bot']);
                $source = 'd1_settings_fallback';
            }
            if ($masterChatId === '' && !empty($rows[0]['telegram_main_chats'])) {
                $rawChats = trim((string)$rows[0]['telegram_main_chats']);
                $decoded = json_decode($rawChats, true);
                if (is_array($decoded) && !empty($decoded[0])) {
                    $masterChatId = trim((string)$decoded[0]);
                } elseif ($rawChats !== '' && $rawChats[0] !== '[') {
                    $parts = array_map('trim', explode(',', $rawChats));
                    if (!empty($parts[0])) $masterChatId = $parts[0];
                }
            }
        }
    }

    return [
        'bot_token'      => $botToken,
        'master_chat_id' => $masterChatId,
        'env_locked'     => ($envBot !== '' && $envChat !== ''),
        'source'         => $source
    ];
}

function sendTelegramOtpMessage($botToken, $chatId, $otp, $purposeLabel, $accountEmail, $clientIp) {
    if ($botToken === '' || $chatId === '') {
        return ['success' => false, 'error' => 'Telegram Bot Token বা Chat ID পাওয়া যায়নি।'];
    }
    $siteUrl = rtrim((string)ALLOWED_SITE_URL, '/');
    $safeEmail = htmlspecialchars((string)$accountEmail, ENT_QUOTES, 'UTF-8');
    $safePurpose = htmlspecialchars((string)$purposeLabel, ENT_QUOTES, 'UTF-8');
    $safeIp = htmlspecialchars((string)$clientIp, ENT_QUOTES, 'UTF-8');
    $safeSite = htmlspecialchars($siteUrl ?: 'Admin Panel', ENT_QUOTES, 'UTF-8');

    $text = "🔐 <b>Admin 2FA Verification Code</b>\n\n"
          . "📌 <b>Action:</b> {$safePurpose}\n"
          . "👤 <b>Account:</b> <code>{$safeEmail}</code>\n"
          . "🌐 <b>Site:</b> {$safeSite}\n"
          . "📡 <b>IP:</b> <code>{$safeIp}</code>\n\n"
          . "🔢 <b>Your OTP Code:</b> <code>{$otp}</code>\n"
          . "⏳ <i>Valid for 5 minutes. কাউকে এই কোড শেয়ার করবেন না।</i>";

    $ch = curl_init("https://api.telegram.org/bot" . $botToken . "/sendMessage");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode([
            'chat_id'                  => (string)$chatId,
            'text'                     => $text,
            'parse_mode'               => 'HTML',
            'disable_web_page_preview' => true
        ], JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 12
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $cerr = curl_error($ch);
    curl_close($ch);

    if (!$res) {
        return ['success' => false, 'error' => 'Telegram API সংযোগ ব্যর্থ: ' . ($cerr ?: 'Network error')];
    }
    $decoded = json_decode($res, true);
    if ($code !== 200 || empty($decoded['ok'])) {
        $desc = $decoded['description'] ?? ('HTTP ' . $code);
        return ['success' => false, 'error' => 'Telegram OTP পাঠানো যায়নি: ' . $desc];
    }
    return ['success' => true];
}

function createOtpChallenge($meta) {
    $list = readJsonStore('otp_challenges.json', []);
    if (!is_array($list)) $list = [];
    $now = time();
    $active = [];
    foreach ($list as $c) {
        if (is_array($c) && !empty($c['challenge_id']) && (int)($c['expires_at'] ?? 0) > $now) {
            $active[] = $c;
        }
    }
    $otp         = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $challengeId = bin2hex(random_bytes(16));
    $rec = array_merge($meta, [
        'challenge_id' => $challengeId,
        'otp_hash'     => hashSecretPbkdf2($otp),
        'ua_hash'      => getClientUaHash(),
        'ip'           => getClientIpAddr(),
        'attempts'     => 0,
        'created_at'   => $now,
        'expires_at'   => $now + 300
    ]);
    array_unshift($active, $rec);
    if (count($active) > 50) $active = array_slice($active, 0, 50);
    writeJsonStore('otp_challenges.json', $active);
    return ['challenge_id' => $challengeId, 'otp' => $otp, 'expires_in' => 300];
}

function verifyOtpChallenge($challengeId, $otpCode, $expectedPurpose = null) {
    $challengeId = trim((string)$challengeId);
    $otpCode     = preg_replace('/\s+/', '', (string)$otpCode);
    if ($challengeId === '' || !preg_match('/^\d{6}$/', $otpCode)) {
        return ['ok' => false, 'error' => 'সঠিক ৬-ডিজিটের Telegram OTP কোড দিন।'];
    }
    $list = readJsonStore('otp_challenges.json', []);
    if (!is_array($list)) $list = [];
    $now     = time();
    $matched = null;
    $outList = [];
    $errOut  = 'OTP মেয়াদোত্তীর্ণ বা সঠিক নয়। অনুগ্রহ করে আবার চেষ্টা করুন।';

    foreach ($list as $c) {
        if (!is_array($c) || empty($c['challenge_id']) || (int)($c['expires_at'] ?? 0) <= $now) {
            continue;
        }
        if (($c['challenge_id'] ?? '') === $challengeId) {
            if ($expectedPurpose && ($c['purpose'] ?? '') !== $expectedPurpose) {
                $errOut = 'OTP উদ্দেশ্য সঠিক নয়।';
                continue;
            }
            if (!empty($c['ua_hash']) && !hash_equals($c['ua_hash'], getClientUaHash())) {
                $errOut = 'ভিন্ন ব্রাউজার থেকে OTP ব্যবহার করা যাবে না।';
                continue;
            }
            if (verifySecretPbkdf2($otpCode, $c['otp_hash'] ?? '')) {
                $matched = $c;
                continue; // Consume one-time OTP immediately
            } else {
                $attempts = (int)($c['attempts'] ?? 0) + 1;
                if ($attempts < 5) {
                    $c['attempts'] = $attempts;
                    $outList[] = $c;
                    $errOut = 'ভুল OTP কোড! বাকি চেষ্টা: ' . (5 - $attempts);
                } else {
                    $errOut = 'অনেকবার ভুল OTP দেওয়া হয়েছে। আবার নতুন করে লগইন করুন।';
                }
                continue;
            }
        }
        $outList[] = $c;
    }

    writeJsonStore('otp_challenges.json', $outList);
    if ($matched) {
        return ['ok' => true, 'data' => $matched];
    }
    return ['ok' => false, 'error' => $errOut];
}

// Admin-Only Server Session Store (AlwaysData ranonex_data/admin_sessions.json)
// Never created for regular storefront visitors — strictly only after Admin/Staff login!
function createAdminSession($actor, $role, $sid, $perms, $tv, $ttlMs = 43200000) {
    $sessions = readJsonStore('admin_sessions.json', []);
    if (!is_array($sessions)) $sessions = [];
    $nowMs = (int)round(microtime(true) * 1000);
    // Prune expired sessions
    $active = [];
    foreach ($sessions as $s) {
        if (is_array($s) && !empty($s['jti']) && (float)($s['expires_at'] ?? 0) > $nowMs) {
            $active[] = $s;
        }
    }
    $jti       = bin2hex(random_bytes(16));
    $expiresAt = $nowMs + $ttlMs;
    array_unshift($active, [
        'jti'        => $jti,
        'sub'        => (string)$actor,
        'role'       => (string)$role,
        'sid'        => (string)$sid,
        'ua_hash'    => getClientUaHash(),
        'ua_label'   => getClientUaLabel(),
        'ip'         => getClientIpAddr(),
        'created_at' => gmdate('c'),
        'last_seen'  => gmdate('c'),
        'expires_at' => $expiresAt
    ]);
    if (count($active) > 25) {
        $active = array_slice($active, 0, 25);
    }
    writeJsonStore('admin_sessions.json', $active);

    $payload = [
        'jti'         => $jti,
        'sub'         => (string)$actor,
        'role'        => (string)$role,
        'sid'         => (string)$sid,
        'permissions' => $perms,
        'tv'          => (int)$tv,
        'iat'         => $nowMs,
        'exp'         => $expiresAt
    ];
    return ['token' => signAdminToken($payload), 'expires_at' => $expiresAt, 'jti' => $jti];
}

function revokeAdminSessionByJti($jti) {
    if (!$jti) return false;
    $sessions = readJsonStore('admin_sessions.json', []);
    if (!is_array($sessions)) return false;
    $next = [];
    $removed = false;
    foreach ($sessions as $s) {
        if (($s['jti'] ?? '') === $jti) {
            $removed = true;
            continue;
        }
        $next[] = $s;
    }
    if ($removed) writeJsonStore('admin_sessions.json', $next);
    return $removed;
}

function appendAuditLog($actor, $role, $action, $target = '', $details = '') {
    $logs = readJsonStore('staff_logs.json', []);
    if (!is_array($logs)) $logs = [];
    array_unshift($logs, [
        'id'         => bin2hex(random_bytes(6)),
        'actor'      => (string)$actor,
        'role'       => (string)$role,
        'action'     => (string)$action,
        'target'     => mb_substr((string)$target, 0, 120),
        'details'    => mb_substr((string)$details, 0, 400),
        'ip'         => getClientIpAddr(),
        'created_at' => gmdate('c')
    ]);
    if (count($logs) > 1000) {
        $logs = array_slice($logs, 0, 1000);
    }
    writeJsonStore('staff_logs.json', $logs);
}

function b64UrlEncode($str) {
    return rtrim(strtr(base64_encode($str), '+/', '-_'), '=');
}

function b64DecodeFlex($str) {
    $b64 = strtr($str, '-_', '+/');
    $pad = strlen($b64) % 4;
    if ($pad) $b64 .= str_repeat('=', 4 - $pad);
    return base64_decode($b64);
}

function signAdminToken($payload, $secret = null) {
    $sec = $secret ?: getServerSigningSecret();
    $data = base64_encode(json_encode($payload));
    $sig = hash_hmac('sha256', $data, $sec, true);
    return $data . '.' . b64UrlEncode($sig);
}

function verifyAdminToken($token, $secret = null) {
    if (!$token || !is_string($token)) return null;
    $sec = $secret ?: getServerSigningSecret();
    $parts = explode('.', trim($token));
    if (count($parts) === 2) {
        list($data, $sigB64) = $parts;
        $bodyB64 = $data;
    } elseif (count($parts) === 3) {
        list($hdrB64, $bodyB64, $sigB64) = $parts;
        $data = $hdrB64 . '.' . $bodyB64;
    } else {
        return null;
    }
    $expectedSig = hash_hmac('sha256', $data, $sec, true);
    $actualSig   = b64DecodeFlex($sigB64);
    if (!$actualSig || !hash_equals($expectedSig, $actualSig)) {
        return null;
    }
    $payload = json_decode(b64DecodeFlex($bodyB64), true);
    if (!is_array($payload)) return null;
    $nowMs = round(microtime(true) * 1000);
    if (!empty($payload['exp']) && $nowMs > (float)$payload['exp']) {
        return null;
    }

    // Strict Server-Side Admin Session Check + Browser UA Binding (ranonex_data/admin_sessions.json)
    $jti = (string)($payload['jti'] ?? '');
    if ($jti === '') return null;
    $sessions = readJsonStore('admin_sessions.json', []);
    $sessRec = null;
    foreach ($sessions as $s) {
        if (($s['jti'] ?? '') === $jti && (float)($s['expires_at'] ?? 0) > $nowMs) {
            $sessRec = $s;
            break;
        }
    }
    if (!$sessRec) return null;
    if (!empty($sessRec['ua_hash']) && !hash_equals($sessRec['ua_hash'], getClientUaHash())) {
        return null;
    }

    // Live token_version & active-status check against AlwaysData Private Storage
    $role = $payload['role'] ?? 'master_admin';
    $tv   = (int)($payload['tv'] ?? 1);
    if ($role === 'staff' && !empty($payload['sid'])) {
        $staffList = readJsonStore('staff.json', []);
        $matchedStaff = null;
        foreach ($staffList as $st) {
            if (($st['id'] ?? '') === $payload['sid']) {
                $matchedStaff = $st;
                break;
            }
        }
        if (!$matchedStaff || empty($matchedStaff['is_active'])) return null;
        if ((int)($matchedStaff['token_version'] ?? 1) !== $tv) return null;
        $payload['permissions'] = normalizeStaffPermissions($matchedStaff['permissions'] ?? null, true);
    } else {
        $master = readJsonStore('master_admin.json', []);
        if (!empty($master) && (int)($master['token_version'] ?? 1) !== $tv) {
            return null;
        }
    }
    return $payload;
}

function getRequestAdminToken($body = []) {
    $auth = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? $_SERVER['HTTP_X_ADMIN_TOKEN']
        ?? '';
    if (!$auth && function_exists('getallheaders')) {
        foreach (getallheaders() as $k => $v) {
            $kl = strtolower($k);
            if ($kl === 'authorization' || $kl === 'x-admin-token') {
                $auth = $v;
                break;
            }
        }
    }
    $auth = trim((string)$auth);
    if (stripos($auth, 'Bearer ') === 0) {
        return trim(substr($auth, 7));
    }
    if ($auth !== '') return $auth;
    if (is_array($body) && !empty($body['_token'])) {
        return trim((string)$body['_token']);
    }
    return '';
}

function getPermissionSchema() {
    return [
        'orders'     => ['view', 'edit', 'delete'],
        'products'   => ['view', 'create', 'edit', 'delete'],
        'reviews'    => ['view', 'edit', 'delete'],
        'categories' => ['view', 'create', 'edit', 'delete'],
        'promos'     => ['view', 'create', 'edit', 'delete'],
        'banners'    => ['view', 'create', 'edit', 'delete'],
        'sections'   => ['view', 'create', 'edit', 'delete'],
        'delivery'   => ['view', 'create', 'edit', 'delete'],
        'addons'     => ['view', 'create', 'edit', 'delete'],
        'brands'     => ['view', 'create', 'edit', 'delete'],
        'settings'   => ['view', 'edit']
    ];
}

function getDefaultStaffPermissions() {
    $out = [];
    foreach (getPermissionSchema() as $mod => $actions) {
        $out[$mod] = [];
        foreach ($actions as $act) {
            // Default Staff policy: ONLY Orders has view + edit enabled; delete is OFF by default.
            $out[$mod][$act] = ($mod === 'orders' && ($act === 'view' || $act === 'edit'));
        }
    }
    return $out;
}

function normalizeStaffPermissions($raw, $useDefaultIfMissing = false) {
    $schema = getPermissionSchema();
    if (!is_array($raw)) {
        return $useDefaultIfMissing ? getDefaultStaffPermissions() : array_map(function($acts) {
            return array_fill_keys($acts, false);
        }, $schema);
    }
    // Support legacy flat module lists e.g. ['orders', 'products']
    $isSeqList = (empty($raw) || array_keys($raw) === range(0, count($raw) - 1));
    if ($isSeqList) {
        if (empty($raw) && $useDefaultIfMissing) {
            return getDefaultStaffPermissions();
        }
        $out = [];
        foreach ($schema as $mod => $acts) {
            $hasMod = in_array($mod, $raw, true);
            $out[$mod] = [];
            foreach ($acts as $act) {
                if ($mod === 'orders') {
                    $out[$mod][$act] = ($hasMod && ($act === 'view' || $act === 'edit'));
                } else {
                    $out[$mod][$act] = ($hasMod && $act !== 'delete');
                }
            }
        }
        return $out;
    }

    $out = [];
    foreach ($schema as $mod => $acts) {
        $modIn = isset($raw[$mod]) && is_array($raw[$mod]) ? $raw[$mod] : [];
        $out[$mod] = [];
        foreach ($acts as $act) {
            $out[$mod][$act] = !empty($modIn[$act]);
        }
        // Any write permission implies read/view access so staff can load that screen
        if (!empty($out[$mod]['create']) || !empty($out[$mod]['edit']) || !empty($out[$mod]['delete'])) {
            $out[$mod]['view'] = true;
        }
    }
    return $out;
}

function hasStaffPermission($user, $module, $action = 'view') {
    $role = is_array($user) ? ($user['role'] ?? 'master_admin') : 'master_admin';
    if ($role !== 'staff') return true;
    if ($module === 'master_only') return false;
    $perms = is_array($user['permissions'] ?? null) ? $user['permissions'] : [];
    if (isset($perms[$module]) && is_array($perms[$module])) {
        return !empty($perms[$module][$action]);
    }
    return false;
}

function assertAdminPermission($adminUser, $requiredPerm, $requiredAction = 'view') {
    $role = $adminUser['role'] ?? 'master_admin';
    if ($requiredPerm && $role === 'staff') {
        if ($requiredPerm === 'master_only' || !hasStaffPermission($adminUser, $requiredPerm, $requiredAction)) {
            header('Cache-Control: no-store, no-cache, must-revalidate');
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'error'   => 'Forbidden: Missing permission (' . $requiredPerm . '.' . $requiredAction . ').'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
}

function summarizePermissionsForLog($perms) {
    $parts = [];
    if (!is_array($perms)) return '';
    foreach ($perms as $mod => $acts) {
        if (!is_array($acts)) continue;
        $on = [];
        foreach ($acts as $a => $v) {
            if (!empty($v)) $on[] = $a;
        }
        if (!empty($on)) $parts[] = $mod . '[' . implode('/', $on) . ']';
    }
    return implode(', ', $parts);
}

function requireAdminAuth($body = [], $requiredPerm = null, $requiredAction = 'view') {
    $token = getRequestAdminToken($body);
    $verified = verifyAdminToken($token);
    if (!$verified) {
        header('Cache-Control: no-store, no-cache, must-revalidate');
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error'   => 'Unauthorized: Valid Admin session token required.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    assertAdminPermission($verified, $requiredPerm, $requiredAction);
    return $verified;
}

function generateUuidV4() {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function readJsonBody() {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

// ============================================================================
// 3. BRAND & SHARED CATEGORY FILTERING HELPERS
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
    if (!empty($brand['name']))        $merged['store_name']   = $brand['name'];
    if (!empty($brand['tagline']))     $merged['tagline']      = $brand['tagline'];
    if (!empty($brand['logo_url']))    $merged['logo_url']     = $brand['logo_url'];
    if (!empty($brand['favicon_url'])) $merged['favicon_url']  = $brand['favicon_url'];
    if (!empty($brand['footer_text'])) $merged['footer_about'] = $brand['footer_text'];
    return $merged;
}

// ============================================================================
// 4. ROUTE DISPATCHER (Stateless Auth + User Writes + Admin Writes + Edge Reads)
// ============================================================================
$pathInfo  = $_SERVER['PATH_INFO'] ?? '';
$reqUri    = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$endpoint  = isset($_GET['endpoint']) ? $_GET['endpoint'] : ($pathInfo ?: $reqUri);
$brandSlug = trim($_GET['brand'] ?? $_GET['brand_id'] ?? '');
$productId = trim($_GET['product_id'] ?? '');
$chunkNum  = isset($_GET['chunk']) ? max(1, (int)$_GET['chunk']) : 0;
$method    = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

// ----------------------------------------------------------------------------
// AUTH ROUTE 1: POST /admin-login & /verify-admin-otp (Master Admin + Staff)
//   - Strict 1-time Master Admin creation lock (until deleted)
//   - Mandatory Telegram Bot OTP 2FA for Master Creation, Master Login & Staff Login
// ----------------------------------------------------------------------------
if ((strpos($endpoint, 'admin-login') !== false || strpos($endpoint, 'verify-admin-otp') !== false) && $method === 'POST') {
    header('Cache-Control: no-store, no-cache, must-revalidate');
    $clientIp = getClientIpAddr();
    $rlMap    = readJsonStore('login_rl.json', []);
    if (!is_array($rlMap)) $rlMap = [];
    $nowSec   = time();
    foreach ($rlMap as $ipKey => $entry) {
        if (($entry['reset_at'] ?? 0) < $nowSec && ($entry['lock_until'] ?? 0) < $nowSec) {
            unset($rlMap[$ipKey]);
        }
    }
    $ipRec = $rlMap[$clientIp] ?? ['fails' => 0, 'reset_at' => $nowSec + 300, 'lock_until' => 0];
    if (($ipRec['lock_until'] ?? 0) > $nowSec) {
        $waitSec = $ipRec['lock_until'] - $nowSec;
        http_response_code(429);
        echo json_encode([
            'success' => false,
            'error'   => 'অনেকবার ভুল চেষ্টা করা হয়েছে! নিরাপত্তার জন্য ' . $waitSec . ' সেকেন্ড অপেক্ষা করুন।'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $body        = readJsonBody();
    $challengeId = trim((string)($body['challenge_id'] ?? ''));
    $otpCode     = trim((string)($body['otp_code'] ?? ''));

    // ------------------------------------------------------------------------
    // PHASE 2: Verify Telegram OTP & Complete Login / 1-Time Master Creation
    // ------------------------------------------------------------------------
    if ($challengeId !== '' || strpos($endpoint, 'verify-admin-otp') !== false) {
        $ver = verifyOtpChallenge($challengeId, $otpCode);
        if (empty($ver['ok'])) {
            $fails = (($ipRec['reset_at'] ?? 0) > $nowSec) ? (($ipRec['fails'] ?? 0) + 1) : 1;
            $lockUntil = ($fails >= 5) ? ($nowSec + 300) : 0;
            $rlMap[$clientIp] = [
                'fails'      => $lockUntil ? 0 : $fails,
                'reset_at'   => $nowSec + 300,
                'lock_until' => $lockUntil
            ];
            writeJsonStore('login_rl.json', $rlMap);
            appendAuditLog('anonymous', 'anonymous', 'LOGIN_OTP_FAILED', 'admin-login', $ver['error'] ?? 'Invalid OTP');
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => $ver['error'] ?? 'ভুল OTP কোড।'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $chRec        = $ver['data'];
        $purpose      = $chRec['purpose'] ?? 'login_master';
        $matchedUser  = $chRec['username'] ?? 'admin';
        $matchedRole  = $chRec['role'] ?? 'master_admin';
        $matchedSid   = $chRec['sid'] ?? '';
        $tokenVersion = (int)($chRec['token_version'] ?? 1);
        $matchedPerms = ($matchedRole === 'staff')
            ? normalizeStaffPermissions($chRec['permissions'] ?? null, true)
            : ['*'];

        if ($purpose === 'bootstrap_master') {
            $existingMaster = readJsonStore('master_admin.json', []);
            if (!empty($existingMaster['username']) && !empty($existingMaster['password_hash'])) {
                http_response_code(403);
                echo json_encode([
                    'success' => false,
                    'error'   => 'এই সাইটে ইতিমধ্যে Master Admin তৈরি আছে! পুরনো Master ID ডিলিট না করা পর্যন্ত নতুন Master Admin খোলা যাবে না।'
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            writeJsonStore('master_admin.json', [
                'username'      => $matchedUser,
                'password_hash' => $chRec['password_hash'],
                'pin_hash'      => '',
                'token_version' => 1,
                'created_at'    => gmdate('c'),
                'updated_at'    => gmdate('c')
            ]);
            appendAuditLog($matchedUser, 'master_admin', 'MASTER_CREATED', $matchedUser, '1-time Master Admin created with Telegram 2FA');
        } elseif ($purpose === 'login_staff' && $matchedSid !== '') {
            $staffList = readJsonStore('staff.json', []);
            foreach ($staffList as &$st) {
                if (($st['id'] ?? '') === $matchedSid) {
                    $st['last_login'] = gmdate('c');
                    $matchedPerms = normalizeStaffPermissions($st['permissions'] ?? null, true);
                    $tokenVersion = (int)($st['token_version'] ?? 1);
                    break;
                }
            }
            unset($st);
            writeJsonStore('staff.json', $staffList);
        }

        unset($rlMap[$clientIp]);
        writeJsonStore('login_rl.json', $rlMap);

        $sessInfo  = createAdminSession($matchedUser, $matchedRole, $matchedSid, $matchedPerms, $tokenVersion, 12 * 60 * 60 * 1000);
        $token     = $sessInfo['token'];
        $expiresAt = $sessInfo['expires_at'];
        appendAuditLog($matchedUser, $matchedRole, 'LOGIN_SUCCESS', 'admin-login', 'Telegram 2FA verified | Session ' . substr($sessInfo['jti'], 0, 8));

        echo json_encode([
            'success'        => true,
            'token'          => $token,
            'expires_at'     => $expiresAt,
            'validity_hours' => 12,
            'user'           => [
                'email'       => $matchedUser,
                'role'        => $matchedRole,
                'permissions' => $matchedPerms
            ]
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ------------------------------------------------------------------------
    // PHASE 1: Verify Credentials & Send Mandatory Telegram Bot OTP
    // ------------------------------------------------------------------------
    $inputUser   = strtolower(trim((string)($body['username'] ?? $body['email'] ?? '')));
    $inputPass   = (string)($body['password'] ?? '');
    $securityPin = trim((string)($body['security_pin'] ?? ''));

    if ($inputUser === '' || $inputPass === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ইউজারনেম এবং পাসওয়ার্ড প্রদান করুন।'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $isValid      = false;
    $requirePin   = false;
    $matchedUser  = $inputUser;
    $matchedRole  = 'master_admin';
    $matchedPerms = ['*'];
    $matchedSid   = '';
    $tokenVersion = 1;
    $otpPurpose   = 'login_master';
    $targetChatId = '';
    $bootstrapHash = '';

    $masterStore  = readJsonStore('master_admin.json', []);
    $masterExists = !empty($masterStore['username']) && !empty($masterStore['password_hash']);

    if ($masterExists) {
        // 1A. Existing Master Admin (Strictly 1 per site — bootstrap NEVER runs again until deleted!)
        if ($inputUser === strtolower(trim((string)$masterStore['username'])) && verifySecretPbkdf2($inputPass, $masterStore['password_hash'])) {
            if (!empty($masterStore['pin_hash'])) {
                if ($securityPin === '') {
                    $requirePin = true;
                } elseif (verifySecretPbkdf2($securityPin, $masterStore['pin_hash'])) {
                    $isValid = true;
                }
            } else {
                $isValid = true;
            }
            if ($isValid) {
                $matchedUser  = $masterStore['username'];
                $matchedRole  = 'master_admin';
                $tokenVersion = (int)($masterStore['token_version'] ?? 1);
                $otpPurpose   = 'login_master';
            }
        }
    }

    if ($requirePin) {
        http_response_code(401);
        echo json_encode([
            'success'     => false,
            'require_pin' => true,
            'error'       => '🔐 ২য় ধাপ: আপনার Master Security PIN দিন।'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // 2. Check Staff accounts stored in AlwaysData database (ranonex_data/staff.json)
    if (!$isValid) {
        $staffList = readJsonStore('staff.json', []);
        foreach ($staffList as $st) {
            if (strtolower(trim((string)($st['email'] ?? ''))) === $inputUser && !empty($st['is_active'])) {
                if (verifySecretPbkdf2($inputPass, $st['password_hash'] ?? '')) {
                    $isValid      = true;
                    $matchedUser  = $st['email'];
                    $matchedRole  = 'staff';
                    $matchedSid   = $st['id'] ?? '';
                    $matchedPerms = normalizeStaffPermissions($st['permissions'] ?? null, true);
                    $tokenVersion = (int)($st['token_version'] ?? 1);
                    $targetChatId = trim((string)($st['telegram_chat_id'] ?? ''));
                    $otpPurpose   = 'login_staff';
                    break;
                }
            }
        }
    }

    // 3. First-time Master Bootstrap ONLY when NO Master Admin exists yet
    if (!$isValid && !$masterExists) {
        // Step 1: Check explicit AlwaysData env vars first if configured
        if (getenv('ADMIN_USERNAME') && getenv('ADMIN_PASSWORD')) {
            $validUser = strtolower(trim((string)getenv('ADMIN_USERNAME')));
            $validPass = (string)getenv('ADMIN_PASSWORD');
            if ($inputUser === $validUser && hash_equals($validPass, $inputPass)) {
                $isValid     = true;
                $matchedUser = trim((string)getenv('ADMIN_USERNAME'));
            }
        }

        // Step 2: Verify once server-to-server against Cloudflare Pages /api/admin-login
        if (!$isValid) {
            $cfSiteUrl = rtrim((string)ALLOWED_SITE_URL, '/');
            if ($cfSiteUrl !== '' && strpos($cfSiteUrl, 'your-domain.com') === false) {
                $ch = curl_init($cfSiteUrl . '/api/admin-login');
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_POST           => true,
                    CURLOPT_POSTFIELDS     => json_encode(['username' => $inputUser, 'password' => $inputPass]),
                    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
                    CURLOPT_TIMEOUT        => 10
                ]);
                $cfRes  = curl_exec($ch);
                $cfCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);
                $cfJson = $cfRes ? json_decode($cfRes, true) : null;
                if ($cfCode === 200 && !empty($cfJson['success'])) {
                    $isValid     = true;
                    $matchedUser = $cfJson['user']['email'] ?? $inputUser;
                }
            }
        }

        // Step 3: Fallback check against D1 admins table
        if (!$isValid) {
            $adminRows = d1Query("SELECT * FROM admins WHERE LOWER(email) = ? LIMIT 1", [$inputUser]);
            if (!empty($adminRows[0]['password_hash'])) {
                $storedHash = (string)$adminRows[0]['password_hash'];
                if (verifySecretPbkdf2($inputPass, $storedHash) || hash_equals($storedHash, $inputPass)) {
                    $isValid     = true;
                    $matchedUser = $adminRows[0]['email'];
                }
            }
        }

        if ($isValid) {
            $matchedRole   = 'master_admin';
            $tokenVersion  = 1;
            $otpPurpose    = 'bootstrap_master';
            $bootstrapHash = hashSecretPbkdf2($inputPass);
        }
    }

    if (!$isValid) {
        $fails = (($ipRec['reset_at'] ?? 0) > $nowSec) ? (($ipRec['fails'] ?? 0) + 1) : 1;
        $lockUntil = ($fails >= 5) ? ($nowSec + 300) : 0;
        $rlMap[$clientIp] = [
            'fails'      => $lockUntil ? 0 : $fails,
            'reset_at'   => $nowSec + 300,
            'lock_until' => $lockUntil
        ];
        writeJsonStore('login_rl.json', $rlMap);
        appendAuditLog($inputUser, 'anonymous', 'LOGIN_FAILED', 'admin-login', 'Failed attempts: ' . $fails);
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'ভুল ইউজারনেম, পাসওয়ার্ড বা PIN প্রদান করা হয়েছে!'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Credentials matched! Now MANDATORY Telegram Bot OTP (Master Creation / Master Login / Staff Login)
    $tg = getTelegram2FaConfig();
    if ($tg['bot_token'] === '') {
        http_response_code(503);
        echo json_encode([
            'success' => false,
            'error'   => 'Telegram Bot API Token (TELEGRAM_BOT_TOKEN) AlwaysData-তে কনফিগার করা নেই! অনুগ্রহ করে AlwaysData Env-এ TELEGRAM_BOT_TOKEN এবং TELEGRAM_CHAT_ID সেট করুন।'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($matchedRole === 'staff') {
        if ($targetChatId === '') {
            http_response_code(403);
            echo json_encode([
                'success' => false,
                'error'   => 'এই Staff অ্যাকাউন্টের জন্য Telegram Chat ID সেট করা নেই। Master Admin-কে AlwaysData Staff ডাটাবেসে আপনার Telegram Chat ID যোগ করতে বলুন।'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    } else {
        $targetChatId = $tg['master_chat_id'];
        if ($targetChatId === '') {
            http_response_code(503);
            echo json_encode([
                'success' => false,
                'error'   => 'Master Admin-এর Telegram Chat ID (TELEGRAM_CHAT_ID) AlwaysData-তে সেট করা নেই! Env-এ TELEGRAM_CHAT_ID সেট করুন।'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    $purposeLabel = ($otpPurpose === 'bootstrap_master')
        ? 'New Master Admin Creation (1-Time)'
        : (($otpPurpose === 'login_staff') ? 'Staff Admin Login' : 'Master Admin Login');

    $chInfo = createOtpChallenge([
        'purpose'       => $otpPurpose,
        'username'      => $matchedUser,
        'password_hash' => $bootstrapHash,
        'role'          => $matchedRole,
        'sid'           => $matchedSid,
        'permissions'   => $matchedPerms,
        'token_version' => $tokenVersion,
        'chat_id'       => $targetChatId
    ]);

    $tgSend = sendTelegramOtpMessage($tg['bot_token'], $targetChatId, $chInfo['otp'], $purposeLabel, $matchedUser, $clientIp);
    if (empty($tgSend['success'])) {
        http_response_code(502);
        echo json_encode([
            'success' => false,
            'error'   => $tgSend['error'] ?? 'Telegram OTP পাঠানো সম্ভব হয়নি!'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    unset($rlMap[$clientIp]);
    writeJsonStore('login_rl.json', $rlMap);
    appendAuditLog($matchedUser, $matchedRole, 'OTP_SENT', $otpPurpose, 'Sent 2FA OTP to Telegram');

    $maskedChat = strlen($targetChatId) > 4 ? (str_repeat('•', strlen($targetChatId) - 4) . substr($targetChatId, -4)) : $targetChatId;
    echo json_encode([
        'success'      => false,
        'require_otp'  => true,
        'is_bootstrap' => ($otpPurpose === 'bootstrap_master'),
        'challenge_id' => $chInfo['challenge_id'],
        'otp_target'   => 'Telegram (' . $maskedChat . ')',
        'expires_in'   => $chInfo['expires_in'],
        'message'      => ($otpPurpose === 'bootstrap_master')
            ? '📲 প্রথমবার Master Admin তৈরির জন্য আপনার Telegram-এ 6-ডিজিটের OTP পাঠানো হয়েছে!'
            : '📲 আপনার Telegram-এ 6-ডিজিটের OTP পাঠানো হয়েছে! কোডটি দিয়ে ভেরিফাই করুন।'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ----------------------------------------------------------------------------
// AUTH ROUTE 1B: POST /admin-logout (Revoke Current Session Immediately)
// ----------------------------------------------------------------------------
if (strpos($endpoint, 'admin-logout') !== false && $method === 'POST') {
    header('Cache-Control: no-store, no-cache, must-revalidate');
    $body     = readJsonBody();
    $verified = verifyAdminToken(getRequestAdminToken($body));
    if ($verified && !empty($verified['jti'])) {
        revokeAdminSessionByJti($verified['jti']);
        appendAuditLog($verified['sub'] ?? 'admin', $verified['role'] ?? 'master_admin', 'LOGOUT', 'admin-logout', 'Session revoked');
    }
    echo json_encode(['success' => true]);
    exit;
}

// ----------------------------------------------------------------------------
// AUTH ROUTE 2: POST /verify-token (Server-Side Session + Version Verification)
// ----------------------------------------------------------------------------
if (strpos($endpoint, 'verify-token') !== false) {
    header('Cache-Control: no-store, no-cache, must-revalidate');
    $body     = readJsonBody();
    $token    = getRequestAdminToken($body);
    $verified = verifyAdminToken($token);
    if ($verified) {
        echo json_encode(['success' => true, 'valid' => true, 'user' => $verified], JSON_UNESCAPED_UNICODE);
    } else {
        http_response_code(401);
        echo json_encode(['success' => false, 'valid' => false, 'error' => 'Token invalid or expired'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

// ----------------------------------------------------------------------------
// MASTER ADMIN SECURITY ROUTE: POST /master-security (Password, PIN, Logout All)
// ----------------------------------------------------------------------------
if (strpos($endpoint, 'master-security') !== false && $method === 'POST') {
    header('Cache-Control: no-store, no-cache, must-revalidate');
    $body      = readJsonBody();
    $adminUser = requireAdminAuth($body, 'master_only');
    $action    = strtolower(trim((string)($body['action'] ?? 'status')));
    $master    = readJsonStore('master_admin.json', []);

    if ($action === 'status') {
        $tg = getTelegram2FaConfig();
        $mc = $tg['master_chat_id'] ?? '';
        $mcMask = strlen($mc) > 4 ? (str_repeat('•', strlen($mc) - 4) . substr($mc, -4)) : $mc;
        echo json_encode([
            'success' => true,
            'data'    => [
                'username'      => $master['username'] ?? ($adminUser['sub'] ?? 'admin'),
                'has_pin'       => !empty($master['pin_hash']),
                'token_version' => (int)($master['token_version'] ?? 1),
                'updated_at'    => $master['updated_at'] ?? null,
                'telegram'      => [
                    'configured'         => ($tg['bot_token'] !== '' && $mc !== ''),
                    'has_bot_token'      => ($tg['bot_token'] !== ''),
                    'master_chat_masked' => $mcMask,
                    'env_locked'         => !empty($tg['env_locked']),
                    'source'             => $tg['source'] ?? 'none'
                ]
            ]
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'save_telegram') {
        $curPass = (string)($body['current_password'] ?? '');
        if ($curPass === '' || empty($master['password_hash']) || !verifySecretPbkdf2($curPass, $master['password_hash'])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'বর্তমান Master পাসওয়ার্ড সঠিক নয়।'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $existingSaved = readJsonStore('telegram_config.json', []);
        $botTok = trim((string)($body['bot_token'] ?? ''));
        $chatId = trim((string)($body['master_chat_id'] ?? ''));
        if ($botTok === '' && !empty($existingSaved['bot_token'])) $botTok = $existingSaved['bot_token'];
        if ($chatId === '' && !empty($existingSaved['master_chat_id'])) $chatId = $existingSaved['master_chat_id'];
        if ($botTok === '' || $chatId === '' || !preg_match('/^-?\d{5,20}$/', $chatId)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'সঠিক Telegram Bot Token এবং Numeric Chat ID দিন।'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $ping = sendTelegramOtpMessage($botTok, $chatId, 'TEST-OK', 'Master Telegram 2FA Test', $master['username'] ?? 'master', getClientIpAddr());
        if (empty($ping['success'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $ping['error'] ?? 'Telegram টেস্ট মেসেজ পাঠানো যায়নি!'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        writeJsonStore('telegram_config.json', [
            'bot_token'      => $botTok,
            'master_chat_id' => $chatId,
            'updated_at'     => gmdate('c')
        ]);
        appendAuditLog($adminUser['sub'] ?? 'master', 'master_admin', 'UPDATE_TELEGRAM_2FA', $chatId, 'Updated & verified Telegram Bot 2FA');
        echo json_encode(['success' => true, 'message' => 'Telegram 2FA সেটআপ সেভ ও টেস্ট সম্পন্ন হয়েছে! আপনার Telegram চেক করুন।'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'request_delete_otp') {
        $curPass = (string)($body['current_password'] ?? '');
        if ($curPass === '' || empty($master['password_hash']) || !verifySecretPbkdf2($curPass, $master['password_hash'])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'বর্তমান Master পাসওয়ার্ড সঠিক নয়।'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $tg = getTelegram2FaConfig();
        if ($tg['bot_token'] === '' || $tg['master_chat_id'] === '') {
            http_response_code(503);
            echo json_encode(['success' => false, 'error' => 'Master Telegram 2FA কনফিগার করা নেই!'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $chInfo = createOtpChallenge([
            'purpose'  => 'delete_master',
            'username' => $master['username'] ?? 'master'
        ]);
        $tgSend = sendTelegramOtpMessage($tg['bot_token'], $tg['master_chat_id'], $chInfo['otp'], 'DELETE Master Admin ID', $master['username'] ?? 'master', getClientIpAddr());
        if (empty($tgSend['success'])) {
            http_response_code(502);
            echo json_encode(['success' => false, 'error' => $tgSend['error'] ?? 'Telegram OTP পাঠানো যায়নি!'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        echo json_encode(['success' => true, 'challenge_id' => $chInfo['challenge_id'], 'message' => 'Master ID ডিলিটের OTP আপনার Telegram-এ পাঠানো হয়েছে।'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'delete_master') {
        $curPass = (string)($body['current_password'] ?? '');
        if ($curPass === '' || empty($master['password_hash']) || !verifySecretPbkdf2($curPass, $master['password_hash'])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'বর্তমান Master পাসওয়ার্ড সঠিক নয়।'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $ver = verifyOtpChallenge($body['challenge_id'] ?? '', $body['otp_code'] ?? '', 'delete_master');
        if (empty($ver['ok'])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => $ver['error'] ?? 'সঠিক Telegram OTP দিন।'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $masterPath = getPrivateDataDir() . DIRECTORY_SEPARATOR . 'master_admin.json';
        if (file_exists($masterPath)) @unlink($masterPath);
        writeJsonStore('admin_sessions.json', []);
        appendAuditLog($adminUser['sub'] ?? 'master', 'master_admin', 'MASTER_DELETED', $master['username'] ?? 'master', 'Master Admin ID deleted — 1-time bootstrap unlocked');
        echo json_encode(['success' => true, 'message' => 'Master Admin ID ডিলিট করা হয়েছে। এখন ১ বার নতুন Master Admin সেট করা যাবে।'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'list_sessions') {
        $sessions = readJsonStore('admin_sessions.json', []);
        $nowMs    = round(microtime(true) * 1000);
        $curJti   = $adminUser['jti'] ?? '';
        $out      = [];
        foreach ($sessions as $s) {
            if ((float)($s['expires_at'] ?? 0) <= $nowMs) continue;
            $out[] = [
                'jti'        => $s['jti'],
                'sub'        => $s['sub'] ?? '',
                'role'       => $s['role'] ?? '',
                'ip'         => $s['ip'] ?? '',
                'ua_label'   => $s['ua_label'] ?? '',
                'created_at' => $s['created_at'] ?? '',
                'expires_at' => $s['expires_at'] ?? 0,
                'is_current' => (($s['jti'] ?? '') === $curJti)
            ];
        }
        echo json_encode(['success' => true, 'sessions' => $out], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'revoke_session') {
        $targetJti = trim((string)($body['jti'] ?? ''));
        $okRev = revokeAdminSessionByJti($targetJti);
        if ($okRev) appendAuditLog($adminUser['sub'] ?? 'master', 'master_admin', 'REVOKE_SESSION', substr($targetJti, 0, 10), '');
        echo json_encode(['success' => true, 'revoked' => $okRev], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'revoke_all') {
        $master['token_version'] = (int)($master['token_version'] ?? 1) + 1;
        $master['updated_at']    = gmdate('c');
        writeJsonStore('master_admin.json', $master);
        writeJsonStore('admin_sessions.json', []);
        // Rotate signing key too so all previously issued tokens die instantly
        $newKey = bin2hex(random_bytes(32));
        @file_put_contents(getPrivateDataDir() . DIRECTORY_SEPARATOR . 'secret.key', $newKey, LOCK_EX);
        appendAuditLog($adminUser['sub'] ?? 'master', 'master_admin', 'REVOKE_ALL_SESSIONS', 'admin_sessions.json', 'Cleared sessions, rotated secret & bumped token_version');
        echo json_encode(['success' => true, 'message' => 'সকল ডিভাইস থেকে লগআউট সম্পন্ন হয়েছে!'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'update_credentials') {
        $curPass = (string)($body['current_password'] ?? '');
        if ($curPass === '' || empty($master['password_hash']) || !verifySecretPbkdf2($curPass, $master['password_hash'])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => 'বর্তমান পাসওয়ার্ড সঠিক নয়।'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $newUser = strtolower(trim((string)($body['new_username'] ?? $master['username'])));
        $newPass = (string)($body['new_password'] ?? '');
        $newPin  = trim((string)($body['new_pin'] ?? ''));
        $clearPin = !empty($body['clear_pin']);

        if ($newUser !== '') $master['username'] = $newUser;
        if ($newPass !== '') {
            if (strlen($newPass) < 8) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।'], JSON_UNESCAPED_UNICODE);
                exit;
            }
            $master['password_hash'] = hashSecretPbkdf2($newPass);
        }
        if ($clearPin) {
            $master['pin_hash'] = '';
        } elseif ($newPin !== '') {
            if (!preg_match('/^\d{4,8}$/', $newPin)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Security PIN ৪ থেকে ৮ সংখ্যার (শুধু ডিজিট) হতে হবে।'], JSON_UNESCAPED_UNICODE);
                exit;
            }
            $master['pin_hash'] = hashSecretPbkdf2($newPin);
        }
        $master['token_version'] = (int)($master['token_version'] ?? 1) + 1;
        $master['updated_at']    = gmdate('c');
        writeJsonStore('master_admin.json', $master);
        // Replace active Master Admin sessions with a single fresh session on current device
        writeJsonStore('admin_sessions.json', []);
        $sessInfo  = createAdminSession($master['username'], 'master_admin', '', ['*'], $master['token_version'], 12 * 60 * 60 * 1000);
        $newToken  = $sessInfo['token'];
        $expiresAt = $sessInfo['expires_at'];
        appendAuditLog($adminUser['sub'] ?? 'master', 'master_admin', 'UPDATE_MASTER_SECURITY', $master['username'], 'Updated Master Admin credentials/PIN');
        echo json_encode([
            'success'    => true,
            'token'      => $newToken,
            'expires_at' => $expiresAt,
            'username'   => $master['username'],
            'has_pin'    => !empty($master['pin_hash']),
            'message'    => 'Master Admin সিকিউরিটি আপডেট হয়েছে!'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// ----------------------------------------------------------------------------
// STAFF MANAGEMENT ROUTE: GET/POST /staff (AlwaysData Storage — Master Only)
// ----------------------------------------------------------------------------
if (strpos($endpoint, '/staff') !== false && strpos($endpoint, 'staff-logs') === false) {
    header('Cache-Control: no-store, no-cache, must-revalidate');
    $body      = ($method === 'POST') ? readJsonBody() : [];
    $adminUser = requireAdminAuth($body, 'master_only');
    $staffList = readJsonStore('staff.json', []);
    if (!is_array($staffList)) $staffList = [];

    if ($method === 'GET' || (($body['action'] ?? '') === 'list')) {
        $safeList = array_map(function($s) {
            unset($s['password_hash']);
            $s['permissions'] = normalizeStaffPermissions($s['permissions'] ?? null, true);
            return $s;
        }, $staffList);
        echo json_encode([
            'success'             => true,
            'staff'               => $safeList,
            'default_permissions' => getDefaultStaffPermissions(),
            'permission_schema'   => getPermissionSchema()
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($method === 'POST') {
        $action = strtolower(trim((string)($body['action'] ?? 'save')));

        if ($action === 'toggle') {
            $sid = trim((string)($body['id'] ?? ''));
            foreach ($staffList as &$st) {
                if (($st['id'] ?? '') === $sid) {
                    $st['is_active']     = empty($st['is_active']);
                    $st['token_version'] = (int)($st['token_version'] ?? 1) + 1;
                    writeJsonStore('staff.json', $staffList);
                    appendAuditLog($adminUser['sub'] ?? 'master', 'master_admin', 'STAFF_TOGGLE', $st['email'] ?? $sid, 'is_active=' . ($st['is_active'] ? '1' : '0'));
                    echo json_encode(['success' => true, 'is_active' => $st['is_active']], JSON_UNESCAPED_UNICODE);
                    exit;
                }
            }
            unset($st);
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Staff not found']);
            exit;
        }

        if ($action === 'delete') {
            $sid = trim((string)($body['id'] ?? ''));
            $filtered = [];
            $deletedEmail = $sid;
            foreach ($staffList as $st) {
                if (($st['id'] ?? '') === $sid) {
                    $deletedEmail = $st['email'] ?? $sid;
                    continue;
                }
                $filtered[] = $st;
            }
            writeJsonStore('staff.json', $filtered);
            appendAuditLog($adminUser['sub'] ?? 'master', 'master_admin', 'STAFF_DELETE', $deletedEmail, 'Staff removed');
            echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // Save (Add or Update Staff)
        $sid   = trim((string)($body['id'] ?? ''));
        $name  = mb_substr(trim((string)($body['name'] ?? '')), 0, 80);
        $email = strtolower(trim((string)($body['email'] ?? '')));
        $pass  = (string)($body['password'] ?? '');
        $tgChatId = trim((string)($body['telegram_chat_id'] ?? ''));
        $hasExplicitPerms = array_key_exists('permissions', $body) && is_array($body['permissions']);

        if ($name === '' || $email === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'স্টাফের নাম এবং ইমেইল/ইউজারনেম দিন।'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        if ($tgChatId === '' || !preg_match('/^-?\d{5,20}$/', $tgChatId)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'স্টাফের 2FA OTP পাঠানোর জন্য সঠিক numeric Telegram Chat ID দিন (যেমন: 123456789)।'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $master = readJsonStore('master_admin.json', []);
        if (!empty($master['username']) && strtolower(trim((string)$master['username'])) === $email) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Master Admin-এর ইমেইল স্টাফ হিসেবে ব্যবহার করা যাবে না।'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $foundIdx = -1;
        foreach ($staffList as $i => $st) {
            if ($sid !== '' && ($st['id'] ?? '') === $sid) $foundIdx = $i;
            elseif (($st['email'] ?? '') === $email && ($st['id'] ?? '') !== $sid) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'এই ইমেইলে ইতিমধ্যে স্টাফ অ্যাকাউন্ট রয়েছে।'], JSON_UNESCAPED_UNICODE);
                exit;
            }
        }

        if ($foundIdx >= 0) {
            $perms = $hasExplicitPerms
                ? normalizeStaffPermissions($body['permissions'], false)
                : normalizeStaffPermissions($staffList[$foundIdx]['permissions'] ?? null, true);
            $staffList[$foundIdx]['name']             = $name;
            $staffList[$foundIdx]['email']            = $email;
            $staffList[$foundIdx]['telegram_chat_id'] = $tgChatId;
            $staffList[$foundIdx]['permissions']      = $perms;
            if ($pass !== '') {
                if (strlen($pass) < 6) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।'], JSON_UNESCAPED_UNICODE);
                    exit;
                }
                $staffList[$foundIdx]['password_hash'] = hashSecretPbkdf2($pass);
                $staffList[$foundIdx]['token_version'] = (int)($staffList[$foundIdx]['token_version'] ?? 1) + 1;
            }
            $staffList[$foundIdx]['updated_at'] = gmdate('c');
            writeJsonStore('staff.json', $staffList);
            appendAuditLog($adminUser['sub'] ?? 'master', 'master_admin', 'STAFF_UPDATE', $email, 'TG:' . $tgChatId . ' | Perms: ' . summarizePermissionsForLog($perms));
            echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if (strlen($pass) < 6) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'নতুন স্টাফের পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $perms = $hasExplicitPerms
            ? normalizeStaffPermissions($body['permissions'], false)
            : getDefaultStaffPermissions();
        $newStaff = [
            'id'               => 'stf_' . bin2hex(random_bytes(5)),
            'name'             => $name,
            'email'            => $email,
            'telegram_chat_id' => $tgChatId,
            'password_hash'    => hashSecretPbkdf2($pass),
            'permissions'      => $perms,
            'is_active'        => true,
            'token_version'    => 1,
            'created_at'       => gmdate('c'),
            'last_login'       => null
        ];
        $staffList[] = $newStaff;
        writeJsonStore('staff.json', $staffList);
        appendAuditLog($adminUser['sub'] ?? 'master', 'master_admin', 'STAFF_CREATE', $email, 'TG:' . $tgChatId . ' | Perms: ' . summarizePermissionsForLog($perms));
        echo json_encode(['success' => true, 'id' => $newStaff['id']], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// ----------------------------------------------------------------------------
// STAFF ACTIVITY LOGS ROUTE: GET/POST /staff-logs (AlwaysData Storage — Master Only)
// ----------------------------------------------------------------------------
if (strpos($endpoint, 'staff-logs') !== false) {
    header('Cache-Control: no-store, no-cache, must-revalidate');
    $body      = ($method === 'POST') ? readJsonBody() : [];
    $adminUser = requireAdminAuth($body, 'master_only');
    if ($method === 'POST' && (($body['action'] ?? '') === 'clear')) {
        writeJsonStore('staff_logs.json', []);
        appendAuditLog($adminUser['sub'] ?? 'master', 'master_admin', 'LOGS_CLEARED', 'staff_logs.json', 'Master Admin cleared previous logs');
        echo json_encode(['success' => true]);
        exit;
    }
    $logs  = readJsonStore('staff_logs.json', []);
    $limit = max(10, min(500, (int)($_GET['limit'] ?? ($body['limit'] ?? 200))));
    echo json_encode([
        'success' => true,
        'logs'    => array_slice(is_array($logs) ? $logs : [], 0, $limit),
        'total'   => is_array($logs) ? count($logs) : 0
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ----------------------------------------------------------------------------
// USER WRITE ROUTE 1: POST /api/save-review (Customer Review — Forced Unapproved!)
// ----------------------------------------------------------------------------
if (strpos($endpoint, 'save-review') !== false && $method === 'POST') {
    header('Cache-Control: no-store, no-cache, must-revalidate');
    $body      = readJsonBody();
    $prodId    = trim((string)($body['product_id'] ?? ''));
    $custName  = mb_substr(trim((string)($body['customer_name'] ?? '')), 0, 120);
    $custPhone = mb_substr(trim((string)($body['customer_phone'] ?? '')), 0, 40);
    $rating    = max(1, min(5, (int)($body['rating'] ?? 5)));
    $revText   = mb_substr(trim((string)($body['review_text'] ?? '')), 0, 2000);
    $revImg    = trim((string)($body['review_image'] ?? ''));
    if ($revImg !== '' && !preg_match('/^(https?:\/\/|data:image\/)/i', $revImg)) {
        $revImg = '';
    }

    if ($prodId === '' || $custName === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Product ID and customer name are required.']);
        exit;
    }

    // SECURITY FIX: Customers can NEVER self-approve reviews! Only valid Admin token may set is_approved=1.
    $adminPayload = verifyAdminToken(getRequestAdminToken($body));
    $isApproved   = ($adminPayload && !empty($body['is_approved'])) ? 1 : 0;
    $reviewId     = generateUuidV4();

    $res = d1Exec(
        "INSERT INTO reviews (id, product_id, customer_name, customer_phone, rating, review_text, review_image, is_approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [$reviewId, $prodId, $custName, $custPhone ?: null, $rating, $revText ?: null, $revImg ?: null, $isApproved]
    );
    if (!$res['success']) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $res['error'] ?? 'Failed to save review']);
        exit;
    }
    echo json_encode(['success' => true, 'result' => [['results' => $res['results']]]], JSON_UNESCAPED_UNICODE);
    exit;
}

// ----------------------------------------------------------------------------
// USER WRITE ROUTE 2: POST /api/save-order (Customer Order Placement)
// ----------------------------------------------------------------------------
if (strpos($endpoint, 'save-order') !== false && $method === 'POST') {
    header('Cache-Control: no-store, no-cache, must-revalidate');
    $rawBody    = readJsonBody();
    $ordersList = (!empty($rawBody['orders']) && is_array($rawBody['orders']))
        ? $rawBody['orders']
        : [($rawBody['orderData'] ?? $rawBody)];

    $adminPayload = verifyAdminToken(getRequestAdminToken($rawBody));
    $sql = "INSERT INTO orders (
        id, customer_name, customer_phone, customer_email, division, district, upazila, address,
        items, addons, subtotal, addon_total, delivery_charge, promo_code, promo_discount,
        grand_total, advance_payable, payment_method, payment_status, payment_trx_id, payment_sender,
        status, order_type, brand_id, order_group_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    $savedIds = [];
    foreach ($ordersList as $ord) {
        if (!is_array($ord) || empty($ord['id'])) continue;
        $ordId     = trim((string)$ord['id']);
        $itemsStr  = is_string($ord['items'] ?? null) ? $ord['items'] : json_encode($ord['items'] ?? [], JSON_UNESCAPED_UNICODE);
        $addonsStr = is_string($ord['addons'] ?? null) ? $ord['addons'] : json_encode($ord['addons'] ?? [], JSON_UNESCAPED_UNICODE);
        $statusVal = $adminPayload ? ($ord['status'] ?? 'Pending') : 'Pending';
        $payStatus = $ord['payment_status'] ?? 'Unpaid';
        if (!$adminPayload && !in_array($payStatus, ['Unpaid', 'Paid', 'Advance Paid', 'Pending Verification'], true)) {
            $payStatus = 'Unpaid';
        }

        $params = [
            $ordId,
            mb_substr(trim((string)($ord['customer_name'] ?? '')), 0, 150),
            mb_substr(trim((string)($ord['customer_phone'] ?? '')), 0, 50),
            !empty($ord['customer_email']) ? mb_substr(trim((string)$ord['customer_email']), 0, 150) : null,
            $ord['division'] ?? null,
            $ord['district'] ?? '',
            $ord['upazila'] ?? '',
            $ord['address'] ?? '',
            $itemsStr,
            $addonsStr,
            (float)($ord['subtotal'] ?? 0),
            (float)($ord['addon_total'] ?? 0),
            (float)($ord['delivery_charge'] ?? 0),
            !empty($ord['promo_code']) ? (string)$ord['promo_code'] : null,
            (float)($ord['promo_discount'] ?? 0),
            (float)($ord['grand_total'] ?? 0),
            (float)($ord['advance_payable'] ?? 0),
            (string)($ord['payment_method'] ?? 'COD'),
            $payStatus,
            !empty($ord['payment_trx_id']) ? (string)$ord['payment_trx_id'] : null,
            !empty($ord['payment_sender']) ? (string)$ord['payment_sender'] : null,
            $statusVal,
            (string)($ord['order_type'] ?? 'delivery'),
            !empty($ord['brand_id']) ? (string)$ord['brand_id'] : null,
            !empty($ord['order_group_id']) ? (string)$ord['order_group_id'] : null
        ];
        $res = d1Exec($sql, $params);
        if (!$res['success']) {
            // Auto-add brand_id / order_group_id if missing and retry once
            d1Exec("ALTER TABLE orders ADD COLUMN brand_id TEXT DEFAULT NULL");
            d1Exec("ALTER TABLE orders ADD COLUMN order_group_id TEXT DEFAULT NULL");
            $res = d1Exec($sql, $params);
            if (!$res['success']) {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => $res['error'] ?? 'Order insert failed']);
                exit;
            }
        }
        $savedIds[] = $ordId;
    }

    echo json_encode([
        'success'   => true,
        'order_ids' => $savedIds,
        'result'    => [['results' => $savedIds]]
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ----------------------------------------------------------------------------
// USER WRITE ROUTE 3: POST /api/update-payment-status (Gateway/Payment Update)
// ----------------------------------------------------------------------------
if (strpos($endpoint, 'update-payment-status') !== false && $method === 'POST') {
    header('Cache-Control: no-store, no-cache, must-revalidate');
    $body   = readJsonBody();
    $upData = (isset($body['upData']) && is_array($body['upData'])) ? $body['upData'] : $body;
    $id     = trim((string)($body['id'] ?? ''));
    if ($id === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Order ID required']);
        exit;
    }
    $payStatus = (string)($upData['payment_status'] ?? 'Paid');
    $payTrx    = (string)($upData['payment_trx_id'] ?? '');
    $status    = (string)($upData['status'] ?? 'Confirmed');
    if (!in_array($status, ['Pending', 'Confirmed'], true)) {
        $status = 'Confirmed';
    }
    $res = d1Exec(
        "UPDATE orders SET payment_status = ?, payment_trx_id = ?, status = ? WHERE id = ?",
        [$payStatus, $payTrx, $status, $id]
    );
    echo json_encode(['success' => $res['success'], 'result' => [['results' => $res['results']]], 'error' => $res['error'] ?? null]);
    exit;
}

// ----------------------------------------------------------------------------
// READ-ONLY SELECT ROUTE: POST /api/d1-query (Strictly SELECT Only!)
// ----------------------------------------------------------------------------
if (strpos($endpoint, 'd1-query') !== false && $method === 'POST') {
    header('Cache-Control: no-store, no-cache, must-revalidate');
    $body         = readJsonBody();
    $adminPayload = verifyAdminToken(getRequestAdminToken($body));

    $validateSelect = function($sqlStr) use ($adminPayload) {
        $trim = ltrim((string)$sqlStr);
        if (stripos($trim, 'SELECT') !== 0) return 'Only SELECT queries are allowed on this endpoint.';
        if (strpos($trim, ';') !== false && substr(rtrim($trim), -1) !== ';') return 'Stacked queries are not allowed.';
        if ((!$adminPayload || ($adminPayload['role'] ?? '') === 'staff') && preg_match('/\b(admins|devtools)\b/i', $trim)) {
            return 'Unauthorized table access.';
        }
        if ($adminPayload && ($adminPayload['role'] ?? '') === 'staff') {
            if (preg_match('/\b(FROM|JOIN)\s+orders\b/i', $trim) && !hasStaffPermission($adminPayload, 'orders', 'view')) {
                return 'Forbidden: Missing permission (orders.view).';
            }
        }
        return null;
    };

    if (!empty($body['queries']) && is_array($body['queries'])) {
        $batchOut = [];
        foreach ($body['queries'] as $q) {
            $qSql    = $q['sql'] ?? '';
            $qParams = is_array($q['params'] ?? null) ? $q['params'] : [];
            $errMsg  = $validateSelect($qSql);
            if ($errMsg) {
                http_response_code(403);
                echo json_encode(['success' => false, 'error' => $errMsg]);
                exit;
            }
            $r = d1Exec($qSql, $qParams);
            if (!$r['success']) {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => $r['error'] ?? 'Query failed']);
                exit;
            }
            $batchOut[] = ['results' => $r['results'], 'success' => true];
        }
        echo json_encode(['success' => true, 'result' => $batchOut], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $sql    = $body['sql'] ?? '';
    $params = is_array($body['params'] ?? null) ? $body['params'] : [];
    $errMsg = $validateSelect($sql);
    if ($errMsg) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => $errMsg]);
        exit;
    }
    $r = d1Exec($sql, $params);
    if (!$r['success']) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $r['error'] ?? 'Query failed']);
        exit;
    }
    echo json_encode(['success' => true, 'result' => [['results' => $r['results']]]], JSON_UNESCAPED_UNICODE);
    exit;
}

// ----------------------------------------------------------------------------
// ADMIN PROTECTED ROUTE 1: POST /admin-query (Protected + Audited)
// ----------------------------------------------------------------------------
if ((strpos($endpoint, 'admin-query') !== false || strpos($endpoint, 'dev-query') !== false) && $method === 'POST') {
    header('Cache-Control: no-store, no-cache, must-revalidate');
    $body      = readJsonBody();
    $adminUser = requireAdminAuth($body);
    $role      = $adminUser['role'] ?? 'master_admin';

    $checkQueryPerm = function($sqlStr) use ($adminUser, $role) {
        if ($role !== 'staff') return;
        $su = strtoupper(ltrim((string)$sqlStr));
        $tableMap = [
            'PRODUCTS' => 'products', 'PRODUCT_CATEGORIES' => 'products',
            'CATEGORIES' => 'categories', 'BANNERS' => 'banners',
            'HOME_SECTIONS' => 'sections', 'DELIVERY_ZONES' => 'delivery',
            'PROMOS' => 'promos', 'ADDONS' => 'addons', 'REVIEWS' => 'reviews',
            'ORDERS' => 'orders', 'SETTINGS' => 'settings', 'BRANDS' => 'brands'
        ];
        if (preg_match('/\b(ADMINS|DEVTOOLS)\b/i', $su) || preg_match('/^\s*(DROP|ALTER|TRUNCATE|PRAGMA|CREATE)\b/i', $su)) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Forbidden: Master Admin access required.']);
            exit;
        }
        $sqlAct = 'view';
        if (preg_match('/^\s*(INSERT|REPLACE)\b/i', $su)) $sqlAct = 'create';
        elseif (preg_match('/^\s*UPDATE\b/i', $su)) $sqlAct = 'edit';
        elseif (preg_match('/^\s*DELETE\b/i', $su)) $sqlAct = 'delete';

        $matchedAny = false;
        foreach ($tableMap as $tbl => $permKey) {
            if (preg_match('/\b' . $tbl . '\b/i', $su)) {
                $matchedAny = true;
                if (!hasStaffPermission($adminUser, $permKey, $sqlAct)) {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'error' => 'Forbidden: Missing permission (' . $permKey . '.' . $sqlAct . ').']);
                    exit;
                }
            }
        }
        if (!$matchedAny) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Forbidden: Unrecognized table in Staff query.']);
            exit;
        }
    };

    if (!empty($body['queries']) && is_array($body['queries'])) {
        $batchOut = [];
        foreach ($body['queries'] as $q) {
            $qSql = (string)($q['sql'] ?? '');
            $checkQueryPerm($qSql);
            $r = d1Exec($qSql, is_array($q['params'] ?? null) ? $q['params'] : []);
            if (!$r['success']) {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => $r['error'] ?? 'Admin batch query failed']);
                exit;
            }
            if (preg_match('/^\s*(INSERT|UPDATE|DELETE|ALTER|DROP)/i', $qSql)) {
                appendAuditLog($adminUser['sub'] ?? 'admin', $role, 'ADMIN_QUERY_BATCH', substr(trim($qSql), 0, 80), '');
            }
            $batchOut[] = ['results' => $r['results'], 'success' => true];
        }
        echo json_encode(['success' => true, 'result' => $batchOut], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $sql    = (string)($body['sql'] ?? '');
    $params = is_array($body['params'] ?? null) ? $body['params'] : [];
    $checkQueryPerm($sql);
    $r      = d1Exec($sql, $params);
    if (!$r['success']) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $r['error'] ?? 'Admin query failed']);
        exit;
    }
    if (preg_match('/^\s*(INSERT|UPDATE|DELETE|ALTER|DROP)/i', $sql)) {
        appendAuditLog($adminUser['sub'] ?? 'admin', $role, 'ADMIN_QUERY', substr(trim($sql), 0, 80), json_encode($params, JSON_UNESCAPED_UNICODE));
    }
    echo json_encode(['success' => true, 'result' => [['results' => $r['results']]]], JSON_UNESCAPED_UNICODE);
    exit;
}

// ----------------------------------------------------------------------------
// ADMIN PROTECTED ROUTE 2: POST /add-product & /update-product
// ----------------------------------------------------------------------------
if ((strpos($endpoint, 'add-product') !== false || strpos($endpoint, 'update-product') !== false) && $method === 'POST') {
    header('Cache-Control: no-store, no-cache, must-revalidate');
    $p = readJsonBody();
    $isUpdate = (strpos($endpoint, 'update-product') !== false);
    $adminUser = requireAdminAuth($p, 'products', $isUpdate ? 'edit' : 'create');

    $productId = trim((string)($p['id'] ?? ''));
    if ($isUpdate && $productId === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Product ID is required for update.']);
        exit;
    }
    if (!$isUpdate && $productId === '') {
        $skuRaw = trim((string)($p['sku'] ?? ''));
        if ($skuRaw !== '') {
            $productId = strtolower(trim(preg_replace('/-+/', '-', preg_replace('/[^a-zA-Z0-9_-]/', '-', $skuRaw)), '-'));
            $ex = d1Query("SELECT id FROM products WHERE id = ? LIMIT 1", [$productId]);
            if (!empty($ex)) $productId .= '-' . rand(100, 999);
        } else {
            $maxRows = d1Query("SELECT id FROM products WHERE id LIKE 'prod_%'");
            $maxNum  = 0;
            foreach ($maxRows as $r) {
                $n = (int)str_replace('prod_', '', (string)($r['id'] ?? ''));
                if ($n > $maxNum) $maxNum = $n;
            }
            $productId = 'prod_' . ($maxNum + 1);
        }
    }

    $brandId    = (!empty($p['brand_id']) && trim((string)$p['brand_id']) !== '') ? trim((string)$p['brand_id']) : null;
    $showOnMain = ($brandId && !empty($p['show_on_main'])) ? 1 : 0;
    $galleryStr = is_string($p['gallery_images'] ?? null) ? $p['gallery_images'] : json_encode($p['gallery_images'] ?? [], JSON_UNESCAPED_UNICODE);
    $variantStr = is_string($p['variants'] ?? null) ? $p['variants'] : json_encode($p['variants'] ?? [], JSON_UNESCAPED_UNICODE);

    if ($isUpdate) {
        $sql = "UPDATE products SET
            name=?, description=?, base_price=?, flash_sale_price=?, flash_sale_end=?,
            gallery_images=?, video_url=?, video_type=?, sku=?, variants=?,
            is_active=?, is_featured=?, is_add_once=?,
            tags=?, seo_keywords=?, seo_title=?, seo_description=?, slug=?,
            brand_id=?, show_on_main=?
            WHERE id=?";
        $params = [
            $p['name'] ?? '',
            $p['description'] ?? '',
            (float)($p['base_price'] ?? 0),
            (float)($p['flash_sale_price'] ?? 0),
            !empty($p['flash_sale_end']) ? $p['flash_sale_end'] : null,
            $galleryStr,
            $p['video_url'] ?? '',
            $p['video_type'] ?? 'auto',
            !empty($p['sku']) ? $p['sku'] : null,
            $variantStr,
            !empty($p['is_active']) ? 1 : 0,
            !empty($p['is_featured']) ? 1 : 0,
            !empty($p['is_add_once']) ? 1 : 0,
            $p['tags'] ?? '',
            $p['seo_keywords'] ?? ($p['tags'] ?? ''),
            !empty($p['seo_title']) ? $p['seo_title'] : null,
            !empty($p['seo_description']) ? $p['seo_description'] : null,
            !empty($p['slug']) ? $p['slug'] : null,
            $brandId,
            $showOnMain,
            $productId
        ];
    } else {
        $sql = "INSERT INTO products (
            id, name, description, base_price, flash_sale_price, flash_sale_end,
            gallery_images, video_url, video_type, sku, variants,
            is_active, is_featured, is_add_once,
            tags, seo_keywords, seo_title, seo_description, slug,
            brand_id, show_on_main, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)";
        $params = [
            $productId,
            $p['name'] ?? '',
            $p['description'] ?? '',
            (float)($p['base_price'] ?? 0),
            (float)($p['flash_sale_price'] ?? 0),
            !empty($p['flash_sale_end']) ? $p['flash_sale_end'] : null,
            $galleryStr,
            $p['video_url'] ?? '',
            $p['video_type'] ?? 'auto',
            !empty($p['sku']) ? $p['sku'] : null,
            $variantStr,
            !empty($p['is_active']) ? 1 : 0,
            !empty($p['is_featured']) ? 1 : 0,
            !empty($p['is_add_once']) ? 1 : 0,
            $p['tags'] ?? '',
            $p['seo_keywords'] ?? ($p['tags'] ?? ''),
            !empty($p['seo_title']) ? $p['seo_title'] : null,
            !empty($p['seo_description']) ? $p['seo_description'] : null,
            !empty($p['slug']) ? $p['slug'] : null,
            $brandId,
            $showOnMain
        ];
    }

    $res = d1Exec($sql, $params);
    if (!$res['success']) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $res['error'] ?? 'Product save failed']);
        exit;
    }

    if ($isUpdate) {
        d1Exec("DELETE FROM product_categories WHERE product_id = ?", [$productId]);
    }
    if (!empty($p['category_ids']) && is_array($p['category_ids'])) {
        foreach ($p['category_ids'] as $cid) {
            d1Exec("INSERT INTO product_categories (product_id, category_id) VALUES (?, ?)", [$productId, $cid]);
        }
    }

    appendAuditLog($adminUser['sub'] ?? 'admin', $adminUser['role'] ?? 'master_admin', $isUpdate ? 'UPDATE_PRODUCT' : 'ADD_PRODUCT', $productId, (string)($p['name'] ?? ''));
    echo json_encode(['success' => true, 'id' => $productId, 'result' => [['results' => $res['results']]]], JSON_UNESCAPED_UNICODE);
    exit;
}

// ----------------------------------------------------------------------------
// ADMIN PROTECTED ROUTE 3: POST /delete-product
// ----------------------------------------------------------------------------
if (strpos($endpoint, 'delete-product') !== false && $method === 'POST') {
    header('Cache-Control: no-store, no-cache, must-revalidate');
    $body = readJsonBody();
    $adminUser = requireAdminAuth($body, 'products', 'delete');
    $id = trim((string)($body['id'] ?? ''));
    if ($id === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Product ID required']);
        exit;
    }
    $res = d1Exec("DELETE FROM products WHERE id = ?", [$id]);
    d1Exec("DELETE FROM product_categories WHERE product_id = ?", [$id]);
    appendAuditLog($adminUser['sub'] ?? 'admin', $adminUser['role'] ?? 'master_admin', 'DELETE_PRODUCT', $id, '');
    echo json_encode(['success' => $res['success'], 'result' => [['results' => $res['results']]]], JSON_UNESCAPED_UNICODE);
    exit;
}

// ----------------------------------------------------------------------------
// ADMIN PROTECTED ROUTE 4: POST /update-order & /delete-order
// ----------------------------------------------------------------------------
if (strpos($endpoint, 'update-order') !== false && $method === 'POST') {
    header('Cache-Control: no-store, no-cache, must-revalidate');
    $body = readJsonBody();
    $adminUser = requireAdminAuth($body, 'orders', 'edit');
    $upData = (isset($body['upData']) && is_array($body['upData'])) ? $body['upData'] : $body;
    $id     = trim((string)($body['id'] ?? ''));
    if ($id === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'order id দিন']);
        exit;
    }
    $updates = [];
    $params  = [];
    if (array_key_exists('status', $upData))         { $updates[] = 'status=?';         $params[] = $upData['status']; }
    if (array_key_exists('payment_status', $upData)) { $updates[] = 'payment_status=?'; $params[] = $upData['payment_status']; }
    if (array_key_exists('payment_trx_id', $upData)) { $updates[] = 'payment_trx_id=?'; $params[] = $upData['payment_trx_id']; }

    if (!empty($updates)) {
        $targetIds = (!empty($body['ids']) && is_array($body['ids'])) ? $body['ids'] : [$id];
        foreach ($targetIds as $tid) {
            d1Exec("UPDATE orders SET " . implode(', ', $updates) . " WHERE id = ?", array_merge($params, [$tid]));
        }
        if (!empty($body['order_group_id'])) {
            d1Exec("UPDATE orders SET " . implode(', ', $updates) . " WHERE order_group_id = ?", array_merge($params, [$body['order_group_id']]));
        }
        appendAuditLog($adminUser['sub'] ?? 'admin', $adminUser['role'] ?? 'master_admin', 'UPDATE_ORDER', $id, json_encode($upData, JSON_UNESCAPED_UNICODE));
    }
    echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
    exit;
}

if (strpos($endpoint, 'delete-order') !== false && $method === 'POST') {
    header('Cache-Control: no-store, no-cache, must-revalidate');
    $body = readJsonBody();
    $adminUser = requireAdminAuth($body, 'orders', 'delete');
    $id  = trim((string)($body['id'] ?? ''));
    $res = d1Exec("DELETE FROM orders WHERE id = ?", [$id]);
    if (!empty($body['ids']) && is_array($body['ids'])) {
        foreach ($body['ids'] as $subId) {
            if ($subId && $subId !== $id) d1Exec("DELETE FROM orders WHERE id = ?", [$subId]);
        }
    }
    if (!empty($body['order_group_id'])) {
        d1Exec("DELETE FROM orders WHERE order_group_id = ?", [$body['order_group_id']]);
    }
    appendAuditLog($adminUser['sub'] ?? 'admin', $adminUser['role'] ?? 'master_admin', 'DELETE_ORDER', $id, '');
    echo json_encode(['success' => true, 'result' => [['results' => $res['results']]]], JSON_UNESCAPED_UNICODE);
    exit;
}

// ----------------------------------------------------------------------------
// ADMIN PROTECTED ROUTE 5: POST /update-settings
// ----------------------------------------------------------------------------
if (strpos($endpoint, 'update-settings') !== false && $method === 'POST') {
    header('Cache-Control: no-store, no-cache, must-revalidate');
    $p = readJsonBody();
    $adminUser = requireAdminAuth($p, 'settings', 'edit');

    $sql = "UPDATE settings SET
        store_name=?, logo_url=?, favicon_url=?, footer_text=?, whatsapp_number=?, facebook_url=?, instagram_url=?, youtube_url=?,
        bkash_number=?, nagad_number=?, binance_manual_uid=?, gateway_api_key=?, gateway_api_key_v2=?, gateway_version=?,
        allow_cod=?, enable_fun_checkbox=?, allow_whatsapp_order=?, allow_msg_order=?, advance_amount=?, advance_method=?,
        telegram_main_bot=?, telegram_main_chats=?, telegram_draft_bot=?, telegram_draft_chat=?, messaging_apps=?,
        allow_pickup=?, store_address=?, store_map_link=?, pickup_bot_token=?, pickup_chat_id=?, binance_pay_uid=?,
        binance_proxy_url=?, binance_api_key=?, binance_api_secret=?, usd_to_bdt_rate=?, verify_mode=?, supabase_edge_url=?,
        hf_api_url=?, crypto_coins=?, review_imgbb_key=?,
        seo_title=?, seo_description=?, seo_keywords=?, seo_og_image=?, google_site_verification=?, site_url=?, ai_config=?
        WHERE id=1";

    $siteUrlRaw = trim((string)($p['site_url'] ?? ''));
    if ($siteUrlRaw !== '' && strpos($siteUrlRaw, 'http') !== 0) $siteUrlRaw = 'https://' . $siteUrlRaw;
    $siteUrlRaw = rtrim($siteUrlRaw, '/');

    $params = [
        $p['store_name'] ?? '', $p['logo_url'] ?? '', $p['favicon_url'] ?? '', $p['footer_text'] ?? '',
        $p['whatsapp_number'] ?? '', $p['facebook_url'] ?? '', $p['instagram_url'] ?? '', $p['youtube_url'] ?? '',
        $p['bkash_number'] ?? '', $p['nagad_number'] ?? '', $p['binance_manual_uid'] ?? '', $p['gateway_api_key'] ?? '',
        $p['gateway_api_key_v2'] ?? '', $p['gateway_version'] ?? '',
        !empty($p['allow_cod']) ? 1 : 0, !empty($p['enable_fun_checkbox']) ? 1 : 0,
        !empty($p['allow_whatsapp_order']) ? 1 : 0, !empty($p['allow_msg_order']) ? 1 : 0,
        $p['advance_amount'] ?? 0, $p['advance_method'] ?? '',
        $p['telegram_main_bot'] ?? '',
        is_string($p['telegram_main_chats'] ?? null) ? $p['telegram_main_chats'] : json_encode($p['telegram_main_chats'] ?? []),
        $p['telegram_draft_bot'] ?? '', $p['telegram_draft_chat'] ?? '',
        is_string($p['messaging_apps'] ?? null) ? $p['messaging_apps'] : json_encode($p['messaging_apps'] ?? []),
        !empty($p['allow_pickup']) ? 1 : 0, $p['store_address'] ?? '', $p['store_map_link'] ?? '',
        $p['pickup_bot_token'] ?? '', $p['pickup_chat_id'] ?? '', $p['binance_pay_uid'] ?? '',
        $p['binance_proxy_url'] ?? '', $p['binance_api_key'] ?? '', $p['binance_api_secret'] ?? '',
        $p['usd_to_bdt_rate'] ?? 120, $p['verify_mode'] ?? '', $p['supabase_edge_url'] ?? '',
        $p['hf_api_url'] ?? '',
        is_string($p['crypto_coins'] ?? null) ? $p['crypto_coins'] : json_encode($p['crypto_coins'] ?? []),
        $p['review_imgbb_key'] ?? '',
        $p['seo_title'] ?? '', $p['seo_description'] ?? '', $p['seo_keywords'] ?? '',
        $p['seo_og_image'] ?? '', $p['google_site_verification'] ?? '', $siteUrlRaw,
        is_string($p['ai_config'] ?? null) ? $p['ai_config'] : json_encode($p['ai_config'] ?? new stdClass())
    ];

    $res = d1Exec($sql, $params);
    if (!$res['success']) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $res['error'] ?? 'Settings update failed']);
        exit;
    }
    appendAuditLog($adminUser['sub'] ?? 'admin', $adminUser['role'] ?? 'master_admin', 'UPDATE_SETTINGS', 'settings:1', (string)($p['store_name'] ?? ''));
    echo json_encode(['success' => true, 'result' => [['results' => $res['results']]]], JSON_UNESCAPED_UNICODE);
    exit;
}

// ----------------------------------------------------------------------------
// ADMIN PROTECTED ROUTE 6: GET & POST /brands
// ----------------------------------------------------------------------------
if (strpos($endpoint, 'brands') !== false) {
    header('Cache-Control: no-store, no-cache, must-revalidate');
    if ($method === 'GET') {
        $brandsRows = d1Query("SELECT * FROM brands ORDER BY sort_order ASC, created_at ASC");
        $countRows  = d1Query("SELECT brand_id, COUNT(*) as cnt FROM products WHERE brand_id IS NOT NULL AND brand_id != '' GROUP BY brand_id");
        $countMap   = [];
        foreach ($countRows as $cr) {
            $countMap[$cr['brand_id']] = (int)($cr['cnt'] ?? 0);
        }
        foreach ($brandsRows as &$br) {
            $br['is_active']     = !empty($br['is_active']);
            $br['product_count'] = $countMap[$br['id']] ?? 0;
        }
        echo json_encode(['success' => true, 'brands' => $brandsRows], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ($method === 'POST') {
        $body = readJsonBody();
        $adminUser = requireAdminAuth($body, 'brands', 'view');
        $action = strtolower(trim((string)($body['action'] ?? 'save')));
        if ($action === 'delete') {
            assertAdminPermission($adminUser, 'brands', 'delete');
        } elseif ($action !== 'check_slug') {
            $tmpBrandId = trim((string)($body['id'] ?? ''));
            $isBrandEdit = false;
            if ($tmpBrandId !== '') {
                $chkB = d1Query("SELECT id FROM brands WHERE id = ? LIMIT 1", [$tmpBrandId]);
                $isBrandEdit = !empty($chkB);
            }
            assertAdminPermission($adminUser, 'brands', $isBrandEdit ? 'edit' : 'create');
        }
        $cleanSlugFn = function($str) {
            $s = strtolower(trim((string)$str));
            $s = preg_replace('/^\/+|\/+$/', '', $s);
            $s = preg_replace('/[^a-z0-9-]+/', '-', $s);
            return trim(preg_replace('/-+/', '-', $s), '-');
        };
        $reservedSlugs = ['admin','api','assets','cart','checkout','invoice','login','register','forgot-password','profile','product','shop','success','track','policies','team','worker','stup-site','public-data','checkout-data','public-reviews'];

        if ($action === 'check_slug') {
            $slug      = $cleanSlugFn($body['slug'] ?? '');
            $excludeId = trim((string)($body['exclude_id'] ?? ''));
            if ($slug === '' || strlen($slug) < 2 || strlen($slug) > 40) {
                echo json_encode(['success' => true, 'valid' => false, 'available' => false, 'reason' => 'Slug ২-৪০ অক্ষরের হতে হবে।'], JSON_UNESCAPED_UNICODE);
                exit;
            }
            if (in_array($slug, $reservedSlugs, true)) {
                echo json_encode(['success' => true, 'valid' => false, 'available' => false, 'reason' => 'এটি একটি সংরক্ষিত (reserved) পাথ।'], JSON_UNESCAPED_UNICODE);
                exit;
            }
            $ex = d1Query("SELECT id FROM brands WHERE lower(slug) = ? LIMIT 1", [$slug]);
            if (!empty($ex) && ($ex[0]['id'] ?? '') !== $excludeId) {
                echo json_encode(['success' => true, 'valid' => false, 'available' => false, 'reason' => 'এই পাথটি ইতিমধ্যে অন্য ব্র্যান্ডে ব্যবহৃত হচ্ছে।'], JSON_UNESCAPED_UNICODE);
                exit;
            }
            echo json_encode(['success' => true, 'valid' => true, 'available' => true, 'slug' => $slug], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($action === 'delete') {
            $brandId = trim((string)($body['id'] ?? ''));
            $delProds = (!empty($body['delete_products']) || ($body['product_mode'] ?? '') === 'delete_products');
            if ($brandId === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Brand ID required']);
                exit;
            }
            if ($delProds) {
                d1Exec("DELETE FROM products WHERE brand_id = ?", [$brandId]);
            } else {
                d1Exec("UPDATE products SET brand_id = NULL, show_on_main = 0 WHERE brand_id = ?", [$brandId]);
            }
            d1Exec("UPDATE categories SET brand_id = NULL WHERE brand_id = ?", [$brandId]);
            d1Exec("DELETE FROM banners WHERE brand_id = ?", [$brandId]);
            d1Exec("DELETE FROM home_sections WHERE brand_id = ?", [$brandId]);
            d1Exec("UPDATE promos SET brand_id = NULL WHERE brand_id = ?", [$brandId]);
            d1Exec("DELETE FROM brand_slug_history WHERE brand_id = ?", [$brandId]);
            d1Exec("DELETE FROM brands WHERE id = ?", [$brandId]);
            appendAuditLog($adminUser['sub'] ?? 'admin', $adminUser['role'] ?? 'master_admin', 'DELETE_BRAND', $brandId, '');
            echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
            exit;
        }

        // Save (Insert or Update) Brand
        $name = trim((string)($body['name'] ?? ''));
        $slug = $cleanSlugFn($body['slug'] ?? $name);
        if ($name === '' || $slug === '' || in_array($slug, $reservedSlugs, true)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'বৈধ ব্র্যান্ডের নাম ও Slug দিন।'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $brandId = trim((string)($body['id'] ?? ''));
        $dup = d1Query("SELECT id FROM brands WHERE lower(slug) = ? LIMIT 1", [$slug]);
        if (!empty($dup) && ($dup[0]['id'] ?? '') !== $brandId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'এই Slug অন্য ব্র্যান্ডে ব্যবহৃত হচ্ছে।'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $themeStr = is_string($body['theme_colors'] ?? null) ? $body['theme_colors'] : json_encode($body['theme_colors'] ?? new stdClass(), JSON_UNESCAPED_UNICODE);
        if ($brandId !== '') {
            $oldRows = d1Query("SELECT * FROM brands WHERE id = ? LIMIT 1", [$brandId]);
            if (!empty($oldRows)) {
                $oldSlug = strtolower($oldRows[0]['slug'] ?? '');
                if ($oldSlug && $oldSlug !== $slug) {
                    d1Exec("INSERT OR REPLACE INTO brand_slug_history (old_slug, brand_id) VALUES (?, ?)", [$oldSlug, $brandId]);
                }
                d1Exec(
                    "UPDATE brands SET slug=?, name=?, tagline=?, logo_url=?, favicon_url=?, theme_colors=?, footer_text=?, support_phone=?, whatsapp_number=?, facebook_url=?, instagram_url=?, youtube_url=?, seo_title=?, seo_description=?, seo_keywords=?, seo_og_image=?, is_active=?, sort_order=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                    [
                        $slug, $name, $body['tagline'] ?? '', $body['logo_url'] ?? '', $body['favicon_url'] ?? '',
                        $themeStr, $body['footer_text'] ?? '', $body['support_phone'] ?? '', $body['whatsapp_number'] ?? '',
                        $body['facebook_url'] ?? '', $body['instagram_url'] ?? '', $body['youtube_url'] ?? '',
                        $body['seo_title'] ?? '', $body['seo_description'] ?? '', $body['seo_keywords'] ?? '', $body['seo_og_image'] ?? '',
                        (!isset($body['is_active']) || $body['is_active']) ? 1 : 0, (int)($body['sort_order'] ?? 0),
                        $brandId
                    ]
                );
                appendAuditLog($adminUser['sub'] ?? 'admin', $adminUser['role'] ?? 'master_admin', 'UPDATE_BRAND', $brandId, $name . ' (/' . $slug . ')');
                $savedRow = d1Query("SELECT * FROM brands WHERE id = ? LIMIT 1", [$brandId]);
                echo json_encode(['success' => true, 'brand' => $savedRow[0] ?? null], JSON_UNESCAPED_UNICODE);
                exit;
            }
        }
        $newId = $brandId ?: ('brand_' . time() . '_' . rand(100, 999));
        d1Exec(
            "INSERT INTO brands (id, slug, name, tagline, logo_url, favicon_url, theme_colors, footer_text, support_phone, whatsapp_number, facebook_url, instagram_url, youtube_url, seo_title, seo_description, seo_keywords, seo_og_image, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                $newId, $slug, $name, $body['tagline'] ?? '', $body['logo_url'] ?? '', $body['favicon_url'] ?? '',
                $themeStr, $body['footer_text'] ?? '', $body['support_phone'] ?? '', $body['whatsapp_number'] ?? '',
                $body['facebook_url'] ?? '', $body['instagram_url'] ?? '', $body['youtube_url'] ?? '',
                $body['seo_title'] ?? '', $body['seo_description'] ?? '', $body['seo_keywords'] ?? '', $body['seo_og_image'] ?? '',
                (!isset($body['is_active']) || $body['is_active']) ? 1 : 0, (int)($body['sort_order'] ?? 0)
            ]
        );
        appendAuditLog($adminUser['sub'] ?? 'admin', $adminUser['role'] ?? 'master_admin', 'CREATE_BRAND', $newId, $name . ' (/' . $slug . ')');
        $savedRow = d1Query("SELECT * FROM brands WHERE id = ? LIMIT 1", [$newId]);
        echo json_encode(['success' => true, 'brand' => $savedRow[0] ?? null], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// ----------------------------------------------------------------------------
// ADMIN PROTECTED ROUTE 7: POST /api/clear-cache & /api/clean-nulls
// ----------------------------------------------------------------------------
if ((strpos($endpoint, 'clear-cache') !== false || strpos($endpoint, 'clean-nulls') !== false) && $method === 'POST') {
    header('Cache-Control: no-store, no-cache, must-revalidate');
    $body = readJsonBody();
    requireAdminAuth($body);
    echo json_encode(['success' => true, 'message' => 'Cache operation acknowledged.']);
    exit;
}

// Cloudflare Edge & Browser caches public GET responses for 5 minutes (300 seconds)
header('Cache-Control: public, max-age=' . CACHE_TTL_SECONDS . ', s-maxage=' . CACHE_TTL_SECONDS . ', stale-while-revalidate=600');

// ----------------------------------------------------------------------------
// ROUTE A: /api/public-reviews?product_id=<id> (Targeted Product Reviews Only)
// ----------------------------------------------------------------------------
if (strpos($endpoint, 'public-reviews') !== false) {
    if (!$productId) {
        echo json_encode(['success' => true, 'data' => []]);
        exit;
    }
    $rows = d1Query(
        "SELECT * FROM reviews WHERE product_id = ? AND is_approved = 1 ORDER BY created_at DESC LIMIT 50",
        [$productId]
    );
    echo json_encode(['success' => true, 'data' => $rows], JSON_UNESCAPED_UNICODE);
    exit;
}

// ----------------------------------------------------------------------------
// ROUTE B: /api/checkout-data (Targeted Checkout Data Only — NO Full Product DB!)
// ----------------------------------------------------------------------------
if (strpos($endpoint, 'checkout-data') !== false) {
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

    echo json_encode([
        'success'      => true,
        'source'       => 'alwaysdata_proxy',
        'proxy_engine' => 'AlwaysData PHP Engine',
        'data'         => [
            'settings' => mergeBrandSettings($rawSettings, $activeBrand),
            'brand'    => $activeBrand,
            'brands'   => $allBrands,
            'zones'    => $zones,
            'addons'   => $addons,
            'promos'   => $promos,
            'add_once' => $addOnce
        ]
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ----------------------------------------------------------------------------
// ROUTE C: /api/public-data?product_id=<id> (Cache Miss on Product Page -> Single Product Only!)
// ----------------------------------------------------------------------------
if ($productId !== '') {
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

    echo json_encode([
        'success'            => true,
        'source'             => 'alwaysdata_proxy',
        'proxy_engine'       => 'AlwaysData PHP Engine',
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
    exit;
}

// ----------------------------------------------------------------------------
// ROUTE D: /api/public-data (Master JSON with 100-Product Chunks)
// ----------------------------------------------------------------------------
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

$settingsRows  = d1Query("SELECT * FROM settings WHERE id = 1");
$rawSettings   = $settingsRows[0] ?? [];
$mainStoreName = $rawSettings['store_name'] ?? 'Ranonex';
$categories    = d1Query("SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order");
$products      = d1Query("SELECT * FROM products WHERE is_active = 1 ORDER BY is_featured DESC, created_at DESC");
$prodCats      = d1Query("SELECT * FROM product_categories");

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

// ============================================================================
// 5. PROGRESSIVE 20-INITIAL + 50-CHUNK ENGINE
// ============================================================================
// A. Subsequent 50-Product Chunk Request (?chunk=1, ?chunk=2, etc.)
if ($chunkNum > 0) {
    $offset = INITIAL_PRODUCT_COUNT + ($chunkNum - 1) * CHUNK_SIZE;
    $slice  = ($offset < count($filteredProducts)) ? array_slice($filteredProducts, $offset, CHUNK_SIZE) : [];
    $hasMore = ($offset + CHUNK_SIZE) < count($filteredProducts);

    echo json_encode([
        'success'        => true,
        'source'         => 'alwaysdata_proxy',
        'proxy_engine'   => 'AlwaysData PHP Engine',
        'chunk'          => $chunkNum,
        'count'          => count($slice),
        'total_products' => count($filteredProducts),
        'has_more'       => $hasMore,
        'next_chunk'     => $hasMore ? ($chunkNum + 1) : null,
        'products'       => $slice
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// B. Initial Public Data Request (/public-data) -> First 20 products ONLY for instant 1st impression!
$loadAll        = (isset($_GET['all']) && $_GET['all'] == '1');
$initialSlice   = $loadAll ? $filteredProducts : array_slice($filteredProducts, 0, INITIAL_PRODUCT_COUNT);
$remainingCount = max(0, count($filteredProducts) - count($initialSlice));
$hasMore        = !$loadAll && ($remainingCount > 0);
$totalChunks    = (int)ceil($remainingCount / CHUNK_SIZE);
$nextChunk      = $hasMore ? 1 : null;

echo json_encode([
    'success'      => true,
    'source'       => 'alwaysdata_proxy',
    'proxy_engine' => 'AlwaysData PHP Engine',
    'data'         => [
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
        'products'           => $initialSlice,
        'initial_count'      => count($initialSlice),
        'chunk_size'         => CHUNK_SIZE,
        'total_products'     => count($filteredProducts),
        'has_more'           => $hasMore,
        'next_chunk'         => $nextChunk,
        'total_chunks'       => $totalChunks,
        'home_sections'      => $sections,
        'product_categories' => $prodCats
    ]
], JSON_UNESCAPED_UNICODE);
