import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Bold, Check, Copy, Download, DownloadCloud, Eye, Film,
  Italic, Layers, LayoutGrid, Link2, List, ListOrdered, Package, Pencil, Plus,
  Sparkles, Star, Strikethrough, Text, Trash2, Underline, Upload, X, Zap
} from "lucide-react";
import { useStore } from "../store";
import { go, useRoute } from "../router";
import { Badge, Button, Card, ConfirmButton, Empty, Field, IconView, Input, MediaPicker, Modal, PageHeader, SearchBox, Select, Stat, Tabs, Textarea, Th, Td, Thumb, Toggle, Progress } from "../components/ui";
import { downloadCSV, money, num, pct } from "../lib/format";
import { generatePermanentSku, uploadImageFile } from "../lib/api";
import { cn } from "../utils/cn";
import type { Product, Variant } from "../types";

const stockOf = (p: Product) => p.variants.reduce((s, v) => s + Object.values(v.sizes).reduce((a, b) => a + b, 0), 0);
const blank = (brandId: string): Product => ({
  id: "", name: "", sku: "", brandId: brandId || "main", showOnMain: false, catIds: [],
  price: 0, cost: 0, flash: 0, active: true, featured: false, addOnce: false,
  emoji: "🛍️", hue: Math.floor(Math.random() * 360), galleryImages: [],
  videoUrl: "", videoType: "auto", desc: "",
  variants: [{ color: "Black", hex: "#111827", sizes: { Std: 10 } }],
  tags: "", seoTitle: "", seoSlug: "", seoDesc: "", seoKeywords: "",
  views: 0, created: new Date().toISOString(),
});

export function Products() {
  const { products, categories, brands, orders, settings, t, toast, log, brandName, catName, hasPerm } = useStore();
  const { query } = useRoute();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [brand, setBrand] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "hidden" | "low" | "flash">(query.get("stock") === "low" ? "low" : "all");
  const [edit, setEdit] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const canCreate = hasPerm("products", "create");
  const canEdit = hasPerm("products", "edit");
  const canDelete = hasPerm("products", "delete");
  const defaultBrandId = brands.items[0]?.id || "main";

  useEffect(() => {
    if (query.get("new") && canCreate) setEdit(blank(defaultBrandId));
    else if (query.get("id")) {
      const p = products.items.find((x) => x.id === query.get("id"));
      if (p) setEdit(structuredClone(p));
    }
    if (query.get("stock") === "low") setStatus("low");
    // eslint-disable-next-line
  }, [query]);

  const sold = useMemo(() => {
    const m = new Map<string, number>();
    orders.items.forEach((o) =>
      o.status !== "Cancelled" && !o.failed && Date.now() - new Date(o.date).getTime() < 30 * 86400000 &&
      o.items.forEach((i) => m.set(i.productId, (m.get(i.productId) || 0) + i.qty))
    );
    return m;
  }, [orders.items]);

  const lowOf = (p: Product) => p.variants.flatMap((v) => Object.entries(v.sizes)).filter(([, q]) => q <= settings.lowStockLimit).length;
  const list = products.items.filter((p) => {
    const s = q.toLowerCase();
    if (s && !(p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s))) return false;
    if (cat && !p.catIds.includes(cat)) return false;
    if (brand && p.brandId !== brand) return false;
    if (status === "active" && !p.active) return false;
    if (status === "hidden" && p.active) return false;
    if (status === "low" && !lowOf(p)) return false;
    if (status === "flash" && !p.flash) return false;
    return true;
  });
  const lowCount = products.items.filter((p) => p.active && lowOf(p)).length;

  const close = () => { setEdit(null); if (query.get("id") || query.get("new")) go("/products"); };
  const save = (p: Product) => {
    if (!p.name.trim()) return toast("Product name is required", "err");
    if (p.price <= 0) return toast("Enter a price greater than 0", "err");
    if (!p.catIds.length) return toast("Pick at least one category", "err");
    const existingSkus = products.items.filter((x) => x.id !== p.id).map((x) => x.sku);
    const finalSku = (p.sku || "").trim() || generatePermanentSku(p.name, existingSkus);
    const nextP = { ...p, sku: finalSku };
    if (p.id) {
      if (!canEdit) return toast("You don't have permission to edit products", "err");
      products.update(p.id, nextP);
      log("Product updated", p.id);
      toast("Product saved");
    } else {
      if (!canCreate) return toast("You don't have permission to create products", "err");
      const id = "prod_" + Date.now();
      products.add({ ...nextP, id });
      log("Product created", id);
      toast("Product added 🎉");
    }
    close();
  };
  const dup = (p: Product) => {
    if (!canCreate) return toast("Missing create permission", "err");
    const existingSkus = products.items.map((x) => x.sku);
    products.add({
      ...structuredClone(p),
      id: "prod_" + Date.now(),
      name: p.name + " (copy)",
      sku: generatePermanentSku(p.name, existingSkus),
      active: false,
    });
    toast("Duplicated as hidden draft");
  };

  return (
    <div>
      <PageHeader
        icon={<Package size={22} />}
        title={t("Products", "প্রোডাক্ট")}
        desc={t("Everything you sell — prices, photos, colours, sizes and stock.", "আপনার সব পণ্য — দাম, ছবি, রঙ, সাইজ ও স্টক।")}
        actions={
          <>
            <Button icon={<Download size={15} />} onClick={() => downloadCSV("products.csv", ["SKU", "Name", "Brand", "Price", "Cost", "Stock", "Active"], list.map((p) => [p.sku, p.name, brandName(p.brandId), p.price, p.cost, stockOf(p), p.active ? "yes" : "no"]))}>Export</Button>
            {canCreate && <Button icon={<Layers size={15} />} onClick={() => setBulkOpen(true)}>Bulk Studio</Button>}
            {canCreate && <Button icon={<Link2 size={15} />} onClick={() => setImportOpen(true)}>Import by URL</Button>}
            {canCreate && <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEdit(blank(defaultBrandId))}>Add product</Button>}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total products" value={products.items.length} icon={<Package size={20} />} />
        <Stat label="Live on store" value={products.items.filter((p) => p.active).length} sub={`${products.items.filter((p) => !p.active).length} hidden`} icon={<Eye size={20} />} tone="green" />
        <Stat label="Need restock" value={lowCount} sub={`≤ ${settings.lowStockLimit} units left`} icon={<AlertTriangle size={20} />} tone="rose" goodUp={false} />
        <Stat label="Flash deals" value={products.items.filter((p) => p.flash).length} icon={<Zap size={20} />} tone="amber" />
      </div>

      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchBox value={q} onChange={setQ} placeholder="Search by name or SKU…" className="flex-1" />
          <Select value={brand} onChange={(e) => setBrand(e.target.value)} className="lg:!w-44"><option value="">All brands</option>{brands.items.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="lg:!w-44"><option value="">All categories</option>{categories.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <div className="flex rounded-xl bg-slate-100 p-0.5">{([["grid", LayoutGrid], ["list", List]] as const).map(([v, Ic]) => <button key={v} onClick={() => setView(v)} className={cn("rounded-[10px] p-2", view === v ? "bg-white shadow-sm" : "text-slate-500")}><Ic size={16} /></button>)}</div>
        </div>
        <div className="mt-3"><Tabs value={status} onChange={setStatus} tabs={[{ id: "all", label: "All" }, { id: "active", label: "Live" }, { id: "hidden", label: "Hidden" }, { id: "low", label: "Low stock", count: lowCount }, { id: "flash", label: "Flash sale" }]} /></div>
      </Card>

      {list.length === 0 ? (
        <Card>
          <Empty
            title="No products found"
            sub="Change your filters or add a new product."
            action={canCreate ? <Button variant="primary" onClick={() => setEdit(blank(defaultBrandId))}>Add product</Button> : undefined}
          />
        </Card>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.map((p) => {
            const st = stockOf(p), low = lowOf(p);
            const heroImg = p.galleryImages?.[0];
            return (
              <Card key={p.id} className={cn("group overflow-hidden transition hover:shadow-lg", !p.active && "opacity-70")}>
                <div
                  className="relative grid h-40 place-items-center overflow-hidden text-6xl text-white"
                  style={heroImg ? undefined : { background: `linear-gradient(135deg, hsl(${p.hue} 80% 62%), hsl(${(p.hue + 40) % 360} 75% 42%))` }}
                >
                  {heroImg ? <img src={heroImg} alt={p.name} className="h-full w-full object-cover" /> : p.emoji}
                  <div className="absolute left-3 top-3 flex gap-1.5">
                    {p.flash > 0 && <Badge tone="amber" className="!bg-amber-400 !text-amber-950"><Zap size={11} />Flash</Badge>}
                    {p.featured && <Badge className="!bg-white/90"><Star size={11} className="text-amber-500" /> Featured</Badge>}
                  </div>
                  {canEdit && (
                    <div className="absolute right-3 top-3">
                      <Toggle checked={p.active} onChange={(v) => { products.update(p.id, { active: v }); toast(v ? "Now visible on store" : "Hidden from store"); }} />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-400">{p.sku} · {brandName(p.brandId)}{p.showOnMain && p.brandId !== "main" ? " (+Main)" : ""}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-lg font-bold">{money(p.price - p.flash)}</span>
                    {p.flash > 0 && <span className="text-sm text-slate-400 line-through">{money(p.price)}</span>}
                    {p.cost > 0 && <span className="ml-auto text-xs text-emerald-600">{pct(((p.price - p.flash - p.cost) / Math.max(1, p.price - p.flash)) * 100, 0)} margin</span>}
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className={cn(low ? "font-semibold text-rose-600" : "text-slate-500")}>
                        {st === 0 ? "Out of stock" : `${st} in stock`}{low > 0 && st > 0 && ` · ${low} variant${low > 1 ? "s" : ""} low`}
                      </span>
                      <span className="text-slate-400">{sold.get(p.id) || 0} sold / 30d</span>
                    </div>
                    <Progress value={Math.min(100, st)} tone={st === 0 ? "rose" : low ? "amber" : "green"} />
                  </div>
                  <div className="mt-3 flex items-center gap-1.5">
                    {canEdit && <Button size="sm" className="flex-1" icon={<Pencil size={13} />} onClick={() => setEdit(structuredClone(p))}>Edit</Button>}
                    {canCreate && <button title="Duplicate" onClick={() => dup(p)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><Copy size={15} /></button>}
                    {canDelete && <ConfirmButton onConfirm={() => { products.remove(p.id); toast("Product deleted"); log("Product deleted", p.id); }}><Trash2 size={15} /></ConfirmButton>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full">
          <thead><tr><Th>Product</Th><Th>Brand</Th><Th>Price</Th><Th>Stock</Th><Th>Sold 30d</Th><Th>Live</Th><Th /></tr></thead>
          <tbody className="divide-y divide-slate-100">{list.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50/70">
              <Td><div className="flex items-center gap-3"><Thumb p={p} /><div><div className="font-medium text-slate-900">{p.name}</div><div className="text-xs text-slate-400">{p.sku} · {p.catIds.map(catName).join(", ")}</div></div></div></Td>
              <Td>{brandName(p.brandId)}</Td>
              <Td className="font-semibold">{money(p.price - p.flash)}{p.flash > 0 && <span className="ml-1 text-xs text-slate-400 line-through">{money(p.price)}</span>}</Td>
              <Td><span className={cn(lowOf(p) && "font-semibold text-rose-600")}>{num(stockOf(p))}</span></Td>
              <Td>{sold.get(p.id) || 0}</Td>
              <Td><Toggle disabled={!canEdit} checked={p.active} onChange={(v) => products.update(p.id, { active: v })} /></Td>
              <Td className="text-right">{canEdit && <Button size="sm" onClick={() => setEdit(structuredClone(p))}>Edit</Button>}</Td>
            </tr>))}</tbody></table></div></Card>
      )}

      {edit && <ProductForm key={edit.id || "new"} initial={edit} onClose={close} onSave={save} />}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onFill={(p) => {
          setImportOpen(false);
          setEdit({ ...blank(defaultBrandId), ...p });
          toast("Product details filled in — review and save");
        }}
      />
      <BulkStudioModal open={bulkOpen} onClose={() => setBulkOpen(false)} />
    </div>
  );
}

function ImportModal({ open, onClose, onFill }: { open: boolean; onClose: () => void; onFill: (p: Partial<Product>) => void }) {
  const { products } = useStore();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchByUrl = async () => {
    const raw = url.trim();
    if (!raw) return;
    setBusy(true);
    try {
      const u = new URL(raw);
      const pid = u.searchParams.get("id");
      if (pid) {
        const local = products.items.find((x) => x.id === pid || x.seoSlug === pid);
        if (local) {
          onFill({
            name: local.name,
            price: local.price,
            cost: local.cost,
            flash: local.flash,
            desc: local.desc,
            galleryImages: local.galleryImages || [],
            variants: structuredClone(local.variants),
            tags: local.tags,
            seoTitle: local.seoTitle,
            seoDesc: local.seoDesc,
          });
          setUrl("");
          return;
        }
      }
      const res = await fetch(raw);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const title =
        doc.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
        doc.querySelector("title")?.textContent ||
        "Imported Product";
      const desc =
        doc.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
        doc.querySelector('meta[name="description"]')?.getAttribute("content") ||
        "";
      const img = doc.querySelector('meta[property="og:image"]')?.getAttribute("content") || "";
      const priceStr =
        doc.querySelector('meta[property="product:price:amount"]')?.getAttribute("content") ||
        (html.match(/(?:৳|BDT|TK\.?)\s*([0-9,]{2,7})/i)?.[1] || "0").replace(/,/g, "");
      onFill({
        name: title.trim(),
        price: Number(priceStr) || 990,
        desc: desc.trim(),
        galleryImages: img ? [img] : [],
      });
      setUrl("");
    } catch {
      onFill({ name: "Imported Item", price: 990, desc: `Imported from ${raw}`, galleryImages: [] });
      setUrl("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Import a product by URL" sub="Paste a product link from a partner shop or your own sites — we fill the form for you."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!url || busy} icon={<Sparkles size={15} />} onClick={fetchByUrl}>{busy ? "Fetching…" : "Fetch & fill"}</Button></>}>
      <Field label="Product page link"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://partner-shop.com/product?id=prod_1" /></Field>
      <p className="mt-3 text-sm text-slate-500">Name, price, description and OpenGraph images are extracted automatically so you can review and save.</p>
    </Modal>
  );
}

interface BulkRow {
  name: string;
  brandId: string;
  catId: string;
  price: number;
  flash: number;
  sku: string;
  image: string;
  stock: number;
}

function BulkStudioModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { brands, categories, products, toast, log } = useStore();
  const defBrand = brands.items[0]?.id || "main";
  const defCat = categories.items[0]?.id || "";
  const makeRow = (): BulkRow => ({ name: "", brandId: defBrand, catId: defCat, price: 0, flash: 0, sku: "", image: "", stock: 20 });
  const [rows, setRows] = useState<BulkRow[]>([makeRow(), makeRow(), makeRow()]);
  const [saving, setSaving] = useState(false);

  const setRow = (idx: number, patch: Partial<BulkRow>) =>
    setRows((r) => r.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  const autoSkuAll = () => {
    const taken = products.items.map((p) => p.sku);
    setRows((prev) =>
      prev.map((r) => {
        if (!r.name.trim()) return r;
        const sku = generatePermanentSku(r.name, taken);
        taken.push(sku);
        return { ...r, sku };
      })
    );
  };

  const saveBulk = () => {
    const valid = rows.filter((r) => r.name.trim() && r.price > 0);
    if (!valid.length) return toast("Fill at least one product name and price (> 0)", "err");
    setSaving(true);
    try {
      const taken = products.items.map((p) => p.sku);
      valid.forEach((r, idx) => {
        const sku = r.sku.trim() || generatePermanentSku(r.name, taken);
        taken.push(sku);
        const p: Product = {
          ...blank(r.brandId || defBrand),
          id: `prod_${Date.now()}_${idx}`,
          name: r.name.trim(),
          sku,
          brandId: r.brandId || defBrand,
          catIds: r.catId ? [r.catId] : categories.items[0]?.id ? [categories.items[0].id] : [],
          price: Number(r.price),
          flash: Number(r.flash || 0),
          galleryImages: r.image.trim() ? [r.image.trim()] : [],
          variants: [{ color: "Default", hex: "#111827", sizes: { Std: Number(r.stock || 10) } }],
        };
        products.add(p);
      });
      log("Bulk products created", `${valid.length} products`);
      toast(`${valid.length} products added via Bulk Studio 🎉`);
      setRows([makeRow(), makeRow(), makeRow()]);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="📦 Bulk Product Studio"
      sub="Add multiple products at once with auto-SKU and photo upload."
      footer={
        <>
          <Button onClick={() => setRows((r) => [...r, makeRow()])} icon={<Plus size={14} />}>Add row</Button>
          <Button onClick={autoSkuAll} icon={<Sparkles size={14} />}>Auto-SKU All</Button>
          <span className="mr-auto" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={saving} onClick={saveBulk}>💾 Save All Products</Button>
        </>
      }
    >
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 p-3.5">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Product #{i + 1}</span>
              {rows.length > 1 && (
                <button onClick={() => setRows((l) => l.filter((_, k) => k !== i))} className="text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>
              )}
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3">
              <Input value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} placeholder="Product name *" className="sm:col-span-2" />
              <div className="flex gap-1.5">
                <Input value={r.sku} onChange={(e) => setRow(i, { sku: e.target.value })} placeholder="SKU (auto)" />
                <Button size="sm" onClick={() => setRow(i, { sku: generatePermanentSku(r.name, products.items.map((x) => x.sku)) })}>Auto</Button>
              </div>
              <Select value={r.brandId} onChange={(e) => setRow(i, { brandId: e.target.value })}>
                {brands.items.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
              <Select value={r.catId} onChange={(e) => setRow(i, { catId: e.target.value })}>
                <option value="">Pick category…</option>
                {categories.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <div className="grid grid-cols-3 gap-1.5">
                <Input type="number" value={r.price || ""} onChange={(e) => setRow(i, { price: Number(e.target.value) })} placeholder="Price ৳ *" />
                <Input type="number" value={r.flash || ""} onChange={(e) => setRow(i, { flash: Number(e.target.value) })} placeholder="Flash ৳" />
                <Input type="number" value={r.stock || ""} onChange={(e) => setRow(i, { stock: Number(e.target.value) })} placeholder="Stock" />
              </div>
            </div>
            <div className="mt-2.5">
              <MediaPicker value={r.image} onChange={(v) => setRow(i, { image: v })} placeholder="Photo URL or click Upload…" />
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

const FORM_TABS = ["1. Basics & Pricing", "2. Rich Description", "3. Color & Size Variants", "4. Photos & Video", "5. P-to-P SEO & Visibility"] as const;

const VIDEO_PLATFORMS = [
  { id: "auto", label: "Auto Detect" },
  { id: "youtube", label: "YouTube" },
  { id: "facebook", label: "Facebook" },
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram" },
  { id: "vimeo", label: "Vimeo" },
  { id: "dailymotion", label: "Dailymotion" },
  { id: "twitter", label: "Twitter / X" },
  { id: "loom", label: "Loom" },
  { id: "streamable", label: "Streamable" },
  { id: "direct", label: "Direct MP4 / WebM" },
  { id: "other", label: "Other Web Embed" },
];

function ProductForm({ initial, onClose, onSave }: { initial: Product; onClose: () => void; onSave: (p: Product) => void }) {
  const { brands, categories, products, settings, toast } = useStore();
  const [p, setP] = useState<Product>(() => {
    const copy = structuredClone(initial);
    // Ensure variants have variantCode and extraPrices
    copy.variants = (copy.variants || []).map((v) => ({
      ...v,
      variantCode: v.variantCode || "",
      extraPrices: v.extraPrices || Object.fromEntries(Object.keys(v.sizes || {}).map((sz) => [sz, 0])),
    }));
    if (!copy.variants.length) {
      copy.variants = [{ color: "Default", hex: "#111827", variantCode: "", sizes: { Std: 10 }, extraPrices: { Std: 0 } }];
    }
    return copy;
  });

  const [activeTab, setActiveTab] = useState<(typeof FORM_TABS)[number]>("1. Basics & Pricing");
  const [showQuickImport, setShowQuickImport] = useState(!initial.id);
  const [importUrl, setImportUrl] = useState("");
  const [importStatus, setImportStatus] = useState<{ msg: string; type: "info" | "success" | "err" } | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  // Categories & Presets
  const [newCatName, setNewCatName] = useState("");
  const [newSizeName, setNewSizeName] = useState("");
  const [imgUrlInput, setImgUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [htmlMode, setHtmlMode] = useState(false);
  const [aiLang, setAiLang] = useState<"hybrid" | "bn" | "en">("hybrid");
  const [generatingSeo, setGeneratingSeo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const rteRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }));
  const cats = categories.items.filter((c) => c.brandId === p.brandId || c.brandId === "main" || (c.sharedBrandIds || []).includes(p.brandId));
  const final = p.price - p.flash;
  const margin = final > 0 ? ((final - p.cost) / final) * 100 : 0;

  const setVar = (i: number, f: (v: Variant) => Variant) => set("variants", p.variants.map((v, k) => (k === i ? f(v) : v)));

  // Global Presets
  const applyPreset = (sizes: string[]) => {
    set("variants", p.variants.map((v) => {
      const nextSizes: Record<string, number> = {};
      const nextExtra: Record<string, number> = {};
      sizes.forEach((s) => {
        nextSizes[s] = v.sizes[s] ?? 10;
        nextExtra[s] = v.extraPrices?.[s] ?? 0;
      });
      return { ...v, sizes: nextSizes, extraPrices: nextExtra };
    }));
    toast(`Preset applied: ${sizes.join(", ")}`);
  };

  const addCustomSizeGlobal = () => {
    const s = newSizeName.trim();
    if (!s) return;
    set("variants", p.variants.map((v) => ({
      ...v,
      sizes: { ...v.sizes, [s]: v.sizes[s] ?? 10 },
      extraPrices: { ...v.extraPrices, [s]: v.extraPrices?.[s] ?? 0 },
    })));
    setNewSizeName("");
    toast(`Added size "${s}" to all variants`);
  };

  const removeSizeGlobal = (sz: string) => {
    set("variants", p.variants.map((v) => {
      const nextSizes = { ...v.sizes };
      const nextExtra = { ...(v.extraPrices || {}) };
      delete nextSizes[sz];
      delete nextExtra[sz];
      return { ...v, sizes: nextSizes, extraPrices: nextExtra };
    }));
  };

  const copyVariantToAll = (vi: number) => {
    if (p.variants.length <= 1) {
      toast("No other variants to apply to!", "info");
      return;
    }
    const source = p.variants[vi];
    set("variants", p.variants.map((v, i) => {
      if (i === vi) return v;
      return {
        ...v,
        image: source.image,
        sizes: structuredClone(source.sizes),
        extraPrices: structuredClone(source.extraPrices || {}),
      };
    }));
    toast(`Copied image & sizes from "${source.color}" to all other variants!`);
  };

  // Rich Text Editor Commands
  const execRte = (cmd: string, val: string = "") => {
    if (rteRef.current) {
      rteRef.current.focus();
      document.execCommand(cmd, false, val);
      set("desc", rteRef.current.innerHTML);
    }
  };

  const handleRteInput = () => {
    if (rteRef.current) {
      set("desc", rteRef.current.innerHTML);
    }
  };

  // Sync RTE content when switching tabs or external fill
  useEffect(() => {
    if (rteRef.current && !htmlMode && rteRef.current.innerHTML !== p.desc) {
      rteRef.current.innerHTML = p.desc || "";
    }
  }, [p.desc, htmlMode, activeTab]);

  // AI Write Rich Description
  const generateAIDesc = () => {
    if (!p.name.trim()) {
      toast("Please enter a product name first", "err");
      return;
    }
    const draftHtml = `
      <h2>${p.name}</h2>
      <p><strong>${p.name}</strong> — প্রিমিয়াম কোয়ালিটি ও আকর্ষণীয় ডিজাইনের চমৎকার সমাহার। নিত্যদিনের ব্যবহার কিংবা বিশেষ মুহূর্তের জন্য এটি নিখুঁত পছন্দ।</p>
      <h3>মূল বৈশিষ্ট্যসমূহ:</h3>
      <ul>
        <li>১০০% প্রিমিয়াম ও টেকসই ম্যাটেরিয়াল দ্বারা তৈরি</li>
        <li>আরামদায়ক ও আকর্ষণীয় ফিনিশিং</li>
        <li>লং-লাস্টিং ফ্যাব্রিক / বিল্ড কোয়ালিটি</li>
        <li>ক্যাশ অন ডেলিভারিতে সারাদেশে দ্রুত হোম ডেলিভারি সুবিধা</li>
      </ul>
      <blockquote>পণ্য হাতে পেয়ে চেক করে নেওয়ার সুবিধা এবং দ্রুত এক্সচেঞ্জ গ্যারান্টি।</blockquote>
    `.trim();
    set("desc", draftHtml);
    if (rteRef.current) rteRef.current.innerHTML = draftHtml;
    toast("✨ AI rich description generated!", "ok");
  };

  // 1-Click Auto Import by URL
  const runAutoImport = async () => {
    const rawUrl = importUrl.trim();
    if (!rawUrl) {
      toast("দয়া করে একটি প্রোডাক্ট লিঙ্ক দিন", "err");
      return;
    }
    setImportBusy(true);
    setImportStatus({ msg: "🔍 প্রডাক্ট ডাটা খোঁজা হচ্ছে...", type: "info" });
    try {
      const u = new URL(rawUrl.startsWith("http") ? rawUrl : "https://" + rawUrl);
      const pid = u.searchParams.get("id") || u.searchParams.get("product_id") || u.searchParams.get("pid") || u.pathname.match(/\/product(?:s)?\/([a-zA-Z0-9_\-]+)/)?.[1];

      // 1. Check local catalog first
      if (pid) {
        const local = products.items.find((x) => x.id === pid || x.sku.toLowerCase() === pid.toLowerCase() || x.seoSlug?.toLowerCase() === pid.toLowerCase());
        if (local) {
          setP((prev) => ({
            ...prev,
            name: local.name,
            sku: local.sku || prev.sku,
            price: local.price,
            cost: local.cost,
            flash: local.flash,
            flashEnd: local.flashEnd,
            desc: local.desc,
            galleryImages: local.galleryImages || [],
            videoUrl: local.videoUrl || "",
            videoType: local.videoType || "auto",
            variants: structuredClone(local.variants),
            tags: local.tags || "",
            seoTitle: local.seoTitle || "",
            seoSlug: local.seoSlug || "",
            seoDesc: local.seoDesc || "",
          }));
          setImportStatus({ msg: `✅ লোকাল প্রোডাক্ট "${local.name}" থেকে সফলভাবে লোড হয়েছে!`, type: "success" });
          toast("Product loaded from existing catalog!");
          return;
        }
      }

      // 2. Fetch remote /public-data?product_id=...
      let fetchedProduct: any = null;
      if (pid) {
        try {
          const apiTarget = `${u.origin}/public-data?product_id=${encodeURIComponent(pid)}`;
          const r = await fetch(apiTarget).then((res) => res.json());
          if (r?.success && r?.product) fetchedProduct = r.product;
        } catch {}
      }

      if (fetchedProduct) {
        const gall = Array.isArray(fetchedProduct.gallery_images)
          ? fetchedProduct.gallery_images
          : typeof fetchedProduct.gallery_images === "string"
          ? JSON.parse(fetchedProduct.gallery_images || "[]")
          : [];
        const vars = Array.isArray(fetchedProduct.variants)
          ? fetchedProduct.variants
          : typeof fetchedProduct.variants === "string"
          ? JSON.parse(fetchedProduct.variants || "[]")
          : [];

        setP((prev) => ({
          ...prev,
          name: fetchedProduct.name || prev.name,
          sku: fetchedProduct.sku || prev.sku,
          price: Number(fetchedProduct.base_price || prev.price),
          flash: Number(fetchedProduct.flash_sale_price || 0),
          desc: fetchedProduct.description || prev.desc,
          galleryImages: gall.length ? gall : prev.galleryImages,
          videoUrl: fetchedProduct.video_url || prev.videoUrl,
          videoType: fetchedProduct.video_type || prev.videoType,
          variants: vars.length ? vars.map((v: any) => ({
            color: v.color || v.colorName || "Default",
            hex: v.hex || v.colorHex || "#111827",
            variantCode: v.variantCode || "",
            image: v.image || v.imageUrl || "",
            sizes: Array.isArray(v.sizes)
              ? Object.fromEntries(v.sizes.map((s: any) => [s.size || "Std", Number(s.stock ?? 10)]))
              : v.sizes || { Std: 10 },
            extraPrices: Array.isArray(v.sizes)
              ? Object.fromEntries(v.sizes.map((s: any) => [s.size || "Std", Number(s.extraPrice ?? 0)]))
              : {},
          })) : prev.variants,
          tags: fetchedProduct.tags || prev.tags,
          seoTitle: fetchedProduct.seo_title || prev.seoTitle,
          seoSlug: fetchedProduct.slug || prev.seoSlug,
          seoDesc: fetchedProduct.seo_description || prev.seoDesc,
        }));
        setImportStatus({ msg: `✅ রিমোট শপ থেকে "${fetchedProduct.name}" সফলভাবে লোড হয়েছে!`, type: "success" });
        toast("Remote product data imported!");
        return;
      }

      // 3. Fallback: Parse HTML meta tags
      const res = await fetch(rawUrl);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const title = doc.querySelector('meta[property="og:title"]')?.getAttribute("content") || doc.querySelector("title")?.textContent || "Imported Product";
      const desc = doc.querySelector('meta[property="og:description"]')?.getAttribute("content") || doc.querySelector('meta[name="description"]')?.getAttribute("content") || "";
      const img = doc.querySelector('meta[property="og:image"]')?.getAttribute("content") || "";
      const priceStr = doc.querySelector('meta[property="product:price:amount"]')?.getAttribute("content") || (html.match(/(?:৳|BDT|TK\.?)\s*([0-9,]{2,7})/i)?.[1] || "0").replace(/,/g, "");

      setP((prev) => ({
        ...prev,
        name: title.trim(),
        price: Number(priceStr) || prev.price || 990,
        desc: desc.trim() || prev.desc,
        galleryImages: img ? [img] : prev.galleryImages,
      }));
      setImportStatus({ msg: `✅ ওয়েব পেজ থেকে "${title.trim()}" লোড হয়েছে!`, type: "success" });
      toast("Web metadata imported!");
    } catch (err: any) {
      setImportStatus({ msg: `❌ ইমপোর্ট ত্রুটি: ${err?.message || "URL লোড করা যায়নি"}`, type: "err" });
      toast("Import failed. Check URL", "err");
    } finally {
      setImportBusy(false);
    }
  };

  // Photo Upload
  const handlePhotoFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const f of files) {
        const url = await uploadImageFile(f, { provider: settings.imageProvider, imgbbKey: settings.imgbbApiKey });
        if (url) uploaded.push(url);
      }
      if (uploaded.length) {
        set("galleryImages", [...(p.galleryImages || []), ...uploaded]);
        toast(`${uploaded.length} photo(s) uploaded to Cloudflare R2 / Server ✔`);
      }
    } catch (err: any) {
      toast(err?.message || "Photo upload failed", "err");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const addImageUrl = () => {
    const u = imgUrlInput.trim();
    if (!u) return;
    set("galleryImages", [...(p.galleryImages || []), u]);
    setImgUrlInput("");
  };

  const quickCreateCat = () => {
    const n = newCatName.trim();
    if (!n) return;
    const id = "cat_" + Date.now();
    categories.add({ id, name: n, icon: "🛍️", brandId: p.brandId || "main", sort: categories.items.length + 1, active: true });
    set("catIds", [...p.catIds, id]);
    setNewCatName("");
    toast(`Category "${n}" created & selected`);
  };

  // P-to-P Auto Tags Append
  const appendAutoTags = () => {
    const brandObj = brands.items.find((b) => b.id === p.brandId);
    const catNames = cats.filter((c) => p.catIds.includes(c.id)).map((c) => c.name);
    const words = [p.name, brandObj?.name, ...catNames, "best price bd", "cash on delivery", "online shopping bangladesh"]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .split(/[\s,–—\-_/]+/)
      .filter((w) => w.length >= 2);

    const autoSet = new Set<string>();
    words.forEach((w) => autoSet.add(w));
    if (brandObj?.name) autoSet.add(brandObj.name.toLowerCase());
    catNames.forEach((c) => autoSet.add(c.toLowerCase()));

    const existingTags = (p.tags || "").split(",").map((s) => s.trim()).filter(Boolean);
    const merged = Array.from(new Set([...existingTags, ...autoSet])).join(", ");
    set("tags", merged);
    set("seoKeywords", merged);
    toast("➕ Auto tags appended!", "ok");
  };

  // Full AI SEO Generator (Hybrid / Bangla / English)
  const generateAISeo = async () => {
    if (!p.name.trim()) {
      toast("Please enter product name first", "err");
      return;
    }
    setGeneratingSeo(true);
    try {
      const catNames = cats.filter((c) => p.catIds.includes(c.id)).map((c) => c.name).join(", ");
      const latinClean = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "product";

      let seoTitle = "";
      let seoDesc = "";
      let slug = latinClean;
      let tags = "";

      if (aiLang === "hybrid") {
        seoTitle = `${p.name} — সেরা দামে কিনুন BD`;
        seoDesc = `${p.name} কিনুন সবচেয়ে সাশ্রয়ী মূল্যে। ১০০% প্রিমিয়াম কোয়ালিটি ও দ্রুত হোম ডেলিভারি সুবিধা সমগ্র বাংলাদেশে। ক্যাশ অন ডেলিভারি প্রযোজ্য!`;
        tags = `${p.name.toLowerCase()}, buy online bd, ${latinClean}, সেরা দাম, ক্যাশ অন ডেলিভারি, ${catNames ? catNames.toLowerCase() : "fashion"}`;
      } else if (aiLang === "bn") {
        seoTitle = `${p.name} - কিনুন অনলাইন বাংলাদেশ`;
        seoDesc = `${p.name} আকর্ষণীয় মূল্যে কিনুন। শতভাগ অরিজিনাল পণ্য ও দ্রুততম ক্যাশ অন ডেলিভারি সার্ভিস।`;
        tags = `${p.name.toLowerCase()}, অনলাইন শপিং, সেরা অফার, ক্যাশ অন ডেলিভারি, ${catNames ? catNames.toLowerCase() : "শপিং"}`;
      } else {
        seoTitle = `${p.name} - Buy Online at Best Price in Bangladesh`;
        seoDesc = `Order ${p.name} online at the best price in Bangladesh. Premium quality, reliable warranty, and fast cash on delivery nationwide.`;
        tags = `${p.name.toLowerCase()}, buy ${p.name.toLowerCase()}, online shopping bd, best price, ${catNames ? catNames.toLowerCase() : "collection"}`;
      }

      setP((cur) => ({
        ...cur,
        seoTitle,
        seoSlug: slug,
        seoDesc,
        tags,
        seoKeywords: tags,
      }));
      toast(`✨ Full SEO generated (${aiLang.toUpperCase()} strategy)!`, "ok");
    } finally {
      setGeneratingSeo(false);
    }
  };

  // Parse tags for live badge preview
  const manualTagList = useMemo(() => {
    return (p.tags || "").split(",").map((s) => s.trim()).filter(Boolean);
  }, [p.tags]);

  const autoTagList = useMemo(() => {
    const list: string[] = [];
    const b = brands.items.find((x) => x.id === p.brandId);
    if (b?.name) list.push(b.name);
    cats.filter((c) => p.catIds.includes(c.id)).forEach((c) => list.push(c.name));
    return list;
  }, [p.brandId, p.catIds, brands.items, cats]);

  const totalStockUnits = p.variants.reduce((sum, v) => sum + Object.values(v.sizes).reduce((a, b) => a + b, 0), 0);

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={p.id ? `Edit: ${initial.name}` : "Dedicated Product Studio"}
      sub="Dedicated multi-variant builder, Rich Text Editor, 1-Click Auto Import & P-to-P SEO Automation."
      footer={
        <>
          <div className="mr-auto flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-800">{p.variants.length} color variant{p.variants.length > 1 ? "s" : ""}</span>
            <span>·</span>
            <span className="font-semibold text-indigo-600">{totalStockUnits} total units</span>
            <span>·</span>
            <span>Margin: <b className={cn(margin < 15 ? "text-amber-600" : "text-emerald-600")}>{pct(margin, 0)}</b></span>
          </div>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={<Check size={15} />} onClick={() => onSave(p)}>
            💾 Save Product
          </Button>
        </>
      }
    >
      {/* ── Quick Auto-Import Card ── */}
      <div className="mb-4 rounded-2xl border border-dashed border-indigo-200 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-indigo-50/70 p-3.5 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
            <Link2 size={15} className="text-indigo-600" />
            <span>⚡ 1-Click Auto Import Product by URL (Partner / Same Site)</span>
          </div>
          <button
            type="button"
            onClick={() => setShowQuickImport(!showQuickImport)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            {showQuickImport ? "Collapse ▲" : "Expand ▼"}
          </button>
        </div>
        {showQuickImport && (
          <div className="space-y-2">
            <p className="text-xs text-slate-600 leading-relaxed">
              পার্টনার শপ বা একই কোডবেজের যেকোনো প্রোডাক্ট পেজ লিংক দিন (যেমন: <code>https://royalpanjabi.shop/product.html?id=prod_8</code>)। স্বয়ংক্রিয়ভাবে নাম, দাম, ছবি, ডেসক্রিপশন এবং কালার ও সাইজ ভ্যারিয়েন্ট লোড হয়ে ফর্মে বসে যাবে।
            </p>
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[240px]">
                <Input
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), runAutoImport())}
                  placeholder="https://partner-shop.com/product.html?id=prod_..."
                  className="pl-8 text-xs"
                />
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">🔗</span>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={<DownloadCloud size={14} />}
                disabled={importBusy || !importUrl.trim()}
                onClick={runAutoImport}
              >
                {importBusy ? "Fetching…" : "Fetch & Fill"}
              </Button>
              <Button size="sm" onClick={() => { setImportUrl(""); setImportStatus(null); }}>
                Clear
              </Button>
            </div>
            {importStatus && (
              <div
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-medium",
                  importStatus.type === "success" && "border border-emerald-200 bg-emerald-50 text-emerald-800",
                  importStatus.type === "info" && "border border-blue-200 bg-blue-50 text-blue-800",
                  importStatus.type === "err" && "border border-rose-200 bg-rose-50 text-rose-800"
                )}
              >
                {importStatus.msg}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1">
        {FORM_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition",
              activeTab === tab ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Basics & Pricing ── */}
      {activeTab === "1. Basics & Pricing" && (
        <div className="space-y-4">
          <Field label="Product Name" required>
            <Input
              value={p.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Royal Embroidered Cotton Panjabi / Ultra Bass Earbuds"
              autoFocus
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Brand / Storefront">
              <Select value={p.brandId} onChange={(e) => set("brandId", e.target.value)}>
                {brands.items.map((b) => (
                  <option key={b.id} value={b.id}>{b.emoji} {b.name} {b.isMain ? "(Main)" : ""}</option>
                ))}
              </Select>
            </Field>

            <Field label="Product SKU (Auto 2-Letter Engine)">
              <div className="flex gap-2">
                <Input
                  value={p.sku}
                  onChange={(e) => set("sku", e.target.value)}
                  placeholder="e.g. PJ-104"
                />
                <Button
                  size="sm"
                  variant="soft"
                  icon={<Zap size={14} />}
                  onClick={() => set("sku", generatePermanentSku(p.name, products.items.map((x) => x.sku)))}
                  title="Generate permanent 2-letter SKU from name"
                >
                  ⚡ Auto
                </Button>
              </div>
            </Field>
          </div>

          {p.brandId && p.brandId !== "main" && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 px-4 py-2">
              <Toggle
                checked={Boolean(p.showOnMain)}
                onChange={(v) => set("showOnMain", v)}
                label="🌐 Show on Main Site too (Cross-Storefront Sharing)"
                hint="Shows this product on both the Brand Storefront and the Main Site storefront without duplicating database rows."
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Base Selling Price (৳)" required>
              <Input
                type="number"
                value={p.price || ""}
                onChange={(e) => set("price", Number(e.target.value))}
                placeholder="1450"
              />
            </Field>
            <Field label="Flash Discount (৳)" hint="Final = Base Price − Discount">
              <Input
                type="number"
                value={p.flash || ""}
                onChange={(e) => set("flash", Number(e.target.value))}
                placeholder="250"
              />
            </Field>
            <Field label="Cost Price (৳)" hint="Private: for margin calculate">
              <Input
                type="number"
                value={p.cost || ""}
                onChange={(e) => set("cost", Number(e.target.value))}
                placeholder="650"
              />
            </Field>
          </div>

          {p.flash > 0 && (
            <Field label="Flash Sale End Date">
              <Input
                type="datetime-local"
                value={p.flashEnd ? p.flashEnd.slice(0, 16) : ""}
                onChange={(e) => set("flashEnd", e.target.value ? new Date(e.target.value).toISOString() : undefined)}
              />
            </Field>
          )}

          {/* Profit & Margin Calculator */}
          <div className="grid grid-cols-3 gap-3 rounded-2xl bg-slate-50 p-4 border border-slate-200/80">
            <div>
              <div className="text-xs text-slate-500">Customer pays</div>
              <div className="text-lg font-bold text-slate-900">{money(final)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Profit per sale</div>
              <div className={cn("text-lg font-bold", final - p.cost < 0 ? "text-rose-600" : "text-emerald-600")}>
                {money(final - p.cost)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Profit margin</div>
              <div className={cn("text-lg font-bold", margin < 15 ? "text-amber-600" : "text-emerald-600")}>
                {pct(margin, 0)}
              </div>
            </div>
          </div>

          {margin < 15 && p.price > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
              <AlertTriangle size={15} className="shrink-0" />
              <span>Profit margin is below 15% — after packaging, advertising, and delivery return costs you may risk loss.</span>
            </div>
          )}

          <Field label="Categories (Multi-Select)" required hint="Select multiple categories or add new ones on the fly.">
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => {
                const on = p.catIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => set("catIds", on ? p.catIds.filter((x) => x !== c.id) : [...p.catIds, c.id])}
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition",
                      on
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
                    )}
                  >
                    <IconView icon={c.icon} size={14} /> {c.name}
                  </button>
                );
              })}
            </div>
            <div className="mt-2.5 flex max-w-sm gap-2">
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), quickCreateCat())}
                placeholder="+ Quick Add Category…"
                className="h-8 text-xs"
              />
              <Button size="sm" onClick={quickCreateCat}>Add</Button>
            </div>
          </Field>
        </div>
      )}

      {/* ── TAB 2: Rich Description ── */}
      {activeTab === "2. Rich Description" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">📝 Rich Text Product Description</label>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="soft"
                icon={<Sparkles size={13} className="text-amber-500" />}
                onClick={generateAIDesc}
                title="Generate rich HTML product description with Gemini AI"
              >
                ✨ AI Write
              </Button>
              <button
                type="button"
                onClick={() => setHtmlMode(!htmlMode)}
                className={cn("rounded-lg px-2 py-1 text-xs font-bold transition", htmlMode ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700")}
                title="Toggle HTML Source Code View"
              >
                &lt;/&gt; {htmlMode ? "Visual View" : "HTML Mode"}
              </button>
            </div>
          </div>

          {!htmlMode ? (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
              {/* RTE Toolbar */}
              <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50/80 p-1.5 text-slate-700">
                <select
                  onChange={(e) => { execRte("formatBlock", e.target.value); e.target.value = "p"; }}
                  className="h-7 rounded border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="p">Paragraph</option>
                  <option value="h1">Heading 1</option>
                  <option value="h2">Heading 2</option>
                  <option value="h3">Heading 3</option>
                  <option value="blockquote">Quote</option>
                </select>

                <div className="h-4 w-px bg-slate-300 mx-1" />

                <button type="button" onClick={() => execRte("bold")} className="grid h-7 w-7 place-items-center rounded hover:bg-slate-200" title="Bold">
                  <Bold size={13} />
                </button>
                <button type="button" onClick={() => execRte("italic")} className="grid h-7 w-7 place-items-center rounded hover:bg-slate-200" title="Italic">
                  <Italic size={13} />
                </button>
                <button type="button" onClick={() => execRte("underline")} className="grid h-7 w-7 place-items-center rounded hover:bg-slate-200" title="Underline">
                  <Underline size={13} />
                </button>
                <button type="button" onClick={() => execRte("strikeThrough")} className="grid h-7 w-7 place-items-center rounded hover:bg-slate-200" title="Strikethrough">
                  <Strikethrough size={13} />
                </button>

                <div className="h-4 w-px bg-slate-300 mx-1" />

                {/* Color pickers */}
                <label className="relative grid h-7 w-7 cursor-pointer place-items-center rounded hover:bg-slate-200" title="Highlight Color">
                  <span className="rounded bg-amber-300 px-1 text-[10px] font-black text-black">A</span>
                  <input type="color" defaultValue="#fef08a" onChange={(e) => execRte("hiliteColor", e.target.value)} className="sr-only" />
                </label>
                <label className="relative grid h-7 w-7 cursor-pointer place-items-center rounded hover:bg-slate-200" title="Text Color">
                  <span className="text-xs font-black text-rose-600 underline">A</span>
                  <input type="color" defaultValue="#e11d48" onChange={(e) => execRte("foreColor", e.target.value)} className="sr-only" />
                </label>

                <div className="h-4 w-px bg-slate-300 mx-1" />

                <button type="button" onClick={() => execRte("insertUnorderedList")} className="grid h-7 w-7 place-items-center rounded hover:bg-slate-200" title="Bullet List">
                  <List size={13} />
                </button>
                <button type="button" onClick={() => execRte("insertOrderedList")} className="grid h-7 w-7 place-items-center rounded hover:bg-slate-200" title="Numbered List">
                  <ListOrdered size={13} />
                </button>

                <div className="h-4 w-px bg-slate-300 mx-1" />

                <button type="button" onClick={() => execRte("justifyLeft")} className="grid h-7 w-7 place-items-center rounded hover:bg-slate-200" title="Align Left">
                  <Text size={13} />
                </button>
                <button type="button" onClick={() => execRte("justifyCenter")} className="grid h-7 w-7 place-items-center rounded hover:bg-slate-200" title="Align Center">
                  ≡
                </button>
                <button type="button" onClick={() => execRte("justifyRight")} className="grid h-7 w-7 place-items-center rounded hover:bg-slate-200" title="Align Right">
                  ≢
                </button>

                <div className="h-4 w-px bg-slate-300 mx-1" />

                <button type="button" onClick={() => execRte("removeFormat")} className="h-7 px-2 text-[11px] font-bold text-slate-500 hover:bg-slate-200 rounded" title="Clear Formatting">
                  ✕ fmt
                </button>
              </div>

              {/* Editable area */}
              <div
                ref={rteRef}
                contentEditable
                onInput={handleRteInput}
                className="min-h-[180px] p-4 text-sm leading-relaxed text-slate-800 outline-none prose prose-sm max-w-none"
                data-placeholder="Write engaging product details, fabric specs, care instructions…"
              />
            </div>
          ) : (
            <Textarea
              value={p.desc}
              onChange={(e) => set("desc", e.target.value)}
              rows={9}
              className="font-mono text-xs"
              placeholder="<h2>Heading</h2><p>HTML description...</p>"
            />
          )}

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>💡 You can format headings, lists, colors and copy-paste rich content from supplier sheets.</span>
            <span>{(p.desc || "").replace(/<[^>]*>/g, "").trim().length} chars</span>
          </div>
        </div>
      )}

      {/* ── TAB 3: Dedicated Color & Size Variants ── */}
      {activeTab === "3. Color & Size Variants" && (
        <div className="space-y-4">
          {/* Global Quick Size Presets */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 p-3 border border-slate-200">
            <span className="text-xs font-bold text-slate-500">Quick Presets:</span>
            <Button size="sm" onClick={() => applyPreset(["S", "M", "L", "XL", "XXL"])}>Clothing (S–XXL)</Button>
            <Button size="sm" onClick={() => applyPreset(["M", "L", "XL", "XXL"])}>Panjabi (M–XXL)</Button>
            <Button size="sm" onClick={() => applyPreset(["39", "40", "41", "42", "43", "44"])}>Shoes (39–44)</Button>
            <Button size="sm" onClick={() => applyPreset(["Std"])}>One size (Std)</Button>

            {/* Active sizes quick removal */}
            {Array.from(new Set(p.variants.flatMap((v) => Object.keys(v.sizes)))).map((sz) => (
              <span key={sz} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700">
                <span>{sz}</span>
                <button type="button" onClick={() => removeSizeGlobal(sz)} className="text-slate-400 hover:text-rose-600" title={`Remove ${sz} from all variants`}>×</button>
              </span>
            ))}

            <div className="ml-auto flex items-center gap-1.5">
              <Input
                value={newSizeName}
                onChange={(e) => setNewSizeName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomSizeGlobal())}
                placeholder="+ Custom size (e.g. 3XL)"
                className="h-8 !w-36 text-xs"
              />
              <Button size="sm" onClick={addCustomSizeGlobal}>Add</Button>
            </div>
          </div>

          {/* Color Variant List */}
          <div className="space-y-4">
            {p.variants.map((v, vi) => (
              <div key={vi} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                {/* Header Row */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div
                    className="h-8 w-8 rounded-full border border-slate-300 shadow-inner shrink-0"
                    style={{ background: v.hex || "#111827" }}
                  />
                  <input
                    type="color"
                    value={v.hex}
                    onChange={(e) => setVar(vi, (x) => ({ ...x, hex: e.target.value }))}
                    className="h-8 w-9 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                    title="Change Color Hex"
                  />
                  <Input
                    value={v.color}
                    onChange={(e) => setVar(vi, (x) => ({ ...x, color: e.target.value }))}
                    placeholder="Color Name (e.g. Royal Blue)"
                    className="flex-1 min-w-[140px] font-semibold text-xs"
                  />
                  <Input
                    value={v.variantCode || ""}
                    onChange={(e) => setVar(vi, (x) => ({ ...x, variantCode: e.target.value }))}
                    placeholder="Code (e.g. A1, B2)"
                    className="w-24 text-xs font-mono"
                    title="Variant Code printed on photo (A1, A2, etc.)"
                  />
                  <Button
                    size="sm"
                    variant="soft"
                    icon={<Copy size={13} />}
                    onClick={() => copyVariantToAll(vi)}
                    title="Copy image and sizes to all other color variants"
                  >
                    📋 Apply to All
                  </Button>
                  {p.variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => set("variants", p.variants.filter((_, k) => k !== vi))}
                      className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                      title="Remove this color variant"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {/* Color Photo */}
                <div className="pt-1">
                  <label className="mb-1 block text-[11px] font-bold text-slate-500">Color Photo (Direct URL or R2 Upload)</label>
                  <MediaPicker
                    value={v.image || ""}
                    onChange={(url) => setVar(vi, (x) => ({ ...x, image: url }))}
                    placeholder="Upload or paste image URL for this specific color…"
                  />
                </div>

                {/* Size, Stock & Extra Price Grid */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      📏 Sizes, Inventory &amp; Extra Pricing:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const newSz = prompt("Enter new size name (e.g. 42, XXL, Free):");
                        if (newSz && newSz.trim()) {
                          const sTrim = newSz.trim();
                          setVar(vi, (x) => ({
                            ...x,
                            sizes: { ...x.sizes, [sTrim]: 10 },
                            extraPrices: { ...(x.extraPrices || {}), [sTrim]: 0 },
                          }));
                        }
                      }}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      + Add Size to this Color
                    </button>
                  </div>

                  <div className="space-y-2">
                    {Object.keys(v.sizes).map((sz) => (
                      <div key={sz} className="grid grid-cols-[100px_1fr_1fr_auto] items-center gap-2">
                        <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-center text-xs font-bold text-slate-800">
                          {sz}
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            min={0}
                            value={v.sizes[sz] ?? 0}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setVar(vi, (x) => ({ ...x, sizes: { ...x.sizes, [sz]: val } }));
                            }}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-400"
                            placeholder="Stock"
                          />
                          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-semibold">pcs</span>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            value={v.extraPrices?.[sz] ?? 0}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setVar(vi, (x) => ({
                                ...x,
                                extraPrices: { ...(x.extraPrices || {}), [sz]: val },
                              }));
                            }}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-400"
                            placeholder="Extra ৳"
                          />
                          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-semibold">৳ extra</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setVar(vi, (x) => {
                              const nextSizes = { ...x.sizes };
                              const nextExtra = { ...(x.extraPrices || {}) };
                              delete nextSizes[sz];
                              delete nextExtra[sz];
                              return { ...x, sizes: nextSizes, extraPrices: nextExtra };
                            });
                          }}
                          className="grid h-7 w-7 place-items-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition"
                          title="Remove size"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button
            variant="soft"
            icon={<Plus size={15} />}
            onClick={() => {
              const defaultSizes = Object.keys(p.variants[0]?.sizes || { Std: 10 });
              set("variants", [
                ...p.variants,
                {
                  color: `Color ${p.variants.length + 1}`,
                  hex: "#8b1a1a",
                  variantCode: "",
                  sizes: Object.fromEntries(defaultSizes.map((s) => [s, 10])),
                  extraPrices: Object.fromEntries(defaultSizes.map((s) => [s, 0])),
                },
              ]);
            }}
          >
            + Add Color Variant
          </Button>
        </div>
      )}

      {/* ── TAB 4: Photos & Video ── */}
      {activeTab === "4. Photos & Video" && (
        <div className="space-y-5">
          <Field
            label="Product Gallery Photos"
            hint="Upload high-res photos to Cloudflare R2 / Server or paste direct URLs. First photo will be the main cover."
          >
            <div className="mb-3 flex flex-wrap gap-2">
              <div className="flex-1 min-w-[240px]">
                <Input
                  value={imgUrlInput}
                  onChange={(e) => setImgUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addImageUrl())}
                  placeholder="Paste photo URL (https://...) and click Add"
                  className="text-xs"
                />
              </div>
              <Button size="sm" onClick={addImageUrl}>Add URL</Button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoFiles} />
              <Button
                variant="primary"
                size="sm"
                icon={<Upload size={14} />}
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? "Uploading to R2…" : "Upload to R2"}
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {(p.galleryImages || []).map((img, idx) => (
                <div key={idx} className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
                  <img src={img} alt="" className="h-full w-full object-cover" />
                  {idx === 0 && (
                    <span className="absolute left-2 top-2 rounded-md bg-slate-900/85 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                      Cover
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => set("galleryImages", (p.galleryImages || []).filter((_, k) => k !== idx))}
                    className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-rose-600 text-white shadow hover:bg-rose-700 transition"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="grid aspect-square place-items-center rounded-2xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition"
              >
                <div className="flex flex-col items-center gap-1 text-xs font-semibold">
                  <Plus size={20} />
                  <span>{uploading ? "Uploading…" : "Add Photo"}</span>
                </div>
              </button>
            </div>
          </Field>

          {/* 12 Video Platforms Selector */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Film size={15} className="text-indigo-600" />
              <span>Product Video Integration (Reels, TikTok, YouTube &amp; Direct MP4)</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
              <Field label="Video Link / URL">
                <Input
                  value={p.videoUrl || ""}
                  onChange={(e) => set("videoUrl", e.target.value)}
                  placeholder="https://youtube.com/watch?v=... or https://tiktok.com/@..."
                  className="text-xs"
                />
              </Field>
              <Field label="Video Platform (12 Supported)">
                <Select
                  value={p.videoType || "auto"}
                  onChange={(e) => set("videoType", e.target.value)}
                  className="text-xs font-semibold"
                >
                  {VIDEO_PLATFORMS.map((pl) => (
                    <option key={pl.id} value={pl.id}>{pl.label}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <p className="text-[11px] text-slate-500">
              Auto Detect automatically parses YouTube Shorts, Facebook Reels, TikTok embeds, and Vimeo videos.
            </p>
          </div>
        </div>
      )}

      {/* ── TAB 5: P-to-P SEO & Visibility ── */}
      {activeTab === "5. P-to-P SEO & Visibility" && (
        <div className="space-y-5">
          {/* Product & Photo SEO (P-to-P Metadata) Card */}
          <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/30 p-4 space-y-3.5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-600" />
                <span className="text-xs font-bold text-indigo-950">
                  Product &amp; Photo SEO (P-to-P Metadata Automation)
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Auto EXIF Injector Active
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              নিচের ফোকাস ট্যাগ ও মেটাডাটা স্বয়ংক্রিয়ভাবে একত্র হয়ে <b>ছবির বাইনারি মেটাডাটা (Title, Keywords, Author, Copyright)</b> হিসেবে ইনজেক্ট হবে এবং Google Image Search ও Facebook শেয়ারে র‍্যাঙ্ক করবে।
            </p>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-700">🏷️ Product Focus Tags / Keywords</label>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
                  <span className="font-bold text-slate-500">🌐 AI Lang:</span>
                  <select
                    value={aiLang}
                    onChange={(e) => setAiLang(e.target.value as any)}
                    className="border-0 bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="hybrid">🌐 মিশ্র (Eng Name + বাংলা বিবরণী)</option>
                    <option value="bn">🇧🇩 সম্পূর্ণ বাংলা</option>
                    <option value="en">🇬🇧 English</option>
                  </select>
                </div>
                <Button size="sm" variant="soft" onClick={appendAutoTags} title="Append store & category keywords">
                  ➕ Auto Tags
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Sparkles size={13} />}
                  disabled={generatingSeo}
                  onClick={generateAISeo}
                  title="Generate Title, Slug, Description & Tags using AI"
                >
                  {generatingSeo ? "Generating…" : "✨ AI Generate Full SEO"}
                </Button>
              </div>
            </div>

            <Input
              value={p.tags || ""}
              onChange={(e) => {
                set("tags", e.target.value);
                set("seoKeywords", e.target.value);
              }}
              placeholder="e.g. leather wallet, cowhide, slim wallet, gents gift (কমা দিয়ে লিখুন)"
              className="text-xs"
            />

            {/* Live Active Photo & SEO Tags Badges */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>📸 Active Photo &amp; SEO Tags (Auto + Manual একত্র):</span>
                <span>
                  <b className="text-emerald-600">✍️ Manual ({manualTagList.length})</b> | <b className="text-indigo-600">🏷️ Auto ({autoTagList.length})</b>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-[28px] items-center">
                {manualTagList.map((tag, idx) => (
                  <span key={idx} className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                    {tag}
                  </span>
                ))}
                {autoTagList.map((tag, idx) => (
                  <span key={idx} className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                    {tag}
                  </span>
                ))}
                {!manualTagList.length && !autoTagList.length && (
                  <span className="text-xs text-slate-400">প্রোডাক্টের নাম বা ট্যাগ লিখলে এখানে অটো প্রিভিউ দেখাবে…</span>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Custom SEO Title (Optional)" hint="খালি রাখলে প্রোডাক্টের নাম ব্যবহার হবে">
                <Input
                  value={p.seoTitle || ""}
                  onChange={(e) => set("seoTitle", e.target.value)}
                  placeholder="e.g. Pure Leather Wallet BD"
                  className="text-xs"
                />
              </Field>
              <Field label="Custom SEO Slug (URL-Safe)" hint="Only lowercase Latin letters and hyphens">
                <Input
                  value={p.seoSlug || ""}
                  onChange={(e) => set("seoSlug", e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))}
                  placeholder="e.g. pure-leather-wallet-bd"
                  className="text-xs font-mono"
                />
              </Field>
            </div>

            <Field label="Custom SEO Meta Description (Optional)" hint="Google Search ও Facebook শেয়ারে দেখাবে">
              <Textarea
                value={p.seoDesc || ""}
                onChange={(e) => set("seoDesc", e.target.value)}
                rows={2}
                placeholder="খালি রাখলে প্রোডাক্ট ডেসক্রিপশন থেকে প্রথম ১৬০ অক্ষর ব্যবহার হবে"
                className="text-xs"
              />
            </Field>

            {/* Google Search Card Preview */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Google Search Result Preview:</div>
              <div className="truncate text-sm font-semibold text-blue-700 hover:underline cursor-pointer">
                {p.seoTitle || p.name || "Product Title"}
              </div>
              <div className="text-xs text-emerald-700 font-mono">
                {settings.canonical || "https://yourstore.com"}/product?id={p.seoSlug || p.id || "product"}
              </div>
              <div className="line-clamp-2 text-xs text-slate-600">
                {p.seoDesc || (p.desc ? p.desc.replace(/<[^>]*>/g, " ").trim().slice(0, 160) : "Engaging meta description appears here...")}
              </div>
            </div>
          </div>

          {/* Visibility & Checkout Flags */}
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white p-4">
            <Toggle
              checked={p.active}
              onChange={(v) => set("active", v)}
              label="Active (visible on store)"
              hint="Turn off to temporarily hide without deleting."
            />
            <Toggle
              checked={p.featured}
              onChange={(v) => set("featured", v)}
              label="Featured in Flash Deals Section"
              hint="Shows on the homepage flash deals row with countdown."
            />
            <Toggle
              checked={p.addOnce}
              onChange={(v) => set("addOnce", v)}
              label="🛍️ Add-Once Product (One-Tap Checkout Popup)"
              hint="ON করলে checkout-এ Add-Once popup-এ এক ক্লিকে অ্যাড করার অফার দেখাবে।"
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
