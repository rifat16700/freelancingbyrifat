// ============================================================
// functions/api/binance-cf-proxy.js
// Cloudflare Pages Function — Binance API Proxy
//
// Route  : POST /api/binance-cf-proxy
// Purpose: Securely proxies Binance API calls from the edge.
//          Fetches Binance API Key & Secret from Supabase
//          settings table at runtime (no keys in source code).
//
// Actions supported:
//   { action: "verify-pay",     order_ref, expected_amount }
//   { action: "verify-deposit", tx_hash, coin, expected_amount }
//
// Legacy systems preserved:
//   - PHP proxy (binance_proxy.php) → still works as fallback
//   - Supabase Edge Function         → still works as fallback
//
// Toggle in Admin Panel: Settings → Crypto & Binance Pay
//   → "Verification System" dropdown → "Cloudflare Proxy"
// ============================================================

import { getConfig } from '../utils/config.js';

// ── Helper: fetch settings from whichever DB is active ───────
async function fetchSettings(config, fields) {
    if (config.DB_PROVIDER === 'appwrite') {
        const dbId   = config.APPWRITE_DATABASE_ID;
        const collId = config.APPWRITE_COLLECTION_SETTINGS;
        const url    = `${config.APPWRITE_ENDPOINT}/databases/${dbId}/collections/${collId}/documents`;
        const params = new URLSearchParams();
        params.append('queries[]', 'limit(1)');
        const res  = await fetch(`${url}?${params}`, {
            headers: {
                'X-Appwrite-Project': config.APPWRITE_PROJECT,
                'X-Appwrite-Key':     config.APPWRITE_API_KEY,
            },
        });
        if (!res.ok) throw new Error(`Appwrite settings fetch failed: ${res.status}`);
        const json = await res.json();
        return json.documents?.[0] || {};
    } else {
        const fieldsParam = fields ? fields.join(',') : '*';
        const res = await fetch(
            `${config.SUPABASE_URL}/rest/v1/settings?id=eq.1&select=${fieldsParam}`,
            {
                headers: {
                    'apikey':        config.SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${config.SUPABASE_ANON_KEY}`,
                },
            }
        );
        if (!res.ok) throw new Error(`Supabase settings fetch failed: ${res.status}`);
        const data = await res.json();
        return Array.isArray(data) ? (data[0] || {}) : data;
    }
}

// ── CORS headers helper ───────────────────────────────────────
function corsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin':  origin || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };
}

// ── Main handler ──────────────────────────────────────────────
export async function onRequest(context) {
    const config = getConfig(context.env);
    const { request } = context;
    const origin = request.headers.get('Origin') || '*';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
        return new Response(
            JSON.stringify({ success: false, error: 'Method not allowed' }),
            { status: 405, headers: corsHeaders(origin) }
        );
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return new Response(
            JSON.stringify({ success: false, error: 'Invalid JSON body' }),
            { status: 400, headers: corsHeaders(origin) }
        );
    }

    const action = body.action || '';
    if (!action) {
        return new Response(
            JSON.stringify({ success: false, error: 'No action specified' }),
            { status: 400, headers: corsHeaders(origin) }
        );
    }

    // ── Step 1: Fetch Binance API Key + Secret (DB_PROVIDER aware) ──
    let binanceApiKey, binanceApiSecret;
    try {
        const row    = await fetchSettings(config, ['binance_api_key', 'binance_api_secret']);
        binanceApiKey    = (row?.binance_api_key    || '').trim();
        binanceApiSecret = (row?.binance_api_secret || '').trim();
    } catch (err) {
        return new Response(
            JSON.stringify({ success: false, error: 'Failed to fetch Binance credentials', detail: String(err) }),
            { status: 502, headers: corsHeaders(origin) }
        );
    }

    if (!binanceApiKey || !binanceApiSecret) {
        return new Response(
            JSON.stringify({ success: false, error: 'Binance API Key/Secret not configured in Admin → Settings.' }),
            { status: 503, headers: corsHeaders(origin) }
        );
    }

    // ── Step 2: HMAC-SHA256 signing helper ────────────────────
    async function signRequest(params) {
        params.timestamp  = Date.now();
        params.recvWindow = 10000;
        const queryString = new URLSearchParams(params).toString();
        const key = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(binanceApiSecret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const sigBuf  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(queryString));
        const sigHex  = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
        return `${queryString}&signature=${sigHex}`;
    }

    // ── Step 3: Route by action ───────────────────────────────
    const BINANCE_BASE = 'https://api.binance.com';

    // ── action: verify-pay (Binance Pay) ─────────────────────
    if (action === 'verify-pay') {
        const orderRef     = (body.order_ref       || '').trim();
        const expectedUsdt = parseFloat(body.expected_amount || 0);

        if (!orderRef) {
            return new Response(
                JSON.stringify({ success: false, error: 'order_ref required' }),
                { status: 400, headers: corsHeaders(origin) }
            );
        }

        try {
            const qs  = await signRequest({ limit: 100 });
            const res = await fetch(`${BINANCE_BASE}/sapi/v1/pay/transactions?${qs}`, {
                headers: { 'X-MBX-APIKEY': binanceApiKey },
            });
            const json = await res.json();

            if (res.status !== 200 || !json) {
                return new Response(
                    JSON.stringify({ success: false, error: 'Binance API error', detail: json }),
                    { status: 502, headers: corsHeaders(origin) }
                );
            }

            const txList  = json.data || [];
            const matched = txList.find(tx =>
                [tx.transactionId, tx.merchantTradeNo, tx.payerOrderId, tx.orderId]
                    .some(id => (id || '').toLowerCase() === orderRef.toLowerCase())
            );

            if (!matched) {
                return new Response(
                    JSON.stringify({ success: false, error: 'Transaction not found in Binance Pay history' }),
                    { headers: corsHeaders(origin) }
                );
            }

            const status = (matched.transactionStatus || '').toUpperCase();
            if (status !== 'SUCCESS' && status !== 'COMPLETED') {
                return new Response(
                    JSON.stringify({ success: false, error: `Transaction status is ${status}, not SUCCESS` }),
                    { headers: corsHeaders(origin) }
                );
            }

            const paidAmount = parseFloat(matched.amount || 0);
            if (expectedUsdt > 0 && paidAmount < (expectedUsdt - 0.5)) {
                return new Response(
                    JSON.stringify({ success: false, error: `Amount mismatch. Expected: ${expectedUsdt} USDT, Found: ${paidAmount} USDT` }),
                    { headers: corsHeaders(origin) }
                );
            }

            return new Response(
                JSON.stringify({
                    success:    true,
                    tx_id:      matched.transactionId || orderRef,
                    amount:     paidAmount,
                    currency:   'USDT',
                    status,
                    matched_id: matched.transactionId || '',
                }),
                { headers: corsHeaders(origin) }
            );

        } catch (err) {
            return new Response(
                JSON.stringify({ success: false, error: 'Binance Pay verification failed', detail: String(err) }),
                { status: 500, headers: corsHeaders(origin) }
            );
        }
    }

    // ── action: verify-deposit (Direct Crypto TxID) ──────────
    if (action === 'verify-deposit') {
        const txHash      = (body.tx_hash       || '').trim();
        const expectedCoin = (body.coin         || '').toUpperCase();
        const expectedAmt  = parseFloat(body.expected_amount || 0);

        if (!txHash) {
            return new Response(
                JSON.stringify({ success: false, error: 'tx_hash required' }),
                { status: 400, headers: corsHeaders(origin) }
            );
        }

        try {
            const params = { limit: 1000 };
            if (expectedCoin) params.coin = expectedCoin;

            const qs  = await signRequest(params);
            const res = await fetch(`${BINANCE_BASE}/sapi/v1/capital/deposit/hisrec?${qs}`, {
                headers: { 'X-MBX-APIKEY': binanceApiKey },
            });
            const deposits = await res.json();

            if (res.status !== 200 || !Array.isArray(deposits)) {
                return new Response(
                    JSON.stringify({ success: false, error: 'Binance API error', detail: deposits }),
                    { status: 502, headers: corsHeaders(origin) }
                );
            }

            const matched = deposits.find(dep =>
                (dep.txId || '').toLowerCase() === txHash.toLowerCase()
            );

            if (!matched) {
                return new Response(
                    JSON.stringify({ success: false, error: 'Transaction not found in Binance deposit history. Ensure it is confirmed.' }),
                    { headers: corsHeaders(origin) }
                );
            }

            const depStatus = parseInt(matched.status ?? -1);
            if (depStatus !== 1) {
                const statusMap = { 0: 'Pending', 6: 'Credited (unconfirmed)', 7: 'Wrong Deposit', 8: 'Waiting Manual Review' };
                return new Response(
                    JSON.stringify({ success: false, error: `Deposit not confirmed. Status: ${statusMap[depStatus] || 'Unknown (' + depStatus + ')'}` }),
                    { headers: corsHeaders(origin) }
                );
            }

            const paidAmount = parseFloat(matched.amount || 0);
            const coinName   = (matched.coin || expectedCoin).toUpperCase();
            if (expectedAmt > 0 && paidAmount < expectedAmt * 0.98) {
                return new Response(
                    JSON.stringify({ success: false, error: `Amount mismatch. Expected ~${expectedAmt} ${coinName}, Found: ${paidAmount} ${coinName}` }),
                    { headers: corsHeaders(origin) }
                );
            }

            return new Response(
                JSON.stringify({
                    success: true,
                    tx_id:   txHash,
                    amount:  paidAmount,
                    coin:    coinName,
                    network: matched.network || '',
                    status:  'SUCCESS',
                }),
                { headers: corsHeaders(origin) }
            );

        } catch (err) {
            return new Response(
                JSON.stringify({ success: false, error: 'Deposit verification failed', detail: String(err) }),
                { status: 500, headers: corsHeaders(origin) }
            );
        }
    }

    // ── Unknown action ────────────────────────────────────────
    return new Response(
        JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
        { status: 400, headers: corsHeaders(origin) }
    );
}
