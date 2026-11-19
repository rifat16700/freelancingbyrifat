import type { Addon, Banner, Customer, Order, Product, Promo, Review, Zone } from "../types";
import { dateShort, isValid, localDay, money, moneyShort, num, pct } from "./format";

const DAY = 86400000;
export const FMT = {
  money: (n: number) => money(n),
  num: (n: number) => num(n),
  pct: (n: number) => pct(n),
  dec: (n: number) => n.toFixed(1),
  days: (n: number) => n.toFixed(1) + "d",
  star: (n: number) => n.toFixed(2) + " ★",
};
export type FmtKey = keyof typeof FMT;
export const chartMoney = (n: number) => moneyShort(n);

export interface Ctx {
  orders: Order[];
  prev: Order[];
  valid: Order[];
  prevValid: Order[];
  products: Product[];
  prodMap: Map<string, Product>;
  reviews: Review[];
  promos: Promo[];
  banners: Banner[];
  addons: Addon[];
  zones: Zone[];
  customers: Customer[];
  days: number;
  from: Date;
  lowLimit: number;
  catName: (id: string) => string;
  brandName: (id: string) => string;
}

export type Row = { label: string; value: number; hint?: string };
export type Result =
  | { type: "kpi"; value: string; sub?: string; delta?: number; goodUp?: boolean; spark?: number[] }
  | { type: "bars"; rows: Row[]; fmt: FmtKey; color?: string }
  | { type: "cols"; rows: Row[]; fmt: FmtKey; color?: string; highlight?: boolean }
  | { type: "line"; points: { x: string; y: number }[]; fmt: FmtKey; color?: string }
  | { type: "donut"; rows: Row[]; fmt: FmtKey; colors?: string[] }
  | { type: "table"; cols: string[]; rows: (string | number)[][] }
  | { type: "heat"; matrix: number[][] }
  | { type: "funnel"; rows: Row[]; fmt: FmtKey };

export const GROUPS = ["Sales", "Orders", "Customers", "Products", "Payments", "Location", "Marketing", "Reviews", "Time"] as const;
export type Group = (typeof GROUPS)[number];
export interface Insight { id: string; group: Group; title: string; why: string; wide?: boolean; run: (c: Ctx) => Result }

// ---------------- helpers ----------------
const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);
const rev = (os: Order[]) => sum(os, (o) => o.grand);
const change = (cur: number, prev: number) => (prev ? ((cur - prev) / prev) * 100 : cur ? 100 : 0);
const ratio = (a: number, b: number) => (b ? (a / b) * 100 : 0);
function group<T>(a: T[], key: (x: T) => string | string[]) {
  const m = new Map<string, T[]>();
  a.forEach((x) => {
    const ks = key(x);
    (Array.isArray(ks) ? ks : [ks]).forEach((k) => {
      const l = m.get(k) || [];
      l.push(x);
      m.set(k, l);
    });
  });
  return m;
}
const rowsOf = <T,>(m: Map<string, T[]>, val: (l: T[], k: string) => number, hint?: (l: T[], k: string) => string): Row[] =>
  [...m.entries()].map(([k, l]) => ({ label: k, value: val(l, k), hint: hint?.(l, k) })).sort((a, b) => b.value - a.value);
interface Line { o: Order; productId: string; name: string; qty: number; price: number; color: string; size: string; total: number; cost: number; p?: Product }
const lines = (c: Ctx, os: Order[]): Line[] =>
  os.flatMap((o) => o.items.map((it) => { const p = c.prodMap.get(it.productId); return { o, ...it, total: it.price * it.qty, cost: (p?.cost || 0) * it.qty, p }; }));
function daily(c: Ctx, os: Order[], f: (l: Order[]) => number) {
  const m = group(os, (o) => localDay(new Date(o.date)));
  return Array.from({ length: c.days }, (_, i) => {
    const d = new Date(c.from.getTime() + i * DAY);
    return { x: dateShort(d.toISOString()), y: f(m.get(localDay(d)) || []) };
  });
}
const kpi = (value: string, sub?: string, delta?: number, goodUp = true, spark?: number[]): Result => ({ type: "kpi", value, sub, delta, goodUp, spark });
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const wk = (iso: string) => {
  const d = new Date(iso);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return dateShort(d.toISOString());
};
const mon = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
const bucket = (v: number, edges: number[], labels: string[]) => labels[Math.max(0, edges.findIndex((e) => v < e) === -1 ? labels.length - 1 : edges.findIndex((e) => v < e))];
const avgOf = (a: number[]) => (a.length ? sum(a, (x) => x) / a.length : 0);

// ---------------- the registry ----------------
const L: Insight[] = [];
const I = (id: string, g: Group, title: string, why: string, run: (c: Ctx) => Result, wide = false) => L.push({ id, group: g, title, why, run, wide });

// SALES
I("rev_total", "Sales", "Total revenue", "Money from all non-cancelled orders. Your headline number.", (c) => kpi(money(rev(c.valid)), "vs previous period", change(rev(c.valid), rev(c.prevValid)), true, daily(c, c.valid, rev).map((p) => p.y)));
I("ord_total", "Sales", "Orders received", "Valid orders (cancelled and failed payments removed).", (c) => kpi(num(c.valid.length), "vs previous period", change(c.valid.length, c.prevValid.length), true, daily(c, c.valid, (l) => l.length).map((p) => p.y)));
I("aov", "Sales", "Average order value", "Revenue ÷ orders. Raise it with bundles, free-shipping thresholds and add-ons.", (c) => kpi(money(avgOf(c.valid.map((o) => o.grand))), "vs previous period", change(avgOf(c.valid.map((o) => o.grand)), avgOf(c.prevValid.map((o) => o.grand)))));
I("units", "Sales", "Items sold", "Total quantity of products shipped out.", (c) => kpi(num(sum(c.valid, (o) => sum(o.items, (i) => i.qty))), "units", change(sum(c.valid, (o) => sum(o.items, (i) => i.qty)), sum(c.prevValid, (o) => sum(o.items, (i) => i.qty)))));
I("profit", "Sales", "Estimated gross profit", "Item sales minus product cost. Does not include ads or salaries.", (c) => { const l = lines(c, c.valid); const s = sum(l, (x) => x.total), p = s - sum(l, (x) => x.cost); return kpi(money(p), `${pct(ratio(p, s))} margin`); });
I("rev_daily", "Sales", "Daily average revenue", "Average revenue per day in this period.", (c) => kpi(money(rev(c.valid) / c.days), "per day"));
I("run_rate", "Sales", "30-day forecast", "If the last 7 days continue, this is what you’ll make in 30 days. Use it for cash planning.", (c) => { const cut = Date.now() - 7 * DAY; const r = sum(c.valid.filter((o) => new Date(o.date).getTime() >= cut), (o) => o.grand); return kpi(money((r / 7) * 30), "based on last 7 days"); });
I("rev_trend", "Sales", "Revenue trend (daily)", "Spot spikes (campaigns) and drops (stock-outs, site problems).", (c) => ({ type: "line", points: daily(c, c.valid, rev), fmt: "money" }), true);
I("rev_week", "Sales", "Revenue by week", "Smooths daily noise so you can see real growth.", (c) => ({ type: "cols", rows: [...group(c.valid, (o) => wk(o.date)).entries()].map(([label, l]) => ({ label, value: rev(l) })), fmt: "money" }));
I("rev_month", "Sales", "Revenue by month", "Month-over-month growth at a glance.", (c) => ({ type: "cols", rows: [...group(c.valid, (o) => mon(o.date)).entries()].map(([label, l]) => ({ label, value: rev(l) })), fmt: "money", color: "#10b981" }));
I("best_days", "Sales", "Top 5 best days", "Learn what you did on your best days and repeat it.", (c) => ({ type: "table", cols: ["Date", "Orders", "Revenue"], rows: daily(c, c.valid, rev).map((p, i) => ({ p, i })).sort((a, b) => b.p.y - a.p.y).slice(0, 5).map(({ p }) => [p.x, c.valid.filter((o) => dateShort(o.date) === p.x).length, money(p.y)]) }));
I("rev_brand", "Sales", "Revenue by brand", "Which storefront pays the bills.", (c) => ({ type: "donut", rows: rowsOf(group(c.valid, (o) => c.brandName(o.brandId)), (l) => rev(l)), fmt: "money" }));
I("rev_cat", "Sales", "Revenue by category", "Double down on categories that earn the most.", (c) => ({ type: "bars", rows: rowsOf(group(lines(c, c.valid), (l) => (l.p ? l.p.catIds.map(c.catName) : ["?"])), (l) => sum(l, (x) => x.total)), fmt: "money" }));
I("aov_dist", "Sales", "Order size distribution", "Most orders fall in which price band? Set free-shipping just above it.", (c) => { const e = [1000, 2000, 3500, 5000]; const lb = ["< ৳1k", "৳1–2k", "৳2–3.5k", "৳3.5–5k", "৳5k+"]; const m = new Map(lb.map((l) => [l, 0])); c.valid.forEach((o) => { const k = bucket(o.grand, e, lb); m.set(k, (m.get(k) || 0) + 1); }); return { type: "cols", rows: [...m].map(([label, value]) => ({ label, value })), fmt: "num", color: "#8b5cf6" }; });
I("rev_type", "Sales", "Delivery vs pickup revenue", "Is pickup from your shop worth keeping?", (c) => ({ type: "donut", rows: rowsOf(group(c.valid, (o) => (o.type === "pickup" ? "Store pickup" : "Home delivery")), (l) => rev(l)), fmt: "money" }));

// ORDERS
I("status_mix", "Orders", "Order status mix", "Too many Pending = slow confirmation. Too many Cancelled = a problem to fix.", (c) => ({ type: "donut", rows: rowsOf(group(c.orders, (o) => (o.failed ? "Payment failed" : o.status)), (l) => l.length), fmt: "num", colors: ["#10b981", "#f43f5e", "#6366f1", "#f59e0b", "#0ea5e9", "#8b5cf6", "#94a3b8"] }));
I("cancel_rate", "Orders", "Cancellation rate", "Healthy shops stay under 10%. Over 15% means call confirmation or address quality problems.", (c) => { const a = c.orders.filter((o) => !o.failed); const p = c.prev.filter((o) => !o.failed); const r = ratio(a.filter((o) => o.status === "Cancelled").length, a.length); const pr = ratio(p.filter((o) => o.status === "Cancelled").length, p.length); return kpi(pct(r), `${a.filter((o) => o.status === "Cancelled").length} cancelled`, change(r, pr), false); });
I("cancel_reasons", "Orders", "Why orders get cancelled", "Fix the biggest reason first.", (c) => ({ type: "bars", rows: rowsOf(group(c.orders.filter((o) => o.cancelReason), (o) => o.cancelReason!), (l) => l.length), fmt: "num", color: "#f43f5e" }));
I("avg_delivery", "Orders", "Average delivery time", "Customers expect 1–3 days in Dhaka. Slow delivery = bad reviews.", (c) => { const d = c.orders.filter((o) => o.deliveryDays).map((o) => o.deliveryDays!); return kpi(avgOf(d).toFixed(1) + " days", `${d.length} delivered`, undefined, false); });
I("delivery_dist", "Orders", "Delivery time spread", "How many orders arrive in 1, 2, 3… days.", (c) => { const m = new Map<string, number>(["1", "2", "3", "4", "5", "6+"].map((k) => [k, 0])); c.orders.filter((o) => o.deliveryDays).forEach((o) => { const k = o.deliveryDays! >= 6 ? "6+" : String(o.deliveryDays); m.set(k, (m.get(k) || 0) + 1); }); return { type: "cols", rows: [...m].map(([label, value]) => ({ label: label + "d", value })), fmt: "num", color: "#0ea5e9" }; });
I("stuck_pending", "Orders", "Pending for over 24h", "Slow confirmation loses customers. Call these first.", (c) => { const n = c.orders.filter((o) => o.status === "Pending" && !o.failed && Date.now() - new Date(o.date).getTime() > DAY).length; return kpi(num(n), n ? "needs action now" : "all clear ✔", undefined, false); });
I("fulfil_funnel", "Orders", "Fulfilment funnel", "Where orders drop off between placing and delivery.", (c) => { const a = c.orders.filter((o) => !o.failed); return { type: "funnel", fmt: "num", rows: [{ label: "Placed", value: a.length }, { label: "Confirmed+", value: a.filter((o) => o.status !== "Pending" && o.status !== "Cancelled").length }, { label: "Shipped+", value: a.filter((o) => o.status === "Shipped" || o.status === "Delivered").length }, { label: "Delivered", value: a.filter((o) => o.status === "Delivered").length }] }; });
I("items_per_order", "Orders", "Items per order", "Mostly 1 item? Try bundles and “frequently bought together”.", (c) => { const m = new Map([["1", 0], ["2", 0], ["3", 0], ["4+", 0]]); c.valid.forEach((o) => { const q = sum(o.items, (i) => i.qty); const k = q >= 4 ? "4+" : String(q); m.set(k, (m.get(k) || 0) + 1); }); return { type: "cols", rows: [...m].map(([label, value]) => ({ label: label + " item" + (label === "1" ? "" : "s"), value })), fmt: "num", color: "#14b8a6" }; });
I("failed_gateway", "Orders", "Failed online payments", "Customers who tried to pay online but didn’t finish — follow up by phone.", (c) => { const f = c.orders.filter((o) => o.failed); return kpi(num(f.length), `${money(rev(f))} lost value`, undefined, false); });
I("pickup_share", "Orders", "Store pickup share", "Share of orders collected from your shop.", (c) => kpi(pct(ratio(c.valid.filter((o) => o.type === "pickup").length, c.valid.length)), `${c.valid.filter((o) => o.type === "pickup").length} orders`));
I("orders_trend", "Orders", "Orders per day", "Order flow over time.", (c) => ({ type: "line", points: daily(c, c.valid, (l) => l.length), fmt: "num", color: "#10b981" }), true);

// CUSTOMERS
I("cust_unique", "Customers", "Unique customers", "Distinct phone numbers who ordered.", (c) => kpi(num(new Set(c.valid.map((o) => o.customerPhone)).size), "buyers", change(new Set(c.valid.map((o) => o.customerPhone)).size, new Set(c.prevValid.map((o) => o.customerPhone)).size)));
I("new_vs_repeat", "Customers", "New vs returning buyers", "Returning buyers cost nothing to acquire — grow this share.", (c) => ({ type: "donut", rows: rowsOf(group(c.valid, (o) => (o.isRepeat ? "Returning" : "New")), (l) => l.length), fmt: "num", colors: ["#6366f1", "#10b981"] }));
I("repeat_rate", "Customers", "Repeat order rate", "Share of orders from people who bought before.", (c) => kpi(pct(ratio(c.valid.filter((o) => o.isRepeat).length, c.valid.length)), "good shops reach 25%+"));
I("top_customers", "Customers", "Top customers by spend", "Your VIPs — thank them personally.", (c) => ({ type: "table", cols: ["Customer", "Orders", "Spent"], rows: rowsOf(group(c.valid, (o) => o.customerPhone + "|" + o.customerName), (l) => rev(l)).slice(0, 8).map((r) => [r.label.split("|")[1] + " · " + r.label.split("|")[0].slice(-4).padStart(7, "•"), c.valid.filter((o) => o.customerPhone === r.label.split("|")[0]).length, money(r.value)]) }));
I("clv", "Customers", "Average lifetime value", "How much one customer is worth over time.", (c) => kpi(money(avgOf(c.customers.map((x) => x.spent))), "per customer (all time)"));
I("orders_per_cust", "Customers", "Orders per customer", "How loyal is your base?", (c) => { const m = new Map([["1", 0], ["2", 0], ["3", 0], ["4+", 0]]); c.customers.forEach((x) => { const n = x.valid.length; const k = n >= 4 ? "4+" : String(Math.max(1, n)); m.set(k, (m.get(k) || 0) + 1); }); return { type: "cols", rows: [...m].map(([label, value]) => ({ label: label + " order" + (label === "1" ? "" : "s"), value })), fmt: "num", color: "#ec4899" }; });
I("segments", "Customers", "Customer segments", "VIP · Loyal · New · At risk · Regular — each needs a different message.", (c) => ({ type: "donut", rows: rowsOf(group(c.customers, (x) => x.segment), (l) => l.length), fmt: "num", colors: ["#f59e0b", "#10b981", "#0ea5e9", "#f43f5e", "#94a3b8"] }));
I("cust_division", "Customers", "Customers by division", "Where your buyers live.", (c) => ({ type: "bars", rows: rowsOf(group(c.valid, (o) => o.division), (l) => new Set(l.map((o) => o.customerPhone)).size), fmt: "num", color: "#0ea5e9" }));
I("new_cust_trend", "Customers", "New customers per day", "Acquisition speed.", (c) => ({ type: "line", points: daily(c, c.valid.filter((o) => !o.isRepeat), (l) => l.length), fmt: "num", color: "#ec4899" }));
I("repeat_eligible", "Customers", "Repeat-coupon eligible", "Customers delivered in the last 30 days who can use their personal coupon.", (c) => kpi(num(new Set(c.valid.filter((o) => o.status === "Delivered" && Date.now() - new Date(o.date).getTime() < 30 * DAY).map((o) => o.customerPhone)).size), "customers (last 30d)"));
I("email_rate", "Customers", "Email capture rate", "Customers with an email — useful for newsletters.", (c) => kpi(pct(ratio(c.customers.filter((x) => x.email).length, c.customers.length)), `${c.customers.filter((x) => x.email).length} of ${c.customers.length}`));
I("at_risk", "Customers", "Win-back list (at risk)", "Loyal customers who haven’t ordered in 60+ days. Send an offer.", (c) => ({ type: "table", cols: ["Customer", "Orders", "Last order", "Spent"], rows: c.customers.filter((x) => x.segment === "At risk").slice(0, 7).map((x) => [x.name, x.valid.length, dateShort(x.last), money(x.spent)]) }));

// PRODUCTS
I("top_units", "Products", "Best sellers (units)", "Keep these always in stock.", (c) => ({ type: "bars", rows: rowsOf(group(lines(c, c.valid), (l) => l.name), (l) => sum(l, (x) => x.qty)), fmt: "num" }));
I("top_rev", "Products", "Best sellers (revenue)", "Products that bring the most money.", (c) => ({ type: "bars", rows: rowsOf(group(lines(c, c.valid), (l) => l.name), (l) => sum(l, (x) => x.total)), fmt: "money", color: "#10b981" }));
I("top_margin", "Products", "Most profitable products", "Profit matters more than sales. Push these in ads.", (c) => ({ type: "table", cols: ["Product", "Profit", "Margin"], rows: rowsOf(group(lines(c, c.valid), (l) => l.name), (l) => sum(l, (x) => x.total - x.cost), (l) => pct(ratio(sum(l, (x) => x.total - x.cost), sum(l, (x) => x.total)), 0)).slice(0, 7).map((r) => [r.label, money(r.value), r.hint || ""]) }));
I("slow_movers", "Products", "Zero sales (slow movers)", "Active products with no sale in this period — discount, bundle or hide.", (c) => { const sold = new Set(lines(c, c.valid).map((l) => l.productId)); return { type: "table", cols: ["Product", "Price", "Stock"], rows: c.products.filter((p) => p.active && !sold.has(p.id)).slice(0, 8).map((p) => [p.name, money(p.price), sum(p.variants, (v) => sum(Object.values(v.sizes), (x) => x))]) }; });
I("low_stock", "Products", "Low stock alerts", "Variants about to run out. Reorder before you lose sales.", (c) => ({ type: "table", cols: ["Product", "Variant", "Left"], rows: c.products.filter((p) => p.active).flatMap((p) => p.variants.flatMap((v) => Object.entries(v.sizes).filter(([, q]) => q <= c.lowLimit).map(([s, q]) => [p.name, `${v.color} / ${s}`, q] as (string | number)[]))).sort((a, b) => Number(a[2]) - Number(b[2])).slice(0, 8) }));
I("stock_value", "Products", "Stock value (at cost)", "Cash sitting in your shelves.", (c) => kpi(money(sum(c.products, (p) => p.cost * sum(p.variants, (v) => sum(Object.values(v.sizes), (x) => x)))), "inventory at cost price"));
I("flash_share", "Products", "Flash-sale revenue share", "How much comes from discounted items.", (c) => { const l = lines(c, c.valid); const f = l.filter((x) => x.p && x.price < x.p.price); return kpi(pct(ratio(sum(f, (x) => x.total), sum(l, (x) => x.total))), `${num(sum(f, (x) => x.qty))} units on flash price`); });
I("prod_conv", "Products", "View → order conversion", "High views but low orders = fix price, photos or description.", (c) => { const sold = group(lines(c, c.valid), (l) => l.productId); const f = c.days / 180; return { type: "table", cols: ["Product", "Est. views", "Units", "Conv."], rows: c.products.filter((p) => p.active).map((p) => { const u = sum(sold.get(p.id) || [], (x) => x.qty); const v = Math.round(p.views * f); return { p, u, v, cv: ratio(u, v) }; }).sort((a, b) => b.v - a.v).slice(0, 8).map((x) => [x.p.name, num(x.v), x.u, pct(x.cv)]) }; });
I("color_pop", "Products", "Popular colours", "Stock more of the colours people actually pick.", (c) => ({ type: "bars", rows: rowsOf(group(lines(c, c.valid), (l) => l.color), (l) => sum(l, (x) => x.qty)), fmt: "num", color: "#f97316" }));
I("size_pop", "Products", "Popular sizes (apparel)", "Size curve for your next purchase order.", (c) => ({ type: "cols", rows: ["S", "M", "L", "XL", "XXL"].map((s) => ({ label: s, value: sum(lines(c, c.valid).filter((l) => l.size === s), (x) => x.qty) })), fmt: "num", color: "#14b8a6" }));
I("price_band", "Products", "Units by price band", "Which price range sells best.", (c) => { const e = [1000, 2000, 3500]; const lb = ["< ৳1k", "৳1–2k", "৳2–3.5k", "৳3.5k+"]; const m = new Map(lb.map((l) => [l, 0])); lines(c, c.valid).forEach((x) => { const k = bucket(x.price, e, lb); m.set(k, (m.get(k) || 0) + x.qty); }); return { type: "cols", rows: [...m].map(([label, value]) => ({ label, value })), fmt: "num", color: "#84cc16" }; });
I("catalog_status", "Products", "Catalogue health", "Active vs hidden products.", (c) => ({ type: "donut", rows: [{ label: "Active", value: c.products.filter((p) => p.active).length }, { label: "Hidden", value: c.products.filter((p) => !p.active).length }], fmt: "num", colors: ["#10b981", "#94a3b8"] }));
I("addonce_attach", "Products", "Add-once attach rate", "Share of orders including an add-once (impulse) product.", (c) => { const ids = new Set(c.products.filter((p) => p.addOnce).map((p) => p.id)); return kpi(pct(ratio(c.valid.filter((o) => o.items.some((i) => ids.has(i.productId))).length, c.valid.length)), "of orders"); });

// PAYMENTS
I("pay_share", "Payments", "Payment methods", "COD-heavy? Offer a small discount for prepaid to cut returns.", (c) => ({ type: "donut", rows: rowsOf(group(c.valid, (o) => o.method), (l) => l.length), fmt: "num" }));
I("pay_status", "Payments", "Payment status", "Paid vs advance vs unpaid orders.", (c) => ({ type: "donut", rows: rowsOf(group(c.valid, (o) => o.payStatus), (l) => l.length), fmt: "num", colors: ["#10b981", "#0ea5e9", "#f59e0b"] }));
I("receivable", "Payments", "Money still to collect", "COD cash that is on the way (not yet paid).", (c) => kpi(money(sum(c.valid.filter((o) => o.payStatus !== "Paid"), (o) => o.grand - o.advance)), `${c.valid.filter((o) => o.payStatus !== "Paid").length} orders`, undefined, true));
I("advance_total", "Payments", "Advance collected", "Delivery-charge advances protect you from fake COD orders.", (c) => kpi(money(sum(c.valid, (o) => o.advance)), `${c.valid.filter((o) => o.advance > 0).length} orders`));
I("aov_method", "Payments", "Order value by method", "Prepaid customers often spend more.", (c) => ({ type: "bars", rows: rowsOf(group(c.valid, (o) => o.method), (l) => avgOf(l.map((o) => o.grand))), fmt: "money", color: "#8b5cf6" }));
I("cancel_method", "Payments", "Cancel rate by method", "COD usually cancels more — an advance reduces it.", (c) => ({ type: "bars", rows: rowsOf(group(c.orders.filter((o) => !o.failed), (o) => o.method), (l) => ratio(l.filter((o) => o.status === "Cancelled").length, l.length)), fmt: "pct", color: "#f43f5e" }));
I("gateway_success", "Payments", "Gateway success rate", "Online-payment attempts that completed.", (c) => { const g = c.orders.filter((o) => o.method === "Online Gateway"); return kpi(pct(ratio(g.filter((o) => !o.failed).length, g.length)), `${g.length} attempts`); });
I("verify_queue", "Payments", "Manual TrxID to verify", "bKash/Nagad orders still Pending — check the TrxID and confirm.", (c) => { const n = c.orders.filter((o) => (o.method === "bKash" || o.method === "Nagad") && o.status === "Pending").length; return kpi(num(n), n ? "waiting for verification" : "nothing waiting ✔", undefined, false); });

// LOCATION
I("rev_division", "Location", "Revenue by division", "Where the money comes from.", (c) => ({ type: "bars", rows: rowsOf(group(c.valid, (o) => o.division), (l) => rev(l)), fmt: "money", color: "#0ea5e9" }));
I("top_districts", "Location", "Top districts (orders)", "Run local ads where you already sell.", (c) => ({ type: "bars", rows: rowsOf(group(c.valid, (o) => o.district), (l) => l.length), fmt: "num" }));
I("dhaka_split", "Location", "Inside vs outside Dhaka", "Shapes delivery pricing and courier choice.", (c) => ({ type: "donut", rows: rowsOf(group(c.valid, (o) => (o.district === "Dhaka" ? "Inside Dhaka" : "Outside Dhaka")), (l) => l.length), fmt: "num" }));
I("delivery_rev", "Location", "Delivery charges collected", "Shipping income (before courier cost).", (c) => kpi(money(sum(c.valid, (o) => o.deliveryCharge)), "from customers"));
I("avg_charge", "Location", "Average delivery charge", "What customers pay on average.", (c) => kpi(money(avgOf(c.valid.filter((o) => o.type === "delivery").map((o) => o.deliveryCharge))), "per delivery order"));
I("zone_usage", "Location", "Delivery zone usage", "Orders per delivery charge level.", (c) => ({ type: "bars", rows: rowsOf(group(c.valid.filter((o) => o.type === "delivery"), (o) => { const z = c.zones.find((z) => z.districts.includes(o.district)) || c.zones[c.zones.length - 1]; return z ? z.name : "—"; }), (l) => l.length), fmt: "num", color: "#14b8a6" }));
I("top_upazila", "Location", "Top areas (upazila)", "Hyper-local hotspots for boosting posts.", (c) => ({ type: "table", cols: ["Area", "District", "Orders"], rows: [...group(c.valid, (o) => o.upazila + "|" + o.district).entries()].map(([k, l]) => [k.split("|")[0], k.split("|")[1], l.length] as (string | number)[]).sort((a, b) => Number(b[2]) - Number(a[2])).slice(0, 8) }));
I("slow_district", "Location", "Slowest districts", "Where delivery takes longest — consider a different courier.", (c) => ({ type: "table", cols: ["District", "Avg days", "Orders"], rows: [...group(c.orders.filter((o) => o.deliveryDays), (o) => o.district).entries()].filter(([, l]) => l.length >= 2).map(([k, l]) => [k, avgOf(l.map((o) => o.deliveryDays!)).toFixed(1), l.length] as (string | number)[]).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 7) }));
I("cancel_division", "Location", "Cancel rate by division", "Remote areas often cancel more — verify the address by phone.", (c) => ({ type: "bars", rows: rowsOf(group(c.orders.filter((o) => !o.failed), (o) => o.division), (l) => ratio(l.filter((o) => o.status === "Cancelled").length, l.length)), fmt: "pct", color: "#f43f5e" }));

// MARKETING
I("src_orders", "Marketing", "Orders by traffic source", "Where your customers discover you.", (c) => ({ type: "bars", rows: rowsOf(group(c.valid, (o) => o.source), (l) => l.length), fmt: "num", color: "#6366f1" }));
I("src_rev", "Marketing", "Revenue by traffic source", "Not all traffic is equal — compare with ad spend.", (c) => ({ type: "bars", rows: rowsOf(group(c.valid, (o) => o.source), (l) => rev(l)), fmt: "money", color: "#10b981" }));
I("src_aov", "Marketing", "Order value by source", "Which channel brings bigger baskets.", (c) => ({ type: "bars", rows: rowsOf(group(c.valid, (o) => o.source), (l) => avgOf(l.map((o) => o.grand))), fmt: "money", color: "#f59e0b" }));
I("device", "Marketing", "Device split", "Mobile-first? Make sure your checkout is thumb-friendly.", (c) => ({ type: "donut", rows: rowsOf(group(c.valid, (o) => o.device), (l) => l.length), fmt: "num" }));
I("promo_table", "Marketing", "Coupon performance", "Which codes bring orders and what they cost you.", (c) => ({ type: "table", cols: ["Code", "Uses", "Discount given", "Revenue"], rows: [...group(c.valid.filter((o) => o.promoCode), (o) => o.promoCode!).entries()].map(([k, l]) => [k, l.length, money(sum(l, (o) => o.promoDiscount + o.deliveryDiscount)), money(rev(l))] as (string | number)[]).sort((a, b) => Number(b[1]) - Number(a[1])) }), true);
I("discount_total", "Marketing", "Total discounts given", "Coupon cost. Compare to the extra sales they created.", (c) => { const d = sum(c.valid, (o) => o.promoDiscount + o.deliveryDiscount); return kpi(money(d), `${pct(ratio(d, rev(c.valid) + d))} of gross`, undefined, false); });
I("promo_share", "Marketing", "Orders using a coupon", "Too high = you’re over-discounting.", (c) => kpi(pct(ratio(c.valid.filter((o) => o.promoCode).length, c.valid.length)), `${c.valid.filter((o) => o.promoCode).length} orders`));
I("promo_aov", "Marketing", "Coupon vs no-coupon basket", "Do coupons actually raise the order size?", (c) => ({ type: "bars", rows: [{ label: "With coupon", value: avgOf(c.valid.filter((o) => o.promoCode).map((o) => o.grand)) }, { label: "No coupon", value: avgOf(c.valid.filter((o) => !o.promoCode).map((o) => o.grand)) }], fmt: "money", color: "#ec4899" }));
I("freeship_cost", "Marketing", "Free-delivery cost", "Shipping you paid for through coupons.", (c) => kpi(money(sum(c.valid, (o) => o.deliveryDiscount)), "waived delivery", undefined, false));
I("banner_ctr", "Marketing", "Banner click-through", "Replace banners with CTR under 3%.", (c) => ({ type: "table", cols: ["Banner", "Views", "Clicks", "CTR"], rows: c.banners.map((b) => [b.title, num(b.impressions), num(b.clicks), pct(ratio(b.clicks, b.impressions))]) }));
I("addon_rev", "Marketing", "Add-on revenue", "Gift wraps & extras — pure profit.", (c) => kpi(money(sum(c.valid, (o) => o.addonTotal)), `${c.valid.filter((o) => o.addons.length).length} orders took an add-on`));
I("addon_use", "Marketing", "Add-on popularity", "Which extras customers pick.", (c) => ({ type: "bars", rows: rowsOf(group(c.valid.filter((o) => o.addons.length), (o) => o.addons), (l) => l.length), fmt: "num", color: "#f97316" }));

// REVIEWS
I("rating_avg", "Reviews", "Average rating", "Below 4.2 hurts conversion. Aim for 4.5+.", (c) => kpi(avgOf(c.reviews.filter((r) => r.approved).map((r) => r.rating)).toFixed(2) + " ★", `${c.reviews.filter((r) => r.approved).length} approved reviews`));
I("rating_dist", "Reviews", "Rating distribution", "A few 1-stars are normal; many mean a product issue.", (c) => ({ type: "bars", rows: [5, 4, 3, 2, 1].map((s) => ({ label: s + " ★", value: c.reviews.filter((r) => r.approved && r.rating === s).length })), fmt: "num", color: "#f59e0b" }));
I("review_pending", "Reviews", "Waiting for approval", "Approve quickly — fresh reviews boost trust.", (c) => { const n = c.reviews.filter((r) => !r.approved).length; return kpi(num(n), n ? "review now" : "all caught up ✔", undefined, false); });
I("photo_share", "Reviews", "Reviews with photos", "Photo reviews convert far better.", (c) => kpi(pct(ratio(c.reviews.filter((r) => r.hasPhoto).length, c.reviews.length)), `${c.reviews.filter((r) => r.hasPhoto).length} with photo`));
I("top_rated", "Reviews", "Top rated products", "Feature these on the homepage.", (c) => ({ type: "table", cols: ["Product", "Rating", "Reviews"], rows: [...group(c.reviews.filter((r) => r.approved), (r) => r.productId).entries()].filter(([, l]) => l.length >= 2).map(([k, l]) => [c.prodMap.get(k)?.name || k, avgOf(l.map((r) => r.rating)).toFixed(2) + " ★", l.length] as (string | number)[]).sort((a, b) => parseFloat(String(b[1])) - parseFloat(String(a[1]))).slice(0, 6) }));
I("low_rated", "Reviews", "Lowest rated products", "Investigate quality or description for these.", (c) => ({ type: "table", cols: ["Product", "Rating", "Reviews"], rows: [...group(c.reviews.filter((r) => r.approved), (r) => r.productId).entries()].filter(([, l]) => l.length >= 2).map(([k, l]) => [c.prodMap.get(k)?.name || k, avgOf(l.map((r) => r.rating)).toFixed(2) + " ★", l.length] as (string | number)[]).sort((a, b) => parseFloat(String(a[1])) - parseFloat(String(b[1]))).slice(0, 6) }));
I("review_rate", "Reviews", "Review rate", "Reviews per 100 delivered orders. Ask by SMS after delivery to raise it.", (c) => kpi(pct(ratio(c.reviews.length, c.customers.reduce((s, x) => s + x.orders.filter((o) => o.status === "Delivered").length, 0))), "of delivered orders leave a review"));

// TIME
I("hours", "Time", "Orders by hour of day", "Schedule posts and ads 1 hour before your peak.", (c) => { const m = new Array(24).fill(0); c.valid.forEach((o) => m[new Date(o.date).getHours()]++); return { type: "cols", rows: m.map((v, h) => ({ label: String(h), value: v })), fmt: "num", highlight: true, color: "#6366f1" }; }, true);
I("weekdays", "Time", "Orders by weekday", "Best day for flash sales.", (c) => { const m = new Array(7).fill(0); c.valid.forEach((o) => m[new Date(o.date).getDay()]++); return { type: "cols", rows: m.map((v, d) => ({ label: WD[d], value: v })), fmt: "num", highlight: true, color: "#8b5cf6" }; });
I("heatmap", "Time", "Weekday × hour heatmap", "Darker = more orders. Your perfect posting schedule.", (c) => { const m = Array.from({ length: 7 }, () => new Array(24).fill(0)); c.valid.forEach((o) => { const d = new Date(o.date); m[(d.getDay() + 6) % 7][d.getHours()]++; }); return { type: "heat", matrix: m }; }, true);
I("peak", "Time", "Peak time", "When customers are most active.", (c) => { const h = new Array(24).fill(0), d = new Array(7).fill(0); c.valid.forEach((o) => { const t = new Date(o.date); h[t.getHours()]++; d[t.getDay()]++; }); const ph = h.indexOf(Math.max(...h)); return kpi(`${ph % 12 || 12}${ph < 12 ? "am" : "pm"}`, `busiest day: ${WD[d.indexOf(Math.max(...d))]}`); });
I("daypart", "Time", "Time of day", "Morning · Afternoon · Evening · Night split.", (c) => ({ type: "donut", rows: rowsOf(group(c.valid, (o) => { const h = new Date(o.date).getHours(); return h < 6 ? "Night (12–6am)" : h < 12 ? "Morning" : h < 17 ? "Afternoon" : h < 22 ? "Evening" : "Late (10pm+)"; }), (l) => l.length), fmt: "num" }));
I("weekend", "Time", "Weekend share", "Fri–Sat orders (Bangladesh weekend).", (c) => { const n = c.valid.filter((o) => [5, 6].includes(new Date(o.date).getDay())).length; return kpi(pct(ratio(n, c.valid.length)), `${n} orders on Fri/Sat`); });

export const INSIGHTS = L;
export const insightMap = new Map(L.map((i) => [i.id, i]));

// ---------------- context builder ----------------
export function buildCtx(base: Omit<Ctx, "orders" | "prev" | "valid" | "prevValid" | "from" | "days">, all: Order[], days: number, brand: string): Ctx {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setTime(from.getTime() - (days - 1) * DAY);
  const f = from.getTime();
  const pool = brand === "all" ? all : all.filter((o) => o.brandId === brand);
  const orders = pool.filter((o) => new Date(o.date).getTime() >= f);
  const prev = pool.filter((o) => { const t = new Date(o.date).getTime(); return t >= f - days * DAY && t < f; });
  return { ...base, orders, prev, valid: orders.filter(isValid), prevValid: prev.filter(isValid), from, days };
}

// ---------------- research lab (metric × dimension explorer) ----------------
export const METRICS: { id: string; label: string; fmt: FmtKey }[] = [
  { id: "revenue", label: "Revenue", fmt: "money" },
  { id: "orders", label: "Orders", fmt: "num" },
  { id: "units", label: "Units sold", fmt: "num" },
  { id: "aov", label: "Average order value", fmt: "money" },
  { id: "profit", label: "Gross profit", fmt: "money" },
  { id: "customers", label: "Unique customers", fmt: "num" },
  { id: "discount", label: "Discounts given", fmt: "money" },
  { id: "delivery", label: "Delivery charges", fmt: "money" },
  { id: "cancel", label: "Cancel rate", fmt: "pct" },
  { id: "advance", label: "Advance collected", fmt: "money" },
];
export const DIMS: { id: string; label: string; time?: boolean; item?: boolean }[] = [
  { id: "day", label: "Day", time: true }, { id: "week", label: "Week", time: true }, { id: "month", label: "Month", time: true },
  { id: "weekday", label: "Weekday", time: true }, { id: "hour", label: "Hour of day", time: true },
  { id: "brand", label: "Brand" }, { id: "category", label: "Category", item: true }, { id: "product", label: "Product", item: true },
  { id: "color", label: "Colour", item: true }, { id: "size", label: "Size", item: true },
  { id: "division", label: "Division" }, { id: "district", label: "District" }, { id: "upazila", label: "Area / Upazila" },
  { id: "method", label: "Payment method" }, { id: "payStatus", label: "Payment status" }, { id: "status", label: "Order status" },
  { id: "source", label: "Traffic source" }, { id: "device", label: "Device" }, { id: "promo", label: "Coupon code" },
  { id: "type", label: "Delivery / pickup" }, { id: "buyer", label: "New vs returning" }, { id: "addon", label: "Add-on" }, { id: "cancelReason", label: "Cancel reason" },
];
export function explore(c: Ctx, metric: string, dim: string, mode: "valid" | "all", topN: number) {
  const src = metric === "cancel" || mode === "all" ? c.orders.filter((o) => !o.failed || mode === "all") : c.valid;
  const d = DIMS.find((x) => x.id === dim)!;
  type Acc = { rev: number; units: number; profit: number; disc: number; deliv: number; adv: number; orders: Set<string>; cust: Set<string>; canc: Set<string> };
  const m = new Map<string, Acc>();
  const get = (k: string) => { let a = m.get(k); if (!a) { a = { rev: 0, units: 0, profit: 0, disc: 0, deliv: 0, adv: 0, orders: new Set(), cust: new Set(), canc: new Set() }; m.set(k, a); } return a; };
  const orderKey = (o: Order): string[] => {
    const dt = new Date(o.date);
    switch (dim) {
      case "day": return [localDay(dt)];
      case "week": { const x = new Date(dt); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return [localDay(x)]; }
      case "month": return [`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`];
      case "weekday": return [String((dt.getDay() + 6) % 7)];
      case "hour": return [String(dt.getHours()).padStart(2, "0")];
      case "brand": return [c.brandName(o.brandId)];
      case "division": return [o.division];
      case "district": return [o.district];
      case "upazila": return [o.upazila];
      case "method": return [o.method];
      case "payStatus": return [o.payStatus];
      case "status": return [o.failed ? "Payment failed" : o.status];
      case "source": return [o.source];
      case "device": return [o.device];
      case "promo": return [o.promoCode || "No coupon"];
      case "type": return [o.type === "pickup" ? "Store pickup" : "Home delivery"];
      case "buyer": return [o.isRepeat ? "Returning" : "New"];
      case "addon": return o.addons.length ? o.addons : ["No add-on"];
      case "cancelReason": return [o.cancelReason || "—"];
      default: return ["?"];
    }
  };
  src.forEach((o) => {
    const countable = o.status !== "Cancelled" && !o.failed;
    if (d.item) {
      o.items.forEach((it) => {
        const p = c.prodMap.get(it.productId);
        const keys = dim === "product" ? [it.name] : dim === "category" ? (p ? p.catIds.map(c.catName) : ["?"]) : dim === "color" ? [it.color] : [it.size];
        const total = it.price * it.qty;
        const share = o.subtotal ? total / o.subtotal : 0;
        keys.forEach((k) => {
          const a = get(k);
          if (countable) { a.rev += total; a.units += it.qty; a.profit += total - (p?.cost || 0) * it.qty; a.disc += o.promoDiscount * share; a.deliv += o.deliveryCharge * share; a.adv += o.advance * share; }
          a.orders.add(o.id); a.cust.add(o.customerPhone); if (o.status === "Cancelled") a.canc.add(o.id);
        });
      });
    } else {
      orderKey(o).forEach((k) => {
        const a = get(k);
        if (countable) {
          a.rev += o.grand; a.units += sum(o.items, (i) => i.qty);
          a.profit += sum(o.items, (i) => (i.price - (c.prodMap.get(i.productId)?.cost || 0)) * i.qty);
          a.disc += o.promoDiscount + o.deliveryDiscount; a.deliv += o.deliveryCharge; a.adv += o.advance;
        }
        a.orders.add(o.id); a.cust.add(o.customerPhone); if (o.status === "Cancelled") a.canc.add(o.id);
      });
    }
  });
  const val = (a: Acc): number => {
    switch (metric) {
      case "revenue": return a.rev;
      case "orders": return a.orders.size;
      case "units": return a.units;
      case "aov": return a.orders.size ? a.rev / a.orders.size : 0;
      case "profit": return a.profit;
      case "customers": return a.cust.size;
      case "discount": return a.disc;
      case "delivery": return a.deliv;
      case "cancel": return ratio(a.canc.size, a.orders.size);
      default: return a.adv;
    }
  };
  let rows: Row[] = [...m.entries()].map(([k, a]) => ({ label: k, value: val(a) }));
  if (d.time) {
    rows.sort((a, b) => a.label.localeCompare(b.label));
    rows = rows.map((r) => ({
      ...r,
      label: dim === "weekday" ? WD[(Number(r.label) + 1) % 7] : dim === "hour" ? `${Number(r.label)}:00` : dim === "day" || dim === "week" ? dateShort(r.label + "T12:00:00") : dim === "month" ? new Date(r.label + "-01T12:00:00").toLocaleDateString("en-GB", { month: "short", year: "2-digit" }) : r.label,
    }));
  } else {
    rows.sort((a, b) => b.value - a.value);
    rows = rows.slice(0, topN);
  }
  const t = [...m.values()];
  const distinctOrders = new Set(t.flatMap((a) => [...a.orders])).size;
  const total = metric === "aov" ? sum(t, (a) => a.rev) / Math.max(1, distinctOrders) : metric === "orders" ? distinctOrders : metric === "cancel" ? ratio(new Set(t.flatMap((a) => [...a.canc])).size, new Set(t.flatMap((a) => [...a.orders])).size) : metric === "customers" ? new Set(t.flatMap((a) => [...a.cust])).size : sum(t, (a) => val(a));
  return { rows, total, groups: m.size };
}
