import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Bell, CheckCircle2, ExternalLink, Info, LogOut, Menu, Moon, RefreshCw, Search, Sun, X } from "lucide-react";
import { NAV, ALL_NAV, LogoIcon } from "../nav";
import { useStore } from "../store";
import { go } from "../router";
import { cn } from "../utils/cn";
import { CommandPalette } from "./CommandPalette";
import { Avatar } from "./ui";

export function Layout({ path, children, onLogout }: { path: string; children: ReactNode; onLogout: () => void }) {
  const { orders, reviews, toasts, lang, setLang, t, settings, themeMode, toggleTheme, authUser, hasPerm, loading, reloadAll } = useStore();
  const [mobile, setMobile] = useState(false);
  const [cmd, setCmd] = useState(false);
  const [bell, setBell] = useState(false);
  useEffect(() => { setMobile(false); }, [path]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd((v) => !v); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const pendingOrders = useMemo(() => orders.items.filter((o) => o.status === "Pending" && !o.failed).length, [orders.items]);
  const stale = useMemo(() => orders.items.filter((o) => o.status === "Pending" && !o.failed && Date.now() - new Date(o.date).getTime() > 86400000).length, [orders.items]);
  const pendingReviews = reviews.items.filter((r) => !r.approved).length;
  const badge = (b?: string) => (b === "orders" ? pendingOrders : b === "reviews" ? pendingReviews : 0);
  const current = ALL_NAV.find((n) => path.startsWith(n.path));
  const alerts = [
    stale > 0 && { icon: <AlertTriangle size={16} />, tone: "text-rose-600 bg-rose-50", title: `${stale} orders pending for 24h+`, to: "/orders?status=Pending" },
    pendingReviews > 0 && { icon: <Info size={16} />, tone: "text-amber-600 bg-amber-50", title: `${pendingReviews} reviews need approval`, to: "/reviews" },
    settings.maintenance && { icon: <AlertTriangle size={16} />, tone: "text-rose-600 bg-rose-50", title: "Maintenance mode is ON — store is hidden", to: "/developer" },
  ].filter(Boolean) as { icon: ReactNode; tone: string; title: string; to: string }[];

  const isDark = themeMode === "dark";
  const isStaff = authUser?.role === "staff";

  const visibleNav = useMemo(() => {
    return NAV.map((g) => ({
      ...g,
      items: g.items.filter((n) => {
        if (isStaff && (n.path === "/staff" || n.path === "/developer" || n.module === "staff")) return false;
        if (isStaff && n.module && !hasPerm(n.module, "view")) return false;
        return true;
      }),
    })).filter((g) => g.items.length > 0);
  }, [isStaff, hasPerm]);

  const storeUrl = settings.canonical || (typeof window !== "undefined" && window.CONFIG?.SITE_URL) || "/";

  const sidebar = (
    <div className={cn(
      "flex h-full flex-col transition-colors",
      isDark ? "bg-slate-950 text-slate-300 border-r border-slate-800" : "bg-white text-slate-700 border-r border-slate-200/80"
    )}>
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
          {settings.logo ? <img src={settings.logo} alt="" className="h-7 w-7 rounded-lg object-contain" /> : <LogoIcon size={20} />}
        </div>
        <div className="min-w-0">
          <div className={cn("truncate text-[15px] font-bold", isDark ? "text-white" : "text-slate-900")}>{settings.storeName || "Admin Panel"}</div>
          <div className="text-[11px] text-slate-500">Control Center</div>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6 pt-1">
        {visibleNav.map((g) => (
          <div key={g.en}>
            <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">{lang === "bn" ? g.bn : g.en}</div>
            {g.items.map((n) => {
              const active = !n.externalHref && path.startsWith(n.path);
              const b = badge(n.badge);
              return (
                <button
                  key={n.path}
                  onClick={() => {
                    if (n.externalHref) window.location.href = n.externalHref;
                    else go(n.path);
                  }}
                  className={cn(
                    "group mb-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
                    active
                      ? (isDark ? "bg-white/10 font-semibold text-white" : "bg-indigo-50 font-semibold text-indigo-700")
                      : (isDark ? "hover:bg-white/5 hover:text-white" : "hover:bg-slate-100 hover:text-slate-900")
                  )}
                >
                  <n.icon size={18} className={cn(active ? (isDark ? "text-indigo-400" : "text-indigo-600") : "text-slate-400 group-hover:text-slate-600")} />
                  <span className="flex-1 truncate">{lang === "bn" ? n.bn : n.en}</span>
                  {n.externalHref && <ExternalLink size={12} className="text-slate-400 opacity-60" />}
                  {n.badge === "new" && <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-500">New</span>}
                  {b > 0 && <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{b}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className={cn("border-t p-3", isDark ? "border-white/5" : "border-slate-200/70")}>
        <div className={cn("flex items-center gap-3 rounded-xl p-2.5", isDark ? "bg-white/5" : "bg-slate-50 border border-slate-200/60")}>
          <Avatar name={authUser?.email || "Master Admin"} size={34} />
          <div className="min-w-0 flex-1">
            <div className={cn("truncate text-xs font-semibold", isDark ? "text-white" : "text-slate-900")}>{authUser?.email || "Master Admin"}</div>
            <div className="text-[11px] text-emerald-500">● {isStaff ? "Staff Account" : "Master Admin • 2FA"}</div>
          </div>
          <button onClick={onLogout} title="Sign out" className={cn("rounded-lg p-2 transition", isDark ? "text-slate-400 hover:bg-white/10 hover:text-white" : "text-slate-500 hover:bg-rose-50 hover:text-rose-600")}>
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] lg:block">{sidebar}</aside>
      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobile(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] animate-[slideL_.2s_ease]">{sidebar}</div>
          <button onClick={() => setMobile(false)} className="absolute left-[292px] top-4 rounded-full bg-white p-2 shadow"><X size={16} /></button>
        </div>
      )}
      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur-xl sm:px-6">
          <button onClick={() => setMobile(true)} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden"><Menu size={20} /></button>
          <div className="hidden min-w-0 sm:block">
            <div className="truncate text-sm font-semibold text-slate-900">{current ? (lang === "bn" ? current.bn : current.en) : ""}</div>
          </div>
          <button onClick={() => setCmd(true)} className="mx-auto flex h-10 w-full max-w-md items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-400 transition hover:border-slate-300 hover:bg-white sm:mx-4">
            <Search size={16} />
            <span className="flex-1 truncate text-left">{t("Search orders, phones, products…", "অর্ডার, ফোন, প্রোডাক্ট খুঁজুন…")}</span>
            <kbd className="hidden rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 sm:block">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => reloadAll()}
              title={t("Refresh data", "ডাটা রিফ্রেশ করুন")}
              className="rounded-xl p-2.5 text-slate-600 hover:bg-slate-100"
            >
              <RefreshCw size={17} className={cn(loading && "animate-spin text-indigo-600")} />
            </button>
            <button
              onClick={toggleTheme}
              title={isDark ? t("Switch to Light Mode", "লাইট মোড") : t("Switch to Dark Mode", "ডার্ক মোড")}
              className="rounded-xl p-2.5 text-slate-600 hover:bg-slate-100"
            >
              {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
            </button>
            <div className="hidden rounded-xl bg-slate-100 p-0.5 text-xs font-semibold sm:flex">
              {(["en", "bn"] as const).map((l) => (
                <button key={l} onClick={() => setLang(l)} className={cn("rounded-[10px] px-2.5 py-1.5", lang === l ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>{l === "en" ? "EN" : "বাং"}</button>
              ))}
            </div>
            <div className="relative">
              <button onClick={() => setBell((b) => !b)} className="relative rounded-xl p-2.5 text-slate-600 hover:bg-slate-100">
                <Bell size={18} />
                {alerts.length > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />}
              </button>
              {bell && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setBell(false)} />
                  <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                    <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">{t("Needs your attention", "আপনার নজর দরকার")}</div>
                    {alerts.length === 0 && <div className="flex items-center gap-2 px-4 py-6 text-sm text-emerald-600"><CheckCircle2 size={16} /> Everything is under control</div>}
                    {alerts.map((a, i) => (
                      <button key={i} onClick={() => { go(a.to); setBell(false); }} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                        <span className={cn("grid h-8 w-8 place-items-center rounded-lg", a.tone)}>{a.icon}</span>
                        <span className="text-sm text-slate-700">{a.title}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <a href={storeUrl} target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 md:flex"><ExternalLink size={15} /> {t("View store", "স্টোর দেখুন")}</a>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
      <CommandPalette open={cmd} onClose={() => setCmd(false)} />
      <div className="fixed bottom-5 right-5 z-[80] flex flex-col gap-2">
        {toasts.map((x) => (
          <div key={x.id} className={cn("flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl animate-[pop_.2s_ease]", x.kind === "ok" ? "bg-slate-900" : x.kind === "err" ? "bg-rose-600" : "bg-indigo-600")}>
            {x.kind === "ok" ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Info size={16} />}
            {x.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
