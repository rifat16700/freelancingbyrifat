import { useState } from "react";
import { ArrowDown, ArrowUp, Image as ImageIcon, LayoutGrid, MousePointerClick, Pencil, Plus, Trash2 } from "lucide-react";
import { useStore } from "../store";
import { Badge, Button, Card, Check2, ConfirmButton, Empty, Field, HelpBox, Input, MediaPicker, Modal, PageHeader, SearchBox, Select, Thumb, Toggle } from "../components/ui";
import { num, pct } from "../lib/format";
import { cn } from "../utils/cn";
import type { Banner, Section } from "../types";

export function Banners() {
  const { banners, brands, t, toast, brandName, log, hasPerm } = useStore();
  const [edit, setEdit] = useState<Banner | null>(null);

  const canCreate = hasPerm("banners", "create");
  const canEdit = hasPerm("banners", "edit");
  const canDelete = hasPerm("banners", "delete");

  const sorted = [...banners.items].sort((a, b) => a.sort - b.sort);
  const move = (id: string, dir: -1 | 1) => {
    if (!canEdit) return;
    const i = sorted.findIndex((b) => b.id === id), j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    banners.update(sorted[i].id, { sort: sorted[j].sort });
    banners.update(sorted[j].id, { sort: sorted[i].sort });
  };
  const save = () => {
    if (!edit) return;
    if (!edit.title.trim() && !edit.imageUrl?.trim()) return toast("Add a banner image or headline", "err");
    if (banners.items.some((b) => b.id === edit.id)) {
      if (!canEdit) return toast("Missing edit permission", "err");
      banners.update(edit.id, edit);
    } else {
      if (!canCreate) return toast("Missing create permission", "err");
      banners.add({ ...edit, id: "ban_" + Date.now() });
    }
    log("Banner saved", edit.title || edit.imageUrl || "Banner");
    toast("Banner saved");
    setEdit(null);
  };

  const Preview = ({ b, className }: { b: Banner; className?: string }) => (
    <div
      className={cn("relative flex flex-col justify-center overflow-hidden px-6 text-white", className)}
      style={b.imageUrl ? undefined : { background: `linear-gradient(110deg, hsl(${b.hue} 75% 40%), hsl(${(b.hue + 50) % 360} 80% 60%))` }}
    >
      {b.imageUrl ? (
        <>
          <img src={b.imageUrl} alt={b.title || ""} className="absolute inset-0 h-full w-full object-cover" />
          {(b.title || b.subtitle) && <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-transparent" />}
        </>
      ) : (
        <>
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/15" />
          <div className="absolute -bottom-12 right-16 h-32 w-32 rounded-full bg-white/10" />
        </>
      )}
      {(b.title || !b.imageUrl) && <div className="relative text-xl font-bold leading-tight drop-shadow">{b.title || "Your headline"}</div>}
      {b.subtitle && <div className="relative mt-1 text-sm text-white/90 drop-shadow">{b.subtitle}</div>}
      {(!b.imageUrl || b.title) && <div className="relative mt-3 w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 shadow">Shop now →</div>}
    </div>
  );

  return (
    <div>
      <PageHeader
        icon={<ImageIcon size={22} />}
        title={t("Banners", "ব্যানার")}
        desc="The big slider at the top of your homepage. Upload images (R2 / ImgBB / WebP) or paste URLs."
        actions={
          canCreate ? (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() =>
                setEdit({
                  id: "", title: "", subtitle: "", imageUrl: "", brandId: "main",
                  hue: Math.floor(Math.random() * 360), link: "", linkType: "url",
                  sort: banners.items.length + 1, active: true, impressions: 0, clicks: 0,
                })
              }
            >
              Add banner
            </Button>
          ) : undefined
        }
      />
      <HelpBox id="banners" title="Banner tips">
        <p>Use wide images, <b>2:1 ratio</b> (1200×600 px desktop, 800×400 mobile). Keep text short — people only glance for 2 seconds.</p>
        <p className="text-amber-900/70">ছোট লেখা ও পরিষ্কার ছবি ব্যবহার করুন। সরাসরি ছবি আপলোড বা ইমেজ লিংক দিতে পারবেন।</p>
      </HelpBox>
      {sorted.length === 0 ? <Card><Empty title="No banners yet" /></Card> : (
        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map((b, i) => (
            <Card key={b.id} className={cn("overflow-hidden", !b.active && "opacity-60")}>
              <Preview b={b} className="h-44" />
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Badge>{brandName(b.brandId)}</Badge>
                    <span>#{i + 1}</span>
                    {b.link && <span className="truncate max-w-[180px] text-slate-400">→ {b.link}</span>}
                  </div>
                  <Toggle disabled={!canEdit} checked={b.active} onChange={(v) => banners.update(b.id, { active: v })} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 py-2"><div className="text-sm font-bold">{num(b.impressions)}</div><div className="text-[10px] text-slate-500">views</div></div>
                  <div className="rounded-xl bg-slate-50 py-2"><div className="text-sm font-bold">{num(b.clicks)}</div><div className="text-[10px] text-slate-500">clicks</div></div>
                  <div className={cn("rounded-xl py-2", b.impressions && (b.clicks / b.impressions) * 100 < 3 ? "bg-rose-50" : "bg-emerald-50")}><div className="flex items-center justify-center gap-1 text-sm font-bold"><MousePointerClick size={12} />{pct(b.impressions ? (b.clicks / b.impressions) * 100 : 0)}</div><div className="text-[10px] text-slate-500">CTR</div></div>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  {canEdit && <Button size="sm" className="flex-1" icon={<Pencil size={13} />} onClick={() => setEdit({ ...b })}>Edit</Button>}
                  {canEdit && <button onClick={() => move(b.id, -1)} disabled={i === 0} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowUp size={15} /></button>}
                  {canEdit && <button onClick={() => move(b.id, 1)} disabled={i === sorted.length - 1} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowDown size={15} /></button>}
                  {canDelete && <ConfirmButton onConfirm={() => { banners.remove(b.id); toast("Banner deleted"); }}><Trash2 size={15} /></ConfirmButton>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} wide title={edit?.id ? "Edit banner" : "New banner"} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save banner</Button></>}>
        {edit && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <Field label="Banner Image (Upload Photo or Paste URL)">
                <MediaPicker value={edit.imageUrl || ""} onChange={(v) => setEdit({ ...edit, imageUrl: v })} placeholder="Upload banner photo or paste image URL…" />
              </Field>
              <Field label="Headline (optional if image has text)">
                <Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="Eid Collection is Live" />
              </Field>
              <Field label="Subtitle">
                <Input value={edit.subtitle} onChange={(e) => setEdit({ ...edit, subtitle: e.target.value })} placeholder="Up to 30% discount" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Brand">
                  <Select value={edit.brandId} onChange={(e) => setEdit({ ...edit, brandId: e.target.value })}>
                    {brands.items.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </Select>
                </Field>
                <Field label="Show order">
                  <Input type="number" value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: Number(e.target.value) })} />
                </Field>
              </div>
              <Field label="Link when clicked">
                <Input value={edit.link} onChange={(e) => setEdit({ ...edit, link: e.target.value })} placeholder="/shop?cat=electronics" />
              </Field>
              <details className="rounded-xl border border-slate-200 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-slate-600">🎯 Advanced: Link Type & Custom Clickable Area</summary>
                <div className="mt-3 space-y-2.5">
                  <Field label="Link Type">
                    <Select value={edit.linkType || "url"} onChange={(e) => setEdit({ ...edit, linkType: e.target.value })}>
                      <option value="url">Custom URL</option>
                      <option value="category">Category Page</option>
                      <option value="product">Product Page</option>
                      <option value="section">Homepage Section</option>
                    </Select>
                  </Field>
                  <div className="grid grid-cols-4 gap-2">
                    <Field label="X %"><Input type="number" min={0} max={100} value={edit.areaX ?? ""} onChange={(e) => setEdit({ ...edit, areaX: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="0" /></Field>
                    <Field label="Y %"><Input type="number" min={0} max={100} value={edit.areaY ?? ""} onChange={(e) => setEdit({ ...edit, areaY: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="0" /></Field>
                    <Field label="W %"><Input type="number" min={0} max={100} value={edit.areaW ?? ""} onChange={(e) => setEdit({ ...edit, areaW: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="100" /></Field>
                    <Field label="H %"><Input type="number" min={0} max={100} value={edit.areaH ?? ""} onChange={(e) => setEdit({ ...edit, areaH: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="100" /></Field>
                  </div>
                </div>
              </details>
              {!edit.imageUrl && (
                <Field label="Fallback colour mood">
                  <input type="range" min={0} max={360} value={edit.hue} onChange={(e) => setEdit({ ...edit, hue: Number(e.target.value) })} className="w-full" />
                </Field>
              )}
              <Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Show on homepage" />
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">Live preview</div>
              <Preview b={edit} className="h-52 rounded-2xl border border-slate-200" />
              <p className="mt-2 text-xs text-slate-500">Recommended size: 1200×600 px (2:1 wide aspect ratio).</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function Sections() {
  const { sections, brands, categories, products, t, toast, brandName, log, hasPerm } = useStore();
  const [edit, setEdit] = useState<Section | null>(null);
  const [ps, setPs] = useState("");

  const canCreate = hasPerm("sections", "create");
  const canEdit = hasPerm("sections", "edit");
  const canDelete = hasPerm("sections", "delete");

  const sorted = [...sections.items].sort((a, b) => a.brandId.localeCompare(b.brandId) || a.sort - b.sort);
  const move = (s: Section, dir: -1 | 1) => {
    if (!canEdit) return;
    const peers = sorted.filter((x) => x.brandId === s.brandId);
    const i = peers.findIndex((x) => x.id === s.id), j = i + dir;
    if (j < 0 || j >= peers.length) return;
    sections.update(peers[i].id, { sort: peers[j].sort });
    sections.update(peers[j].id, { sort: peers[i].sort });
  };
  const save = () => {
    if (!edit) return;
    if (!edit.title.trim()) return toast("Section title is required", "err");
    if (edit.type === "Category" && !edit.catId) return toast("Choose a category", "err");
    if (edit.type === "Custom" && !(edit.productIds || []).length) return toast("Pick at least one product", "err");
    if (sections.items.some((x) => x.id === edit.id)) {
      if (!canEdit) return toast("Missing edit permission", "err");
      sections.update(edit.id, edit);
    } else {
      if (!canCreate) return toast("Missing create permission", "err");
      sections.add({ ...edit, id: "sec_" + Date.now() });
    }
    log("Section saved", edit.title);
    toast("Section saved");
    setEdit(null);
  };
  const types = [["Category", "📂", "Show one category"], ["Custom", "🛍️", "Pick products yourself"], ["All Products", "🌟", "Everything"]] as const;

  return (
    <div>
      <PageHeader
        icon={<LayoutGrid size={22} />}
        title={t("Homepage sections", "হোম সেকশন")}
        desc="Product rows shown on your homepage, in the order you choose."
        actions={
          canCreate ? (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                setPs("");
                setEdit({ id: "", title: "", type: "Category", brandId: "main", max: 10, sort: sections.items.length + 1, active: true, productIds: [] });
              }}
            >
              Add section
            </Button>
          ) : undefined
        }
      />
      <div className="space-y-3">
        {sorted.length === 0 && <Card><Empty title="No homepage sections yet" /></Card>}
        {sorted.map((s) => {
          const peers = sorted.filter((x) => x.brandId === s.brandId);
          const i = peers.findIndex((x) => x.id === s.id);
          return (
            <Card key={s.id} className={cn("flex flex-wrap items-center gap-4 p-4", !s.active && "opacity-60")}>
              <div className="flex flex-col">
                <button onClick={() => move(s, -1)} disabled={i === 0 || !canEdit} className="rounded p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-30"><ArrowUp size={16} /></button>
                <button onClick={() => move(s, 1)} disabled={i === peers.length - 1 || !canEdit} className="rounded p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-30"><ArrowDown size={16} /></button>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-50 text-xl">{s.type === "Category" ? "📂" : s.type === "Custom" ? "🛍️" : "🌟"}</div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900">{s.title}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <Badge tone="indigo">{s.type}</Badge>
                  <Badge>{brandName(s.brandId)}</Badge>
                  <span>up to {s.max} products</span>
                  {s.catId && ` · ${categories.items.find((c) => c.id === s.catId)?.name || s.catId}`}
                </div>
              </div>
              <Toggle disabled={!canEdit} checked={s.active} onChange={(v) => sections.update(s.id, { active: v })} />
              {canEdit && <Button size="sm" icon={<Pencil size={13} />} onClick={() => { setPs(""); setEdit({ ...s }); }}>Edit</Button>}
              {canDelete && <ConfirmButton onConfirm={() => { sections.remove(s.id); toast("Section deleted"); }}><Trash2 size={15} /></ConfirmButton>}
            </Card>
          );
        })}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit section" : "New section"} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save section</Button></>}>
        {edit && (
          <div className="space-y-4">
            <Field label="Section title" required><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="e.g. Best Sellers" autoFocus /></Field>
            <Field label="What should it show?">
              <div className="grid grid-cols-3 gap-2">
                {types.map(([id, ic, d]) => (
                  <button key={id} type="button" onClick={() => setEdit({ ...edit, type: id })} className={cn("rounded-2xl border p-3 text-left", edit.type === id ? "border-indigo-600 bg-indigo-50" : "border-slate-200")}>
                    <div className="text-xl">{ic}</div>
                    <div className="mt-1 text-sm font-semibold">{id}</div>
                    <div className="text-[11px] text-slate-500">{d}</div>
                  </button>
                ))}
              </div>
            </Field>
            {edit.type === "Category" && (
              <Field label="Category" required>
                <Select value={edit.catId || ""} onChange={(e) => setEdit({ ...edit, catId: e.target.value })}>
                  <option value="">Choose…</option>
                  {categories.items.map((c) => <option key={c.id} value={c.id}>{c.name} ({brandName(c.brandId)})</option>)}
                </Select>
              </Field>
            )}
            {edit.type === "Custom" && (
              <Field label={`Products (${(edit.productIds || []).length} selected)`} required>
                <SearchBox value={ps} onChange={setPs} placeholder="Search products…" className="mb-2" />
                <div className="max-h-52 overflow-y-auto rounded-2xl border border-slate-200 p-1">
                  {products.items.filter((p) => p.name.toLowerCase().includes(ps.toLowerCase())).map((p) => {
                    const on = (edit.productIds || []).includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setEdit({ ...edit, productIds: on ? edit.productIds!.filter((x) => x !== p.id) : [...(edit.productIds || []), p.id] })}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        <Check2 on={on} />
                        <Thumb p={p} size={26} />
                        <span className="truncate">{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Brand">
                <Select value={edit.brandId} onChange={(e) => setEdit({ ...edit, brandId: e.target.value })}>
                  {brands.items.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
              <Field label="Max products" hint="1–50">
                <Input type="number" min={1} max={50} value={edit.max} onChange={(e) => setEdit({ ...edit, max: Number(e.target.value) })} />
              </Field>
              <Field label="Show order">
                <Input type="number" value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: Number(e.target.value) })} />
              </Field>
            </div>
            <Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Show on homepage" />
          </div>
        )}
      </Modal>
    </div>
  );
}
