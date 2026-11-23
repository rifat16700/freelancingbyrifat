import { useMemo, useState } from "react";
import {
  AlertCircle, AlertTriangle, ArrowUpRight, Award, BarChart3, Clock,
  CreditCard, DollarSign, Download, FlaskConical,
  LayoutDashboard, Lightbulb, Maximize2,
  Package, Pin, PinOff, Repeat, Save, ShoppingBag, ShoppingCart, Sparkles,
  Trash2, TrendingDown, TrendingUp, Zap
} from "lucide-react";
import { useStore } from "../store";
import { Badge, Button, Card, CardHead, Chips, Empty, Field, Modal, PageHeader, SearchBox, Select, Tabs, Th, Td, Tip } from "../components/ui";
import { BarList, Columns, Donut, LineChart, Sparkline } from "../components/charts";
import { ResultView, resultToCSV } from "../components/ResultView";
import { DIMS, FMT, GROUPS, INSIGHTS, METRICS, buildCtx, explore, insightMap, type Group, type Insight, type Result } from "../lib/insights";
import { downloadCSV, downloadJSON, pct } from "../lib/format";
import { cn } from "../utils/cn";

const GROUP_STYLE: Record<Group, string> = {
  Sales: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/40",
  Orders: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/50 dark:border-sky-800/40",
  Customers: "bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200/50 dark:border-violet-800/40",
  Products: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/40",
  Payments: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/40",
  Location: "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200/50 dark:border-teal-800/40",
  Marketing: "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200/50 dark:border-orange-800/40",
  Reviews: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/60 dark:text-yellow-300 border border-yellow-200/50 dark:border-yellow-800/40",
  Time: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/40",
};

type View = "board" | "all" | "lab";
type ResultFilter = "all" | "kpi" | "chart" | "table";

export function Insights() {
  const s = useStore();
  const { orders, products, reviews, promos, banners, addons, zones, customers, brands, settings, pinned, togglePin, t, toast } = s;
  const [view, setView] = useState<View>("board");
  const [days, setDays] = useState<"7" | "30" | "90" | "180">("30");
  const [brand, setBrand] = useState("all");
  const [grp, setGrp] = useState<"All" | Group>("All");
  const [resType, setResType] = useState<ResultFilter>("all");
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

  // Executive Top Metrics
  const execMetrics = useMemo(() => {
    const rev = insightMap.get("rev_total") ? getR(insightMap.get("rev_total")!) : null;
    const ord = insightMap.get("ord_total") ? getR(insightMap.get("ord_total")!) : null;
    const aov = insightMap.get("aov") ? getR(insightMap.get("aov")!) : null;
    const del = insightMap.get("cancel_rate") ? getR(insightMap.get("cancel_rate")!) : null;
    return { rev, ord, aov, del };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cache, days, brand]);

  const filtered = INSIGHTS.filter((i) => {
    if (grp !== "All" && i.group !== grp) return false;
    if (q) {
      const match = (i.title + i.why + i.group).toLowerCase().includes(q.toLowerCase());
      if (!match) return false;
    }
    if (resType !== "all") {
      const r = getR(i);
      if (resType === "kpi" && r.type !== "kpi") return false;
      if (resType === "chart" && !["line", "cols", "bars", "donut", "heat", "funnel"].includes(r.type)) return false;
      if (resType === "table" && r.type !== "table") return false;
    }
    return true;
  });

  const pinnedList = pinned.map((id) => insightMap.get(id)).filter(Boolean) as Insight[];

  // Smart Actionable Findings (SaaS Quality)
  const smartFindings = useMemo(() => {
    const out: {
      id: string;
      title: string;
      text: string;
      icon: any;
      kind: "opp" | "alert" | "milestone";
      metricStr?: string;
    }[] = [];

    const g = (id: string) => {
      const item = insightMap.get(id);
      return item ? getR(item) : null;
    };

    const rv = g("rev_total");
    if (rv && rv.type === "kpi") {
      out.push({
        id: "rev_total",
        title: "Revenue Growth Pace",
        text: `Net revenue is ${rv.value} (${rv.delta! >= 0 ? "▲ up" : "▼ down"} ${Math.abs(rv.delta!).toFixed(1)}% vs previous ${days} days).`,
        icon: rv.delta! >= 0 ? TrendingUp : TrendingDown,
        kind: rv.delta! >= 0 ? "milestone" : "alert",
        metricStr: rv.value,
      });
    }

    const tp = g("top_units");
    if (tp && tp.type === "bars" && tp.rows[0]) {
      out.push({
        id: "top_units",
        title: "Star Product Opportunity",
        text: `"${tp.rows[0].label}" is your top volume driver (${tp.rows[0].value} units). Feature it on social ads.`,
        icon: Award,
        kind: "opp",
        metricStr: `${tp.rows[0].value} units`,
      });
    }

    const pk = g("peak");
    if (pk && pk.type === "kpi") {
      out.push({
        id: "peak",
        title: "Peak Purchase Window",
        text: `Customer orders peak at ${pk.value} (${pk.sub}). Schedule flash promos right before this time.`,
        icon: Clock,
        kind: "opp",
        metricStr: pk.value,
      });
    }

    const cr = g("cancel_rate");
    if (cr && cr.type === "kpi") {
      const numVal = parseFloat(cr.value);
      out.push({
        id: "cancel_rate",
        title: numVal > 10 ? "Order Cancellation Alert" : "Delivery Health Good",
        text: `Cancellation rate stands at ${cr.value}. ${numVal > 10 ? "Above healthy 10% — verify phone OTP before shipping." : "Healthy courier delivery pace."}`,
        icon: numVal > 10 ? AlertTriangle : AlertCircle,
        kind: numVal > 10 ? "alert" : "milestone",
        metricStr: cr.value,
      });
    }

    const rp = g("repeat_rate");
    if (rp && rp.type === "kpi") {
      out.push({
        id: "repeat_rate",
        title: "Customer Retention",
        text: `${rp.value} of orders are from loyal returning shoppers. Boost with VIP SMS promos.`,
        icon: Repeat,
        kind: "opp",
        metricStr: rp.value,
      });
    }

    const pm = g("pay_share");
    if (pm && pm.type === "donut" && pm.rows[0]) {
      const tot = pm.rows.reduce((a, b) => a + b.value, 0);
      out.push({
        id: "pay_share",
        title: "Primary Payment Method",
        text: `${pm.rows[0].label} dominates at ${pct((pm.rows[0].value / tot) * 100, 0)} of all checkouts.`,
        icon: CreditCard,
        kind: "milestone",
        metricStr: `${pct((pm.rows[0].value / tot) * 100, 0)} share`,
      });
    }

    const ls = g("low_stock");
    if (ls && ls.type === "table" && ls.rows.length) {
      out.push({
        id: "low_stock",
        title: "Low Inventory Warning",
        text: `${ls.rows.length}+ variants have reached the safety threshold. Restock before promotions.`,
        icon: Package,
        kind: "alert",
        metricStr: `${ls.rows.length} items`,
      });
    }

    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cache, days]);

  const exportAll = () => {
    const snap: Record<string, unknown> = {};
    INSIGHTS.forEach((i) => (snap[`${i.group} / ${i.title}`] = getR(i)));
    downloadJSON(`insights-${days}d.json`, snap);
    toast(`Exported ${INSIGHTS.length} insights (JSON)`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<BarChart3 size={22} />}
        title={t("Analytics & Insights", "ইনসাইটস ও অ্যানালিটিক্স")}
        desc={t(`${INSIGHTS.length} real-time business metrics across ${GROUPS.length} dimensions + interactive research lab.`, `${INSIGHTS.length}টি রেডিমেড ইনসাইট ও ইন্টারেক্টিভ রিসার্চ ল্যাব`)}
        actions={
          <Button icon={<Download size={15} />} onClick={exportAll}>
            Export All (JSON)
          </Button>
        }
      />

      {/* ── Sticky Control Strip ── */}
      <div className="sticky top-16 z-20 -mx-4 border-b border-slate-200/80 bg-slate-50/95 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6 shadow-xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs<View>
            value={view}
            onChange={setView}
            tabs={[
              { id: "board", label: <span className="flex items-center gap-1.5"><LayoutDashboard size={14} /> Executive Board</span> },
              { id: "all", label: <span className="flex items-center gap-1.5"><BarChart3 size={14} /> All Metrics</span>, count: INSIGHTS.length },
              { id: "lab", label: <span className="flex items-center gap-1.5"><FlaskConical size={14} /> Research Lab</span> },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2.5">
            <Chips
              options={[
                { id: "7", label: "7 days" },
                { id: "30", label: "30 days" },
                { id: "90", label: "90 days" },
                { id: "180", label: "180 days" },
              ]}
              value={days}
              onChange={setDays}
            />
            <Select value={brand} onChange={(e) => setBrand(e.target.value)} className="!w-auto text-xs font-semibold">
              <option value="all">All Brands</option>
              {brands.items.map((b) => (
                <option key={b.id} value={b.id}>{b.emoji} {b.name}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* ── VIEW 1: EXECUTIVE BOARD ── */}
      {view === "board" && (
        <div className="space-y-6">
          {/* Executive Command Strip: Top 4 KPI Metrics */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* 1. Net Revenue */}
            <div
              onClick={() => setZoom(insightMap.get("rev_total") || null)}
              className="group cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition hover:shadow-md hover:border-indigo-400"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Net Revenue ({days}d)</span>
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                  <DollarSign size={15} />
                </span>
              </div>
              <div className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                {execMetrics.rev?.type === "kpi" ? execMetrics.rev.value : "—"}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                {execMetrics.rev?.type === "kpi" && execMetrics.rev.delta !== undefined && (
                  <Badge tone={execMetrics.rev.delta >= 0 ? "green" : "red"}>
                    {execMetrics.rev.delta >= 0 ? "▲ +" : "▼ "}{Math.abs(execMetrics.rev.delta).toFixed(1)}%
                  </Badge>
                )}
                <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 opacity-80 group-hover:opacity-100">
                  Inspect <ArrowUpRight size={12} />
                </span>
              </div>
              {execMetrics.rev?.type === "kpi" && execMetrics.rev.spark && (
                <div className="mt-2 pt-1 border-t border-slate-100">
                  <Sparkline data={execMetrics.rev.spark} color="#10b981" h={24} />
                </div>
              )}
            </div>

            {/* 2. Total Orders */}
            <div
              onClick={() => setZoom(insightMap.get("ord_total") || null)}
              className="group cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition hover:shadow-md hover:border-indigo-400"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Total Orders ({days}d)</span>
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-sky-50 text-sky-700">
                  <ShoppingCart size={15} />
                </span>
              </div>
              <div className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                {execMetrics.ord?.type === "kpi" ? execMetrics.ord.value : "—"}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                {execMetrics.ord?.type === "kpi" && execMetrics.ord.delta !== undefined && (
                  <Badge tone={execMetrics.ord.delta >= 0 ? "green" : "red"}>
                    {execMetrics.ord.delta >= 0 ? "▲ +" : "▼ "}{Math.abs(execMetrics.ord.delta).toFixed(1)}%
                  </Badge>
                )}
                <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 opacity-80 group-hover:opacity-100">
                  Inspect <ArrowUpRight size={12} />
                </span>
              </div>
              {execMetrics.ord?.type === "kpi" && execMetrics.ord.spark && (
                <div className="mt-2 pt-1 border-t border-slate-100">
                  <Sparkline data={execMetrics.ord.spark} color="#0ea5e9" h={24} />
                </div>
              )}
            </div>

            {/* 3. Average Order Value (AOV) */}
            <div
              onClick={() => setZoom(insightMap.get("aov") || null)}
              className="group cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition hover:shadow-md hover:border-indigo-400"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Average Order Value</span>
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-50 text-violet-700">
                  <ShoppingBag size={15} />
                </span>
              </div>
              <div className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                {execMetrics.aov?.type === "kpi" ? execMetrics.aov.value : "—"}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                {execMetrics.aov?.type === "kpi" && execMetrics.aov.delta !== undefined && (
                  <Badge tone={execMetrics.aov.delta >= 0 ? "green" : "red"}>
                    {execMetrics.aov.delta >= 0 ? "▲ +" : "▼ "}{Math.abs(execMetrics.aov.delta).toFixed(1)}%
                  </Badge>
                )}
                <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 opacity-80 group-hover:opacity-100">
                  Inspect <ArrowUpRight size={12} />
                </span>
              </div>
              {execMetrics.aov?.type === "kpi" && execMetrics.aov.spark && (
                <div className="mt-2 pt-1 border-t border-slate-100">
                  <Sparkline data={execMetrics.aov.spark} color="#8b5cf6" h={24} />
                </div>
              )}
            </div>

            {/* 4. Cancellation / Delivery Health */}
            <div
              onClick={() => setZoom(insightMap.get("cancel_rate") || null)}
              className="group cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition hover:shadow-md hover:border-indigo-400"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Cancellation Rate</span>
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-50 text-amber-700">
                  <Zap size={15} />
                </span>
              </div>
              <div className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                {execMetrics.del?.type === "kpi" ? execMetrics.del.value : "—"}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                {(() => {
                  const delRate = execMetrics.del?.type === "kpi" ? parseFloat(execMetrics.del.value) : 0;
                  return (
                    <Badge tone={delRate <= 10 ? "green" : "red"}>
                      {delRate <= 10 ? "Healthy" : "Attention"}
                    </Badge>
                  );
                })()}
                <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 opacity-80 group-hover:opacity-100">
                  Inspect <ArrowUpRight size={12} />
                </span>
              </div>
              {execMetrics.del?.type === "kpi" && execMetrics.del.spark && (
                <div className="mt-2 pt-1 border-t border-slate-100">
                  <Sparkline data={execMetrics.del.spark} color="#f59e0b" h={24} />
                </div>
              )}
            </div>
          </div>

          {/* Smart Actionable Findings */}
          <Card className="p-5 border-slate-200/80">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={17} className="text-amber-500" />
                <h3 className="font-bold text-slate-900 text-sm">Actionable Findings &amp; Opportunities</h3>
              </div>
              <span className="text-xs text-slate-400">Derived from your store's last {days} days of transactions</span>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {smartFindings.map((f, idx) => {
                const IconComponent = f.icon;
                return (
                  <div
                    key={idx}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200/70 bg-slate-50/50 p-4 transition hover:bg-white hover:shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            f.kind === "opp" && "bg-emerald-50 text-emerald-800 border border-emerald-200/60",
                            f.kind === "alert" && "bg-rose-50 text-rose-800 border border-rose-200/60",
                            f.kind === "milestone" && "bg-indigo-50 text-indigo-800 border border-indigo-200/60"
                          )}
                        >
                          <IconComponent size={12} />
                          {f.kind === "opp" ? "Opportunity" : f.kind === "alert" ? "Attention" : "Insight"}
                        </span>
                        {f.metricStr && (
                          <span className="font-mono text-xs font-bold text-slate-700">{f.metricStr}</span>
                        )}
                      </div>
                      <div className="font-bold text-slate-900 text-xs mb-1">{f.title}</div>
                      <p className="text-xs text-slate-600 leading-relaxed">{f.text}</p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          const item = insightMap.get(f.id);
                          if (item) setZoom(item);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition"
                      >
                        Inspect Metric <ArrowUpRight size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Pinned Insights Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Pin size={16} className="text-indigo-600" />
                <span>My Pinned Board</span>
                <Badge tone="gray">{pinnedList.length}</Badge>
              </h2>
              <span className="text-xs text-slate-400">
                Tap the pin icon on any card in “All Metrics” to customize your board
              </span>
            </div>

            {pinnedList.length === 0 ? (
              <Card className="p-8 text-center">
                <Empty
                  title="Your dashboard board is empty"
                  sub="Switch to “All Metrics” tab and pin the numbers you check every day to view them here."
                  action={<Button variant="primary" onClick={() => setView("all")}>Browse Metrics</Button>}
                />
              </Card>
            ) : (
              <Grid>
                {pinnedList.map((i) => (
                  <InsightCard
                    key={i.id}
                    i={i}
                    r={getR(i)}
                    pinned
                    onPin={() => togglePin(i.id)}
                    onZoom={() => setZoom(i)}
                  />
                ))}
              </Grid>
            )}
          </div>
        </div>
      )}

      {/* ── VIEW 2: ALL INSIGHTS CATALOG ── */}
      {view === "all" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <SearchBox
                value={q}
                onChange={setQ}
                placeholder={`Search ${INSIGHTS.length} analytics cards… (e.g. “delivery”, “bKash”, “profit”, “cancellation”)`}
                className="md:w-96"
              />
              {/* Type Format Filters */}
              <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setResType("all")}
                  className={cn("rounded-lg px-2.5 py-1 transition", resType === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900")}
                >
                  All Types ({INSIGHTS.length})
                </button>
                <button
                  type="button"
                  onClick={() => setResType("kpi")}
                  className={cn("rounded-lg px-2.5 py-1 transition", resType === "kpi" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900")}
                >
                  KPIs
                </button>
                <button
                  type="button"
                  onClick={() => setResType("chart")}
                  className={cn("rounded-lg px-2.5 py-1 transition", resType === "chart" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900")}
                >
                  Charts &amp; Trends
                </button>
                <button
                  type="button"
                  onClick={() => setResType("table")}
                  className={cn("rounded-lg px-2.5 py-1 transition", resType === "table" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900")}
                >
                  Tables &amp; Ranks
                </button>
              </div>
            </div>

            {/* Dimension Groups Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                onClick={() => setGrp("All")}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  grp === "All" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                )}
              >
                All Groups
              </button>
              {GROUPS.map((g) => (
                <button
                  key={g}
                  onClick={() => setGrp(g)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition",
                    grp === g ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  )}
                >
                  {g} · {INSIGHTS.filter((i) => i.group === g).length}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <Card className="p-8 text-center">
              <Empty title="No metrics match your filters" sub="Try a different keyword or reset filters to All." />
            </Card>
          ) : (
            <Grid>
              {filtered.map((i) => (
                <InsightCard
                  key={i.id}
                  i={i}
                  r={getR(i)}
                  pinned={pinned.includes(i.id)}
                  onPin={() => togglePin(i.id)}
                  onZoom={() => setZoom(i)}
                />
              ))}
            </Grid>
          )}
        </div>
      )}

      {/* ── VIEW 3: RESEARCH LAB ── */}
      {view === "lab" && <ResearchLab ctx={ctx} days={days} onPinToBoard={(id) => togglePin(id)} isPinned={(id) => pinned.includes(id)} />}

      {/* Zoom / Full Inspection Modal */}
      <Modal
        open={!!zoom}
        onClose={() => setZoom(null)}
        wide
        title={zoom?.title}
        sub={
          zoom && (
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", GROUP_STYLE[zoom.group])}>
              {zoom.group}
            </span>
          )
        }
        footer={
          zoom && (
            <>
              {resultToCSV(getR(zoom)) && (
                <Button
                  icon={<Download size={14} />}
                  onClick={() => {
                    const c = resultToCSV(getR(zoom))!;
                    downloadCSV(`${zoom.id}.csv`, c.header, c.rows);
                  }}
                >
                  Download CSV
                </Button>
              )}
              <Button variant="primary" onClick={() => setZoom(null)}>
                Done
              </Button>
            </>
          )
        }
      >
        {zoom && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-2xl bg-amber-50/80 border border-amber-200/70 p-4 text-xs text-amber-900 leading-relaxed">
              <Lightbulb size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <div className="font-bold mb-0.5">Why this metric matters:</div>
                {zoom.why}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <ResultView r={getR(zoom)} big />
            </div>
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
    <Card className={cn("group flex flex-col transition hover:shadow-md border-slate-200/80", span)}>
      <div className="flex items-start justify-between gap-2 px-4 pt-3.5">
        <div className="min-w-0">
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", GROUP_STYLE[i.group])}>
            {i.group}
          </span>
          <h3 className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-900">
            {i.title}
            <Tip text={i.why} />
          </h3>
        </div>
        <div className="flex shrink-0 gap-0.5 opacity-60 transition group-hover:opacity-100">
          {csv && (
            <button
              title="Download CSV"
              onClick={() => downloadCSV(`${i.id}.csv`, csv.header, csv.rows)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <Download size={13} />
            </button>
          )}
          <button
            title="Expand / Full View"
            onClick={onZoom}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <Maximize2 size={13} />
          </button>
          <button
            title={pinned ? "Unpin from board" : "Pin to executive board"}
            onClick={onPin}
            className={cn("rounded-lg p-1.5 transition hover:bg-slate-100", pinned ? "text-indigo-600 font-bold" : "text-slate-400 hover:text-slate-700")}
          >
            {pinned ? <PinOff size={13} /> : <Pin size={13} />}
          </button>
        </div>
      </div>
      <div className="flex-1 px-4 pb-4 pt-3">
        <ResultView r={r} />
      </div>
    </Card>
  );
}

// ------------------------ Enhanced Research Lab ------------------------
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

function ResearchLab({
  ctx,
  days,
  onPinToBoard: _onPinToBoard,
  isPinned: _isPinned
}: {
  ctx: ReturnType<typeof buildCtx>;
  days: string;
  onPinToBoard?: (id: string) => void;
  isPinned?: (id: string) => boolean;
}) {
  const { toast } = useStore();
  const [m, setM] = useState("revenue");
  const [d, setD] = useState("category");
  const [c, setC] = useState<ChartKind>("bars");
  const [top, setTop] = useState(10);
  const [mode, setMode] = useState<"valid" | "all">("valid");
  const [saved, setSaved] = useState<Saved[]>(() => { try { return JSON.parse(localStorage.getItem("lab_saved") || "[]"); } catch { return []; } });

  const metric = METRICS.find((x) => x.id === m)!;
  const dim = DIMS.find((x) => x.id === d)!;

  // Auto recommend chart type when changing dimension
  const handleDimChange = (newD: string) => {
    setD(newD);
    const targetDim = DIMS.find((x) => x.id === newD);
    if (targetDim?.time) {
      if (newD === "hour") setC("cols");
      else setC("line");
    } else if (newD === "division" || newD === "gateway") {
      setC("donut");
    } else {
      setC("bars");
    }
  };

  const res = useMemo(() => explore(ctx, m, d, mode, top), [ctx, m, d, mode, top]);
  const fmt = FMT[metric.fmt];
  const total = res.rows.reduce((a, b) => a + b.value, 0);
  const persist = (l: Saved[]) => { setSaved(l); localStorage.setItem("lab_saved", JSON.stringify(l)); };
  const apply = (x: { m: string; d: string; c: ChartKind; top?: number }) => { setM(x.m); setD(x.d); setC(x.c); if (x.top) setTop(x.top); };
  const kinds: { id: ChartKind; label: string }[] = [{ id: "bars", label: "Bars" }, { id: "cols", label: "Columns" }, { id: "line", label: "Line" }, { id: "donut", label: "Donut" }, { id: "table", label: "Table" }];

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <Card className="p-5 border-slate-200/80">
          <div className="mb-4 flex items-center gap-2 font-bold text-slate-900 text-sm">
            <FlaskConical size={17} className="text-indigo-600" />
            <span>Interactive Query Builder</span>
          </div>
          <div className="space-y-4 text-xs">
            <Field label="1. Metric to measure">
              <Select value={m} onChange={(e) => setM(e.target.value)} className="text-xs font-semibold">
                {METRICS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </Select>
            </Field>

            <Field label="2. Dimension slice" hint={`${DIMS.length} data slicing angles`}>
              <Select value={d} onChange={(e) => handleDimChange(e.target.value)} className="text-xs font-semibold">
                <optgroup label="Time Dimensions">
                  {DIMS.filter((x) => x.time).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </optgroup>
                <optgroup label="Catalog & Product Specs">
                  {DIMS.filter((x) => x.item).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </optgroup>
                <optgroup label="Customers, Geography & Order Routing">
                  {DIMS.filter((x) => !x.time && !x.item).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </optgroup>
              </Select>
            </Field>

            <Field label="3. Visualization Format">
              <Chips options={kinds} value={c} onChange={setC} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Top Groups">
                <Select value={top} onChange={(e) => setTop(Number(e.target.value))} className="text-xs font-semibold">
                  {[5, 10, 15, 25, 50].map((n) => <option key={n} value={n}>{n} rows</option>)}
                </Select>
              </Field>
              <Field label="Filter Orders">
                <Select value={mode} onChange={(e) => setMode(e.target.value as "valid" | "all")} className="text-xs font-semibold">
                  <option value="valid">Valid only</option>
                  <option value="all">Include cancelled</option>
                </Select>
              </Field>
            </div>
          </div>
        </Card>

        <Card className="p-5 border-slate-200/80">
          <div className="mb-3 text-xs font-bold text-slate-800">Quick Business Questions</div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => apply(p)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-indigo-400 hover:text-indigo-700 transition"
              >
                {p.label}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5 border-slate-200/80">
          <div className="mb-3 flex items-center justify-between text-xs font-bold text-slate-800">
            <span>Saved Custom Views</span>
            <Badge tone="gray">{saved.length}</Badge>
          </div>
          {saved.length === 0 && <p className="text-xs text-slate-400">Configure your query and tap “Save View” to preserve it.</p>}
          <div className="space-y-1.5">
            {saved.map((s) => (
              <div key={s.id} className="flex items-center gap-1 rounded-xl bg-slate-50 border border-slate-200/70 pr-1">
                <button onClick={() => apply(s)} className="flex-1 truncate px-3 py-1.5 text-left text-xs font-semibold text-slate-800 hover:text-indigo-600 transition">
                  {s.name}
                </button>
                <button
                  onClick={() => persist(saved.filter((x) => x.id !== s.id))}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 transition"
                  title="Delete saved view"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="border-slate-200/80">
        <CardHead
          title={`${metric.label} sliced by ${dim.label}`}
          sub={`Last ${days} days · ${res.groups} segments identified · ${mode === "all" ? "includes cancelled/failed" : "valid orders only"}`}
          right={
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                icon={<Save size={13} />}
                onClick={() => {
                  persist([{ id: String(Date.now()), name: `${metric.label} by ${dim.label}`, m, d, c, top }, ...saved]);
                  toast("Custom view saved!");
                }}
              >
                Save View
              </Button>
              <Button
                size="sm"
                icon={<Download size={13} />}
                onClick={() => downloadCSV(`lab-${m}-by-${d}.csv`, [dim.label, metric.label], res.rows.map((r) => [r.label, r.value]))}
              >
                CSV
              </Button>
            </div>
          }
        />
        <div className="px-5 pb-5">
          <div className="mb-5 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-indigo-50/70 border border-indigo-100 p-4">
              <div className="text-xs font-semibold text-indigo-700">Total Measured</div>
              <div className="text-xl font-black text-slate-900">{fmt(res.total)}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200/70 p-4">
              <div className="text-xs font-semibold text-slate-500">Top Leading Segment</div>
              <div className="truncate text-xl font-black text-slate-900">
                {res.rows.length ? [...res.rows].sort((a, b) => b.value - a.value)[0].label : "—"}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200/70 p-4">
              <div className="text-xs font-semibold text-slate-500">Total Segments</div>
              <div className="text-xl font-black text-slate-900">{res.groups}</div>
            </div>
          </div>

          {res.rows.length === 0 ? (
            <Empty title="No data for this combination" sub="Try expanding the time range or include all order statuses." />
          ) : (
            <>
              {c === "bars" && <BarList rows={res.rows} fmt={fmt} limit={top} />}
              {c === "cols" && <Columns rows={res.rows.map((r) => (dim.time && res.rows.length > 14 ? { ...r, label: "" } : r))} fmt={fmt} height={280} highlight />}
              {c === "line" && <LineChart points={res.rows.map((r) => ({ x: r.label, y: r.value }))} fmt={fmt} height={300} />}
              {c === "donut" && <Donut rows={res.rows.filter((r) => r.value > 0)} fmt={fmt} size={190} />}
              {c === "table" && (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <Th>{dim.label}</Th>
                        <Th className="text-right">{metric.label}</Th>
                        <Th className="text-right">Share of Total</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {res.rows.map((r) => (
                        <tr key={r.label} className="hover:bg-slate-50/60 transition">
                          <Td className="font-semibold text-slate-800">{r.label}</Td>
                          <Td className="text-right tabular-nums font-mono font-bold text-slate-900">{fmt(r.value)}</Td>
                          <Td className="text-right tabular-nums text-slate-500">{total ? pct((r.value / total) * 100) : "—"}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
