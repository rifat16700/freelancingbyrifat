-- D1 Full Schema for Freelancing By Rifat

DROP TABLE IF EXISTS product_categories;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS addons;
DROP TABLE IF EXISTS promos;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS admins;
DROP TABLE IF EXISTS delivery_zones;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS home_sections;
DROP TABLE IF EXISTS devtools;
DROP TABLE IF EXISTS verified_payments;
DROP TABLE IF EXISTS banners;

CREATE TABLE products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    base_price REAL DEFAULT 0,
    flash_sale_price REAL DEFAULT 0,
    flash_sale_end TEXT,
    variants TEXT DEFAULT '[]',
    gallery_images TEXT DEFAULT '[]',
    video_url TEXT,
    video_type TEXT DEFAULT 'auto',
    sku TEXT,
    is_active INTEGER DEFAULT 1,
    is_featured INTEGER DEFAULT 0,
    is_add_once INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon_url TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_categories (
    product_id TEXT,
    category_id TEXT,
    PRIMARY KEY (product_id, category_id)
);

CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    customer_name TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    cart_total REAL,
    delivery_charge REAL,
    discount REAL,
    final_total REAL,
    status TEXT DEFAULT 'pending',
    items TEXT DEFAULT '[]',
    promo_code TEXT,
    transaction_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE addons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL DEFAULT 0,
    image TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE promos (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    type TEXT DEFAULT 'public',
    disc_type TEXT DEFAULT 'flat',
    disc_val REAL DEFAULT 0,
    max_cap REAL,
    min_spend REAL,
    del_reward TEXT DEFAULT 'none',
    del_disc_amount REAL,
    del_disc_cap REAL,
    applicable_products TEXT DEFAULT '[]',
    applicable_categories TEXT DEFAULT '[]',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reviews (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    user_name TEXT,
    rating INTEGER DEFAULT 5,
    review_text TEXT,
    image_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admins (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE delivery_zones (
    id TEXT PRIMARY KEY,
    zone_name TEXT NOT NULL,
    charge REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    store_name TEXT DEFAULT '',
    logo_url TEXT DEFAULT '',
    favicon_url TEXT DEFAULT '',
    footer_text TEXT DEFAULT '',
    whatsapp_number TEXT DEFAULT '',
    facebook_url TEXT DEFAULT '',
    instagram_url TEXT DEFAULT '',
    youtube_url TEXT DEFAULT '',
    bkash_number TEXT DEFAULT '',
    nagad_number TEXT DEFAULT '',
    binance_manual_uid TEXT DEFAULT '',
    gateway_api_key TEXT DEFAULT '',
    gateway_api_key_v2 TEXT DEFAULT '',
    gateway_version TEXT DEFAULT '',
    allow_cod INTEGER DEFAULT 1,
    enable_fun_checkbox INTEGER DEFAULT 1,
    allow_whatsapp_order INTEGER DEFAULT 1,
    allow_msg_order INTEGER DEFAULT 1,
    advance_amount REAL DEFAULT 0,
    advance_method TEXT DEFAULT '',
    telegram_main_bot TEXT DEFAULT '',
    telegram_main_chats TEXT DEFAULT '',
    telegram_draft_bot TEXT DEFAULT '',
    telegram_draft_chat TEXT DEFAULT '',
    messaging_apps TEXT DEFAULT '[]',
    allow_pickup INTEGER DEFAULT 0,
    store_address TEXT DEFAULT '',
    store_map_link TEXT DEFAULT '',
    pickup_bot_token TEXT DEFAULT '',
    pickup_chat_id TEXT DEFAULT '',
    binance_pay_uid TEXT DEFAULT '',
    binance_proxy_url TEXT DEFAULT '',
    binance_api_key TEXT DEFAULT '',
    binance_api_secret TEXT DEFAULT '',
    usd_to_bdt_rate REAL DEFAULT 120,
    verify_mode TEXT DEFAULT '',
    supabase_edge_url TEXT DEFAULT '',
    hf_api_url TEXT DEFAULT '',
    crypto_coins TEXT DEFAULT '[]',
    review_imgbb_key TEXT DEFAULT '',
    maintenance_mode INTEGER DEFAULT 0,
    maintenance_message TEXT DEFAULT '',
    currency TEXT DEFAULT '৳'
);

CREATE TABLE home_sections (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    data TEXT,
    display_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE devtools (
    id TEXT PRIMARY KEY,
    key_name TEXT UNIQUE NOT NULL,
    value TEXT
);

CREATE TABLE verified_payments (
    id TEXT PRIMARY KEY,
    transaction_id TEXT UNIQUE NOT NULL,
    amount REAL,
    sender_number TEXT,
    status TEXT DEFAULT 'verified',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE banners (
    id TEXT PRIMARY KEY,
    image_url TEXT NOT NULL,
    link_url TEXT,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Insert Default Admin (Password: admin123, you can change later)
INSERT INTO admins (id, email, password_hash) VALUES ('admin_1', 'admin@example.com', 'admin123');

-- Insert Settings
INSERT INTO settings (id, store_name, currency) VALUES (1, 'Freelancing By Rifat', '৳');
