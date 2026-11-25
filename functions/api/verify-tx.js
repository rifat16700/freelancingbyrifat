const DEFAULT_BSC_RPC = "https://bsc-dataseed.binance.org/";
const DEFAULT_USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const DEFAULT_DECIMALS = 18;

// keccak256("Transfer(address,address,uint256)")
const TRANSFER_EVENT_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}

/**
 * Pure BigInt decimal-to-wei converter (avoids floating-point precision bugs).
 */
function parseUnits(amountStr, decimals) {
  const clean = String(amountStr).trim();
  if (!/^\d+(\.\d+)?$/.test(clean)) {
    throw new Error("Invalid expected invoice amount.");
  }
  const [whole, frac = ""] = clean.split(".");
  const truncatedFrac = frac.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(whole + truncatedFrac);
}

/**
 * Extracts a 20-byte lowercase address from a 32-byte indexed event topic.
 */
function decodeTopicAddress(topic) {
  if (!topic || typeof topic !== "string" || topic.length < 42) return null;
  return `0x${topic.slice(-40).toLowerCase()}`;
}

async function fetchTransactionReceipt(rpcUrl, txHash) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionReceipt",
      params: [txHash]
    })
  });

  if (!response.ok) {
    throw new Error(`BSC RPC HTTP error: ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`BSC RPC error: ${data.error.message || "Unknown RPC failure"}`);
  }

  return data.result; // null if transaction is still pending
}

async function resolveMerchantWallet(env) {
  if (env.DB) {
    try {
      const row = await env.DB.prepare("SELECT web3_wallet_address FROM settings WHERE id=1").first();
      const dbWallet = (row?.web3_wallet_address || "").trim().toLowerCase();
      if (ADDRESS_REGEX.test(dbWallet)) return dbWallet;
    } catch {
      // Column may not exist yet before first settings save; fall back to env.MERCHANT_WALLET
    }
  }
  const envWallet = (env.MERCHANT_WALLET || "").trim().toLowerCase();
  return ADDRESS_REGEX.test(envWallet) ? envWallet : "";
}

async function isTxHashAlreadyUsed(env, txHash) {
  if (!env.DB) return false;

  try {
    const vp = await env.DB.prepare(
      "SELECT id FROM verified_payments WHERE LOWER(transaction_id) = ? LIMIT 1"
    ).bind(txHash).first();
    if (vp) return true;
  } catch {
    // Ignore if verified_payments table is not present
  }

  try {
    const ord = await env.DB.prepare(
      "SELECT id FROM orders WHERE LOWER(payment_trx_id) = ? LIMIT 1"
    ).bind(txHash).first();
    if (ord) return true;
  } catch {
    // Ignore if orders table is not present
  }

  return false;
}

async function recordVerifiedPayment(env, invoiceId, txHash, expectedAmountUsdt, senderAddress) {
  if (!env.DB) return;
  try {
    const vpId = `vp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await env.DB.prepare(
      "INSERT INTO verified_payments (id, transaction_id, amount, sender_number, status) VALUES (?, ?, ?, ?, 'verified')"
    )
      .bind(vpId, txHash, Number(expectedAmountUsdt) || 0, senderAddress || invoiceId)
      .run();
  } catch (err) {
    // UNIQUE constraint violation means concurrent replay attempt
    if (String(err?.message || "").toLowerCase().includes("unique")) {
      throw new Error("Transaction hash has already been used for another invoice.");
    }
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost({ request, env }) {
  try {
    const merchantWallet = await resolveMerchantWallet(env);
    if (!merchantWallet) {
      return jsonResponse(
        {
          success: false,
          error: "Merchant wallet address is not configured in Admin Settings or MERCHANT_WALLET."
        },
        500
      );
    }

    const rpcUrl = env.BSC_RPC_URL || DEFAULT_BSC_RPC;
    const usdtContract = (env.USDT_CONTRACT || DEFAULT_USDT_CONTRACT).trim().toLowerCase();
    const decimals = Number(env.USDT_DECIMALS || DEFAULT_DECIMALS);

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ success: false, error: "Invalid JSON payload." }, 400);
    }

    const invoiceId = typeof body.invoiceId === "string" ? body.invoiceId.trim() : "";
    const txHash = typeof body.txHash === "string" ? body.txHash.trim().toLowerCase() : "";
    const expectedAmountUsdt = body.expectedAmountUsdt;

    if (!invoiceId) {
      return jsonResponse({ success: false, error: "Missing invoiceId." }, 400);
    }
    if (!TX_HASH_REGEX.test(txHash)) {
      return jsonResponse({ success: false, error: "Invalid transaction hash format." }, 400);
    }
    if (!expectedAmountUsdt || Number(expectedAmountUsdt) <= 0) {
      return jsonResponse({ success: false, error: "Invalid expectedAmountUsdt." }, 400);
    }

    // Check 5 (Pre-check): Anti-Replay Protection
    if (await isTxHashAlreadyUsed(env, txHash)) {
      return jsonResponse(
        { success: false, error: "Transaction hash has already been used for another invoice." },
        409
      );
    }

    // Fetch receipt from BSC JSON-RPC (no heavy libraries)
    const receipt = await fetchTransactionReceipt(rpcUrl, txHash);
    if (!receipt) {
      return jsonResponse(
        { success: false, pending: true, error: "Transaction is still pending confirmation." },
        202
      );
    }

    // Check 1: Transaction Status
    if (receipt.status !== "0x1") {
      return jsonResponse(
        { success: false, error: "On-chain transaction failed (reverted)." },
        422
      );
    }

    // Checks 2, 3, & 4: Token Contract + Receiver + Amount
    const expectedAmountWei = parseUnits(expectedAmountUsdt, decimals);
    const logs = Array.isArray(receipt.logs) ? receipt.logs : [];

    const validTransferLog = logs.find((log) => {
      if (!log || typeof log.address !== "string" || !Array.isArray(log.topics)) {
        return false;
      }

      // Check 2: Official BSC USDT contract & ERC-20 Transfer topic
      const isUsdtContract = log.address.toLowerCase() === usdtContract;
      const isTransferEvent =
        log.topics.length >= 3 &&
        log.topics[0]?.toLowerCase() === TRANSFER_EVENT_TOPIC;

      if (!isUsdtContract || !isTransferEvent) return false;

      // Check 3: Receiver matches Merchant Wallet Address
      const toAddress = decodeTopicAddress(log.topics[2]);
      if (toAddress !== merchantWallet) return false;

      // Check 4: Transferred amount >= expected invoice amount
      try {
        const transferredWei = BigInt(log.data || "0x0");
        return transferredWei >= expectedAmountWei;
      } catch {
        return false;
      }
    });

    if (!validTransferLog) {
      return jsonResponse(
        {
          success: false,
          error:
            "No valid BSC USDT Transfer to the merchant wallet matching the required amount was found."
        },
        422
      );
    }

    const senderAddress = decodeTopicAddress(validTransferLog.topics[1]) || "";

    // Record txHash in D1 verified_payments for Anti-Replay protection
    await recordVerifiedPayment(env, invoiceId, txHash, expectedAmountUsdt, senderAddress);

    return jsonResponse({ success: true, txHash, invoiceId }, 200);
  } catch (err) {
    return jsonResponse(
      { success: false, error: err.message || "Internal verification error." },
      500
    );
  }
}
