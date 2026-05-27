const schema = {
    settings: [
        { id: 'store_name', type: 'string', size: 255 },
        { id: 'logo_url', type: 'string', size: 500 },
        { id: 'favicon_url', type: 'string', size: 500 },
        { id: 'footer_text', type: 'string', size: 500 },
        { id: 'whatsapp_number', type: 'string', size: 50 },
        { id: 'facebook_url', type: 'string', size: 255 },
        { id: 'instagram_url', type: 'string', size: 255 },
        { id: 'youtube_url', type: 'string', size: 255 },
        { id: 'bkash_number', type: 'string', size: 50 },
        { id: 'nagad_number', type: 'string', size: 50 },
        { id: 'binance_manual_uid', type: 'string', size: 255 },
        { id: 'gateway_proxy_url', type: 'string', size: 500 },
        { id: 'gateway_api_key', type: 'string', size: 500 },
        { id: 'allow_cod', type: 'boolean', default: false },
        { id: 'enable_fun_checkbox', type: 'boolean', default: false },
        { id: 'allow_whatsapp_order', type: 'boolean', default: false },
        { id: 'allow_msg_order', type: 'boolean', default: false },
        { id: 'advance_amount', type: 'integer', default: 0 },
        { id: 'advance_method', type: 'string', size: 50 },
        { id: 'telegram_main_bot', type: 'string', size: 255 },
        { id: 'telegram_draft_bot', type: 'string', size: 255 },
        { id: 'telegram_draft_chat', type: 'string', size: 255 },
        { id: 'allow_pickup', type: 'boolean', default: false },
        { id: 'store_address', type: 'string', size: 500 },
        { id: 'store_map_link', type: 'string', size: 500 },
        { id: 'pickup_bot_token', type: 'string', size: 255 },
        { id: 'pickup_chat_id', type: 'string', size: 255 },
        { id: 'binance_pay_uid', type: 'string', size: 255 },
        { id: 'binance_proxy_url', type: 'string', size: 500 },
        { id: 'binance_api_key', type: 'string', size: 500 },
        { id: 'binance_api_secret', type: 'string', size: 500 },
        { id: 'usd_to_bdt_rate', type: 'float', default: 120 },
        { id: 'verify_mode', type: 'string', size: 50 },
        { id: 'supabase_edge_url', type: 'string', size: 500 },
        { id: 'review_imgbb_key', type: 'string', size: 255 },
        { id: 'telegram_main_chats', type: 'string', size: 1000000 },
        { id: 'messaging_apps', type: 'string', size: 1000000 },
        { id: 'crypto_coins', type: 'string', size: 1000000 }
    ],
    banners: [
        { id: 'image_url', type: 'string', size: 1000 },
        { id: 'title', type: 'string', size: 255 },
        { id: 'subtitle', type: 'string', size: 500 },
        { id: 'link_url', type: 'string', size: 1000 },
        { id: 'sort_order', type: 'integer', default: 0 },
        { id: 'is_active', type: 'boolean', default: true }
    ],
    categories: [
        { id: 'name', type: 'string', size: 255 },
        { id: 'icon_url', type: 'string', size: 1000 },
        { id: 'sort_order', type: 'integer', default: 0 },
        { id: 'is_active', type: 'boolean', default: true }
    ],
    home_sections: [
        { id: 'title', type: 'string', size: 255 },
        { id: 'type', type: 'string', size: 50, default: 'category' },
        { id: 'category_id', type: 'string', size: 255 },
        { id: 'product_ids', type: 'string', size: 1000000 },
        { id: 'max_products', type: 'integer', default: 10 },
        { id: 'sort_order', type: 'integer', default: 0 },
        { id: 'is_active', type: 'boolean', default: true }
    ],
    products: [
        { id: 'name', type: 'string', size: 255 },
        { id: 'sku', type: 'string', size: 100 },
        { id: 'description', type: 'string', size: 1000000 },
        { id: 'base_price', type: 'integer', default: 0 },
        { id: 'flash_sale_price', type: 'integer', default: 0 },
        { id: 'flash_sale_end', type: 'string', size: 255 },
        { id: 'video_url', type: 'string', size: 500 },
        { id: 'video_type', type: 'string', size: 50 },
        { id: 'is_active', type: 'boolean', default: true },
        { id: 'is_featured', type: 'boolean', default: false },
        { id: 'is_add_once', type: 'boolean', default: false },
        { id: 'variants', type: 'string', size: 1000000 },
        { id: 'gallery_images', type: 'string', size: 1000000 }
    ],
    product_categories: [
        { id: 'product_id', type: 'string', size: 255 },
        { id: 'category_id', type: 'string', size: 255 }
    ],
    promos: [
        { id: 'code', type: 'string', size: 100 },
        { id: 'discount', type: 'integer', default: 0 },
        { id: 'is_active', type: 'boolean', default: true },
        { id: 'usage_limit', type: 'integer', default: 0 },
        { id: 'expires_at', type: 'string', size: 255 },
        { id: 'type', type: 'string', size: 50 },
        { id: 'disc_type', type: 'string', size: 50, default: 'percentage' },
        { id: 'disc_val', type: 'integer', default: 0 },
        { id: 'max_cap', type: 'integer', default: 0 },
        { id: 'min_spend', type: 'integer', default: 0 },
        { id: 'is_repeated_config', type: 'boolean', default: false },
        { id: 'rep_type', type: 'string', size: 50 },
        { id: 'rep_value', type: 'integer', default: 0 },
        { id: 'rep_cap', type: 'integer', default: 0 },
        { id: 'rep_expiry_days', type: 'integer', default: 0 },
        { id: 'rep_min_spend', type: 'integer', default: 0 }
    ],
    addons: [
        { id: 'name', type: 'string', size: 255 },
        { id: 'icon', type: 'string', size: 1000 },
        { id: 'price', type: 'integer', default: 0 },
        { id: 'is_active', type: 'boolean', default: true }
    ],
    delivery_zones: [
        { id: 'zone_name', type: 'string', size: 255 },
        { id: 'charge', type: 'integer', default: 0 },
        { id: 'districts', type: 'string', size: 1000000 }
    ],
    reviews: [
        { id: 'product_id', type: 'string', size: 255 },
        { id: 'customer_name', type: 'string', size: 255 },
        { id: 'customer_phone', type: 'string', size: 50 },
        { id: 'rating', type: 'integer', default: 5 },
        { id: 'review_text', type: 'string', size: 2000 },
        { id: 'review_image', type: 'string', size: 1000 },
        { id: 'is_approved', type: 'boolean', default: false }
    ],
    orders: [
        { id: 'customer_name', type: 'string', size: 255 },
        { id: 'customer_phone', type: 'string', size: 50 },
        { id: 'customer_email', type: 'string', size: 255 },
        { id: 'division', type: 'string', size: 255 },
        { id: 'district', type: 'string', size: 255 },
        { id: 'upazila', type: 'string', size: 255 },
        { id: 'address', type: 'string', size: 500 },
        { id: 'items', type: 'string', size: 1000000 },
        { id: 'addons', type: 'string', size: 1000000 },
        { id: 'subtotal', type: 'integer', default: 0 },
        { id: 'addon_total', type: 'integer', default: 0 },
        { id: 'delivery_charge', type: 'integer', default: 0 },
        { id: 'promo_code', type: 'string', size: 100 },
        { id: 'promo_discount', type: 'integer', default: 0 },
        { id: 'grand_total', type: 'integer', default: 0 },
        { id: 'advance_payable', type: 'integer', default: 0 },
        { id: 'payment_method', type: 'string', size: 255 },
        { id: 'payment_status', type: 'string', size: 50, default: 'Unpaid' },
        { id: 'payment_trx_id', type: 'string', size: 255 },
        { id: 'payment_sender', type: 'string', size: 255 },
        { id: 'status', type: 'string', size: 50, default: 'Pending' },
        { id: 'order_type', type: 'string', size: 50, default: 'delivery' },
        { id: 'admin_note', type: 'string', size: 1000000 },
        { id: 'courier_name', type: 'string', size: 255 },
        { id: 'tracking_number', type: 'string', size: 255 },
        { id: 'tracking_url', type: 'string', size: 500 }
    ],
    verified_payments: [
        { id: 'transaction_id', type: 'string', size: 255 },
        { id: 'method', type: 'string', size: 50 },
        { id: 'amount', type: 'integer', default: 0 },
        { id: 'order_id', type: 'string', size: 255 }
    ]
};

// ==========================================
// CONFIGURATION (CHANGE THESE)
// ==========================================
const ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';
const PROJECT_ID = '69de4fa50032182e9b91';
const API_KEY = 'standard_360879e9675a24ef2d8dbba7ff08c36a3157f50a8707e5fa11ad7ac393b7f6c608dbf5781f2741f4833323f676e5857d52063eacf19371591a48db65d65371bead6cf8ac6e16927a268aedabf2a02bd78cf8eb9f55d1cf9c2b4ed62f26b83e871075868759e97a4ee4e2199d353f5d870960e1d80ad0d65cfc04bd8c889094eb';
const DB_ID = 'ecommerce_db';
// ==========================================

async function req(method, path, body) {
    const url = `${ENDPOINT}${path}`;
    const headers = { 'X-Appwrite-Project': PROJECT_ID, 'X-Appwrite-Key': API_KEY, 'Content-Type': 'application/json' };
    
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
    if (!res.ok) {
        const e = await res.json();
        if (e.code === 409) return { exists: true }; 
        throw new Error(e.message || 'Unknown error');
    }
    return await res.json();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function startSetup() {
    if (API_KEY === 'ENTER_YOUR_API_KEY_HERE') {
        console.error('ERROR: Please open appwrite-setup.js and enter your API_KEY on line 125!');
        return;
    }

    console.log('Starting Appwrite Database Setup...');

    try {
        console.log(`\n> Checking/Creating database: ${DB_ID}`);
        try {
            await req('POST', '/databases', { databaseId: DB_ID, name: DB_ID });
            console.log(`  [+] Created database ${DB_ID}`);
        } catch(e) { if(!e.message.includes('already exists')) console.log('  [~] Database exists.'); }

        for (const [collId, attrs] of Object.entries(schema)) {
            console.log(`\n========================================`);
            console.log(`> Collection: ${collId}`);
            
            try {
                await req('POST', `/databases/${DB_ID}/collections`, { collectionId: collId, name: collId, documentSecurity: false });
                console.log(`  [+] Created collection!`);
            } catch(e) { if(e.exists) console.log(`  [~] Collection already exists`); else throw e; }

            await sleep(1000); // Allow Appwrite internal workers to finish

            for (const attr of attrs) {
                let path = `/databases/${DB_ID}/collections/${collId}/attributes/${attr.type}`;
                let payload = { key: attr.id, required: false, array: false };
                
                if (attr.type === 'string') payload.size = attr.size || 255;
                if (attr.default !== undefined) payload.default = attr.default;

                try {
                    await req('POST', path, payload);
                    console.log(`    [+] Added attribute: ${attr.id} (${attr.type})`);
                } catch(e) {
                    if (e.exists) console.log(`    [~] Attribute ${attr.id} exists`);
                    else console.log(`    [!] Error on ${attr.id}: ${e.message}`);
                }
                await sleep(600); // Increased sleep to prevent rate limits / HTML errors
            }
        }
        console.log('\n✅ SUCCESS: Database setup complete! None of your existing data was deleted.');

    } catch(e) {
        console.error('\n❌ CRITICAL ERROR: ' + e.message);
    }
}

startSetup();
