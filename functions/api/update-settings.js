export async function onRequestPost(context) {
    const { request, env } = context;

    const CORS_HEADERS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    // Auth check bypassed as requested by user
    if (false) { 
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
            status: 401,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    try {
        const p = await request.json();
        const sql = `
            UPDATE settings SET
                store_name=?, logo_url=?, favicon_url=?, footer_text=?, whatsapp_number=?, facebook_url=?, instagram_url=?, youtube_url=?, 
                bkash_number=?, nagad_number=?, binance_manual_uid=?, gateway_api_key=?, gateway_api_key_v2=?, gateway_version=?, 
                allow_cod=?, enable_fun_checkbox=?, allow_whatsapp_order=?, allow_msg_order=?, advance_amount=?, advance_method=?, 
                telegram_main_bot=?, telegram_main_chats=?, telegram_draft_bot=?, telegram_draft_chat=?, messaging_apps=?, 
                allow_pickup=?, store_address=?, store_map_link=?, pickup_bot_token=?, pickup_chat_id=?, binance_pay_uid=?, 
                binance_proxy_url=?, binance_api_key=?, binance_api_secret=?, usd_to_bdt_rate=?, verify_mode=?, supabase_edge_url=?, 
                hf_api_url=?, crypto_coins=?, review_imgbb_key=?
            WHERE id=1
        `;
        const params = [
            p.store_name, p.logo_url, p.favicon_url, p.footer_text, p.whatsapp_number, p.facebook_url, p.instagram_url, p.youtube_url, 
            p.bkash_number, p.nagad_number, p.binance_manual_uid, p.gateway_api_key, p.gateway_api_key_v2, p.gateway_version, 
            p.allow_cod ? 1 : 0, p.enable_fun_checkbox ? 1 : 0, p.allow_whatsapp_order ? 1 : 0, p.allow_msg_order ? 1 : 0, p.advance_amount, p.advance_method, 
            p.telegram_main_bot, 
            typeof p.telegram_main_chats === 'string' ? p.telegram_main_chats : JSON.stringify(p.telegram_main_chats || []), 
            p.telegram_draft_bot, p.telegram_draft_chat, 
            typeof p.messaging_apps === 'string' ? p.messaging_apps : JSON.stringify(p.messaging_apps || []), 
            p.allow_pickup ? 1 : 0, p.store_address, p.store_map_link, p.pickup_bot_token, p.pickup_chat_id, p.binance_pay_uid, 
            p.binance_proxy_url, p.binance_api_key, p.binance_api_secret, p.usd_to_bdt_rate, p.verify_mode, p.supabase_edge_url, 
            p.hf_api_url, 
            typeof p.crypto_coins === 'string' ? p.crypto_coins : JSON.stringify(p.crypto_coins || []), 
            p.review_imgbb_key
        ];
        
        const stmt = env.DB.prepare(sql);
        const { results } = await stmt.bind(...params.map(v => v === undefined ? null : v)).run();

        
        // Auto-purge Cloudflare Cache in background if credentials exist
        if (env.CLOUDFLARE_ZONE_ID && env.CLOUDFLARE_API_TOKEN) {
            context.waitUntil(
                fetch(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/purge_cache`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ purge_everything: true })
                }).catch(() => {})
            );
        }

        return new Response(JSON.stringify({ success: true, result: [{ results }] }), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }
}
