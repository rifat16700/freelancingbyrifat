<?php
// ============================================================
// proxyv2.php — New Payment Gateway Proxy (v2)
// Server: payment.freelancingbyrifat.top
//
// কাজ: E-commerce checkout থেকে data receive করে
//       নতুন gateway-তে cURL hit করবে এবং verify করবে।
//       hubohub v1 (api_proxy.php) এর মতো কাজ করবে।
// ============================================================

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, API-KEY");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$action = isset($_GET['action']) ? $_GET['action'] : '';

// ── 1. CALLBACK HANDLER ──────────────────────────────────────
// Payment gateway যখন success_url বা cancel_url এ redirect করে,
// তখন proxyv2.php সেটা ধরে frontend (checkout.html) এ পাঠাবে।
if ($action === 'callback') {
    $status   = isset($_GET['status']) ? $_GET['status'] : 'completed';
    $order_id = isset($_GET['order_id']) ? $_GET['order_id'] : '';
    $redirect = isset($_GET['redirect']) ? $_GET['redirect'] : '';
    
    // Gateway থেকে কোনো transaction id আসলে সেটা ধরবে (GET বা POST)
    $trx_id = isset($_POST['transaction_id']) ? $_POST['transaction_id'] : (isset($_GET['transactionId']) ? $_GET['transactionId'] : '');

    if ($redirect) {
        $final_url = $redirect . "?status=" . urlencode($status) . "&order_id=" . urlencode($order_id);
        if ($trx_id) {
            $final_url .= "&transactionId=" . urlencode($trx_id);
        }
        header("Location: " . $final_url);
        exit;
    } else {
        echo "Payment callback received but no redirect URL provided.";
        exit;
    }
}

// ── For 'create' and 'verify', expect JSON ───────────────────
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Method not allowed. Use POST."]);
    exit;
}

$json_data = file_get_contents("php://input");
$data = json_decode($json_data, true) ?: [];

// Get client API Key from headers or JSON body
$client_api_key = isset($_SERVER['HTTP_API_KEY']) ? $_SERVER['HTTP_API_KEY'] : (isset($data['api_key']) ? $data['api_key'] : '');

// If API Key is still empty, maybe they didn't send it. (Allow bypassing if you hardcoded it, but v1 expects it from client)
if (empty($client_api_key)) {
    // Fallback if needed (আপনি চাইলে আপনার hardcoded API key এখানে বসাতে পারেন)
    // $client_api_key = 'YOUR_NEW_GATEWAY_API_KEY_HERE';
    http_response_code(401);
    echo json_encode(["error" => "API Key is missing from the request."]);
    exit;
}

// ── Gateway URLs & Payload ───────────────────────────────────
$gateway_base_url = "https://paymentpay.freelancingbyrifat.top/api/payment/";

if ($action === 'create' || empty($action)) {
    $url = $gateway_base_url . "create";
    
    // User requested to build JSON manually using variables (like old script)
    $amount      = isset($data['amount']) ? $data['amount'] : 0;
    $order_id    = isset($data['tran_id']) ? $data['tran_id'] : (isset($data['order_id']) ? $data['order_id'] : '');
    $cus_name    = isset($data['cus_name']) ? $data['cus_name'] : 'Guest';
    $cus_email   = isset($data['cus_email']) ? $data['cus_email'] : 'guest@example.com';
    $success_url = isset($data['success_url']) ? $data['success_url'] : '';
    $cancel_url  = isset($data['cancel_url']) ? $data['cancel_url'] : '';

    $payload = json_encode([
        "amount"      => $amount,
        "currency"    => "BDT",
        "order_id"    => $order_id,
        "tran_id"     => $order_id,
        "cus_name"    => $cus_name,
        "cus_email"   => $cus_email,
        "success_url" => $success_url,
        "cancel_url"  => $cancel_url,
        "fail_url"    => $cancel_url,
        "webhook_url" => $success_url // Some gateways need this
    ]);

} elseif ($action === 'verify') {
    $url = $gateway_base_url . "verify";
    // For verify, usually they expect transaction_id or order_id
    $trx_id   = isset($data['transaction_id']) ? $data['transaction_id'] : (isset($data['trx_id']) ? $data['trx_id'] : '');
    $order_id = isset($data['order_id']) ? $data['order_id'] : '';
    $payload = json_encode([
        "transaction_id" => $trx_id,
        "order_id"       => $order_id
    ]);
} else {
    http_response_code(400);
    echo json_encode(["error" => "Invalid action specified."]);
    exit;
}

// ── 2. FORWARD REQUEST TO GATEWAY (cURL) ─────────────────────
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'API-KEY: ' . $client_api_key
]);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($curlErr) {
    http_response_code(502);
    echo json_encode(["error" => "Gateway connection failed: " . $curlErr]);
    exit;
}

http_response_code($httpCode ?: 200);
echo $response;
exit;
?>
