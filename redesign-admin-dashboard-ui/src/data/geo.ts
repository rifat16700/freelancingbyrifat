import type { Perm, Settings } from "../types";

export const GEO_TREE: Record<string, Record<string, string[]>> = {
  Dhaka: {
    Dhaka: ["Mirpur", "Dhanmondi", "Uttara", "Gulshan", "Mohammadpur", "Badda", "Motijheel", "Savar"],
    Gazipur: ["Tongi", "Kaliakair", "Sreepur", "Gazipur Sadar"],
    Narayanganj: ["Sonargaon", "Rupganj", "Fatullah", "Narayanganj Sadar"],
    Tangail: ["Tangail Sadar", "Mirzapur"],
    Narsingdi: ["Narsingdi Sadar", "Madhabdi"],
    Faridpur: ["Faridpur Sadar"],
  },
  Chattogram: {
    Chattogram: ["Pahartali", "Kotwali", "Halishahar", "Agrabad"],
    Cumilla: ["Cumilla Sadar", "Chauddagram", "Daudkandi"],
    "Cox's Bazar": ["Cox's Bazar Sadar", "Teknaf"],
    Noakhali: ["Noakhali Sadar", "Begumganj"],
    Feni: ["Feni Sadar"],
    Brahmanbaria: ["Brahmanbaria Sadar"],
  },
  Rajshahi: {
    Rajshahi: ["Boalia", "Motihar", "Shah Makhdum"],
    Bogura: ["Bogura Sadar", "Sherpur"],
    Pabna: ["Pabna Sadar", "Ishwardi"],
    Sirajganj: ["Sirajganj Sadar"],
  },
  Khulna: {
    Khulna: ["Sonadanga", "Khalishpur", "Khulna Sadar"],
    Jashore: ["Jashore Sadar", "Benapole"],
    Kushtia: ["Kushtia Sadar"],
    Satkhira: ["Satkhira Sadar"],
  },
  Sylhet: {
    Sylhet: ["Zindabazar", "Ambarkhana", "Sylhet Sadar"],
    Moulvibazar: ["Moulvibazar Sadar", "Sreemangal"],
    Habiganj: ["Habiganj Sadar"],
    Sunamganj: ["Sunamganj Sadar"],
  },
  Barishal: {
    Barishal: ["Barishal Sadar", "Bakerganj"],
    Patuakhali: ["Patuakhali Sadar"],
    Bhola: ["Bhola Sadar"],
  },
  Rangpur: {
    Rangpur: ["Rangpur Sadar", "Mithapukur"],
    Dinajpur: ["Dinajpur Sadar"],
    Kurigram: ["Kurigram Sadar"],
  },
  Mymensingh: {
    Mymensingh: ["Mymensingh Sadar", "Trishal"],
    Jamalpur: ["Jamalpur Sadar"],
    Netrokona: ["Netrokona Sadar"],
  },
};

export const PERM_SCHEMA: Record<string, (keyof Perm)[]> = {
  orders: ["view", "edit", "delete"],
  products: ["view", "create", "edit", "delete"],
  reviews: ["view", "edit", "delete"],
  categories: ["view", "create", "edit", "delete"],
  promos: ["view", "create", "edit", "delete"],
  banners: ["view", "create", "edit", "delete"],
  sections: ["view", "create", "edit", "delete"],
  delivery: ["view", "create", "edit", "delete"],
  addons: ["view", "create", "edit", "delete"],
  brands: ["view", "create", "edit", "delete"],
  settings: ["view", "edit"],
};

export const MODULES = Object.keys(PERM_SCHEMA);

export function getDefaultStaffPerms(): Record<string, Perm> {
  const out: Record<string, Perm> = {};
  for (const mod of MODULES) {
    out[mod] = {
      view: mod === "orders",
      create: false,
      edit: mod === "orders",
      delete: false,
    };
  }
  return out;
}

export function getEmptyStaffPerms(): Record<string, Perm> {
  const out: Record<string, Perm> = {};
  for (const mod of MODULES) {
    out[mod] = { view: false, create: false, edit: false, delete: false };
  }
  return out;
}

export function normalizeStaffPerms(raw: unknown): Record<string, Perm> {
  if (!raw) return getDefaultStaffPerms();
  if (Array.isArray(raw)) {
    const out = getEmptyStaffPerms();
    for (const mod of MODULES) {
      const has = raw.includes(mod);
      out[mod] = {
        view: has,
        create: mod !== "orders" && mod !== "reviews" && mod !== "settings" && has,
        edit: has,
        delete: false,
      };
    }
    return out;
  }
  const obj = raw as Record<string, Partial<Perm>>;
  const out = getEmptyStaffPerms();
  for (const mod of MODULES) {
    const m = obj[mod] || {};
    out[mod] = {
      view: Boolean(m.view),
      create: Boolean(m.create),
      edit: Boolean(m.edit),
      delete: Boolean(m.delete),
    };
  }
  return out;
}

export const DEFAULT_BRAND_COLORS = {
  primary: "#8b1a1a",
  primary_light: "#b03535",
  primary_dark: "#680000",
  bg: "#ffffff",
  bg_light: "#fbf8f7",
  bg_card: "#ffffff",
  bg_subtle: "#f7f2f2",
  footer_bg: "#1a0808",
  border: "#e4d8d8",
  border_light: "#f0eaea",
  text_dark: "#1a0808",
  text_body: "#3d2a2a",
  text_muted: "#9e7070",
};

export const defaultSettings: Settings = {
  storeName: "Admin Panel",
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
  funPromise: false,
  allowWhatsappOrder: true,
  msgOrder: true,
  advanceAmount: 0,
  advanceMode: "manual",
  bkashNumber: "",
  nagadNumber: "",
  binanceManualUid: "",
  gateway: "Auto",
  gatewayVersion: "v1",
  gatewayKey: "",
  gatewayKeyV2: "",
  binanceUid: "",
  binanceProxyUrl: "",
  binanceApiKey: "",
  binanceApiSecret: "",
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
  notifyReview: false,
  notifyLowStock: true,
  imageProvider: "R2",
  imgbbApiKey: "",
  reviewImgbbKey: "",
  supabaseEdgeUrl: "",
  hfApiUrl: "",
  aiAdminKey: "",
  aiUserKey: "",
  aiModel: "gemini-2.5-flash",
  aiAudioModel: "",
  aiChat: false,
  aiVoice: false,
  aiCompare: false,
  repeatEnabled: false,
  repeatType: "Flat",
  repeatValue: 100,
  repeatCap: 0,
  repeatDays: 30,
  repeatMin: 500,
  repeatFreeShip: false,
  lowStockLimit: 5,
  maintenance: false,
  maintenanceMsg: "আমরা শীঘ্রই ফিরে আসছি।",
  brandColors: { ...DEFAULT_BRAND_COLORS },
  templateVersion: "v1",
  trackingMode: "Browser Only",
  metaPixel: "",
  ga4: "",
  gtm: "",
  clarity: "",
  trackingUrl: "",
};
