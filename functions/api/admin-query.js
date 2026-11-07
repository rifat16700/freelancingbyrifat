import { purgeAndWarmup } from './cache-helper.js';
import { ensureBrandSchema } from '../_lib/brand.js';

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
        const body = await request.json();
        const { sql, params = [] } = body;

        if (!env.DB) {
            return new Response(JSON.stringify({ success: false, error: "Database binding missing! Please go to Cloudflare Settings -> Bindings and bind your D1 database to the variable name 'DB'." }), {
                status: 500,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
        }
        await ensureBrandSchema(env);
        const stmt = env.DB.prepare(sql);
        const { results } = await stmt.bind(...params.map(v => v === undefined ? null : v)).all();

        // Selective Cache Purging for Checkout & Public Data
        const sqlUpper = sql.toUpperCase();
        if (sqlUpper.includes("INSERT ") || sqlUpper.includes("UPDATE ") || sqlUpper.includes("DELETE ")) {
            const origin = new URL(request.url).origin;
            const filesToPurge = [];
            if (sqlUpper.includes("PROMOS") || sqlUpper.includes("ADDONS") || sqlUpper.includes("DELIVERY_ZONES") || sqlUpper.includes("SETTINGS")) {
                filesToPurge.push(origin + "/api/checkout-data");
            }
            if (sqlUpper.includes("CATEGORIES") || sqlUpper.includes("BANNERS") || sqlUpper.includes("HOME_SECTIONS") || sqlUpper.includes("SETTINGS") || sqlUpper.includes("BRANDS")) {
                filesToPurge.push(origin + "/api/public-data");
            }
            if (filesToPurge.length > 0) {
                context.waitUntil(purgeAndWarmup(env, origin, filesToPurge));
            }
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
