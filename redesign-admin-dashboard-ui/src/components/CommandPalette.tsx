import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Package, Search, ShoppingBag, Users, LayoutDashboard } from "lucide-react";
import { useStore } from "../store";
import { ALL_NAV } from "../nav";
import { go } from "../router";
import { cn } from "../utils/cn";
import { money } from "../lib/format";

interface Item { key: string; icon: React.ReactNode; title: string; sub: string; to: string; group: string }

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { orders, products, customers, lang } = useStore();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setQ(""); setIdx(0); setTimeout(() => ref.current?.focus(), 30); } }, [open]);

  const items = useMemo<Item[]>(() => {
    const s = q.trim().toLowerCase();
    const pages: Item[] = ALL_NAV.filter((n) => !s || n.en.toLowerCase().includes(s) || n.bn.includes(s) || n.desc.toLowerCase().includes(s)).slice(0, s ? 4 : 8).map((n) => ({ key: n.path, icon: <n.icon size={16} />, title: lang === "bn" ? n.bn : n.en, sub: n.desc, to: n.path, group: "Go to page" }));
    if (!s) return pages;
    const o: Item[] = orders.items.filter((x) => x.id.toLowerCase().includes(s) || x.customerName.toLowerCase().includes(s) || x.customerPhone.includes(s)).slice(0, 5).map((x) => ({ key: x.id, icon: <ShoppingBag size={16} />, title: `${x.id} · ${x.customerName}`, sub: `${x.status} · ${money(x.grand)}`, to: `/orders?id=${x.id}`, group: "Orders" }));
    const p: Item[] = products.items.filter((x) => x.name.toLowerCase().includes(s) || x.sku.toLowerCase().includes(s)).slice(0, 4).map((x) => ({ key: x.id, icon: <Package size={16} />, title: x.name, sub: `${x.sku} · ${money(x.price)}`, to: `/products?id=${x.id}`, group: "Products" }));
    const c: Item[] = customers.filter((x) => x.name.toLowerCase().includes(s) || x.phone.includes(s)).slice(0, 4).map((x) => ({ key: x.phone, icon: <Users size={16} />, title: x.name, sub: `${x.phone} · ${x.orders.length} orders`, to: `/customers?phone=${x.phone}`, group: "Customers" }));
    return [...pages, ...o, ...p, ...c];
  }, [q, orders.items, products.items, customers, lang]);

  if (!open) return null;
  const choose = (i: Item) => { go(i.to); onClose(); };
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl animate-[pop_.15s_ease]">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Search size={18} className="text-slate-400" />
          <input ref={ref} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              if (e.key === "Enter" && items[idx]) choose(items[idx]);
              if (e.key === "Escape") onClose();
            }}
            placeholder="Search orders, phone numbers, products, customers or pages…" className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-slate-400" />
          <kbd className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && <div className="py-10 text-center text-sm text-slate-400">No results for “{q}”</div>}
          {items.map((it, i) => (
            <div key={it.group + it.key}>
              {(i === 0 || items[i - 1].group !== it.group) && <div className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{it.group}</div>}
              <button onMouseEnter={() => setIdx(i)} onClick={() => choose(it)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left", idx === i ? "bg-indigo-50" : "")}>
                <span className={cn("grid h-8 w-8 place-items-center rounded-lg", idx === i ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500")}>{it.icon}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-900">{it.title}</span><span className="block truncate text-xs text-slate-500">{it.sub}</span></span>
                {idx === i && <CornerDownLeft size={14} className="text-indigo-500" />}
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-500"><LayoutDashboard size={12} /> Tip: type a phone number to instantly find a customer’s orders</div>
      </div>
    </div>
  );
}
