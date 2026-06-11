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
    SUPABASE_URL:      '__SUPABASE_URL__',
    SUPABASE_ANON_KEY: '__SUPABASE_ANON_KEY__',

    // ── 🟡 [MULTI-DB PLACEHOLDER] ────────────────────────────
    // পরে Appwrite বা অন্য DB ব্যবহার করতে চাইলে:
    
    // ── ⚡ DB PROVIDER ─────────────────────────────────────────
    // এই লাইন বদলালে  functions/utils/config.js এর DB_PROVIDER লাইনটাও একই value দিন
    // 'supabase' | 'appwrite'
    DB_PROVIDER: 'supabase',


    // ── 🟡 APPWRITE ──────────────────────────────────────────
    // Appwrite Console → Project Settings → Project ID
    APPWRITE_ENDPOINT:    '__APPWRITE_ENDPOINT__',
    APPWRITE_PROJECT:     '__APPWRITE_PROJECT__',
    APPWRITE_DATABASE_ID: '__APPWRITE_DATABASE_ID__',  // ← Appwrite Console থেকে সঠিক Database ID
    // ────────────────────────────────────────────────────────

    // ── 🟢 Frontend Constants (DB ছাড়াই কাজ করে) ───────────
    CART_KEY:         'fbr_cart',
    DIRECT_ORDER_KEY: 'fbr_direct_order',
    SESSION_KEY:      'fbr_session',
    ADMIN_PATH:       '/admin',

};
