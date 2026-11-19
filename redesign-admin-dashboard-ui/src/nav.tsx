import {
  BarChart3, Boxes, Code2, FileSpreadsheet, FolderTree, Gauge, Gift, IdCard, Image, LayoutGrid,
  MessageSquareHeart, Package, Palette, Radar, Settings, ShieldAlert, ShieldCheck,
  ShoppingBag, Store, Tags, Truck, UserCheck, Users, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  path: string;
  en: string;
  bn: string;
  icon: LucideIcon;
  desc: string;
  badge?: "orders" | "reviews" | "new";
  module?: string;
  externalHref?: string;
}
export interface NavGroup { en: string; bn: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  { en: "Overview", bn: "ওভারভিউ", items: [
    { path: "/dashboard", en: "Dashboard", bn: "ড্যাশবোর্ড", icon: Gauge, desc: "Today at a glance and what needs action" },
    { path: "/insights", en: "Insights", bn: "ইনসাইটস", icon: BarChart3, desc: "90+ business insights & research lab", badge: "new", module: "orders" },
  ] },
  { en: "Sell", bn: "বিক্রি", items: [
    { path: "/orders", en: "Orders", bn: "অর্ডার", icon: ShoppingBag, desc: "Confirm, ship and track orders", badge: "orders", module: "orders" },
    { path: "/customers", en: "Customers", bn: "কাস্টমার", icon: Users, desc: "Who buys from you and how often", badge: "new", module: "orders" },
    { path: "/products", en: "Products", bn: "প্রোডাক্ট", icon: Package, desc: "Prices, photos, colours, sizes & stock", module: "products" },
    { path: "/categories", en: "Categories", bn: "ক্যাটাগরি", icon: FolderTree, desc: "Group your products", module: "categories" },
    { path: "/brands", en: "Brands", bn: "ব্র্যান্ড", icon: Store, desc: "Separate storefronts under one panel", module: "brands" },
  ] },
  { en: "Marketing", bn: "মার্কেটিং", items: [
    { path: "/banners", en: "Banners", bn: "ব্যানার", icon: Image, desc: "Homepage slider images", module: "banners" },
    { path: "/sections", en: "Home sections", bn: "হোম সেকশন", icon: LayoutGrid, desc: "Product rows on your homepage", module: "sections" },
    { path: "/promos", en: "Promo codes", bn: "প্রোমো কোড", icon: Tags, desc: "Coupons and repeat-customer rewards", module: "promos" },
    { path: "/reviews", en: "Reviews", bn: "রিভিউ", icon: MessageSquareHeart, desc: "Approve what customers say", badge: "reviews", module: "reviews" },
    { path: "/tracking", en: "Tracking", bn: "ট্র্যাকিং", icon: Radar, desc: "Meta Pixel, GA4, GTM, Clarity", module: "settings" },
  ] },
  { en: "Store setup", bn: "স্টোর সেটআপ", items: [
    { path: "/delivery", en: "Delivery zones", bn: "ডেলিভারি জোন", icon: Truck, desc: "Shipping areas & charges", module: "delivery" },
    { path: "/addons", en: "Add-ons", bn: "অ্যাড-অন", icon: Gift, desc: "Extra items at checkout", module: "addons" },
    { path: "/theme", en: "Theme", bn: "থিম", icon: Palette, desc: "Brand colours & template", module: "settings" },
    { path: "/settings", en: "Settings", bn: "সেটিংস", icon: Settings, desc: "Store info, payments, notifications, AI", module: "settings" },
  ] },
  { en: "System & Tools", bn: "সিস্টেম ও টুলস", items: [
    { path: "/staff", en: "Staff & security", bn: "স্টাফ ও সিকিউরিটি", icon: ShieldCheck, desc: "Team access, 2FA and activity logs", module: "staff" },
    { path: "/developer", en: "Developer", bn: "ডেভেলপার", icon: Code2, desc: "Maintenance, database tools, ENV guide", module: "settings" },
    { path: "/tool-salary", en: "Salary Slip", bn: "বেতন স্লিপ", icon: FileSpreadsheet, desc: "Generate employee salary slips", externalHref: "/admin/salary-slip.html", module: "settings" },
    { path: "/tool-idcard", en: "Demo ID Prop", bn: "আইডি কার্ড টুল", icon: IdCard, desc: "Employee ID card generator", externalHref: "/admin/demo-id-card.html", module: "settings" },
    { path: "/tool-fraud", en: "Fraud Checker", bn: "ফ্রড চেকার", icon: ShieldAlert, desc: "Courier parcel ratio checker", externalHref: "/fraud-chack.html", module: "orders" },
    { path: "/tool-worker", en: "Worker Auth", bn: "ওয়ার্কার প্যানেল", icon: UserCheck, desc: "Worker verification portal", externalHref: "/worker.html", module: "settings" },
  ] },
];
export const ALL_NAV = NAV.flatMap((g) => g.items);
export const LogoIcon = Boxes;
