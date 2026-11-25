import { createAppKit } from "@reown/appkit";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { bsc } from "@reown/appkit/networks";
import { ethers } from "ethers";

const BSC_CHAIN_ID = 56;
const BSC_CHAIN_HEX = "0x38";
const DEFAULT_USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const DEFAULT_DECIMALS = 18;
const ERC20_TRANSFER_ABI = [
  "function transfer(address to, uint256 value) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)"
];
const STORAGE_KEY = "w3_connected_wallet";

// Reown Explorer Wallet IDs: MetaMask, Trust Wallet, Binance Web3 Wallet
const FEATURED_WALLET_IDS = [
  "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96", // MetaMask
  "4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0", // Trust Wallet
  "8a0ee50d1f22f6651afcae7eb4253e52a3310b90af5daef78a8c4929a9bb99d4"  // Binance Web3 Wallet
];

const POPULAR_WALLETS = [
  { name: "MetaMask", match: "metamask", icon: "🦊", url: "https://metamask.io/download/" },
  { name: "Trust Wallet", match: "trust", icon: "🛡️", url: "https://trustwallet.com/download" },
  { name: "Binance Web3 Wallet", match: "binance", icon: "🟡", url: "https://www.binance.com/en/web3wallet" },
  { name: "Coinbase Wallet", match: "coinbase", icon: "🔵", url: "https://www.coinbase.com/wallet" },
  { name: "OKX Wallet", match: "okx", icon: "⚫", url: "https://www.okx.com/web3" }
];

let appKit = null;
let initializedProjectId = "";
let selectedProvider = null;
let selectedAccount = "";
let selectedWalletName = "";
let isProcessing = false;

// Discover all installed EIP-6963 browser wallets (prevents MetaMask from hijacking window.ethereum)
const discoveredProviders = new Map();
if (typeof window !== "undefined") {
  window.addEventListener("eip6963:announceProvider", (event) => {
    const detail = event?.detail;
    if (detail?.info?.uuid && detail?.provider) {
      discoveredProviders.set(detail.info.uuid, detail);
    }
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

function shortAddr(addr) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "Not connected";
}

function setWeb3Status(type, html) {
  const box = document.getElementById("web3StatusBox");
  if (!box) return;
  box.className = "verify-status" + (type ? ` ${type}` : "");
  box.innerHTML = html;
}

function isWalletConnected() {
  return Boolean(appKit?.getIsConnected?.() || (selectedProvider && selectedAccount));
}

function getConnectedAddress() {
  return appKit?.getAddress?.() || selectedAccount || "";
}

function updateWeb3UI() {
  const connectBtn = document.getElementById("web3ConnectBtn");
  const payBtn = document.getElementById("web3PayBtn");
  const walletLabel = document.getElementById("web3ConnectedAddr");
  const connected = isWalletConnected();
  const address = getConnectedAddress();

  if (walletLabel) {
    walletLabel.textContent = connected
      ? `${shortAddr(address)}${selectedWalletName ? ` (${selectedWalletName})` : ""}`
      : "Not connected";
  }
  if (connectBtn) {
    connectBtn.disabled = isProcessing;
    connectBtn.textContent = connected
      ? `✅ ${shortAddr(address)} (Switch / Change Wallet)`
      : "🔗 Connect Wallet (Select Wallet)";
  }
  if (payBtn) {
    payBtn.disabled = isProcessing || !connected;
  }
}

async function tryAutoReconnect() {
  if (appKit || isWalletConnected()) return;
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {}
  if (!saved) return;

  window.dispatchEvent(new Event("eip6963:requestProvider"));
  // Wait briefly for extensions to announce via EIP-6963
  await new Promise((r) => setTimeout(r, 150));

  const announced = Array.from(discoveredProviders.values());
  let match = announced.find(
    (d) =>
      (saved.rdns && d.info?.rdns === saved.rdns) ||
      (saved.name && d.info?.name === saved.name)
  );
  const provider = match?.provider || (saved.isLegacy ? window.ethereum : null);
  if (!provider) return;

  try {
    const accounts = await provider.request({ method: "eth_accounts" });
    if (accounts && accounts.length > 0) {
      selectedProvider = provider;
      selectedAccount = accounts[0];
      selectedWalletName = match?.info?.name || saved.name || "Wallet";
      updateWeb3UI();
    }
  } catch {}
}

function init(projectId) {
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  if (!projectId) {
    tryAutoReconnect();
    updateWeb3UI();
    return false;
  }
  if (appKit && initializedProjectId === projectId) {
    updateWeb3UI();
    return true;
  }

  initializedProjectId = projectId;
  appKit = createAppKit({
    adapters: [new EthersAdapter()],
    networks: [bsc],
    defaultNetwork: bsc,
    projectId,
    allWallets: "SHOW",
    featuredWalletIds: FEATURED_WALLET_IDS,
    metadata: {
      name: document.title || "Crypto Checkout",
      description: "One-Time BSC BEP-20 USDT Payment",
      url: window.location.origin,
      icons: [`${window.location.origin}/favicon.ico`]
    },
    features: { analytics: false }
  });

  appKit.subscribeState(() => updateWeb3UI());
  appKit.subscribeAccount(() => ensureBscNetwork().catch(() => {}));
  updateWeb3UI();
  return true;
}

function closeWalletPicker() {
  const existing = document.getElementById("w3WalletPickerOverlay");
  if (existing) existing.remove();
}

async function connectSpecificProvider(provider, label, info = null) {
  closeWalletPicker();
  try {
    setWeb3Status("loading", `🔗 Connecting ${label}...`);
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    selectedProvider = provider;
    selectedAccount = accounts?.[0] || "";
    selectedWalletName = label;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          name: label,
          rdns: info?.rdns || "",
          isLegacy: !info
        })
      );
    } catch {}
    await ensureBscNetwork();
    setWeb3Status("", "");
    updateWeb3UI();
  } catch (err) {
    setWeb3Status("error", `❌ ${err?.message || "Wallet connection cancelled."}`);
  }
}

function openFallbackWalletPicker() {
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  closeWalletPicker();

  const announced = Array.from(discoveredProviders.values());
  const overlay = document.createElement("div");
  overlay.id = "w3WalletPickerOverlay";
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,0.65);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;";

  const card = document.createElement("div");
  card.style.cssText =
    "width:100%;max-width:400px;background:#fff;border-radius:18px;padding:20px;box-shadow:0 24px 60px rgba(0,0,0,0.3);font-family:inherit;max-height:85vh;overflow-y:auto;";

  card.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div>
        <div style="font-size:16px;font-weight:800;color:#111827;">Connect Wallet</div>
        <div style="font-size:12px;color:#6b7280;">Choose your Web3 wallet (BNB Smart Chain)</div>
      </div>
      <button type="button" id="w3ClosePicker" style="border:none;background:#f3f4f6;width:30px;height:30px;border-radius:999px;cursor:pointer;font-weight:700;color:#374151;">✕</button>
    </div>
    <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Popular Wallets</div>
    <div id="w3PopularList" style="display:grid;gap:8px;margin-bottom:14px;"></div>
    <div id="w3OtherWrap" style="display:none;">
      <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin:12px 0 8px;">Other Detected Wallets</div>
      <div id="w3OtherList" style="display:grid;gap:8px;"></div>
    </div>
    <div style="margin-top:12px;padding:10px 12px;border-radius:10px;background:#fffbeb;border:1px solid #fde68a;font-size:11px;color:#92400e;">
      💡 For mobile QR &amp; 300+ WalletConnect wallets, add <strong>REOWN_PROJECT_ID</strong> in Cloudflare Environment Variables.
    </div>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeWalletPicker(); });
  card.querySelector("#w3ClosePicker").addEventListener("click", closeWalletPicker);

  const popularList = card.querySelector("#w3PopularList");
  const usedUuids = new Set();

  POPULAR_WALLETS.forEach((pw) => {
    const found = announced.find((d) =>
      String(d.info?.name || "").toLowerCase().includes(pw.match) ||
      String(d.info?.rdns || "").toLowerCase().includes(pw.match)
    );
    if (found) usedUuids.add(found.info.uuid);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.style.cssText =
      "display:flex;align-items:center;gap:10px;width:100%;padding:11px 12px;border:1.5px solid #e5e7eb;border-radius:12px;background:#fff;cursor:pointer;text-align:left;transition:border-color .15s;";
    btn.innerHTML = `
      ${found?.info?.icon
        ? `<img src="${found.info.icon}" alt="${pw.name}" style="width:28px;height:28px;border-radius:8px;object-fit:contain;">`
        : `<span style="font-size:22px;width:28px;text-align:center;">${pw.icon}</span>`}
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;color:#111827;">${found?.info?.name || pw.name}</div>
        <div style="font-size:11px;color:${found ? "#059669" : "#9ca3af"};">${found ? "Installed • Click to connect" : "Not installed • Click to get"}</div>
      </div>
      <span style="font-size:11px;font-weight:700;padding:4px 8px;border-radius:999px;background:${found ? "#ecfdf5" : "#f3f4f6"};color:${found ? "#047857" : "#6b7280"};">${found ? "Connect" : "Install"}</span>
    `;
    btn.addEventListener("click", () => {
      if (found) {
        connectSpecificProvider(found.provider, found.info.name || pw.name, found.info);
      } else {
        window.open(pw.url, "_blank", "noopener,noreferrer");
      }
    });
    popularList.appendChild(btn);
  });

  // Any other EIP-6963 wallets (Rabby, Brave, Bitget, Phantom, etc.)
  const others = announced.filter((d) => !usedUuids.has(d.info.uuid));
  if (others.length > 0) {
    card.querySelector("#w3OtherWrap").style.display = "block";
    const otherList = card.querySelector("#w3OtherList");
    others.forEach((d) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.style.cssText =
        "display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:12px;background:#fff;cursor:pointer;text-align:left;";
      btn.innerHTML = `
        <img src="${d.info.icon || ""}" alt="" style="width:26px;height:26px;border-radius:8px;object-fit:contain;">
        <div style="flex:1;font-size:13px;font-weight:700;color:#111827;">${d.info.name}</div>
        <span style="font-size:11px;font-weight:700;padding:4px 8px;border-radius:999px;background:#ecfdf5;color:#047857;">Connect</span>
      `;
      btn.addEventListener("click", () => connectSpecificProvider(d.provider, d.info.name, d.info));
      otherList.appendChild(btn);
    });
  } else if (announced.length === 0 && window.ethereum) {
    // Legacy injected provider if browser wallet doesn't support EIP-6963
    card.querySelector("#w3OtherWrap").style.display = "block";
    const otherList = card.querySelector("#w3OtherList");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.style.cssText =
      "display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:12px;background:#fff;cursor:pointer;text-align:left;";
    btn.innerHTML = `
      <span style="font-size:22px;width:26px;text-align:center;">🔌</span>
      <div style="flex:1;font-size:13px;font-weight:700;color:#111827;">Browser Default Wallet</div>
      <span style="font-size:11px;font-weight:700;padding:4px 8px;border-radius:999px;background:#ecfdf5;color:#047857;">Connect</span>
    `;
    btn.addEventListener("click", () => connectSpecificProvider(window.ethereum, "Browser Wallet"));
    otherList.appendChild(btn);
  }
}

async function openModal() {
  if (!appKit) {
    const projectId = window.web3Config?.reown_project_id || "";
    init(projectId);
  }
  if (appKit) {
    await appKit.open();
    return;
  }
  openFallbackWalletPicker();
}

async function ensureBscNetwork() {
  if (!isWalletConnected()) return false;

  if (appKit) {
    const currentChainId = Number(appKit.getChainId());
    if (currentChainId === BSC_CHAIN_ID) return true;

    setWeb3Status("loading", "🔄 Switching wallet network to BNB Smart Chain (BSC Mainnet)...");
    await appKit.switchNetwork(bsc);

    const updatedChainId = Number(appKit.getChainId());
    if (updatedChainId !== BSC_CHAIN_ID) {
      throw new Error("Please switch your wallet network to BNB Smart Chain (Chain ID 56).");
    }
    setWeb3Status("", "");
    return true;
  }

  const provider = selectedProvider || window.ethereum;
  if (provider) {
    const chainHex = await provider.request({ method: "eth_chainId" });
    if (parseInt(chainHex, 16) === BSC_CHAIN_ID) return true;

    setWeb3Status("loading", "🔄 Switching wallet network to BNB Smart Chain (BSC Mainnet)...");
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BSC_CHAIN_HEX }]
      });
    } catch (switchErr) {
      if (switchErr?.code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: BSC_CHAIN_HEX,
            chainName: "BNB Smart Chain Mainnet",
            nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
            rpcUrls: ["https://bsc-dataseed.binance.org/"],
            blockExplorerUrls: ["https://bscscan.com"]
          }]
        });
      } else {
        throw switchErr;
      }
    }
    setWeb3Status("", "");
    return true;
  }

  return false;
}

async function verifyTxWithRetry(invoiceId, txHash, expectedAmountUsdt, maxAttempts = 20) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch("/api/verify-tx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId, txHash, expectedAmountUsdt })
    });
    const data = await res.json();

    if (res.status === 202 && data.pending) {
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    if (!res.ok || !data.success) {
      throw new Error(data.error || "On-chain verification failed.");
    }
    return data;
  }
  throw new Error("Verification timed out. Please save your TxHash and contact support.");
}

async function payInvoice({ invoiceId, amountUsdt, merchantWallet, tokenContract, tokenDecimals, onVerified }) {
  if (!isWalletConnected()) {
    await openModal();
    return;
  }

  isProcessing = true;
  updateWeb3UI();

  try {
    await ensureBscNetwork();

    const walletProvider = appKit?.getWalletProvider?.() || selectedProvider || window.ethereum;
    if (!walletProvider) {
      throw new Error("Wallet provider unavailable. Please reconnect your wallet.");
    }

    const provider = new ethers.BrowserProvider(walletProvider);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== BSC_CHAIN_ID) {
      throw new Error("Wrong network detected. Please switch to BNB Smart Chain (56).");
    }

    const signer = await provider.getSigner();
    const contractAddr = tokenContract || DEFAULT_USDT_CONTRACT;
    const decimals = Number(tokenDecimals || DEFAULT_DECIMALS);

    const usdt = new ethers.Contract(contractAddr, ERC20_TRANSFER_ABI, signer);
    const amountInWei = ethers.parseUnits(String(amountUsdt), decimals);

    // Pre-check USDT balance so user gets a clear message instead of "missing revert data"
    try {
      const userAddr = await signer.getAddress();
      const balWei = await usdt.balanceOf(userAddr);
      if (balWei < amountInWei) {
        const formattedBal = Number(ethers.formatUnits(balWei, decimals)).toFixed(2);
        throw new Error(
          `Insufficient USDT balance on BSC (BEP-20). You have ${formattedBal} USDT, need ${amountUsdt} USDT.`
        );
      }
    } catch (balErr) {
      if (String(balErr?.message || "").includes("Insufficient USDT balance")) {
        throw balErr;
      }
    }

    setWeb3Status("loading", "🦊 Please confirm the USDT transfer in your wallet...");
    const tx = await usdt.transfer(merchantWallet, amountInWei);

    setWeb3Status(
      "loading",
      `⏳ Verifying Payment on BSC... (Tx: ${shortAddr(tx.hash)})`
    );

    const verified = await verifyTxWithRetry(invoiceId, tx.hash, amountUsdt);

    setWeb3Status("success", "✅ Payment verified on BSC! Placing your order...");
    if (typeof onVerified === "function") {
      onVerified(verified.txHash, amountUsdt, invoiceId);
    }
  } catch (err) {
    let msg = err?.shortMessage || err?.reason || err?.message || "Payment failed.";
    if (String(msg).toLowerCase().includes("missing revert data")) {
      msg = "Transaction would fail on-chain (likely insufficient USDT or BNB gas on BSC Mainnet).";
    }
    setWeb3Status("error", `❌ ${msg}`);
  } finally {
    isProcessing = false;
    updateWeb3UI();
  }
}

window.Web3Checkout = {
  init,
  openModal,
  payInvoice,
  updateWeb3UI
};
