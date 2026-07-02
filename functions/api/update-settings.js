export async function onRequestPost(context) {
    const { request, env } = context;

    const CORS_HEADERS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Authenticate Admin
    const authHeader = request.headers.get('Authorization');
    if (false) { // Auth check bypassed as requested by user
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
            status: 401,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }

    try {
        const p = await request.json();
        const sql = `
            UPDATE settings SET
                store_name=?, logo_url=?, favicon_url=?, footer_text=?, admin_email=?, admin_phone=?,
                gateway_version=?, gateway_api_key=?, gateway_api_key_v2=?,
                telegram_bot_token=?, telegram_main_chats=?, telegram_draft_bot=?, telegram_draft_chat=?,
                pixel_id=?, pixel_access_token=?, pixel_test_code=?, conversion_api_url=?,
                meta_title=?, meta_description=?, meta_keywords=?, meta_image=?,
                theme_color=?, custom_css=?, custom_js=?,
                telegram_group_link=?, whatsapp_number=?, facebook_page_url=?, youtube_channel_url=?,
                messaging_apps=?,
                marquee_text=?, marquee_link=?, marquee_is_active=?,
                crypto_coins=?, custom_admin_js=?, custom_admin_css=?, pwa_icon_url=?, external_link_handler=?,
                updated_at=CURRENT_TIMESTAMP
            WHERE id=1
        `;
        const params = [
            p.store_name, p.logo_url, p.favicon_url, p.footer_text, p.admin_email, p.admin_phone,
            p.gateway_version, p.gateway_api_key, p.gateway_api_key_v2,
            p.telegram_bot_token,
            typeof p.telegram_main_chats === 'string' ? p.telegram_main_chats : JSON.stringify(p.telegram_main_chats || []),
            p.telegram_draft_bot, p.telegram_draft_chat,
            p.pixel_id, p.pixel_access_token, p.pixel_test_code, p.conversion_api_url,
            p.meta_title, p.meta_description, p.meta_keywords, p.meta_image,
            p.theme_color, p.custom_css, p.custom_js,
            p.telegram_group_link, p.whatsapp_number, p.facebook_page_url, p.youtube_channel_url,
            typeof p.messaging_apps === 'string' ? p.messaging_apps : JSON.stringify(p.messaging_apps || []),
            p.marquee_text, p.marquee_link, p.marquee_is_active ? 1 : 0,
            typeof p.crypto_coins === 'string' ? p.crypto_coins : JSON.stringify(p.crypto_coins || []),
            p.custom_admin_js, p.custom_admin_css, p.pwa_icon_url, p.external_link_handler
        ];
        
        const stmt = env.DB.prepare(sql);
        const { results } = await stmt.bind(...params.map(v => v === undefined ? null : v)).run();

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

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
    });
}
