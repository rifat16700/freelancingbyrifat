-- Add-Once product column
-- Run this in Supabase Dashboard > SQL Editor

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_add_once BOOLEAN DEFAULT false;
