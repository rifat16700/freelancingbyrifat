import { useEffect, useState } from "react";
import { Bell, CreditCard, Eye, EyeOff, Globe, MapPin, Plug, Plus, Save, Search, Settings as Cog, Store, Undo2, X } from "lucide-react";
import { useStore } from "../store";
import { Badge, Button, Card, CardHead, Field, Input, MediaPicker, PageHeader, Select, Textarea, Toggle } from "../components/ui";
import { proxyFetch } from "../lib/api";
import { cn } from "../utils/cn";
import { downloadJSON, money } from "../lib/format";

type Tab = "store" | "social" | "seo" | "payments" | "orders" | "notify" | "integrations";
const TABS: { id: Tab; label: string; icon: typeof Cog; bn: string }[] = [
  { id: "store", label: "Store", icon: Store, bn: "স্টোর" },
  { id: "social", label: "Contact & social", icon: Globe, bn: "যোগাযোগ" },
  { id: "seo", label: "Google & SEO", icon: Search, bn: "এসইও" },
  { id: "payments", label: "Payments", icon: CreditCard, bn: "পেমেন্ট" },
  { id: "orders", label: "Pickup & stock", icon: MapPin, bn: "পিকআপ ও স্টক" },
  { id: "notify", label: "Notifications", icon: Bell, bn: "নোটিফিকেশন" },
  { id: "integrations", label: "AI & integrations", icon: Plug, bn: "ইন্টিগ্রেশন" },
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
function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return <Card className="mb-5"><CardHead title={title} sub={sub} /><div className="space-y-4 px-5 pb-5">{children}</div></Card>;
}

export function Settings() {
  const s = useStore();
  const { settings, setSettings, toast, log, t, products, categories, hasPerm } = s;
  const [tab, setTab] = useState<Tab>("store");
  const [draft, setDraft] = useState(settings);
  const [newChatId, setNewChatId] = useState("");
  const [newCoin, setNewCoin] = useState("");

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

  const chatList = draft.tgMainChats?.length
    ? draft.tgMainChats
    : (draft.tgMainChat || "").split(",").map((x) => x.trim()).filter(Boolean);

  const setChats = (list: string[]) => d({ tgMainChats: list, tgMainChat: list.join(", ") });

  const sendTestTelegram = async () => {
    const tok = draft.tgMainToken.trim();
    const target = chatList[0] || draft.tgMainChat.trim();
    if (!tok || !target) return toast("Add Main Bot Token and at least one Chat ID first", "err");
    try {
      const r = await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: target,
          text: `✅ *${draft.storeName || "Store"}* — Telegram Order Notification Test OK!`,
          parse_mode: "Markdown",
        }),
      });
      const j = await r.json();
      if (j?.ok) toast("Test message sent to Telegram ✔");
      else toast(j?.description || "Telegram test failed", "err");
    } catch (e: any) {
      toast(e?.message || "Telegram connection error", "err");
    }
  };

  const methods = [
    draft.cod && { n: "Cash on Delivery", c: "bg-emerald-100 text-emerald-700" },
    { n: "bKash", c: "bg-pink-100 text-pink-700" },
    { n: "Nagad", c: "bg-orange-100 text-orange-700" },
    draft.advanceMode === "auto" && { n: "Online Gateway", c: "bg-sky-100 text-sky-700" },
    draft.crypto && { n: "Binance Pay", c: "bg-yellow-100 text-yellow-700" },
  ].filter(Boolean) as { n: string; c: string }[];

  return (
    <div className="pb-24">
      <PageHeader icon={<Cog size={22} />} title={t("Settings", "সেটিংস")} desc="Everything about how your store works, in small friendly sections." />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {TABS.map((x) => (
            <button key={x.id} onClick={() => setTab(x.id)} className={cn("flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition", tab === x.id ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-600 hover:bg-white")}>
              <x.icon size={17} />{s.lang === "bn" ? x.bn : x.label}
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
              <Field label="Footer text"><Input value={draft.footer} onChange={(e) => d({ footer: e.target.value })} /></Field>
            </Section>
          )}

          {tab === "social" && (
            <Section title="Contact & social links" sub="Used for the WhatsApp order button and footer icons.">
              <Field label="WhatsApp number" hint="With country code, e.g. 8801XXXXXXXXX"><Input value={draft.whatsapp} onChange={(e) => d({ whatsapp: e.target.value.replace(/\D/g, "") })} /></Field>
              <Field label="Facebook page"><Input value={draft.facebook} onChange={(e) => d({ facebook: e.target.value })} /></Field>
              <Field label="Instagram"><Input value={draft.instagram} onChange={(e) => d({ instagram: e.target.value })} /></Field>
              <Field label="YouTube"><Input value={draft.youtube} onChange={(e) => d({ youtube: e.target.value })} /></Field>
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
                  <div className="text-xs text-slate-500">Preview</div>
                  <div className="mt-1 truncate text-lg text-blue-700">{draft.seoTitle || draft.storeName}</div>
                  <div className="text-xs text-emerald-700">{draft.canonical || "https://yourstore.com"}/</div>
                  <div className="mt-0.5 line-clamp-2 text-sm text-slate-600">{draft.seoDesc}</div>
                </div>
              </Section>
              <Section title="Advanced">
                <Field label="Main web address (optional)" hint="Leave empty to use the current domain automatically."><Input value={draft.canonical} onChange={(e) => d({ canonical: e.target.value })} placeholder="https://mystore.com" /></Field>
                <Field label="Google Search Console code (optional)" hint="Leave empty if you verified using DNS."><Input value={draft.gsc} onChange={(e) => d({ gsc: e.target.value })} /></Field>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
                  <div><div className="font-medium">XML sitemap</div><div className="text-sm text-slate-500">All active products and categories in one file for Google.</div></div>
                  <Button onClick={sitemap}>Download sitemap.xml</Button>
                </div>
              </Section>
            </>
          )}

          {tab === "payments" && (
            <>
              <Card className="mb-5 border-indigo-100 bg-indigo-50/50 p-5">
                <div className="mb-2 text-sm font-semibold text-indigo-900">What customers will see at checkout</div>
                <div className="flex flex-wrap gap-2">{methods.map((m) => <span key={m.n} className={cn("rounded-xl px-3.5 py-2 text-sm font-semibold", m.c)}>{m.n}</span>)}</div>
              </Card>
              <Section title="Cash on delivery & advance" sub="Advance payments protect you from fake orders.">
                <Toggle checked={draft.cod} onChange={(v) => d({ cod: v })} label="Allow Cash on Delivery" hint="Off = customers must pay online first." />
                <Toggle checked={draft.funPromise} onChange={(v) => d({ funPromise: v })} label="Fun promise checkboxes 🤝" hint="Light-hearted “I promise to receive the parcel” tick boxes for COD." />
                <Toggle checked={draft.allowWhatsappOrder} onChange={(v) => d({ allowWhatsappOrder: v })} label="WhatsApp direct order button" hint="Quick order button on product pages." />
                <Toggle checked={draft.msgOrder} onChange={(v) => d({ msgOrder: v })} label="“Order via message” buttons" hint="Messenger / social chat buttons on product pages." />
                <Field label="Advance amount" hint={draft.advanceAmount === 0 ? "No advance — pure COD" : draft.advanceAmount === -1 ? "Advance equals the delivery charge" : `Customers pay ${money(draft.advanceAmount)} in advance`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input type="number" value={draft.advanceAmount} onChange={(e) => d({ advanceAmount: Number(e.target.value) })} className="!w-32" />
                    {[["None", 0], ["= Delivery charge", -1], ["৳100", 100], ["৳200", 200]].map(([l, v]) => <Button key={l as string} size="sm" variant={draft.advanceAmount === v ? "soft" : "secondary"} onClick={() => d({ advanceAmount: v as number })}>{l}</Button>)}
                  </div>
                </Field>
                <Field label="How is the advance paid?">
                  <Select value={draft.advanceMode} onChange={(e) => d({ advanceMode: e.target.value as "manual" | "auto" })}>
                    <option value="manual">Manual — bKash / Nagad with TrxID</option>
                    <option value="auto">Automatic — payment gateway</option>
                  </Select>
                </Field>
              </Section>
              <Section title="bKash & Nagad (manual)" sub="Customers send money to these numbers and enter the TrxID.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="bKash number"><Input value={draft.bkashNumber} onChange={(e) => d({ bkashNumber: e.target.value })} /></Field>
                  <Field label="Nagad number"><Input value={draft.nagadNumber} onChange={(e) => d({ nagadNumber: e.target.value })} /></Field>
                </div>
              </Section>
              <Section title="Online gateway" sub="Automatic payment verification — supports v1 & v2 keys and custom proxy URLs.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Verification system">
                    <Select value={draft.gateway} onChange={(e) => d({ gateway: e.target.value })}>
                      {["Auto", "Cloudflare (recommended)", "PHP proxy", "Supabase edge", "Hugging Face API"].map((x) => <option key={x}>{x}</option>)}
                    </Select>
                  </Field>
                  <Field label="Gateway API Version">
                    <Select value={draft.gatewayVersion} onChange={(e) => d({ gatewayVersion: e.target.value })}>
                      <option value="v1">Version 1 (Standard)</option>
                      <option value="v2">Version 2 (Multi-brand / Sub-store)</option>
                    </Select>
                  </Field>
                  <Field label="Gateway API Key (v1)"><Secret value={draft.gatewayKey} onChange={(v) => d({ gatewayKey: v })} placeholder="Secret key v1" /></Field>
                  <Field label="Gateway API Key (v2)"><Secret value={draft.gatewayKeyV2} onChange={(v) => d({ gatewayKeyV2: v })} placeholder="Secret key v2" /></Field>
                  <Field label="Supabase Edge URL (optional)"><Input value={draft.supabaseEdgeUrl} onChange={(e) => d({ supabaseEdgeUrl: e.target.value })} placeholder="https://…supabase.co/functions/v1/…" /></Field>
                  <Field label="Proxy / HF Verify URL (optional)"><Input value={draft.hfApiUrl} onChange={(e) => d({ hfApiUrl: e.target.value })} placeholder="https://…" /></Field>
                </div>
              </Section>
              <Section title="Crypto — Binance Pay" sub="Accept USDT & crypto from customers.">
                <Toggle checked={draft.crypto} onChange={(v) => d({ crypto: v })} label="Enable crypto payments" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Binance Pay Merchant / Manual UID"><Input value={draft.binanceUid} onChange={(e) => d({ binanceUid: e.target.value, binanceManualUid: e.target.value })} placeholder="123456789" /></Field>
                  <Field label="1 USD = ? BDT" hint="Used to convert checkout totals to USDT"><Input type="number" value={draft.usdRate} onChange={(e) => d({ usdRate: Number(e.target.value) })} /></Field>
                  <Field label="Binance API Key (Auto verify)"><Secret value={draft.binanceApiKey} onChange={(v) => d({ binanceApiKey: v })} placeholder="Optional API key" /></Field>
                  <Field label="Binance API Secret"><Secret value={draft.binanceApiSecret} onChange={(v) => d({ binanceApiSecret: v })} placeholder="Optional API secret" /></Field>
                  <Field label="Binance Proxy URL (optional)" className="sm:col-span-2"><Input value={draft.binanceProxyUrl} onChange={(e) => d({ binanceProxyUrl: e.target.value })} placeholder="https://…" /></Field>
                </div>
                <Field label="Accepted Crypto Coins">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(draft.cryptoCoins || []).map((c) => (
                      <span key={c} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                        {c}
                        <button type="button" onClick={() => d({ cryptoCoins: (draft.cryptoCoins || []).filter((x) => x !== c) })}><X size={12} /></button>
                      </span>
                    ))}
                    <div className="flex gap-1.5">
                      <Input value={newCoin} onChange={(e) => setNewCoin(e.target.value.toUpperCase())} placeholder="e.g. TON" className="h-8 !w-24 text-xs" />
                      <Button size="sm" onClick={() => { if (newCoin.trim()) { d({ cryptoCoins: [...new Set([...(draft.cryptoCoins || []), newCoin.trim()])] }); setNewCoin(""); } }}>+ Coin</Button>
                    </div>
                  </div>
                </Field>
              </Section>
            </>
          )}

          {tab === "orders" && (
            <>
              <Section title="Store pickup" sub="Let nearby customers collect from your shop.">
                <Toggle checked={draft.pickup} onChange={(v) => d({ pickup: v })} label="Allow pickup from store" hint="Shows a “Pickup from store” button on product pages." />
                <Field label="Shop address"><Input value={draft.pickupAddress} onChange={(e) => d({ pickupAddress: e.target.value })} /></Field>
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
                <Button onClick={sendTestTelegram}>Send test message</Button>
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
              <Section title="Photo uploads" sub="Where product, category, banner and review photos are stored.">
                <Field label="Primary Provider">
                  <Select value={draft.imageProvider} onChange={(e) => d({ imageProvider: e.target.value })}>
                    <option value="R2">Cloudflare R2 (your own bucket)</option>
                    <option value="ImgBB">ImgBB API</option>
                  </Select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Admin ImgBB API Key (optional fallback)"><Secret value={draft.imgbbApiKey} onChange={(v) => d({ imgbbApiKey: v })} placeholder="ImgBB key for admin uploads" /></Field>
                  <Field label="Customer Review ImgBB API Key"><Secret value={draft.reviewImgbbKey} onChange={(v) => d({ reviewImgbbKey: v })} placeholder="ImgBB key for customer review photos" /></Field>
                </div>
              </Section>
              <Section title="AI (Google Gemini)" sub="Powers the AI store manager, SEO writer, voice call and customer chat.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Admin API key"><Secret value={draft.aiAdminKey} onChange={(v) => d({ aiAdminKey: v })} placeholder="AIzaSy…" /></Field>
                  <Field label="Customer chat API key" hint="Use a separate key so quotas don’t mix."><Secret value={draft.aiUserKey} onChange={(v) => d({ aiUserKey: v })} placeholder="AIzaSy…" /></Field>
                  <Field label="Admin & Chat Text Model">
                    <Select value={draft.aiModel} onChange={(e) => d({ aiModel: e.target.value })}>
                      <option value="Flash">Gemini 2.5 Flash — fast & recommended</option>
                      <option value="Pro">Gemini 2.5 Pro — smartest</option>
                      <option value="Lite">Gemini 2.5 Flash-Lite — lightest</option>
                    </Select>
                  </Field>
                  <Field label="Live Voice / Audio Model">
                    <Input value={draft.aiAudioModel} onChange={(e) => d({ aiAudioModel: e.target.value })} placeholder="gemini-2.5-flash-native-audio-preview" />
                  </Field>
                </div>
                <div className="divide-y divide-slate-100">
                  <Toggle checked={draft.aiChat} onChange={(v) => d({ aiChat: v })} label="💬 Product page AI chat" />
                  <Toggle checked={draft.aiVoice} onChange={(v) => d({ aiVoice: v })} label="📞 Live voice call mode" />
                  <Toggle checked={draft.aiCompare} onChange={(v) => d({ aiCompare: v })} label="⚖️ Hold-to-compare AI" />
                </div>
              </Section>
              <Section title="Tools">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
                  <div><div className="font-medium">Clear website cache</div><div className="text-sm text-slate-500">After editing products, so customers see changes immediately.</div></div>
                  <Button onClick={() => { proxyFetch("/clear-cache", {}).catch(() => {}); toast("Cloudflare cache purged ✔"); }}>Purge cache</Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
                  <div><div className="font-medium">Backup settings</div><div className="text-sm text-slate-500">Download your settings as a JSON file (secrets removed).</div></div>
                  <Button onClick={() => downloadJSON("settings.json", { ...settings, gatewayKey: "", gatewayKeyV2: "", tgMainToken: "", tgPickupToken: "", tgDraftToken: "", aiAdminKey: "", aiUserKey: "", binanceApiKey: "", binanceApiSecret: "" })}>Download</Button>
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
