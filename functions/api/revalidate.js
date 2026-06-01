// ============================================================
// functions/api/revalidate.js
// Cloudflare Pages Function — Webhook → Cache Purge
// Supports Supabase and Appwrite Webhooks
// ============================================================

import { getConfig } from '../utils/config.js';

export async function onRequestPost(context) {
    const config = getConfig(context.env);

    // ── 1. Verify secret token ─────────────────────────────────
    // Some webhook providers (like Appwrite) might send custom headers or auth in URL
    // We check Authorization header OR a query parameter for the secret
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

    // ── 2. Parse Webhook body ──────────────────────────────────
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

    // ── 3. Extract ID (Supabase vs Appwrite) ───────────────────
    let productId = null;
    let eventType = null;

    if (body.$id) {
        // Appwrite Webhook Payload
        productId = body.$id;
        eventType = context.request.headers.get('X-Appwrite-Event') || 'appwrite_event';
    } else {
        // Supabase Webhook Payload
        const record = body.record || body.old_record || {};
        productId = record.id || null;
        eventType = body.type; // INSERT | UPDATE | DELETE
    }

    // ── 4. Build URLs to purge ─────────────────────────────────
    const CF_PURGE_URL = `https://api.cloudflare.com/client/v4/zones/${config.CF_ZONE_ID}/purge_cache`;
    
    // Always purge the products list (new/updated/deleted item)
    // Note: Adjust the domain if your production domain is different
    const origin = new URL(context.request.url).origin;
    const listUrl = `${origin}/api/get-products-list`;

    const purgeRequests = [
        fetch(CF_PURGE_URL, {
            method:  'POST',
            headers: {
                'Authorization': `Bearer ${config.CF_API_TOKEN}`,
                'Content-Type':  'application/json',
            },
            body: JSON.stringify({ files: [listUrl] }),
        }),
    ];

    if (productId) {
        const urlToPurge = `${origin}/api/get-single-product?id=${productId}`;
        purgeRequests.push(
            fetch(CF_PURGE_URL, {
                method:  'POST',
                headers: {
                    'Authorization': `Bearer ${config.CF_API_TOKEN}`,
                    'Content-Type':  'application/json',
                },
                body: JSON.stringify({ files: [urlToPurge] }),
            })
        );
    }

    // ── 5. Fire all purge requests in parallel ─────────────────
    try {
        const results = await Promise.all(purgeRequests);
        const statuses = results.map(r => r.status);
        
        return new Response(
            JSON.stringify({ success: true, type: eventType, id: productId, statuses }),
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
