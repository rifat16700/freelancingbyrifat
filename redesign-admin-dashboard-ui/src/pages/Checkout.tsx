import { useMemo, useState } from "react";
import { Gift, MapPin, Pencil, Plus, Trash2, Truck, X } from "lucide-react";
import { useStore } from "../store";
import { GEO_TREE } from "../data/demo";
import { Badge, Button, Card, ConfirmButton, Empty, Field, HelpBox, IconView, Input, MediaPicker, Modal, PageHeader, Select, Toggle } from "../components/ui";
import { money, num } from "../lib/format";
import type { Addon, Zone } from "../types";

const ALL_DISTRICTS = [...new Set(Object.values(GEO_TREE).flatMap((d) => Object.keys(d)))].sort();

export function Delivery() {
  const { zones, orders, t, toast, log, hasPerm } = useStore();
  const [edit, setEdit] = useState<Zone | null>(null);
  const [dtext, setDtext] = useState("");
  const [test, setTest] = useState("Dhaka");

  const canCreate = hasPerm("delivery", "create");
  const canEdit = hasPerm("delivery", "edit");
  const canDelete = hasPerm("delivery", "delete");

  const fallback = zones.items.find((z) => z.districts.length === 0);
  const zoneFor = (d: string) => zones.items.find((z) => z.districts.includes(d)) || fallback;
  const usage = useMemo(() => { const m = new Map<string, number>(); orders.items.forEach((o) => { if (o.type !== "delivery" || o.failed) return; const z = zoneFor(o.district); if (z) m.set(z.id, (m.get(z.id) || 0) + 1); }); return m; }, [orders.items, zones.items]); // eslint-disable-line
  const taken = new Set(zones.items.flatMap((z) => z.districts));
  const save = () => {
    if (!edit) return;
    if (!edit.name.trim()) return toast("Zone name is required", "err");
    if (zones.items.some((z) => z.id === edit.id)) {
      if (!canEdit) return toast("Missing edit permission", "err");
      zones.update(edit.id, edit);
    } else {
      if (!canCreate) return toast("Missing create permission", "err");
      zones.add({ ...edit, id: "zn_" + Date.now() });
    }
    log("Delivery zone saved", edit.name);
    toast("Zone saved");
    setEdit(null);
  };
  const addD = (d: string) => { const v = d.trim(); if (v && edit && !edit.districts.includes(v)) setEdit({ ...edit, districts: [...edit.districts, v] }); setDtext(""); };
  return (
    <div>
      <PageHeader icon={<Truck size={22} />} title={t("Delivery zones", "ডেলিভারি জোন")} desc="Set shipping charges by area."
        actions={canCreate ? <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEdit({ id: "", name: "", charge: 80, districts: [] })}>Add zone</Button> : undefined} />
      <HelpBox id="zones" title="How zones work"><p>Add the districts a zone covers. At checkout the customer’s district decides the charge. A zone with <b>no districts</b> is the default for everywhere else.</p><p className="text-amber-900/70">জেলা অনুযায়ী ডেলিভারি চার্জ। কোনো জেলা না দিলে সেটি ডিফল্ট জোন।</p></HelpBox>
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {zones.items.length === 0 && <Card><Empty title="No zones yet" /></Card>}
          {zones.items.map((z) => (
            <Card key={z.id} className="p-5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-sky-600"><MapPin /></div>
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2 font-semibold text-slate-900">{z.name}{z.districts.length === 0 && <Badge tone="amber">Default</Badge>}</div><div className="text-xs text-slate-500">{num(usage.get(z.id) || 0)} orders used this zone</div></div>
                <div className="text-right"><div className="text-2xl font-bold text-slate-900">{money(z.charge)}</div><div className="text-xs text-slate-400">per order</div></div>
                {canEdit && <Button size="sm" icon={<Pencil size={13} />} onClick={() => setEdit({ ...z })}>Edit</Button>}
                {canDelete && <ConfirmButton onConfirm={() => { zones.remove(z.id); toast("Zone deleted"); }}><Trash2 size={15} /></ConfirmButton>}
              </div>
              {z.districts.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{z.districts.map((d) => <Badge key={d} tone="blue">{d}</Badge>)}</div>}
            </Card>
          ))}
        </div>
        <Card className="h-fit p-5">
          <div className="mb-3 font-semibold text-slate-900">Try it: what will a customer pay?</div>
          <Select value={test} onChange={(e) => setTest(e.target.value)}>{ALL_DISTRICTS.map((d) => <option key={d}>{d}</option>)}</Select>
          <div className="mt-4 rounded-2xl bg-indigo-50 p-4 text-center"><div className="text-xs text-indigo-600">Delivery to {test}</div><div className="text-3xl font-bold text-indigo-900">{zoneFor(test) ? money(zoneFor(test)!.charge) : "—"}</div><div className="text-xs text-indigo-700/70">{zoneFor(test)?.name || "No zone matches — add a default zone"}</div></div>
          {!fallback && <div className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">⚠️ You have no default zone. Districts that aren’t listed can’t order.</div>}
        </Card>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit zone" : "Add delivery zone"} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save zone</Button></>}>
        {edit && <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_140px]"><Field label="Zone name" required><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Inside Dhaka" autoFocus /></Field><Field label="Charge (৳)" required><Input type="number" value={edit.charge} onChange={(e) => setEdit({ ...edit, charge: Number(e.target.value) })} /></Field></div>
          <Field label="Districts in this zone" hint="Leave empty to make this the default zone.">
            <div className="flex gap-2"><Input value={dtext} onChange={(e) => setDtext(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addD(dtext))} placeholder="Type a district and press Enter" /><Button onClick={() => addD(dtext)}>Add</Button></div>
            <div className="mt-2 flex flex-wrap gap-1.5">{edit.districts.map((d) => <span key={d} className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">{d}<button onClick={() => setEdit({ ...edit, districts: edit.districts.filter((x) => x !== d) })}><X size={12} /></button></span>)}</div>
          </Field>
          <div><div className="mb-2 text-xs font-medium text-slate-500">Quick pick (greyed = already in another zone)</div><div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">{ALL_DISTRICTS.map((d) => { const on = edit.districts.includes(d); const other = taken.has(d) && !on && !zones.items.find((z) => z.id === edit.id)?.districts.includes(d); return <button key={d} disabled={other} onClick={() => on ? setEdit({ ...edit, districts: edit.districts.filter((x) => x !== d) }) : addD(d)} className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-indigo-600 bg-indigo-50 text-indigo-700" : other ? "border-slate-100 text-slate-300" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>{d}</button>; })}</div></div>
        </div>}
      </Modal>
    </div>
  );
}

export function Addons() {
  const { addons, orders, t, toast, log, hasPerm } = useStore();
  const [edit, setEdit] = useState<Addon | null>(null);

  const canCreate = hasPerm("addons", "create");
  const canEdit = hasPerm("addons", "edit");
  const canDelete = hasPerm("addons", "delete");

  const stats = useMemo(() => { const m = new Map<string, { n: number; rev: number }>(); orders.items.forEach((o) => { if (o.status === "Cancelled" || o.failed) return; o.addons.forEach((a) => { const x = m.get(a) || { n: 0, rev: 0 }; x.n++; x.rev += addons.items.find((k) => k.name === a)?.price || 0; m.set(a, x); }); }); return m; }, [orders.items, addons.items]);
  const icons = ["🎁", "📦", "💌", "⚡", "🧾", "🛡️", "🎀", "🔖"];
  const save = () => {
    if (!edit) return;
    if (!edit.name.trim() || edit.price < 0) return toast("Add a name and price", "err");
    if (addons.items.some((a) => a.id === edit.id)) {
      if (!canEdit) return toast("Missing edit permission", "err");
      addons.update(edit.id, edit);
    } else {
      if (!canCreate) return toast("Missing create permission", "err");
      addons.add({ ...edit, id: "add_" + Date.now() });
    }
    log("Add-on saved", edit.name);
    toast("Add-on saved");
    setEdit(null);
  };
  return (
    <div>
      <PageHeader icon={<Gift size={22} />} title={t("Add-ons", "অ্যাড-অন")} desc="Optional extras customers can add at checkout — supports Emoji, Image Upload/URL, or SVG."
        actions={canCreate ? <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEdit({ id: "", icon: "🎁", name: "", price: 50, active: true })}>Add item</Button> : undefined} />
      <HelpBox id="addons" title="Idea"><p>Gift wrap 🎁 (+৳50), extra box 📦 (+৳30), thank-you card 💌 (+৳20). See how often each is picked in Insights → Marketing.</p></HelpBox>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {addons.items.map((a) => { const s = stats.get(a.name) || { n: 0, rev: 0 }; return (
          <Card key={a.id} className={`p-5 ${a.active ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between">
              <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-amber-50 text-3xl">
                <IconView icon={a.icon} size={32} />
              </div>
              <Toggle disabled={!canEdit} checked={a.active} onChange={(v) => addons.update(a.id, { active: v })} />
            </div>
            <div className="mt-3 font-semibold text-slate-900">{a.name}</div>
            <div className="text-xl font-bold text-indigo-600">+{money(a.price)}</div>
            <div className="mt-2 text-xs text-slate-500">{s.n} orders · {money(s.rev)} earned</div>
            <div className="mt-4 flex gap-1.5">
              {canEdit && <Button size="sm" className="flex-1" icon={<Pencil size={13} />} onClick={() => setEdit({ ...a })}>Edit</Button>}
              {canDelete && <ConfirmButton onConfirm={() => { addons.remove(a.id); toast("Add-on deleted"); }}><Trash2 size={15} /></ConfirmButton>}
            </div>
          </Card>); })}
        {addons.items.length === 0 && <Card className="sm:col-span-2 xl:col-span-4"><Empty title="No add-ons yet" /></Card>}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit add-on" : "New add-on"} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
        {edit && <div className="space-y-4">
          <Field label="Icon (Emoji, Photo Upload, Image URL, or SVG Code)">
            <MediaPicker allowSvg value={edit.icon} onChange={(v) => setEdit({ ...edit, icon: v })} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {icons.map((i) => <button key={i} type="button" onClick={() => setEdit({ ...edit, icon: i })} className={`grid h-10 w-10 place-items-center rounded-xl border text-xl ${edit.icon === i ? "border-indigo-600 bg-indigo-50" : "border-slate-200"}`}>{i}</button>)}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_140px]"><Field label="Name" required><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Gift Wrap" autoFocus /></Field><Field label="Price (৳)" required><Input type="number" value={edit.price} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) })} /></Field></div>
          <Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Show at checkout" />
        </div>}
      </Modal>
    </div>
  );
}
