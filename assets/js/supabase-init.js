// ============================================================
// supabase-init.js — Supabase Client Initialization
// Include AFTER config.js on every page
// ============================================================

// Initialize Supabase client — global window.sb
var sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// Quick sanity check
if (!CONFIG.SUPABASE_URL || CONFIG.SUPABASE_URL.includes('YOUR_PROJECT')) {
    console.warn('⚠️  Supabase credentials not set in config.js!');
}

// Global Dynamic Favicon loader
document.addEventListener('DOMContentLoaded', function() {
    sb.from('settings').select('logo_url, favicon_url').eq('id', 1).single().then(function(r) {
        if (r.data) {
            var url = r.data.logo_url || r.data.favicon_url || 'assets/images/favicon.ico';
            var link = document.querySelector("link[rel~='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.head.appendChild(link);
            }
            if (url === 'assets/images/favicon.ico' && window.location.pathname.includes('/admin/')) {
                url = '../assets/images/favicon.ico';
            }
            link.href = url;
        }
    }).catch(function(e){});
});
