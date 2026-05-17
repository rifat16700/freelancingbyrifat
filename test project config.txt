// ============================================================
// config.js — Global Configuration
// Project: Freelancing By Rifat E-Commerce
// ⚠️ FILL IN YOUR SUPABASE CREDENTIALS BELOW
// ============================================================

var CONFIG = {

    // ── Supabase ─────────────────────────────────────────────
    // Supabase Dashboard → Settings → API এ পাবে
    SUPABASE_URL: 'https://crpaivhkzvjxoftnkoxr.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNycGFpdmhrenZqeG9mdG5rb3hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzODgyMDcsImV4cCI6MjA5MDk2NDIwN30.HESyhIf9L-5HoKFHLmbmX_drTsgcllPmNu9EM8oJt5w',

    // ── Payment Gateway Proxy ────────────────────────────────
    // mypay.freelancingbyrifat.top — PHP cPanel proxy (active)
    GATEWAY_PROXY_URL: 'https://mypay.freelancingbyrifat.top/api_proxy.php',
    // Gateway API Key — Admin panel settings থেকে override হবে
    GATEWAY_API_KEY: '8QFIJJNzDGGw1qmhdCJcK5xcvuh8PwRXviUfDlLatVhgkjXlZv',

    // ── App Defaults (settings table থেকে override হবে) ─────
    STORE_NAME: 'Freelancing By Rifat',
    CART_KEY: 'fbr_cart',          // localStorage key - main cart
    DIRECT_ORDER_KEY: 'fbr_direct_order', // Buy Now / Direct Order — main cart কে touch করে না
    SESSION_KEY: 'fbr_session',

    // ── Admin Panel ───────────────────────────────────────────
    ADMIN_PATH: '/admin',

    // ── Binance Pay & Crypto Payment Proxy ───────────────────
    // binance_proxy.php কে তোমার cPanel server-এ deploy করো
    // API Key + Secret ওই PHP file-এ থাকবে — এখানে শুধু proxy URL
    BINANCE_PROXY_URL: 'https://mypay.freelancingbyrifat.top/binance_proxy.php',

    // ── ImgBB Image Upload ────────────────────────────────────
    // imgbb.com/api → API Key নিয়ে এখানে দাও
    // অথবা Admin → Settings → ImgBB API Key থেকে সেট করো
    IMGBB_API_KEY: '', // 'your_imgbb_api_key_here'
};
