import { useState } from "react";
import { ExternalLink, FolderTree, Pencil, Plus, Store, Trash2 } from "lucide-react";
import { useStore } from "../store";
import { go } from "../router";
import { Badge, Button, Card, ConfirmButton, Empty, Field, HelpBox, IconView, Input, MediaPicker, Modal, PageHeader, Select, Textarea, Toggle } from "../components/ui";
import { money } from "../lib/format";
import type { Brand, Category } from "../types";

export function Categories() {
  const { categories, brands, products, t, toast, log, brandName, hasPerm } = useStore();
  const [edit, setEdit] = useState<Category | null>(null);
  const [share, setShare] = useState<string[]>([]);
  const [bring, setBring] = useState(true);
  const [urlMode, setUrlMode] = useState<"brand" | "main">("brand");

  const canCreate = hasPerm("categories", "create");
  const canEdit = hasPerm("categories", "edit");
  const canDelete = hasPerm("categories", "delete");

  const count = (id: string) => products.items.filter((p) => p.catIds.includes(id)).length;
  const emojis = ["🎧", "🏠", "💄", "👜", "⌚", "🕰️", "👘", "👕", "👖", "👟", "📱", "🎮", "🧸", "📚", "🍔", "🧴"];

  const openEdit = (c: Category) => {
    setShare(c.sharedBrandIds || []);
    setBring(c.shareIncludeProducts ?? true);
    setUrlMode(c.shareUrlMode || "brand");
    setEdit({ ...c });
  };

  const save = () => {
    if (!edit) return;
    if (!edit.name.trim()) return toast("Category name is required", "err");
    const payload: Category = {
      ...edit,
      sharedBrandIds: share,
      shareIncludeProducts: bring,
      shareUrlMode: urlMode,
    };
    if (categories.items.some((c) => c.id === edit.id)) {
      if (!canEdit) return toast("Missing edit permission", "err");
      categories.update(edit.id, payload);
    } else {
      if (!canCreate) return toast("Missing create permission", "err");
      categories.add({ ...payload, id: "cat_" + Date.now() });
    }
    log("Category saved", edit.name);
    toast(share.length ? `Saved & shared with ${share.length} brand(s)` : "Category saved");
    setEdit(null);
  };

  return (
    <div>
      <PageHeader
        icon={<FolderTree size={22} />}
        title={t("Categories", "ক্যাটাগরি")}
        desc="Organise products so customers find things fast. Supports Emoji, Image Upload/URL, or SVG code."
        actions={
          canCreate ? (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                setShare([]);
                setBring(true);
                setUrlMode("brand");
                setEdit({ id: "", name: "", icon: "🛍️", brandId: brands.items[0]?.id || "main", sort: categories.items.length + 1, active: true });
              }}
            >
              Add category
            </Button>
          ) : undefined
        }
      />
      <HelpBox id="cat" title="Good to know">
        <p>Categories belong to a brand. You can <b>share</b> one category with other brands (no duplicate data) from the advanced section, and use Emoji, uploaded image, or raw <code>&lt;svg&gt;</code> icon.</p>
        <p className="text-amber-900/70">ক্যাটাগরি ব্র্যান্ডের অধীনে থাকে। চাইলে ইমোজি, ছবি কিংবা SVG আইকন দিতে পারবেন এবং অন্য ব্র্যান্ডের সাথে শেয়ার করতে পারবেন।</p>
      </HelpBox>
      <div className="space-y-6">
        {brands.items.map((b) => {
          const cs = categories.items.filter((c) => c.brandId === b.id || (c.sharedBrandIds || []).includes(b.id)).sort((a, c) => a.sort - c.sort);
          return (
            <div key={b.id}>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <IconView icon={b.logoUrl || b.emoji} size={20} />
                <span>{b.name}</span>
                <Badge>{cs.length}</Badge>
              </div>
              {cs.length === 0 ? <Card><Empty title="No categories yet" /></Card> : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {cs.map((c) => (
                    <Card key={c.id + "_" + b.id} className={`p-4 ${c.active ? "" : "opacity-60"}`}>
                      <div className="flex items-start gap-3">
                        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-100 text-2xl">
                          <IconView icon={c.icon} size={28} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-slate-900">{c.name}</div>
                          <div className="text-xs text-slate-500">
                            {count(c.id)} products · order #{c.sort}
                            {c.brandId !== b.id && <span className="ml-1 text-indigo-600">· Shared</span>}
                          </div>
                        </div>
                        <Toggle disabled={!canEdit} checked={c.active} onChange={(v) => categories.update(c.id, { active: v })} />
                      </div>
                      <div className="mt-3 flex items-center gap-1.5">
                        {canEdit && <Button size="sm" className="flex-1" icon={<Pencil size={13} />} onClick={() => openEdit(c)}>Edit</Button>}
                        <Button size="sm" variant="ghost" onClick={() => go(`/products`)}>Products</Button>
                        {canDelete && (
                          <ConfirmButton onConfirm={() => { if (count(c.id)) return toast(`Move its ${count(c.id)} products first`, "err"); categories.remove(c.id); toast("Category deleted"); }}>
                            <Trash2 size={15} />
                          </ConfirmButton>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit category" : "New category"}
        footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save category</Button></>}>
        {edit && (
          <div className="space-y-4">
            <Field label="Category name" required><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. Smart Watches" autoFocus /></Field>
            <Field label="Category Icon (Emoji, Photo Upload, Image URL, or SVG Code)">
              <MediaPicker allowSvg value={edit.icon} onChange={(v) => setEdit({ ...edit, icon: v })} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {emojis.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEdit({ ...edit, icon: e })}
                    className={`grid h-9 w-9 place-items-center rounded-xl border text-lg ${edit.icon === e ? "border-indigo-600 bg-indigo-50" : "border-slate-200"}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Primary Brand"><Select value={edit.brandId} onChange={(e) => setEdit({ ...edit, brandId: e.target.value })}>{brands.items.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
              <Field label="Show order" hint="Smaller number shows first"><Input type="number" value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: Number(e.target.value) })} /></Field>
            </div>
            <Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Visible on store" />
            <details className="rounded-2xl border border-slate-200 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">⚙️ Advanced: share with other brands</summary>
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {brands.items.filter((b) => b.id !== edit.brandId).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setShare(share.includes(b.id) ? share.filter((x) => x !== b.id) : [...share, b.id])}
                      className={`rounded-xl border px-3 py-1.5 text-sm ${share.includes(b.id) ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200"}`}
                    >
                      {b.emoji} {b.name}
                    </button>
                  ))}
                </div>
                <Toggle checked={bring} onChange={setBring} label="Bring existing products along" hint={`Products already in this category will also appear in: ${share.map(brandName).join(", ") || "—"}`} />
                <Field label="Shared Product Link Mode">
                  <Select value={urlMode} onChange={(e) => setUrlMode(e.target.value as "brand" | "main")}>
                    <option value="brand">Open under Sub-brand URL (/{`brand`}/product)</option>
                    <option value="main">Open under Main Store URL (/product)</option>
                  </Select>
                </Field>
              </div>
            </details>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function Brands() {
  const { brands, products, orders, settings, t, toast, log, hasPerm } = useStore();
  const [edit, setEdit] = useState<Brand | null>(null);
  const [isNew, setIsNew] = useState(false);

  const canCreate = hasPerm("brands", "create");
  const canEdit = hasPerm("brands", "edit");
  const canDelete = hasPerm("brands", "delete");

  const stats = (id: string) => {
    const os = orders.items.filter((o) => o.brandId === id && o.status !== "Cancelled" && !o.failed && Date.now() - new Date(o.date).getTime() < 30 * 86400000);
    return { rev: os.reduce((s, o) => s + o.grand, 0), n: os.length, prods: products.items.filter((p) => p.brandId === id).length };
  };
  const slugOk = (s: string) => /^[a-z0-9-]+$/.test(s);
  const save = () => {
    if (!edit) return;
    if (!edit.name.trim()) return toast("Brand name is required", "err");
    if (!edit.isMain && !slugOk(edit.slug)) return toast("URL path: only a–z, 0–9 and hyphen", "err");
    if (brands.items.some((b) => b.slug === edit.slug && b.id !== edit.id && !edit.isMain)) return toast("That URL path is already used", "err");
    if (isNew) {
      if (!canCreate) return toast("Missing create permission", "err");
      brands.add({ ...edit, id: "b_" + Date.now() });
    } else {
      if (!canEdit) return toast("Missing edit permission", "err");
      brands.update(edit.id, edit);
    }
    log("Brand saved", edit.name);
    toast("Brand saved");
    setEdit(null);
  };

  const hostLabel = (settings.canonical || (typeof window !== "undefined" && window.location.origin) || "https://yourdomain.com").replace(/^https?:\/\//, "").replace(/\/+$/, "");

  return (
    <div>
      <PageHeader
        icon={<Store size={22} />}
        title={t("Brands", "ব্র্যান্ড")}
        desc="Run several storefronts, each with its own web address, logo, colors and SEO, from one panel."
        actions={
          canCreate ? (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                setIsNew(true);
                setEdit({
                  id: "", name: "", slug: "", tagline: "",
                  color: "#8b1a1a", accentColor: "#b03535", emoji: "🏪",
                  logoUrl: "", faviconUrl: "", active: true,
                  seoTitle: "", seoDesc: "", seoKeywords: "", seoOgImage: "",
                  footerText: "", whatsapp: "", facebook: "", instagram: "", youtube: "",
                  sort: brands.items.length,
                });
              }}
            >
              Create brand
            </Button>
          ) : undefined
        }
      />
      <HelpBox id="brands" title="How multi-brand works">
        <p>1. Create a brand and choose its address (e.g. <code className="rounded bg-white/60 px-1">{hostLabel}/ranonexwatch</code>).</p>
        <p>2. In Products, Categories, Banners, Sections and Promos choose which brand each item belongs to.</p>
        <p>3. Turn on “Show on main site” for a product to list it on both without duplicates.</p>
      </HelpBox>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {brands.items.map((b) => {
          const s = stats(b.id);
          return (
            <Card key={b.id} className={`overflow-hidden ${b.active ? "" : "opacity-60"}`}>
              <div className="h-20" style={{ background: `linear-gradient(120deg, ${b.color}, ${b.accentColor || b.color}88)` }} />
              <div className="-mt-8 px-5 pb-5">
                <div className="flex items-end justify-between">
                  <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-white text-3xl shadow">
                    <IconView icon={b.logoUrl || b.emoji} size={44} />
                  </div>
                  {!b.isMain && <Toggle disabled={!canEdit} checked={b.active} onChange={(v) => brands.update(b.id, { active: v })} />}
                </div>
                <div className="mt-3 flex items-center gap-2"><h3 className="text-lg font-bold text-slate-900">{b.name}</h3>{b.isMain && <Badge tone="indigo">Main</Badge>}</div>
                <p className="text-sm text-slate-500">{b.tagline}</p>
                <a
                  href={b.isMain ? "/" : `/${b.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:underline"
                >
                  <ExternalLink size={12} /> {hostLabel}/{b.slug}
                </a>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[["Products", s.prods], ["Orders 30d", s.n], ["Revenue 30d", money(s.rev)]].map(([a, v]) => <div key={a as string} className="rounded-xl bg-slate-50 py-2"><div className="text-sm font-bold">{v}</div><div className="text-[10px] text-slate-500">{a}</div></div>)}
                </div>
                <div className="mt-4 flex gap-2">
                  {canEdit && <Button className="flex-1" icon={<Pencil size={14} />} onClick={() => { setIsNew(false); setEdit({ ...b }); }}>Edit</Button>}
                  {!b.isMain && canDelete && (
                    <ConfirmButton onConfirm={() => { if (s.prods) return toast("Move or delete its products first", "err"); brands.remove(b.id); toast("Brand deleted"); }}>
                      <Trash2 size={15} />
                    </ConfirmButton>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} wide title={isNew ? "Create brand" : `Edit brand: ${edit?.name || ""}`} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save brand</Button></>}>
        {edit && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_90px_100px]">
              <Field label="Brand name" required><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. Ranonex Watch" autoFocus /></Field>
              <Field label="Emoji"><Input value={edit.emoji} onChange={(e) => setEdit({ ...edit, emoji: e.target.value })} className="text-center text-xl" /></Field>
              <Field label="Sort order"><Input type="number" value={edit.sort ?? 0} onChange={(e) => setEdit({ ...edit, sort: Number(e.target.value) })} /></Field>
            </div>
            <Field label="Tagline"><Input value={edit.tagline} onChange={(e) => setEdit({ ...edit, tagline: e.target.value })} placeholder="Luxury timepieces" /></Field>
            {!edit.isMain && (
              <Field label="Web address (Slug)" required hint="Lowercase letters, numbers and hyphen only. Changing it later automatically 301-redirects the old link.">
                <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 focus-within:ring-4 focus-within:ring-indigo-100">
                  <span className="bg-slate-50 px-3 py-2 text-sm text-slate-500">{hostLabel}/</span>
                  <input value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} className="flex-1 px-3 py-2 text-sm outline-none" placeholder="ranonexwatch" />
                </div>
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Brand Logo (Upload or URL)">
                <MediaPicker value={edit.logoUrl || ""} onChange={(v) => setEdit({ ...edit, logoUrl: v })} placeholder="Upload brand logo or paste URL…" />
              </Field>
              <Field label="Favicon (Upload or URL)">
                <MediaPicker value={edit.faviconUrl || ""} onChange={(v) => setEdit({ ...edit, faviconUrl: v })} placeholder="Upload brand favicon or paste URL…" />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Primary Brand Colour">
                <div className="flex items-center gap-3">
                  <input type="color" value={edit.color || "#8b1a1a"} onChange={(e) => setEdit({ ...edit, color: e.target.value })} className="h-10 w-14 rounded-lg cursor-pointer" />
                  <Input value={edit.color || "#8b1a1a"} onChange={(e) => setEdit({ ...edit, color: e.target.value })} className="font-mono text-xs" />
                </div>
              </Field>
              <Field label="Accent / Secondary Colour">
                <div className="flex items-center gap-3">
                  <input type="color" value={edit.accentColor || edit.color || "#b03535"} onChange={(e) => setEdit({ ...edit, accentColor: e.target.value })} className="h-10 w-14 rounded-lg cursor-pointer" />
                  <Input value={edit.accentColor || edit.color || "#b03535"} onChange={(e) => setEdit({ ...edit, accentColor: e.target.value })} className="font-mono text-xs" />
                </div>
              </Field>
            </div>

            <details className="rounded-2xl border border-slate-200 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">🔍 Brand SEO & Social Media Links</summary>
              <div className="mt-3 space-y-3">
                <Field label="SEO Title"><Input value={edit.seoTitle} onChange={(e) => setEdit({ ...edit, seoTitle: e.target.value })} placeholder="Brand page title on Google" /></Field>
                <Field label="SEO Meta Description"><Textarea value={edit.seoDesc || ""} onChange={(e) => setEdit({ ...edit, seoDesc: e.target.value })} rows={2} /></Field>
                <Field label="SEO Keywords"><Input value={edit.seoKeywords || ""} onChange={(e) => setEdit({ ...edit, seoKeywords: e.target.value })} placeholder="watch, luxury watch bd" /></Field>
                <Field label="Social Share Image (OG Image)">
                  <MediaPicker value={edit.seoOgImage || ""} onChange={(v) => setEdit({ ...edit, seoOgImage: v })} placeholder="Upload OG image or paste URL…" />
                </Field>
                <Field label="Footer Text"><Input value={edit.footerText || ""} onChange={(e) => setEdit({ ...edit, footerText: e.target.value })} /></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="WhatsApp Number"><Input value={edit.whatsapp || ""} onChange={(e) => setEdit({ ...edit, whatsapp: e.target.value })} placeholder="8801XXXXXXXXX" /></Field>
                  <Field label="Facebook Page URL"><Input value={edit.facebook || ""} onChange={(e) => setEdit({ ...edit, facebook: e.target.value })} /></Field>
                  <Field label="Instagram URL"><Input value={edit.instagram || ""} onChange={(e) => setEdit({ ...edit, instagram: e.target.value })} /></Field>
                  <Field label="YouTube URL"><Input value={edit.youtube || ""} onChange={(e) => setEdit({ ...edit, youtube: e.target.value })} /></Field>
                </div>
              </div>
            </details>

            <Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Storefront is live" />
          </div>
        )}
      </Modal>
    </div>
  );
}
