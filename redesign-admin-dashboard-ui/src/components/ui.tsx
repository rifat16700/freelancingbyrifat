import { useEffect, useRef, useState, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Check, ChevronLeft, ChevronRight, Code2, HelpCircle, Inbox, Lightbulb, Search, Upload, X, ChevronDown } from "lucide-react";
import { cn } from "../utils/cn";
import { uploadImageFile } from "../lib/api";
import type { Product, Status, PayStatus } from "../types";

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cn("rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,.04)]", className)}>
      {children}
    </div>
  );
}
export function CardHead({ title, sub, right, className }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-4 pb-3", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-slate-900 leading-tight">{title}</h3>
        {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

type BtnProps = { variant?: "primary" | "secondary" | "ghost" | "danger" | "soft"; size?: "sm" | "md" | "lg"; icon?: ReactNode; children?: ReactNode; className?: string; onClick?: (e: React.MouseEvent) => void; disabled?: boolean; type?: "button" | "submit"; title?: string };
export function Button({ variant = "secondary", size = "md", icon, children, className, ...rest }: BtnProps) {
  const v = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/20",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    soft: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
  }[variant];
  const s = { sm: "h-8 px-2.5 text-xs gap-1.5", md: "h-9 px-3.5 text-sm gap-2", lg: "h-11 px-5 text-sm gap-2" }[size];
  return (
    <button type="button" {...rest} className={cn("inline-flex items-center justify-center rounded-xl font-medium transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap", v, s, className)}>
      {icon}
      {children}
    </button>
  );
}
export function ConfirmButton({ onConfirm, children, className, label = "Sure?" }: { onConfirm: () => void; children: ReactNode; className?: string; label?: string }) {
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    if (!ask) return;
    const t = setTimeout(() => setAsk(false), 3000);
    return () => clearTimeout(t);
  }, [ask]);
  return ask ? (
    <button onClick={(e) => { e.stopPropagation(); onConfirm(); setAsk(false); }} className="h-8 rounded-lg bg-rose-600 px-2.5 text-xs font-semibold text-white animate-pulse">{label}</button>
  ) : (
    <button onClick={(e) => { e.stopPropagation(); setAsk(true); }} className={cn("grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600", className)} title="Delete">{children}</button>
  );
}

const TONES: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700", green: "bg-emerald-50 text-emerald-700 ring-emerald-200", red: "bg-rose-50 text-rose-700 ring-rose-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200", blue: "bg-sky-50 text-sky-700 ring-sky-200", indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200", pink: "bg-pink-50 text-pink-700 ring-pink-200",
};
export function Badge({ tone = "slate", children, dot, className }: { tone?: keyof typeof TONES; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ring-transparent", TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
export const STATUS_TONE: Record<Status, string> = { Pending: "amber", Confirmed: "blue", Processing: "violet", Shipped: "indigo", Delivered: "green", Cancelled: "red" };
export const STATUS_HEX: Record<string, string> = { Pending: "#f59e0b", Confirmed: "#0ea5e9", Processing: "#8b5cf6", Shipped: "#6366f1", Delivered: "#10b981", Cancelled: "#f43f5e" };
export const StatusBadge = ({ s }: { s: Status }) => <Badge tone={STATUS_TONE[s] || "slate"} dot>{s}</Badge>;
export const PayBadge = ({ s }: { s: PayStatus }) => <Badge tone={s === "Paid" ? "green" : s === "Advance Paid" ? "blue" : "slate"}>{s}</Badge>;

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  const sw = (
    <button type="button" role="switch" disabled={disabled} aria-checked={checked} onClick={() => !disabled && onChange(!checked)} className={cn("relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50", checked ? "bg-emerald-500" : "bg-slate-300")}>
      <span className={cn("absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition", checked && "translate-x-5")} />
    </button>
  );
  if (!label) return sw;
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-800">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
      </div>
      {sw}
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";
export function Field({ label, hint, children, required, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; required?: boolean; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-slate-700">{label}{required && <span className="text-rose-500"> *</span>}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cn(inputCls, className)} />;
export const Select = ({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cn(inputCls, "pr-8", className)}>{children}</select>;
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cn(inputCls, "min-h-[84px]", className)} />;
export function SearchBox({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || "Search…"} className={cn(inputCls, "pl-9 pr-8")} />
      {value && <button onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100"><X size={14} /></button>}
    </div>
  );
}

export function Modal({ open, onClose, title, sub, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] animate-[fade_.15s_ease]" onClick={onClose} />
      <div className={cn("relative flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl animate-[pop_.18s_ease]", wide ? "sm:max-w-3xl" : "sm:max-w-xl")}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {sub && <p className="mt-0.5 text-sm text-slate-500">{sub}</p>}
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3.5 sm:rounded-b-3xl">{footer}</div>}
      </div>
    </div>
  );
}
export function Drawer({ open, onClose, title, sub, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40 animate-[fade_.15s_ease]" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col bg-white shadow-2xl animate-[slide_.2s_ease]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-slate-900">{title}</h2>
            {sub && <p className="mt-0.5 text-sm text-slate-500">{sub}</p>}
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ title, desc, actions, icon }: { title: ReactNode; desc?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-3">
        {icon && <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">{icon}</div>}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {desc && <p className="mt-0.5 text-sm text-slate-500">{desc}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
export function HelpBox({ title = "How this works", children, id }: { title?: string; children: ReactNode; id: string }) {
  const [open, setOpen] = useState(() => localStorage.getItem("help_" + id) !== "0");
  return (
    <div className="mb-5 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50 to-orange-50/40 px-4 py-3">
      <button className="flex w-full items-center justify-between text-left" onClick={() => { localStorage.setItem("help_" + id, open ? "0" : "1"); setOpen(!open); }}>
        <span className="flex items-center gap-2 text-sm font-semibold text-amber-900"><Lightbulb size={16} /> {title}</span>
        <ChevronDown size={16} className={cn("text-amber-700 transition", open && "rotate-180")} />
      </button>
      {open && <div className="mt-2 space-y-1 text-sm leading-relaxed text-amber-900/80">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, icon, delta, tone = "indigo", goodUp = true }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; delta?: number; tone?: string; goodUp?: boolean }) {
  const tones: Record<string, string> = { indigo: "bg-indigo-50 text-indigo-600", green: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600", rose: "bg-rose-50 text-rose-600", sky: "bg-sky-50 text-sky-600", violet: "bg-violet-50 text-violet-600" };
  const good = delta === undefined ? true : goodUp ? delta >= 0 : delta <= 0;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-500">{label}</div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
        </div>
        {icon && <div className={cn("grid h-10 w-10 place-items-center rounded-xl", tones[tone])}>{icon}</div>}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {delta !== undefined && isFinite(delta) && (
          <span className={cn("rounded-full px-1.5 py-0.5 font-semibold", good ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {sub && <span className="text-slate-500">{sub}</span>}
      </div>
    </Card>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1", className)}>
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} className={cn("flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-sm font-medium transition", value === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}>
          {t.label}
          {t.count !== undefined && <span className={cn("rounded-full px-1.5 text-[11px]", value === t.id ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-600")}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
export function Chips<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition", value === o.id ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title = "Nothing here yet", sub, action }: { title?: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center px-6 py-14 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Inbox size={26} /></div>
      <div className="font-semibold text-slate-800">{title}</div>
      {sub && <div className="mt-1 max-w-sm text-sm text-slate-500">{sub}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function usePaged<T>(items: T[], size = 10) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(page, pages - 1);
  return { rows: items.slice(p * size, p * size + size), page: p, pages, setPage, total: items.length, size };
}
export function Pager({ page, pages, setPage, total, size }: { page: number; pages: number; setPage: (n: number) => void; total: number; size: number }) {
  if (total <= size) return <div className="px-5 py-3 text-xs text-slate-500">{total} items</div>;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
      <span>Showing {page * size + 1}–{Math.min(total, page * size + size)} of {total}</span>
      <div className="flex items-center gap-1">
        <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={14} /></button>
        <span className="px-2 font-medium text-slate-700">{page + 1} / {pages}</span>
        <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={14} /></button>
      </div>
    </div>
  );
}

export function Thumb({ p, size = 44 }: { p: Pick<Product, "hue" | "emoji"> & { galleryImages?: string[]; imageUrl?: string }; size?: number }) {
  const img = p.galleryImages?.[0] || p.imageUrl;
  if (img) {
    return (
      <img
        src={img}
        alt=""
        className="shrink-0 rounded-xl border border-slate-200/70 object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div className="grid shrink-0 place-items-center rounded-xl text-white" style={{ width: size, height: size, fontSize: size * 0.5, background: `linear-gradient(135deg, hsl(${p.hue || 10} 80% 62%), hsl(${((p.hue || 10) + 40) % 360} 75% 45%))` }}>
      {p.emoji || "🛍️"}
    </div>
  );
}

export function IconView({ icon, size = 24, className }: { icon?: string; size?: number; className?: string }) {
  const v = (icon || "").trim();
  if (v.startsWith("<svg")) {
    return (
      <span
        className={cn("inline-flex items-center justify-center [&>svg]:h-full [&>svg]:w-full", className)}
        style={{ width: size, height: size }}
        dangerouslySetInnerHTML={{ __html: v }}
      />
    );
  }
  if (/^(https?:\/\/|data:image\/|\/)/i.test(v)) {
    return (
      <img
        src={v}
        alt=""
        className={cn("rounded-lg object-contain", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return <span className={className}>{v || "🛍️"}</span>;
}

export function MediaPicker({
  value,
  onChange,
  allowSvg,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  allowSvg?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [svgOpen, setSvgOpen] = useState(false);
  const isSvg = (value || "").trim().startsWith("<svg");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const url = await uploadImageFile(f);
      if (url) onChange(url);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-lg">
          <IconView icon={value} size={26} />
        </div>
        <Input
          value={isSvg ? "<svg>…</svg>" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || (allowSvg ? "Emoji, image URL, or upload…" : "Paste image URL or upload…")}
          className="flex-1"
        />
        <input ref={fileRef} type="file" accept="image/*,.svg" className="hidden" onChange={handleFile} />
        <Button size="sm" icon={<Upload size={14} />} disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? "…" : "Upload"}
        </Button>
        {allowSvg && (
          <Button size="sm" variant={svgOpen || isSvg ? "soft" : "secondary"} icon={<Code2 size={14} />} onClick={() => setSvgOpen((s) => !s)}>
            SVG
          </Button>
        )}
        {value && (
          <button type="button" onClick={() => onChange("")} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600" title="Clear">
            <X size={15} />
          </button>
        )}
      </div>
      {allowSvg && (svgOpen || isSvg) && (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="font-mono text-xs"
          placeholder="Paste raw <svg viewBox='...'>...</svg> code here"
        />
      )}
    </div>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const safe = name || "Admin";
  const h = [...safe].reduce((s, c) => s + c.charCodeAt(0), 0) % 360;
  return (
    <div className="grid shrink-0 place-items-center rounded-full font-semibold text-white" style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${h} 55% 48%)` }}>
      {safe.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
    </div>
  );
}
export function Progress({ value, tone = "indigo" }: { value: number; tone?: string }) {
  const c: Record<string, string> = { indigo: "bg-indigo-500", green: "bg-emerald-500", amber: "bg-amber-500", rose: "bg-rose-500" };
  return <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full transition-all", c[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}
export function Tip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <HelpCircle size={14} className="text-slate-400" />
      <span className="pointer-events-none absolute left-1/2 top-5 z-20 hidden w-56 -translate-x-1/2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-normal leading-snug text-white shadow-xl group-hover:block">{text}</span>
    </span>
  );
}
export function Check2({ on }: { on: boolean }) {
  return <span className={cn("grid h-5 w-5 place-items-center rounded-md border", on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white")}>{on && <Check size={13} />}</span>;
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("whitespace-nowrap bg-slate-50/80 px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500", className)}>{children}</th>;
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("px-5 py-3 align-middle text-sm text-slate-700", className)}>{children}</td>;
}
