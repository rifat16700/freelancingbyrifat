/**
 * FN Pay Backend - Payment Gateway Verifier (Multi-DB Version)
 * Powered by Express.js, Binance Pay API, Supabase, and Appwrite.
 * Designed for deployment on Hugging Face Spaces.
 */

// Load environment variables in development
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const sdk = require('node-appwrite');

const app = express();
const PORT = process.env.PORT || 7860;

// Enable CORS for all origins to accept incoming requests from any frontend
app.use(cors());

// Parse incoming JSON payloads
app.use(express.json());

// Initialize database clients conditionally
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  try {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    console.log('[INIT] Supabase client initialized.');
  } catch (err) {
    console.error('[INIT] Failed to initialize Supabase client:', err.message);
  }
}

let appwriteClient = null;
let appwriteDatabases = null;
const appwriteEndpoint = process.env.APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
const appwriteProject = process.env.APPWRITE_PROJECT || process.env.APPWRITE_PROJECT_ID;
const appwriteApiKey = process.env.APPWRITE_API_KEY;

if (appwriteEndpoint && appwriteProject && appwriteApiKey) {
  try {
    appwriteClient = new sdk.Client()
      .setEndpoint(appwriteEndpoint)
      .setProject(appwriteProject)
      .setKey(appwriteApiKey);
    appwriteDatabases = new sdk.Databases(appwriteClient);
    console.log('[INIT] Appwrite client initialized.');
  } catch (err) {
    console.error('[INIT] Failed to initialize Appwrite client:', err.message);
  }
}

// Determine active DB provider
// Can be explicitly forced via DB_PROVIDER, otherwise autodetected
const DB_PROVIDER = process.env.DB_PROVIDER || (appwriteDatabases ? 'appwrite' : (supabase ? 'supabase' : null));
console.log(`[INIT] Active database provider: ${DB_PROVIDER || 'None (Verification only)'}`);

// Check configuration on startup
const missingEnv = [];
if (!process.env.BINANCE_API_KEY) missingEnv.push('BINANCE_API_KEY');
if (!process.env.BINANCE_SECRET_KEY && !process.env.BINANCE_API_SECRET) missingEnv.push('BINANCE_SECRET_KEY');

if (!DB_PROVIDER) {
  missingEnv.push('DB Credentials (either Supabase or Appwrite)');
}

if (missingEnv.length > 0) {
  console.warn(`[WARNING] Missing configurations: ${missingEnv.join(', ')}.`);
  console.warn('Please ensure these are configured in your Hugging Face Spaces Settings.');
}

/**
 * HMAC-SHA256 Signature Helper
 */
function hmacSHA256(secret, message) {
  return crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
}

/**
 * Binance Signed Fetch Helper (Spot/Pay/Capital APIs)
 */
async function binanceFetch(apiKey, apiSecret, endpoint, params) {
  const queryParams = {
    ...params,
    timestamp: Date.now(),
    recvWindow: 10000
  };

  const qs = Object.keys(queryParams)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
    .join('&');

  const signature = hmacSHA256(apiSecret, qs);
  const url = `https://api.binance.com${endpoint}?${qs}&signature=${signature}`;

  console.log(`[BINANCE] Fetching: ${endpoint} with params ${JSON.stringify(params)}`);

  try {
    const response = await axios.get(url, {
      headers: { 'X-MBX-APIKEY': apiKey },
      timeout: 15000,
      validateStatus: () => true // Allow handling non-200 status codes manually
    });

    return {
      ok: response.status >= 200 && response.status < 300,
      data: response.data,
      status: response.status
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      status: 500
    };
  }
}

/**
 * Health Check Endpoint
 */
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'FN Pay Backend Gateway (Multi-DB)',
    timestamp: new Date().toISOString(),
    configured: {
      binance: !!(process.env.BINANCE_API_KEY && (process.env.BINANCE_SECRET_KEY || process.env.BINANCE_API_SECRET)),
      db_provider: DB_PROVIDER,
      supabase: !!supabase,
      appwrite: !!appwriteDatabases
    }
  });
});

/**
 * POST / and POST /api/verify-payment
 * Receives transaction details, verifies against Binance APIs,
 * and atomically locks the transaction in Supabase or Appwrite.
 */
app.post(['/', '/api/verify-payment'], async (req, res) => {
  const body = req.body;
  const transaction_id = String(body.transaction_id || body.tx_id || '').trim();
  let method = String(body.method || body.action || 'crypto').toLowerCase();

  // Normalize method names
  if (method === 'verify-pay') method = 'binance_pay';
  if (method === 'verify-deposit') method = 'crypto';

  const amount = parseFloat(String(body.amount || body.expected_amount || '0'));
  const currency = String(body.currency || 'USDT').toUpperCase();
  const coin = String(body.coin || 'USDT').toUpperCase();
  const network = String(body.network || '');

  console.log(`[PAYMENT_VERIFICATION] Received request: tx_id=${transaction_id}, method=${method}, amount=${amount}, coin=${coin}, network=${network}`);

  if (!transaction_id) {
    return res.status(400).json({
      success: false,
      message: 'Transaction ID (tx_id / transaction_id) is required.'
    });
  }

  // 1. Double-spend pre-check
  if (DB_PROVIDER === 'supabase' && supabase) {
    try {
      const { data: existing, error: checkErr } = await supabase
        .from('verified_payments')
        .select('id, order_id')
        .eq('transaction_id', transaction_id)
        .maybeSingle();

      if (checkErr) {
        console.error('[DB] Supabase check error:', checkErr.message);
        return res.status(500).json({ success: false, message: 'Database error during double-spend check.' });
      }

      if (existing) {
        return res.status(400).json({
          success: false,
          message: '❌ এই Transaction ID আগেই ব্যবহার হয়েছে! Double-spend rejected.',
          code: 'DUPLICATE_TXID'
        });
      }
    } catch (err) {
      console.error('[DB] Supabase check exception:', err.message);
      return res.status(500).json({ success: false, message: 'Database query exception.' });
    }
  } else if (DB_PROVIDER === 'appwrite' && appwriteDatabases) {
    const appwriteDbId = process.env.APPWRITE_DATABASE_ID || '6a19e07f002427086405';
    const appwriteCollId = process.env.APPWRITE_COLLECTION_VERIFIED_PAYMENTS || 'verified_payments';

    try {
      const response = await appwriteDatabases.listDocuments(
        appwriteDbId,
        appwriteCollId,
        [
          sdk.Query.equal('transaction_id', transaction_id),
          sdk.Query.limit(1)
        ]
      );

      if (response.documents && response.documents.length > 0) {
        return res.status(400).json({
          success: false,
          message: '❌ এই Transaction ID আগেই ব্যবহার হয়েছে! Double-spend rejected.',
          code: 'DUPLICATE_TXID'
        });
      }
    } catch (err) {
      console.error('[DB] Appwrite check error:', err.message);
      return res.status(500).json({ success: false, message: 'Database error during double-spend check.' });
    }
  }

  // 2. Binance API Verification
  const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
  const BINANCE_SECRET_KEY = process.env.BINANCE_SECRET_KEY || process.env.BINANCE_API_SECRET;

  if (!BINANCE_API_KEY || !BINANCE_SECRET_KEY) {
    return res.status(500).json({
      success: false,
      message: 'Server configuration error: Binance credentials missing.'
    });
  }

  let isVerified = false;
  let failReason = '';

  try {
    if (method === 'binance_pay') {
      // Query Binance Pay Transactions history
      const result = await binanceFetch(
        BINANCE_API_KEY,
        BINANCE_SECRET_KEY,
        '/sapi/v1/pay/transactions',
        { limit: 100 }
      );

      if (!result.ok) {
        console.error('[BINANCE] Pay transaction fetch failed:', result.data);
        return res.status(400).json({
          success: false,
          message: `Binance API error (Pay): ${JSON.stringify(result.data || result.error)}`
        });
      }

      const txList = (result.data && result.data.data) || [];

      // Find transaction matching transactionId, merchantTradeNo, payerOrderId, or orderId
      const matched = txList.find(tx =>
        [tx.transactionId, tx.merchantTradeNo, tx.payerOrderId, tx.orderId]
          .map(v => String(v || '').toLowerCase())
          .includes(transaction_id.toLowerCase())
      );

      if (!matched) {
        failReason = 'Binance Pay history তে এই Transaction ID পাওয়া যায়নি।';
      } else {
        const txStatus = String(matched.transactionStatus || matched.status || 'SUCCESS').toUpperCase();
        const paidAmount = parseFloat(String(matched.amount || '0'));
        const txCurrency = String(matched.currency || '').toUpperCase();
        const hasFundsUsdt = Array.isArray(matched.fundsDetail)
          ? matched.fundsDetail.some(fd => String(fd.currency || '').toUpperCase() === 'USDT')
          : false;

        if (txCurrency !== 'USDT' && !hasFundsUsdt) {
          failReason = `Currency mismatch — Binance Pay-তে শুধু USDT accept করা হয়। পাওয়া গেছে: ${txCurrency}。`;
        } else if (!['SUCCESS', 'COMPLETED', 'PAID', 'SUCCESSFUL'].includes(txStatus)) {
          failReason = `Payment status এখনো confirmed না। Current status: ${txStatus}`;
        } else if (amount > 0 && paidAmount < amount - 0.01) {
          failReason = `Amount mismatch — Expected: ${amount} USDT, Paid: ${paidAmount} USDT`;
        } else {
          isVerified = true;
        }
      }
    } else {
      // Query Standard Crypto Deposit history
      const params = { limit: 1000 };
      if (coin) params.coin = coin;

      const result = await binanceFetch(
        BINANCE_API_KEY,
        BINANCE_SECRET_KEY,
        '/sapi/v1/capital/deposit/hisrec',
        params
      );

      if (!result.ok) {
        console.error('[BINANCE] Deposit history fetch failed:', result.data);
        return res.status(400).json({
          success: false,
          message: `Binance API error (Deposit): ${JSON.stringify(result.data || result.error)}`
        });
      }

      const deposits = result.data || [];
      const matched = deposits.find(
        dep => String(dep.txId || '').toLowerCase() === transaction_id.toLowerCase()
      );

      if (!matched) {
        failReason = 'Blockchain এ এই TxHash পাওয়া যায়নি। Confirmed হতে একটু সময় লাগতে পারে।';
      } else {
        const depStatus = parseInt(String(matched.status ?? '-1'), 10);
        const paidAmount = parseFloat(String(matched.amount || '0'));
        const foundCoin = String(matched.coin || '').toUpperCase();

        const statusMap = {
          0: 'Pending',
          6: 'Credited (unconfirmed)',
          7: 'Wrong Deposit',
          8: 'Waiting Manual Review'
        };

        if (depStatus !== 1) {
          failReason = `Deposit confirmed হয়নি। Status: ${statusMap[depStatus] || 'Unknown (' + depStatus + ')'}`;
        } else if (coin && foundCoin !== coin) {
          failReason = `Coin mismatch — Expected: ${coin}, Found: ${foundCoin}`;
        } else if (amount > 0 && paidAmount < amount - 0.01) {
          failReason = `Amount mismatch — Expected: ~${amount} ${coin}, Found: ${paidAmount} ${foundCoin}`;
        } else {
          isVerified = true;
        }
      }
    }
  } catch (err) {
    console.error('[BINANCE] Error verifying Binance transaction:', err.message);
    return res.status(500).json({
      success: false,
      message: `Internal error checking Binance transaction: ${err.message}`
    });
  }

  if (!isVerified) {
    return res.status(400).json({ success: false, message: failReason });
  }

  // 3. Atomically lock TxID in DB
  if (DB_PROVIDER === 'supabase' && supabase) {
    try {
      const { error: insertErr } = await supabase
        .from('verified_payments')
        .insert([{
          transaction_id: transaction_id,
          order_id: 'PENDING',
          amount: amount,
          currency: currency,
          method: method,
          coin: method === 'binance_pay' ? 'USDT' : coin,
          network: method === 'binance_pay' ? 'Binance Pay' : network
        }]);

      if (insertErr) {
        if (insertErr.code === '23505') {
          return res.status(400).json({
            success: false,
            message: '❌ Transaction ID already recorded (race condition). Double-spend blocked.',
            code: 'DUPLICATE_TXID'
          });
        }
        console.error('[DB] Supabase lock error:', insertErr.message);
        return res.status(500).json({ success: false, message: 'DB error locking payment.' });
      }
    } catch (err) {
      console.error('[DB] Supabase lock exception:', err.message);
      return res.status(500).json({ success: false, message: 'DB exception locking payment.' });
    }
  } else if (DB_PROVIDER === 'appwrite' && appwriteDatabases) {
    const appwriteDbId = process.env.APPWRITE_DATABASE_ID || '6a19e07f002427086405';
    const appwriteCollId = process.env.APPWRITE_COLLECTION_VERIFIED_PAYMENTS || 'verified_payments';

    try {
      await appwriteDatabases.createDocument(
        appwriteDbId,
        appwriteCollId,
        sdk.ID.unique(),
        {
          transaction_id: transaction_id,
          method: method,
          amount: Math.round(amount), // Appwrite field is integer
          order_id: 'PENDING'
        }
      );
    } catch (err) {
      if (err.code === 409) {
        return res.status(400).json({
          success: false,
          message: '❌ Transaction ID already recorded (race condition). Double-spend blocked.',
          code: 'DUPLICATE_TXID'
        });
      }
      console.error('[DB] Appwrite lock error:', err.message);
      return res.status(500).json({ success: false, message: 'DB error locking payment.' });
    }
  } else {
    console.warn('[PAYMENT_VERIFICATION] Payment verified but database provider is unconfigured.');
  }

  // 4. Return success
  return res.status(200).json({
    success: true,
    message: '✅ Payment verified on Binance and locked successfully.',
    transaction_id: transaction_id,
    method: method,
    mode: 'binance_verified'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` FN Pay Backend is running on port ${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(` Active Database Provider: ${DB_PROVIDER || 'None (Verification only)'}`);
  console.log(` Ready to verify transactions with Binance Pay API`);
  console.log(`==================================================`);
});
