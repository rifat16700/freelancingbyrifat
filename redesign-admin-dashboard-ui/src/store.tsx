import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  Addon, AuthUser, Banner, Brand, BrandColors, Category, CryptoCoin, Customer,
  LogEntry, MessagingApp, Order, OrderItem, PayStatus, Perm, Product, Promo, Review,
  Section, Session, Settings, Staff, Status, Variant, Zone,
} from "./types";
import { isValid } from "./lib/format";
import { d1AdminBatch, d1AdminQuery, d1BatchQuery, getAdminToken, proxyFetch } from "./lib/api";
import { MODULES } from "./data/demo";

export interface Coll<T> {
  items: T[];
  add: (x: T) => void;
  update: (id: string, p: Partial<T>) => void;
  remove: (id: string) => void;
  set: (f: (a: T[]) => T[]) => void;
}

export type Lang = "en" | "bn";
interface Toast { id: number; msg: string; kind: "ok" | "err" | "info" }

export const DEFAULT_BRAND_COLORS: BrandColors = {
  primary: "#8b1a1a",
  primary_light: "#b03535",
  primary_dark: "#680000",
  bg: "#fff8f0",
  bg_light: "#fffdf9",
  bg_card: "#ffffff",
  bg_subtle: "#f9f1e7",
  footer_bg: "#1a1a1a",
  border: "#e8ddd0",
  border_light: "#f0e8dc",
  text_dark: "#1a1a1a",
  text_body: "#333333",
  text_muted: "#777777",
};

function readInitialBrandColors(): BrandColors {
  try {
    const raw = typeof window !== "undefined" ? window.CONFIG?.BRAND_COLORS : undefined;
    if (raw) {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (parsed && typeof parsed === "object") {
        return { ...DEFAULT_BRAND_COLORS, ...parsed };
      }
    }
  } catch {}
  return { ...DEFAULT_BRAND_COLORS };
}

export function applyBrandColorsToDom(c: Partial<BrandColors>) {
  if (typeof document === "undefined") return;
  const r = document.documentElement;
  if (c.primary) r.style.setProperty("--primary", c.primary);
  if (c.primary_light) r.style.setProperty("--primary-light", c.primary_light);
  if (c.primary_dark) r.style.setProperty("--primary-dark", c.primary_dark);
}

const INITIAL_SETTINGS: Settings = {
  storeName: "Freelancing By Rifat",
  logo: "",
  favicon: "",
  footer: "",
  whatsapp: "",
  facebook: "",
  instagram: "",
  youtube: "",
  seoTitle: "",
  seoDesc: "",
  seoKeywords: "",
  seoOgImage: "",
  canonical: "",
  gsc: "",
  cod: true,
  funPromise: true,
  allowWhatsappOrder: true,
  msgOrder: true,
  advanceAmount: 0,
  advanceMode: "manual",
  bkashNumber: "",
  nagadNumber: "",
  binanceManualUid: "",
  gateway: "cloudflare",
  gatewayVersion: "v1",
  gatewayKey: "",
  gatewayKeyV2: "",
  binanceUid: "",
  binanceProxyUrl: "",
  binanceApiKey: "",
  binanceApiSecret: "",
  web3WalletAddress: "",
  usdRate: 120,
  crypto: false,
  cryptoCoins: [],
  messagingApps: [],
  pickup: false,
  pickupAddress: "",
  pickupMap: "",
  tgMainToken: "",
  tgMainChat: "",
  tgMainChats: [],
  tgDraftToken: "",
  tgDraftChat: "",
  tgPickupToken: "",
  tgPickupChat: "",
  notifyNew: true,
  notifyCancel: true,
  notifyReview: true,
  notifyLowStock: true,
  imageProvider: "R2",
  imgbbApiKey: "",
  reviewImgbbKey: "",
  supabaseEdgeUrl: "",
  hfApiUrl: "",
  aiAdminKey: "",
  aiUserKey: "",
  aiModel: "gemini-3.5-flash",
  aiAudioModel: "gemini-3.8-live",
  aiChat: true,
  aiVoice: true,
  aiCompare: true,
  repeatEnabled: false,
  repeatType: "Flat",
  repeatValue: 100,
  repeatCap: 0,
  repeatDays: 30,
  repeatMin: 500,
  repeatFreeShip: false,
  lowStockLimit: 5,
  maintenance: false,
  maintenanceMsg: "We are upgrading our store. We will be back shortly!",
  brandColors: readInitialBrandColors(),
  templateVersion: (typeof window !== "undefined" && window.CONFIG?.TEMPLATE_VERSION) || "v2",
  trackingMode: "Smart Fallback",
  metaPixel: "",
  ga4: "",
  gtm: "",
  clarity: "",
  trackingUrl: "",
};

function safeJson<T>(v: unknown, fallback: T): T {
  if (v === null || v === undefined || v === "") return fallback;
  if (typeof v !== "string") return (v as T) ?? fallback;
  try { return JSON.parse(v) as T; } catch { return fallback; }
}

function hashHue(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return Math.abs(h);
}

function parseVariantsFromD1(raw: unknown): Variant[] {
  const arr = safeJson<any[]>(raw, []);
  if (!Array.isArray(arr) || !arr.length) {
    return [{ color: "Default", hex: "#111827", variantCode: "", sizes: { Std: 10 }, extraPrices: { Std: 0 } }];
  }
  return arr.map((v) => {
    const color = String(v?.color || v?.colorName || "Default");
    const hex = String(v?.hex || v?.colorHex || "#111827");
    const image = String(v?.image || v?.imageUrl || "");
    const variantCode = String(v?.variantCode || v?.code || "");
    const sizes: Record<string, number> = {};
    const extraPrices: Record<string, number> = {};
    if (Array.isArray(v?.sizes)) {
      v.sizes.forEach((s: any) => {
        const k = String(s?.size || "Std");
        sizes[k] = Number(s?.stock ?? 0);
        extraPrices[k] = Number(s?.extraPrice ?? 0);
      });
    } else if (v?.sizes && typeof v.sizes === "object") {
      Object.entries(v.sizes).forEach(([k, val]) => {
        sizes[k] = Number(val ?? 0);
        extraPrices[k] = 0;
      });
    }
    if (!Object.keys(sizes).length) {
      sizes.Std = 10;
      extraPrices.Std = 0;
    }
    return { color, hex, image: image || undefined, variantCode: variantCode || undefined, sizes, extraPrices };
  });
}

function serializeVariantsForD1(variants: Variant[]) {
  return (variants || []).map((v) => ({
    colorName: v.color,
    colorHex: v.hex,
    imageUrl: v.image || "",
    color: v.color,
    hex: v.hex,
    image: v.image || "",
    variantCode: v.variantCode || "",
    sizes: Object.entries(v.sizes || {}).map(([size, stock]) => ({
      size,
      stock: Number(stock || 0),
      extraPrice: Number(v.extraPrices?.[size] ?? 0),
    })),
  }));
}

function buildCustomers(orders: Order[]): Customer[] {
  const map = new Map<string, Order[]>();
  orders.forEach((o) => {
    const ph = (o.customerPhone || "").trim();
    if (!ph) return;
    const a = map.get(ph) || [];
    a.push(o);
    map.set(ph, a);
  });
  const now = Date.now();
  return [...map.entries()].map(([phone, list]) => {
    const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));
    const valid = sorted.filter(isValid);
    const spent = valid.reduce((s, o) => s + o.grand, 0);
    const last = sorted[0].date;
    const first = sorted[sorted.length - 1].date;
    const daysSince = (now - new Date(last).getTime()) / 86400000;
    const firstDays = (now - new Date(first).getTime()) / 86400000;
    let segment: Customer["segment"] = "Regular";
    if (spent >= 14000 || valid.length >= 4) segment = "VIP";
    else if (valid.length >= 2 && daysSince > 60) segment = "At risk";
    else if (valid.length >= 2) segment = "Loyal";
    else if (firstDays <= 30) segment = "New";
    const o = sorted[0];
    return { phone, name: o.customerName, email: sorted.find((x) => x.email)?.email, district: o.district, division: o.division, orders: sorted, valid, spent, first, last, segment };
  }).sort((a, b) => b.spent - a.spent);
}

export interface MasterStatus {
  username: string;
  hasPin: boolean;
  tgConfigured: boolean;
  tgChatMasked: string;
  tgSource: string;
  envLocked: boolean;
}

function useStoreValue() {
  const [brandsList, setBrandsList] = useState<Brand[]>([
    { id: "main", name: "Main Store", slug: "", tagline: "Primary Storefront", color: "#8b1a1a", emoji: "🏪", active: true, seoTitle: "", isMain: true },
  ]);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [ordersList, setOrdersList] = useState<Order[]>([]);
  const [reviewsList, setReviewsList] = useState<Review[]>([]);
  const [promosList, setPromosList] = useState<Promo[]>([]);
  const [zonesList, setZonesList] = useState<Zone[]>([]);
  const [addonsList, setAddonsList] = useState<Addon[]>([]);
  const [bannersList, setBannersList] = useState<Banner[]>([]);
  const [sectionsList, setSectionsList] = useState<Section[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [logsList, setLogsList] = useState<LogEntry[]>([]);
  const [sessionsList, setSessionsList] = useState<Session[]>([]);
  const [settings, setSettingsState] = useState<Settings>(INITIAL_SETTINGS);
  const [customCss, setCustomCssState] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [masterStatus, setMasterStatus] = useState<MasterStatus>({
    username: "admin",
    hasPin: false,
    tgConfigured: false,
    tgChatMasked: "",
    tgSource: "env",
    envLocked: false,
  });

  const [themeMode, setThemeMode] = useState<"light" | "dark">(() => {
    try {
      return localStorage.getItem("fbr_admin_theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  const toggleTheme = useCallback(() => {
    setThemeMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try { localStorage.setItem("fbr_admin_theme", next); } catch {}
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-admin-theme", next);
      }
      return next;
    });
  }, []);

  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("adm_lang") as Lang) || "en");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pinned, setPinned] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("adm_pins") || "null") || ["rev_total", "ord_total", "aov", "rev_trend", "pay_share", "hours"]; } catch { return []; }
  });

  const toast = useCallback((msg: string, kind: Toast["kind"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);

  const log = useCallback((action: string, target: string) => {
    setLogsList((prev) => [
      {
        id: "l" + Date.now() + Math.random(),
        time: new Date().toISOString(),
        actor: authUser?.email || "Master Admin",
        role: authUser?.role === "staff" ? "Staff" : "Master",
        action,
        target,
        ip: "—",
      },
      ...prev,
    ]);
  }, [authUser]);

  const hasPerm = useCallback((mod: string, action: "view" | "create" | "edit" | "delete" = "view"): boolean => {
    if (!authUser || authUser.role !== "staff") return true;
    const perms = authUser.permissions;
    if (Array.isArray(perms)) return perms.includes("*") || perms.includes(mod);
    if (perms && typeof perms === "object") {
      const mp = (perms as Record<string, Perm>)[mod];
      if (!mp) return false;
      if (action === "create") return Boolean(mp.create ?? mp.edit);
      return Boolean(mp[action]);
    }
    return false;
  }, [authUser]);

  // ── Real Data Loader from AlwaysData + Cloudflare D1 ──────────────────────
  const reloadAll = useCallback(async () => {
    if (!getAdminToken()) return;
    setLoading(true);
    try {
      const isStaff = authUser?.role === "staff";
      const safeQ = async (sql: string) => {
        try {
          const [res] = await d1BatchQuery([{ sql }]);
          return res || [];
        } catch {
          return [];
        }
      };

      let ordRows: any[] = [], prodRows: any[] = [], catRows: any[] = [], pcRows: any[] = [];
      let banRows: any[] = [], secRows: any[] = [], zoneRows: any[] = [], promoRows: any[] = [];
      let addonRows: any[] = [], revRows: any[] = [], setRows: any[] = [], brandRows: any[] = [], devRows: any[] = [];

      try {
        const batch = await d1BatchQuery([
          { sql: "SELECT * FROM orders ORDER BY created_at DESC" },
          { sql: "SELECT * FROM products ORDER BY created_at DESC" },
          { sql: "SELECT * FROM categories ORDER BY sort_order ASC" },
          { sql: "SELECT * FROM product_categories" },
          { sql: "SELECT * FROM banners ORDER BY sort_order ASC" },
          { sql: "SELECT * FROM home_sections ORDER BY sort_order ASC" },
          { sql: "SELECT * FROM delivery_zones" },
          { sql: "SELECT * FROM promos ORDER BY created_at DESC" },
          { sql: "SELECT * FROM addons" },
          { sql: "SELECT * FROM reviews ORDER BY created_at DESC" },
          { sql: "SELECT * FROM settings WHERE id = 1" },
          { sql: "SELECT * FROM brands ORDER BY sort_order ASC" },
        ]);
        [ordRows, prodRows, catRows, pcRows, banRows, secRows, zoneRows, promoRows, addonRows, revRows, setRows, brandRows] = batch;
      } catch {
        [ordRows, prodRows, catRows, pcRows, banRows, secRows, zoneRows, promoRows, addonRows, revRows, setRows, brandRows] = await Promise.all([
          safeQ("SELECT * FROM orders ORDER BY created_at DESC"),
          safeQ("SELECT * FROM products ORDER BY created_at DESC"),
          safeQ("SELECT * FROM categories ORDER BY sort_order ASC"),
          safeQ("SELECT * FROM product_categories"),
          safeQ("SELECT * FROM banners ORDER BY sort_order ASC"),
          safeQ("SELECT * FROM home_sections ORDER BY sort_order ASC"),
          safeQ("SELECT * FROM delivery_zones"),
          safeQ("SELECT * FROM promos ORDER BY created_at DESC"),
          safeQ("SELECT * FROM addons"),
          safeQ("SELECT * FROM reviews ORDER BY created_at DESC"),
          safeQ("SELECT * FROM settings WHERE id = 1"),
          safeQ("SELECT * FROM brands ORDER BY sort_order ASC"),
        ]);
      }

      if (!isStaff) {
        devRows = await safeQ("SELECT * FROM devtools");
      }

      // 1. Settings & Devtools
      const sr = setRows?.[0] || {};
      const devMap: Record<string, string> = {};
      (devRows || []).forEach((r: any) => {
        if (r?.key_name) devMap[String(r.key_name)] = String(r.value ?? "");
      });

      const aiCfg = safeJson<Record<string, any>>(sr.ai_config, {});
      const themeColors = safeJson<Partial<BrandColors>>(sr.theme_colors || devMap.theme_colors, {});
      const mergedBrandColors: BrandColors = {
        ...readInitialBrandColors(),
        ...themeColors,
      };
      applyBrandColorsToDom(mergedBrandColors);

      const mainChats = safeJson<string[]>(sr.telegram_main_chats, []);
      const trackCfg = safeJson<Record<string, any>>(devMap.tracking_config, {});

      // Check repeat config row in promos
      const repRow = (promoRows || []).find((r: any) => Number(r.is_repeated_config) === 1 || r.code === "__REPEATED_CFG__");

      const nextSettings: Settings = {
        storeName: sr.store_name || INITIAL_SETTINGS.storeName,
        logo: sr.logo_url || "",
        favicon: sr.favicon_url || "",
        footer: sr.footer_text || "",
        whatsapp: sr.whatsapp_number || "",
        facebook: sr.facebook_url || "",
        instagram: sr.instagram_url || "",
        youtube: sr.youtube_url || "",
        seoTitle: sr.seo_title || "",
        seoDesc: sr.seo_description || "",
        seoKeywords: sr.seo_keywords || "",
        seoOgImage: sr.seo_og_image || "",
        canonical: sr.site_url || "",
        gsc: sr.google_site_verification || "",
        cod: sr.allow_cod !== undefined ? Boolean(Number(sr.allow_cod)) : true,
        funPromise: sr.enable_fun_checkbox !== undefined ? Boolean(Number(sr.enable_fun_checkbox)) : true,
        allowWhatsappOrder: sr.allow_whatsapp_order !== undefined ? Boolean(Number(sr.allow_whatsapp_order)) : true,
        msgOrder: sr.allow_msg_order !== undefined ? Boolean(Number(sr.allow_msg_order)) : true,
        advanceAmount: Number(sr.advance_amount ?? 0),
        advanceMode: sr.advance_method === "auto" ? "auto" : "manual",
        bkashNumber: sr.bkash_number || "",
        nagadNumber: sr.nagad_number || "",
        binanceManualUid: sr.binance_manual_uid || "",
        gateway: sr.verify_mode || "cloudflare",
        gatewayVersion: sr.gateway_version || "v1",
        gatewayKey: sr.gateway_api_key || "",
        gatewayKeyV2: sr.gateway_api_key_v2 || "",
        binanceUid: sr.binance_pay_uid || "",
        binanceProxyUrl: sr.binance_proxy_url || "",
        binanceApiKey: sr.binance_api_key || "",
        binanceApiSecret: sr.binance_api_secret || "",
        web3WalletAddress: sr.web3_wallet_address || "",
        usdRate: Number(sr.usd_to_bdt_rate || 120),
        crypto: Boolean(sr.binance_pay_uid || sr.binance_manual_uid || sr.binance_api_key || sr.web3_wallet_address || (safeJson<any[]>(sr.crypto_coins, []).length > 0)),
        cryptoCoins: (safeJson<any[]>(sr.crypto_coins, []) || []).map((c: any): CryptoCoin =>
          typeof c === "string"
            ? { symbol: c, name: c, networks: [] }
            : {
                symbol: String(c?.symbol || ""),
                name: String(c?.name || ""),
                networks: Array.isArray(c?.networks)
                  ? c.networks.map((n: any) => ({ name: String(n?.name || ""), address: String(n?.address || ""), qr_url: String(n?.qr_url || "") }))
                  : [],
              }
        ),
        messagingApps: (safeJson<any[]>(sr.messaging_apps, []) || []).map((a: any): MessagingApp => ({
          key: String(a?.key || ""),
          name: String(a?.name || a?.key || ""),
          enabled: Boolean(a?.enabled),
          contact: String(a?.contact || ""),
        })),
        pickup: Boolean(Number(sr.allow_pickup ?? 0)),
        pickupAddress: sr.store_address || "",
        pickupMap: sr.store_map_link || "",
        tgMainToken: sr.telegram_main_bot || "",
        tgMainChat: Array.isArray(mainChats) && mainChats.length ? mainChats.join(", ") : String(sr.telegram_main_chats || ""),
        tgMainChats: Array.isArray(mainChats) ? mainChats : [],
        tgDraftToken: sr.telegram_draft_bot || "",
        tgDraftChat: sr.telegram_draft_chat || "",
        tgPickupToken: sr.pickup_bot_token || "",
        tgPickupChat: sr.pickup_chat_id || "",
        notifyNew: aiCfg.notifyNew !== undefined ? Boolean(aiCfg.notifyNew) : true,
        notifyCancel: aiCfg.notifyCancel !== undefined ? Boolean(aiCfg.notifyCancel) : true,
        notifyReview: aiCfg.notifyReview !== undefined ? Boolean(aiCfg.notifyReview) : true,
        notifyLowStock: aiCfg.notifyLowStock !== undefined ? Boolean(aiCfg.notifyLowStock) : true,
        imageProvider: aiCfg.imageProvider || (sr.review_imgbb_key ? "ImgBB" : "R2"),
        imgbbApiKey: aiCfg.imgbbApiKey || sr.review_imgbb_key || "",
        reviewImgbbKey: sr.review_imgbb_key || "",
        supabaseEdgeUrl: sr.supabase_edge_url || "",
        hfApiUrl: sr.hf_api_url || "",
        aiAdminKey: aiCfg.adminKey || aiCfg.apiKey || "",
        aiUserKey: aiCfg.userKey || "",
        aiModel: aiCfg.adminModel || "Flash",
        aiAudioModel: aiCfg.audioModel || "gemini-2.5-flash-native-audio-preview",
        aiChat: aiCfg.chatEnabled !== undefined ? Boolean(aiCfg.chatEnabled) : true,
        aiVoice: aiCfg.voiceEnabled !== undefined ? Boolean(aiCfg.voiceEnabled) : true,
        aiCompare: aiCfg.compareEnabled !== undefined ? Boolean(aiCfg.compareEnabled) : true,
        repeatEnabled: repRow ? Boolean(Number(repRow.is_active ?? 1)) : false,
        repeatType: repRow?.rep_type === "percent" || repRow?.rep_type === "Percent" ? "Percent" : "Flat",
        repeatValue: Number(repRow?.rep_value ?? 100),
        repeatCap: Number(repRow?.rep_cap ?? 0),
        repeatDays: Number(repRow?.rep_expiry_days ?? 30),
        repeatMin: Number(repRow?.rep_min_spend ?? 500),
        repeatFreeShip: repRow?.rep_del_reward === "free",
        lowStockLimit: Number(aiCfg.lowStockLimit ?? 5),
        maintenance: Boolean(Number(sr.maintenance_mode ?? (devMap.maintenance_mode === "1" ? 1 : 0))),
        maintenanceMsg: sr.maintenance_message || devMap.maintenance_message || INITIAL_SETTINGS.maintenanceMsg,
        brandColors: mergedBrandColors,
        templateVersion: devMap.template_version || INITIAL_SETTINGS.templateVersion,
        trackingMode: trackCfg.mode || devMap.tracking_mode || "Smart Fallback",
        metaPixel: trackCfg.metaPixel || devMap.meta_pixel_id || "",
        ga4: trackCfg.ga4 || devMap.ga4_measurement_id || "",
        gtm: trackCfg.gtm || devMap.gtm_container_id || "",
        clarity: trackCfg.clarity || devMap.clarity_project_id || "",
        trackingUrl: trackCfg.trackingUrl || devMap.custom_tracking_url || "",
      };
      setSettingsState(nextSettings);
      if (devMap.custom_css !== undefined) setCustomCssState(devMap.custom_css);

      // 2. Brands
      const mainBrand: Brand = {
        id: "main",
        name: nextSettings.storeName || "Main Store",
        slug: "",
        tagline: "Primary Storefront",
        color: mergedBrandColors.primary || "#8b1a1a",
        emoji: "🏪",
        logoUrl: nextSettings.logo || "",
        faviconUrl: nextSettings.favicon || "",
        active: true,
        seoTitle: nextSettings.seoTitle || "",
        isMain: true,
      };
      const subBrands: Brand[] = (brandRows || []).map((b: any) => {
        const tc = safeJson<Record<string, string>>(b.theme_colors, {});
        return {
          id: String(b.id),
          name: String(b.name || b.slug || "Brand"),
          slug: String(b.slug || ""),
          tagline: String(b.tagline || ""),
          color: tc.primary || "#8b1a1a",
          accentColor: tc.accent || tc.primary_light || "#b03535",
          emoji: b.logo_url ? "🏷️" : "🏪",
          logoUrl: b.logo_url || "",
          faviconUrl: b.favicon_url || "",
          active: Boolean(Number(b.is_active ?? 1)),
          seoTitle: b.seo_title || "",
          seoDesc: b.seo_description || "",
          seoKeywords: b.seo_keywords || "",
          seoOgImage: b.seo_og_image || "",
          footerText: b.footer_text || "",
          whatsapp: b.whatsapp_number || "",
          facebook: b.facebook_url || "",
          instagram: b.instagram_url || "",
          youtube: b.youtube_url || "",
          sort: Number(b.sort_order ?? 0),
          isMain: false,
        };
      });
      setBrandsList([mainBrand, ...subBrands.filter((b) => b.id !== "main")]);

      // 3. Categories & Product-Categories map
      const pcMap = new Map<string, string[]>();
      (pcRows || []).forEach((r: any) => {
        const pid = String(r.product_id || "");
        const cid = String(r.category_id || "");
        if (!pid || !cid) return;
        const cur = pcMap.get(pid) || [];
        if (!cur.includes(cid)) cur.push(cid);
        pcMap.set(pid, cur);
      });

      setCategoriesList(
        (catRows || []).map((c: any, idx: number) => ({
          id: String(c.id),
          name: String(c.name || ""),
          icon: String(c.icon_url || c.icon || "🛍️"),
          brandId: c.brand_id ? String(c.brand_id) : "main",
          sort: Number(c.sort_order ?? idx + 1),
          active: Boolean(Number(c.is_active ?? 1)),
          sharedBrandIds: safeJson<string[]>(c.shared_brand_ids, []),
          shareIncludeProducts: Boolean(Number(c.share_include_products ?? 0)),
          shareUrlMode: c.share_url_mode === "main" ? "main" : "brand",
        }))
      );

      // 4. Products
      setProductsList(
        (prodRows || []).map((p: any) => {
          const gallery = safeJson<string[]>(p.gallery_images, []);
          const variants = parseVariantsFromD1(p.variants);
          const id = String(p.id);
          return {
            id,
            name: String(p.name || ""),
            sku: String(p.sku || ""),
            brandId: p.brand_id ? String(p.brand_id) : "main",
            showOnMain: Boolean(Number(p.show_on_main ?? 0)),
            catIds: pcMap.get(id) || [],
            price: Number(p.base_price ?? 0),
            cost: Number(p.cost_price ?? 0),
            flash: Number(p.flash_sale_price ?? 0),
            flashEnd: p.flash_sale_end ? String(p.flash_sale_end) : undefined,
            active: Boolean(Number(p.is_active ?? 1)),
            featured: Boolean(Number(p.is_featured ?? 0)),
            addOnce: Boolean(Number(p.is_add_once ?? 0)),
            emoji: "🛍️",
            hue: hashHue(id + (p.name || "")),
            galleryImages: Array.isArray(gallery) ? gallery : [],
            videoUrl: p.video_url ? String(p.video_url) : "",
            videoType: p.video_type ? String(p.video_type) : "auto",
            desc: String(p.description || ""),
            variants,
            tags: String(p.tags || ""),
            seoTitle: String(p.seo_title || ""),
            seoSlug: String(p.slug || ""),
            seoDesc: String(p.seo_description || ""),
            seoKeywords: String(p.seo_keywords || ""),
            views: Number(p.views ?? 0),
            created: String(p.created_at || new Date().toISOString()),
          };
        })
      );

      // 5. Orders
      const phoneCounts = new Map<string, number>();
      (ordRows || []).forEach((o: any) => {
        const ph = String(o.customer_phone || "").trim();
        if (ph) phoneCounts.set(ph, (phoneCounts.get(ph) || 0) + 1);
      });

      setOrdersList(
        (ordRows || []).map((o: any): Order => {
          const rawItems = safeJson<any[]>(o.items, []);
          const items: OrderItem[] = (Array.isArray(rawItems) ? rawItems : []).map((it: any) => ({
            productId: String(it?.productId || it?.id || it?.product_id || ""),
            name: String(it?.name || it?.product_name || "Item"),
            qty: Number(it?.qty || it?.quantity || 1),
            price: Number(it?.price || it?.unit_price || 0),
            color: String(it?.color || it?.colorName || "Default"),
            size: String(it?.size || "Std"),
            image: it?.image || it?.imageUrl || undefined,
            sku: it?.sku || undefined,
          }));
          const rawAddons = safeJson<any[]>(o.addons, []);
          const addons: string[] = (Array.isArray(rawAddons) ? rawAddons : []).map((a: any) =>
            typeof a === "string" ? a : String(a?.name || "")
          ).filter(Boolean);

          const rawPay = String(o.payment_status || "Unpaid");
          const payStatus: PayStatus =
            rawPay === "Paid" ? "Paid" : rawPay === "Advance Paid" ? "Advance Paid" : "Unpaid";
          const rawSt = String(o.status || "Pending");
          const validStatuses: Status[] = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"];
          const status: Status = (validStatuses.includes(rawSt as Status) ? rawSt : "Pending") as Status;
          const ph = String(o.customer_phone || "").trim();

          return {
            id: String(o.id),
            orderGroupId: o.order_group_id ? String(o.order_group_id) : undefined,
            date: String(o.created_at || new Date().toISOString()),
            customerPhone: ph,
            customerName: String(o.customer_name || "Customer"),
            email: o.customer_email ? String(o.customer_email) : undefined,
            division: String(o.division || ""),
            district: String(o.district || ""),
            upazila: String(o.upazila || ""),
            address: String(o.address || ""),
            items: items.length ? items : [{ productId: "", name: "Order Item", qty: 1, price: Number(o.grand_total || 0), color: "Default", size: "Std" }],
            subtotal: Number(o.subtotal ?? o.cart_total ?? o.grand_total ?? 0),
            promoCode: o.promo_code ? String(o.promo_code) : undefined,
            promoDiscount: Number(o.promo_discount ?? o.discount ?? 0),
            deliveryCharge: Number(o.delivery_charge ?? 0),
            deliveryDiscount: Number(o.delivery_discount ?? 0),
            addons,
            addonTotal: Number(o.addon_total ?? 0),
            grand: Number(o.grand_total ?? o.final_total ?? 0),
            advance: Number(o.advance_payable ?? 0),
            method: String(o.payment_method || "COD"),
            trxId: o.payment_trx_id || o.transaction_id || undefined,
            payStatus,
            status,
            type: o.order_type === "pickup" ? "pickup" : "delivery",
            brandId: o.brand_id ? String(o.brand_id) : "main",
            source: String(o.traffic_source || o.source || "Direct"),
            device: String(o.device_type || "Mobile"),
            failed: rawPay.toLowerCase().includes("fail"),
            cancelReason: o.cancel_reason ? String(o.cancel_reason) : undefined,
            isRepeat: (phoneCounts.get(ph) || 0) > 1,
            note: o.admin_note || o.customer_note || undefined,
            courierName: o.courier_name ? String(o.courier_name) : undefined,
            trackingNumber: o.tracking_number ? String(o.tracking_number) : undefined,
            trackingUrl: o.tracking_url ? String(o.tracking_url) : undefined,
          };
        })
      );

      // 6. Banners
      setBannersList(
        (banRows || []).map((b: any, idx: number): Banner => ({
          id: String(b.id),
          title: String(b.title || ""),
          subtitle: String(b.subtitle || ""),
          imageUrl: b.image_url ? String(b.image_url) : "",
          brandId: b.brand_id ? String(b.brand_id) : "main",
          hue: hashHue(String(b.id || idx)),
          link: String(b.link_url || ""),
          linkType: b.link_type ? String(b.link_type) : "url",
          areaX: b.area_x !== undefined ? Number(b.area_x) : undefined,
          areaY: b.area_y !== undefined ? Number(b.area_y) : undefined,
          areaW: b.area_w !== undefined ? Number(b.area_w) : undefined,
          areaH: b.area_h !== undefined ? Number(b.area_h) : undefined,
          sort: Number(b.sort_order ?? idx + 1),
          active: Boolean(Number(b.is_active ?? 1)),
          impressions: Number(b.impressions ?? 0),
          clicks: Number(b.clicks ?? 0),
        }))
      );

      // 7. Home Sections
      setSectionsList(
        (secRows || []).map((s: any, idx: number): Section => {
          const rawT = String(s.type || s.section_type || "category").toLowerCase();
          const type: Section["type"] =
            rawT === "custom" ? "Custom" : rawT.includes("all") ? "All Products" : "Category";
          return {
            id: String(s.id),
            title: String(s.title || ""),
            type,
            brandId: s.brand_id ? String(s.brand_id) : "main",
            catId: s.category_id ? String(s.category_id) : undefined,
            productIds: safeJson<string[]>(s.product_ids, []),
            max: Number(s.max_products ?? 10) || 10,
            sort: Number(s.sort_order ?? s.display_order ?? idx + 1),
            active: Boolean(Number(s.is_active ?? 1)),
          };
        })
      );

      // 8. Delivery Zones
      setZonesList(
        (zoneRows || []).map((z: any): Zone => {
          let dists = safeJson<string[]>(z.districts, []);
          if (!Array.isArray(dists) && typeof z.districts === "string") {
            dists = z.districts.split(",").map((x: string) => x.trim()).filter(Boolean);
          }
          return {
            id: String(z.id),
            name: String(z.zone_name || z.name || ""),
            charge: Number(z.charge ?? 0),
            districts: Array.isArray(dists) ? dists : [],
          };
        })
      );

      // 9. Promos
      setPromosList(
        (promoRows || [])
          .filter((p: any) => Number(p.is_repeated_config) !== 1 && p.code !== "__REPEATED_CFG__")
          .map((p: any): Promo => ({
            id: String(p.id),
            code: String(p.code || ""),
            visibility: String(p.type || "public").toLowerCase() === "private" ? "Private" : "Public",
            discountType: String(p.disc_type || "flat").toLowerCase().startsWith("perc") ? "Percent" : "Flat",
            value: Number(p.disc_val ?? p.discount ?? 0),
            cap: p.max_cap ? Number(p.max_cap) : undefined,
            usageLimit: p.usage_limit ? Number(p.usage_limit) : undefined,
            expiry: p.expires_at ? String(p.expires_at) : undefined,
            minSpend: Number(p.min_spend ?? 0),
            freeDelivery: p.del_reward === "free",
            delReward: String(p.del_reward || "none"),
            delDiscAmount: p.del_disc_amount ? Number(p.del_disc_amount) : undefined,
            delDiscCap: p.del_disc_cap ? Number(p.del_disc_cap) : undefined,
            applicableProducts: safeJson<string[]>(p.applicable_products, []),
            applicableCategories: safeJson<string[]>(p.applicable_categories, []),
            applicableDistricts: safeJson<string[]>(p.applicable_districts, []),
            applicablePayments: safeJson<string[]>(p.applicable_payments, []),
            brandId: p.brand_id ? String(p.brand_id) : "all",
            active: Boolean(Number(p.is_active ?? 1)),
            note: String(p.note || ""),
          }))
      );

      // 10. Addons
      setAddonsList(
        (addonRows || []).map((a: any): Addon => ({
          id: String(a.id),
          icon: String(a.icon || "🎁"),
          name: String(a.name || ""),
          price: Number(a.price ?? 0),
          active: Boolean(Number(a.is_active ?? 1)),
        }))
      );

      // 11. Reviews
      setReviewsList(
        (revRows || []).map((r: any): Review => ({
          id: String(r.id),
          productId: String(r.product_id || ""),
          name: String(r.customer_name || "Customer"),
          phone: r.customer_phone ? String(r.customer_phone) : undefined,
          rating: Number(r.rating ?? 5),
          text: String(r.review_text || ""),
          image: r.review_image ? String(r.review_image) : undefined,
          date: String(r.created_at || new Date().toISOString()),
          approved: Boolean(Number(r.is_approved ?? 0)),
          hasPhoto: Boolean(r.review_image),
        }))
      );

      // 12. Master Admin Only: Staff, Active Sessions, Master Status, Audit Logs
      if (!isStaff) {
        const [stRes, sessRes, statRes, logRes] = await Promise.all([
          proxyFetch("/staff", { action: "list" }).catch(() => null),
          proxyFetch("/master-security", { action: "list_sessions" }).catch(() => null),
          proxyFetch("/master-security", { action: "status" }).catch(() => null),
          proxyFetch("/staff-logs", { limit: 200 }).catch(() => null),
        ]);

        if (stRes?.success && Array.isArray(stRes.staff)) {
          setStaffList(
            stRes.staff.map((s: any): Staff => {
              const rawP = s.permissions || {};
              const perms: Record<string, Perm> = {};
              MODULES.forEach((m) => {
                const mp = rawP[m] || {};
                perms[m] = {
                  view: Boolean(mp.view),
                  create: Boolean(mp.create ?? mp.edit),
                  edit: Boolean(mp.edit),
                  delete: Boolean(mp.delete),
                };
              });
              return {
                id: String(s.id),
                name: String(s.name || ""),
                email: String(s.email || ""),
                tg: String(s.telegram_chat_id || ""),
                perms,
                lastLogin: s.last_login ? String(s.last_login) : "",
                active: Boolean(s.is_active ?? true),
              };
            })
          );
        }

        if (sessRes?.success && Array.isArray(sessRes.sessions)) {
          setSessionsList(
            sessRes.sessions.map((s: any): Session => ({
              id: String(s.jti),
              who: String(s.sub || "Admin"),
              role: s.role === "master_admin" ? "Master" : "Staff",
              ip: String(s.ip || ""),
              device: String(s.ua_label || "Browser"),
              expires: s.expires_at ? new Date(Number(s.expires_at)).toISOString() : new Date().toISOString(),
              isCurrent: Boolean(s.is_current),
            }))
          );
        }

        if (statRes?.success && statRes.data) {
          const d = statRes.data;
          setMasterStatus({
            username: String(d.username || "admin"),
            hasPin: Boolean(d.has_pin),
            tgConfigured: Boolean(d.telegram?.configured),
            tgChatMasked: String(d.telegram?.master_chat_masked || ""),
            tgSource: String(d.telegram?.source || "env"),
            envLocked: Boolean(d.telegram?.env_locked),
          });
        }

        if (logRes?.success && Array.isArray(logRes.logs)) {
          setLogsList(
            logRes.logs.map((l: any, idx: number): LogEntry => ({
              id: String(l.id || "log_" + idx),
              time: String(l.time || l.created_at || new Date().toISOString()),
              actor: String(l.actor || "admin"),
              role: l.role === "master_admin" ? "Master" : String(l.role || "Staff"),
              action: String(l.action || ""),
              target: String(l.target || "") + (l.details ? ` (${l.details})` : ""),
              details: l.details ? String(l.details) : undefined,
              ip: String(l.ip || ""),
            }))
          );
        }
      }
    } catch (err: any) {
      toast(err?.message || "Failed to load store data", "err");
    } finally {
      setLoading(false);
    }
  }, [authUser, toast]);

  useEffect(() => {
    if (authUser && getAdminToken()) {
      reloadAll();
    }
  }, [authUser, reloadAll]);

  // ── Collection Wrappers with Real AlwaysData + D1 Persistence ──────────────
  const brands: Coll<Brand> = useMemo(() => ({
    items: brandsList,
    set: setBrandsList,
    add: (b) => {
      setBrandsList((prev) => [...prev, b]);
      proxyFetch("/brands", {
        action: "save",
        id: b.id.startsWith("b_") ? "" : b.id,
        name: b.name,
        slug: b.slug,
        tagline: b.tagline,
        logo_url: b.logoUrl || "",
        favicon_url: b.faviconUrl || "",
        theme_colors: { primary: b.color, accent: b.accentColor || b.color },
        footer_text: b.footerText || "",
        whatsapp_number: b.whatsapp || "",
        facebook_url: b.facebook || "",
        instagram_url: b.instagram || "",
        youtube_url: b.youtube || "",
        seo_title: b.seoTitle || "",
        seo_description: b.seoDesc || "",
        seo_keywords: b.seoKeywords || "",
        seo_og_image: b.seoOgImage || "",
        is_active: b.active ? 1 : 0,
        sort_order: b.sort ?? brandsList.length,
      }).then((res) => {
        if (!res?.success) toast(res?.error || "Brand save failed", "err");
        else if (res.brand?.id) {
          setBrandsList((prev) => prev.map((x) => (x.id === b.id ? { ...x, id: String(res.brand.id) } : x)));
        }
      }).catch((e) => toast(e.message, "err"));
    },
    update: (id, p) => {
      setBrandsList((prev) => {
        const next = prev.map((i) => (i.id === id ? { ...i, ...p } : i));
        const cur = next.find((i) => i.id === id);
        if (cur && !cur.isMain) {
          proxyFetch("/brands", {
            action: "save",
            id: cur.id,
            name: cur.name,
            slug: cur.slug,
            tagline: cur.tagline,
            logo_url: cur.logoUrl || "",
            favicon_url: cur.faviconUrl || "",
            theme_colors: { primary: cur.color, accent: cur.accentColor || cur.color },
            footer_text: cur.footerText || "",
            whatsapp_number: cur.whatsapp || "",
            facebook_url: cur.facebook || "",
            instagram_url: cur.instagram || "",
            youtube_url: cur.youtube || "",
            seo_title: cur.seoTitle || "",
            seo_description: cur.seoDesc || "",
            seo_keywords: cur.seoKeywords || "",
            seo_og_image: cur.seoOgImage || "",
            is_active: cur.active ? 1 : 0,
            sort_order: cur.sort ?? 0,
          }).then((res) => {
            if (!res?.success) toast(res?.error || "Brand update failed", "err");
          }).catch((e) => toast(e.message, "err"));
        }
        return next;
      });
    },
    remove: (id) => {
      setBrandsList((prev) => prev.filter((i) => i.id !== id));
      proxyFetch("/brands", { action: "delete", id }).then((res) => {
        if (!res?.success) toast(res?.error || "Brand delete failed", "err");
      }).catch((e) => toast(e.message, "err"));
    },
  }), [brandsList, toast]);

  const categories: Coll<Category> = useMemo(() => ({
    items: categoriesList,
    set: setCategoriesList,
    add: (c) => {
      const id = c.id || ("cat_" + Date.now());
      const next = { ...c, id };
      setCategoriesList((prev) => [...prev, next]);
      d1AdminQuery(
        "INSERT INTO categories (id, name, icon_url, sort_order, is_active, brand_id, shared_brand_ids, share_include_products, share_url_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          next.name,
          next.icon || "🛍️",
          next.sort || 1,
          next.active ? 1 : 0,
          next.brandId && next.brandId !== "main" ? next.brandId : null,
          JSON.stringify(next.sharedBrandIds || []),
          next.shareIncludeProducts ? 1 : 0,
          next.shareUrlMode || "brand",
        ]
      ).catch(() =>
        d1AdminQuery(
          "INSERT INTO categories (id, name, icon_url, sort_order, is_active, brand_id) VALUES (?, ?, ?, ?, ?, ?)",
          [id, next.name, next.icon || "🛍️", next.sort || 1, next.active ? 1 : 0, next.brandId && next.brandId !== "main" ? next.brandId : null]
        )
      ).catch((e) => toast(e.message, "err"));
    },
    update: (id, p) => {
      setCategoriesList((prev) => {
        const list = prev.map((i) => (i.id === id ? { ...i, ...p } : i));
        const cur = list.find((i) => i.id === id);
        if (cur) {
          d1AdminQuery(
            "UPDATE categories SET name = ?, icon_url = ?, sort_order = ?, is_active = ?, brand_id = ?, shared_brand_ids = ?, share_include_products = ?, share_url_mode = ? WHERE id = ?",
            [
              cur.name,
              cur.icon || "🛍️",
              cur.sort || 1,
              cur.active ? 1 : 0,
              cur.brandId && cur.brandId !== "main" ? cur.brandId : null,
              JSON.stringify(cur.sharedBrandIds || []),
              cur.shareIncludeProducts ? 1 : 0,
              cur.shareUrlMode || "brand",
              id,
            ]
          ).catch(() =>
            d1AdminQuery(
              "UPDATE categories SET name = ?, icon_url = ?, sort_order = ?, is_active = ?, brand_id = ? WHERE id = ?",
              [cur.name, cur.icon || "🛍️", cur.sort || 1, cur.active ? 1 : 0, cur.brandId && cur.brandId !== "main" ? cur.brandId : null, id]
            )
          ).catch((e) => toast(e.message, "err"));
        }
        return list;
      });
    },
    remove: (id) => {
      setCategoriesList((prev) => prev.filter((i) => i.id !== id));
      d1AdminBatch([
        { sql: "DELETE FROM product_categories WHERE category_id = ?", params: [id] },
        { sql: "DELETE FROM categories WHERE id = ?", params: [id] },
      ]).catch((e) => toast(e.message, "err"));
    },
  }), [categoriesList, toast]);

  const serializeProductPayload = (p: Product) => ({
    id: p.id,
    name: p.name,
    description: p.desc || "",
    base_price: Number(p.price || 0),
    cost_price: Number(p.cost || 0),
    flash_sale_price: Number(p.flash || 0),
    flash_sale_end: p.flash > 0 && p.flashEnd ? p.flashEnd : null,
    gallery_images: p.galleryImages || [],
    video_url: p.videoUrl || "",
    video_type: p.videoType || "auto",
    sku: p.sku || "",
    variants: serializeVariantsForD1(p.variants),
    is_active: p.active ? 1 : 0,
    is_featured: p.featured ? 1 : 0,
    is_add_once: p.addOnce ? 1 : 0,
    tags: p.tags || "",
    seo_keywords: p.seoKeywords || p.tags || "",
    seo_title: p.seoTitle || "",
    seo_description: p.seoDesc || "",
    slug: p.seoSlug || "",
    brand_id: p.brandId && p.brandId !== "main" ? p.brandId : null,
    show_on_main: p.brandId && p.brandId !== "main" && p.showOnMain ? 1 : 0,
    category_ids: p.catIds || [],
  });

  const products: Coll<Product> = useMemo(() => ({
    items: productsList,
    set: setProductsList,
    add: (p) => {
      setProductsList((prev) => [p, ...prev]);
      proxyFetch("/add-product", serializeProductPayload(p)).then((res) => {
        if (!res?.success) toast(res?.error || "Product add failed", "err");
        else if (res.id && res.id !== p.id) {
          setProductsList((prev) => prev.map((x) => (x.id === p.id ? { ...x, id: String(res.id) } : x)));
        }
      }).catch((e) => toast(e.message, "err"));
    },
    update: (id, patch) => {
      setProductsList((prev) => {
        const list = prev.map((i) => (i.id === id ? { ...i, ...patch } : i));
        const cur = list.find((i) => i.id === id);
        if (cur) {
          proxyFetch("/update-product", serializeProductPayload(cur)).then((res) => {
            if (!res?.success) toast(res?.error || "Product update failed", "err");
          }).catch((e) => toast(e.message, "err"));
        }
        return list;
      });
    },
    remove: (id) => {
      setProductsList((prev) => prev.filter((i) => i.id !== id));
      proxyFetch("/delete-product", { id }).then((res) => {
        if (!res?.success) toast(res?.error || "Product delete failed", "err");
      }).catch((e) => toast(e.message, "err"));
    },
  }), [productsList, toast]);

  const orders: Coll<Order> = useMemo(() => ({
    items: ordersList,
    set: setOrdersList,
    add: (o) => setOrdersList((prev) => [o, ...prev]),
    update: (id, patch) => {
      setOrdersList((prev) => {
        const list = prev.map((i) => (i.id === id ? { ...i, ...patch } : i));
        const cur = list.find((i) => i.id === id);
        if (cur) {
          const upData: Record<string, any> = {};
          if (patch.status !== undefined) upData.status = cur.status;
          if (patch.payStatus !== undefined) upData.payment_status = cur.payStatus;
          if (patch.trxId !== undefined) upData.payment_trx_id = cur.trxId;
          if (Object.keys(upData).length > 0) {
            proxyFetch("/update-order", { id, upData }).catch((e) => toast(e.message, "err"));
          }
          if (
            patch.courierName !== undefined ||
            patch.trackingNumber !== undefined ||
            patch.trackingUrl !== undefined ||
            patch.note !== undefined ||
            patch.cancelReason !== undefined
          ) {
            d1AdminQuery(
              "UPDATE orders SET courier_name = ?, tracking_number = ?, tracking_url = ?, admin_note = ?, cancel_reason = ? WHERE id = ?",
              [
                cur.courierName || null,
                cur.trackingNumber || null,
                cur.trackingUrl || null,
                cur.note || null,
                cur.cancelReason || null,
                id,
              ]
            ).catch(async () => {
              await d1AdminQuery("ALTER TABLE orders ADD COLUMN courier_name TEXT").catch(() => {});
              await d1AdminQuery("ALTER TABLE orders ADD COLUMN tracking_number TEXT").catch(() => {});
              await d1AdminQuery("ALTER TABLE orders ADD COLUMN tracking_url TEXT").catch(() => {});
              await d1AdminQuery("ALTER TABLE orders ADD COLUMN admin_note TEXT").catch(() => {});
              await d1AdminQuery("ALTER TABLE orders ADD COLUMN cancel_reason TEXT").catch(() => {});
              await d1AdminQuery(
                "UPDATE orders SET courier_name = ?, tracking_number = ?, tracking_url = ?, admin_note = ?, cancel_reason = ? WHERE id = ?",
                [
                  cur.courierName || null,
                  cur.trackingNumber || null,
                  cur.trackingUrl || null,
                  cur.note || null,
                  cur.cancelReason || null,
                  id,
                ]
              );
            }).catch((e) => toast(e.message, "err"));
          }
        }
        return list;
      });
    },
    remove: (id) => {
      setOrdersList((prev) => prev.filter((i) => i.id !== id));
      proxyFetch("/delete-order", { id }).then((res) => {
        if (!res?.success) toast(res?.error || "Order delete failed", "err");
      }).catch((e) => toast(e.message, "err"));
    },
  }), [ordersList, toast]);

  const reviews: Coll<Review> = useMemo(() => ({
    items: reviewsList,
    set: (f) => {
      setReviewsList((prev) => {
        const next = f(prev);
        // Bulk approve check
        if (next.length === prev.length && next.every((r) => r.approved) && prev.some((r) => !r.approved)) {
          d1AdminQuery("UPDATE reviews SET is_approved = 1 WHERE is_approved = 0").catch((e) => toast(e.message, "err"));
        }
        return next;
      });
    },
    add: (r) => setReviewsList((prev) => [r, ...prev]),
    update: (id, p) => {
      setReviewsList((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));
      if (p.approved !== undefined) {
        d1AdminQuery("UPDATE reviews SET is_approved = ? WHERE id = ?", [p.approved ? 1 : 0, id]).catch((e) => toast(e.message, "err"));
      }
    },
    remove: (id) => {
      setReviewsList((prev) => prev.filter((i) => i.id !== id));
      d1AdminQuery("DELETE FROM reviews WHERE id = ?", [id]).catch((e) => toast(e.message, "err"));
    },
  }), [reviewsList, toast]);

  const promos: Coll<Promo> = useMemo(() => ({
    items: promosList,
    set: setPromosList,
    add: (p) => {
      const id = p.id || ("prm_" + Date.now());
      const next = { ...p, id };
      setPromosList((prev) => [next, ...prev]);
      d1AdminQuery(
        `INSERT INTO promos (
          id, code, type, discount, disc_type, disc_val, max_cap, min_spend,
          del_reward, del_disc_amount, del_disc_cap,
          applicable_products, applicable_categories, applicable_districts, applicable_payments,
          is_active, usage_limit, expires_at, brand_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          next.code,
          next.visibility.toLowerCase(),
          next.value,
          next.discountType.toLowerCase(),
          next.value,
          next.cap ?? null,
          next.minSpend || 0,
          next.freeDelivery ? "free" : (next.delReward || "none"),
          next.delDiscAmount ?? null,
          next.delDiscCap ?? null,
          JSON.stringify(next.applicableProducts || []),
          JSON.stringify(next.applicableCategories || []),
          JSON.stringify(next.applicableDistricts || []),
          JSON.stringify(next.applicablePayments || []),
          next.active ? 1 : 0,
          next.usageLimit ?? null,
          next.expiry ?? null,
          next.brandId && next.brandId !== "all" && next.brandId !== "main" ? next.brandId : null,
        ]
      ).catch((e) => toast(e.message, "err"));
    },
    update: (id, patch) => {
      setPromosList((prev) => {
        const list = prev.map((i) => (i.id === id ? { ...i, ...patch } : i));
        const cur = list.find((i) => i.id === id);
        if (cur) {
          d1AdminQuery(
            `UPDATE promos SET
              code = ?, type = ?, discount = ?, disc_type = ?, disc_val = ?, max_cap = ?, min_spend = ?,
              del_reward = ?, del_disc_amount = ?, del_disc_cap = ?,
              applicable_products = ?, applicable_categories = ?, applicable_districts = ?, applicable_payments = ?,
              is_active = ?, usage_limit = ?, expires_at = ?, brand_id = ?
            WHERE id = ?`,
            [
              cur.code,
              cur.visibility.toLowerCase(),
              cur.value,
              cur.discountType.toLowerCase(),
              cur.value,
              cur.cap ?? null,
              cur.minSpend || 0,
              cur.freeDelivery ? "free" : (cur.delReward || "none"),
              cur.delDiscAmount ?? null,
              cur.delDiscCap ?? null,
              JSON.stringify(cur.applicableProducts || []),
              JSON.stringify(cur.applicableCategories || []),
              JSON.stringify(cur.applicableDistricts || []),
              JSON.stringify(cur.applicablePayments || []),
              cur.active ? 1 : 0,
              cur.usageLimit ?? null,
              cur.expiry ?? null,
              cur.brandId && cur.brandId !== "all" && cur.brandId !== "main" ? cur.brandId : null,
              id,
            ]
          ).catch((e) => toast(e.message, "err"));
        }
        return list;
      });
    },
    remove: (id) => {
      setPromosList((prev) => prev.filter((i) => i.id !== id));
      d1AdminQuery("DELETE FROM promos WHERE id = ?", [id]).catch((e) => toast(e.message, "err"));
    },
  }), [promosList, toast]);

  const zones: Coll<Zone> = useMemo(() => ({
    items: zonesList,
    set: setZonesList,
    add: (z) => {
      const id = z.id || ("zn_" + Date.now());
      const next = { ...z, id };
      setZonesList((prev) => [...prev, next]);
      d1AdminQuery(
        "INSERT INTO delivery_zones (id, zone_name, charge, districts, is_active) VALUES (?, ?, ?, ?, 1)",
        [id, next.name, next.charge, JSON.stringify(next.districts || [])]
      ).catch((e) => toast(e.message, "err"));
    },
    update: (id, p) => {
      setZonesList((prev) => {
        const list = prev.map((i) => (i.id === id ? { ...i, ...p } : i));
        const cur = list.find((i) => i.id === id);
        if (cur) {
          d1AdminQuery(
            "UPDATE delivery_zones SET zone_name = ?, charge = ?, districts = ? WHERE id = ?",
            [cur.name, cur.charge, JSON.stringify(cur.districts || []), id]
          ).catch((e) => toast(e.message, "err"));
        }
        return list;
      });
    },
    remove: (id) => {
      setZonesList((prev) => prev.filter((i) => i.id !== id));
      d1AdminQuery("DELETE FROM delivery_zones WHERE id = ?", [id]).catch((e) => toast(e.message, "err"));
    },
  }), [zonesList, toast]);

  const addons: Coll<Addon> = useMemo(() => ({
    items: addonsList,
    set: setAddonsList,
    add: (a) => {
      const id = a.id || ("add_" + Date.now());
      const next = { ...a, id };
      setAddonsList((prev) => [...prev, next]);
      d1AdminQuery(
        "INSERT INTO addons (id, name, price, icon, is_active) VALUES (?, ?, ?, ?, ?)",
        [id, next.name, next.price, next.icon || "🎁", next.active ? 1 : 0]
      ).catch((e) => toast(e.message, "err"));
    },
    update: (id, p) => {
      setAddonsList((prev) => {
        const list = prev.map((i) => (i.id === id ? { ...i, ...p } : i));
        const cur = list.find((i) => i.id === id);
        if (cur) {
          d1AdminQuery(
            "UPDATE addons SET name = ?, price = ?, icon = ?, is_active = ? WHERE id = ?",
            [cur.name, cur.price, cur.icon || "🎁", cur.active ? 1 : 0, id]
          ).catch((e) => toast(e.message, "err"));
        }
        return list;
      });
    },
    remove: (id) => {
      setAddonsList((prev) => prev.filter((i) => i.id !== id));
      d1AdminQuery("DELETE FROM addons WHERE id = ?", [id]).catch((e) => toast(e.message, "err"));
    },
  }), [addonsList, toast]);

  const banners: Coll<Banner> = useMemo(() => ({
    items: bannersList,
    set: setBannersList,
    add: (b) => {
      const id = b.id || ("ban_" + Date.now());
      const next = { ...b, id };
      setBannersList((prev) => [...prev, next]);
      d1AdminQuery(
        "INSERT INTO banners (id, image_url, title, subtitle, link_url, is_active, sort_order, brand_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [id, next.imageUrl || "", next.title, next.subtitle, next.link, next.active ? 1 : 0, next.sort || 1, next.brandId && next.brandId !== "main" ? next.brandId : null]
      ).catch((e) => toast(e.message, "err"));
    },
    update: (id, p) => {
      setBannersList((prev) => {
        const list = prev.map((i) => (i.id === id ? { ...i, ...p } : i));
        const cur = list.find((i) => i.id === id);
        if (cur) {
          d1AdminQuery(
            "UPDATE banners SET image_url = ?, title = ?, subtitle = ?, link_url = ?, is_active = ?, sort_order = ?, brand_id = ? WHERE id = ?",
            [cur.imageUrl || "", cur.title, cur.subtitle, cur.link, cur.active ? 1 : 0, cur.sort || 1, cur.brandId && cur.brandId !== "main" ? cur.brandId : null, id]
          ).catch((e) => toast(e.message, "err"));
        }
        return list;
      });
    },
    remove: (id) => {
      setBannersList((prev) => prev.filter((i) => i.id !== id));
      d1AdminQuery("DELETE FROM banners WHERE id = ?", [id]).catch((e) => toast(e.message, "err"));
    },
  }), [bannersList, toast]);

  const sections: Coll<Section> = useMemo(() => ({
    items: sectionsList,
    set: setSectionsList,
    add: (s) => {
      const id = s.id || ("sec_" + Date.now());
      const next = { ...s, id };
      setSectionsList((prev) => [...prev, next]);
      const dbType = next.type === "Custom" ? "custom" : next.type === "All Products" ? "all" : "category";
      d1AdminQuery(
        "INSERT INTO home_sections (id, title, type, category_id, product_ids, max_products, sort_order, is_active, brand_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          next.title,
          dbType,
          next.catId || null,
          JSON.stringify(next.productIds || []),
          next.max || 10,
          next.sort || 1,
          next.active ? 1 : 0,
          next.brandId && next.brandId !== "main" ? next.brandId : null,
        ]
      ).catch((e) => toast(e.message, "err"));
    },
    update: (id, p) => {
      setSectionsList((prev) => {
        const list = prev.map((i) => (i.id === id ? { ...i, ...p } : i));
        const cur = list.find((i) => i.id === id);
        if (cur) {
          const dbType = cur.type === "Custom" ? "custom" : cur.type === "All Products" ? "all" : "category";
          d1AdminQuery(
            "UPDATE home_sections SET title = ?, type = ?, category_id = ?, product_ids = ?, max_products = ?, sort_order = ?, is_active = ?, brand_id = ? WHERE id = ?",
            [
              cur.title,
              dbType,
              cur.catId || null,
              JSON.stringify(cur.productIds || []),
              cur.max || 10,
              cur.sort || 1,
              cur.active ? 1 : 0,
              cur.brandId && cur.brandId !== "main" ? cur.brandId : null,
              id,
            ]
          ).catch((e) => toast(e.message, "err"));
        }
        return list;
      });
    },
    remove: (id) => {
      setSectionsList((prev) => prev.filter((i) => i.id !== id));
      d1AdminQuery("DELETE FROM home_sections WHERE id = ?", [id]).catch((e) => toast(e.message, "err"));
    },
  }), [sectionsList, toast]);

  const staff: Coll<Staff> = useMemo(() => ({
    items: staffList,
    set: setStaffList,
    add: (s) => setStaffList((prev) => [s, ...prev]),
    update: (id, p) => setStaffList((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i))),
    remove: (id) => {
      setStaffList((prev) => prev.filter((i) => i.id !== id));
      proxyFetch("/staff", { action: "delete", id }).then((res) => {
        if (!res?.success) toast(res?.error || "Failed to delete staff", "err");
      }).catch((e) => toast(e.message, "err"));
    },
  }), [staffList, toast]);

  const logs: Coll<LogEntry> = useMemo(() => ({
    items: logsList,
    set: setLogsList,
    add: (l) => setLogsList((prev) => [l, ...prev]),
    update: (id, p) => setLogsList((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i))),
    remove: (id) => setLogsList((prev) => prev.filter((i) => i.id !== id)),
  }), [logsList]);

  const sessions: Coll<Session> = useMemo(() => ({
    items: sessionsList,
    set: setSessionsList,
    add: (s) => setSessionsList((prev) => [s, ...prev]),
    update: (id, p) => setSessionsList((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i))),
    remove: (id) => {
      setSessionsList((prev) => prev.filter((i) => i.id !== id));
      proxyFetch("/master-security", { action: "revoke_session", jti: id }).catch((e) => toast(e.message, "err"));
    },
  }), [sessionsList, toast]);

  // ── Persist Settings, Repeat Promo Config, Theme & Tracking ──────────────
  const setSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      if (patch.brandColors) {
        applyBrandColorsToDom(next.brandColors);
      }

      const mainChatsArr = next.tgMainChats?.length
        ? next.tgMainChats
        : (next.tgMainChat || "").split(",").map((x) => x.trim()).filter(Boolean);

      // Save main settings table via /update-settings
      proxyFetch("/update-settings", {
        store_name: next.storeName,
        logo_url: next.logo,
        favicon_url: next.favicon,
        footer_text: next.footer,
        whatsapp_number: next.whatsapp,
        facebook_url: next.facebook,
        instagram_url: next.instagram,
        youtube_url: next.youtube,
        bkash_number: next.bkashNumber,
        nagad_number: next.nagadNumber,
        binance_manual_uid: next.binanceManualUid,
        gateway_api_key: next.gatewayKey,
        gateway_api_key_v2: next.gatewayKeyV2,
        gateway_version: next.gatewayVersion,
        allow_cod: next.cod ? 1 : 0,
        enable_fun_checkbox: next.funPromise ? 1 : 0,
        allow_whatsapp_order: next.allowWhatsappOrder ? 1 : 0,
        allow_msg_order: next.msgOrder ? 1 : 0,
        advance_amount: next.advanceAmount,
        advance_method: next.advanceMode,
        telegram_main_bot: next.tgMainToken,
        telegram_main_chats: JSON.stringify(mainChatsArr),
        telegram_draft_bot: next.tgDraftToken,
        telegram_draft_chat: next.tgDraftChat,
        messaging_apps: JSON.stringify(next.messagingApps || []),
        allow_pickup: next.pickup ? 1 : 0,
        store_address: next.pickupAddress,
        store_map_link: next.pickupMap,
        pickup_bot_token: next.tgPickupToken,
        pickup_chat_id: next.tgPickupChat,
        binance_pay_uid: next.binanceUid,
        binance_proxy_url: next.binanceProxyUrl,
        binance_api_key: next.binanceApiKey,
        binance_api_secret: next.binanceApiSecret,
        web3_wallet_address: next.web3WalletAddress,
        usd_to_bdt_rate: next.usdRate,
        verify_mode: next.gateway,
        supabase_edge_url: next.supabaseEdgeUrl,
        hf_api_url: next.hfApiUrl,
        crypto_coins: JSON.stringify(next.cryptoCoins || []),
        review_imgbb_key: next.reviewImgbbKey || next.imgbbApiKey,
        seo_title: next.seoTitle,
        seo_description: next.seoDesc,
        seo_keywords: next.seoKeywords,
        seo_og_image: next.seoOgImage,
        google_site_verification: next.gsc,
        site_url: next.canonical,
        ai_config: JSON.stringify({
          adminKey: next.aiAdminKey,
          userKey: next.aiUserKey,
          adminModel: next.aiModel,
          audioModel: next.aiAudioModel,
          chatEnabled: next.aiChat,
          voiceEnabled: next.aiVoice,
          compareEnabled: next.aiCompare,
          imageProvider: next.imageProvider,
          imgbbApiKey: next.imgbbApiKey,
          lowStockLimit: next.lowStockLimit,
          notifyNew: next.notifyNew,
          notifyCancel: next.notifyCancel,
          notifyReview: next.notifyReview,
          notifyLowStock: next.notifyLowStock,
        }),
      }).catch((e) => toast(e.message, "err"));

      // Persist web3_wallet_address directly in D1 (even if external PHP proxy is not re-deployed)
      d1Query("ALTER TABLE settings ADD COLUMN web3_wallet_address TEXT DEFAULT ''").catch(() => {}).finally(() => {
        d1Query("UPDATE settings SET web3_wallet_address = ? WHERE id = 1", [(next.web3WalletAddress || "").trim()]).catch(() => {});
      });

      // Save maintenance mode if changed
      if (patch.maintenance !== undefined || patch.maintenanceMsg !== undefined) {
        d1AdminBatch([
          { sql: "UPDATE settings SET maintenance_mode = ?, maintenance_message = ? WHERE id = 1", params: [next.maintenance ? 1 : 0, next.maintenanceMsg] },
          { sql: "INSERT OR REPLACE INTO devtools (id, key_name, value) VALUES ('dt_maint', 'maintenance_mode', ?)", params: [next.maintenance ? "1" : "0"] },
          { sql: "INSERT OR REPLACE INTO devtools (id, key_name, value) VALUES ('dt_maint_msg', 'maintenance_message', ?)", params: [next.maintenanceMsg] },
        ]).catch(() => {});
      }

      // Save theme colors / template version if changed
      if (patch.brandColors !== undefined || patch.templateVersion !== undefined) {
        d1AdminBatch([
          { sql: "INSERT OR REPLACE INTO devtools (id, key_name, value) VALUES ('dt_theme', 'theme_colors', ?)", params: [JSON.stringify(next.brandColors)] },
          { sql: "INSERT OR REPLACE INTO devtools (id, key_name, value) VALUES ('dt_tpl', 'template_version', ?)", params: [next.templateVersion] },
        ]).catch(() => {});
      }

      // Save tracking config if changed
      if (
        patch.trackingMode !== undefined ||
        patch.metaPixel !== undefined ||
        patch.ga4 !== undefined ||
        patch.gtm !== undefined ||
        patch.clarity !== undefined ||
        patch.trackingUrl !== undefined
      ) {
        const tJson = JSON.stringify({
          mode: next.trackingMode,
          metaPixel: next.metaPixel,
          ga4: next.ga4,
          gtm: next.gtm,
          clarity: next.clarity,
          trackingUrl: next.trackingUrl,
        });
        d1AdminBatch([
          { sql: "INSERT OR REPLACE INTO devtools (id, key_name, value) VALUES ('dt_track', 'tracking_config', ?)", params: [tJson] },
          { sql: "INSERT OR REPLACE INTO devtools (id, key_name, value) VALUES ('dt_pixel', 'meta_pixel_id', ?)", params: [next.metaPixel] },
          { sql: "INSERT OR REPLACE INTO devtools (id, key_name, value) VALUES ('dt_ga4', 'ga4_measurement_id', ?)", params: [next.ga4] },
          { sql: "INSERT OR REPLACE INTO devtools (id, key_name, value) VALUES ('dt_gtm', 'gtm_container_id', ?)", params: [next.gtm] },
          { sql: "INSERT OR REPLACE INTO devtools (id, key_name, value) VALUES ('dt_clarity', 'clarity_project_id', ?)", params: [next.clarity] },
        ]).catch(() => {});
      }

      // Save Repeat-customer reward config to promos table if changed
      if (
        patch.repeatEnabled !== undefined ||
        patch.repeatType !== undefined ||
        patch.repeatValue !== undefined ||
        patch.repeatCap !== undefined ||
        patch.repeatDays !== undefined ||
        patch.repeatMin !== undefined ||
        patch.repeatFreeShip !== undefined
      ) {
        d1AdminQuery(
          `INSERT OR REPLACE INTO promos (
            id, code, type, is_active, is_repeated_config,
            rep_type, rep_value, rep_cap, rep_expiry_days, rep_min_spend, rep_del_reward
          ) VALUES ('rep_cfg_1', '__REPEATED_CFG__', 'private', ?, 1, ?, ?, ?, ?, ?, ?)`,
          [
            next.repeatEnabled ? 1 : 0,
            next.repeatType.toLowerCase(),
            next.repeatValue,
            next.repeatCap,
            next.repeatDays,
            next.repeatMin,
            next.repeatFreeShip ? "free" : "none",
          ]
        ).catch(() => {});
      }

      return next;
    });
  }, [toast]);

  const saveCustomCss = useCallback((cssStr: string) => {
    setCustomCssState(cssStr);
    d1AdminQuery(
      "INSERT OR REPLACE INTO devtools (id, key_name, value) VALUES ('dt_css', 'custom_css', ?)",
      [cssStr]
    ).catch((e) => toast(e.message, "err"));
  }, [toast]);

  const togglePin = (id: string) =>
    setPinned((p) => {
      const n = p.includes(id) ? p.filter((x) => x !== id) : [...p, id];
      localStorage.setItem("adm_pins", JSON.stringify(n));
      return n;
    });

  const customers = useMemo(() => buildCustomers(orders.items), [orders.items]);

  return {
    brands, categories, products, orders, reviews, promos, zones, addons, banners, sections, staff, logs, sessions,
    settings,
    setSettings,
    customCss,
    saveCustomCss,
    loading,
    reloadAll,
    authUser,
    setAuthUser,
    masterStatus,
    setMasterStatus,
    hasPerm,
    themeMode,
    toggleTheme,
    lang,
    setLang: (l: Lang) => { localStorage.setItem("adm_lang", l); setLang(l); },
    t: (en: string, bn: string) => (lang === "bn" ? bn : en),
    toasts, toast, log, pinned, togglePin, customers,
    brandName: (id: string) => (id === "all" ? "All brands" : brands.items.find((b) => b.id === id)?.name || id),
    brandOf: (id: string) => brands.items.find((b) => b.id === id),
    catName: (id: string) => categories.items.find((c) => c.id === id)?.name || id,
    productOf: (id: string) => products.items.find((p) => p.id === id),
  };
}

export type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const v = useStoreValue();
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}
export const useStore = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("no store");
  return c;
};
