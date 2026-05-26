// ============================================================
// assets/js/config.js  —  Project Configuration
// Project: Freelancing By Rifat E-Commerce
// ============================================================
//
// ✅ এখানে শুধু সেই credentials আছে যেগুলো ছাড়া
//    DB connect-ই করা যাবে না।
//    বাকি সব settings → Admin Panel → settings table থেকে আসে।
//
// ── বর্তমান DB ──────────────────────────────────────────────
//   🔵 SUPABASE — সরাসরি Supabase এ connect করে
//
// ── ভবিষ্যতে অন্য DB যোগ করতে চাইলে ───────────────────────
//   👉 [MULTI-DB PLACEHOLDER] দেখো master-db.js এ
//   👉 নিচে যেই DB ব্যবহার করবে সেটার credentials দাও
//      এবং DB_PROVIDER set করো
// ============================================================

var CONFIG = {

    // ── 🔵 SUPABASE ─────────────────────────────────────────
    // Supabase Dashboard → Project Settings → API
    SUPABASE_URL:      'https://qdkppbwjgkkxzgzgsykv.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFka3BwYndqZ2treHpnemdzeWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzY2NjgsImV4cCI6MjA5MDgxMjY2OH0.i1x16UGnM_4C2hVGZS9JreM2FJDxsIYeiHkA4BMOfrk',

    // ── 🟡 [MULTI-DB PLACEHOLDER] ────────────────────────────
    // পরে Appwrite বা অন্য DB ব্যবহার করতে চাইলে:
    //
    // DB_PROVIDER: 'appwrite',   // 'supabase' | 'appwrite'
    //
    // APPWRITE_ENDPOINT:    'https://sgp.cloud.appwrite.io/v1',
    // APPWRITE_PROJECT:     '',
    // APPWRITE_DATABASE_ID: '',
    // ────────────────────────────────────────────────────────

    // ── 🟢 Frontend Constants (DB ছাড়াই কাজ করে) ───────────
    CART_KEY:         'fbr_cart',
    DIRECT_ORDER_KEY: 'fbr_direct_order',
    SESSION_KEY:      'fbr_session',
    ADMIN_PATH:       '/admin',

};
