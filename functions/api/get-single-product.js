// ============================================================
// functions/api/get-single-product.js
// Cloudflare Pages Function — Fetch one product by ID
// Supports Supabase and Appwrite
// ============================================================

import { getConfig } from '../utils/config.js';

// JSON fields stored as strings in Appwrite — parse them back
const JSON_FIELDS = ['variants', 'gallery_images', 'product_ids', 'category_ids'];

function parseJsonFields(doc) {
    const out = { ...doc };
    for (const key of JSON_FIELDS) {
        if (key in out && typeof out[key] === 'string') {
            try { out[key] = JSON.parse(out[key]); } catch (_) {}
        }
    }
    return out;
}

function mapDoc(doc) {
    const mapped = { ...doc };
    mapped.id         = doc.$id;
    mapped.created_at = doc.$createdAt;
    mapped.updated_at = doc.$updatedAt;
    delete mapped.$id;
    delete mapped.$createdAt;
    delete mapped.$updatedAt;
    delete mapped.$permissions;
    delete mapped.$collectionId;
    delete mapped.$databaseId;
    return parseJsonFields(mapped);
}

export async function onRequest(context) {
    const config = getConfig(context.env);

    try {
        const { searchParams } = new URL(context.request.url);
        const id = searchParams.get('id');

        if (!id) {
            return new Response(
                JSON.stringify({ error: 'Missing required query parameter: id' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        let finalData = [];

        if (config.DB_PROVIDER === 'appwrite') {
            // ── APPWRITE ──────────────────────────────────────
            // Appwrite: fetch by document ID directly
            const headers = {
                'X-Appwrite-Project': config.APPWRITE_PROJECT,
                'Content-Type':       'application/json',
            };
            if (config.APPWRITE_API_KEY) {
                headers['X-Appwrite-Key'] = config.APPWRITE_API_KEY;
            }

            const url = `${config.APPWRITE_ENDPOINT}/databases/${config.APPWRITE_DATABASE_ID}/collections/${config.APPWRITE_COLLECTION_PRODUCTS}/documents/${id}`;
            const response = await fetch(url, { headers });

            if (response.status === 404) {
                // Try searching by `id` attribute (Supabase numeric/text id stored as attribute)
                const searchUrl  = `${config.APPWRITE_ENDPOINT}/databases/${config.APPWRITE_DATABASE_ID}/collections/${config.APPWRITE_COLLECTION_PRODUCTS}/documents`;
                const params     = new URLSearchParams();
                params.append('queries[]', `equal("id", ["${id}"])`);
                params.append('queries[]', 'limit(1)');

                const searchRes  = await fetch(`${searchUrl}?${params}`, { headers });
                if (searchRes.ok) {
                    const searchJson = await searchRes.json();
                    if (searchJson.documents && searchJson.documents.length > 0) {
                        finalData = [mapDoc(searchJson.documents[0])];
                    }
                }

            } else if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Appwrite error: ${response.status} — ${errText}`);
            } else {
                const doc = await response.json();
                finalData = [mapDoc(doc)];
            }

        } else {
            // ── SUPABASE ──────────────────────────────────────
            const response = await fetch(
                `${config.SUPABASE_URL}/rest/v1/products?id=eq.${id}&select=*`,
                {
                    headers: {
                        'apikey':        config.SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${config.SUPABASE_ANON_KEY}`,
                    },
                }
            );
            if (!response.ok) throw new Error(`Supabase error: ${response.status}`);
            finalData = await response.json();
        }

        return new Response(JSON.stringify(finalData), {
            status:  200,
            headers: {
                'Content-Type':                'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });

    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'Failed to fetch product', details: String(error) }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
