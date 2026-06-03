<?php
// ============================================================
// binance_proxy.php — Binance API Proxy (Server-Side Only)
// Deploy this to: mypay.freelancingbyrifat.top/binance_proxy.php
// ⚠️ NEVER expose API_KEY or API_SECRET in frontend code
//
// ── STANDALONE MODE ──────────────────────────────────────────
// This file runs 100% independently — NO Supabase dependency.
// It only calls Binance REST API directly using HMAC-SHA256.
// Double-spend protection is handled separately in Supabase
// verified_payments table (checkout.html → Supabase insert).
// ── BACKUP MODE ──────────────────────────────────────────────
// If cPanel is unavailable, checkout falls back automatically:
// skip Binance API → Supabase-only TxID lock → Manual Review.
// ============================================================

// ── CONFIGURATION ────────────────────────────────────────────
// Binance এ login করো → API Management → Create API
// "Enable Reading" permission দিলেই হবে — withdrawal permission দেবে না
define('BINANCE_API_KEY',    'YOUR_BINANCE_API_KEY_HERE');
define('BINANCE_API_SECRET', 'YOUR_BINANCE_API_SECRET_HERE');

// Allowed origins (তোমার site এর domain)
define('ALLOWED_ORIGIN', 'https://freelancingbyrifat.github.io');

// Binance API Base URL
define('BINANCE_BASE', 'https://api.binance.com');

// ── CORS Headers ──────────────────────────────────────────────
header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit();
}

// ── Parse Request ─────────────────────────────────────────────
$body   = json_decode(file_get_contents('php://input'), true);
$action = isset($body['action']) ? $body['action'] : '';

if (!$action) {
    echo json_encode(['success' => false, 'error' => 'No action specified']);
    exit();
}

// ── HMAC-SHA256 Signed Request Helper ────────────────────────
function binanceRequest($endpoint, $params = []) {
    $params['timestamp'] = round(microtime(true) * 1000);
    $params['recvWindow'] = 10000;
    $queryString = http_build_query($params);
    $signature   = hash_hmac('sha256', $queryString, BINANCE_API_SECRET);
    $queryString .= '&signature=' . $signature;

    $url = BINANCE_BASE . $endpoint . '?' . $queryString;

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['X-MBX-APIKEY: ' . BINANCE_API_KEY],
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($curlErr) {
        return ['error' => 'cURL error: ' . $curlErr, 'code' => 0];
    }

    return [
        'data' => json_decode($response, true),
        'code' => $httpCode,
    ];
}

// ── Action: verify-pay (Binance Pay) ─────────────────────────
// Endpoint: GET /sapi/v1/pay/transactions
// Docs: Check last 90 days of Pay transactions
if ($action === 'verify-pay') {
    $orderRef      = isset($body['order_ref'])       ? trim($body['order_ref'])      : '';
    $expectedUsdt  = isset($body['expected_amount']) ? floatval($body['expected_amount']) : 0;

    if (!$orderRef) {
        echo json_encode(['success' => false, 'error' => 'Order reference required']);
        exit();
    }

    // Binance Pay transactions — last 100 (max allowed without date range)
    $result = binanceRequest('/sapi/v1/pay/transactions', [
        'limit' => 100,
    ]);

    if ($result['code'] !== 200 || !isset($result['data'])) {
        echo json_encode(['success' => false, 'error' => 'Binance API error', 'detail' => $result]);
        exit();
    }

    $txList = isset($result['data']['data']) ? $result['data']['data'] : [];

    // Find matching transaction:
    // orderRef matches transactionId OR merchantTradeNo OR payerOrderId
    $matched = null;
    foreach ($txList as $tx) {
        $tid  = isset($tx['transactionId'])   ? $tx['transactionId']   : '';
        $mtn  = isset($tx['merchantTradeNo']) ? $tx['merchantTradeNo'] : '';
        $poi  = isset($tx['payerOrderId'])    ? $tx['payerOrderId']    : '';
        $oid  = isset($tx['orderId'])         ? $tx['orderId']         : '';
        if (
            strtolower($tid)  === strtolower($orderRef) ||
            strtolower($mtn)  === strtolower($orderRef) ||
            strtolower($poi)  === strtolower($orderRef) ||
            strtolower($oid)  === strtolower($orderRef)
        ) {
            $matched = $tx;
            break;
        }
    }

    if (!$matched) {
        echo json_encode(['success' => false, 'error' => 'Transaction not found in Binance Pay history']);
        exit();
    }

    // USDT check
    $currency   = isset($matched['currency'])   ? strtoupper($matched['currency']) : '';
    $fundsDetail = isset($matched['fundsDetail']) ? $matched['fundsDetail'] : [];
    $isUsdt = ($currency === 'USDT');
    if (!$isUsdt && is_array($fundsDetail)) {
        foreach ($fundsDetail as $fd) {
            if (isset($fd['currency']) && strtoupper($fd['currency']) === 'USDT') {
                $isUsdt = true;
                break;
            }
        }
    }

    if (!$isUsdt) {
        echo json_encode(['success' => false, 'error' => "Currency mismatch — Binance Pay-তে শুধু USDT accept করা হয়। পাওয়া গেছে: $currency। দয়া করে সাপোর্টে যোগাযোগ করুন।"]);
        exit();
    }

    // Status check
    $status = isset($matched['transactionStatus']) ? strtoupper($matched['transactionStatus']) : '';
    if ($status !== 'SUCCESS' && $status !== 'COMPLETED') {
        echo json_encode(['success' => false, 'error' => 'Transaction status is not SUCCESS. Current: ' . $status]);
        exit();
    }

    // Amount check (tolerance ±0.01 USDT for exchange rate)
    $paidAmount = isset($matched['amount']) ? floatval($matched['amount']) : 0;
    if ($expectedUsdt > 0 && $paidAmount < ($expectedUsdt - 0.01)) {
        echo json_encode([
            'success' => false,
            'error'   => 'Amount mismatch. Expected: ' . $expectedUsdt . ' USDT, Found: ' . $paidAmount . ' USDT'
        ]);
        exit();
    }

    echo json_encode([
        'success'    => true,
        'tx_id'      => $matched['transactionId'] ?? $orderRef,
        'amount'     => $paidAmount,
        'currency'   => 'USDT',
        'status'     => $status,
        'matched_id' => $matched['transactionId'] ?? '',
    ]);
    exit();
}

// ── Action: verify-deposit (Direct Crypto TxID) ───────────────
// Endpoint: GET /sapi/v1/capital/deposit/hisrec
// Checks deposit history for matching TxID
if ($action === 'verify-deposit') {
    $txHash        = isset($body['tx_hash'])         ? trim($body['tx_hash'])         : '';
    $expectedCoin  = isset($body['coin'])            ? strtoupper(trim($body['coin'])) : '';
    $expectedAmt   = isset($body['expected_amount']) ? floatval($body['expected_amount']) : 0;

    if (!$txHash) {
        echo json_encode(['success' => false, 'error' => 'Transaction hash required']);
        exit();
    }

    // Fetch deposit history — last 1000 records, all coins
    $params = ['limit' => 1000];
    if ($expectedCoin) {
        $params['coin'] = $expectedCoin;
    }

    $result = binanceRequest('/sapi/v1/capital/deposit/hisrec', $params);

    if ($result['code'] !== 200 || !isset($result['data'])) {
        echo json_encode(['success' => false, 'error' => 'Binance API error', 'detail' => $result]);
        exit();
    }

    $deposits = is_array($result['data']) ? $result['data'] : [];

    // Find matching TxID
    $matched = null;
    foreach ($deposits as $dep) {
        $depTxId = isset($dep['txId']) ? $dep['txId'] : '';
        if (strtolower($depTxId) === strtolower($txHash)) {
            $matched = $dep;
            break;
        }
    }

    if (!$matched) {
        echo json_encode(['success' => false, 'error' => 'Transaction not found in Binance deposit history. Ensure it is confirmed.']);
        exit();
    }

    // Status: 1 = Success in Binance deposit
    $depStatus = isset($matched['status']) ? intval($matched['status']) : -1;
    if ($depStatus !== 1) {
        $statusMap = [0 => 'Pending', 6 => 'Credited (unconfirmed)', 7 => 'Wrong Deposit', 8 => 'Waiting Manual Review'];
        $statusMsg = isset($statusMap[$depStatus]) ? $statusMap[$depStatus] : 'Unknown (' . $depStatus . ')';
        echo json_encode(['success' => false, 'error' => 'Deposit not confirmed yet. Status: ' . $statusMsg]);
        exit();
    }

    // Amount check (tolerance ±0.01)
    $paidAmount = isset($matched['amount']) ? floatval($matched['amount']) : 0;
    $coinName   = isset($matched['coin'])   ? strtoupper($matched['coin']) : $expectedCoin;
    if ($expectedAmt > 0 && $paidAmount < ($expectedAmt - 0.01)) { // 0.01 tolerance
        echo json_encode([
            'success' => false,
            'error'   => 'Amount mismatch. Expected ~' . $expectedAmt . ' ' . $coinName . ', Found: ' . $paidAmount . ' ' . $coinName
        ]);
        exit();
    }

    echo json_encode([
        'success'  => true,
        'tx_id'    => $txHash,
        'amount'   => $paidAmount,
        'coin'     => $coinName,
        'network'  => isset($matched['network']) ? $matched['network'] : '',
        'status'   => 'SUCCESS',
    ]);
    exit();
}

// Unknown action
echo json_encode(['success' => false, 'error' => 'Unknown action: ' . htmlspecialchars($action)]);
