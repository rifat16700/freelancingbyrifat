-- ============================================================================
-- SQL #1: MULTI-BRAND SYSTEM (SAFE / NO-OVERWRITE MIGRATION FOR CLOUDFLARE D1)
-- ============================================================================
-- ✅ Existing tables/data will NOT be overwritten (`IF NOT EXISTS` used).
-- ✅ If a column already exists, D1 may say "duplicate column name" for that
--    single ALTER line; you can safely ignore that or let our built-in
--    auto-migration (`ensureBrandSchema`) handle it automatically.
-- ============================================================================

-- 1. Create `brands` table (only if it does not exist yet)
CREATE TABLE IF NOT EXISTS brands (
    id                TEXT PRIMARY KEY,
    slug              TEXT NOT NULL UNIQUE,
    name              TEXT NOT NULL,
    tagline           TEXT DEFAULT '',
    logo_url          TEXT DEFAULT '',
    favicon_url       TEXT DEFAULT '',
    theme_colors      TEXT DEFAULT '{}',
    seo_title         TEXT DEFAULT '',
    seo_description   TEXT DEFAULT '',
    seo_keywords      TEXT DEFAULT '',
    seo_og_image      TEXT DEFAULT '',
    social_links      TEXT DEFAULT '{}',
    footer_text       TEXT DEFAULT '',
    settings_override TEXT DEFAULT '{}',
    is_active         INTEGER DEFAULT 1,
    sort_order        INTEGER DEFAULT 0,
    created_at        TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create `brand_slug_history` table for automatic 301 Redirects when a brand slug is edited
CREATE TABLE IF NOT EXISTS brand_slug_history (
    old_slug   TEXT PRIMARY KEY,
    brand_id   TEXT NOT NULL,
    changed_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 3. Add Multi-Brand & Master Order columns to existing tables
-- (Existing rows stay 100% untouched; NULL = Main Site)
ALTER TABLE products      ADD COLUMN brand_id TEXT DEFAULT NULL;
ALTER TABLE products      ADD COLUMN show_on_main INTEGER DEFAULT 0;
ALTER TABLE categories    ADD COLUMN brand_id TEXT DEFAULT NULL;
ALTER TABLE banners       ADD COLUMN brand_id TEXT DEFAULT NULL;
ALTER TABLE home_sections ADD COLUMN brand_id TEXT DEFAULT NULL;
ALTER TABLE orders        ADD COLUMN brand_id TEXT DEFAULT NULL;
ALTER TABLE orders        ADD COLUMN order_group_id TEXT DEFAULT NULL;
ALTER TABLE promos        ADD COLUMN brand_id TEXT DEFAULT NULL;

-- 4. Create indexes safely (skips if already exists)
CREATE INDEX IF NOT EXISTS idx_brands_slug           ON brands(slug);
CREATE INDEX IF NOT EXISTS idx_products_brand        ON products(brand_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_show_on_main ON products(show_on_main, is_active);
CREATE INDEX IF NOT EXISTS idx_categories_brand      ON categories(brand_id);
CREATE INDEX IF NOT EXISTS idx_banners_brand         ON banners(brand_id);
CREATE INDEX IF NOT EXISTS idx_sections_brand        ON home_sections(brand_id);
CREATE INDEX IF NOT EXISTS idx_orders_brand          ON orders(brand_id);
CREATE INDEX IF NOT EXISTS idx_orders_group          ON orders(order_group_id);

