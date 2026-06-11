// ============================================================
// functions/utils/config.js
// Helper to extract Cloudflare Pages environment variables
// ============================================================

// ══ ⚡ শুধু এই একটি লাইন পরিবর্তন করুন ══════════════════════
// assets/js/config.js এর DB_PROVIDER এর সাথে মিলিয়ে রাখুন
// 'supabase' → Supabase ব্যবহার করবে
// 'appwrite'  → Appwrite ব্যবহার করবে
// ════════════════════════════════════════════════════════════

export function getConfig(env) {
    return {
        DB_PROVIDER: env.DB_PROVIDER || 'supabase',

        // ── Supabase ───────────────────────────────────────────
        SUPABASE_URL: env.SUPABASE_URL || '',
        SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || '',
        SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY || '', // bypasses RLS for admin ops

        // ── Admin Auth Secret (same as admin-auth.js) ──────────
        ADMIN_SECRET: env.ADMIN_SECRET || '',

        // ── Appwrite Core ──────────────────────────────────────
        APPWRITE_ENDPOINT:    env.APPWRITE_ENDPOINT || '',
        APPWRITE_PROJECT:     env.APPWRITE_PROJECT || '',
        APPWRITE_API_KEY:     env.APPWRITE_API_KEY || '',
        APPWRITE_DATABASE_ID: env.APPWRITE_DATABASE_ID || '',

        // ── Appwrite Collections (12 total) ───────────────────
        APPWRITE_COLLECTION_SETTINGS: env.APPWRITE_COLLECTION_SETTINGS || 'settings',
        APPWRITE_COLLECTION_PRODUCTS: env.APPWRITE_COLLECTION_PRODUCTS || 'products',
        APPWRITE_COLLECTION_CATEGORIES: env.APPWRITE_COLLECTION_CATEGORIES || 'categories',
        APPWRITE_COLLECTION_BANNERS: env.APPWRITE_COLLECTION_BANNERS || 'banners',
        APPWRITE_COLLECTION_ORDERS: env.APPWRITE_COLLECTION_ORDERS || 'orders',
        APPWRITE_COLLECTION_ADDONS: env.APPWRITE_COLLECTION_ADDONS || 'addons',
        APPWRITE_COLLECTION_PROMOS: env.APPWRITE_COLLECTION_PROMOS || 'promos',
        APPWRITE_COLLECTION_REVIEWS: env.APPWRITE_COLLECTION_REVIEWS || 'reviews',
        APPWRITE_COLLECTION_HOME_SECTIONS: env.APPWRITE_COLLECTION_HOME_SECTIONS || 'home_sections',
        APPWRITE_COLLECTION_PRODUCT_CATEGORIES: env.APPWRITE_COLLECTION_PRODUCT_CATEGORIES || 'product_categories',
        APPWRITE_COLLECTION_VERIFIED_PAYMENTS: env.APPWRITE_COLLECTION_VERIFIED_PAYMENTS || 'verified_payments',
        APPWRITE_COLLECTION_DELIVERY_ZONES: env.APPWRITE_COLLECTION_DELIVERY_ZONES || 'delivery_zones',

        // ── Cloudflare Cache Purge ─────────────────────────────
        CF_ZONE_ID: env.CF_ZONE_ID || '',
        CF_API_TOKEN: env.CF_API_TOKEN || '',

        // ── Webhook Secret (revalidate.js) ─────────────────────
        WEBHOOK_SECRET: env.WEBHOOK_SECRET || '',
    };
}
