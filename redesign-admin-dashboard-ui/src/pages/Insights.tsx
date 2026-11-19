import { useMemo, useState } from "react";
import { BarChart3, Download, FlaskConical, LayoutDashboard, Lightbulb, Maximize2, Pin, PinOff, Save, Sparkles, Trash2 } from "lucide-react";
import { useStore } from "../store";
import { Badge, Button, Card, CardHead, Chips, Empty, Field, Modal, PageHeader, SearchBox, Select, Tabs, Th, Td, Tip } from "../components/ui";
import { BarList, Columns, Donut, LineChart } from "../components/charts";
import { ResultView, resultToCSV } from "../components/ResultView";
import { DIMS, FMT, GROUPS, INSIGHTS, METRICS, buildCtx, explore, insightMap, type Group, type Insight, type Result } from "../lib/insights";
import { downloadCSV, downloadJSON, pct } from "../lib/format";
import { cn } from "../utils/cn";

const GROUP_STYLE: Record<Group, string> = {
  Sales: "bg-emerald-50 text-emerald-700", Orders: "bg-sky-50 text-sky-700", Customers: "bg-pink-50 text-pink-700", Products: "bg-amber-50 text-amber-700",
  Payments: "bg-violet-50 text-violet-700", Location: "bg-teal-50 text-teal-700", Marketing: "bg-orange-50 text-orange-700", Reviews: "bg-yellow-50 text-yellow-700", Time: "bg-indigo-50 text-indigo-700",
};
type View = "board" | "all" | "lab";

export function Insights() {
  const s = useStore();
  const { orders, products, reviews, promos, banners, addons, zones, customers, brands, settings, pinned, togglePin, t, toast } = s;
  const [view, setView] = useState<View>("board");
  const [days, setDays] = useState<"7" | "30" | "90" | "180">("30");
  const [brand, setBrand] = useState("all");
  const [grp, setGrp] = useState<"All" | Group>("All");
  const [q, setQ] = useState("");
  const [zoom, setZoom] = useState<Insight | null>(null);

  const ctx = useMemo(
    () => buildCtx({ products: products.items, prodMap: new Map(products.items.map((p) => [p.id, p])), reviews: reviews.items, promos: promos.items, banners: banners.items, addons: addons.items, zones: zones.items, customers, lowLimit: settings.lowStockLimit, catName: s.catName, brandName: s.brandName }, orders.items, Number(days), brand),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders.items, products.items, reviews.items, promos.items, banners.items, addons.items, zones.items, customers, days, brand, settings.lowStockLimit]
  );
  const cache = useMemo(() => new Map<string, Result>(), [ctx]);
  const getR = (i: Insight): Result => {
    let r = cache.get(i.id);
    if (!r) { r = i.run(ctx); cache.set(i.id, r); }
    return r;
  };

  const filtered = INSIGHTS.filter((i) => (grp === "All" || i.group === grp) && (!q || (i.title + i.why + i.group).toLowerCase().includes(q.toLowerCase())));
  const pinnedList = pinned.map((id) => insightMap.get(id)).filter(Boolean) as Insight[];

  const highlights = useMemo(() => {
    const out: { icon: string; text: string }[] = [];
    const g = (id: string) => getR(insightMap.get(id)!);
    const rv = g("rev_total"); if (rv.type === "kpi") out.push({ icon: rv.delta! >= 0 ? "📈" : "📉", text: `Revenue is ${rv.value} — ${rv.delta! >= 0 ? "up" : "down"} ${Math.abs(rv.delta!).toFixed(1)}% vs the previous ${days} days.` });
    const tp = g("top_units"); if (tp.type === "bars" && tp.rows[0]) out.push({ icon: "🏆", text: `${tp.rows[0].label} is your best seller (${tp.rows[0].value} units).` });
    const pk = g("peak"); if (pk.type === "kpi") out.push({ icon: "⏰", text: `Orders peak around ${pk.value} — ${pk.sub}. Post just before this time.` });
    const sr = g("src_rev"); if (sr.type === "bars" && sr.rows[0]) out.push({ icon: "📣", text: `${sr.rows[0].label} brings the most revenue. Keep investing there.` });
    const cr = g("cancel_rate"); if (cr.type === "kpi") out.push({ icon: parseFloat(cr.value) > 12 ? "⚠️" : "✅", text: `Cancellation rate is ${cr.value}. ${parseFloat(cr.value) > 12 ? "Above healthy 10% — verify orders by phone." : "That’s healthy."}` });
    const rp = g("repeat_rate"); if (rp.type === "kpi") out.push({ icon: "🔁", text: `${rp.value} of orders come from returning customers.` });
    const pm = g("pay_share"); if (pm.type === "donut" && pm.rows[0]) { const tot = pm.rows.reduce((a, b) => a + b.value, 0); out.push({ icon: "💳", text: `${pm.rows[0].label} is the top payment method (${pct((pm.rows[0].value / tot) * 100, 0)}).` }); }
    const ls = g("low_stock"); if (ls.type === "table" && ls.rows.length) out.push({ icon: "📦", text: `${ls.rows.length}+ variants are low on stock — check the Products page.` });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cache, days]);

  const exportAll = () => {
    const snap: Record<string, unknown> = {};
    INSIGHTS.forEach((i) => (snap[`${i.group} / ${i.title}`] = getR(i)));
    downloadJSON(`insights-${days}d.json`, snap);
    toast(`Exported ${INSIGHTS.length} insights`);
  };

  return (
    <div>
      <PageHeader icon={<BarChart3 size={22} />} title={t("Insights", "ইনসাইটস")} desc={t(`${INSIGHTS.length} ready-made insights in ${GROUPS.length} groups + a research lab with ${METRICS.length * DIMS.length}+ combinations`, `${INSIGHTS.length}টি রেডিমেড ইনসাইট ও রিসার্চ ল্যাব`)}
        actions={<Button icon={<Download size={15} />} onClick={exportAll}>Export all (JSON)</Button>} />

      <div className="sticky top-16 z-10 -mx-4 mb-5 border-b border-slate-200/70 bg-slate-50/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs<View> value={view} onChange={setView} tabs={[{ id: "board", label: <span className="flex items-center gap-1.5"><LayoutDashboard size={14} /> My board</span> }, { id: "all", label: <span className="flex items-center gap-1.5"><BarChart3 size={14} /> All insights</span>, count: INSIGHTS.length }, { id: "lab", label: <span className="flex items-center gap-1.5"><FlaskConical size={14} /> Research lab</span> }]} />
          <div className="flex flex-wrap items-center gap-3">
            <Chips options={[{ id: "7", label: "7 days" }, { id: "30", label: "30 days" }, { id: "90", label: "90 days" }, { id: "180", label: "180 days" }]} value={days} onChange={setDays} />
            <Select value={brand} onChange={(e) => setBrand(e.target.value)} className="!w-auto"><option value="all">All brands</option>{brands.items.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
          </div>
        </div>
      </div>

      {view === "board" && (
        <div className="space-y-6">
          <Card className="border-0 bg-gradient-to-br from-indigo-50 via-white to-violet-50 ring-1 ring-indigo-100">
            <CardHead title={<span className="flex items-center gap-2"><Sparkles size={16} className="text-indigo-600" /> Key findings for the last {days} days</span>} sub="Written automatically from your data" />
            <div className="grid gap-2.5 px-5 pb-5 md:grid-cols-2">
              {highlights.map((h, i) => <div key={i} className="flex items-start gap-3 rounded-xl bg-white/80 p-3 text-sm text-slate-700 ring-1 ring-slate-100"><span className="text-lg leading-none">{h.icon}</span>{h.text}</div>)}
            </div>
          </Card>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900"><Pin size={16} /> Pinned insights <Badge>{pinnedList.length}</Badge></h2>
            <span className="text-xs text-slate-500">Pin any card from “All insights” to build your own board</span>
          </div>
          {pinnedList.length === 0 ? <Card><Empty title="Your board is empty" sub="Open “All insights” and tap the pin icon on the cards you check every day." action={<Button variant="primary" onClick={() => setView("all")}>Browse insights</Button>} /></Card> : (
            <Grid>{pinnedList.map((i) => <InsightCard key={i.id} i={i} r={getR(i)} pinned onPin={() => togglePin(i.id)} onZoom={() => setZoom(i)} />)}</Grid>
          )}
        </div>
      )}

      {view === "all" && (
        <div>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
            <SearchBox value={q} onChange={setQ} placeholder={`Search ${INSIGHTS.length} insights… (try “delivery”, “coupon”, “stock”)`} className="md:w-96" />
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setGrp("All")} className={cn("rounded-full border px-3 py-1 text-xs font-medium", grp === "All" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600")}>All · {INSIGHTS.length}</button>
              {GROUPS.map((g) => <button key={g} onClick={() => setGrp(g)} className={cn("rounded-full border px-3 py-1 text-xs font-medium", grp === g ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}>{g} · {INSIGHTS.filter((i) => i.group === g).length}</button>)}
            </div>
          </div>
          {filtered.length === 0 ? <Card><Empty title="No insight matches" sub="Try a different word." /></Card> : (
            <Grid>{filtered.map((i) => <InsightCard key={i.id} i={i} r={getR(i)} pinned={pinned.includes(i.id)} onPin={() => togglePin(i.id)} onZoom={() => setZoom(i)} />)}</Grid>
          )}
        </div>
      )}

      {view === "lab" && <ResearchLab ctx={ctx} days={days} />}

      <Modal open={!!zoom} onClose={() => setZoom(null)} wide title={zoom?.title} sub={zoom && <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", GROUP_STYLE[zoom.group])}>{zoom.group}</span>}
        footer={zoom && <>{resultToCSV(getR(zoom)) && <Button icon={<Download size={14} />} onClick={() => { const c = resultToCSV(getR(zoom))!; downloadCSV(`${zoom.id}.csv`, c.header, c.rows); }}>CSV</Button>}<Button variant="primary" onClick={() => setZoom(null)}>Close</Button></>}>
        {zoom && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><Lightbulb size={18} className="mt-0.5 shrink-0" /><div><div className="font-semibold">Why this matters</div>{zoom.why}</div></div>
            <ResultView r={getR(zoom)} big />
          </div>
        )}
      </Modal>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

function InsightCard({ i, r, pinned, onPin, onZoom }: { i: Insight; r: Result; pinned: boolean; onPin: () => void; onZoom: () => void }) {
  const kpi = r.type === "kpi";
  const span = kpi ? "" : i.wide || r.type === "heat" ? "sm:col-span-2 xl:col-span-4" : "sm:col-span-2";
  const csv = resultToCSV(r);
  return (
    <Card className={cn("group flex flex-col transition hover:shadow-md", span)}>
      <div className="flex items-start justify-between gap-2 px-4 pt-3.5">
        <div className="min-w-0">
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", GROUP_STYLE[i.group])}>{i.group}</span>
          <h3 className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-900">{i.title}<Tip text={i.why} /></h3>
        </div>
        <div className="flex shrink-0 gap-0.5 opacity-60 transition group-hover:opacity-100">
          {csv && <button title="Download CSV" onClick={() => downloadCSV(`${i.id}.csv`, csv.header, csv.rows)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Download size={14} /></button>}
          <button title="Expand" onClick={onZoom} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Maximize2 size={14} /></button>
          <button title={pinned ? "Unpin" : "Pin to my board"} onClick={onPin} className={cn("rounded-lg p-1.5 hover:bg-slate-100", pinned ? "text-indigo-600" : "text-slate-500")}>{pinned ? <PinOff size={14} /> : <Pin size={14} />}</button>
        </div>
      </div>
      <div className="flex-1 px-4 pb-4 pt-3"><ResultView r={r} /></div>
    </Card>
  );
}

// ------------------------ Research lab ------------------------
type ChartKind = "bars" | "cols" | "line" | "donut" | "table";
const PRESETS: { label: string; m: string; d: string; c: ChartKind }[] = [
  { label: "Revenue by day", m: "revenue", d: "day", c: "line" },
  { label: "Orders by hour", m: "orders", d: "hour", c: "cols" },
  { label: "Profit by product", m: "profit", d: "product", c: "bars" },
  { label: "Cancel rate by district", m: "cancel", d: "district", c: "bars" },
  { label: "Order value by source", m: "aov", d: "source", c: "bars" },
  { label: "Units by colour", m: "units", d: "color", c: "bars" },
  { label: "Customers by division", m: "customers", d: "division", c: "donut" },
  { label: "Discounts by coupon", m: "discount", d: "promo", c: "table" },
];
interface Saved { id: string; name: string; m: string; d: string; c: ChartKind; top: number }

function ResearchLab({ ctx, days }: { ctx: ReturnType<typeof buildCtx>; days: string }) {
  const { toast } = useStore();
  const [m, setM] = useState("revenue");
  const [d, setD] = useState("category");
  const [c, setC] = useState<ChartKind>("bars");
  const [top, setTop] = useState(10);
  const [mode, setMode] = useState<"valid" | "all">("valid");
  const [saved, setSaved] = useState<Saved[]>(() => { try { return JSON.parse(localStorage.getItem("lab_saved") || "[]"); } catch { return []; } });
  const metric = METRICS.find((x) => x.id === m)!;
  const dim = DIMS.find((x) => x.id === d)!;
  const res = useMemo(() => explore(ctx, m, d, mode, top), [ctx, m, d, mode, top]);
  const fmt = FMT[metric.fmt];
  const total = res.rows.reduce((a, b) => a + b.value, 0);
  const persist = (l: Saved[]) => { setSaved(l); localStorage.setItem("lab_saved", JSON.stringify(l)); };
  const apply = (x: { m: string; d: string; c: ChartKind; top?: number }) => { setM(x.m); setD(x.d); setC(x.c); if (x.top) setTop(x.top); };
  const kinds: { id: ChartKind; label: string }[] = [{ id: "bars", label: "Bars" }, { id: "cols", label: "Columns" }, { id: "line", label: "Line" }, { id: "donut", label: "Donut" }, { id: "table", label: "Table" }];

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2 font-semibold text-slate-900"><FlaskConical size={18} className="text-indigo-600" /> Build your own question</div>
          <div className="space-y-4">
            <Field label="1. What do you want to measure?"><Select value={m} onChange={(e) => setM(e.target.value)}>{METRICS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select></Field>
            <Field label="2. Split it by…" hint={`${DIMS.length} ways to slice your data`}>
              <Select value={d} onChange={(e) => setD(e.target.value)}>
                <optgroup label="Time">{DIMS.filter((x) => x.time).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</optgroup>
                <optgroup label="Products">{DIMS.filter((x) => x.item).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</optgroup>
                <optgroup label="Customers & orders">{DIMS.filter((x) => !x.time && !x.item).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</optgroup>
              </Select>
            </Field>
            <Field label="3. Show as"><Chips options={kinds} value={c} onChange={setC} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Show top"><Select value={top} onChange={(e) => setTop(Number(e.target.value))}>{[5, 10, 15, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>
              <Field label="Orders"><Select value={mode} onChange={(e) => setMode(e.target.value as "valid" | "all")}><option value="valid">Valid only</option><option value="all">Include cancelled</option></Select></Field>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="mb-3 text-sm font-semibold text-slate-900">Quick questions</div>
          <div className="flex flex-wrap gap-1.5">{PRESETS.map((p) => <button key={p.label} onClick={() => apply(p)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-700">{p.label}</button>)}</div>
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-900">My saved views <Badge>{saved.length}</Badge></div>
          {saved.length === 0 && <p className="text-xs text-slate-500">Build a chart, then press “Save view” to keep it here.</p>}
          <div className="space-y-1.5">
            {saved.map((s) => (
              <div key={s.id} className="flex items-center gap-1 rounded-xl bg-slate-50 pr-1">
                <button onClick={() => apply(s)} className="flex-1 truncate px-3 py-2 text-left text-sm font-medium text-slate-700 hover:text-indigo-700">{s.name}</button>
                <button onClick={() => persist(saved.filter((x) => x.id !== s.id))} className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title={`${metric.label} by ${dim.label.toLowerCase()}`} sub={`Last ${days} days · ${res.groups} groups found · ${mode === "all" ? "including cancelled orders" : "valid orders only"}`}
          right={<>
            <Button size="sm" icon={<Save size={14} />} onClick={() => { persist([{ id: String(Date.now()), name: `${metric.label} by ${dim.label}`, m, d, c, top }, ...saved]); toast("View saved"); }}>Save view</Button>
            <Button size="sm" icon={<Download size={14} />} onClick={() => downloadCSV(`lab-${m}-by-${d}.csv`, [dim.label, metric.label], res.rows.map((r) => [r.label, r.value]))}>CSV</Button>
          </>} />
        <div className="px-5 pb-5">
          <div className="mb-5 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-indigo-50 p-4"><div className="text-xs text-indigo-600">Total</div><div className="text-xl font-bold text-slate-900">{fmt(res.total)}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">Top group</div><div className="truncate text-xl font-bold text-slate-900">{res.rows.length ? [...res.rows].sort((a, b) => b.value - a.value)[0].label : "—"}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">Groups</div><div className="text-xl font-bold text-slate-900">{res.groups}</div></div>
          </div>
          {res.rows.length === 0 ? <Empty title="No data for this combination" sub="Try a longer time range or include cancelled orders." /> : (
            <>
              {c === "bars" && <BarList rows={res.rows} fmt={fmt} limit={top} />}
              {c === "cols" && <Columns rows={res.rows.map((r) => (dim.time && res.rows.length > 14 ? { ...r, label: "" } : r))} fmt={fmt} height={280} highlight />}
              {c === "line" && <LineChart points={res.rows.map((r) => ({ x: r.label, y: r.value }))} fmt={fmt} height={300} />}
              {c === "donut" && <Donut rows={res.rows.filter((r) => r.value > 0)} fmt={fmt} size={190} />}
              {c === "table" && (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full"><thead><tr><Th>{dim.label}</Th><Th className="text-right">{metric.label}</Th><Th className="text-right">Share</Th></tr></thead>
                    <tbody className="divide-y divide-slate-100">{res.rows.map((r) => <tr key={r.label}><Td className="font-medium">{r.label}</Td><Td className="text-right tabular-nums">{fmt(r.value)}</Td><Td className="text-right tabular-nums text-slate-500">{total ? pct((r.value / total) * 100) : "—"}</Td></tr>)}</tbody></table>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
