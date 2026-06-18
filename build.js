const fs = require('fs');
const path = require('path');

const s = (val) => (val || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const configJs = `// ============================================================
// Auto-generated during Cloudflare Build
// ============================================================

var CONFIG = {
    // ── DB Provider ──────────────────────────────────────────
    DB_PROVIDER: '${s(process.env.DB_PROVIDER) || 'supabase'}',

    // ── Supabase ─────────────────────────────────────────────
    SUPABASE_URL:      '${s(process.env.SUPABASE_URL)}',
    SUPABASE_ANON_KEY: '${s(process.env.SUPABASE_ANON_KEY)}',

    // ── Appwrite ─────────────────────────────────────────────
    APPWRITE_ENDPOINT:    '${s(process.env.APPWRITE_ENDPOINT)}',
    APPWRITE_PROJECT:     '${s(process.env.APPWRITE_PROJECT)}',
    APPWRITE_DATABASE_ID: '${s(process.env.APPWRITE_DATABASE_ID)}',

    // ── Frontend Constants ───────────────────────────────────
    CART_KEY:         'fbr_cart',
    DIRECT_ORDER_KEY: 'fbr_direct_order',
    SESSION_KEY:      'fbr_session',
    ADMIN_PATH:       '/admin',
};
`;

const configPath = path.join(__dirname, 'assets', 'js', 'config.js');
fs.writeFileSync(configPath, configJs, 'utf8');
console.log('✅ assets/js/config.js generated successfully during build!');
