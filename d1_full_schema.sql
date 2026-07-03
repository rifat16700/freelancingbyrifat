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
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE home_sections (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    data TEXT,
    display_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Insert Default Admin (Password: admin123, you can change later)
INSERT INTO admins (id, email, password_hash) VALUES ('admin_1', 'admin@example.com', 'admin123');

-- Insert Settings
INSERT INTO settings (key, value) VALUES ('store_name', 'Freelancing By Rifat');
INSERT INTO settings (key, value) VALUES ('currency', '৳');
