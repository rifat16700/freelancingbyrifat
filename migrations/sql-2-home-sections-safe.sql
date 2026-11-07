-- ============================================================================
-- SQL #2: HOMEPAGE SECTIONS (`home_sections`) SAFE / NO-OVERWRITE SQL
-- ============================================================================
-- ✅ Creates `home_sections` if you forgot to add it earlier.
-- ✅ Never overwrites or deletes existing sections (`CREATE TABLE IF NOT EXISTS`).
-- ✅ Includes all columns needed by `admin/sections.html` and Multi-Brand.
-- ============================================================================

-- 1. Create `home_sections` table if it does not exist yet
CREATE TABLE IF NOT EXISTS home_sections (
    id            TEXT PRIMARY KEY,
    title         TEXT DEFAULT '',
    subtitle      TEXT DEFAULT '',
    type          TEXT DEFAULT 'category',
    section_type  TEXT DEFAULT 'grid',
    category_id   TEXT DEFAULT NULL,
    product_ids   TEXT DEFAULT '[]',
    max_products  INTEGER DEFAULT 10,
    sort_order    INTEGER DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    is_active     INTEGER DEFAULT 1,
    data          TEXT DEFAULT '{}',
    brand_id      TEXT DEFAULT NULL,
    created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 2. If `home_sections` already existed with an older structure, fill in any missing columns:
-- (Run only if your old table was missing these columns)
ALTER TABLE home_sections ADD COLUMN subtitle TEXT DEFAULT '';
ALTER TABLE home_sections ADD COLUMN type TEXT DEFAULT 'category';
ALTER TABLE home_sections ADD COLUMN section_type TEXT DEFAULT 'grid';
ALTER TABLE home_sections ADD COLUMN category_id TEXT DEFAULT NULL;
ALTER TABLE home_sections ADD COLUMN product_ids TEXT DEFAULT '[]';
ALTER TABLE home_sections ADD COLUMN max_products INTEGER DEFAULT 10;
ALTER TABLE home_sections ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE home_sections ADD COLUMN display_order INTEGER DEFAULT 0;
ALTER TABLE home_sections ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE home_sections ADD COLUMN data TEXT DEFAULT '{}';
ALTER TABLE home_sections ADD COLUMN brand_id TEXT DEFAULT NULL;

-- 3. Safe Indexes (skips if already exists)
CREATE INDEX IF NOT EXISTS idx_home_sections_sort  ON home_sections(sort_order, is_active);
CREATE INDEX IF NOT EXISTS idx_home_sections_brand ON home_sections(brand_id);

