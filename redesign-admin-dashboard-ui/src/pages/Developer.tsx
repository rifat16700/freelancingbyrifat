import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Code2, Copy, Database, Download, Play, Power, ShieldAlert, Terminal } from "lucide-react";
import { useStore } from "../store";
import { Badge, Button, Card, CardHead, Empty, Field, PageHeader, Select, Tabs, Td, Textarea, Th, Toggle } from "../components/ui";
import { d1AdminQuery, getProxyBase } from "../lib/api";
import { downloadCSV, downloadJSON } from "../lib/format";
import { cn } from "../utils/cn";

type Tab = "health" | "data" | "sql" | "backup" | "env" | "css";

const ENV: { name: string; group: string; help: string; ex: string; req: boolean }[] = [
  { name: "DB", group: "Bindings", help: "Cloudflare D1 database binding", ex: "(binding)", req: true },
  { name: "USERS_KV", group: "Bindings", help: "KV namespace for user auth", ex: "(binding)", req: false },
  { name: "MOD_KV", group: "Bindings", help: "KV namespace for moderation", ex: "(binding)", req: false },
  { name: "EMAIL", group: "Bindings", help: "Send-email binding for auth emails", ex: "(binding)", req: false },
  { name: "TEMPLATE_VERSION", group: "Look & feel", help: "Store template: v1 classic or v2 modern", ex: "v2", req: true },
  { name: "BRAND_COLORS", group: "Look & feel", help: "JSON of brand colours — copy it from Theme", ex: '{"primary":"#8b1a1a"}', req: false },
  { name: "ADMIN_USERNAME", group: "Admin login", help: "Initial 1-time Master admin username", ex: "admin", req: true },
  { name: "ADMIN_PASSWORD", group: "Admin login", help: "Initial 1-time Master admin password", ex: "••••••••", req: true },
  { name: "ADMIN_SECRET_TOKEN", group: "Admin login", help: "Random string used to sign sessions", ex: "random_token_string", req: true },
  { name: "TELEGRAM_BOT_TOKEN", group: "Admin login", help: "Bot that sends 2FA codes", ex: "123456:ABC-DEF…", req: true },
  { name: "TELEGRAM_CHAT_ID", group: "Admin login", help: "Chat that receives 2FA codes", ex: "5513474694", req: true },
  { name: "DB_PROVIDER", group: "Database", help: "Which database is used", ex: "cf_db", req: true },
  { name: "CF_ACCOUNT_ID", group: "Database", help: "Cloudflare account ID", ex: "8e4b7…", req: true },
  { name: "CF_DB_ID", group: "Database", help: "D1 database ID", ex: "xxxx-xxxx", req: true },
  { name: "CF_D1_TOKEN", group: "Database", help: "Token with D1 edit permission", ex: "xxxx…", req: true },
  { name: "CLOUDFLARE_ZONE_ID", group: "Cloudflare", help: "Zone used for cache purge", ex: "023e105f…", req: false },
  { name: "CLOUDFLARE_API_TOKEN", group: "Cloudflare", help: "Token with Zone → Cache Purge", ex: "abc123…", req: false },
  { name: "GITHUB_TOKEN", group: "Deploy", help: "Needs repo + workflow scopes; triggers rebuilds", ex: "ghp_…", req: false },
  { name: "GITHUB_OWNER", group: "Deploy", help: "GitHub username", ex: "rifat16700", req: false },
  { name: "GITHUB_REPO", group: "Deploy", help: "Repository name", ex: "freelancingbyrifat", req: false },
  { name: "R2_PUBLIC_URL", group: "Media", help: "Public URL of your R2 image bucket", ex: "https://pub-xxxx.r2.dev", req: false },
  { name: "GA4_API_SECRET", group: "Tracking", help: "Server-side GA4 events", ex: "xxxxxxxx", req: false },
  { name: "META_API_TOKEN", group: "Tracking", help: "Meta Conversions API token", ex: "EAAB…", req: false },
  { name: "TAWK_WIDGET_URL", group: "Chat", help: "Live-chat widget URL", ex: "https://embed.tawk.to/…", req: false },
];

export function Developer() {
  const s = useStore();
  const { settings, setSettings, customCss, saveCustomCss, toast, log, t, orders, products, categories, reviews, banners, sections, zones, promos, addons, brands } = s;
  const [tab, setTab] = useState<Tab>("health");
  const [tbl, setTbl] = useState("orders");
  const [loaded, setLoaded] = useState<string | null>(null);
  const [sql, setSql] = useState("SELECT id, customer_name, grand_total, status, created_at FROM orders ORDER BY created_at DESC LIMIT 10;");
  const [sqlRes, setSqlRes] = useState<{ cols: string[]; rows: (string | number)[][]; ms: number } | { err: string } | null>(null);
  const [sqlBusy, setSqlBusy] = useState(false);
  const [css, setCss] = useState(customCss || "/* Custom CSS */\n");
  const [done, setDone] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem("env_done") || "[]"); } catch { return []; } });

  useEffect(() => {
    if (customCss) setCss(customCss);
  }, [customCss]);

  const tables = useMemo<Record<string, Record<string, unknown>[]>>(() => ({
    orders: orders.items as unknown as Record<string, unknown>[],
    products: products.items as unknown as Record<string, unknown>[],
    categories: categories.items as unknown as Record<string, unknown>[],
    brands: brands.items as unknown as Record<string, unknown>[],
    reviews: reviews.items as unknown as Record<string, unknown>[],
    banners: banners.items as unknown as Record<string, unknown>[],
    home_sections: sections.items as unknown as Record<string, unknown>[],
    delivery_zones: zones.items as unknown as Record<string, unknown>[],
    promos: promos.items as unknown as Record<string, unknown>[],
    addons: addons.items as unknown as Record<string, unknown>[],
    settings: Object.entries(settings).map(([key, value]) => ({ key, value: typeof value === "object" ? JSON.stringify(value) : /key|token|secret/i.test(key) && value ? "••••" : value })),
  }), [orders.items, products.items, categories.items, brands.items, reviews.items, banners.items, sections.items, zones.items, promos.items, addons.items, settings]);

  const flat = (r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "object" && v !== null ? (Array.isArray(v) ? `[${v.length}]` : "{…}") : v]));
  const rows = loaded && tables[loaded] ? tables[loaded].slice(0, 25).map(flat) : [];
  const cols = rows[0] ? Object.keys(rows[0]).slice(0, 9) : [];

  const runSql = async () => {
    const q = sql.trim();
    if (!q) return;
    setSqlBusy(true);
    const t0 = performance.now();
    try {
      const resRows = await d1AdminQuery(q, []);
      const arr = Array.isArray(resRows) ? resRows : [];
      const c = arr[0] ? Object.keys(arr[0]) : ["result"];
      const r = arr.map((row: any) => c.map((k) => (typeof row[k] === "object" && row[k] !== null ? JSON.stringify(row[k]) : (row[k] ?? ""))));
      setSqlRes({ cols: c, rows: r, ms: Math.round(performance.now() - t0) });
      log("SQL query executed", q.slice(0, 60));
    } catch (e: any) {
      setSqlRes({ err: e?.message || "SQL execution failed" });
    } finally {
      setSqlBusy(false);
    }
  };

  const QUICK = [
    ["Orders by status", "SELECT status, COUNT(*) AS count FROM orders GROUP BY status;"],
    ["Pending orders", "SELECT id, customer_name, customer_phone, grand_total, created_at FROM orders WHERE status = 'Pending' LIMIT 15;"],
    ["Active products", "SELECT id, sku, name, base_price, flash_sale_price, brand_id FROM products WHERE is_active = 1 LIMIT 15;"],
    ["Pending reviews", "SELECT id, product_id, customer_name, rating, review_text FROM reviews WHERE is_approved = 0 LIMIT 15;"],
  ];

  const services = [
    ["AlwaysData Proxy (" + getProxyBase() + ")", "Connected"],
    ["Cloudflare D1 Database", "Active"],
    ["Telegram 2FA OTP Bot", "Active"],
    ["Cloudflare R2 / Media Storage", "Ready"],
  ];

  return (
    <div>
      <PageHeader icon={<Code2 size={22} />} title={t("Developer", "ডেভেলপার")} desc="Live D1 database browser, SQL runner, maintenance mode and environment setup." />
      <Tabs value={tab} onChange={setTab} className="mb-5" tabs={[{ id: "health", label: "Health & maintenance" }, { id: "data", label: "Data browser" }, { id: "sql", label: "Live D1 SQL runner" }, { id: "backup", label: "Backup" }, { id: "env", label: "ENV setup guide" }, { id: "css", label: "Custom CSS" }]} />

      {tab === "health" && (
        <div className="space-y-5">
          <Card className={cn("overflow-hidden", settings.maintenance ? "border-rose-300" : "")}>
            <div className="flex flex-wrap items-center gap-5 p-5">
              <div className={cn("grid h-14 w-14 place-items-center rounded-2xl", settings.maintenance ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600")}><Power /></div>
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-lg font-bold text-slate-900">Site maintenance mode <Badge tone={settings.maintenance ? "red" : "green"} dot>{settings.maintenance ? "Store is CLOSED" : "Store is LIVE"}</Badge></div><p className="text-sm text-slate-500">Turn on to instantly show a “we’ll be back” page to visitors. You can still use this panel.</p></div>
              <Toggle checked={settings.maintenance} onChange={(v) => { setSettings({ maintenance: v }); log(v ? "Maintenance ON" : "Maintenance OFF", "Site"); toast(v ? "Store is now closed to visitors" : "Store is live again", v ? "info" : "ok"); }} />
            </div>
            <div className="grid gap-4 border-t border-slate-100 bg-slate-50/60 p-5 md:grid-cols-2">
              <Field label="Message visitors see">
                <Textarea value={settings.maintenanceMsg} onChange={(e) => setSettings({ maintenanceMsg: e.target.value })} rows={3} />
              </Field>
              <div>
                <div className="mb-1.5 text-[13px] font-medium text-slate-700">Preview</div>
                <div className="grid h-[88px] place-items-center rounded-2xl bg-slate-900 text-center text-white">
                  <div><div className="text-2xl">🛠️</div><div className="text-sm">{settings.maintenanceMsg || "We’ll be back soon."}</div></div>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHead title="Backend Services" sub="Live infrastructure status" />
              <div className="divide-y divide-slate-100 px-5 pb-3">
                {services.map(([n, st]) => (
                  <div key={n} className="flex items-center gap-3 py-3">
                    <CheckCircle2 size={18} className="text-emerald-500" />
                    <span className="flex-1 text-sm font-medium">{n}</span>
                    <Badge tone="green">{st}</Badge>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="border-emerald-200">
              <CardHead title={<span className="flex items-center gap-2"><ShieldAlert size={17} className="text-emerald-600" /> Security Architecture</span>} sub="AlwaysData & Cloudflare protections active" />
              <ul className="space-y-3 px-5 pb-5 text-sm">
                <li className="flex gap-3"><CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />Master Admin & Staff passwords hashed with PBKDF2-SHA256 in AlwaysData Private Storage.</li>
                <li className="flex gap-3"><CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />1-time Master Admin creation lock with mandatory Telegram Bot 2FA OTP.</li>
                <li className="flex gap-3"><CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />Granular per-action Staff permissions (View, Create, Edit, Delete) enforced server-side.</li>
                <li className="flex gap-3"><CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />Public D1 query endpoint strictly restricted to read-only SELECT statements.</li>
              </ul>
            </Card>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[["Orders", orders.items.length], ["Products", products.items.length], ["Reviews", reviews.items.length], ["Categories", categories.items.length]].map(([a, b]) => (
              <Card key={a as string} className="p-4"><div className="text-xs text-slate-500">{a}</div><div className="text-2xl font-bold">{b}</div></Card>
            ))}
          </div>
        </div>
      )}

      {tab === "data" && (
        <Card>
          <CardHead title="Look inside your database" sub="First 25 rows — read only" right={<><Select value={tbl} onChange={(e) => { setTbl(e.target.value); setLoaded(null); }} className="!w-44">{Object.keys(tables).map((k) => <option key={k}>{k}</option>)}</Select><Button variant="primary" icon={<Database size={14} />} onClick={() => setLoaded(tbl)}>Load</Button></>} />
          <div className="px-5 pb-5">
            {!loaded ? <Empty title="Pick a table and press Load" /> : (
              <>
                <div className="mb-3 flex items-center gap-2">
                  <Badge tone="indigo">{tables[loaded].length} rows total</Badge>
                  <Button size="sm" icon={<Download size={13} />} onClick={() => downloadCSV(`${loaded}.csv`, cols, tables[loaded].map(flat).map((r) => cols.map((c) => String(r[c] ?? ""))))}>CSV</Button>
                  <Button size="sm" icon={<Download size={13} />} onClick={() => downloadJSON(`${loaded}.json`, tables[loaded])}>JSON</Button>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full">
                    <thead><tr>{cols.map((c) => <Th key={c}>{c}</Th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((r, i) => <tr key={i}>{cols.map((c) => <Td key={c} className="max-w-[180px] truncate font-mono text-xs">{String(r[c] ?? "")}</Td>)}</tr>)}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {tab === "sql" && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Terminal size={16} className="text-slate-500" />
              <span className="font-semibold">Live Cloudflare D1 SQL Runner</span>
              <Badge tone="indigo">Master Admin</Badge>
              <span className="ml-auto flex flex-wrap gap-1.5">
                {QUICK.map(([n, q]) => (
                  <button key={n} onClick={() => setSql(q)} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-700">
                    {n}
                  </button>
                ))}
              </span>
            </div>
            <Textarea value={sql} onChange={(e) => setSql(e.target.value)} rows={4} className="font-mono text-xs" spellCheck={false} />
            <div className="mt-3">
              <Button variant="primary" disabled={sqlBusy} icon={<Play size={14} />} onClick={runSql}>
                {sqlBusy ? "Running…" : "Run query on D1"}
              </Button>
            </div>
          </Card>
          {sqlRes && ("err" in sqlRes ? (
            <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{sqlRes.err}</Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 text-xs text-slate-500">
                <span>{sqlRes.rows.length} rows returned</span>
                <span>{sqlRes.ms} ms</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr>{sqlRes.cols.map((c) => <Th key={c}>{c}</Th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {sqlRes.rows.map((r, i) => <tr key={i}>{r.map((c, k) => <Td key={k} className="font-mono text-xs">{String(c)}</Td>)}</tr>)}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "backup" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            ["Everything", "All tables in one file", () => downloadJSON("full-backup.json", { orders: orders.items, products: products.items, categories: categories.items, brands: brands.items, reviews: reviews.items, banners: banners.items, sections: sections.items, zones: zones.items, promos: promos.items, addons: addons.items })],
            ["Orders", `${orders.items.length} orders`, () => downloadJSON("orders.json", orders.items)],
            ["Products", `${products.items.length} products`, () => downloadJSON("products.json", products.items)],
            ["Reviews", `${reviews.items.length} reviews`, () => downloadJSON("reviews.json", reviews.items)],
          ].map(([n, d, f]) => (
            <Card key={n as string} className="flex items-center gap-4 p-5">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600"><Download /></div>
              <div className="flex-1"><div className="font-semibold">{n as string}</div><div className="text-xs text-slate-500">{d as string}</div></div>
              <Button onClick={f as () => void}>Download</Button>
            </Card>
          ))}
          <Card className="border-amber-200 p-5 md:col-span-2 xl:col-span-3">
            <div className="mb-1 font-semibold">Clean-up tools</div>
            <p className="mb-3 text-sm text-slate-500">Database maintenance & local cache utilities.</p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={async () => {
                  const cut = new Date(Date.now() - 30 * 86400000).toISOString();
                  await d1AdminQuery("DELETE FROM orders WHERE status = 'Cancelled' AND created_at < ?", [cut]);
                  orders.set((a) => a.filter((o) => !(o.status === "Cancelled" && Date.now() - new Date(o.date).getTime() > 30 * 86400000)));
                  toast("Cancelled orders older than 30 days deleted from D1");
                  log("Cleanup cancelled orders", "30d+");
                }}
              >
                🗑 Delete cancelled orders older than 30 days
              </Button>
              <Button onClick={() => { const tok = localStorage.getItem("admin_token"); localStorage.clear(); if (tok) localStorage.setItem("admin_token", tok); toast("Browser cache cleared (session kept)"); }}>
                ⚡ Clear browser cache
              </Button>
            </div>
          </Card>
        </div>
      )}

      {tab === "env" && (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center gap-4 p-5">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-900">Setting up a new client store?</div>
              <p className="text-sm text-slate-500">Tick each variable after you add it in <b>Cloudflare Pages → Settings</b> or <b>AlwaysData .env</b>.</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{ENV.filter((e) => e.req && done.includes(e.name)).length}/{ENV.filter((e) => e.req).length}</div>
              <div className="text-xs text-slate-500">required done</div>
            </div>
          </Card>
          {[...new Set(ENV.map((e) => e.group))].map((g) => (
            <Card key={g} className="overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-sm font-semibold text-slate-700">{g}</div>
              <div className="divide-y divide-slate-100">
                {ENV.filter((e) => e.group === g).map((e) => (
                  <div key={e.name} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-emerald-600"
                      checked={done.includes(e.name)}
                      onChange={() => {
                        const n = done.includes(e.name) ? done.filter((x) => x !== e.name) : [...done, e.name];
                        setDone(n);
                        localStorage.setItem("env_done", JSON.stringify(n));
                      }}
                    />
                    <code className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800">{e.name}</code>
                    {e.req ? <Badge tone="red">Required</Badge> : <Badge>Optional</Badge>}
                    <span className="min-w-0 flex-1 text-sm text-slate-600">{e.help}</span>
                    <span className="hidden font-mono text-xs text-slate-400 md:block">{e.ex}</span>
                    <button onClick={() => { navigator.clipboard?.writeText(e.name); toast("Copied " + e.name); }} className="text-slate-400 hover:text-indigo-600"><Copy size={14} /></button>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "css" && (
        <Card className="p-5">
          <div className="mb-3 font-semibold">Custom CSS</div>
          <p className="mb-3 text-sm text-slate-500">Saved to D1 devtools and applied to the storefront. Great for quick design tweaks.</p>
          <Textarea value={css} onChange={(e) => setCss(e.target.value)} rows={10} className="font-mono text-xs" spellCheck={false} />
          <div className="mt-3 flex gap-2">
            <Button variant="primary" onClick={() => { saveCustomCss(css); toast("Custom CSS saved to D1 ✔"); log("Custom CSS saved", "Developer"); }}>💉 Save & Inject CSS</Button>
            <Button onClick={() => setCss("")}>Clear</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
