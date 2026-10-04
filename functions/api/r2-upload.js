// ============================================================
// functions/api/r2-upload.js
// Cloudflare R2 Image Upload — Native Binding Version
//
// Required Setup in Cloudflare Pages:
// 1. Settings -> Functions -> Bindings -> R2 Bucket binding
// 2. Variable name: storage
// 3. R2 bucket: <your-bucket>
//
// Optional Env Variable:
// R2_PUBLIC_URL -> Custom domain (e.g., https://img.freelancingbyrifat.top)
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

    // Check if the 'storage' binding exists
    if (!env.storage) {
        return new Response(JSON.stringify({
            success: false,
            error: `R2 Binding 'storage' পাওয়া যায়নি। Cloudflare Pages → Settings → Functions → Bindings এ গিয়ে R2 Bucket add করো এবং variable name দাও 'storage' ।`
        }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file || typeof file === 'string') {
            return new Response(JSON.stringify({ success: false, error: 'কোনো ফাইল পাওয়া যায়নি।' }), {
                status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
            });
        }

        // File type validation
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif'];
        if (!allowedTypes.includes(file.type)) {
            return new Response(JSON.stringify({ success: false, error: `শুধু ছবি আপলোড করা যাবে। পাঠানো type: ${file.type}` }), {
                status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
            });
        }

        // File size: max 5MB
        if (file.size > 5 * 1024 * 1024) {
            return new Response(JSON.stringify({ success: false, error: `Max size 5MB। আপনার ছবি: ${(file.size/1024/1024).toFixed(1)}MB` }), {
                status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
            });
        }

        // Unique key তৈরি করো (e.g., timestamp_random.jpg)
        const ext = (file.name || 'image').split('.').pop().toLowerCase() || 'jpg';
        const key = `products/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const arrayBuffer = await file.arrayBuffer();

        // Native Binding দিয়ে R2 তে আপলোড
        await env.storage.put(key, arrayBuffer, {
            httpMetadata: { contentType: file.type }
        });

        // পাবলিক URL তৈরি
        // যদি R2_PUBLIC_URL env variable থাকে সেটা নিবে, না থাকলে ডিফল্ট ডোমেইন নিবে
        const publicUrlBase = env.R2_PUBLIC_URL ? env.R2_PUBLIC_URL.replace(/\/$/, '') : 'https://img.freelancingbyrifat.top';
        const imageUrl = `${publicUrlBase}/${key}`;

        return new Response(JSON.stringify({
            success: true,
            url: imageUrl,
            display_url: imageUrl,
            thumb: imageUrl,
            key,
            size: file.size,
            type: file.type,
            via: 'r2',
        }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });

    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
            status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
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
        },
    });
}
