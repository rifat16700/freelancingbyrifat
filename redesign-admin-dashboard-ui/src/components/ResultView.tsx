import { BarList, Columns, Donut, Funnel, Heatmap, LineChart, Sparkline } from "./charts";
import { FMT, type Result } from "../lib/insights";
import { Badge, Empty } from "./ui";

const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HR = Array.from({ length: 24 }, (_, i) => `${i % 12 || 12}${i < 12 ? "a" : "p"}`);

export function ResultView({ r, big }: { r: Result; big?: boolean }) {
  switch (r.type) {
    case "kpi":
      return (
        <div>
          <div className="flex items-end justify-between gap-3">
            <div className={big ? "text-5xl font-bold tracking-tight text-slate-900" : "text-3xl font-bold tracking-tight text-slate-900"}>{r.value}</div>
            {r.spark && <div className="w-24 pb-1"><Sparkline data={r.spark} /></div>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {r.delta !== undefined && isFinite(r.delta) && (
              <Badge tone={(r.goodUp !== false ? r.delta >= 0 : r.delta <= 0) ? "green" : "red"}>{r.delta >= 0 ? "▲" : "▼"} {Math.abs(r.delta).toFixed(1)}%</Badge>
            )}
            {r.sub && <span className="text-slate-500">{r.sub}</span>}
          </div>
        </div>
      );
    case "bars":
      return <BarList rows={r.rows} fmt={FMT[r.fmt]} color={r.color} limit={big ? 30 : 7} />;
    case "cols":
      return r.rows.length ? <Columns rows={r.rows.length === 24 ? r.rows.map((x, i) => ({ ...x, label: i % 3 === 0 ? HR[i] : "" })) : r.rows} fmt={FMT[r.fmt]} color={r.color} highlight={r.highlight} height={big ? 280 : 170} /> : <Empty title="No data" />;
    case "line":
      return <LineChart points={r.points} fmt={FMT[r.fmt]} color={r.color} height={big ? 320 : 190} />;
    case "donut":
      return r.rows.length ? <Donut rows={r.rows} fmt={FMT[r.fmt]} colors={r.colors} size={big ? 180 : 128} /> : <Empty title="No data" />;
    case "funnel":
      return <Funnel rows={r.rows} fmt={FMT[r.fmt]} />;
    case "heat":
      return <Heatmap matrix={r.matrix} rowLabels={WD} colLabels={HR} />;
    case "table":
      return r.rows.length === 0 ? <div className="py-6 text-center text-sm text-slate-400">Nothing to show for this period 🎉</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>{r.cols.map((c, i) => <th key={i} className={`pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 ${i === 0 ? "text-left" : "text-right"}`}>{c}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {r.rows.slice(0, big ? 50 : 8).map((row, ri) => (
                <tr key={ri}>{row.map((c, i) => <td key={i} className={`py-2 ${i === 0 ? "max-w-[190px] truncate pr-2 font-medium text-slate-700" : "text-right tabular-nums text-slate-600"}`}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function resultToCSV(r: Result): { header: string[]; rows: (string | number)[][] } | null {
  switch (r.type) {
    case "bars": case "cols": case "donut": case "funnel": return { header: ["Label", "Value"], rows: r.rows.map((x) => [x.label, x.value]) };
    case "line": return { header: ["Date", "Value"], rows: r.points.map((p) => [p.x, p.y]) };
    case "table": return { header: r.cols, rows: r.rows };
    case "heat": return { header: ["Weekday", ...HR], rows: r.matrix.map((m, i) => [WD[i], ...m]) };
    default: return null;
  }
}
