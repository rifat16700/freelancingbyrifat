

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Environment Variables (Hugging Face Secrets) ──
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || '';
const CF_DB_ID = process.env.CF_DB_ID || '';
const CF_READ_TOKEN = process.env.CF_READ_TOKEN || '';
const CF_WRITE_TOKEN = process.env.CF_WRITE_TOKEN || '';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const { exec } = require('child_process');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';
const ADMIN_SECRET_TOKEN = process.env.ADMIN_SECRET_TOKEN || 'secure_admin_token';

app.get('/api/debug-curl', async (req, res) => {
    try {
        const start = Date.now();
        const https = require('https');
        const agent = new https.Agent({ rejectUnauthorized: false });
        const response = await axios.get('https://104.19.193.29/client/v4/ips', {
            timeout: 10000,
            headers: { 'Host': 'api.cloudflare.com' },
            httpsAgent: agent
        });
        res.json({ success: true, time: Date.now() - start, data: response.data });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});


// Helper: Make D1 Query
async function queryD1(sql, params = [], useWriteToken = false) {
    const token = useWriteToken ? CF_WRITE_TOKEN : CF_READ_TOKEN;
    if (!token || !CF_ACCOUNT_ID || !CF_DB_ID) {
        throw new Error("Missing Cloudflare D1 Credentials in Environment Variables.");
    }
    
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_DB_ID}/query`;

    try {
        const response = await axios.post(url, { sql, params }, {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    } catch (error) {
        if (error.response) {
            throw new Error(`D1 API Error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
        }
        throw new Error(`D1 Network Error: ${error.message}`);
    }
}

// ── 1. PUBLIC READ QUERY (/api/d1-query) ──
app.post('/api/d1-query', async (req, res) => {
    try {
        const { sql, params } = req.body;
        // Basic safety: only allow SELECT
        if (!sql || !sql.toUpperCase().trim().startsWith("SELECT")) {
            return res.status(403).json({ success: false, error: "Only SELECT queries are allowed on this endpoint." });
        }
        const data = await queryD1(sql, params, false);
        res.json(data);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── 2. SAVE ORDER (/api/save-order) ──
app.post('/api/save-order', async (req, res) => {
    try {
        const { id, customer_name, customer_phone, customer_address, upazila, district, delivery_method, delivery_charge, payment_method, payment_trx_id, payment_number, subtotal, total, items, addons, promo_code, promo_discount, order_notes } = req.body;
        
        const sql = `
            INSERT INTO orders (
                id, customer_name, customer_phone, customer_address, upazila, district,
                delivery_method, delivery_charge, payment_method, payment_trx_id, payment_number,
                subtotal, total, items, addons, promo_code, promo_discount, order_notes, status, payment_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Unpaid')
        `;
        
        const params = [
            id, customer_name, customer_phone, customer_address, upazila, district,
            delivery_method, delivery_charge, payment_method, payment_trx_id, payment_number,
            subtotal, total,
            typeof items === 'string' ? items : JSON.stringify(items || []),
            typeof addons === 'string' ? addons : JSON.stringify(addons || []),
            promo_code || null, promo_discount || 0, order_notes || ''
        ];

        const data = await queryD1(sql, params, true);
        res.json(data);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── 3. UPDATE PAYMENT STATUS (/api/update-payment-status) ──
app.post('/api/update-payment-status', async (req, res) => {
    try {
        const { id, payment_status, payment_trx_id, status } = req.body;
        const sql = `UPDATE orders SET payment_status = ?, payment_trx_id = ?, status = ? WHERE id = ?`;
        const data = await queryD1(sql, [payment_status, payment_trx_id, status, id], true);
        res.json(data);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── 4. ADMIN LOGIN (/api/admin-login) ──
app.post('/api/admin-login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        res.json({ success: true, token: ADMIN_SECRET_TOKEN });
    } else {
        res.status(401).json({ success: false, error: "Invalid credentials" });
    }
});

// ── MIDDLEWARE: Admin Auth ──
function authenticateAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const token = authHeader.split(" ")[1];
    if (token !== ADMIN_SECRET_TOKEN) {
        return res.status(403).json({ success: false, error: "Invalid Admin Token" });
    }
    next();
}

// ── 5. ADMIN QUERY (Read/Write) (/api/admin-query) ──
app.post('/api/admin-query', authenticateAdmin, async (req, res) => {
    try {
        const { sql, params } = req.body;
        // Use write token for admin queries to allow full access
        const data = await queryD1(sql, params, true); 
        res.json(data);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── 6. ADMIN ADD PRODUCT (/api/add-product) ──
app.post('/api/add-product', authenticateAdmin, async (req, res) => {
    try {
        const p = req.body;
        const sql = `
            INSERT INTO products (
                id, name, description, category_id, base_price, flash_sale_price,
                stock_status, gallery_images, video_url, variants,
                is_active, is_featured, is_add_once, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        const params = [
            p.id, p.name, p.description || '', p.category_id || '',
            p.base_price || 0, p.flash_sale_price || 0, p.stock_status || 'In Stock',
            typeof p.gallery_images === 'string' ? p.gallery_images : JSON.stringify(p.gallery_images || []),
            p.video_url || '',
            typeof p.variants === 'string' ? p.variants : JSON.stringify(p.variants || []),
            p.is_active ? 1 : 0, p.is_featured ? 1 : 0, p.is_add_once ? 1 : 0
        ];
        const data = await queryD1(sql, params, true);
        res.json(data);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── 7. ADMIN UPDATE PRODUCT (/api/update-product) ──
app.post('/api/update-product', authenticateAdmin, async (req, res) => {
    try {
        const p = req.body;
        const sql = `
            UPDATE products SET
                name=?, description=?, category_id=?, base_price=?, flash_sale_price=?,
                stock_status=?, gallery_images=?, video_url=?, variants=?,
                is_active=?, is_featured=?, is_add_once=?
            WHERE id=?
        `;
        const params = [
            p.name, p.description || '', p.category_id || '',
            p.base_price || 0, p.flash_sale_price || 0, p.stock_status || 'In Stock',
            typeof p.gallery_images === 'string' ? p.gallery_images : JSON.stringify(p.gallery_images || []),
            p.video_url || '',
            typeof p.variants === 'string' ? p.variants : JSON.stringify(p.variants || []),
            p.is_active ? 1 : 0, p.is_featured ? 1 : 0, p.is_add_once ? 1 : 0,
            p.id
        ];
        const data = await queryD1(sql, params, true);
        res.json(data);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── 8. ADMIN DELETE PRODUCT (/api/delete-product) ──
app.post('/api/delete-product', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.body;
        const data = await queryD1(`DELETE FROM products WHERE id=?`, [id], true);
        res.json(data);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── 9. ADMIN UPDATE ORDER (/api/update-order) ──
app.post('/api/update-order', authenticateAdmin, async (req, res) => {
    try {
        const { id, status, payment_status, payment_trx_id } = req.body;
        const sql = `UPDATE orders SET status=?, payment_status=?, payment_trx_id=? WHERE id=?`;
        const data = await queryD1(sql, [status, payment_status, payment_trx_id, id], true);
        res.json(data);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── 10. ADMIN DELETE ORDER (/api/delete-order) ──
app.post('/api/delete-order', authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.body;
        const data = await queryD1(`DELETE FROM orders WHERE id=?`, [id], true);
        res.json(data);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── 11. ADMIN UPDATE SETTINGS (/api/update-settings) ──
app.post('/api/update-settings', authenticateAdmin, async (req, res) => {
    try {
        const p = req.body;
        const sql = `
            UPDATE settings SET
                store_name=?, logo_url=?, favicon_url=?, footer_text=?, admin_email=?, admin_phone=?,
                gateway_version=?, gateway_api_key=?, gateway_api_key_v2=?,
                telegram_bot_token=?, telegram_main_chats=?, telegram_draft_bot=?, telegram_draft_chat=?,
                pixel_id=?, pixel_access_token=?, pixel_test_code=?, conversion_api_url=?,
                meta_title=?, meta_description=?, meta_keywords=?, meta_image=?,
                theme_color=?, custom_css=?, custom_js=?,
                telegram_group_link=?, whatsapp_number=?, facebook_page_url=?, youtube_channel_url=?,
                messaging_apps=?,
                marquee_text=?, marquee_link=?, marquee_is_active=?,
                crypto_coins=?, custom_admin_js=?, custom_admin_css=?, pwa_icon_url=?, external_link_handler=?
            WHERE id=1
        `;
        const params = [
            p.store_name, p.logo_url, p.favicon_url, p.footer_text, p.admin_email, p.admin_phone,
            p.gateway_version, p.gateway_api_key, p.gateway_api_key_v2,
            p.telegram_bot_token,
            typeof p.telegram_main_chats === 'string' ? p.telegram_main_chats : JSON.stringify(p.telegram_main_chats || []),
            p.telegram_draft_bot, p.telegram_draft_chat,
            p.pixel_id, p.pixel_access_token, p.pixel_test_code, p.conversion_api_url,
            p.meta_title, p.meta_description, p.meta_keywords, p.meta_image,
            p.theme_color, p.custom_css, p.custom_js,
            p.telegram_group_link, p.whatsapp_number, p.facebook_page_url, p.youtube_channel_url,
            typeof p.messaging_apps === 'string' ? p.messaging_apps : JSON.stringify(p.messaging_apps || []),
            p.marquee_text, p.marquee_link, p.marquee_is_active ? 1 : 0,
            typeof p.crypto_coins === 'string' ? p.crypto_coins : JSON.stringify(p.crypto_coins || []),
            p.custom_admin_js, p.custom_admin_css, p.pwa_icon_url, p.external_link_handler
        ];
        const data = await queryD1(sql, params, true);
        res.json(data);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => {
    console.log(`Hugging Face API running on port ${PORT}`);
});
