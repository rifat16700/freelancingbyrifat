import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Copy, Download, Eye, EyeOff, Layers, Link2, List, LayoutGrid, Package, Pencil, Plus, Sparkles, Star, Trash2, Upload, X, Zap } from "lucide-react";
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

const STEPS = ["Basics", "Price", "Variants & stock", "Photos & SEO", "Visibility"] as const;
function ProductForm({ initial, onClose, onSave }: { initial: Product; onClose: () => void; onSave: (p: Product) => void }) {
  const { brands, categories, products, settings, toast } = useStore();
  const [p, setP] = useState<Product>(initial);
  const [step, setStep] = useState<(typeof STEPS)[number]>("Basics");
  const [newCatName, setNewCatName] = useState("");
  const [newSizeName, setNewSizeName] = useState("");
  const [imgUrlInput, setImgUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }));
  const cats = categories.items.filter((c) => c.brandId === p.brandId || c.brandId === "main" || (c.sharedBrandIds || []).includes(p.brandId));
  const final = p.price - p.flash;
  const margin = final > 0 ? ((final - p.cost) / final) * 100 : 0;
  const setVar = (i: number, f: (v: Variant) => Variant) => set("variants", p.variants.map((v, k) => (k === i ? f(v) : v)));
  const preset = (sizes: string[]) => set("variants", p.variants.map((v) => ({ ...v, sizes: Object.fromEntries(sizes.map((s) => [s, v.sizes[s] ?? 10])) })));
  const allSizes = [...new Set(p.variants.flatMap((v) => Object.keys(v.sizes)))];

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
        toast(`${uploaded.length} photo(s) uploaded ✔`);
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

  const addCustomSize = () => {
    const s = newSizeName.trim();
    if (!s) return;
    set("variants", p.variants.map((v) => ({ ...v, sizes: { ...v.sizes, [s]: v.sizes[s] ?? 10 } })));
    setNewSizeName("");
  };

  const removeSize = (sz: string) => {
    if (allSizes.length <= 1) return;
    set("variants", p.variants.map((v) => {
      const next = { ...v.sizes };
      delete next[sz];
      return { ...v, sizes: next };
    }));
  };

  return (
    <Modal open onClose={onClose} wide title={p.id ? `Edit: ${initial.name}` : "Add a new product"} sub="Fill the 5 simple steps. Only name, price and category are required."
      footer={<><span className="mr-auto text-xs text-slate-400">Step {STEPS.indexOf(step) + 1} of {STEPS.length}</span>
        {STEPS.indexOf(step) > 0 && <Button onClick={() => setStep(STEPS[STEPS.indexOf(step) - 1])}>Back</Button>}
        {STEPS.indexOf(step) < STEPS.length - 1 ? <Button variant="soft" onClick={() => setStep(STEPS[STEPS.indexOf(step) + 1])}>Next</Button> : null}
        <Button variant="primary" onClick={() => onSave(p)}>💾 Save product</Button></>}>
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1">{STEPS.map((s, i) => <button key={s} onClick={() => setStep(s)} className={cn("flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-1.5 text-sm font-medium", step === s ? "bg-white shadow-sm" : "text-slate-500")}><span className={cn("grid h-5 w-5 place-items-center rounded-full text-[11px]", step === s ? "bg-indigo-600 text-white" : "bg-slate-300 text-white")}>{i + 1}</span>{s}</button>)}</div>

      {step === "Basics" && (
        <div className="space-y-4">
          <Field label="Product name" required><Input value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Premium Cotton Panjabi / Wireless Earbuds" autoFocus /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Brand / storefront">
              <Select value={p.brandId} onChange={(e) => setP({ ...p, brandId: e.target.value })}>
                {brands.items.map((b) => <option key={b.id} value={b.id}>{b.emoji} {b.name}</option>)}
              </Select>
            </Field>
            <Field label="SKU (Bangla & English Auto-SKU)">
              <div className="flex gap-2">
                <Input value={p.sku} onChange={(e) => set("sku", e.target.value)} placeholder="PJ-482" />
                <Button onClick={() => set("sku", generatePermanentSku(p.name, products.items.map((x) => x.sku)))}>Auto</Button>
              </div>
            </Field>
          </div>
          {p.brandId && p.brandId !== "main" && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 px-4 py-1">
              <Toggle
                checked={Boolean(p.showOnMain)}
                onChange={(v) => set("showOnMain", v)}
                label="Show on Main Storefront too"
                hint="Lists this brand product on the main homepage & shop without duplicating stock."
              />
            </div>
          )}
          <Field label="Categories" required hint="Pick one or more, or create a new category inline.">
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => {
                const on = p.catIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => set("catIds", on ? p.catIds.filter((x) => x !== c.id) : [...p.catIds, c.id])}
                    className={cn("flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm", on ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-medium" : "border-slate-200 text-slate-600 hover:border-slate-300")}
                  >
                    <IconView icon={c.icon} size={16} /> {c.name}
                  </button>
                );
              })}
            </div>
            <div className="mt-2.5 flex max-w-xs gap-2">
              <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), quickCreateCat())} placeholder="+ Quick new category…" className="h-8 text-xs" />
              <Button size="sm" onClick={quickCreateCat}>Add</Button>
            </div>
          </Field>
          <Field label="Description" hint={`${p.desc.length} characters`}><Textarea value={p.desc} onChange={(e) => set("desc", e.target.value)} rows={4} placeholder="Describe the product in simple words…" />
            <button type="button" onClick={() => { set("desc", `${p.name || "This product"} — premium quality, carefully tested, delivered fast across Bangladesh with Cash on Delivery. Easy returns if you are not happy.`); toast("AI wrote a draft ✨", "info"); }} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600"><Sparkles size={13} /> Write with AI</button></Field>
        </div>
      )}

      {step === "Price" && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Selling price (৳)" required><Input type="number" value={p.price || ""} onChange={(e) => set("price", Number(e.target.value))} /></Field>
            <Field label="Your cost (৳)" hint="Only you see this"><Input type="number" value={p.cost || ""} onChange={(e) => set("cost", Number(e.target.value))} /></Field>
            <Field label="Flash discount (৳)" hint="Final = price − this"><Input type="number" value={p.flash || ""} onChange={(e) => set("flash", Number(e.target.value))} /></Field>
          </div>
          {p.flash > 0 && <Field label="Flash sale ends"><Input type="datetime-local" value={p.flashEnd ? p.flashEnd.slice(0, 16) : ""} onChange={(e) => set("flashEnd", e.target.value ? new Date(e.target.value).toISOString() : undefined)} /></Field>}
          <div className="grid grid-cols-3 gap-3 rounded-2xl bg-slate-50 p-4">
            <div><div className="text-xs text-slate-500">Customer pays</div><div className="text-xl font-bold">{money(final)}</div></div>
            <div><div className="text-xs text-slate-500">You earn per sale</div><div className={cn("text-xl font-bold", final - p.cost < 0 ? "text-rose-600" : "text-emerald-600")}>{money(final - p.cost)}</div></div>
            <div><div className="text-xs text-slate-500">Margin</div><div className="text-xl font-bold">{pct(margin, 0)}</div></div>
          </div>
          {margin < 15 && p.price > 0 && <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle size={16} /> Margin is below 15% — after ads and delivery you may lose money.</div>}
        </div>
      )}

      {step === "Variants & stock" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">Presets:</span>
            <Button size="sm" onClick={() => preset(["S", "M", "L", "XL", "XXL"])}>Clothing (S–XXL)</Button>
            <Button size="sm" onClick={() => preset(["M", "L", "XL", "XXL"])}>Panjabi (M–XXL)</Button>
            <Button size="sm" onClick={() => preset(["Std"])}>One size</Button>
            <Button size="sm" onClick={() => preset(["39", "40", "41", "42", "43", "44"])}>Shoes (39–44)</Button>
            <div className="ml-auto flex items-center gap-1.5">
              <Input value={newSizeName} onChange={(e) => setNewSizeName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomSize())} placeholder="+ Custom size" className="h-8 !w-32 text-xs" />
              <Button size="sm" onClick={addCustomSize}>Add size</Button>
            </div>
          </div>
          {p.variants.map((v, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <input type="color" value={v.hex} onChange={(e) => setVar(i, (x) => ({ ...x, hex: e.target.value }))} className="h-9 w-9 rounded-lg cursor-pointer" />
                <Input value={v.color} onChange={(e) => setVar(i, (x) => ({ ...x, color: e.target.value }))} className="max-w-[180px]" placeholder="Colour name" />
                <span className="text-xs text-slate-400">{Object.values(v.sizes).reduce((a, b) => a + b, 0)} total units</span>
                {p.variants.length > 1 && <button onClick={() => set("variants", p.variants.filter((_, k) => k !== i))} className="ml-auto text-slate-400 hover:text-rose-600"><Trash2 size={16} /></button>}
              </div>
              <MediaPicker
                value={v.image || ""}
                onChange={(url) => setVar(i, (x) => ({ ...x, image: url }))}
                placeholder="Optional photo for this colour variant…"
              />
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{allSizes.map((s) => (
                <div key={s} className="block">
                  <div className="mb-1 flex items-center justify-center gap-1 text-center text-[11px] font-semibold text-slate-500">
                    <span>{s}</span>
                    {allSizes.length > 1 && <button type="button" onClick={() => removeSize(s)} className="text-slate-300 hover:text-rose-500">×</button>}
                  </div>
                  <input type="number" min={0} value={v.sizes[s] ?? 0} onChange={(e) => setVar(i, (x) => ({ ...x, sizes: { ...x.sizes, [s]: Number(e.target.value) } }))} className={cn("w-full rounded-lg border px-2 py-1.5 text-center text-sm outline-none focus:border-indigo-400", (v.sizes[s] ?? 0) === 0 ? "border-rose-200 bg-rose-50" : (v.sizes[s] ?? 0) <= 5 ? "border-amber-200 bg-amber-50" : "border-slate-200")} />
                </div>
              ))}</div>
            </div>
          ))}
          <Button icon={<Plus size={15} />} onClick={() => set("variants", [...p.variants, { color: "New colour", hex: "#8b1a1a", sizes: Object.fromEntries(allSizes.map((s) => [s, 10])) }])}>Add colour variant</Button>
        </div>
      )}

      {step === "Photos & SEO" && (
        <div className="space-y-4">
          <Field label="Product Gallery Photos" hint="Upload photos (R2 / ImgBB / WebP) or paste image URLs. First photo is the main cover.">
            <div className="mb-3 flex gap-2">
              <Input value={imgUrlInput} onChange={(e) => setImgUrlInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addImageUrl())} placeholder="Paste image URL (https://...) and click Add" />
              <Button onClick={addImageUrl}>Add URL</Button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoFiles} />
              <Button variant="primary" icon={<Upload size={15} />} disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? "Uploading…" : "Upload Photos"}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {(p.galleryImages || []).map((img, idx) => (
                <div key={idx} className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <img src={img} alt="" className="h-full w-full object-cover" />
                  {idx === 0 && <span className="absolute left-2 top-2 rounded-md bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-bold text-white">Cover</span>}
                  <button
                    type="button"
                    onClick={() => set("galleryImages", (p.galleryImages || []).filter((_, k) => k !== idx))}
                    className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-rose-600 text-white shadow hover:bg-rose-700"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="grid aspect-square place-items-center rounded-2xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500"
              >
                <div className="flex flex-col items-center gap-1 text-xs font-medium">
                  <Plus size={20} />
                  <span>{uploading ? "Uploading…" : "Add Photo"}</span>
                </div>
              </button>
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <Field label="Video link (optional)" hint="YouTube, Facebook, TikTok or direct MP4">
              <Input value={p.videoUrl || ""} onChange={(e) => set("videoUrl", e.target.value)} placeholder="https://youtube.com/watch?v=…" />
            </Field>
            <Field label="Video platform">
              <Select value={p.videoType || "auto"} onChange={(e) => set("videoType", e.target.value)}>
                <option value="auto">Auto detect</option>
                <option value="youtube">YouTube</option>
                <option value="facebook">Facebook</option>
                <option value="mp4">Direct MP4</option>
              </Select>
            </Field>
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-indigo-900">Search engine (SEO)</div>
              <Button
                size="sm"
                variant="soft"
                icon={<Sparkles size={13} />}
                onClick={() =>
                  setP((cur) => ({
                    ...cur,
                    seoTitle: `${cur.name} — Buy Online in Bangladesh`,
                    seoSlug: cur.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
                    seoDesc: `Buy ${cur.name} at the best price in Bangladesh. Cash on delivery, fast shipping.`,
                    tags: `${cur.name.toLowerCase()}, buy online bd, cash on delivery`,
                    seoKeywords: `${cur.name.toLowerCase()}, buy online bd, cash on delivery`,
                  }))
                }
              >
                AI generate
              </Button>
            </div>
            <div className="space-y-3">
              <Field label="SEO title"><Input value={p.seoTitle || ""} onChange={(e) => set("seoTitle", e.target.value)} placeholder="Leave empty to use product name" /></Field>
              <Field label="URL slug"><Input value={p.seoSlug || ""} onChange={(e) => set("seoSlug", e.target.value)} placeholder="premium-cotton-panjabi" /></Field>
              <Field label="Meta description" hint={`${(p.seoDesc || "").length}/160`}><Textarea value={p.seoDesc || ""} onChange={(e) => set("seoDesc", e.target.value)} rows={2} /></Field>
              <Field label="Keywords & Search Tags"><Input value={p.tags || ""} onChange={(e) => { set("tags", e.target.value); set("seoKeywords", e.target.value); }} placeholder="comma separated" /></Field>
              <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                <div className="truncate text-sm text-blue-700">{p.seoTitle || p.name || "Product title"}</div>
                <div className="text-xs text-emerald-700">{settings.canonical || "https://yourstore.com"}/product?id={p.seoSlug || p.id || "product"}</div>
                <div className="line-clamp-2 text-xs text-slate-500">{p.seoDesc || p.desc || "Description appears here…"}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === "Visibility" && (
        <div className="divide-y divide-slate-100">
          <Toggle checked={p.active} onChange={(v) => set("active", v)} label="Active (visible on store)" hint="Turn off to hide without deleting." />
          <Toggle checked={p.featured} onChange={(v) => set("featured", v)} label="Featured in Flash Deals section" hint="Shows on the homepage flash deals row." />
          <Toggle checked={p.addOnce} onChange={(v) => set("addOnce", v)} label="Add-once product 🛍️" hint="Shown as a one-tap extra in the checkout popup — great for small impulse items." />
          {p.brandId && p.brandId !== "main" && (
            <Toggle checked={Boolean(p.showOnMain)} onChange={(v) => set("showOnMain", v)} label="Also list on Main Storefront" hint="Appears on both the sub-brand storefront and main storefront." />
          )}
          <div className="flex items-center gap-2 pt-4 text-sm text-slate-500"><EyeOff size={15} /> Tip: new products are best saved hidden first, then switched on when photos are ready.</div>
        </div>
      )}
    </Modal>
  );
}
