// ============================================================
// Supabase Edge Function: verify-payment
// URL: https://<your-project>.supabase.co/functions/v1/verify-payment
//
// ── কী করে ──────────────────────────────────────────────────
// 1. Frontend থেকে TxID পায়
// 2. Supabase DB তে check করে — এই ID আগে used হয়েছে কিনা
// 3. Binance API তে HMAC-SHA256 দিয়ে verify করে (real-time)
// 4. Verified হলে DB তে atomically lock করে insert দেয়
// 5. Frontend কে success/failure জানায়
//
// ── Secret Keys কোথায় রাখবে ────────────────────────────────
// Supabase Dashboard → Project Settings → Edge Functions → Secrets
// BINANCE_API_KEY    = তোমার Binance API Key
// BINANCE_API_SECRET = তোমার Binance API Secret
//
// ── Deploy করার command ─────────────────────────────────────
// supabase functions deploy verify-payment
// ============================================================

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── CORS Headers ─────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── JSON Response Helper ──────────────────────────────────────
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ── HMAC-SHA256 Signature (Binance এর জন্য) ──────────────────
async function hmacSHA256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Binance Signed GET Request Helper ────────────────────────
async function binanceFetch(
  apiKey: string,
  apiSecret: string,
  endpoint: string,
  params: Record<string, string | number>,
): Promise<{ ok: boolean; data: unknown; status: number }> {
  const qs = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    timestamp:  String(Date.now()),
    recvWindow: '10000',
  }).toString();

  const signature = await hmacSHA256(apiSecret, qs);
  const url       = `https://api.binance.com${endpoint}?${qs}&signature=${signature}`;

  const res = await fetch(url, {
    headers: { 'X-MBX-APIKEY': apiKey },
  });

  const data   = await res.json();
  return { ok: res.ok, data, status: res.status };
}

// ── Main Handler ──────────────────────────────────────────────
serve(async (req: Request) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method !== 'POST') {
    return json({ success: false, message: 'Method not allowed.' }, 405);
  }

  // ── Secret Keys (Supabase Secrets থেকে আসে) ─────────────────
  const BINANCE_API_KEY    = Deno.env.get('BINANCE_API_KEY')    ?? '';
  const BINANCE_API_SECRET = Deno.env.get('BINANCE_API_SECRET') ?? '';
  const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')       ?? '';
  const SERVICE_ROLE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!BINANCE_API_KEY || !BINANCE_API_SECRET) {
    return json({ success: false, message: 'Server misconfiguration: Binance secrets missing.' }, 500);
  }

  // ── Parse Request Body ────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, message: 'Invalid JSON body.' }, 400);
  }

  const transaction_id = String(body.transaction_id ?? '').trim();
  const method         = String(body.method         ?? 'crypto').toLowerCase(); // 'binance_pay' | 'crypto'
  const amount         = parseFloat(String(body.amount   ?? '0'));
  const currency       = String(body.currency ?? 'USDT').toUpperCase();
  const coin           = String(body.coin     ?? 'USDT').toUpperCase();
  const network        = String(body.network  ?? '');

  if (!transaction_id) {
    return json({ success: false, message: 'Transaction ID দাও।' });
  }

  // ── Supabase Client (Service Role — trusted) ──────────────────
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ── Step 1: Double-spend pre-check ───────────────────────────
  // এই TxID আগে কেউ ব্যবহার করেছে কিনা দেখো
  const { data: existing, error: checkErr } = await sb
    .from('verified_payments')
    .select('id, order_id')
    .eq('transaction_id', transaction_id)
    .maybeSingle();

  if (checkErr) {
    return json({ success: false, message: 'DB error: ' + checkErr.message });
  }

  if (existing) {
    return json({
      success: false,
      message: '❌ এই Transaction ID আগেই ব্যবহার হয়েছে! Double-spend rejected.',
      code:    'DUPLICATE_TXID',
    });
  }

  // ── Step 2: Binance API Verification ─────────────────────────
  let isVerified = false;
  let failReason = '';

  if (method === 'binance_pay') {
    // ─ Binance Pay: /sapi/v1/pay/transactions ─────────────────
    const result = await binanceFetch(
      BINANCE_API_KEY,
      BINANCE_API_SECRET,
      '/sapi/v1/pay/transactions',
      { limit: 100 },
    );

    if (!result.ok) {
      return json({
        success: false,
        message: 'Binance API error (Pay): ' + JSON.stringify(result.data),
      });
    }

    const txList = ((result.data as Record<string, unknown>)?.data ?? []) as Record<string, unknown>[];

    // transactionId, merchantTradeNo, payerOrderId, orderId — যেকোনো একটা match করলেই হবে
    const matched = txList.find(tx =>
      [tx['transactionId'], tx['merchantTradeNo'], tx['payerOrderId'], tx['orderId']]
        .map(v => String(v ?? '').toLowerCase())
        .includes(transaction_id.toLowerCase()),
    );

    if (!matched) {
      failReason = 'Binance Pay history তে এই Transaction ID পাওয়া যায়নি।';
    } else {
      const txStatus   = String(matched['transactionStatus'] ?? matched['status'] ?? 'SUCCESS').toUpperCase();
      const paidAmount = parseFloat(String(matched['amount'] ?? '0'));

      // Currency check — USDT হতে হবে
      const txCurrency = String(matched['currency'] ?? '').toUpperCase();
      const hasFundsUsdt = Array.isArray(matched['fundsDetail'])
        ? (matched['fundsDetail'] as Record<string, unknown>[]).some(
            fd => String(fd['currency'] ?? '').toUpperCase() === 'USDT',
          )
        : false;

      if (txCurrency !== 'USDT' && !hasFundsUsdt) {
        failReason = `Currency mismatch — Binance Pay-তে শুধু USDT accept করা হয়। পাওয়া গেছে: ${txCurrency}। দয়া করে সাপোর্টে যোগাযোগ করুন।`;
      } else if (!['SUCCESS', 'COMPLETED', 'PAID', 'SUCCESSFUL'].includes(txStatus)) {
        failReason = `Payment status এখনো confirmed না। Current status: ${txStatus}`;
      } else if (amount > 0 && paidAmount < amount - 0.01) {
        // ±0.01 USDT tolerance (exchange rate difference)
        failReason = `Amount mismatch — Expected: ${amount} USDT, Paid: ${paidAmount} USDT`;
      } else {
        isVerified = true;
      }
    }

  } else {
    // ─ Crypto Deposit: /sapi/v1/capital/deposit/hisrec ────────
    const params: Record<string, string | number> = { limit: 1000 };
    if (coin) params['coin'] = coin;

    const result = await binanceFetch(
      BINANCE_API_KEY,
      BINANCE_API_SECRET,
      '/sapi/v1/capital/deposit/hisrec',
      params,
    );

    if (!result.ok) {
      return json({
        success: false,
        message: 'Binance API error (Deposit): ' + JSON.stringify(result.data),
      });
    }

    const deposits = Array.isArray(result.data)
      ? (result.data as Record<string, unknown>[])
      : [];

    const matched = deposits.find(
      dep => String(dep['txId'] ?? '').toLowerCase() === transaction_id.toLowerCase(),
    );

    if (!matched) {
      failReason = 'Blockchain এ এই TxHash পাওয়া যায়নি। Confirmed হতে একটু সময় লাগতে পারে।';
    } else {
      const depStatus  = parseInt(String(matched['status'] ?? '-1'), 10);
      const paidAmount = parseFloat(String(matched['amount'] ?? '0'));
      const foundCoin  = String(matched['coin'] ?? '').toUpperCase();

      const statusMap: Record<number, string> = {
        0: 'Pending',
        6: 'Credited (unconfirmed)',
        7: 'Wrong Deposit',
        8: 'Waiting Manual Review',
      };

      if (depStatus !== 1) {
        failReason = `Deposit confirmed হয়নি। Status: ${statusMap[depStatus] ?? 'Unknown (' + depStatus + ')'}`;
      } else if (coin && foundCoin !== coin) {
        failReason = `Coin mismatch — Expected: ${coin}, Found: ${foundCoin}`;
      } else if (amount > 0 && paidAmount < amount - 0.01) {
        // 0.01 tolerance
        failReason = `Amount mismatch — Expected: ~${amount} ${coin}, Found: ${paidAmount} ${foundCoin}`;
      } else {
        isVerified = true;
      }
    }
  }

  // ── Verification failed → return early ───────────────────────
  if (!isVerified) {
    return json({ success: false, message: failReason });
  }

  // ── Step 3: Atomically lock TxID in DB ───────────────────────
  // UNIQUE constraint on transaction_id prevents race conditions
  const { error: insertErr } = await sb.from('verified_payments').insert([{
    transaction_id: transaction_id,
    order_id:       'PENDING',
    amount:         amount,
    currency:       currency,
    method:         method,
    coin:           method === 'binance_pay' ? 'USDT' : coin,
    network:        method === 'binance_pay' ? 'Binance Pay' : network,
  }]);

  if (insertErr) {
    // Race condition — অন্য কেউ আগে insert করে ফেলেছে
    if (insertErr.code === '23505') {
      return json({
        success: false,
        message: '❌ Transaction ID already recorded (race condition). Double-spend blocked.',
        code:    'DUPLICATE_TXID',
      });
    }
    return json({ success: false, message: 'DB insert error: ' + insertErr.message });
  }

  // ── Step 4: Return success ────────────────────────────────────
  return json({
    success:        true,
    message:        '✅ Payment verified on Binance and locked successfully.',
    transaction_id: transaction_id,
    method:         method,
    mode:           'binance_verified',
  });
});
