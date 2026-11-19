// ============================================================================
// Real AlwaysData Proxy + Cloudflare D1 + Media Upload + Auto-SKU Engine
// ============================================================================

declare global {
  interface Window {
    CONFIG?: {
      PROXY_API_URL?: string;
      HF_API_BASE?: string;
      BRAND_COLORS?: string | Record<string, string>;
      TEMPLATE_VERSION?: string;
      SITE_URL?: string;
    };
  }
}

const recentWrites: Record<string, number> = {};

export function getProxyBase(): string {
  const b = (typeof window !== "undefined" && window.CONFIG && (window.CONFIG.PROXY_API_URL || window.CONFIG.HF_API_BASE)) || "https://ranonex1.alwaysdata.net";
  return String(b).trim().replace(/\/+$/, "");
}

export function getAdminToken(): string {
  try { return localStorage.getItem("admin_token") || ""; } catch { return ""; }
}

export async function proxyFetch<T = any>(path: string, body?: unknown, method: "GET" | "POST" = "POST"): Promise<T> {
  const cleanPath = path.startsWith("/api/") ? path.slice(4) : path.startsWith("/") ? path : "/" + path;
  const base = getProxyBase();
  const url = base + cleanPath;

  const isMutation = method === "POST" && cleanPath !== "/d1-query" && cleanPath !== "/verify-token" && cleanPath !== "/admin-login" && cleanPath !== "/verify-admin-otp";
  if (isMutation && body) {
    const key = cleanPath + ":" + JSON.stringify(body).slice(0, 140);
    const now = Date.now();
    if (recentWrites[key] && now - recentWrites[key] < 320) {
      throw new Error("অনুগ্রহ করে একটু অপেক্ষা করুন (Too many rapid requests)");
    }
    recentWrites[key] = now;
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const tok = getAdminToken();
  if (tok) headers["Authorization"] = "Bearer " + tok;

  const res = await fetch(url, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
  });

  if (res.status === 401 && cleanPath !== "/admin-login" && cleanPath !== "/verify-admin-otp" && cleanPath !== "/verify-token") {
    try {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_token_exp");
    } catch {}
    window.dispatchEvent(new CustomEvent("adm-unauthorized"));
  }

  const data = await res.json().catch(() => ({ success: false, error: `HTTP ${res.status}` }));
  return data as T;
}

export async function d1Query<T = Record<string, any>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const d = await proxyFetch("/d1-query", { sql, params });
  if (!d || !d.success) throw new Error(d?.error || "D1 query failed");
  return (d.result?.[0]?.results || []) as T[];
}

export async function d1BatchQuery(queries: { sql: string; params?: unknown[] }[]): Promise<Record<string, any>[][]> {
  const d = await proxyFetch("/d1-query", { queries });
  if (!d || !d.success || !Array.isArray(d.result)) throw new Error(d?.error || "D1 batch query failed");
  return d.result.map((r: any) => (Array.isArray(r?.results) ? r.results : []));
}

export async function d1AdminQuery(sql: string, params: unknown[] = []): Promise<any> {
  const d = await proxyFetch("/admin-query", { sql, params });
  if (!d || !d.success) throw new Error(d?.error || "Admin query failed");
  return d.result?.[0]?.results || [];
}

export async function d1AdminBatch(queries: { sql: string; params?: unknown[] }[]): Promise<any> {
  const d = await proxyFetch("/admin-query", { queries });
  if (!d || !d.success) throw new Error(d?.error || "Admin batch failed");
  return d.result;
}

// ── Real Image Upload (Cloudflare R2 / ImgBB / Compressed WebP DataURL Fallback) ──
export async function uploadImageFile(file: File, opts?: { provider?: string; imgbbKey?: string }): Promise<string> {
  const provider = (opts?.provider || "R2").toLowerCase();
  const imgbbKey = (opts?.imgbbKey || "").trim();

  // 1. Try ImgBB if configured or selected
  if ((provider === "imgbb" || imgbbKey) && imgbbKey) {
    try {
      const fd = new FormData();
      fd.append("image", file);
      const r = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(imgbbKey)}`, { method: "POST", body: fd });
      const j = await r.json();
      if (j?.success && j?.data?.url) return j.data.url as string;
    } catch {}
  }

  // 2. Try Cloudflare R2 /api/upload-image endpoint on current origin
  try {
    const fd = new FormData();
    fd.append("file", file);
    const tok = getAdminToken();
    const r = await fetch("/api/upload-image", {
      method: "POST",
      headers: tok ? { Authorization: "Bearer " + tok } : {},
      body: fd,
    });
    if (r.ok) {
      const j = await r.json();
      if (j?.url) return j.url as string;
    }
  } catch {}

  // 3. Fallback: Client-side compressed WebP/JPEG data URL
  return await compressImageToDataUrl(file, 960, 0.84);
}

export function compressImageToDataUrl(file: File, maxDim = 960, quality = 0.84): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(String(reader.result || ""));
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
          else { w = Math.round((w * maxDim) / h); h = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(String(reader.result || ""));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/webp", quality));
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

// ── Extract Brand Palette from Uploaded Logo/Image (for Theme Customizer) ──
export function extractPaletteFromImageFile(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 64;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(["#8b1a1a", "#b03535", "#680000"]);
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 128) continue;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum > 242 || lum < 14) continue;
          const key = `${Math.round(r / 24)}-${Math.round(g / 24)}-${Math.round(b / 24)}`;
          const cur = buckets.get(key) || { r: 0, g: 0, b: 0, count: 0 };
          cur.r += r; cur.g += g; cur.b += b; cur.count += 1;
          buckets.set(key, cur);
        }
        const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
        const sorted = [...buckets.values()]
          .sort((a, b) => b.count - a.count)
          .slice(0, 8)
          .map((x) => `#${toHex(x.r / x.count)}${toHex(x.g / x.count)}${toHex(x.b / x.count)}`);
        resolve(sorted.length ? sorted : ["#8b1a1a", "#b03535", "#680000"]);
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

// ── Permanent Auto-SKU Generator (Bangla + English 2-Letter Prefix Engine) ──
const STOP_WORDS = new Set(["the", "and", "for", "with", "from", "in", "on", "at", "to", "of", "by", "bd", "bangladesh", "price", "online", "shop", "store", "new", "best", "buy", "original"]);
const BANGLA_PREFIX_MAP: { kw: string[]; prefix: string }[] = [
  { kw: ["পাঞ্জাবি", "পাঞ্জাবী"], prefix: "PJ" },
  { kw: ["ঘড়ি", "ঘড়ি", "ওয়াচ", "ওয়াচ"], prefix: "WC" },
  { kw: ["টি-শার্ট", "টিশার্ট", "গেঞ্জি"], prefix: "TS" },
  { kw: ["শার্ট"], prefix: "SH" },
  { kw: ["প্যান্ট", "জিন্স", "ট্রাউজার"], prefix: "PT" },
  { kw: ["জুতা", "স্নিকার", "লোফার", "স্যান্ডেল"], prefix: "SH" },
  { kw: ["ব্যাগ", "মানিব্যাগ", "ওয়ালেট", "ওয়ালেট"], prefix: "BG" },
  { kw: ["চশমা", "সানগ্লাস"], prefix: "GL" },
  { kw: ["ইয়ারবাড", "ইয়ারবাড", "হেডফোন", "এয়ারপড"], prefix: "EB" },
  { kw: ["শাড়ি", "শাড়ি"], prefix: "SR" },
  { kw: ["থ্রি-পিস", "থ্রি পিস", "কুর্তি", "কামিজ"], prefix: "KP" },
  { kw: ["বোরকা", "হিজাব", "আবায়া"], prefix: "BK" },
  { kw: ["পারফিউম", "আতর", "বডি স্প্রে"], prefix: "PF" },
  { kw: ["কনসোল", "গেম", "গেমিং", "খেলনা"], prefix: "GM" },
  { kw: ["হুডি", "জ্যাকেট", "সোয়েটার"], prefix: "HD" },
];
const BANGLA_CHAR_MAP: Record<string, string> = {
  "ক":"K","খ":"K","গ":"G","ঘ":"G","চ":"C","ছ":"C","জ":"J","ঝ":"J",
  "ট":"T","ঠ":"T","ড":"D","ঢ":"D","ত":"T","থ":"T","দ":"D","ধ":"D",
  "ন":"N","ণ":"N","প":"P","ফ":"F","ব":"B","ভ":"V","ম":"M","য":"J",
  "র":"R","ল":"L","শ":"S","ষ":"S","স":"S","হ":"H","অ":"A","আ":"A",
  "ই":"I","ঈ":"I","উ":"U","ঊ":"U","এ":"E","ও":"O"
};

export function generatePermanentSku(name: string, existingSkus: string[] = []): string {
  const raw = (name || "").trim();
  let prefix = "PR";
  const latin = (raw.match(/[A-Za-z]+/g) || []).filter((w) => !STOP_WORDS.has(w.toLowerCase()));
  if (latin.length >= 2) {
    prefix = (latin[0][0] + latin[1][0]).toUpperCase();
  } else if (latin.length === 1 && latin[0].length >= 2) {
    prefix = latin[0].slice(0, 2).toUpperCase();
  } else {
    const matched = BANGLA_PREFIX_MAP.find((m) => m.kw.some((k) => raw.includes(k)));
    if (matched) prefix = matched.prefix;
    else {
      const letters = [...raw].map((ch) => BANGLA_CHAR_MAP[ch] || "").filter(Boolean);
      if (letters.length >= 2) prefix = letters[0] + letters[1];
    }
  }
  const taken = new Set(existingSkus.map((s) => s.toUpperCase()));
  for (let tries = 0; tries < 50; tries++) {
    const num = 100 + Math.floor(Math.random() * 900);
    const candidate = `${prefix}-${num}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${prefix}-${1000 + Math.floor(Math.random() * 9000)}`;
}
