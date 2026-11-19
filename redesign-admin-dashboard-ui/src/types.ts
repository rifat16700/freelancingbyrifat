export type Status = "Pending" | "Confirmed" | "Processing" | "Shipped" | "Delivered" | "Cancelled";
export type PayStatus = "Unpaid" | "Advance Paid" | "Paid";
export type PayMethod = "COD" | "bKash" | "Nagad" | "Online Gateway" | "Binance Pay" | string;

export interface Brand {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  color: string;
  accentColor?: string;
  emoji: string;
  logoUrl?: string;
  faviconUrl?: string;
  active: boolean;
  seoTitle: string;
  seoDesc?: string;
  seoKeywords?: string;
  seoOgImage?: string;
  footerText?: string;
  whatsapp?: string;
  facebook?: string;
  instagram?: string;
  youtube?: string;
  sort?: number;
  isMain?: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: string; // Emoji, Image URL, or inline <svg>...</svg>
  brandId: string;
  sort: number;
  active: boolean;
  sharedBrandIds?: string[];
  shareIncludeProducts?: boolean;
  shareUrlMode?: "brand" | "main";
}

export interface Variant {
  color: string;
  hex: string;
  image?: string;
  sizes: Record<string, number>;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  brandId: string;
  showOnMain?: boolean;
  catIds: string[];
  price: number;
  cost: number;
  flash: number;
  flashEnd?: string;
  active: boolean;
  featured: boolean;
  addOnce: boolean;
  emoji: string;
  hue: number;
  galleryImages?: string[];
  videoUrl?: string;
  videoType?: string;
  desc: string;
  variants: Variant[];
  tags?: string;
  seoTitle?: string;
  seoSlug?: string;
  seoDesc?: string;
  seoKeywords?: string;
  views: number;
  created: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  color: string;
  size: string;
  image?: string;
  sku?: string;
}

export interface Order {
  id: string;
  orderGroupId?: string;
  subOrderIds?: string[];
  date: string;
  customerPhone: string;
  customerName: string;
  email?: string;
  division: string;
  district: string;
  upazila: string;
  address: string;
  items: OrderItem[];
  subtotal: number;
  promoCode?: string;
  promoDiscount: number;
  deliveryCharge: number;
  deliveryDiscount: number;
  addons: string[];
  addonTotal: number;
  grand: number;
  advance: number;
  method: PayMethod;
  trxId?: string;
  payStatus: PayStatus;
  status: Status;
  type: "delivery" | "pickup";
  brandId: string;
  source: string;
  device: string;
  failed?: boolean;
  cancelReason?: string;
  deliveryDays?: number;
  isRepeat: boolean;
  note?: string;
  courierName?: string;
  trackingNumber?: string;
  trackingUrl?: string;
}

export interface Review {
  id: string;
  productId: string;
  name: string;
  phone?: string;
  rating: number;
  text: string;
  image?: string;
  date: string;
  approved: boolean;
  hasPhoto: boolean;
}

export interface Promo {
  id: string;
  code: string;
  visibility: "Public" | "Private";
  discountType: "Flat" | "Percent";
  value: number;
  cap?: number;
  usageLimit?: number;
  expiry?: string;
  minSpend: number;
  freeDelivery: boolean;
  delReward?: string;
  delDiscAmount?: number;
  delDiscCap?: number;
  applicableProducts?: string[];
  applicableCategories?: string[];
  applicableDistricts?: string[];
  applicablePayments?: string[];
  brandId: string;
  active: boolean;
  note: string;
}

export interface Zone {
  id: string;
  name: string;
  charge: number;
  districts: string[];
}

export interface Addon {
  id: string;
  icon: string; // Emoji, Image URL, or inline <svg>
  name: string;
  price: number;
  active: boolean;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  brandId: string;
  hue: number;
  link: string;
  linkType?: string;
  areaX?: number;
  areaY?: number;
  areaW?: number;
  areaH?: number;
  sort: number;
  active: boolean;
  impressions: number;
  clicks: number;
}

export interface Section {
  id: string;
  title: string;
  type: "Category" | "Custom" | "All Products";
  brandId: string;
  catId?: string;
  productIds?: string[];
  max: number;
  sort: number;
  active: boolean;
}

export interface Perm {
  view: boolean;
  create?: boolean;
  edit: boolean;
  delete: boolean;
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  tg: string;
  perms: Record<string, Perm>;
  lastLogin: string;
  active: boolean;
}

export interface LogEntry {
  id: string;
  time: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  details?: string;
  ip: string;
}

export interface Session {
  id: string;
  who: string;
  role: string;
  ip: string;
  device: string;
  expires: string;
  isCurrent?: boolean;
}

export interface Customer {
  phone: string;
  name: string;
  email?: string;
  district: string;
  division: string;
  orders: Order[];
  valid: Order[];
  spent: number;
  first: string;
  last: string;
  segment: "VIP" | "Loyal" | "New" | "At risk" | "Regular";
}

export interface BrandColors {
  primary: string;
  primary_light: string;
  primary_dark: string;
  bg: string;
  bg_light: string;
  bg_card: string;
  bg_subtle: string;
  footer_bg: string;
  border: string;
  border_light: string;
  text_dark: string;
  text_body: string;
  text_muted: string;
}

export interface Settings {
  storeName: string;
  logo: string;
  favicon: string;
  footer: string;
  whatsapp: string;
  facebook: string;
  instagram: string;
  youtube: string;
  seoTitle: string;
  seoDesc: string;
  seoKeywords: string;
  seoOgImage: string;
  canonical: string;
  gsc: string;
  cod: boolean;
  funPromise: boolean;
  allowWhatsappOrder: boolean;
  msgOrder: boolean;
  advanceAmount: number;
  advanceMode: "manual" | "auto";
  bkashNumber: string;
  nagadNumber: string;
  binanceManualUid: string;
  gateway: string;
  gatewayVersion: string;
  gatewayKey: string;
  gatewayKeyV2: string;
  binanceUid: string;
  binanceProxyUrl: string;
  binanceApiKey: string;
  binanceApiSecret: string;
  usdRate: number;
  crypto: boolean;
  cryptoCoins: string[];
  pickup: boolean;
  pickupAddress: string;
  pickupMap: string;
  tgMainToken: string;
  tgMainChat: string;
  tgMainChats: string[];
  tgDraftToken: string;
  tgDraftChat: string;
  tgPickupToken: string;
  tgPickupChat: string;
  notifyNew: boolean;
  notifyCancel: boolean;
  notifyReview: boolean;
  notifyLowStock: boolean;
  imageProvider: string;
  imgbbApiKey: string;
  reviewImgbbKey: string;
  supabaseEdgeUrl: string;
  hfApiUrl: string;
  aiAdminKey: string;
  aiUserKey: string;
  aiModel: string;
  aiAudioModel: string;
  aiChat: boolean;
  aiVoice: boolean;
  aiCompare: boolean;
  repeatEnabled: boolean;
  repeatType: string;
  repeatValue: number;
  repeatCap: number;
  repeatDays: number;
  repeatMin: number;
  repeatFreeShip: boolean;
  lowStockLimit: number;
  maintenance: boolean;
  maintenanceMsg: string;
  brandColors: BrandColors;
  templateVersion: string;
  trackingMode: string;
  metaPixel: string;
  ga4: string;
  gtm: string;
  clarity: string;
  trackingUrl: string;
}

export interface AuthUser {
  email: string;
  role: "master_admin" | "staff" | string;
  permissions: Record<string, Perm> | string[];
}
