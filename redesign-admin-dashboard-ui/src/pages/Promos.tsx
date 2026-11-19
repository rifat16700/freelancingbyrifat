import { useMemo, useState } from "react";
import { Copy, Pencil, Plus, Repeat, Tag, Trash2, Wand2 } from "lucide-react";
import { useStore } from "../store";
import { GEO_TREE } from "../data/demo";
import { Badge, Button, Card, Check2, ConfirmButton, Empty, Field, HelpBox, Input, Modal, PageHeader, Progress, SearchBox, Select, Stat, Toggle, Th, Td } from "../components/ui";
import { dateFull, money } from "../lib/format";
import { cn } from "../utils/cn";
import type { Promo } from "../types";

const ALL_DISTRICTS = [...new Set(Object.values(GEO_TREE).flatMap((d) => Object.keys(d)))].sort();
const PAY_METHODS = ["COD", "bKash", "Nagad", "Online Gateway", "Binance Pay"];

const blank = (): Promo => ({
  id: "", code: "", visibility: "Public", discountType: "Flat", value: 100, minSpend: 0,
  freeDelivery: false, delReward: "none", applicableProducts: [], applicableCategories: [],
  applicableDistricts: [], applicablePayments: [], brandId: "all", active: true, note: "",
});
const describe = (p: Promo) =>
  `${p.freeDelivery ? "Free delivery" : ""}${p.freeDelivery && p.value ? " + " : ""}${p.value ? (p.discountType === "Flat" ? money(p.value) : p.value + "%") + " off" : ""}${p.cap ? ` (max ${money(p.cap)})` : ""}${p.minSpend ? ` on orders over ${money(p.minSpend)}` : ""}`;

export function Promos() {
  const { promos, orders, brands, categories, products, settings, setSettings, t, toast, brandName, log, hasPerm } = useStore();
  const [edit, setEdit] = useState<Promo | null>(null);
  const [rep, setRep] = useState(false);
  const [prodSearch, setProdSearch] = useState("");

  const canCreate = hasPerm("promos", "create");
  const canEdit = hasPerm("promos", "edit");
  const canDelete = hasPerm("promos", "delete");

  const usage = useMemo(() => {
    const m = new Map<string, { uses: number; disc: number; rev: number }>();
    orders.items.forEach((o) => {
      if (!o.promoCode || o.status === "Cancelled" || o.failed) return;
      const u = m.get(o.promoCode) || { uses: 0, disc: 0, rev: 0 };
      u.uses++;
      u.disc += o.promoDiscount + o.deliveryDiscount;
      u.rev += o.grand;
      m.set(o.promoCode, u);
    });
    return m;
  }, [orders.items]);

  const tot = [...usage.values()].reduce((a, b) => ({ uses: a.uses + b.uses, disc: a.disc + b.disc, rev: a.rev + b.rev }), { uses: 0, disc: 0, rev: 0 });
  const status = (p: Promo) => (!p.active ? "Off" : p.expiry && new Date(p.expiry) < new Date() ? "Expired" : p.usageLimit && (usage.get(p.code)?.uses || 0) >= p.usageLimit ? "Used up" : "Live");

  const save = () => {
    if (!edit) return;
    const code = edit.code.trim().toUpperCase();
    if (!code) return toast("Enter a coupon code", "err");
    if (promos.items.some((p) => p.code === code && p.id !== edit.id)) return toast("This code already exists", "err");
    if (!edit.value && !edit.freeDelivery) return toast("Add a discount value or enable free delivery", "err");
    const next = { ...edit, code };
    if (edit.id) {
      if (!canEdit) return toast("Missing edit permission", "err");
      promos.update(edit.id, next);
    } else {
      if (!canCreate) return toast("Missing create permission", "err");
      promos.add({ ...next, id: "prm_" + Date.now() });
    }
    log("Promo saved", code);
    toast(`Coupon ${code} saved`);
    setEdit(null);
  };

  const toggleArr = (arr: string[] | undefined, val: string) => {
    const list = arr || [];
    return list.includes(val) ? list.filter((x) => x !== val) : [...list, val];
  };

  return (
    <div>
      <PageHeader
        icon={<Tag size={22} />}
        title={t("Promo codes", "প্রোমো কোড")}
        desc="Discount codes that bring customers back — and what they really cost you."
        actions={
          <>
            {canEdit && <Button icon={<Repeat size={15} />} onClick={() => setRep(true)}>Repeat-customer reward</Button>}
            {canCreate && <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEdit(blank())}>New coupon</Button>}
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Live coupons" value={promos.items.filter((p) => status(p) === "Live").length} icon={<Tag size={20} />} />
        <Stat label="Times used" value={tot.uses} icon={<Wand2 size={20} />} tone="green" />
        <Stat label="Discount given" value={money(tot.disc)} icon={<Tag size={20} />} tone="rose" goodUp={false} />
        <Stat label="Revenue with coupons" value={money(tot.rev)} sub={`${((tot.disc / (tot.rev + tot.disc || 1)) * 100).toFixed(1)}% cost ratio`} icon={<Tag size={20} />} tone="violet" />
      </div>

      <Card className={cn("mb-5 flex flex-wrap items-center gap-4 p-5", settings.repeatEnabled ? "border-emerald-200 bg-emerald-50/50" : "")}>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><Repeat /></div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900">Repeat-customer reward {settings.repeatEnabled ? <Badge tone="green">On</Badge> : <Badge>Off</Badge>}</div>
          <p className="text-sm text-slate-600">When an order is <b>Delivered</b>, the customer’s phone number becomes their personal coupon: {settings.repeatType === "Flat" ? money(settings.repeatValue) : settings.repeatValue + "%"} off for {settings.repeatDays} days{settings.repeatMin ? `, min ${money(settings.repeatMin)}` : ""}{settings.repeatFreeShip ? " + free delivery" : ""}.</p>
        </div>
        <Toggle disabled={!canEdit} checked={settings.repeatEnabled} onChange={(v) => setSettings({ repeatEnabled: v })} />
        {canEdit && <Button onClick={() => setRep(true)} icon={<Pencil size={14} />}>Configure</Button>}
      </Card>

      <HelpBox id="promos" title="Public vs Private"><p><b>Public</b> coupons are suggested to customers at checkout. <b>Private</b> coupons only work if typed exactly — perfect for influencers and Facebook lives.</p></HelpBox>

      <Card className="overflow-hidden">
        {promos.items.length === 0 ? <Empty title="No coupons yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><Th>Coupon</Th><Th>What customer gets</Th><Th>For</Th><Th>Usage</Th><Th>Expires</Th><Th>Status</Th><Th /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {promos.items.map((p) => {
                  const u = usage.get(p.code) || { uses: 0, disc: 0, rev: 0 };
                  const st = status(p);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg border border-dashed border-indigo-300 bg-indigo-50 px-2.5 py-1 font-mono text-sm font-bold text-indigo-700">{p.code}</span>
                          <button onClick={() => { navigator.clipboard?.writeText(p.code); toast("Copied " + p.code); }} className="text-slate-400 hover:text-indigo-600"><Copy size={14} /></button>
                        </div>
                        <div className="mt-1 text-xs text-slate-400">{p.visibility}{p.note ? ` · ${p.note}` : ""}</div>
                      </Td>
                      <Td className="max-w-[260px]">{describe(p)}</Td>
                      <Td>{brandName(p.brandId)}</Td>
                      <Td className="min-w-[150px]">
                        <div className="mb-1 flex justify-between text-xs"><span>{u.uses} uses</span><span className="text-slate-400">{p.usageLimit ? `/ ${p.usageLimit}` : "∞"}</span></div>
                        {p.usageLimit ? <Progress value={(u.uses / p.usageLimit) * 100} tone={u.uses / p.usageLimit > 0.85 ? "rose" : "indigo"} /> : <div className="text-xs text-slate-400">{money(u.rev)} revenue</div>}
                      </Td>
                      <Td>{p.expiry ? dateFull(p.expiry) : "Never"}</Td>
                      <Td><Badge tone={st === "Live" ? "green" : st === "Off" ? "slate" : "red"} dot>{st}</Badge></Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Toggle disabled={!canEdit} checked={p.active} onChange={(v) => promos.update(p.id, { active: v })} />
                          {canEdit && <Button size="sm" onClick={() => setEdit({ ...p })}><Pencil size={13} /></Button>}
                          {canDelete && <ConfirmButton onConfirm={() => { promos.remove(p.id); toast("Coupon deleted"); }}><Trash2 size={15} /></ConfirmButton>}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} wide title={edit?.id ? "Edit coupon" : "New coupon"} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save coupon</Button></>}>
        {edit && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-4 text-white">
              <div className="text-xs text-indigo-200">Preview</div>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <span className="rounded-lg border border-dashed border-white/50 px-3 py-1 font-mono text-lg font-bold">{edit.code || "YOURCODE"}</span>
                <span className="text-sm">{describe(edit) || "Set a discount below"}</span>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Coupon code" required><Input value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase().replace(/\s/g, "") })} placeholder="SAVE100" autoFocus /></Field>
              <Field label="Who can see it?"><Select value={edit.visibility} onChange={(e) => setEdit({ ...edit, visibility: e.target.value as Promo["visibility"] })}><option value="Public">Public — suggested at checkout</option><option value="Private">Private — must be typed</option></Select></Field>
              <Field label="Discount type"><Select value={edit.discountType} onChange={(e) => setEdit({ ...edit, discountType: e.target.value as Promo["discountType"] })}><option value="Flat">Flat amount (৳)</option><option value="Percent">Percentage (%)</option></Select></Field>
              <Field label={edit.discountType === "Flat" ? "Amount (৳)" : "Percent (%)"}><Input type="number" value={edit.value || ""} onChange={(e) => setEdit({ ...edit, value: Number(e.target.value) })} /></Field>
              {edit.discountType === "Percent" && <Field label="Maximum discount (৳)" hint="Blank = no limit"><Input type="number" value={edit.cap || ""} onChange={(e) => setEdit({ ...edit, cap: Number(e.target.value) || undefined })} /></Field>}
              <Field label="Minimum spend (৳)" hint="Delivery isn’t counted"><Input type="number" value={edit.minSpend || ""} onChange={(e) => setEdit({ ...edit, minSpend: Number(e.target.value) })} /></Field>
              <Field label="Usage limit" hint="Blank = unlimited"><Input type="number" value={edit.usageLimit || ""} onChange={(e) => setEdit({ ...edit, usageLimit: Number(e.target.value) || undefined })} /></Field>
              <Field label="Expiry date"><Input type="date" value={edit.expiry ? edit.expiry.slice(0, 10) : ""} onChange={(e) => setEdit({ ...edit, expiry: e.target.value ? new Date(e.target.value + "T23:59:00").toISOString() : undefined })} /></Field>
              <Field label="Works for"><Select value={edit.brandId} onChange={(e) => setEdit({ ...edit, brandId: e.target.value })}><option value="all">All brands</option>{brands.items.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
              <Field label="Internal note"><Input value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} placeholder="Eid campaign" /></Field>
            </div>
            <div className="divide-y divide-slate-100">
              <Toggle checked={edit.freeDelivery} onChange={(v) => setEdit({ ...edit, freeDelivery: v, delReward: v ? "free" : "none" })} label="Free delivery" hint="Customer pays no delivery charge." />
              <Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Active" />
            </div>

            <details className="rounded-2xl border border-slate-200 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">⚙️ Advanced Targeting (Products, Categories, Districts, Payments & Delivery Cap)</summary>
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Delivery discount cap (৳)" hint="Max delivery discount when Free Delivery is enabled">
                    <Input type="number" value={edit.delDiscCap || ""} onChange={(e) => setEdit({ ...edit, delDiscCap: Number(e.target.value) || undefined })} placeholder="No limit" />
                  </Field>
                  <Field label="Allowed Payment Methods" hint="Leave all unchecked for any payment method">
                    <div className="flex flex-wrap gap-1.5">
                      {PAY_METHODS.map((pm) => {
                        const on = (edit.applicablePayments || []).includes(pm);
                        return (
                          <button
                            key={pm}
                            type="button"
                            onClick={() => setEdit({ ...edit, applicablePayments: toggleArr(edit.applicablePayments, pm) })}
                            className={cn("rounded-xl border px-2.5 py-1 text-xs font-medium", on ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600")}
                          >
                            {pm}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                </div>

                <Field label={`Target Categories (${(edit.applicableCategories || []).length || "All"})`} hint="Leave empty to allow all categories">
                  <div className="flex flex-wrap gap-1.5">
                    {categories.items.map((c) => {
                      const on = (edit.applicableCategories || []).includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setEdit({ ...edit, applicableCategories: toggleArr(edit.applicableCategories, c.id) })}
                          className={cn("rounded-xl border px-2.5 py-1 text-xs font-medium", on ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600")}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <Field label={`Target Specific Products (${(edit.applicableProducts || []).length || "All"})`} hint="Leave empty to allow all products">
                  <SearchBox value={prodSearch} onChange={setProdSearch} placeholder="Filter products…" className="mb-2" />
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 p-1.5">
                    {products.items.filter((p) => p.name.toLowerCase().includes(prodSearch.toLowerCase())).map((p) => {
                      const on = (edit.applicableProducts || []).includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setEdit({ ...edit, applicableProducts: toggleArr(edit.applicableProducts, p.id) })}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-slate-50"
                        >
                          <Check2 on={on} />
                          <span className="truncate font-medium">{p.name}</span>
                          <span className="ml-auto text-slate-400">{p.sku}</span>
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <Field label={`Target Districts (${(edit.applicableDistricts || []).length || "All"})`} hint="Leave empty to allow all districts">
                  <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
                    {ALL_DISTRICTS.map((d) => {
                      const on = (edit.applicableDistricts || []).includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setEdit({ ...edit, applicableDistricts: toggleArr(edit.applicableDistricts, d) })}
                          className={cn("rounded-full border px-2 py-0.5 text-[11px]", on ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600")}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>
            </details>
          </div>
        )}
      </Modal>

      <Modal open={rep} onClose={() => setRep(false)} title="Repeat-customer reward" sub="Reward people who received their order — automatically." footer={<Button variant="primary" onClick={() => { setRep(false); toast("Reward settings saved"); log("Repeat coupon config", "Promos"); }}>Done</Button>}>
        <div className="space-y-4">
          <Toggle checked={settings.repeatEnabled} onChange={(v) => setSettings({ repeatEnabled: v })} label="Enabled" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Discount type"><Select value={settings.repeatType} onChange={(e) => setSettings({ repeatType: e.target.value })}><option value="Flat">Flat (৳)</option><option value="Percent">Percentage (%)</option></Select></Field>
            <Field label="Value"><Input type="number" value={settings.repeatValue} onChange={(e) => setSettings({ repeatValue: Number(e.target.value) })} /></Field>
            <Field label="Max discount (৳)" hint="0 = unlimited"><Input type="number" value={settings.repeatCap} onChange={(e) => setSettings({ repeatCap: Number(e.target.value) })} /></Field>
            <Field label="Valid for (days after delivery)"><Input type="number" value={settings.repeatDays} onChange={(e) => setSettings({ repeatDays: Number(e.target.value) })} /></Field>
            <Field label="Minimum cart (৳)"><Input type="number" value={settings.repeatMin} onChange={(e) => setSettings({ repeatMin: Number(e.target.value) })} /></Field>
          </div>
          <Toggle checked={settings.repeatFreeShip} onChange={(v) => setSettings({ repeatFreeShip: v })} label="Also give free delivery" />
        </div>
      </Modal>
    </div>
  );
}
