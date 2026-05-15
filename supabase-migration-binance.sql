-- ── Binance Pay & Crypto Verified Payments ──
-- Double-spend protection: same TxID 2 bar use kora jabe na
CREATE TABLE IF NOT EXISTS verified_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id TEXT UNIQUE NOT NULL,
  order_id TEXT NOT NULL,
  amount DECIMAL,
  currency TEXT,
  method TEXT, -- 'binance_pay' | 'crypto'
  coin TEXT,   -- 'USDT', 'BTC', 'ETH' etc.
  network TEXT, -- 'TRC20', 'ERC20', 'BEP20' etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Policies for verified_payments (allow all read/write for now, or just anon insert)
ALTER TABLE verified_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON verified_payments FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON verified_payments FOR INSERT WITH CHECK (true);
