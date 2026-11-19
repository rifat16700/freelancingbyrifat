import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, DollarSign, MessageSquareHeart, Package, Plus, ShoppingBag, Sparkles, Tag, Timer, TrendingUp, Wallet, Zap } from "lucide-react";
import { useStore } from "../store";
import { go } from "../router";
import { Badge, Button, Card, CardHead, Chips, Empty, PayBadge, Stat, StatusBadge, Th, Td, STATUS_HEX, Thumb } from "../components/ui";
import { BarList, LineChart } from "../components/charts";
import { ago, isValid, localDay, money, moneyShort, num, pct, dateShort } from "../lib/format";
import { cn } from "../utils/cn";
import type { Status } from "../types";

const DAY = 86400000;
export function Dashboard() {
  const { orders, products, reviews, promos, customers, settings, t, toast, log } = useStore();
  const [range, setRange] = useState<"7" | "14" | "30">("7");
  const [report, setReport] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const d = useMemo(() => {
    const all = orders.items;
    const valid = all.filter(isValid);
    const today = localDay(new Date());
    const yest = localDay(new Date(Date.now() - DAY));
    const on = (k: string) => valid.filter((o) => localDay(new Date(o.date)) === k);
    const tOrders = on(today), yOrders = on(yest);
    const sumR = (l: typeof valid) => l.reduce((s, o) => s + o.grand, 0);
    const cut = (n: number, off = 0) => valid.filter((o) => { const x = Date.now() - new Date(o.date).getTime(); return x >= off * DAY && x < (n + off) * DAY; });
    const last30 = cut(30), prev30 = cut(30, 30);
    const pending = all.filter((o) => o.status === "Pending" && !o.failed);
    const stale = pending.filter((o) => Date.now() - new Date(o.date).getTime() > DAY);
    const verify = pending.filter((o) => o.method === "bKash" || o.method === "Nagad");
    const failed = all.filter((o) => o.failed && Date.now() - new Date(o.date).getTime() < 7 * DAY);
    const lowStock = products.items.filter((p) => p.active).flatMap((p) => p.variants.flatMap((v) => Object.entries(v.sizes).filter(([, q]) => q <= settings.lowStockLimit).map(([s, q]) => ({ p, v, s, q }))));
    const out = lowStock.filter((x) => x.q === 0).length;
    const flashEnding = products.items.filter((p) => p.active && p.flash && p.flashEnd && new Date(p.flashEnd).getTime() - Date.now() < 2 * DAY && new Date(p.flashEnd).getTime() > Date.now());
    const promoEnding = promos.items.filter((p) => p.active && p.expiry && new Date(p.expiry).getTime() - Date.now() < 7 * DAY && new Date(p.expiry).getTime() > Date.now());
    const pendRev = reviews.items.filter((r) => !r.approved).length;
    const atRisk = customers.filter((c) => c.segment === "At risk").length;
    const statusCount: Record<string, number> = {};
    all.filter((o) => !o.failed && Date.now() - new Date(o.date).getTime() < 30 * DAY).forEach((o) => (statusCount[o.status] = (statusCount[o.status] || 0) + 1));
    // best sellers 7d
    const best = new Map<string, { name: string; qty: number; id: string }>();
    cut(7).forEach((o) => o.items.forEach((i) => { const b = best.get(i.productId) || { name: i.name, qty: 0, id: i.productId }; b.qty += i.qty; best.set(i.productId, b); }));
    return { tOrders, yOrders, tRev: sumR(tOrders), yRev: sumR(yOrders), last30, prev30, r30: sumR(last30), p30: sumR(prev30), pending, stale, verify, failed, lowStock, out, flashEnding, promoEnding, pendRev, atRisk, statusCount, best: [...best.values()].sort((a, b) => b.qty - a.qty).slice(0, 6), valid };
  }, [orders.items, products.items, reviews.items, promos.items, customers, settings.lowStockLimit]);

  const series = useMemo(() => {
    const n = Number(range);
    return Array.from({ length: n }, (_, i) => {
      const dt = new Date(Date.now() - (n - 1 - i) * DAY);
      const k = localDay(dt);
      return { x: dateShort(dt.toISOString()), y: d.valid.filter((o) => localDay(new Date(o.date)) === k).reduce((s, o) => s + o.grand, 0) };
    });
  }, [d.valid, range]);

  const hour = new Date().getHours();
  const greet = hour < 12 ? t("Good morning", "শুভ সকাল") : hour < 17 ? t("Good afternoon", "শুভ অপরাহ্ন") : t("Good evening", "শুভ সন্ধ্যা");
  const delta = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);

  const actions = [
    { n: d.stale.length, icon: Clock, tone: "rose", title: t("Orders waiting 24h+", "২৪ ঘণ্টার বেশি পেন্ডিং অর্ডার"), sub: t("Call the customer and confirm", "কাস্টমারকে কল করে কনফার্ম করুন"), to: "/orders?status=Pending" },
    { n: d.verify.length, icon: Wallet, tone: "amber", title: t("bKash / Nagad to verify", "TrxID যাচাই করুন"), sub: t("Check payment, then confirm", "পেমেন্ট চেক করে কনফার্ম করুন"), to: "/orders?status=Pending" },
    { n: d.lowStock.length, icon: Package, tone: "rose", title: t("Low-stock variants", "স্টক কমে যাচ্ছে"), sub: `${d.out} ${t("already out of stock", "টি শেষ")}`, to: "/products?stock=low" },
    { n: d.pendRev, icon: MessageSquareHeart, tone: "amber", title: t("Reviews to approve", "রিভিউ অ্যাপ্রুভ করুন"), sub: t("Fresh reviews build trust", "নতুন রিভিউ বিশ্বাস বাড়ায়"), to: "/reviews" },
    { n: d.failed.length, icon: AlertTriangle, tone: "amber", title: t("Failed online payments (7d)", "ব্যর্থ অনলাইন পেমেন্ট"), sub: t("Call them — they wanted to buy", "ফোন করুন — তারা কিনতে চেয়েছিল"), to: "/orders?failed=1" },
    { n: d.flashEnding.length, icon: Zap, tone: "indigo", title: t("Flash sales ending in 48h", "ফ্ল্যাশ সেল শেষ হচ্ছে"), sub: t("Extend or announce last chance", "বাড়ান বা শেষ সুযোগ জানান"), to: "/products" },
    { n: d.promoEnding.length, icon: Tag, tone: "indigo", title: t("Coupons expiring in 7 days", "কুপন শেষ হচ্ছে"), sub: d.promoEnding.map((p) => p.code).join(", ") || "", to: "/promos" },
    { n: d.atRisk, icon: TrendingUp, tone: "sky", title: t("Loyal customers going quiet", "পুরনো কাস্টমার হারিয়ে যাচ্ছে"), sub: t("Send a win-back offer", "ওয়িন-ব্যাক অফার পাঠান"), to: "/customers?segment=At risk" },
  ].filter((a) => a.n > 0);
  const tone: Record<string, string> = { rose: "bg-rose-50 text-rose-600", amber: "bg-amber-50 text-amber-600", indigo: "bg-indigo-50 text-indigo-600", sky: "bg-sky-50 text-sky-600" };

  const genReport = () => {
    setBusy(true);
    setTimeout(() => {
      const w = d.valid.filter((o) => Date.now() - new Date(o.date).getTime() < 7 * DAY);
      const pw = d.valid.filter((o) => { const x = Date.now() - new Date(o.date).getTime(); return x >= 7 * DAY && x < 14 * DAY; });
      const r = w.reduce((s, o) => s + o.grand, 0), pr = pw.reduce((s, o) => s + o.grand, 0);
      const ch = delta(r, pr);
      const lines = [
        `${ch >= 0 ? "📈" : "📉"} Last 7 days: ${money(r)} from ${w.length} orders (${ch >= 0 ? "+" : ""}${ch.toFixed(1)}% vs the week before).`,
        d.best[0] ? `🏆 Best seller: ${d.best[0].name} (${d.best[0].qty} sold). Keep it in stock and promote it first.` : "",
        d.stale.length ? `⏰ ${d.stale.length} orders have been pending for over 24h. Confirming them today can save ~${money(d.stale.reduce((s, o) => s + o.grand, 0))}.` : "✅ No stale pending orders — great response time.",
        d.lowStock.length ? `📦 ${d.lowStock.length} variants are low or out of stock (${d.out} out). Reorder soon.` : "",
        d.failed.length ? `💳 ${d.failed.length} online payments failed this week. A quick phone call often recovers them.` : "",
        `💡 Tip: your orders peak in the evening — schedule Facebook posts around 7–8pm.`,
      ].filter(Boolean);
      setReport(lines);
      setBusy(false);
      log("AI report generated", "Dashboard");
    }, 900);
  };

  const confirm = (id: string) => { orders.update(id, { status: "Confirmed" }); toast(t("Order confirmed", "অর্ডার কনফার্ম হয়েছে")); log("Order status → Confirmed", id); };
  const recent = orders.items.slice(0, 7);
  const statuses: Status[] = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"];
  const total30 = Object.values(d.statusCount).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-6 text-white shadow-xl shadow-indigo-600/20 sm:p-8">
        <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-indigo-200">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{greet}, Rifat 👋</h1>
            <p className="mt-2 max-w-lg text-indigo-100">
              {d.tOrders.length > 0 ? t(`You have ${d.tOrders.length} new orders worth ${money(d.tRev)} today.`, `আজ ${d.tOrders.length}টি অর্ডার এসেছে, মোট ${money(d.tRev)}।`) : t("No orders yet today — a good time to post on Facebook!", "আজ এখনো অর্ডার আসেনি — ফেসবুকে পোস্ট দেওয়ার ভালো সময়!")}
              {actions.length > 0 && " " + t(`${actions.length} things need your attention.`, `${actions.length}টি বিষয়ে আপনার নজর দরকার।`)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" className="border-0 bg-white text-indigo-700 hover:bg-indigo-50" icon={<ShoppingBag size={16} />} onClick={() => go("/orders?status=Pending")}>{t("Process orders", "অর্ডার প্রসেস করুন")}</Button>
            <Button size="lg" className="border border-white/30 bg-white/10 text-white hover:bg-white/20" icon={<Plus size={16} />} onClick={() => go("/products?new=1")}>{t("Add product", "প্রোডাক্ট যোগ করুন")}</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={t("Today's orders", "আজকের অর্ডার")} value={d.tOrders.length} delta={delta(d.tOrders.length, d.yOrders.length)} sub="vs yesterday" icon={<ShoppingBag size={20} />} />
        <Stat label={t("Today's revenue", "আজকের বিক্রি")} value={money(d.tRev)} delta={delta(d.tRev, d.yRev)} sub="vs yesterday" icon={<DollarSign size={20} />} tone="green" />
        <Stat label={t("Pending orders", "পেন্ডিং অর্ডার")} value={d.pending.length} sub={d.stale.length ? `${d.stale.length} waiting 24h+` : "all fresh"} icon={<Timer size={20} />} tone="amber" goodUp={false} />
        <Stat label={t("30-day revenue", "৩০ দিনের বিক্রি")} value={moneyShort(d.r30)} delta={delta(d.r30, d.p30)} sub="vs previous 30d" icon={<TrendingUp size={20} />} tone="violet" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHead title={t("Needs your attention", "যা এখনই করা দরকার")} sub={t("Your to-do list, ordered by importance", "গুরুত্ব অনুযায়ী আপনার কাজের তালিকা")} right={<Badge tone={actions.length ? "amber" : "green"}>{actions.length ? `${actions.length} tasks` : "All clear"}</Badge>} />
          <div className="grid gap-2.5 p-5 pt-1 sm:grid-cols-2">
            {actions.length === 0 && <div className="col-span-2"><Empty title="You're all caught up 🎉" sub="No urgent tasks right now." /></div>}
            {actions.map((a) => (
              <button key={a.title} onClick={() => go(a.to)} className="group flex items-center gap-3 rounded-2xl border border-slate-200 p-3.5 text-left transition hover:border-indigo-300 hover:shadow-md">
                <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", tone[a.tone])}><a.icon size={20} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="text-xl font-bold text-slate-900">{a.n}</span><span className="truncate text-sm font-medium text-slate-700">{a.title}</span></div>
                  <div className="truncate text-xs text-slate-500">{a.sub}</div>
                </div>
                <ArrowRight size={16} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
              </button>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col border-0 bg-gradient-to-b from-slate-900 to-slate-800 text-white">
          <CardHead title={<span className="flex items-center gap-2 text-white"><Sparkles size={16} className="text-amber-300" /> {t("AI Store Manager", "এআই স্টোর ম্যানেজার")}</span>} sub={<span className="text-slate-400">{t("A plain-language report of your shop", "আপনার দোকানের সহজ ভাষায় রিপোর্ট")}</span>} />
          <div className="flex-1 px-5 pb-5">
            {!report && !busy && <p className="mb-4 text-sm text-slate-300">{t("Tap the button and get a smart summary: what sold, what’s stuck, and what to do next.", "বাটনে চাপ দিন — কী বিক্রি হলো, কী আটকে আছে এবং এরপর কী করবেন জানুন।")}</p>}
            {busy && <div className="mb-4 flex items-center gap-2 text-sm text-slate-300"><span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Analysing your data…</div>}
            {report && <ul className="mb-4 max-h-64 space-y-2 overflow-y-auto pr-1 text-[13px] leading-relaxed text-slate-200">{report.map((l, i) => <li key={i} className="rounded-xl bg-white/5 px-3 py-2">{l}</li>)}</ul>}
            <Button variant="primary" className="w-full bg-white text-slate-900 hover:bg-slate-100" icon={<Sparkles size={15} />} onClick={genReport} disabled={busy}>{report ? t("Refresh report", "রিপোর্ট রিফ্রেশ") : t("Get smart report", "স্মার্ট রিপোর্ট নিন")}</Button>
            <p className="mt-2 text-center text-[11px] text-slate-500">Demo uses rule-based analysis. Connect your Gemini key in Settings → Integrations.</p>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHead title={t("Revenue", "বিক্রির গ্রাফ")} sub={`${money(series.reduce((s, p) => s + p.y, 0))} in the last ${range} days`} right={<Chips options={[{ id: "7", label: "7D" }, { id: "14", label: "14D" }, { id: "30", label: "30D" }]} value={range} onChange={setRange} />} />
          <div className="px-5 pb-5"><LineChart points={series} fmt={money} height={230} /></div>
        </Card>
        <Card>
          <CardHead title={t("Best sellers this week", "এই সপ্তাহের সেরা")} sub="By units sold" />
          <div className="space-y-3 px-5 pb-5">
            {d.best.length === 0 && <Empty title="No sales yet" />}
            {d.best.map((b, i) => {
              const p = products.items.find((x) => x.id === b.id);
              return (
                <button key={b.id} onClick={() => go(`/products?id=${b.id}`)} className="flex w-full items-center gap-3 text-left">
                  <span className="w-4 text-xs font-bold text-slate-400">{i + 1}</span>
                  {p && <Thumb p={p} size={38} />}
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-800">{b.name}</span><span className="text-xs text-slate-500">{b.qty} sold</span></span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHead title={t("Order pipeline (30 days)", "অর্ডার পাইপলাইন")} sub="Click a status to open it" />
          <div className="space-y-2 px-5 pb-5">
            {statuses.map((s) => (
              <button key={s} onClick={() => go(`/orders?status=${s}`)} className="block w-full rounded-xl p-2 text-left hover:bg-slate-50">
                <div className="mb-1 flex justify-between text-sm"><span className="font-medium text-slate-700">{s}</span><span className="tabular-nums text-slate-500">{d.statusCount[s] || 0} <span className="text-slate-400">· {pct(((d.statusCount[s] || 0) / total30) * 100, 0)}</span></span></div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${((d.statusCount[s] || 0) / total30) * 100}%`, background: STATUS_HEX[s] }} /></div>
              </button>
            ))}
          </div>
        </Card>
        <Card className="xl:col-span-2">
          <CardHead title={t("Recent orders", "সাম্প্রতিক অর্ডার")} right={<Button size="sm" variant="ghost" onClick={() => go("/orders")}>View all <ArrowRight size={14} /></Button>} />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><Th>Order</Th><Th>Customer</Th><Th>Total</Th><Th>Payment</Th><Th>Status</Th><Th className="text-right">Action</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((o) => (
                  <tr key={o.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => go(`/orders?id=${o.id}`)}>
                    <Td><div className="font-semibold text-slate-900">{o.id}</div><div className="text-xs text-slate-400">{ago(o.date)}</div></Td>
                    <Td><div className="font-medium">{o.customerName}</div><div className="text-xs text-slate-400">{o.district}</div></Td>
                    <Td className="font-semibold">{money(o.grand)}</Td>
                    <Td><PayBadge s={o.payStatus} /></Td>
                    <Td><StatusBadge s={o.status} /></Td>
                    <Td className="text-right">{o.status === "Pending" && !o.failed ? <Button size="sm" variant="soft" icon={<CheckCircle2 size={14} />} onClick={(e) => { e.stopPropagation(); confirm(o.id); }}>Confirm</Button> : <span className="text-xs text-slate-300">—</span>}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title={t("Where are customers coming from?", "কাস্টমার কোথা থেকে আসছে?")} sub="Orders by traffic source, last 30 days" right={<Button size="sm" variant="soft" onClick={() => go("/insights")}>Open Insights <ArrowRight size={14} /></Button>} />
        <div className="grid gap-8 px-5 pb-5 md:grid-cols-2">
          <BarList fmt={num} rows={Object.entries(d.last30.reduce<Record<string, number>>((m, o) => ((m[o.source] = (m[o.source] || 0) + 1), m), {})).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)} />
          <div className="grid grid-cols-2 gap-3">
            {[["Average order", money(d.last30.reduce((s, o) => s + o.grand, 0) / (d.last30.length || 1))], ["Repeat buyers", pct((d.last30.filter((o) => o.isRepeat).length / (d.last30.length || 1)) * 100, 0)], ["COD share", pct((d.last30.filter((o) => o.method === "COD").length / (d.last30.length || 1)) * 100, 0)], ["Customers", num(customers.length)]].map(([a, b]) => (
              <div key={a} className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">{a}</div><div className="mt-1 text-xl font-bold text-slate-900">{b}</div></div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
