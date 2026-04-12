// ============================================================
// supabase-init.js — Supabase Client Initialization (Admin)
// Self-contained within /admin — include AFTER config.js
// ============================================================

// Initialize Supabase client — global window.sb
var sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// Sanity check
if (!CONFIG.SUPABASE_URL || CONFIG.SUPABASE_URL.includes('your-project')) {
    console.warn('[Admin] ⚠️ Supabase credentials not set in admin/assets/js/config.js!');
} else {
    console.log('[Admin] ✅ Admin initialized successfully');
}
