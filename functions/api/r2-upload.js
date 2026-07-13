// ============================================================
// functions/api/r2-upload.js
// Cloudflare R2 Image Upload Function
// POST /api/r2-upload — multipart/form-data (field: "file")
// Returns: { success: true, url: "https://..." }
// ============================================================

export async function onRequestPost(context) {
    const { request, env } = context;

    const CORS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS });
    }

    // R2 Bucket binding আছে কিনা চেক করো
    if (!env.R2_BUCKET) {
        return new Response(JSON.stringify({
            success: false,
            error: 'R2_BUCKET binding নেই। Cloudflare Pages → Settings → Functions → R2 Bucket Bindings এ "R2_BUCKET" নামে binding অ্যাড করো।'
        }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // Public URL config আছে কিনা চেক করো
    const publicUrl = env.R2_PUBLIC_URL;
    if (!publicUrl) {
        return new Response(JSON.stringify({
            success: false,
            error: 'R2_PUBLIC_URL environment variable নেই। Cloudflare Pages → Settings → Environment Variables এ "R2_PUBLIC_URL" সেট করো।'
        }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    try {
        // Multipart form parse করো
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file || typeof file === 'string') {
            return new Response(JSON.stringify({ success: false, error: 'কোনো ফাইল পাওয়া যায়নি। "file" field দিয়ে multipart/form-data পাঠাও।' }), {
                status: 400,
                headers: { ...CORS, 'Content-Type': 'application/json' }
            });
        }

        // File type validation — শুধু ছবি
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif'];
        if (!allowedTypes.includes(file.type)) {
            return new Response(JSON.stringify({ success: false, error: `শুধুমাত্র ছবি আপলোড করা যাবে (JPEG, PNG, GIF, WebP)। পাঠানো type: ${file.type}` }), {
                status: 400,
                headers: { ...CORS, 'Content-Type': 'application/json' }
            });
        }

        // File size validation — ৫ MB max
        if (file.size > 5 * 1024 * 1024) {
            return new Response(JSON.stringify({ success: false, error: `ছবির সাইজ ${(file.size / 1024 / 1024).toFixed(1)}MB। সর্বোচ্চ ৫MB পাঠানো যাবে।` }), {
                status: 400,
                headers: { ...CORS, 'Content-Type': 'application/json' }
            });
        }

        // Unique filename তৈরি করো
        const ext = file.name.split('.').pop() || 'jpg';
        const uniqueName = `products/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

        // R2 তে আপলোড করো
        const arrayBuffer = await file.arrayBuffer();
        await env.R2_BUCKET.put(uniqueName, arrayBuffer, {
            httpMetadata: {
                contentType: file.type,
                cacheControl: 'public, max-age=31536000', // ১ বছর ক্যাশ
            },
        });

        // Public URL তৈরি করো
        const imageUrl = `${publicUrl.replace(/\/$/, '')}/${uniqueName}`;

        return new Response(JSON.stringify({
            success: true,
            url: imageUrl,
            display_url: imageUrl,
            thumb: imageUrl,
            key: uniqueName,
            size: file.size,
            type: file.type,
        }), {
            status: 200,
            headers: { ...CORS, 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500,
            headers: { ...CORS, 'Content-Type': 'application/json' }
        });
    }
}

// OPTIONS preflight handler
export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
