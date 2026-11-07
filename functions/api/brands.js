import {
    ensureBrandSchema,
    cleanSlug,
    isReservedSlug,
    isValidBrandSlug,
    normalizeBrandRow
} from '../_lib/brand.js';
import { purgeAndWarmup } from './cache-helper.js';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonRes(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
}

export async function onRequestGet(context) {
    const { env } = context;
    if (!env.DB) return jsonRes({ success: false, error: "Database not configured" }, 500);

    try {
        await ensureBrandSchema(env);

        const brandsRes = await env.DB.prepare("SELECT * FROM brands ORDER BY sort_order ASC, created_at ASC").all();
        const countsRes = await env.DB.prepare(
            "SELECT brand_id, COUNT(*) as cnt FROM products WHERE brand_id IS NOT NULL AND brand_id != '' GROUP BY brand_id"
        ).all().catch(() => ({ results: [] }));

        const countMap = new Map((countsRes.results || []).map(r => [r.brand_id, Number(r.cnt || 0)]));
        const brands = (brandsRes.results || []).map(b => ({
            ...normalizeBrandRow(b),
            product_count: countMap.get(b.id) || 0
        }));

        return jsonRes({ success: true, brands });
    } catch (e) {
        return jsonRes({ success: false, error: e.message }, 500);
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;
    if (!env.DB) return jsonRes({ success: false, error: "Database not configured" }, 500);

    try {
        await ensureBrandSchema(env);

        const body = await request.json();
        const action = (body.action || 'save').toLowerCase();

        // 1. Validate slug availability without saving
        if (action === 'check_slug') {
            const slug = cleanSlug(body.slug || '');
            const excludeId = body.exclude_id || '';
            if (!slug) return jsonRes({ success: true, valid: false, reason: "Slug খালি রাখা যাবে না।" });
            if (isReservedSlug(slug)) return jsonRes({ success: true, valid: false, reason: `"${slug}" একটি সংরক্ষিত (reserved) সিস্টেম পাথ। অন্য নাম দিন।` });
            if (!isValidBrandSlug(slug)) return jsonRes({ success: true, valid: false, reason: "শুধুমাত্র ইংরেজি ছোট হাতের অক্ষর (a-z), সংখ্যা (0-9) এবং হাইফেন (-) ব্যবহার করা যাবে (২-৪০ অক্ষর)।" });

            const existing = await env.DB.prepare("SELECT id FROM brands WHERE lower(slug) = ? LIMIT 1").bind(slug).first();
            if (existing && existing.id !== excludeId) {
                return jsonRes({ success: true, valid: false, reason: `"${slug}" পাথটি ইতিমধ্যে অন্য ব্র্যান্ডে ব্যবহৃত হচ্ছে।` });
            }
            return jsonRes({ success: true, valid: true, slug });
        }

        // 2. Delete brand
        if (action === 'delete') {
            const brandId = body.id;
            const productMode = body.product_mode || 'move_to_main'; // 'move_to_main' | 'delete_products'
            if (!brandId) return jsonRes({ success: false, error: "Brand ID required" }, 400);

            const oldBrand = await env.DB.prepare("SELECT * FROM brands WHERE id = ?").bind(brandId).first();
            if (!oldBrand) return jsonRes({ success: false, error: "Brand not found" }, 404);

            if (productMode === 'delete_products') {
                await env.DB.prepare("DELETE FROM products WHERE brand_id = ?").bind(brandId).run();
            } else {
                await env.DB.prepare("UPDATE products SET brand_id = NULL, show_on_main = 0 WHERE brand_id = ?").bind(brandId).run();
            }
            await env.DB.prepare("UPDATE categories SET brand_id = NULL WHERE brand_id = ?").bind(brandId).run().catch(() => {});
            await env.DB.prepare("DELETE FROM banners WHERE brand_id = ?").bind(brandId).run().catch(() => {});
            await env.DB.prepare("DELETE FROM home_sections WHERE brand_id = ?").bind(brandId).run().catch(() => {});
            await env.DB.prepare("UPDATE promos SET brand_id = NULL WHERE brand_id = ?").bind(brandId).run().catch(() => {});
            await env.DB.prepare("DELETE FROM brand_slug_history WHERE brand_id = ?").bind(brandId).run().catch(() => {});
            await env.DB.prepare("DELETE FROM brands WHERE id = ?").bind(brandId).run();

            if (env.CLOUDFLARE_ZONE_ID && env.CLOUDFLARE_API_TOKEN) {
                const origin = new URL(request.url).origin;
                context.waitUntil(purgeAndWarmup(env, origin, [
                    origin + "/",
                    origin + "/shop",
                    origin + "/api/public-data",
                    `${origin}/${oldBrand.slug}/`,
                    `${origin}/${oldBrand.slug}/shop`
                ]));
            }

            return jsonRes({ success: true });
        }

        // 3. Create or Update brand
        const name = (body.name || '').trim();
        const slug = cleanSlug(body.slug || name.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase());

        if (!name) return jsonRes({ success: false, error: "ব্র্যান্ডের নাম দেওয়া আবশ্যক।" }, 400);
        if (!slug) return jsonRes({ success: false, error: "ব্র্যান্ডের URL পাথ (slug) দেওয়া আবশ্যক।" }, 400);
        if (isReservedSlug(slug)) {
            return jsonRes({ success: false, error: `"${slug}" একটি সংরক্ষিত (reserved) পাথ। দয়া করে অন্য পাথ দিন।` }, 400);
        }
        if (!isValidBrandSlug(slug)) {
            return jsonRes({ success: false, error: "URL পাথে শুধুমাত্র a-z, 0-9 এবং হাইফেন (-) ব্যবহার করা যাবে (২-৪০ অক্ষর)।" }, 400);
        }

        let brandId = (body.id || '').trim();
        const duplicate = await env.DB.prepare("SELECT id FROM brands WHERE lower(slug) = ? LIMIT 1").bind(slug).first();
        if (duplicate && duplicate.id !== brandId) {
            return jsonRes({ success: false, error: `"${slug}" পাথটি ইতিমধ্যে অন্য ব্র্যান্ডে ব্যবহৃত হচ্ছে।` }, 400);
        }

        const themeColors = typeof body.theme_colors === 'string' ? body.theme_colors : JSON.stringify(body.theme_colors || {});
        const settingsOverride = typeof body.settings_override === 'string' ? body.settings_override : JSON.stringify(body.settings_override || {});
        const isActive = body.is_active === undefined ? 1 : (body.is_active ? 1 : 0);
        const sortOrder = parseInt(body.sort_order, 10) || 0;

        if (brandId) {
            const prev = await env.DB.prepare("SELECT slug FROM brands WHERE id = ?").bind(brandId).first();
            await env.DB.prepare(`
                UPDATE brands SET
                    slug = ?, name = ?, tagline = ?, logo_url = ?, favicon_url = ?,
                    theme_colors = ?, seo_title = ?, seo_description = ?, seo_keywords = ?,
                    seo_og_image = ?, footer_text = ?, settings_override = ?,
                    is_active = ?, sort_order = ?
                WHERE id = ?
            `).bind(
                slug, name, body.tagline || '', body.logo_url || '', body.favicon_url || '',
                themeColors, body.seo_title || '', body.seo_description || '', body.seo_keywords || '',
                body.seo_og_image || '', body.footer_text || '', settingsOverride,
                isActive, sortOrder, brandId
            ).run();

            // Record old slug in history for 301 redirects if path was edited
            if (prev && prev.slug && cleanSlug(prev.slug) !== slug) {
                const oldSlug = cleanSlug(prev.slug);
                await env.DB.prepare(
                    "INSERT OR REPLACE INTO brand_slug_history (old_slug, brand_id, changed_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
                ).bind(oldSlug, brandId).run().catch(() => {});
            }
            // If new slug existed in history pointing elsewhere or self, remove it from history
            await env.DB.prepare("DELETE FROM brand_slug_history WHERE lower(old_slug) = ?").bind(slug).run().catch(() => {});
        } else {
            brandId = 'brand_' + Date.now();
            await env.DB.prepare(`
                INSERT INTO brands (
                    id, slug, name, tagline, logo_url, favicon_url,
                    theme_colors, seo_title, seo_description, seo_keywords,
                    seo_og_image, footer_text, settings_override,
                    is_active, sort_order, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).bind(
                brandId, slug, name, body.tagline || '', body.logo_url || '', body.favicon_url || '',
                themeColors, body.seo_title || '', body.seo_description || '', body.seo_keywords || '',
                body.seo_og_image || '', body.footer_text || '', settingsOverride,
                isActive, sortOrder
            ).run();
            await env.DB.prepare("DELETE FROM brand_slug_history WHERE lower(old_slug) = ?").bind(slug).run().catch(() => {});
        }

        if (env.CLOUDFLARE_ZONE_ID && env.CLOUDFLARE_API_TOKEN) {
            const origin = new URL(request.url).origin;
            context.waitUntil(purgeAndWarmup(env, origin, [
                origin + "/",
                origin + "/shop",
                origin + "/sitemap.xml",
                origin + "/api/public-data",
                `${origin}/${slug}/`,
                `${origin}/${slug}/shop`,
                `${origin}/api/public-data?brand=${encodeURIComponent(slug)}`
            ]));
        }

        const saved = await env.DB.prepare("SELECT * FROM brands WHERE id = ?").bind(brandId).first();
        return jsonRes({ success: true, brand: normalizeBrandRow(saved) });
    } catch (e) {
        return jsonRes({ success: false, error: e.message }, 500);
    }
}

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

