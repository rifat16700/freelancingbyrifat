import { useState } from "react";

export function primaryHex(): string {
  if (typeof document !== "undefined") {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
    if (v) return v;
  }
  return "#8b1a1a";
}

export const PALETTE = ["var(--primary, #8b1a1a)", "#10b981", "#f59e0b", "#ec4899", "#0ea5e9", "#8b5cf6", "#f97316", "#14b8a6", "#ef4444", "#84cc16"];
export type Fmt = (n: number) => string;

// Build smooth cubic bezier SVG path from points
function smoothLinePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export function Sparkline({ data, color, h = 36 }: { data: number[]; color?: string; h?: number }) {
  const c = color || primaryHex();
  if (data.length < 2) return null;
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: h - 3 - ((v - min) / (max - min || 1)) * (h - 6),
  }));
  const path = smoothLinePath(pts);
  return (
    <svg viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" className="w-full" style={{ height: h }}>
      <path d={path} fill="none" stroke={c} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}

export function LineChart({ points, fmt, color, height = 200, area = true }: { points: { x: string; y: number }[]; fmt: Fmt; color?: string; height?: number; area?: boolean }) {
  const c = color || primaryHex();
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return <div className="py-10 text-center text-sm text-slate-400">No data</div>;
  const W = 600, H = height, pl = 10, pr = 10, pt = 14, pb = 22;
  const max = Math.max(...points.map((p) => p.y), 1);
  const xs = (i: number) => pl + (points.length === 1 ? (W - pl - pr) / 2 : (i / (points.length - 1)) * (W - pl - pr));
  const ys = (v: number) => pt + (1 - v / max) * (H - pt - pb);

  const rawPts = points.map((p, i) => ({ x: xs(i), y: ys(p.y) }));
  const line = smoothLinePath(rawPts);
  const areaPath = `${line} L${xs(points.length - 1)},${H - pb} L${xs(0)},${H - pb} Z`;
  const gid = "g" + c.replace(/[^a-zA-Z0-9]/g, "");
  const ticks = [0, 0.5, 1];
  const labelIdx = [0, Math.floor((points.length - 1) / 2), points.length - 1];

  const tooltipLeftPct = hover !== null ? Math.max(14, Math.min(86, (xs(hover) / W) * 100)) : 50;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.max(0, Math.min(points.length - 1, Math.round(((x - pl) / (W - pl - pr)) * (points.length - 1)))));
        }}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c} stopOpacity=".28" />
            <stop offset="100%" stopColor={c} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Dynamic Gridlines */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pl} x2={W - pr} y1={ys(max * t)} y2={ys(max * t)} stroke="var(--chart-grid, #e2e8f0)" strokeDasharray="3 4" strokeWidth="1" />
            <text x={W - pr} y={ys(max * t) - 3} fontSize="9" fill="#94a3b8" textAnchor="end" className="select-none font-mono">
              {fmt(max * t)}
            </text>
          </g>
        ))}

        {area && <path d={areaPath} fill={`url(#${gid})`} />}
        <path d={line} fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" />

        {labelIdx.map((i, k) => (
          <text key={k} x={xs(i)} y={H - 6} fontSize="10" fill="#94a3b8" textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"} className="select-none">
            {points[i].x}
          </text>
        ))}

        {hover !== null && (
          <g>
            <line x1={xs(hover)} x2={xs(hover)} y1={pt} y2={H - pb} stroke="rgba(148, 163, 184, 0.5)" strokeDasharray="2 3" strokeWidth="1.5" />
            <circle cx={xs(hover)} cy={ys(points[hover].y)} r="5" fill="#ffffff" stroke={c} strokeWidth="2.5" />
          </g>
        )}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute top-1 -translate-x-1/2 rounded-xl border border-slate-700/60 bg-slate-900/95 px-3 py-1.5 text-xs text-white shadow-xl backdrop-blur transition-all duration-75"
          style={{ left: `${tooltipLeftPct}%` }}
        >
          <div className="text-[11px] font-medium text-slate-300">{points[hover].x}</div>
          <div className="font-bold text-sm text-emerald-400">{fmt(points[hover].y)}</div>
        </div>
      )}
    </div>
  );
}

export function Columns({ rows, fmt, color, height = 180, highlight }: { rows: { label: string; value: number }[]; fmt: Fmt; color?: string; height?: number; highlight?: boolean }) {
  const c = color || "var(--primary, #8b1a1a)";
  const max = Math.max(...rows.map((r) => r.value), 1);
  const top = highlight ? rows.reduce((b, r, i) => (r.value > rows[b].value ? i : b), 0) : -1;
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {rows.map((r, i) => (
        <div key={i} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end">
          <div className="pointer-events-none absolute -top-1 z-10 hidden -translate-y-full whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white group-hover:block">{r.label}: {fmt(r.value)}</div>
          <div className="w-full rounded-t-md transition-all" style={{ height: `${Math.max(2, (r.value / max) * 82)}%`, background: i === top ? "#f59e0b" : c, opacity: i === top ? 1 : 0.85 }} />
          <div className="mt-1.5 w-full truncate text-center text-[10px] text-slate-500">{r.label}</div>
        </div>
      ))}
    </div>
  );
}

export function BarList({ rows, fmt, color, max: m, limit = 8 }: { rows: { label: string; value: number; hint?: string }[]; fmt: Fmt; color?: string; max?: number; limit?: number }) {
  const c = color || "var(--primary, #8b1a1a)";
  const list = rows.slice(0, limit);
  const max = m ?? Math.max(...list.map((r) => r.value), 1);
  if (!list.length) return <div className="py-8 text-center text-sm text-slate-400">No data</div>;
  return (
    <div className="space-y-2.5">
      {list.map((r, i) => (
        <div key={i}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate font-medium text-slate-700">{r.label}</span>
            <span className="shrink-0 tabular-nums text-slate-500">{fmt(r.value)}{r.hint && <span className="ml-1.5 text-slate-400">{r.hint}</span>}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%`, background: c }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Donut({ rows, fmt, colors, size = 140 }: { rows: { label: string; value: number }[]; fmt: Fmt; colors?: string[]; size?: number }) {
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  const [hi, setHi] = useState<number | null>(null);
  let acc = 0;
  const R = 15.9155;
  const col = (i: number, label: string) => colors?.[i] || PALETTE[i % PALETTE.length] || label;
  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 36 36" className="-rotate-90">
          <circle cx="18" cy="18" r={R} fill="none" stroke="var(--chart-track, #f1f5f9)" strokeWidth="4.5" />
          {rows.map((r, i) => {
            const frac = (r.value / total) * 100;
            const el = (
              <circle key={i} cx="18" cy="18" r={R} fill="none" stroke={col(i, r.label)} strokeWidth={hi === i ? 5.5 : 4.5} strokeDasharray={`${Math.max(0, frac - 0.6)} ${100 - Math.max(0, frac - 0.6)}`} strokeDashoffset={-acc}
                onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} style={{ transition: "stroke-width .15s" }} />
            );
            acc += frac;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">{hi !== null ? rows[hi].label : "Total"}</div>
            <div className="text-sm font-bold text-slate-900">{hi !== null ? `${((rows[hi].value / total) * 100).toFixed(1)}%` : fmt(total)}</div>
          </div>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {rows.slice(0, 7).map((r, i) => (
          <li key={i} className="flex items-center justify-between gap-2 text-xs cursor-pointer rounded-lg px-1.5 py-0.5 hover:bg-slate-50 transition" onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}>
            <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: col(i, r.label) }} /><span className="truncate font-medium text-slate-700">{r.label}</span></span>
            <span className="shrink-0 tabular-nums text-slate-500">{fmt(r.value)} <span className="text-slate-400 font-semibold">· {((r.value / total) * 100).toFixed(0)}%</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Heatmap({ matrix, rowLabels, colLabels }: { matrix: number[][]; rowLabels: string[]; colLabels: string[] }) {
  const max = Math.max(...matrix.flat(), 1);
  const [hoverCell, setHoverCell] = useState<{ r: number; c: number; v: number } | null>(null);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px]">
        {hoverCell && (
          <div className="mb-2 text-xs font-semibold text-indigo-600 bg-indigo-50/70 border border-indigo-200/60 rounded-xl px-3 py-1 flex items-center justify-between">
            <span>📅 {rowLabels[hoverCell.r]} at {colLabels[hoverCell.c]}</span>
            <span>🔥 {hoverCell.v} orders</span>
          </div>
        )}
        <div className="ml-10 grid" style={{ gridTemplateColumns: `repeat(${colLabels.length}, 1fr)` }}>
          {colLabels.map((c, i) => <div key={i} className="text-center text-[9px] text-slate-400">{i % 3 === 0 ? c : ""}</div>)}
        </div>
        {matrix.map((row, ri) => (
          <div key={ri} className="mt-0.5 flex items-center">
            <div className="w-10 text-[11px] text-slate-500 font-medium">{rowLabels[ri]}</div>
            <div className="grid flex-1 gap-0.5" style={{ gridTemplateColumns: `repeat(${row.length}, 1fr)` }}>
              {row.map((v, ci) => (
                <div
                  key={ci}
                  onMouseEnter={() => setHoverCell({ r: ri, c: ci, v })}
                  onMouseLeave={() => setHoverCell(null)}
                  className="aspect-[1.4] rounded-[4px] cursor-pointer transition hover:scale-110 hover:shadow-md"
                  style={{
                    background: v === 0 ? "var(--chart-zero, #f8fafc)" : `color-mix(in srgb, var(--primary, #8b1a1a) ${Math.round((0.18 + (v / max) * 0.82) * 100)}%, transparent)`,
                    border: v === 0 ? "1px solid var(--chart-grid, #f1f5f9)" : "none",
                  }}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="mt-2.5 flex items-center justify-end gap-1.5 text-[10px] text-slate-400">
          <span>Low</span>
          {[15, 35, 55, 78, 100].map((a) => (
            <span key={a} className="h-2.5 w-4 rounded-sm" style={{ background: `color-mix(in srgb, var(--primary, #8b1a1a) ${a}%, transparent)` }} />
          ))}
          <span>Peak</span>
        </div>
      </div>
    </div>
  );
}

export function Funnel({ rows, fmt }: { rows: { label: string; value: number }[]; fmt: Fmt }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-20 shrink-0 text-xs text-slate-600">{r.label}</div>
          <div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-slate-100">
            <div className="flex h-full items-center rounded-lg px-2 text-xs font-semibold text-white" style={{ width: `${Math.max(8, (r.value / max) * 100)}%`, background: PALETTE[i % PALETTE.length] }}>{fmt(r.value)}</div>
          </div>
          <div className="w-12 shrink-0 text-right text-[11px] text-slate-400">{i === 0 ? "100%" : ((r.value / (rows[0].value || 1)) * 100).toFixed(0) + "%"}</div>
        </div>
      ))}
    </div>
  );
}
