import { useEffect, useMemo, useState } from "react";
import { Ban, CheckCircle2, Copy, Download, MapPin, MessageCircle, Package, Phone, Printer, Save, Trash2, Truck, X } from "lucide-react";
import { useStore } from "../store";
import { go, useRoute } from "../router";
import { Avatar, Badge, Button, Card, Check2, Chips, ConfirmButton, Drawer, Empty, Field, Input, Modal, PayBadge, Pager, SearchBox, Select, StatusBadge, Tabs, Td, Textarea, Th, usePaged } from "../components/ui";
import { ago, dateFull, downloadCSV, money, timeFull } from "../lib/format";
import { cn } from "../utils/cn";
import type { Order, Status } from "../types";

const FLOW: Status[] = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered"];
const NEXT: Partial<Record<Status, Status>> = { Pending: "Confirmed", Confirmed: "Processing", Processing: "Shipped", Shipped: "Delivered" };
const NEXT_LABEL: Partial<Record<Status, string>> = { Pending: "Confirm order", Confirmed: "Start processing", Processing: "Mark as shipped", Shipped: "Mark as delivered" };

export function Orders() {
  const { orders, brands, t, toast, log, brandName, brandOf, settings, hasPerm } = useStore();
  const { query } = useRoute();
  const [tab, setTab] = useState<string>(query.get("failed") ? "Failed" : query.get("status") || "All");
  const [q, setQ] = useState("");
  const [pay, setPay] = useState("");
  const [method, setMethod] = useState("");
  const [type, setType] = useState("");
  const [brand, setBrand] = useState("");
  const [sort, setSort] = useState("newest");
  const [when, setWhen] = useState<"all" | "today" | "7" | "30">("all");
  const [sel, setSel] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(query.get("id"));
  const [cancelFor, setCancelFor] = useState<Order | null>(null);
  const [courierDraft, setCourierDraft] = useState({ courierName: "", trackingNumber: "", trackingUrl: "", note: "" });

  const canEdit = hasPerm("orders", "edit");
  const canDelete = hasPerm("orders", "delete");

  useEffect(() => {
    setOpenId(query.get("id"));
    if (query.get("status")) setTab(query.get("status")!);
    if (query.get("failed")) setTab("Failed");
  }, [query]);

  const open = orders.items.find((o) => o.id === openId) || null;

  useEffect(() => {
    if (open) {
      setCourierDraft({
        courierName: open.courierName || "",
        trackingNumber: open.trackingNumber || "",
        trackingUrl: open.trackingUrl || "",
        note: open.note || "",
      });
    }
  }, [open?.id]); // eslint-disable-line

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: 0, Failed: 0 };
    orders.items.forEach((o) => { if (o.failed) c.Failed++; else { c.All++; c[o.status] = (c[o.status] || 0) + 1; } });
    return c;
  }, [orders.items]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const cut = when === "today" ? new Date().setHours(0, 0, 0, 0) : when === "7" ? Date.now() - 7 * 86400000 : when === "30" ? Date.now() - 30 * 86400000 : 0;
    let l = orders.items.filter((o) => {
      if (tab === "Failed" ? !o.failed : o.failed || (tab !== "All" && o.status !== tab)) return false;
      if (pay && o.payStatus !== pay) return false;
      if (method && o.method !== method) return false;
      if (type && o.type !== type) return false;
      if (brand && o.brandId !== brand) return false;
      if (cut && new Date(o.date).getTime() < cut) return false;
      if (s && !(o.id.toLowerCase().includes(s) || o.customerName.toLowerCase().includes(s) || o.customerPhone.includes(s) || o.items.some((i) => i.name.toLowerCase().includes(s)) || o.district.toLowerCase().includes(s))) return false;
      return true;
    });
    if (sort === "oldest") l = [...l].reverse();
    if (sort === "highest") l = [...l].sort((a, b) => b.grand - a.grand);
    return l;
  }, [orders.items, tab, q, pay, method, type, brand, sort, when]);
  const pg = usePaged(list, 12);
  useEffect(() => { pg.setPage(0); setSel([]); /* eslint-disable-next-line */ }, [tab, q, pay, method, type, brand, sort, when]);

  const setStatus = (o: Order, s: Status, extra?: Partial<Order>) => {
    if (!canEdit) return toast("You don't have permission to edit orders", "err");
    const patch: Partial<Order> = { status: s, ...extra };
    if (s === "Delivered") { patch.payStatus = "Paid"; patch.deliveryDays = o.deliveryDays || 2; }
    orders.update(o.id, patch);
    log(`Order status → ${s}`, o.id);
    toast(`${o.id} → ${s}`);
  };
  const bulk = (s: Status) => {
    if (!canEdit) return toast("Missing edit permission", "err");
    sel.forEach((id) => { const o = orders.items.find((x) => x.id === id); if (o) setStatus(o, s); });
    setSel([]);
  };
  const exportCSV = () => downloadCSV("orders.csv", ["Order", "Date", "Customer", "Phone", "District", "Items", "Total", "Method", "Payment", "Status", "Courier", "Tracking"], list.map((o) => [o.id, o.date.slice(0, 16), o.customerName, o.customerPhone, o.district, o.items.map((i) => `${i.name} x${i.qty}`).join("; "), o.grand, o.method, o.payStatus, o.status, o.courierName || "", o.trackingNumber || ""]));

  const invoice = (o: Order) => {
    const b = brandOf(o.brandId);
    const sName = b && !b.isMain ? b.name : settings.storeName;
    const w = window.open("", "_blank", "width=760,height=900");
    if (!w) return toast("Allow pop-ups to print", "err");
    w.document.write(`<html><head><title>Invoice ${o.id}</title><style>body{font-family:system-ui,-apple-system,sans-serif;padding:32px;color:#0f172a}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:14px}h1{margin:0;color:${b?.color || "#8b1a1a"}}.r{text-align:right}.box{border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-top:14px}</style></head><body><h1>${sName}</h1><p style="margin:4px 0;color:#64748b">Invoice <b>${o.id}</b> · ${dateFull(o.date)}</p><div class="box"><b>${o.customerName}</b><br/>📞 ${o.customerPhone}<br/>📍 ${o.type === "pickup" ? "Store Pickup — " + settings.pickupAddress : `${o.address}, ${o.upazila}, ${o.district}, ${o.division}`}</div><table><tr><th>Item</th><th>Variant</th><th>Qty</th><th class=r>Price</th></tr>${o.items.map((i) => `<tr><td>${i.name}</td><td>${i.color} / ${i.size}</td><td>${i.qty}</td><td class=r>${money(i.price * i.qty)}</td></tr>`).join("")}</table><p class=r style="line-height:1.7">Subtotal: ${money(o.subtotal)}<br/>${o.promoDiscount ? `Discount (${o.promoCode || "Promo"}): −${money(o.promoDiscount)}<br/>` : ""}Delivery: ${money(o.deliveryCharge)}<br/>${o.addonTotal ? `Add-ons: ${money(o.addonTotal)}<br/>` : ""}<b>Grand Total: ${money(o.grand)}</b><br/>Advance Paid: ${money(o.advance)}<br/><b style="font-size:16px">Collect on Delivery (COD): ${money(o.payStatus === "Paid" ? 0 : Math.max(0, o.grand - o.advance))}</b></p></body></html>`);
    w.document.close();
    w.print();
  };

  const parcelSlip = (o: Order) => {
    const b = brandOf(o.brandId);
    const sName = b && !b.isMain ? b.name : settings.storeName;
    const codDue = o.payStatus === "Paid" ? 0 : Math.max(0, o.grand - o.advance);
    const w = window.open("", "_blank", "width=540,height=720");
    if (!w) return toast("Allow pop-ups to print", "err");
    w.document.write(`<html><head><title>Parcel Slip ${o.id}</title><style>body{font-family:system-ui,-apple-system,sans-serif;padding:20px;color:#0f172a}.card{border:2px solid #0f172a;border-radius:14px;padding:18px}.cod{font-size:24px;font-weight:800;border:2px dashed #0f172a;padding:10px;text-align:center;margin:14px 0;border-radius:10px}</style></head><body><div class="card"><div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0f172a;padding-bottom:10px"><div><b style="font-size:18px">${sName}</b><div style="font-size:12px;color:#475569">Order: ${o.id} · ${dateFull(o.date)}</div></div><div style="text-align:right;font-size:12px"><b>${o.courierName || "Courier"}</b><br/>${o.trackingNumber || ""}</div></div><div style="margin-top:12px;font-size:15px;line-height:1.5"><b>SHIP TO:</b><br/><span style="font-size:18px;font-weight:700">${o.customerName}</span><br/>📞 <b>${o.customerPhone}</b><br/>📍 ${o.address}, ${o.upazila}, ${o.district}, ${o.division}</div><div class="cod">COD TO COLLECT: ${money(codDue)}</div><div style="font-size:13px"><b>Items (${o.items.reduce((s, i) => s + i.qty, 0)}):</b> ${o.items.map((i) => `${i.name} (${i.color}/${i.size}) ×${i.qty}`).join(", ")}</div></div></body></html>`);
    w.document.close();
    w.print();
  };

  const copyCourierBlock = (o: Order) => {
    const codDue = o.payStatus === "Paid" ? 0 : Math.max(0, o.grand - o.advance);
    const txt = `Order: ${o.id}\nName: ${o.customerName}\nPhone: ${o.customerPhone}\nAddress: ${o.address}, ${o.upazila}, ${o.district}, ${o.division}\nCOD Amount: ${codDue} BDT\nItems: ${o.items.map((i) => `${i.name} (${i.color}/${i.size}) x${i.qty}`).join(", ")}`;
    navigator.clipboard?.writeText(txt);
    toast("Courier address block copied 📋");
  };

  const saveCourierAndNote = () => {
    if (!open || !canEdit) return;
    orders.update(open.id, {
      courierName: courierDraft.courierName.trim(),
      trackingNumber: courierDraft.trackingNumber.trim(),
      trackingUrl: courierDraft.trackingUrl.trim(),
      note: courierDraft.note.trim(),
    });
    log("Order courier/note updated", open.id);
    toast("Courier & note saved ✔");
  };

  const tabs = ["All", "Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled", "Failed"].map((id) => ({ id, label: id === "Failed" ? "Failed payment" : id, count: counts[id] || 0 }));

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t("Orders", "অর্ডার")}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{t("Confirm, pack, ship and track every order in one place.", "এক জায়গা থেকে সব অর্ডার কনফার্ম, প্যাক ও শিপ করুন।")}</p>
        </div>
        <Button icon={<Download size={15} />} onClick={exportCSV}>Export {list.length} orders</Button>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-4" />

      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchBox value={q} onChange={setQ} placeholder="Search order ID, name, phone, product, district…" className="flex-1" />
          <Chips options={[{ id: "all", label: "All time" }, { id: "today", label: "Today" }, { id: "7", label: "7 days" }, { id: "30", label: "30 days" }]} value={when} onChange={setWhen} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
          <Select value={pay} onChange={(e) => setPay(e.target.value)}><option value="">Any payment status</option><option>Unpaid</option><option>Advance Paid</option><option>Paid</option></Select>
          <Select value={method} onChange={(e) => setMethod(e.target.value)}><option value="">Any method</option>{["COD", "bKash", "Nagad", "Online Gateway", "Binance Pay"].map((m) => <option key={m}>{m}</option>)}</Select>
          <Select value={type} onChange={(e) => setType(e.target.value)}><option value="">Delivery & pickup</option><option value="delivery">🚚 Delivery</option><option value="pickup">🚶 Pickup</option></Select>
          <Select value={brand} onChange={(e) => setBrand(e.target.value)}><option value="">All brands</option>{brands.items.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest">Highest amount</option></Select>
        </div>
      </Card>

      {sel.length > 0 && canEdit && (
        <div className="sticky top-[72px] z-10 mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
          <span className="font-semibold">{sel.length} selected</span>
          <span className="mx-1 h-4 w-px bg-white/20" />
          <Button size="sm" variant="primary" icon={<CheckCircle2 size={14} />} onClick={() => bulk("Confirmed")}>Confirm</Button>
          <Button size="sm" className="bg-white/10 text-white border-0 hover:bg-white/20" icon={<Truck size={14} />} onClick={() => bulk("Shipped")}>Mark shipped</Button>
          <Button size="sm" className="bg-white/10 text-white border-0 hover:bg-white/20" icon={<Ban size={14} />} onClick={() => bulk("Cancelled")}>Cancel</Button>
          <button className="ml-auto text-slate-400 hover:text-white" onClick={() => setSel([])}><X size={16} /></button>
        </div>
      )}

      <Card className="overflow-hidden">
        {list.length === 0 ? <Empty title="No orders match" sub="Try clearing a filter or search term." action={<Button onClick={() => { setQ(""); setPay(""); setMethod(""); setType(""); setBrand(""); setWhen("all"); setTab("All"); }}>Reset filters</Button>} /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr>
                  <Th className="w-10"><button onClick={() => setSel(sel.length === pg.rows.length ? [] : pg.rows.map((o) => o.id))}><Check2 on={sel.length > 0 && sel.length === pg.rows.length} /></button></Th>
                  <Th>Order</Th><Th>Customer</Th><Th>Items</Th><Th>Total</Th><Th>Payment</Th><Th>Status</Th><Th className="text-right">Next step</Th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {pg.rows.map((o) => (
                    <tr key={o.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => go(`/orders?id=${o.id}`)}>
                      <Td className="w-10"><button onClick={(e) => { e.stopPropagation(); setSel((s) => (s.includes(o.id) ? s.filter((x) => x !== o.id) : [...s, o.id])); }}><Check2 on={sel.includes(o.id)} /></button></Td>
                      <Td><div className="font-semibold text-slate-900">{o.id}</div><div className="text-xs text-slate-400">{ago(o.date)} · {brandName(o.brandId)}</div></Td>
                      <Td><div className="flex items-center gap-2.5"><Avatar name={o.customerName} size={32} /><div><div className="flex items-center gap-1.5 font-medium">{o.customerName}{o.isRepeat && <Badge tone="violet" className="!px-1.5 !py-0 text-[10px]">Repeat</Badge>}</div><div className="text-xs text-slate-400">{o.customerPhone} · {o.district}</div></div></div></Td>
                      <Td className="max-w-[220px]"><div className="truncate">{o.items[0]?.name}</div><div className="text-xs text-slate-400">{o.items.length > 1 ? `+${o.items.length - 1} more` : `${o.items[0]?.color || ""} / ${o.items[0]?.size || ""}`}</div></Td>
                      <Td><div className="font-semibold">{money(o.grand)}</div>{o.promoCode && <div className="text-[11px] text-pink-600">🏷 {o.promoCode}</div>}</Td>
                      <Td><PayBadge s={o.payStatus} /><div className="mt-0.5 text-[11px] text-slate-400">{o.method}</div></Td>
                      <Td><StatusBadge s={o.status} />{o.failed && <div className="mt-0.5 text-[11px] text-rose-500">Payment failed</div>}</Td>
                      <Td className="text-right">{canEdit && NEXT[o.status] && !o.failed ? <Button size="sm" variant="soft" onClick={(e) => { e.stopPropagation(); setStatus(o, NEXT[o.status]!); }}>{NEXT_LABEL[o.status]}</Button> : <span className="text-xs text-slate-300">—</span>}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager {...pg} />
          </>
        )}
      </Card>

      <Drawer
        open={!!open}
        onClose={() => go("/orders")}
        title={open ? `Order ${open.id}` : ""}
        sub={open ? `${timeFull(open.date)} · ${brandName(open.brandId)}` : ""}
        footer={
          open && (
            <>
              {canEdit && NEXT[open.status] && !open.failed && <Button variant="primary" className="flex-1" onClick={() => setStatus(open, NEXT[open.status]!)}>{NEXT_LABEL[open.status]}</Button>}
              {canEdit && open.status !== "Cancelled" && open.status !== "Delivered" && <Button variant="secondary" className="text-rose-600" icon={<Ban size={15} />} onClick={() => setCancelFor(open)}>Cancel</Button>}
              <Button icon={<Printer size={15} />} onClick={() => invoice(open)}>Invoice</Button>
              <Button icon={<Truck size={15} />} onClick={() => parcelSlip(open)}>Parcel Slip</Button>
              {canDelete && (
                <ConfirmButton
                  label="Delete?"
                  onConfirm={() => {
                    orders.remove(open.id);
                    log("Order deleted", open.id);
                    toast("Order permanently deleted");
                    go("/orders");
                  }}
                >
                  <Trash2 size={15} />
                </ConfirmButton>
              )}
            </>
          )
        }
      >
        {open && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5"><StatusBadge s={open.status} /><PayBadge s={open.payStatus} />{open.failed && <Badge tone="red">Payment failed</Badge>}</div>
              <span className="text-xl font-bold">{money(open.grand)}</span>
            </div>
            {open.status !== "Cancelled" && !open.failed && (
              <div className="flex items-center">
                {FLOW.map((s, i) => {
                  const done = FLOW.indexOf(open.status) >= i;
                  return (
                    <div key={s} className="flex flex-1 items-center last:flex-none">
                      <button disabled={!canEdit} onClick={() => setStatus(open, s)} title={`Set ${s}`} className="flex flex-col items-center gap-1 disabled:opacity-60">
                        <span className={cn("grid h-8 w-8 place-items-center rounded-full text-xs font-bold", done ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500")}>{done ? "✓" : i + 1}</span>
                        <span className="text-[10px] text-slate-500">{s}</span>
                      </button>
                      {i < FLOW.length - 1 && <div className={cn("mx-1 mb-4 h-0.5 flex-1", FLOW.indexOf(open.status) > i ? "bg-indigo-600" : "bg-slate-200")} />}
                    </div>
                  );
                })}
              </div>
            )}
            {open.status === "Cancelled" && <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700"><b>Cancelled</b> — {open.cancelReason || "no reason recorded"}</div>}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Customer</h3>
                <button type="button" onClick={() => copyCourierBlock(open)} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline">
                  <Copy size={12} /> Copy Courier Info
                </button>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={open.customerName} size={42} />
                  <div className="flex-1"><div className="font-semibold">{open.customerName}</div><div className="text-sm text-slate-500">{open.customerPhone}</div></div>
                  <a href={`tel:${open.customerPhone}`}><Button size="sm" icon={<Phone size={14} />}>Call</Button></a>
                  <a href={`https://wa.me/88${open.customerPhone}`} target="_blank" rel="noreferrer"><Button size="sm" icon={<MessageCircle size={14} />}>WhatsApp</Button></a>
                </div>
                <div className="mt-3 flex items-start gap-2 text-sm text-slate-600">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" />
                  {open.type === "pickup" ? "Store pickup — " + settings.pickupAddress : `${open.address}, ${open.upazila}, ${open.district}, ${open.division}`}
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Items</h3>
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                {open.items.map((i, k) => (
                  <div key={k} className="flex items-center gap-3 p-3.5">
                    {i.image ? <img src={i.image} alt="" className="h-10 w-10 rounded-xl object-cover border border-slate-200" /> : <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500"><Package size={18} /></div>}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{i.name}</div>
                      <div className="text-xs text-slate-400">{i.color} / {i.size} · qty {i.qty}{i.sku ? ` · ${i.sku}` : ""}</div>
                    </div>
                    <div className="text-sm font-semibold">{money(i.price * i.qty)}</div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Payment</h3>
              <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm">
                {([["Subtotal", money(open.subtotal)], open.promoDiscount ? [`Coupon ${open.promoCode}`, "−" + money(open.promoDiscount)] : null, ["Delivery", open.deliveryDiscount ? `Free (saved ${money(open.deliveryDiscount)})` : money(open.deliveryCharge)], open.addonTotal ? [`Add-ons (${open.addons.join(", ")})`, money(open.addonTotal)] : null] as ([string, string] | null)[]).filter(Boolean).map((r, i) => <div key={i} className="flex justify-between text-slate-600"><span>{r![0]}</span><span>{r![1]}</span></div>)}
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900"><span>Total</span><span>{money(open.grand)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Method</span><span>{open.method}{open.trxId ? ` · TrxID: ${open.trxId}` : ""}</span></div>
                <div className="flex justify-between text-slate-600"><span>Advance paid</span><span>{money(open.advance)}</span></div>
                <div className="flex justify-between font-semibold text-indigo-700"><span>Collect on delivery</span><span>{money(open.payStatus === "Paid" ? 0 : Math.max(0, open.grand - open.advance))}</span></div>
              </div>
              {canEdit && open.payStatus !== "Paid" && open.status !== "Cancelled" && (
                <Button className="mt-3" size="sm" onClick={() => { orders.update(open.id, { payStatus: "Paid", failed: false }); toast("Marked as paid"); log("Payment marked paid", open.id); }}>
                  Mark as paid
                </Button>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Courier Tracking & Admin Note</h3>
              <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Courier Name">
                    <Input
                      list="courier-list"
                      disabled={!canEdit}
                      value={courierDraft.courierName}
                      onChange={(e) => setCourierDraft({ ...courierDraft, courierName: e.target.value })}
                      placeholder="e.g. Steadfast / Pathao / RedX"
                    />
                    <datalist id="courier-list">
                      {["Steadfast", "Pathao", "RedX", "Paperfly", "Sundarban", "SA Paribahan"].map((c) => <option key={c} value={c} />)}
                    </datalist>
                  </Field>
                  <Field label="Tracking Number / Consignment ID">
                    <Input
                      disabled={!canEdit}
                      value={courierDraft.trackingNumber}
                      onChange={(e) => setCourierDraft({ ...courierDraft, trackingNumber: e.target.value })}
                      placeholder="e.g. SF-9928172"
                    />
                  </Field>
                </div>
                <Field label="Tracking URL (optional)">
                  <Input
                    disabled={!canEdit}
                    value={courierDraft.trackingUrl}
                    onChange={(e) => setCourierDraft({ ...courierDraft, trackingUrl: e.target.value })}
                    placeholder="https://steadfast.com.bd/t/…"
                  />
                </Field>
                <Field label="Private Admin Note">
                  <Textarea
                    disabled={!canEdit}
                    rows={2}
                    value={courierDraft.note}
                    onChange={(e) => setCourierDraft({ ...courierDraft, note: e.target.value })}
                    placeholder="Internal note for staff / courier packing…"
                  />
                </Field>
                {canEdit && (
                  <Button size="sm" variant="soft" icon={<Save size={14} />} onClick={saveCourierAndNote}>
                    Save Courier & Note
                  </Button>
                )}
              </div>
            </section>
          </div>
        )}
      </Drawer>

      <Modal open={!!cancelFor} onClose={() => setCancelFor(null)} title="Cancel this order?" sub="Pick a reason — it helps you learn why orders fail (see Insights)."
        footer={<Button onClick={() => setCancelFor(null)}>Keep order</Button>}>
        <div className="grid gap-2">
          {["Customer changed mind", "Not reachable on phone", "Wrong address", "Found cheaper elsewhere", "Out of stock", "Duplicate order"].map((r) => (
            <button key={r} onClick={() => { if (cancelFor) setStatus(cancelFor, "Cancelled", { cancelReason: r }); setCancelFor(null); }} className="rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium hover:border-rose-300 hover:bg-rose-50">{r}</button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
