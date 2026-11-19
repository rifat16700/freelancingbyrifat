import type {
  Addon, Banner, Brand, Category, LogEntry, Order, OrderItem, PayMethod, PayStatus, Product, Promo, Review, Section, Session,
  Staff, Status, Variant, Zone, Perm,
} from "../types";

// ---------- deterministic random so the demo is stable ----------
function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = mulberry(20260519);
const rnd = (a: number, b: number) => a + R() * (b - a);
const ri = (a: number, b: number) => Math.floor(rnd(a, b + 1));
const pick = <T,>(arr: T[]): T => arr[Math.floor(R() * arr.length)];
function wpick<T>(items: [T, number][]): T {
  const total = items.reduce((s, i) => s + i[1], 0);
  let r = R() * total;
  for (const [v, w] of items) {
    if ((r -= w) <= 0) return v;
  }
  return items[items.length - 1][0];
}
const DAY = 86400000;
export const NOW = Date.now();
const iso = (t: number) => new Date(t).toISOString();

// ---------- brands / categories ----------
export const brands: Brand[] = [
  { id: "main", name: "Freelancing By Rifat", slug: "", tagline: "Everyday smart shopping", color: "#4f46e5", emoji: "🛍️", active: true, seoTitle: "Freelancing By Rifat — Online Shopping BD", isMain: true },
  { id: "ranonex", name: "Ranonex Watch", slug: "ranonexwatch", tagline: "Luxury timepieces", color: "#b45309", emoji: "⌚", active: true, seoTitle: "Ranonex Watch — Official Store" },
  { id: "royal", name: "Royal Panjabi", slug: "royalpanjabi", tagline: "Premium festive wear", color: "#0f766e", emoji: "👘", active: true, seoTitle: "Royal Panjabi — Premium Panjabi BD" },
];

export const categories: Category[] = [
  { id: "c_elec", name: "Electronics", icon: "🎧", brandId: "main", sort: 1, active: true },
  { id: "c_home", name: "Home & Living", icon: "🏠", brandId: "main", sort: 2, active: true },
  { id: "c_beauty", name: "Beauty", icon: "💄", brandId: "main", sort: 3, active: true },
  { id: "c_bags", name: "Bags & Wallets", icon: "👜", brandId: "main", sort: 4, active: true },
  { id: "c_smart", name: "Smart Watches", icon: "⌚", brandId: "ranonex", sort: 1, active: true },
  { id: "c_analog", name: "Analog Watches", icon: "🕰️", brandId: "ranonex", sort: 2, active: true },
  { id: "c_panj", name: "Panjabi", icon: "👘", brandId: "royal", sort: 1, active: true },
  { id: "c_fatua", name: "Fatua", icon: "👕", brandId: "royal", sort: 2, active: true },
  { id: "c_pajama", name: "Pajama", icon: "👖", brandId: "royal", sort: 3, active: false },
];

// ---------- products ----------
const COLORS: [string, string][] = [
  ["Black", "#111827"], ["White", "#f1f5f9"], ["Navy", "#1e3a8a"], ["Maroon", "#7f1d1d"], ["Olive", "#4d5d2a"],
  ["Gold", "#ca8a04"], ["Silver", "#94a3b8"], ["Rose", "#e11d48"], ["Teal", "#0f766e"],
];
type PDef = [string, string, string, string, number, number, number, number, boolean];
// name, emoji, brand, cat, price, costRatio, hue, popularity, apparel
const PDEFS: PDef[] = [
  ["Wireless Earbuds Pro", "🎧", "main", "c_elec", 1850, 0.58, 250, 10, false],
  ["Bluetooth Speaker Mini", "🔊", "main", "c_elec", 1450, 0.6, 280, 7, false],
  ["Fast Charger 33W", "🔌", "main", "c_elec", 650, 0.5, 200, 9, false],
  ["Power Bank 20000mAh", "🔋", "main", "c_elec", 2200, 0.66, 160, 6, false],
  ["Gaming Mouse RGB", "🖱️", "main", "c_elec", 990, 0.55, 300, 5, false],
  ["LED Table Lamp", "💡", "main", "c_home", 780, 0.52, 45, 4, false],
  ["Electric Kettle 1.8L", "☕", "main", "c_home", 1650, 0.64, 20, 4, false],
  ["Aroma Diffuser", "🌿", "main", "c_home", 890, 0.5, 140, 3, false],
  ["Wall Clock Minimal", "🕒", "main", "c_home", 560, 0.48, 210, 2, false],
  ["Vitamin C Serum", "🧴", "main", "c_beauty", 720, 0.4, 35, 6, false],
  ["Matte Lipstick Set", "💄", "main", "c_beauty", 540, 0.42, 340, 5, false],
  ["Hair Dryer Compact", "💨", "main", "c_beauty", 1350, 0.6, 320, 3, false],
  ["Leather Wallet Slim", "👛", "main", "c_bags", 850, 0.45, 25, 8, false],
  ["Laptop Backpack 25L", "🎒", "main", "c_bags", 1750, 0.55, 220, 5, false],
  ["Ladies Handbag", "👜", "main", "c_bags", 1950, 0.5, 330, 4, false],
  ["Ranonex Pulse Smart Watch", "⌚", "ranonex", "c_smart", 3290, 0.57, 215, 9, false],
  ["Ranonex Fit Band", "📿", "ranonex", "c_smart", 1590, 0.5, 175, 7, false],
  ["Ranonex AMOLED Ultra", "⌚", "ranonex", "c_smart", 4890, 0.62, 265, 4, false],
  ["Ranonex Classic Gold", "🕰️", "ranonex", "c_analog", 2790, 0.48, 42, 6, false],
  ["Ranonex Steel Chrono", "⏱️", "ranonex", "c_analog", 3490, 0.52, 200, 5, false],
  ["Ranonex Couple Set", "💑", "ranonex", "c_analog", 5200, 0.58, 350, 2, false],
  ["Royal Cotton Panjabi", "👘", "royal", "c_panj", 1890, 0.5, 160, 10, true],
  ["Embroidered Eid Panjabi", "👘", "royal", "c_panj", 2890, 0.54, 30, 8, true],
  ["Silk Blend Panjabi", "👘", "royal", "c_panj", 3490, 0.58, 285, 4, true],
  ["Kabli Set", "👔", "royal", "c_panj", 3290, 0.6, 15, 3, true],
  ["Casual Fatua", "👕", "royal", "c_fatua", 990, 0.5, 190, 6, true],
  ["Printed Fatua", "👕", "royal", "c_fatua", 1190, 0.5, 310, 5, true],
  ["Cotton Pajama", "👖", "royal", "c_pajama", 650, 0.52, 100, 1, true],
];
const POP: number[] = PDEFS.map((p) => p[7]);

export const products: Product[] = PDEFS.map((d, i) => {
  const [name, emoji, brandId, cat, price, cr, hue, pop, apparel] = d;
  const nColors = ri(2, 3);
  const used = new Set<number>();
  const variants: Variant[] = [];
  while (variants.length < nColors) {
    const ci = ri(0, COLORS.length - 1);
    if (used.has(ci)) continue;
    used.add(ci);
    const sizes: Record<string, number> = {};
    (apparel ? ["S", "M", "L", "XL", "XXL"] : ["Std"]).forEach((s) => {
      sizes[s] = R() < 0.14 ? 0 : R() < 0.2 ? ri(1, 4) : ri(8, 48);
    });
    variants.push({ color: COLORS[ci][0], hex: COLORS[ci][1], sizes });
  }
  const flash = i % 6 === 0 ? Math.round((price * 0.15) / 10) * 10 : 0;
  return {
    id: `prod_${i + 1}`,
    name,
    sku: `${brandId.slice(0, 2).toUpperCase()}-${1040 + i}`,
    brandId,
    catIds: [cat],
    price,
    cost: Math.round(price * cr),
    flash,
    flashEnd: flash ? iso(NOW + ri(1, 6) * DAY) : undefined,
    active: i !== 26 && i !== 8,
    featured: i % 5 === 0,
    addOnce: i === 2 || i === 12,
    emoji,
    hue,
    desc: `${name} — quality tested, fast delivery all over Bangladesh with Cash on Delivery.`,
    variants,
    views: Math.round(pop * ri(900, 1400) + ri(100, 800)),
    created: iso(NOW - ri(20, 260) * DAY),
  };
});

// ---------- zones, addons, promos ----------
export const zones: Zone[] = [
  { id: "z1", name: "Inside Dhaka", charge: 60, districts: ["Dhaka"] },
  { id: "z2", name: "Dhaka Suburb", charge: 90, districts: ["Gazipur", "Narayanganj", "Tangail"] },
  { id: "z3", name: "Outside Dhaka (default)", charge: 120, districts: [] },
];
export const addons: Addon[] = [
  { id: "a1", icon: "🎁", name: "Gift Wrap", price: 50, active: true },
  { id: "a2", icon: "📦", name: "Extra Protective Box", price: 30, active: true },
  { id: "a3", icon: "💌", name: "Thank-you Card", price: 20, active: true },
  { id: "a4", icon: "⚡", name: "Priority Handling", price: 80, active: false },
];
export const promos: Promo[] = [
  { id: "p1", code: "WELCOME100", visibility: "Public", discountType: "Flat", value: 100, minSpend: 999, freeDelivery: false, brandId: "all", active: true, note: "First order welcome", expiry: iso(NOW + 40 * DAY) },
  { id: "p2", code: "EID20", visibility: "Public", discountType: "Percent", value: 20, cap: 400, minSpend: 1500, freeDelivery: false, brandId: "royal", active: true, note: "Eid festival campaign", expiry: iso(NOW + 9 * DAY), usageLimit: 600 },
  { id: "p3", code: "FREESHIP", visibility: "Public", discountType: "Flat", value: 0, minSpend: 1200, freeDelivery: true, brandId: "all", active: true, note: "Free delivery over ৳1200" },
  { id: "p4", code: "RIFAT10", visibility: "Private", discountType: "Percent", value: 10, cap: 250, minSpend: 500, freeDelivery: false, brandId: "main", active: true, note: "Influencer code" },
  { id: "p5", code: "WATCH200", visibility: "Public", discountType: "Flat", value: 200, minSpend: 2500, freeDelivery: false, brandId: "ranonex", active: true, note: "Watch weekend", expiry: iso(NOW + 4 * DAY) },
  { id: "p6", code: "FLASH50", visibility: "Private", discountType: "Flat", value: 50, minSpend: 0, freeDelivery: false, brandId: "all", active: true, note: "Facebook live", usageLimit: 150 },
  { id: "p7", code: "VIP30", visibility: "Private", discountType: "Percent", value: 30, cap: 600, minSpend: 3000, freeDelivery: true, brandId: "all", active: false, note: "Expired VIP campaign", expiry: iso(NOW - 12 * DAY) },
  { id: "p8", code: "BDAY15", visibility: "Private", discountType: "Percent", value: 15, cap: 300, minSpend: 800, freeDelivery: false, brandId: "all", active: true, note: "Birthday customers" },
];

// ---------- geography / people ----------
const GEO: Record<string, Record<string, string[]>> = {
  Dhaka: { Dhaka: ["Mirpur", "Dhanmondi", "Uttara", "Gulshan", "Mohammadpur", "Badda"], Gazipur: ["Tongi", "Kaliakair", "Sreepur"], Narayanganj: ["Sonargaon", "Rupganj", "Fatullah"], Tangail: ["Tangail Sadar", "Mirzapur"] },
  Chattogram: { Chattogram: ["Pahartali", "Kotwali", "Halishahar"], Cumilla: ["Cumilla Sadar", "Chauddagram"], "Cox's Bazar": ["Cox's Bazar Sadar", "Teknaf"] },
  Rajshahi: { Rajshahi: ["Boalia", "Motihar"], Bogura: ["Bogura Sadar", "Sherpur"] },
  Khulna: { Khulna: ["Sonadanga", "Khalishpur"], Jashore: ["Jashore Sadar", "Benapole"] },
  Sylhet: { Sylhet: ["Zindabazar", "Ambarkhana"], Moulvibazar: ["Moulvibazar Sadar"] },
  Barishal: { Barishal: ["Barishal Sadar", "Bakerganj"] },
  Rangpur: { Rangpur: ["Rangpur Sadar", "Mithapukur"], Dinajpur: ["Dinajpur Sadar"] },
  Mymensingh: { Mymensingh: ["Mymensingh Sadar", "Trishal"], Jamalpur: ["Jamalpur Sadar"] },
};
export const GEO_TREE = GEO;
const DISTRICT_W: [string, number][] = [
  ["Dhaka", 32], ["Chattogram", 11], ["Gazipur", 6], ["Narayanganj", 5], ["Sylhet", 4], ["Rajshahi", 4], ["Khulna", 4], ["Cumilla", 4],
  ["Bogura", 2], ["Cox's Bazar", 2], ["Jashore", 2], ["Barishal", 2.5], ["Rangpur", 2.5], ["Dinajpur", 1.5], ["Mymensingh", 3], ["Jamalpur", 1], ["Tangail", 2], ["Moulvibazar", 1],
];
const divisionOf = (district: string) => Object.keys(GEO).find((d) => GEO[d][district]) || "Dhaka";

const FIRST = ["Rahim", "Karim", "Sakib", "Tanvir", "Nusrat", "Farhana", "Mahmud", "Sumaiya", "Arif", "Jannat", "Imran", "Shila", "Rakib", "Mitu", "Hasan", "Tasnim", "Sohel", "Rima", "Faisal", "Ayesha", "Nayeem", "Mou", "Shuvo", "Lamia", "Rubel", "Sadia", "Jahid", "Puja", "Mehedi", "Tania"];
const LAST = ["Hossain", "Ahmed", "Islam", "Khan", "Chowdhury", "Akter", "Rahman", "Uddin", "Sarker", "Begum", "Mia", "Das", "Roy", "Sheikh", "Talukder"];

interface Cust { name: string; phone: string; email?: string; district: string; division: string; upazila: string }
const usedPhones = new Set<string>();
const custPool: Cust[] = Array.from({ length: 340 }, () => {
  let phone = "";
  do phone = `01${ri(3, 9)}${String(ri(0, 99999999)).padStart(8, "0")}`; while (usedPhones.has(phone));
  usedPhones.add(phone);
  const district = wpick(DISTRICT_W);
  const division = divisionOf(district);
  const name = `${pick(FIRST)} ${pick(LAST)}`;
  return {
    name, phone, district, division,
    upazila: pick(GEO[division][district]),
    email: R() < 0.32 ? `${name.split(" ")[0].toLowerCase()}${ri(10, 99)}@gmail.com` : undefined,
  };
});

// ---------- orders ----------
const SOURCES: [string, number][] = [["Facebook", 38], ["Direct", 18], ["Google", 14], ["Instagram", 12], ["TikTok", 8], ["WhatsApp", 6], ["YouTube", 4]];
const DEVICES: [string, number][] = [["Mobile", 82], ["Desktop", 15], ["Tablet", 3]];
const HOURS_W: number[] = [1, 0.6, 0.4, 0.3, 0.3, 0.5, 1, 1.8, 2.4, 3, 3.6, 4.2, 4.4, 4, 3.6, 3.6, 4, 4.6, 5.4, 6.4, 7.2, 6.8, 4.4, 2.2];
const CANCEL: [string, number][] = [["Customer changed mind", 30], ["Not reachable on phone", 28], ["Wrong address", 10], ["Found cheaper elsewhere", 12], ["Out of stock", 8], ["Duplicate order", 8], ["Delivery too slow", 4]];
const WEEKDAY_F = [1.05, 0.9, 0.88, 0.92, 1.0, 1.18, 1.12]; // Sun..Sat

function zoneCharge(district: string) {
  const z = zones.find((z) => z.districts.includes(district));
  return (z || zones[zones.length - 1]).charge;
}

const DAYS = 180;
const rawOrders: Order[] = [];
for (let back = DAYS - 1; back >= 0; back--) {
  const dayStart = new Date(NOW - back * DAY);
  dayStart.setHours(0, 0, 0, 0);
  const growth = 0.75 + ((DAYS - back) / DAYS) * 0.65;
  const eidBoost = back < 12 ? 1.35 : 1;
  const n = Math.max(1, Math.round(5.2 * growth * WEEKDAY_F[dayStart.getDay()] * eidBoost * rnd(0.75, 1.3)));
  for (let k = 0; k < n; k++) {
    const hour = wpick(HOURS_W.map((w, h) => [h, w] as [number, number]));
    const t = dayStart.getTime() + hour * 3600000 + ri(0, 3599) * 1000;
    if (t > NOW) continue;
    const c = custPool[Math.floor(Math.pow(R(), 2.1) * custPool.length)];
    const nItems = wpick([[1, 60], [2, 28], [3, 12]]);
    const items: OrderItem[] = [];
    const seen = new Set<number>();
    const firstProductIdx = wpick(POP.map((w, i) => [i, w] as [number, number]));
    for (let j = 0; j < nItems; j++) {
      let pi = j === 0 ? firstProductIdx : wpick(POP.map((w, i) => [i, w] as [number, number]));
      if (seen.has(pi)) continue;
      // keep same brand for multi-item orders
      if (products[pi].brandId !== products[firstProductIdx].brandId) pi = firstProductIdx;
      if (seen.has(pi)) continue;
      seen.add(pi);
      const p = products[pi];
      const v = pick(p.variants);
      const sizes = Object.keys(v.sizes);
      const price = p.flash && R() < 0.5 ? p.price - p.flash : p.price;
      items.push({ productId: p.id, name: p.name, qty: R() < 0.82 ? 1 : 2, price, color: v.color, size: pick(sizes) });
    }
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const brandId = products.find((p) => p.id === items[0].productId)!.brandId;
    const type: "delivery" | "pickup" = R() < 0.03 && c.district === "Dhaka" ? "pickup" : "delivery";
    let delivery = type === "pickup" ? 0 : zoneCharge(c.district);
    let promoCode: string | undefined;
    let promoDiscount = 0;
    let deliveryDiscount = 0;
    if (R() < 0.24) {
      const cand = promos.filter((p) => p.visibility === "Public" && p.active && subtotal >= p.minSpend && (p.brandId === "all" || p.brandId === brandId));
      if (cand.length) {
        const p = pick(cand);
        promoCode = p.code;
        promoDiscount = p.discountType === "Flat" ? p.value : Math.min(Math.round((subtotal * p.value) / 100), p.cap || 1e9);
        if (p.freeDelivery) { deliveryDiscount = delivery; delivery = 0; }
      }
    }
    const addonPick = R() < 0.14 ? [pick(addons.filter((a) => a.active))] : [];
    const addonTotal = addonPick.reduce((s, a) => s + a.price, 0);
    const grand = subtotal - promoDiscount + delivery + addonTotal;
    const method: PayMethod = wpick<PayMethod>([["COD", 52], ["bKash", 24], ["Nagad", 10], ["Online Gateway", 10], ["Binance Pay", 4]]);
    const age = (NOW - t) / DAY;
    let status: Status;
    let cancelReason: string | undefined;
    let failed = false;
    if (R() < 0.115) { status = "Cancelled"; cancelReason = wpick(CANCEL); }
    else if (age < 1) status = wpick<Status>([["Pending", 55], ["Confirmed", 35], ["Processing", 10]]);
    else if (age < 2.5) status = wpick<Status>([["Pending", 14], ["Confirmed", 36], ["Processing", 38], ["Shipped", 12]]);
    else if (age < 5) status = wpick<Status>([["Processing", 20], ["Shipped", 50], ["Delivered", 30]]);
    else if (age < 8) status = wpick<Status>([["Shipped", 20], ["Delivered", 80]]);
    else status = R() < 0.985 ? "Delivered" : "Shipped";
    if (method === "Online Gateway" && R() < 0.07) { failed = true; status = "Pending"; cancelReason = undefined; }
    let payStatus: PayStatus = "Unpaid";
    let advance = 0;
    if (method !== "COD") payStatus = failed ? "Unpaid" : "Paid";
    else if (R() < 0.3) { payStatus = "Advance Paid"; advance = delivery || 60; }
    if (method === "COD" && status === "Delivered") payStatus = "Paid";
    if (status === "Cancelled" && method === "COD") payStatus = "Unpaid";
    const deliveryDays = status === "Delivered" ? Math.max(1, Math.round((c.district === "Dhaka" ? 1.6 : c.division === "Dhaka" ? 2.4 : 3.8) + rnd(-1, 2))) : undefined;
    rawOrders.push({
      id: "", date: iso(t), customerPhone: c.phone, customerName: c.name, email: c.email,
      division: c.division, district: c.district, upazila: c.upazila,
      address: `House ${ri(1, 120)}, Road ${ri(1, 30)}, ${c.upazila}`,
      items, subtotal, promoCode, promoDiscount, deliveryCharge: delivery, deliveryDiscount, addons: addonPick.map((a) => a.name), addonTotal,
      grand, advance, method,
      trxId: method === "COD" ? undefined : `${method === "bKash" ? "BK" : method === "Nagad" ? "NG" : "TX"}${ri(10000000, 99999999)}`,
      payStatus, status, type, brandId, source: wpick(SOURCES), device: wpick(DEVICES), failed, cancelReason, deliveryDays, isRepeat: false,
      note: R() < 0.08 ? "Please call before delivery" : undefined,
    });
  }
}
rawOrders.sort((a, b) => a.date.localeCompare(b.date));
const seenPhones = new Set<string>();
rawOrders.forEach((o, i) => {
  o.id = `FBR-${24000 + i + 1}`;
  o.isRepeat = seenPhones.has(o.customerPhone);
  seenPhones.add(o.customerPhone);
});
export const orders: Order[] = rawOrders.reverse();

// ---------- reviews ----------
const REV_TEXT: Record<number, string[]> = {
  5: ["Excellent quality, delivery was super fast!", "Exactly as shown. Highly recommended.", "Packaging was perfect, will order again.", "দারুণ প্রোডাক্ট, টাকা ওয়ার্থ!", "Best purchase this month 🔥"],
  4: ["Good product, delivery a bit late.", "Nice quality for the price.", "ভালো, তবে প্যাকেজিং আরেকটু ভালো হতে পারত।", "Works fine, happy with it."],
  3: ["Average. Color slightly different from photo.", "Okay for the price."],
  2: ["Size was not correct, exchange took time."],
  1: ["Product stopped working in 3 days."],
};
export const reviews: Review[] = Array.from({ length: 76 }, (_, i) => {
  const rating = wpick([[5, 52], [4, 28], [3, 10], [2, 6], [1, 4]]);
  const pi = wpick(POP.map((w, k) => [k, w] as [number, number]));
  return {
    id: `r${i + 1}`, productId: products[pi].id, name: `${pick(FIRST)} ${pick(LAST)}`, rating,
    text: pick(REV_TEXT[rating]), date: iso(NOW - ri(0, 120) * DAY - ri(0, 20) * 3600000),
    approved: i > 11, hasPhoto: R() < 0.28,
  };
}).sort((a, b) => b.date.localeCompare(a.date));

// ---------- banners / sections ----------
export const banners: Banner[] = [
  { id: "b1", title: "Eid Collection is Live", subtitle: "Up to 20% off Royal Panjabi", brandId: "royal", hue: 165, link: "/royalpanjabi/shop", sort: 1, active: true, impressions: 28400, clicks: 1420 },
  { id: "b2", title: "Smart Watch Weekend", subtitle: "Flat ৳200 off with WATCH200", brandId: "ranonex", hue: 25, link: "/ranonexwatch/shop", sort: 2, active: true, impressions: 21900, clicks: 1095 },
  { id: "b3", title: "Free Delivery over ৳1200", subtitle: "All Bangladesh • Cash on Delivery", brandId: "main", hue: 250, link: "/shop", sort: 3, active: true, impressions: 33100, clicks: 990 },
  { id: "b4", title: "Gadgets Mega Sale", subtitle: "Earbuds, chargers & more", brandId: "main", hue: 300, link: "/shop?cat=electronics", sort: 4, active: true, impressions: 15200, clicks: 690 },
  { id: "b5", title: "Winter Clearance", subtitle: "Last season items", brandId: "main", hue: 200, link: "/shop", sort: 5, active: false, impressions: 6400, clicks: 120 },
];
export const sections: Section[] = [
  { id: "s1", title: "⚡ Flash Deals", type: "Custom", brandId: "main", max: 8, sort: 1, active: true },
  { id: "s2", title: "Best Sellers", type: "All Products", brandId: "main", max: 12, sort: 2, active: true },
  { id: "s3", title: "Eid Panjabi Collection", type: "Category", brandId: "royal", max: 10, sort: 1, active: true },
  { id: "s4", title: "Smart Watches", type: "Category", brandId: "ranonex", max: 8, sort: 1, active: true },
  { id: "s5", title: "Beauty Picks", type: "Category", brandId: "main", max: 6, sort: 3, active: false },
];

// ---------- staff / logs / sessions ----------
export const MODULES = ["orders", "customers", "products", "categories", "brands", "banners", "sections", "promos", "reviews", "delivery", "addons", "insights", "settings", "tracking", "staff"];
const perm = (v: boolean, e: boolean, d: boolean): Perm => ({ view: v, edit: e, delete: d });
export const staff: Staff[] = [
  { id: "st1", name: "Rahim Manager", email: "rahim@store.bd", tg: "5829104721", lastLogin: iso(NOW - 3600000 * 5), active: true,
    perms: Object.fromEntries(MODULES.map((m) => [m, ["orders", "customers", "products"].includes(m) ? perm(true, true, false) : m === "insights" ? perm(true, false, false) : perm(false, false, false)])) },
  { id: "st2", name: "Sumi Support", email: "sumi@store.bd", tg: "7712840091", lastLogin: iso(NOW - DAY * 1.2), active: true,
    perms: Object.fromEntries(MODULES.map((m) => [m, ["orders", "reviews", "customers"].includes(m) ? perm(true, true, false) : perm(false, false, false)])) },
  { id: "st3", name: "Jahid Packing", email: "jahid@store.bd", tg: "6620193384", lastLogin: iso(NOW - DAY * 9), active: false,
    perms: Object.fromEntries(MODULES.map((m) => [m, m === "orders" ? perm(true, false, false) : perm(false, false, false)])) },
];
const ACTIONS: [string, string][] = [["Order status → Shipped", "FBR-24"], ["Product updated", "prod_"], ["Promo created", "EID20"], ["Review approved", "r"], ["Login success", "—"], ["Settings saved", "Payments"], ["Banner toggled", "b"], ["Delivery zone edited", "Inside Dhaka"]];
export const logs: LogEntry[] = Array.from({ length: 34 }, (_, i) => {
  const [a, t] = pick(ACTIONS);
  const actor = pick(["Master Admin", "Rahim Manager", "Sumi Support"]);
  return { id: `l${i}`, time: iso(NOW - i * 3600000 * ri(1, 5)), actor, role: actor === "Master Admin" ? "Master" : "Staff", action: a, target: t.endsWith("_") || t.endsWith("24") || t === "r" || t === "b" ? t + ri(1, 99) : t, ip: `103.${ri(100, 199)}.${ri(1, 250)}.${ri(1, 250)}` };
});
export const sessions: Session[] = [
  { id: "ss1", who: "Master Admin", role: "Master", ip: "103.145.22.18", device: "Chrome • Windows", expires: iso(NOW + DAY * 6) },
  { id: "ss2", who: "Rahim Manager", role: "Staff", ip: "103.178.90.5", device: "Chrome • Android", expires: iso(NOW + DAY * 2) },
  { id: "ss3", who: "Sumi Support", role: "Staff", ip: "27.147.201.77", device: "Safari • iPhone", expires: iso(NOW + DAY * 0.5) },
];

// ---------- settings ----------
export const defaultSettings = {
  storeName: "Freelancing By Rifat", logo: "", favicon: "", footer: "© 2026 Freelancing By Rifat. All rights reserved.",
  whatsapp: "8801700000000", facebook: "https://facebook.com/freelancingbyrifat", instagram: "https://instagram.com/freelancingbyrifat", youtube: "",
  seoTitle: "Best Online Shopping in Bangladesh | Freelancing By Rifat", seoDesc: "Discover high quality gadgets, watches and fashion at unbeatable prices with cash on delivery all over Bangladesh.",
  seoKeywords: "online shop bd, cash on delivery, gadgets, watches, panjabi", canonical: "", gsc: "",
  cod: true, funPromise: false, msgOrder: true, advanceAmount: 0, advanceMode: "manual" as "manual" | "auto",
  bkashNumber: "01700000000", nagadNumber: "01800000000", gateway: "Auto", gatewayKey: "",
  binanceUid: "", usdRate: 120, crypto: true,
  pickup: true, pickupAddress: "Shop #5, Mirpur 10, Dhaka", pickupMap: "",
  tgMainToken: "", tgMainChat: "", tgPickupToken: "", tgPickupChat: "", notifyNew: true, notifyCancel: true, notifyReview: false, notifyLowStock: true,
  imageProvider: "R2", aiAdminKey: "", aiUserKey: "", aiModel: "Flash", aiChat: true, aiVoice: false, aiCompare: true,
  repeatEnabled: true, repeatType: "Flat", repeatValue: 100, repeatCap: 0, repeatDays: 30, repeatMin: 500, repeatFreeShip: false,
  lowStockLimit: 5, maintenance: false, maintenanceMsg: "আমরা শীঘ্রই ফিরে আসছি।",
  brandColors: { primary: "#4f46e5", primaryDark: "#3730a3", accent: "#f43f5e", bg: "#ffffff", card: "#f8fafc", text: "#0f172a", muted: "#64748b" },
  templateVersion: "v2",
  trackingMode: "Smart Fallback", metaPixel: "", ga4: "", gtm: "", clarity: "", trackingUrl: "",
};
export type Settings = typeof defaultSettings;
