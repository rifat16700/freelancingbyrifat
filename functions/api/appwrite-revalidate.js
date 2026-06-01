// ============================================================
// functions/api/appwrite-revalidate.js
// Cloudflare Pages Function — Webhook → Cache Purge specifically for Appwrite
// ============================================================

import { getConfig } from '../utils/config.js';

export async function onRequestPost(context) {
    const config = getConfig(context.env);

    // ── Verify authorization header or secret query param ───────
    const authHeader = context.request.headers.get('Authorization');
    const { searchParams } = new URL(context.request.url);
    const querySecret = searchParams.get('secret');

    const providedSecret = authHeader ? authHeader.replace('Bearer ', '') : querySecret;

    if (!config.WEBHOOK_SECRET || providedSecret !== config.WEBHOOK_SECRET) {
        return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            {
                status:  401,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }

    // ── Parse webhook JSON body ────────────────────────────────
    let body;
    try {
        body = await context.request.json();
    } catch (e) {
        return new Response(
            JSON.stringify({ error: 'Invalid JSON body' }),
            {
                status:  400,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }

    // ── Extract document ID ───────────────────────────────────
    const extracted_id = body.$id || body.id || null;

    if (!extracted_id) {
        return new Response(
            JSON.stringify({ error: 'Missing document ID' }),
            {
                status:  400,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }

    // ── Build Cloudflare purge request ────────────────────────
    const CF_PURGE_URL = `https://api.cloudflare.com/client/v4/zones/${config.CF_ZONE_ID}/purge_cache`;
    const origin = new URL(context.request.url).origin;
    const appwriteListUrl = `${origin}/api/appwrite-get-products`;
    const appwriteUrlToPurge = `${origin}/api/appwrite-get-single-product?id=${extracted_id}`;

    try {
        const res = await fetch(CF_PURGE_URL, {
            method:  'POST',
            headers: {
                'Authorization': `Bearer ${config.CF_API_TOKEN}`,
                'Content-Type':  'application/json',
            },
            body: JSON.stringify({ files: [appwriteListUrl, appwriteUrlToPurge] }),
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Cloudflare error ${res.status}: ${errText}`);
        }

        return new Response(
            JSON.stringify({ success: true, purgedId: extracted_id }),
            {
                status:  200,
                headers: { 'Content-Type': 'application/json' },
            }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'Failed to purge cache', details: String(error) }),
            {
                status:  500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
}
