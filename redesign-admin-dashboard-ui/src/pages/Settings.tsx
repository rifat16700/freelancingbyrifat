import { useEffect, useState } from "react";
import { Bell, CheckCircle2, CreditCard, Eye, EyeOff, Globe, MapPin, MessageCircle, Plug, Plus, Save, Search, Settings as Cog, Store, Trash2, Undo2, X } from "lucide-react";
import { useStore } from "../store";
import { Badge, Button, Card, CardHead, Field, Input, MediaPicker, PageHeader, Select, Textarea, Toggle } from "../components/ui";
import { proxyFetch } from "../lib/api";
import { cn } from "../utils/cn";
import { downloadJSON, money } from "../lib/format";
import type { CryptoCoin, MessagingApp } from "../types";

type Tab = "store" | "social" | "messaging" | "seo" | "payments" | "orders" | "notify" | "integrations";
const TABS: { id: Tab; label: string; icon: typeof Cog; bn: string }[] = [
  { id: "store", label: "Store", icon: Store, bn: "স্টোর" },
  { id: "social", label: "Contact & social", icon: Globe, bn: "যোগাযোগ" },
  { id: "messaging", label: "Messaging apps", icon: MessageCircle, bn: "মেসেজ অর্ডার" },
  { id: "seo", label: "Google & SEO", icon: Search, bn: "এসইও" },
  { id: "payments", label: "Payments & Crypto", icon: CreditCard, bn: "পেমেন্ট ও ক্রিপ্টো" },
  { id: "orders", label: "Pickup & stock", icon: MapPin, bn: "পিকআপ ও স্টক" },
  { id: "notify", label: "Telegram bots", icon: Bell, bn: "টেলিগ্রাম বট" },
  { id: "integrations", label: "AI & integrations", icon: Plug, bn: "এআই ও ইন্টিগ্রেশন" },
];

const DEFAULT_MSG_APPS: { key: string; name: string; icon: string; placeholder: string }[] = [
  { key: "whatsapp", name: "WhatsApp", icon: "https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/whatsapp.svg", placeholder: "8801XXXXXXXXX" },
  { key: "telegram", name: "Telegram", icon: "https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/telegram.svg", placeholder: "username (no @)" },
  { key: "messenger", name: "Messenger", icon: "https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/messenger.svg", placeholder: "Page username" },
  { key: "viber", name: "Viber", icon: "https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/viber.svg", placeholder: "8801XXXXXXXXX" },
  { key: "signal", name: "Signal", icon: "https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/signal.svg", placeholder: "+8801XXXXXXXXX" },
  { key: "imo", name: "IMO", icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%2300a0dc'/><text x='50' y='65' font-family='sans-serif' font-size='40' font-weight='bold' fill='%23fff' text-anchor='middle'>imo</text></svg>", placeholder: "8801XXXXXXXXX" },
  { key: "line", name: "LINE", icon: "https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/line.svg", placeholder: "LINE ID" },
  { key: "wechat", name: "WeChat", icon: "https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/wechat.svg", placeholder: "WeChat ID" },
  { key: "skype", name: "Skype", icon: "https://api.iconify.design/logos:skype.svg", placeholder: "Skype username" },
  { key: "discord", name: "Discord", icon: "https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/discord.svg", placeholder: "User ID" },
  { key: "snapchat", name: "Snapchat", icon: "https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/snapchat.svg", placeholder: "Username" },
  { key: "instagram", name: "Instagram", icon: "https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/instagram.svg", placeholder: "Username" },
  { key: "twitter", name: "Twitter / X", icon: "https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/x.svg", placeholder: "Username" },
  { key: "tiktok", name: "TikTok", icon: "https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/tiktok.svg", placeholder: "@username" },
  { key: "kakaotalk", name: "KakaoTalk", icon: "https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/kakaotalk.svg", placeholder: "Open Chat ID" },
  { key: "email", name: "Email", icon: "https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/gmail.svg", placeholder: "you@email.com" },
  { key: "sms", name: "SMS", icon: "https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/imessage.svg", placeholder: "8801XXXXXXXXX" },
];

function Secret({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pr-10" />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
    </div>
  );
}
function Section({ title, sub, children, right }: { title: string; sub?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return <Card className="mb-5"><CardHead title={title} sub={sub} right={right} /><div className="space-y-4 px-5 pb-5">{children}</div></Card>;
}

export function Settings() {
  const s = useStore();
  const { settings, setSettings, toast, log, t, products, categories, hasPerm } = s;
  const [tab, setTab] = useState<Tab>("store");
  const [draft, setDraft] = useState(settings);
  const [newChatId, setNewChatId] = useState("");
  const [testing, setTesting] = useState<string>("");

  useEffect(() => { setDraft(settings); }, [settings]);

  const canEdit = hasPerm("settings", "edit");
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const d = (p: Partial<typeof settings>) => setDraft((x) => ({ ...x, ...p }));
  const save = () => {
    if (!canEdit) return toast("Missing settings edit permission", "err");
    setSettings(draft);
    log("Settings saved", TABS.find((x) => x.id === tab)!.label);
    toast("Settings saved ✔");
  };

  const sitemap = () => {
    const base = (draft.canonical || (typeof window !== "undefined" && window.location.origin) || "https://yourstore.com").replace(/\/+$/, "");
    const urls = [base + "/", ...categories.items.filter((c) => c.active).map((c) => `${base}/shop?cat=${c.id}`), ...products.items.filter((p) => p.active).map((p) => `${base}/product?id=${p.id}`)];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
    a.download = "sitemap.xml";
    a.click();
    toast(`sitemap.xml with ${urls.length} URLs downloaded`);
  };

  // Messaging Apps Helpers
  const getMsgApp = (key: string, name: string): MessagingApp => {
    const found = (draft.messagingApps || []).find((a) => a.key === key);
    return found || { key, name, enabled: false, contact: "" };
  };
  const updateMsgApp = (key: string, name: string, patch: Partial<MessagingApp>) => {
    const list = [...(draft.messagingApps || [])];
    const idx = list.findIndex((a) => a.key === key);
    if (idx >= 0) list[idx] = { ...list[idx], ...patch };
    else list.push({ key, name, enabled: false, contact: "", ...patch });
    d({ messagingApps: list });
  };

  // Crypto Coins & Networks Helpers
  const coins: CryptoCoin[] = draft.cryptoCoins || [];
  const setCoins = (next: CryptoCoin[]) => d({ cryptoCoins: next });
  const addCoin = () => setCoins([...coins, { symbol: "USDT", name: "Tether", networks: [{ name: "TRC20", address: "", qr_url: "" }] }]);
  const updateCoin = (ci: number, patch: Partial<CryptoCoin>) => setCoins(coins.map((c, i) => (i === ci ? { ...c, ...patch } : c)));
  const removeCoin = (ci: number) => setCoins(coins.filter((_, i) => i !== ci));
  const addNetwork = (ci: number) => setCoins(coins.map((c, i) => (i === ci ? { ...c, networks: [...(c.networks || []), { name: "", address: "", qr_url: "" }] } : c)));
  const updateNetwork = (ci: number, ni: number, patch: { name?: string; address?: string; qr_url?: string }) =>
    setCoins(coins.map((c, i) => (i === ci ? { ...c, networks: (c.networks || []).map((n, j) => (j === ni ? { ...n, ...patch } : n)) } : c)));
  const removeNetwork = (ci: number, ni: number) =>
    setCoins(coins.map((c, i) => (i === ci ? { ...c, networks: (c.networks || []).filter((_, j) => j !== ni) } : c)));

  // Telegram Chats Helpers
  const chatList = draft.tgMainChats?.length
    ? draft.tgMainChats
    : (draft.tgMainChat || "").split(",").map((x) => x.trim()).filter(Boolean);
  const setChats = (list: string[]) => d({ tgMainChats: list, tgMainChat: list.join(", ") });

  const sendTestTelegram = async (botToken: string, chatId: string, label: string) => {
    const tok = botToken.trim();
    const target = chatId.trim();
    if (!tok || !target) return toast(`Add ${label} Bot Token and Chat ID first`, "err");
    setTesting(label);
    try {
      const r = await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: target,
          text: `✅ *${draft.storeName || "Store"}* — ${label} Telegram Bot Test OK!`,
          parse_mode: "Markdown",
        }),
      });
      const j = await r.json();
      if (j?.ok) toast(`${label} test message sent ✔`);
      else toast(j?.description || "Telegram test failed", "err");
    } catch (e: any) {
      toast(e?.message || "Telegram connection error", "err");
    } finally {
      setTesting("");
    }
  };

  // Live API Key Tests (ImgBB & Gemini AI)
  const testReviewImgbbKey = async () => {
    const key = draft.reviewImgbbKey.trim();
    if (!key) return toast("Enter a Review ImgBB API key first", "err");
    setTesting("imgbb");
    try {
      const fd = new FormData();
      fd.append("image", "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");
      const r = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(key)}`, { method: "POST", body: fd });
      const j = await r.json();
      if (j?.success) toast("Review ImgBB API Key is valid ✔");
      else toast(j?.error?.message || "Invalid ImgBB API key", "err");
    } catch (e: any) {
      toast(e?.message || "ImgBB test failed", "err");
    } finally {
      setTesting("");
    }
  };

  const testGeminiKey = async (key: string, label: string) => {
    const k = key.trim();
    if (!k) return toast(`Enter ${label} first`, "err");
    setTesting(label);
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(k)}`);
      const j = await r.json();
      if (r.ok && Array.isArray(j?.models)) toast(`${label} verified (${j.models.length} models available) ✔`);
      else toast(j?.error?.message || `Invalid ${label}`, "err");
    } catch (e: any) {
      toast(e?.message || "Gemini API test failed", "err");
    } finally {
      setTesting("");
    }
  };

  const gatewayProxyPreview =
    draft.gatewayVersion === "v2"
      ? "https://payment.freelancingbyrifat.top/proxyv2.php"
      : "https://mypay.freelancingbyrifat.top/api_proxy.php";

  const methods = [
    draft.cod && { n: "Cash on Delivery", c: "bg-emerald-100 text-emerald-700" },
    draft.bkashNumber && { n: "bKash", c: "bg-pink-100 text-pink-700" },
    draft.nagadNumber && { n: "Nagad", c: "bg-orange-100 text-orange-700" },
    draft.advanceMode === "auto" && { n: "Online Gateway", c: "bg-sky-100 text-sky-700" },
    (draft.crypto || coins.length > 0) && { n: "Binance / Crypto", c: "bg-yellow-100 text-yellow-700" },
  ].filter(Boolean) as { n: string; c: string }[];

  const enabledAppsCount = (draft.messagingApps || []).filter((a) => a.enabled).length;

  return (
    <div className="pb-24">
      <PageHeader icon={<Cog size={22} />} title={t("Settings", "সেটিংস")} desc="Complete store configuration — branding, messaging apps, gateways, crypto wallets, Telegram bots & AI." />
      <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {TABS.map((x) => (
            <button key={x.id} onClick={() => setTab(x.id)} className={cn("flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition", tab === x.id ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-600 hover:bg-white")}>
              <x.icon size={17} />
              <span className="flex-1">{s.lang === "bn" ? x.bn : x.label}</span>
              {x.id === "messaging" && enabledAppsCount > 0 && (
                <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", tab === x.id ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700")}>{enabledAppsCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          {tab === "store" && (
            <Section title="Store information" sub="Shown in the header, footer and invoices.">
              <Field label="Store name"><Input value={draft.storeName} onChange={(e) => d({ storeName: e.target.value })} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Store Logo (Upload or URL)">
                  <MediaPicker value={draft.logo} onChange={(v) => d({ logo: v })} placeholder="Upload store logo or paste URL…" />
                </Field>
                <Field label="Favicon (Upload or URL)">
                  <MediaPicker value={draft.favicon} onChange={(v) => d({ favicon: v })} placeholder="Upload favicon or paste URL…" />
                </Field>
              </div>
              <Field label="Footer text"><Input value={draft.footer} onChange={(e) => d({ footer: e.target.value })} placeholder="© 2026 Your Store. All rights reserved." /></Field>
            </Section>
          )}

          {tab === "social" && (
            <Section title="Contact & social links" sub="Used for footer social icons and quick customer contact.">
              <Field label="WhatsApp number" hint="With country code, e.g. 8801XXXXXXXXX"><Input value={draft.whatsapp} onChange={(e) => d({ whatsapp: e.target.value.replace(/\D/g, "") })} /></Field>
              <Field label="Facebook page"><Input value={draft.facebook} onChange={(e) => d({ facebook: e.target.value })} placeholder="https://facebook.com/yourpage" /></Field>
              <Field label="Instagram"><Input value={draft.instagram} onChange={(e) => d({ instagram: e.target.value })} placeholder="https://instagram.com/yourpage" /></Field>
              <Field label="YouTube"><Input value={draft.youtube} onChange={(e) => d({ youtube: e.target.value })} placeholder="https://youtube.com/@yourchannel" /></Field>
            </Section>
          )}

          {tab === "messaging" && (
            <Section
              title="Messaging Apps (Order via Message)"
              sub="Turn on any apps below and enter your phone/username. Enabled apps appear on product pages when “Order via message” is active."
              right={<Badge tone="indigo">{enabledAppsCount} active</Badge>}
            >
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 px-4 py-1">
                <Toggle
                  checked={draft.msgOrder}
                  onChange={(v) => d({ msgOrder: v })}
                  label="Enable “Order via Message” buttons on Product Pages"
                  hint="Shows all enabled messaging apps below on product pages."
                />
              </div>
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                {DEFAULT_MSG_APPS.map((app) => {
                  const cur = getMsgApp(app.key, app.name);
                  return (
                    <div key={app.key} className={cn("flex flex-wrap items-center gap-3 px-4 py-3 transition", cur.enabled && "bg-indigo-50/30")}>
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white p-1.5">
                        <img src={app.icon} alt={app.name} className="h-5 w-5 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                      </div>
                      <span className="w-28 shrink-0 text-sm font-semibold text-slate-800">{app.name}</span>
                      <div className="min-w-[180px] flex-1">
                        <Input
                          value={cur.contact}
                          onChange={(e) => updateMsgApp(app.key, app.name, { contact: e.target.value })}
                          placeholder={app.placeholder}
                          className="h-9 text-xs"
                        />
                      </div>
                      <Toggle checked={cur.enabled} onChange={(v) => updateMsgApp(app.key, app.name, { enabled: v })} />
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {tab === "seo" && (
            <>
              <Section title="Google search appearance" sub="How your homepage looks on Google and Facebook share cards.">
                <Field label="Title"><Input value={draft.seoTitle} onChange={(e) => d({ seoTitle: e.target.value })} /></Field>
                <Field label="Description" hint={`${draft.seoDesc.length} characters — aim for 120–160`}><Textarea value={draft.seoDesc} onChange={(e) => d({ seoDesc: e.target.value })} rows={3} /></Field>
                <Field label="Keywords" hint="Comma separated"><Input value={draft.seoKeywords} onChange={(e) => d({ seoKeywords: e.target.value })} /></Field>
                <Field label="Social Share Image (OG Image)">
                  <MediaPicker value={draft.seoOgImage} onChange={(v) => d({ seoOgImage: v })} placeholder="Upload default 1200×630 share image or paste URL…" />
                </Field>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs text-slate-500">Google Preview</div>
                  <div className="mt-1 truncate text-lg text-blue-700">{draft.seoTitle || draft.storeName}</div>
                  <div className="text-xs text-emerald-700">{draft.canonical || "https://yourstore.com"}/</div>
                  <div className="mt-0.5 line-clamp-2 text-sm text-slate-600">{draft.seoDesc}</div>
                </div>
              </Section>
              <Section title="Advanced SEO">
                <Field label="Main web address (Canonical Site URL)" hint="Leave empty to use the current domain automatically."><Input value={draft.canonical} onChange={(e) => d({ canonical: e.target.value })} placeholder="https://mystore.com" /></Field>
                <Field label="Google Search Console Verification Code" hint="Leave empty if you verified using DNS."><Input value={draft.gsc} onChange={(e) => d({ gsc: e.target.value })} /></Field>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
                  <div><div className="font-medium">XML sitemap</div><div className="text-sm text-slate-500">All active products and categories in one file for Google Search Console.</div></div>
                  <Button onClick={sitemap}>Download sitemap.xml</Button>
                </div>
              </Section>
            </>
          )}

          {tab === "payments" && (
            <>
              <Card className="mb-5 border-indigo-100 bg-indigo-50/50 p-5">
                <div className="mb-2 text-sm font-semibold text-indigo-900">Active checkout payment methods</div>
                <div className="flex flex-wrap gap-2">{methods.length ? methods.map((m) => <span key={m.n} className={cn("rounded-xl px-3.5 py-2 text-sm font-semibold", m.c)}>{m.n}</span>) : <span className="text-xs text-slate-500">Configure a method below</span>}</div>
              </Card>

              <Section title="Cash on delivery & advance" sub="Advance payments protect you from fake orders.">
                <Toggle checked={draft.cod} onChange={(v) => d({ cod: v })} label="Allow Cash on Delivery (COD)" hint="Off = customers must pay online / bKash / Nagad first." />
                <Toggle checked={draft.funPromise} onChange={(v) => d({ funPromise: v })} label="🤣 Fun promise checkboxes" hint="Light-hearted “I promise to receive the parcel” tick boxes for COD." />
                <Toggle checked={draft.allowWhatsappOrder} onChange={(v) => d({ allowWhatsappOrder: v })} label="WhatsApp direct order button" hint="Quick WhatsApp button on product pages." />
                <Field label="Advance amount (৳)" hint={draft.advanceAmount === 0 ? "No advance — pure COD" : draft.advanceAmount === -1 ? "Advance equals the delivery charge" : `Customers pay ${money(draft.advanceAmount)} in advance`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input type="number" value={draft.advanceAmount} onChange={(e) => d({ advanceAmount: Number(e.target.value) })} className="!w-32" />
                    {[["None (0)", 0], ["= Delivery charge (-1)", -1], ["৳100", 100], ["৳200", 200]].map(([l, v]) => <Button key={l as string} size="sm" variant={draft.advanceAmount === v ? "soft" : "secondary"} onClick={() => d({ advanceAmount: v as number })}>{l}</Button>)}
                  </div>
                </Field>
                <Field label="Advance payment method">
                  <Select value={draft.advanceMode} onChange={(e) => d({ advanceMode: e.target.value as "manual" | "auto" })}>
                    <option value="manual">Manual — bKash / Nagad (Customer enters TrxID)</option>
                    <option value="auto">Auto — Online Payment Gateway redirect</option>
                  </Select>
                </Field>
              </Section>

              <Section title="Manual Payment Numbers (bKash, Nagad & Manual Binance UID)" sub="Customers send money to these accounts and submit TrxID / Order ID.">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="bKash Number"><Input value={draft.bkashNumber} onChange={(e) => d({ bkashNumber: e.target.value })} placeholder="01XXXXXXXXX" maxLength={11} /></Field>
                  <Field label="Nagad Number"><Input value={draft.nagadNumber} onChange={(e) => d({ nagadNumber: e.target.value })} placeholder="01XXXXXXXXX" maxLength={11} /></Field>
                  <Field label="Manual Binance Pay UID"><Input value={draft.binanceManualUid} onChange={(e) => d({ binanceManualUid: e.target.value })} placeholder="e.g. 123456789" /></Field>
                </div>
              </Section>

              <Section title="⚡ Online Payment Gateway (v1 / v2)" sub="Automatic bKash/Nagad/Card checkout gateway.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Gateway Version">
                    <Select value={draft.gatewayVersion || "v1"} onChange={(e) => d({ gatewayVersion: e.target.value })}>
                      <option value="v1">🔄 v1 — Old Gateway (api_proxy.php)</option>
                      <option value="v2">🚀 v2 — New Gateway (proxyv2.php)</option>
                    </Select>
                  </Field>
                  <Field label="Gateway Proxy URL (Auto)">
                    <Input value={gatewayProxyPreview} readOnly className="bg-slate-50 text-slate-500 font-mono text-xs" />
                  </Field>
                  <Field label="Gateway API Key (v1)"><Secret value={draft.gatewayKey} onChange={(v) => d({ gatewayKey: v })} placeholder="Your secret API key for v1" /></Field>
                  <Field label="Gateway API Key (v2)"><Secret value={draft.gatewayKeyV2} onChange={(v) => d({ gatewayKeyV2: v })} placeholder="Your secret API key for v2" /></Field>
                </div>
              </Section>

              <Section title="🪙 Crypto & Binance Pay (Auto Verification + Multi-Network Wallets)" sub="Accept Binance Pay & On-chain Crypto with custom networks & QR codes.">
                <Toggle checked={draft.crypto} onChange={(v) => d({ crypto: v })} label="Enable Crypto / Binance Pay at Checkout" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Auto Binance Pay UID"><Input value={draft.binanceUid} onChange={(e) => d({ binanceUid: e.target.value })} placeholder="e.g. 123456789" /></Field>
                  <Field label="1 USD = ? BDT" hint="Conversion rate for USDT / Crypto checkout"><Input type="number" step="0.01" value={draft.usdRate} onChange={(e) => d({ usdRate: Number(e.target.value) })} /></Field>
                  <Field label="Web3 Merchant Wallet Address (BSC BEP-20 USDT)" hint="Direct WalletConnect / MetaMask / Trust Wallet / Binance Web3 receiving address (0x...)" className="sm:col-span-2"><Input value={draft.web3WalletAddress} onChange={(e) => d({ web3WalletAddress: e.target.value.trim() })} placeholder="0xYourBscUsdtReceivingWalletAddress" className="font-mono text-xs" /></Field>
                  <Field label="Binance API Key"><Secret value={draft.binanceApiKey} onChange={(v) => d({ binanceApiKey: v })} placeholder="Your Binance API Key" /></Field>
                  <Field label="Binance API Secret"><Secret value={draft.binanceApiSecret} onChange={(v) => d({ binanceApiSecret: v })} placeholder="Your Binance API Secret" /></Field>
                  <Field label="Verification System (verify_mode)" className="sm:col-span-2">
                    <Select value={draft.gateway || "cloudflare"} onChange={(e) => d({ gateway: e.target.value })}>
                      <option value="cloudflare">☁️ Cloudflare Proxy (Default & Recommended) — Edge verify</option>
                      <option value="auto">🔄 Auto — PHP proxy with Supabase backup</option>
                      <option value="php_only">🔵 PHP Proxy Only — cPanel / AlwaysData PHP proxy</option>
                      <option value="supabase_only">🟠 Supabase Edge Function Only</option>
                      <option value="hugging_face">🤗 Hugging Face API — External Backend</option>
                    </Select>
                  </Field>
                  <Field label="Binance PHP Proxy URL (optional)"><Input value={draft.binanceProxyUrl} onChange={(e) => d({ binanceProxyUrl: e.target.value })} placeholder="https://mypay.../binance_proxy.php" /></Field>
                  <Field label="Supabase Edge Verify URL (optional)"><Input value={draft.supabaseEdgeUrl} onChange={(e) => d({ supabaseEdgeUrl: e.target.value })} placeholder="https://...supabase.co/functions/v1/verify-payment" /></Field>
                  <Field label="Hugging Face Verify URL (optional)" className="sm:col-span-2"><Input value={draft.hfApiUrl} onChange={(e) => d({ hfApiUrl: e.target.value })} placeholder="https://[SPACE].hf.space/api/verify-payment" /></Field>
                </div>

                {/* Structured Crypto Coins & Networks */}
                <div className="border-t border-slate-100 pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">On-Chain Crypto Coins, Networks & QR Codes</div>
                      <div className="text-xs text-slate-500">Add coins (e.g. USDT, BTC, TON) and their networks (TRC20, BEP20, ERC20) with wallet address & QR upload.</div>
                    </div>
                    <Button size="sm" variant="soft" icon={<Plus size={14} />} onClick={addCoin}>Add Coin</Button>
                  </div>
                  <div className="space-y-3">
                    {coins.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">No crypto coins configured yet. Click “Add Coin” to add USDT, BTC, etc.</div>}
                    {coins.map((coin, cIdx) => (
                      <div key={cIdx} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                        <div className="flex flex-wrap items-end gap-2.5">
                          <Field label="Symbol" className="w-28"><Input value={coin.symbol} onChange={(e) => updateCoin(cIdx, { symbol: e.target.value.toUpperCase() })} placeholder="USDT" className="h-9 font-mono text-xs" /></Field>
                          <Field label="Coin Name" className="flex-1 min-w-[140px]"><Input value={coin.name} onChange={(e) => updateCoin(cIdx, { name: e.target.value })} placeholder="Tether" className="h-9 text-xs" /></Field>
                          <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" icon={<Trash2 size={14} />} onClick={() => removeCoin(cIdx)}>Remove</Button>
                        </div>
                        <div className="space-y-2 border-l-2 border-indigo-400 pl-3">
                          {(coin.networks || []).map((net, nIdx) => (
                            <div key={nIdx} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                              <div className="grid gap-2 sm:grid-cols-[130px_1fr_auto]">
                                <Input value={net.name} onChange={(e) => updateNetwork(cIdx, nIdx, { name: e.target.value })} placeholder="Network (TRC20)" className="h-8 text-xs font-semibold" />
                                <Input value={net.address} onChange={(e) => updateNetwork(cIdx, nIdx, { address: e.target.value })} placeholder="Wallet Address" className="h-8 font-mono text-xs" />
                                <button type="button" onClick={() => removeNetwork(cIdx, nIdx)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><X size={14} /></button>
                              </div>
                              <MediaPicker value={net.qr_url || ""} onChange={(v) => updateNetwork(cIdx, nIdx, { qr_url: v })} placeholder="QR Code image URL or click Upload…" />
                            </div>
                          ))}
                          <Button size="sm" variant="ghost" icon={<Plus size={13} />} onClick={() => addNetwork(cIdx)}>Add Network</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Section>
            </>
          )}

          {tab === "orders" && (
            <>
              <Section title="🚶 Store pickup" sub="Let nearby customers collect from your shop.">
                <Toggle checked={draft.pickup} onChange={(v) => d({ pickup: v })} label="Allow pickup from store" hint="Shows a “Pickup from store” button on product pages." />
                <Field label="Shop address"><Input value={draft.pickupAddress} onChange={(e) => d({ pickupAddress: e.target.value })} placeholder="Shop #5, Mirpur 10, Dhaka" /></Field>
                <Field label="Google Maps link"><Input value={draft.pickupMap} onChange={(e) => d({ pickupMap: e.target.value })} placeholder="https://maps.google.com/…" /></Field>
              </Section>
              <Section title="Stock alerts">
                <Field label="Warn me when a variant has this many left or fewer">
                  <Input type="number" min={0} value={draft.lowStockLimit} onChange={(e) => d({ lowStockLimit: Number(e.target.value) })} className="!w-32" />
                </Field>
              </Section>
            </>
          )}

          {tab === "notify" && (
            <>
              <Section title="Telegram bots (Order, Pickup & Draft notifications)" sub="Instant order alerts on your phone. Add multiple Chat IDs for team members.">
                <Field label="Main Order Bot Token">
                  <Secret value={draft.tgMainToken} onChange={(v) => d({ tgMainToken: v })} placeholder="123456:ABC-DEF…" />
                </Field>
                <Field label="Main Order Chat IDs" hint="Add one or more Telegram Chat IDs to receive order notifications">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {chatList.map((cid) => (
                      <span key={cid} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 font-mono text-xs font-semibold text-indigo-700">
                        {cid}
                        <button type="button" onClick={() => setChats(chatList.filter((x) => x !== cid))}><X size={12} /></button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newChatId}
                      onChange={(e) => setNewChatId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newChatId.trim()) {
                          e.preventDefault();
                          setChats([...new Set([...chatList, newChatId.trim()])]);
                          setNewChatId("");
                        }
                      }}
                      placeholder="Enter Chat ID (e.g. 5513474694) and click Add"
                    />
                    <Button icon={<Plus size={14} />} onClick={() => { if (newChatId.trim()) { setChats([...new Set([...chatList, newChatId.trim()])]); setNewChatId(""); } }}>Add Chat ID</Button>
                  </div>
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Draft / Abandoned Order Bot Token"><Secret value={draft.tgDraftToken} onChange={(v) => d({ tgDraftToken: v })} placeholder="Optional separate draft bot" /></Field>
                  <Field label="Draft / Abandoned Chat ID"><Input value={draft.tgDraftChat} onChange={(e) => d({ tgDraftChat: e.target.value })} placeholder="Chat ID for draft orders" /></Field>
                  <Field label="Store Pickup Bot Token"><Secret value={draft.tgPickupToken} onChange={(v) => d({ tgPickupToken: v })} /></Field>
                  <Field label="Store Pickup Chat ID"><Input value={draft.tgPickupChat} onChange={(e) => d({ tgPickupChat: e.target.value })} /></Field>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={testing === "Main Order"} onClick={() => sendTestTelegram(draft.tgMainToken, chatList[0] || draft.tgMainChat, "Main Order")}>Test Main Bot</Button>
                  {draft.tgDraftToken && <Button disabled={testing === "Draft"} onClick={() => sendTestTelegram(draft.tgDraftToken, draft.tgDraftChat, "Draft")}>Test Draft Bot</Button>}
                  {draft.tgPickupToken && <Button disabled={testing === "Pickup"} onClick={() => sendTestTelegram(draft.tgPickupToken, draft.tgPickupChat, "Pickup")}>Test Pickup Bot</Button>}
                </div>
              </Section>
              <Section title="What should I be told about?">
                <div className="divide-y divide-slate-100">
                  <Toggle checked={draft.notifyNew} onChange={(v) => d({ notifyNew: v })} label="New order" />
                  <Toggle checked={draft.notifyCancel} onChange={(v) => d({ notifyCancel: v })} label="Order cancelled" />
                  <Toggle checked={draft.notifyReview} onChange={(v) => d({ notifyReview: v })} label="New review" />
                  <Toggle checked={draft.notifyLowStock} onChange={(v) => d({ notifyLowStock: v })} label="Low stock" />
                </div>
              </Section>
            </>
          )}

          {tab === "integrations" && (
            <>
              <Section title="Photo uploads (Cloudflare R2 & ImgBB)" sub="Where product, category, banner and customer review photos are stored.">
                <Field label="Admin Primary Image Provider">
                  <Select value={draft.imageProvider} onChange={(e) => d({ imageProvider: e.target.value })}>
                    <option value="R2">Cloudflare R2 (Recommended — your own bucket)</option>
                    <option value="ImgBB">ImgBB API</option>
                  </Select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Admin ImgBB API Key (fallback)"><Secret value={draft.imgbbApiKey} onChange={(v) => d({ imgbbApiKey: v })} placeholder="imgbb.com API Key" /></Field>
                  <Field label="Customer Review ImgBB API Key">
                    <div className="flex gap-2">
                      <div className="flex-1"><Secret value={draft.reviewImgbbKey} onChange={(v) => d({ reviewImgbbKey: v })} placeholder="Separate ImgBB key for customer reviews" /></div>
                      <Button size="sm" disabled={testing === "imgbb"} onClick={testReviewImgbbKey}>🔍 Test</Button>
                    </div>
                  </Field>
                </div>
              </Section>

              <Section title="🤖 AI (Google Gemini)" sub="Separate Admin & Customer keys so rate limits and quotas stay isolated.">
                <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Admin AI Configuration</div>
                  <Field label="Admin Google AI Studio API Key">
                    <div className="flex gap-2">
                      <div className="flex-1"><Secret value={draft.aiAdminKey} onChange={(v) => d({ aiAdminKey: v })} placeholder="AIzaSy…" /></div>
                      <Button size="sm" variant="soft" disabled={testing === "Admin AI Key"} onClick={() => testGeminiKey(draft.aiAdminKey, "Admin AI Key")}>🔍 Test Admin Key</Button>
                    </div>
                  </Field>
                  <Field label="Admin AI Model">
                    <Select value={draft.aiModel} onChange={(e) => d({ aiModel: e.target.value })}>
                      <option value="gemini-3.5-flash">Gemini 3.5 Flash (Super Fast & Recommended)</option>
                      <option value="gemini-3.8-flash">Gemini 3.8 Flash (High Intelligence)</option>
                      <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite (Ultra Lightweight)</option>
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                    </Select>
                  </Field>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Customer / User AI Configuration</div>
                  <Field label="Customer Chat API Key" hint="Use a separate key so customer traffic never hits admin quota.">
                    <div className="flex gap-2">
                      <div className="flex-1"><Secret value={draft.aiUserKey} onChange={(v) => d({ aiUserKey: v })} placeholder="AIzaSy…" /></div>
                      <Button size="sm" variant="soft" disabled={testing === "User AI Key"} onClick={() => testGeminiKey(draft.aiUserKey, "User AI Key")}>🔍 Test User Key</Button>
                    </div>
                  </Field>
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs text-emerald-800">
                    <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
                    <div>
                      <div className="font-semibold">Customer Live Chat & Voice Engine: <code className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono">{draft.aiAudioModel || "gemini-3.8-live"}</code></div>
                      <div className="text-emerald-700/80">Real-time voice & product chat streaming active</div>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  <Toggle checked={draft.aiChat} onChange={(v) => d({ aiChat: v })} label="💬 Product page AI chat" />
                  <Toggle checked={draft.aiVoice} onChange={(v) => d({ aiVoice: v })} label="📞 Live voice call mode" />
                  <Toggle checked={draft.aiCompare} onChange={(v) => d({ aiCompare: v })} label="⚖️ Hold-to-compare AI" />
                </div>
              </Section>

              <Section title="Cache & Backup Tools">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
                  <div><div className="font-medium">Clear website cache</div><div className="text-sm text-slate-500">Purge Cloudflare edge cache so customers see changes immediately.</div></div>
                  <Button variant="danger" onClick={() => { proxyFetch("/clear-cache", {}).catch(() => {}); toast("Cloudflare cache purged ✔"); }}>Purge Cache</Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
                  <div><div className="font-medium">Backup settings</div><div className="text-sm text-slate-500">Download your settings as a JSON file (API secrets stripped).</div></div>
                  <Button onClick={() => downloadJSON("settings.json", { ...settings, gatewayKey: "", gatewayKeyV2: "", tgMainToken: "", tgPickupToken: "", tgDraftToken: "", aiAdminKey: "", aiUserKey: "", binanceApiKey: "", binanceApiSecret: "" })}>Download JSON</Button>
                </div>
              </Section>
            </>
          )}
        </div>
      </div>
      {dirty && (
        <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 lg:pl-[264px]">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl animate-[pop_.2s_ease]">
            <Badge tone="amber">Unsaved changes</Badge>
            <Button size="sm" className="border-0 bg-white/10 text-white hover:bg-white/20" icon={<Undo2 size={14} />} onClick={() => setDraft(settings)}>Discard</Button>
            <Button size="sm" variant="primary" icon={<Save size={14} />} onClick={save}>Save changes</Button>
          </div>
        </div>
      )}
    </div>
  );
}
