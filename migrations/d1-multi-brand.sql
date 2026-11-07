-- Multi-brand migration for Cloudflare D1 (Revision 2 — safe: only adds, existing data untouched)
-- Run: npx wrangler d1 execute <DB_NAME> --remote --file=migrations/d1-multi-brand.sql
-- NOTE: ALTER TABLE ADD COLUMN errors with "duplicate column" if already applied; ignore those.

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
  footer_text       TEXT DEFAULT '',
  settings_override TEXT DEFAULT '{}',
  is_active         INTEGER DEFAULT 1,
  sort_order        INTEGER DEFAULT 0,
  created_at        TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS brand_slug_history (
  old_slug   TEXT PRIMARY KEY,
  brand_id   TEXT NOT NULL,
  changed_at TEXT DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE products      ADD COLUMN brand_id TEXT DEFAULT NULL;
ALTER TABLE products      ADD COLUMN show_on_main INTEGER DEFAULT 0;
ALTER TABLE categories    ADD COLUMN brand_id TEXT DEFAULT NULL;
ALTER TABLE banners       ADD COLUMN brand_id TEXT DEFAULT NULL;
ALTER TABLE home_sections ADD COLUMN brand_id TEXT DEFAULT NULL;
ALTER TABLE orders        ADD COLUMN brand_id TEXT DEFAULT NULL;
ALTER TABLE orders        ADD COLUMN order_group_id TEXT DEFAULT NULL;
ALTER TABLE promos        ADD COLUMN brand_id TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_products_brand        ON products(brand_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_show_on_main ON products(show_on_main, is_active);
CREATE INDEX IF NOT EXISTS idx_categories_brand      ON categories(brand_id);
CREATE INDEX IF NOT EXISTS idx_banners_brand         ON banners(brand_id);
CREATE INDEX IF NOT EXISTS idx_sections_brand        ON home_sections(brand_id);
CREATE INDEX IF NOT EXISTS idx_orders_brand          ON orders(brand_id);
CREATE INDEX IF NOT EXISTS idx_orders_group          ON orders(order_group_id);
