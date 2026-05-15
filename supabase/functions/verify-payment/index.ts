// ============================================================
// Supabase Edge Function: verify-payment
// URL: https://qdkppbwjgkkxzgzgsykv.supabase.co/functions/v1/verify-payment
//
// ── PURPOSE ──────────────────────────────────────────────────
// Backup verification system — works WITHOUT cPanel/PHP proxy.
// Runs on Supabase's own Deno servers (100% Supabase-native).
//
// ── WHAT IT DOES ─────────────────────────────────────────────
// 1. Receives TxID from checkout frontend
// 2. Checks verified_payments table — double-spend protection
// 3. Locks the TxID atomically (INSERT with UNIQUE constraint)
// 4. Returns success → frontend places order as "Manual Review"
//
// ── DEPLOY ───────────────────────────────────────────────────
// supabase functions deploy verify-payment
// OR: Supabase Dashboard → Edge Functions → New Function
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, message: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // ── Supabase client (uses service role for trusted inserts) ──
    const supabaseUrl  = Deno.env.get('SUPABASE_URL')!;
    const serviceRole  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, serviceRole);

    // ── Parse request body ────────────────────────────────────
    const body = await req.json();
    const {
      transaction_id,
      method   = 'crypto',
      amount   = 0,
      currency = 'USDT',
      coin     = 'USDT',
      network  = '',
    } = body;

    if (!transaction_id || !transaction_id.trim()) {
      return new Response(
        JSON.stringify({ success: false, message: 'Transaction ID is required.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const txid = transaction_id.trim();

    // ── Step 1: Double-spend check ────────────────────────────
    const { data: existing, error: checkErr } = await sb
      .from('verified_payments')
      .select('id, order_id')
      .eq('transaction_id', txid)
      .maybeSingle();

    if (checkErr) {
      return new Response(
        JSON.stringify({ success: false, message: 'DB check error: ' + checkErr.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existing) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'এই Transaction ID আগেই ব্যবহার করা হয়েছে! Double-spend rejected.',
          code: 'DUPLICATE_TXID',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Step 2: Lock TxID atomically ─────────────────────────
    // UNIQUE constraint on transaction_id prevents race conditions
    const { error: insertErr } = await sb.from('verified_payments').insert([{
      transaction_id: txid,
      order_id:       'PENDING',
      amount:         parseFloat(String(amount)) || 0,
      currency:       currency || 'USDT',
      method:         method   || 'crypto',
      coin:           coin     || 'USDT',
      network:        network  || '',
    }]);

    if (insertErr) {
      // UNIQUE constraint violation = duplicate in race condition
      if (insertErr.code === '23505') {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Transaction ID already recorded (race condition). Double-spend blocked.',
            code: 'DUPLICATE_TXID',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, message: 'Insert error: ' + insertErr.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Success ───────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success:        true,
        message:        'Payment recorded. Admin will manually review and confirm.',
        transaction_id: txid,
        mode:           'supabase_backup',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, message: 'Server error: ' + msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
