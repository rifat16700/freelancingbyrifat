import { createAppKit } from "@reown/appkit";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { bsc } from "@reown/appkit/networks";
import { ethers } from "ethers";

const BSC_CHAIN_ID = 56;
const BSC_CHAIN_HEX = "0x38";
const DEFAULT_USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";
const DEFAULT_DECIMALS = 18;
const ERC20_TRANSFER_ABI = [
  "function transfer(address to, uint256 value) returns (bool)"
];

let appKit = null;
let initializedProjectId = "";
let fallbackAccount = "";
let isProcessing = false;

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
  return Boolean(appKit?.getIsConnected?.() || fallbackAccount);
}

function getConnectedAddress() {
  return appKit?.getAddress?.() || fallbackAccount || "";
}

function updateWeb3UI() {
  const connectBtn = document.getElementById("web3ConnectBtn");
  const payBtn = document.getElementById("web3PayBtn");
  const walletLabel = document.getElementById("web3ConnectedAddr");
  const connected = isWalletConnected();
  const address = getConnectedAddress();

  if (walletLabel) {
    walletLabel.textContent = connected ? shortAddr(address) : "Not connected";
  }
  if (connectBtn) {
    connectBtn.disabled = isProcessing;
    connectBtn.textContent = connected
      ? `✅ ${shortAddr(address)} (Switch / Disconnect)`
      : "🔗 Connect Wallet (MetaMask / Trust / Binance)";
  }
  if (payBtn) {
    payBtn.disabled = isProcessing || !connected;
  }
}

function init(projectId) {
  if (!projectId) {
    // Allow injected wallet (MetaMask / Trust Wallet / Binance extension) even before REOWN_PROJECT_ID is set
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

async function openModal() {
  if (!appKit) {
    const projectId = window.web3Config?.reown_project_id || "";
    init(projectId);
  }
  if (appKit) {
    await appKit.open();
    return;
  }

  // Fallback to injected EIP-1193 provider (MetaMask, Trust Wallet, Binance Web3 extension)
  if (window.ethereum) {
    try {
      setWeb3Status("loading", "🔗 Connecting browser wallet...");
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      fallbackAccount = accounts?.[0] || "";
      await ensureBscNetwork();
      setWeb3Status("", "");
      updateWeb3UI();
    } catch (err) {
      setWeb3Status("error", `❌ ${err?.message || "Wallet connection cancelled."}`);
    }
    return;
  }

  setWeb3Status(
    "error",
    "❌ No browser wallet detected and REOWN_PROJECT_ID is not set in Cloudflare for WalletConnect QR."
  );
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

  if (window.ethereum) {
    const chainHex = await window.ethereum.request({ method: "eth_chainId" });
    if (parseInt(chainHex, 16) === BSC_CHAIN_ID) return true;

    setWeb3Status("loading", "🔄 Switching wallet network to BNB Smart Chain (BSC Mainnet)...");
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BSC_CHAIN_HEX }]
      });
    } catch (switchErr) {
      if (switchErr?.code === 4902) {
        await window.ethereum.request({
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

    const walletProvider = appKit?.getWalletProvider?.() || window.ethereum;
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
    const msg = err?.shortMessage || err?.reason || err?.message || "Payment failed.";
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
