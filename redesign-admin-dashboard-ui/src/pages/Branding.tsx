import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, Copy, Image as ImageIcon, Palette, Radar, Rocket, RotateCcw } from "lucide-react";
import { useStore, DEFAULT_BRAND_COLORS, applyBrandColorsToDom } from "../store";
import { Badge, Button, Card, CardHead, Field, HelpBox, Input, Modal, PageHeader } from "../components/ui";
import { extractPaletteFromImageFile } from "../lib/api";
import { cn } from "../utils/cn";
import type { BrandColors } from "../types";

const PRESETS: { name: string; c: BrandColors }[] = [
  {
    name: "Maroon (Default)",
    c: DEFAULT_BRAND_COLORS,
  },
  {
    name: "Royal Green",
    c: {
      primary: "#0f766e", primary_light: "#14b8a6", primary_dark: "#115e59",
      bg: "#f0fdfa", bg_light: "#ffffff", bg_card: "#ffffff", bg_subtle: "#ccfbf1",
      footer_bg: "#042f2e", border: "#99f6e4", border_light: "#ccfbf1",
      text_dark: "#0f172a", text_body: "#334155", text_muted: "#64748b",
    },
  },
  {
    name: "Indigo",
    c: {
      primary: "#4f46e5", primary_light: "#6366f1", primary_dark: "#3730a3",
      bg: "#f8fafc", bg_light: "#ffffff", bg_card: "#ffffff", bg_subtle: "#eef2ff",
      footer_bg: "#0f172a", border: "#e2e8f0", border_light: "#f1f5f9",
      text_dark: "#0f172a", text_body: "#334155", text_muted: "#64748b",
    },
  },
  {
    name: "Midnight",
    c: {
      primary: "#6366f1", primary_light: "#818cf8", primary_dark: "#4338ca",
      bg: "#0f172a", bg_light: "#1e293b", bg_card: "#1e293b", bg_subtle: "#334155",
      footer_bg: "#020617", border: "#334155", border_light: "#1e293b",
      text_dark: "#f8fafc", text_body: "#cbd5e1", text_muted: "#94a3b8",
    },
  },
  {
    name: "Sunset",
    c: {
      primary: "#ea580c", primary_light: "#f97316", primary_dark: "#c2410c",
      bg: "#fffbeb", bg_light: "#ffffff", bg_card: "#ffffff", bg_subtle: "#ffedd5",
      footer_bg: "#431407", border: "#fed7aa", border_light: "#ffedd5",
      text_dark: "#431407", text_body: "#7c2d12", text_muted: "#9a6b4f",
    },
  },
];

const MAIN_LABELS: { k: keyof BrandColors; label: string; hint: string }[] = [
  { k: "primary", label: "Main Brand Colour", hint: "Buttons, header, active accents" },
  { k: "primary_light", label: "Main (Light / Accent)", hint: "Highlights, badges, gradients" },
  { k: "primary_dark", label: "Main (Dark)", hint: "Hover states, deep headers" },
  { k: "bg", label: "Page background", hint: "Main body background" },
  { k: "bg_card", label: "Card background", hint: "Product & surface cards" },
  { k: "text_dark", label: "Heading text", hint: "Titles and prices" },
  { k: "text_muted", label: "Soft / muted text", hint: "Subtitles and captions" },
];

const EXTRA_LABELS: { k: keyof BrandColors; label: string }[] = [
  { k: "bg_light", label: "Light surface background" },
  { k: "bg_subtle", label: "Subtle section background" },
  { k: "footer_bg", label: "Footer background" },
  { k: "border", label: "Primary border colour" },
  { k: "border_light", label: "Soft border colour" },
  { k: "text_body", label: "Body paragraph text" },
];

export function Theme() {
  const { settings, setSettings, toast, log, t } = useStore();
  const [c, setC] = useState<BrandColors>({ ...DEFAULT_BRAND_COLORS, ...settings.brandColors });
  const [ver, setVer] = useState(settings.templateVersion || "v2");
  const [code, setCode] = useState(false);
  const [extractedSwatches, setExtractedSwatches] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setC({ ...DEFAULT_BRAND_COLORS, ...settings.brandColors });
    setVer(settings.templateVersion || "v2");
  }, [settings.brandColors, settings.templateVersion]);

  const updateColors = (next: BrandColors) => {
    setC(next);
    applyBrandColorsToDom(next);
  };

  const handleImageExtract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const swatches = await extractPaletteFromImageFile(f);
      setExtractedSwatches(swatches);
      if (swatches.length > 0) {
        const next: BrandColors = {
          ...c,
          primary: swatches[0],
          primary_light: swatches[1] || swatches[0],
          primary_dark: swatches[2] || swatches[0],
        };
        updateColors(next);
        toast("Brand colours extracted from your image 🎨");
      }
    } catch (err: any) {
      toast(err?.message || "Could not extract colours", "err");
    } finally {
      e.target.value = "";
    }
  };

  const json = JSON.stringify(c);

  return (
    <div>
      <PageHeader
        icon={<Palette size={22} />}
        title={t("Theme", "থিম")}
        desc="Make the store & admin panel match your brand. Uses your default Maroon system or any BRAND_COLORS variable."
        actions={
          <>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageExtract} />
            <Button icon={<ImageIcon size={14} />} onClick={() => fileRef.current?.click()}>Pick from Logo/Image</Button>
            <Button icon={<RotateCcw size={14} />} onClick={() => updateColors(DEFAULT_BRAND_COLORS)}>Reset Maroon</Button>
            <Button onClick={() => setCode(true)}>Get colour code</Button>
            <Button variant="primary" icon={<Check size={15} />} onClick={() => { setSettings({ brandColors: c, templateVersion: ver }); log("Theme saved", ver); toast("Theme saved & applied ✔"); }}>Save theme</Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[440px_1fr]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">Start from a palette</span>
              <button type="button" onClick={() => fileRef.current?.click()} className="text-xs font-semibold text-indigo-600 hover:underline">
                🎨 Upload logo to extract
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {PRESETS.map((p) => (
                <button key={p.name} onClick={() => updateColors(p.c)} title={p.name} className="group">
                  <div className="flex h-10 overflow-hidden rounded-xl ring-1 ring-slate-200 group-hover:ring-indigo-400">
                    {[p.c.primary, p.c.primary_light, p.c.bg, p.c.bg_card].map((x, i) => <span key={i} className="flex-1" style={{ background: x }} />)}
                  </div>
                  <div className="mt-1 truncate text-center text-[10px] text-slate-500">{p.name}</div>
                </button>
              ))}
            </div>
            {extractedSwatches.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <div className="mb-1.5 text-xs font-medium text-slate-500">Extracted from your image (click to set as Main colour):</div>
                <div className="flex flex-wrap gap-1.5">
                  {extractedSwatches.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => updateColors({ ...c, primary: hex })}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-xs font-mono"
                    >
                      <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: hex }} />
                      {hex}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 text-sm font-semibold">Core brand colours</div>
            <div className="space-y-3">
              {MAIN_LABELS.map((l) => (
                <div key={l.k} className="flex items-center gap-3">
                  <input type="color" value={c[l.k]} onChange={(e) => updateColors({ ...c, [l.k]: e.target.value })} className="h-10 w-12 rounded-lg cursor-pointer" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-800">{l.label}</div>
                    {l.hint && <div className="text-xs text-slate-400">{l.hint}</div>}
                  </div>
                  <Input value={c[l.k]} onChange={(e) => updateColors({ ...c, [l.k]: e.target.value })} className="!w-28 font-mono text-xs" />
                </div>
              ))}
            </div>

            <details className="mt-4 rounded-2xl border border-slate-200 p-3.5">
              <summary className="cursor-pointer text-xs font-semibold text-slate-600">⚙️ All 13 BRAND_COLORS variables (Surfaces, Footer & Borders)</summary>
              <div className="mt-3 space-y-2.5">
                {EXTRA_LABELS.map((l) => (
                  <div key={l.k} className="flex items-center gap-3">
                    <input type="color" value={c[l.k]} onChange={(e) => updateColors({ ...c, [l.k]: e.target.value })} className="h-8 w-10 rounded-lg cursor-pointer" />
                    <div className="flex-1 text-xs font-medium text-slate-700">{l.label}</div>
                    <Input value={c[l.k]} onChange={(e) => updateColors({ ...c, [l.k]: e.target.value })} className="h-8 !w-24 font-mono text-xs" />
                  </div>
                ))}
              </div>
            </details>
          </Card>

          <Card className="p-5">
            <div className="mb-3 text-sm font-semibold">Store template</div>
            <div className="grid grid-cols-2 gap-3">
              {[["v1", "Classic", "Simple, fast, familiar"], ["v2", "Modern", "Rounded, Tailwind-style"]].map(([id, n, d]) => (
                <button key={id} onClick={() => setVer(id)} className={cn("rounded-2xl border p-4 text-left", ver === id ? "border-indigo-600 bg-indigo-50" : "border-slate-200")}>
                  <div className="font-semibold">{n}</div>
                  <div className="text-xs text-slate-500">{d}</div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHead title="Live preview" sub={`Template ${ver === "v1" ? "Classic" : "Modern"}`} />
          <div className="px-5 pb-5">
            <div className="overflow-hidden border" style={{ background: c.bg, borderRadius: ver === "v2" ? 24 : 6, borderColor: c.border }}>
              <div className="flex items-center justify-between px-5 py-3 text-white" style={{ background: c.primary }}>
                <b>{settings.storeName}</b>
                <div className="flex gap-4 text-sm opacity-90"><span>Shop</span><span>Offers</span><span>Cart (2)</span></div>
              </div>
              <div className="p-5">
                <div className="mb-5 p-6 text-white" style={{ background: `linear-gradient(120deg, ${c.primary}, ${c.primary_light})`, borderRadius: ver === "v2" ? 20 : 4 }}>
                  <div className="text-2xl font-bold">Eid Mega Sale</div>
                  <div className="text-sm opacity-90">Up to 30% off</div>
                  <button className="mt-3 px-4 py-1.5 text-sm font-semibold" style={{ background: c.bg_card, color: c.primary, borderRadius: ver === "v2" ? 99 : 4 }}>Shop now</button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {["🎧 Earbuds", "⌚ Smart Watch", "👘 Panjabi"].map((n, i) => (
                    <div key={n} className="p-3" style={{ background: c.bg_card, borderRadius: ver === "v2" ? 16 : 4, border: `1px solid ${c.border_light}` }}>
                      <div className="grid h-20 place-items-center text-4xl" style={{ background: c.bg_subtle, borderRadius: ver === "v2" ? 12 : 3 }}>{n.split(" ")[0]}</div>
                      <div className="mt-2 text-sm font-semibold" style={{ color: c.text_dark }}>{n.split(" ").slice(1).join(" ")}</div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-bold" style={{ color: c.primary }}>৳{1290 + i * 400}</span>
                        <span className="text-xs line-through" style={{ color: c.text_muted }}>৳{1590 + i * 400}</span>
                      </div>
                      <button className="mt-2 w-full py-1.5 text-xs font-semibold text-white" style={{ background: c.primary, borderRadius: ver === "v2" ? 99 : 4 }}>Add to cart</button>
                      {i === 0 && <span className="mt-2 inline-block px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: c.primary_light, borderRadius: 99 }}>-18%</span>}
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs" style={{ color: c.text_muted }}>Free delivery on orders over ৳1200 · Cash on delivery</p>
              </div>
              <div className="px-5 py-3 text-xs text-white/80" style={{ background: c.footer_bg }}>
                © {settings.storeName} — All rights reserved.
              </div>
            </div>
          </div>
        </Card>
      </div>
      <Modal open={code} onClose={() => setCode(false)} title="Cloudflare BRAND_COLORS JSON" sub="Paste this single-line JSON into the BRAND_COLORS variable in Cloudflare Pages → Environment Variables." footer={<><Button icon={<Copy size={14} />} onClick={() => { navigator.clipboard?.writeText(json); toast("Copied BRAND_COLORS JSON"); }}>Copy Single-Line JSON</Button><Button variant="primary" onClick={() => setCode(false)}>Close</Button></>}>
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs break-all select-all">{json}</div>
          <pre className="select-all overflow-x-auto rounded-2xl bg-slate-900 p-4 text-xs leading-relaxed text-emerald-300">{JSON.stringify(c, null, 2)}</pre>
        </div>
      </Modal>
    </div>
  );
}

const MODES = [
  { id: "Browser Only", d: "Standard scripts in the visitor’s browser. Simple, but ad-blockers can hide some data.", e: "🌐" },
  { id: "Server-Side", d: "Events sent from your server. No browser scripts, immune to blockers.", e: "🛡️" },
  { id: "Smart Fallback", d: "Browser first, switches to server when blocked. Best accuracy.", e: "🧠" },
  { id: "Custom Server", d: "Send to your own server (e.g. Stape.io).", e: "⚙️" },
];
export function Tracking() {
  const { settings, setSettings, toast, log, t } = useStore();
  const [d, setD] = useState({ trackingMode: settings.trackingMode, metaPixel: settings.metaPixel, ga4: settings.ga4, gtm: settings.gtm, clarity: settings.clarity, trackingUrl: settings.trackingUrl });
  const [step, setStep] = useState(-1);

  useEffect(() => {
    setD({ trackingMode: settings.trackingMode, metaPixel: settings.metaPixel, ga4: settings.ga4, gtm: settings.gtm, clarity: settings.clarity, trackingUrl: settings.trackingUrl });
  }, [settings.trackingMode, settings.metaPixel, settings.ga4, settings.gtm, settings.clarity, settings.trackingUrl]);

  const steps = ["Saving to D1 devtools", "Updating tracking config", "Syncing pixel IDs", "Live!"];
  const deploy = () => {
    setSettings(d);
    log("Tracking deployed", d.trackingMode);
    setStep(0);
    [1, 2, 3].forEach((s, i) => setTimeout(() => setStep(s), 600 * (i + 1)));
    setTimeout(() => { toast("Tracking configuration saved to D1 🚀"); setStep(-1); }, 2500);
  };
  const ok = (v: string, re: RegExp) => v === "" ? null : re.test(v);
  const ids = [
    { k: "metaPixel", label: "Meta (Facebook) Pixel ID", ph: "123456789012345", re: /^\d{10,18}$/, hint: "Numbers only, 15–16 digits" },
    { k: "ga4", label: "Google Analytics 4 ID", ph: "G-ABC123XYZ", re: /^G-[A-Z0-9]{6,}$/i, hint: "Starts with G-" },
    { k: "gtm", label: "Google Tag Manager ID", ph: "GTM-XXXXXXX", re: /^GTM-[A-Z0-9]{5,}$/i, hint: "Starts with GTM-" },
    { k: "clarity", label: "Microsoft Clarity ID", ph: "abcdefghij", re: /^[a-z0-9]{8,14}$/i, hint: "10 letters/numbers — free heatmaps" },
  ] as const;
  const connected = ids.filter((i) => d[i.k]).length;
  return (
    <div>
      <PageHeader icon={<Radar size={22} />} title={t("Tracking", "ট্র্যাকিং")} desc="See where visitors come from and which ads work." actions={<Button variant="primary" icon={<Rocket size={15} />} onClick={deploy} disabled={step >= 0}>Save & publish</Button>} />
      <HelpBox id="track" title="Why this matters"><p>Without tracking, you’re guessing which Facebook ad or post made the sale. Add at least <b>Meta Pixel</b> and <b>GA4</b>.</p></HelpBox>
      {step >= 0 && <Card className="mb-5 p-5"><div className="flex items-center gap-2">{steps.map((s, i) => <div key={s} className="flex flex-1 items-center gap-2"><span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold", i <= step ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500")}>{i < step || step === 3 ? <Check size={14} /> : i + 1}</span><span className={cn("hidden text-xs sm:block", i <= step ? "font-semibold text-slate-800" : "text-slate-400")}>{s}</span><div className={cn("h-0.5 flex-1", i < step ? "bg-emerald-500" : "bg-slate-200")} /></div>)}</div></Card>}
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card><CardHead title="Tracking mode" sub="How events are collected" />
            <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">{MODES.map((m) => <button key={m.id} onClick={() => setD({ ...d, trackingMode: m.id })} className={cn("rounded-2xl border p-4 text-left transition", d.trackingMode === m.id ? "border-indigo-600 bg-indigo-50 ring-4 ring-indigo-100" : "border-slate-200 hover:border-slate-300")}><div className="text-2xl">{m.e}</div><div className="mt-1 font-semibold text-slate-900">{m.id}{m.id === "Smart Fallback" && <Badge tone="green" className="ml-2">Best</Badge>}</div><div className="mt-0.5 text-xs text-slate-500">{m.d}</div></button>)}</div></Card>
          <Card><CardHead title="Your tracking IDs" sub="Leave empty to skip a tool" />
            <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">{ids.map((i) => { const v = ok(d[i.k], i.re); return <Field key={i.k} label={i.label} hint={v === false ? <span className="text-rose-600">That doesn’t look right — {i.hint}</span> : i.hint}><div className="relative"><Input value={d[i.k]} onChange={(e) => setD({ ...d, [i.k]: e.target.value.trim() })} placeholder={i.ph} className={cn(v === false && "!border-rose-300")} />{v && <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />}</div></Field>; })}
              {d.trackingMode === "Custom Server" && <Field label="Custom server URL" className="sm:col-span-2"><Input value={d.trackingUrl} onChange={(e) => setD({ ...d, trackingUrl: e.target.value })} placeholder="https://…" /></Field>}</div></Card>
        </div>
        <Card className="h-fit p-5"><div className="mb-3 text-sm font-semibold">Setup checklist</div>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(connected / 4) * 100}%` }} /></div>
          <ul className="space-y-2.5 text-sm">{ids.map((i) => <li key={i.k} className="flex items-center gap-2">{d[i.k] ? <CheckCircle2 size={16} className="text-emerald-500" /> : <span className="h-4 w-4 rounded-full border-2 border-slate-300" />}<span className={d[i.k] ? "text-slate-800" : "text-slate-500"}>{i.label.replace(" ID", "")}</span></li>)}</ul>
          <p className="mt-4 text-xs text-slate-500">{connected}/4 tools connected.</p></Card>
      </div>
    </div>
  );
}
