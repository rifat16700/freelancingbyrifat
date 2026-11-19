import { useEffect, useMemo, useState } from "react";
import { Crown, Download, Heart, MessageCircle, Phone, Sparkles, UserMinus, Users } from "lucide-react";
import { useStore } from "../store";
import { go, useRoute } from "../router";
import { Avatar, Badge, Button, Card, Drawer, Empty, PageHeader, Pager, SearchBox, Select, StatusBadge, Stat, Tabs, Td, Th, usePaged } from "../components/ui";
import { ago, dateFull, downloadCSV, money, pct } from "../lib/format";
import type { Customer } from "../types";

const SEG_TONE: Record<string, "amber" | "green" | "blue" | "red" | "slate"> = { VIP: "amber", Loyal: "green", New: "blue", "At risk": "red", Regular: "slate" };
const SEG_HELP: Record<string, string> = {
  VIP: "Spent ৳14k+ or ordered 4+ times. Treat them like gold.",
  Loyal: "Ordered twice or more recently.",
  New: "First order in the last 30 days — welcome them!",
  "At risk": "Ordered 2+ times but quiet for 60+ days.",
  Regular: "One order, older than 30 days.",
};

export function Customers() {
  const { customers, settings, t, toast } = useStore();
  const { query } = useRoute();
  const [seg, setSeg] = useState(query.get("segment") || "All");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("spent");
  const [openPhone, setOpen] = useState<string | null>(query.get("phone"));
  useEffect(() => { setOpen(query.get("phone")); if (query.get("segment")) setSeg(query.get("segment")!); }, [query]);

  const counts = useMemo(() => { const c: Record<string, number> = { All: customers.length }; customers.forEach((x) => (c[x.segment] = (c[x.segment] || 0) + 1)); return c; }, [customers]);
  const list = useMemo(() => {
    const s = q.toLowerCase();
    const l = customers.filter((c) => (seg === "All" || c.segment === seg) && (!s || c.name.toLowerCase().includes(s) || c.phone.includes(s) || c.district.toLowerCase().includes(s)));
    if (sort === "recent") return [...l].sort((a, b) => b.last.localeCompare(a.last));
    if (sort === "orders") return [...l].sort((a, b) => b.valid.length - a.valid.length);
    return l;
  }, [customers, seg, q, sort]);
  const pg = usePaged(list, 12);
  useEffect(() => pg.setPage(0), [seg, q, sort]); // eslint-disable-line
  const open = customers.find((c) => c.phone === openPhone) || null;
  const totalSpent = customers.reduce((s, c) => s + c.spent, 0);
  const repeatBuyers = customers.filter((c) => c.valid.length >= 2).length;

  const msg = (c: Customer) => {
    const first = c.name.split(" ")[0];
    return c.segment === "At risk" ? `Hi ${first}! We miss you at ${settings.storeName} 💛 Here is a special ${settings.repeatType === "Flat" ? "৳" + settings.repeatValue : settings.repeatValue + "%"} welcome-back discount — just use your phone number at checkout.` : `Hi ${first}! Thank you for shopping with ${settings.storeName} ❤️ Your personal coupon is your phone number — use it on your next order.`;
  };

  return (
    <div>
      <PageHeader icon={<Users size={22} />} title={t("Customers", "কাস্টমার")} desc={t("Everyone who ever ordered, built automatically from phone numbers.", "ফোন নম্বর থেকে স্বয়ংক্রিয়ভাবে তৈরি কাস্টমার তালিকা।")}
        actions={<Button icon={<Download size={15} />} onClick={() => downloadCSV("customers.csv", ["Name", "Phone", "District", "Orders", "Spent", "Segment", "Last order"], list.map((c) => [c.name, c.phone, c.district, c.valid.length, c.spent, c.segment, c.last.slice(0, 10)]))}>Export CSV</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total customers" value={customers.length} icon={<Users size={20} />} />
        <Stat label="Repeat buyers" value={repeatBuyers} sub={pct((repeatBuyers / customers.length) * 100, 0) + " of all"} icon={<Heart size={20} />} tone="rose" />
        <Stat label="Lifetime value (avg)" value={money(totalSpent / customers.length)} icon={<Crown size={20} />} tone="amber" />
        <Stat label="Win-back needed" value={counts["At risk"] || 0} sub="loyal but quiet" icon={<UserMinus size={20} />} tone="rose" goodUp={false} />
      </div>

      <Tabs value={seg} onChange={setSeg} className="mb-3" tabs={["All", "VIP", "Loyal", "New", "At risk", "Regular"].map((id) => ({ id, label: id, count: counts[id] || 0 }))} />
      {seg !== "All" && <p className="mb-3 text-sm text-slate-500"><Sparkles size={14} className="mr-1 inline text-amber-500" />{SEG_HELP[seg]}</p>}
      <Card className="mb-4 flex flex-col gap-3 p-4 sm:flex-row">
        <SearchBox value={q} onChange={setQ} placeholder="Search name, phone or district…" className="flex-1" />
        <Select value={sort} onChange={(e) => setSort(e.target.value)} className="sm:!w-48"><option value="spent">Highest spend</option><option value="orders">Most orders</option><option value="recent">Most recent</option></Select>
      </Card>
      <Card className="overflow-hidden">
        {list.length === 0 ? <Empty title="No customers found" /> : <>
          <div className="overflow-x-auto"><table className="w-full">
            <thead><tr><Th>Customer</Th><Th>Location</Th><Th>Orders</Th><Th>Total spent</Th><Th>Last order</Th><Th>Segment</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {pg.rows.map((c) => (
                <tr key={c.phone} onClick={() => go(`/customers?phone=${c.phone}`)} className="cursor-pointer hover:bg-slate-50/70">
                  <Td><div className="flex items-center gap-3"><Avatar name={c.name} /><div><div className="font-medium text-slate-900">{c.name}</div><div className="text-xs text-slate-400">{c.phone}</div></div></div></Td>
                  <Td>{c.district}<div className="text-xs text-slate-400">{c.division}</div></Td>
                  <Td className="font-semibold">{c.valid.length}</Td>
                  <Td className="font-semibold">{money(c.spent)}</Td>
                  <Td>{ago(c.last)}</Td>
                  <Td><Badge tone={SEG_TONE[c.segment]}>{c.segment}</Badge></Td>
                </tr>
              ))}
            </tbody></table></div>
          <Pager {...pg} />
        </>}
      </Card>

      <Drawer open={!!open} onClose={() => go("/customers")} title={open?.name} sub={open?.phone}
        footer={open && <>
          <a href={`tel:${open.phone}`}><Button icon={<Phone size={15} />}>Call</Button></a>
          <a className="flex-1" href={`https://wa.me/88${open.phone}?text=${encodeURIComponent(msg(open))}`} target="_blank" rel="noreferrer" onClick={() => toast("Opening WhatsApp with a ready message")}><Button variant="primary" className="w-full" icon={<MessageCircle size={15} />}>WhatsApp offer</Button></a>
        </>}>
        {open && (
          <div className="space-y-5">
            <div className="flex items-center gap-4"><Avatar name={open.name} size={56} /><div><Badge tone={SEG_TONE[open.segment]}>{open.segment}</Badge><div className="mt-1 text-sm text-slate-500">{open.district}, {open.division}{open.email ? ` · ${open.email}` : ""}</div><div className="text-xs text-slate-400">Customer since {dateFull(open.first)}</div></div></div>
            <div className="grid grid-cols-3 gap-3">
              {[["Orders", open.valid.length], ["Spent", money(open.spent)], ["Avg order", money(open.spent / (open.valid.length || 1))]].map(([a, b]) => <div key={a as string} className="rounded-2xl bg-slate-50 p-3.5"><div className="text-xs text-slate-500">{a}</div><div className="mt-0.5 text-lg font-bold">{b}</div></div>)}
            </div>
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm text-indigo-900"><b>Suggested message:</b><p className="mt-1 text-indigo-800/80">{msg(open)}</p></div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Order history ({open.orders.length})</h3>
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                {open.orders.map((o) => (
                  <button key={o.id} onClick={() => go(`/orders?id=${o.id}`)} className="flex w-full items-center gap-3 p-3.5 text-left hover:bg-slate-50">
                    <div className="min-w-0 flex-1"><div className="text-sm font-semibold">{o.id}</div><div className="truncate text-xs text-slate-400">{o.items.map((i) => i.name).join(", ")}</div></div>
                    <div className="text-right"><div className="text-sm font-semibold">{money(o.grand)}</div><StatusBadge s={o.status} /></div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
