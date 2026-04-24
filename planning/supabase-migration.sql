-- ============================================================
-- ORDER SYSTEM UPDATE - Supabase Schema Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── 1. Settings Table: New Columns ──────────────────────────
ALTER TABLE settings ADD COLUMN IF NOT EXISTS messaging_apps jsonb DEFAULT '[]'::jsonb;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS allow_pickup boolean DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS pickup_bot_token text DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS pickup_chat_id text DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS store_address text DEFAULT '';

-- ── 2. Orders Table: Order Type ─────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type text DEFAULT 'delivery';

-- ── 3. Products Table: Video Type ───────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS video_type text DEFAULT 'auto';

-- ── 4. Promos Table: Coupon Rules ───────────────────────────
ALTER TABLE promos ADD COLUMN IF NOT EXISTS applicable_to text DEFAULT 'all';
ALTER TABLE promos ADD COLUMN IF NOT EXISTS product_ids jsonb DEFAULT '[]'::jsonb;
ALTER TABLE promos ADD COLUMN IF NOT EXISTS category_ids jsonb DEFAULT '[]'::jsonb;
ALTER TABLE promos ADD COLUMN IF NOT EXISTS min_quantity int4 DEFAULT 0;
ALTER TABLE promos ADD COLUMN IF NOT EXISTS min_amount int4 DEFAULT 0;
ALTER TABLE promos ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'fixed';

-- ── 5. Product Categories Junction Table (Many-to-Many) ─────
CREATE TABLE IF NOT EXISTS product_categories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id uuid REFERENCES products(id) ON DELETE CASCADE,
    category_id uuid REFERENCES categories(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(product_id, category_id)
);

-- Enable RLS (same pattern as other tables)
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- Allow public read/write (same as your other tables)
CREATE POLICY "Allow public read product_categories" ON product_categories FOR SELECT USING (true);
CREATE POLICY "Allow public insert product_categories" ON product_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update product_categories" ON product_categories FOR UPDATE USING (true);
CREATE POLICY "Allow public delete product_categories" ON product_categories FOR DELETE USING (true);

-- ── 6. Migrate existing category_id data to junction table ──
INSERT INTO product_categories (product_id, category_id)
SELECT id, category_id::uuid FROM products
WHERE category_id IS NOT NULL AND category_id != ''
ON CONFLICT (product_id, category_id) DO NOTHING;
