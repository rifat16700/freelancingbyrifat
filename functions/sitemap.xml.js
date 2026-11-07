import { ensureBrandSchema, getAllActiveBrands } from './_lib/brand.js';

export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    let siteUrl = url.origin;
    let products = [];
    let categories = [];
    let brands = [];

    if (env.DB) {
        try {
            await ensureBrandSchema(env);

            const sRes = await env.DB.prepare("SELECT site_url FROM settings WHERE id = 1").first();
            if (sRes && sRes.site_url && sRes.site_url.trim()) {
                siteUrl = sRes.site_url.trim().replace(/\/+$/, '');
            } else if (env.SITE_URL && env.SITE_URL.trim()) {
                siteUrl = env.SITE_URL.trim().replace(/\/+$/, '');
            }

            brands = await getAllActiveBrands(env);

            const pRes = await env.DB.prepare(
                "SELECT id, name, gallery_images, variants, brand_id, created_at FROM products WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1000"
            ).all();
            products = pRes.results || [];

            const cRes = await env.DB.prepare("SELECT id, brand_id FROM categories WHERE is_active = 1").all();
            categories = cRes.results || [];
        } catch (e) {}
    }

    if (siteUrl && !siteUrl.startsWith('http://') && !siteUrl.startsWith('https://')) {
        siteUrl = 'https://' + siteUrl;
    }

    const brandMap = new Map(brands.map(b => [b.id, b]));
    const today = new Date().toISOString().split('T')[0];

    function escXml(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <!-- Core Main Site Pages -->
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${siteUrl}/shop</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${siteUrl}/policies</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${siteUrl}/team</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>
  <url>
    <loc>${siteUrl}/track</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>`;

    // Active Brand Storefronts
    for (const b of brands) {
        xml += `
  <url>
    <loc>${siteUrl}/${encodeURIComponent(b.slug)}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.95</priority>
  </url>
  <url>
    <loc>${siteUrl}/${encodeURIComponent(b.slug)}/shop</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;
    }

    // Categories (Main & Brand-scoped)
    for (const cat of categories) {
        if (cat.brand_id && !brandMap.has(cat.brand_id)) continue;
        const cb = cat.brand_id ? brandMap.get(cat.brand_id) : null;
        const prefix = cb ? `/${encodeURIComponent(cb.slug)}` : '';
        xml += `
  <url>
    <loc>${siteUrl}${prefix}/shop?cat=${encodeURIComponent(cat.id)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }

    // Active Products with canonical Brand or Main URLs
    for (const prod of products) {
        if (prod.brand_id && !brandMap.has(prod.brand_id)) continue;
        const pb = prod.brand_id ? brandMap.get(prod.brand_id) : null;
        const prefix = pb ? `/${encodeURIComponent(pb.slug)}` : '';

        let prodDate = today;
        if (prod.created_at) {
            prodDate = prod.created_at.split(' ')[0].split('T')[0];
        }

        let images = [];
        try {
            const gallery = typeof prod.gallery_images === 'string' ? JSON.parse(prod.gallery_images) : (prod.gallery_images || []);
            if (Array.isArray(gallery)) {
                gallery.forEach(u => {
                    if (u && typeof u === 'string') {
                        images.push(u.startsWith('http') ? u : siteUrl + (u.startsWith('/') ? '' : '/') + u);
                    }
                });
            }
        } catch (e) {}
        try {
            const variants = typeof prod.variants === 'string' ? JSON.parse(prod.variants) : (prod.variants || []);
            if (Array.isArray(variants)) {
                variants.forEach(v => {
                    if (v && v.imageUrl) {
                        const vu = v.imageUrl.startsWith('http') ? v.imageUrl : siteUrl + (v.imageUrl.startsWith('/') ? '' : '/') + v.imageUrl;
                        if (!images.includes(vu)) images.push(vu);
                    }
                });
            }
        } catch (e) {}

        let imgTagsXml = '';
        for (const imgUrl of images) {
            imgTagsXml += `
    <image:image>
      <image:loc>${escXml(imgUrl)}</image:loc>
      <image:title>${escXml(prod.name)}</image:title>
    </image:image>`;
        }

        xml += `
  <url>
    <loc>${siteUrl}${prefix}/product?id=${encodeURIComponent(prod.id)}</loc>
    <lastmod>${prodDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${imgTagsXml}
  </url>`;
    }

    xml += `\n</urlset>`;

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=300, s-maxage=300',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
