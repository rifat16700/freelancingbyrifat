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

// ── Cache Busting for HTML files ─────────────────────────────
const timestamp = Date.now();
const directories = [__dirname, path.join(__dirname, 'admin')];

directories.forEach(dir => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        if (file.endsWith('.html')) {
            const filePath = path.join(dir, file);
            let content = fs.readFileSync(filePath, 'utf8');
            const updatedContent = content.replace(/assets\/js\/config\.js\?v=\d+/g, `assets/js/config.js?v=${timestamp}`);
            if (content !== updatedContent) {
                fs.writeFileSync(filePath, updatedContent, 'utf8');
                console.log(`✅ Cache busted config.js in ${file}`);
            }
        }
    });
});
