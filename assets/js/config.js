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
//   DB_PROVIDER = 'supabase'  → Supabase ব্যবহার হবে
//   DB_PROVIDER = 'appwrite'  → Appwrite ব্যবহার হবে
//
//   ⚡ শুধু DB_PROVIDER একটি line পরিবর্তন করলেই
//      পুরো সাইট সেই DB ব্যবহার করবে।
// ============================================================

var CONFIG = {

    // ── 🔵 SUPABASE ─────────────────────────────────────────
    // Supabase Dashboard → Project Settings → API
    SUPABASE_URL:      'https://qdkppbwjgkkxzgzgsykv.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFka3BwYndqZ2treHpnemdzeWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzY2NjgsImV4cCI6MjA5MDgxMjY2OH0.i1x16UGnM_4C2hVGZS9JreM2FJDxsIYeiHkA4BMOfrk',

    // ── 🟡 [MULTI-DB PLACEHOLDER] ────────────────────────────
    // পরে Appwrite বা অন্য DB ব্যবহার করতে চাইলে:
    
    // ── ⚡ DB PROVIDER ─────────────────────────────────────────
    // এই লাইন বদলালে  functions/utils/config.js এর DB_PROVIDER লাইনটাও একই value দিন
    // 'supabase' | 'appwrite'
    DB_PROVIDER: 'supabase',


    // ── 🟡 APPWRITE ──────────────────────────────────────────
    // Appwrite Console → Project Settings → Project ID
    APPWRITE_ENDPOINT:    'https://sgp.cloud.appwrite.io/v1',
    APPWRITE_PROJECT:     '69de4fa50032182e9b91',       // ← এখানে তোমার Project ID বসাও
    APPWRITE_DATABASE_ID: '6a19e07f002427086405',  // ← Appwrite Console থেকে সঠিক Database ID
    // ────────────────────────────────────────────────────────

    // ── 🟢 Frontend Constants (DB ছাড়াই কাজ করে) ───────────
    CART_KEY:         'fbr_cart',
    DIRECT_ORDER_KEY: 'fbr_direct_order',
    SESSION_KEY:      'fbr_session',
    ADMIN_PATH:       '/admin',

};
