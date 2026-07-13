// ============================================================
// functions/api/r2-upload.js
// Cloudflare R2 Image Upload — S3-Compatible API Version
//
// এই version টি অন্য Cloudflare Account এর R2 বাকেটেও কাজ করে।
// R2 Binding লাগে না — শুধু API Key দিয়েই কাজ হয়।
//
// Required Environment Variables (Cloudflare Pages → Settings → Env Variables):
//   R2_ACCOUNT_ID       → Account A এর Account ID (32 char hex)
//   R2_BUCKET_NAME      → Bucket এর নাম (যেমন: my-images)
//   R2_ACCESS_KEY_ID    → R2 API Token Access Key ID
//   R2_SECRET_ACCESS_KEY→ R2 API Token Secret Access Key
//   R2_PUBLIC_URL       → Custom Domain URL (যেমন: https://images.site.com)
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

    // Config check
    const accountId   = env.R2_ACCOUNT_ID;
    const bucketName  = env.R2_BUCKET_NAME;
    const accessKeyId = env.R2_ACCESS_KEY_ID;
    const secretKey   = env.R2_SECRET_ACCESS_KEY;
    const publicUrl   = env.R2_PUBLIC_URL;

    const missing = [];
    if (!accountId)   missing.push('R2_ACCOUNT_ID');
    if (!bucketName)  missing.push('R2_BUCKET_NAME');
    if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID');
    if (!secretKey)   missing.push('R2_SECRET_ACCESS_KEY');
    if (!publicUrl)   missing.push('R2_PUBLIC_URL');

    if (missing.length > 0) {
        return new Response(JSON.stringify({
            success: false,
            error: `Environment variables নেই: ${missing.join(', ')}। Cloudflare Pages → Settings → Environment Variables এ সেট করো।`
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

        // Unique key তৈরি করো
        const ext = (file.name || 'image').split('.').pop().toLowerCase() || 'jpg';
        const key = `products/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const arrayBuffer = await file.arrayBuffer();

        // S3-Compatible API তে PUT করো (AWS Signature V4)
        const endpoint = `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${key}`;
        const signedRequest = await signS3Request({
            method: 'PUT',
            url: endpoint,
            body: arrayBuffer,
            contentType: file.type,
            accessKeyId,
            secretKey,
            region: 'auto',
            service: 's3',
        });

        const uploadRes = await fetch(endpoint, {
            method: 'PUT',
            headers: signedRequest.headers,
            body: arrayBuffer,
        });

        if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            return new Response(JSON.stringify({ success: false, error: `R2 upload failed (${uploadRes.status}): ${errText}` }), {
                status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
            });
        }

        const imageUrl = `${publicUrl.replace(/\/$/, '')}/${key}`;

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

// ============================================================
// AWS Signature V4 Implementation (Cloudflare Worker compatible)
// Web Crypto API ব্যবহার করে — কোনো external library লাগে না।
// ============================================================

async function signS3Request({ method, url, body, contentType, accessKeyId, secretKey, region, service }) {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname;
    const path = parsedUrl.pathname;

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z'; // 20240101T120000Z
    const dateStamp = amzDate.slice(0, 8); // 20240101

    // Body hash (SHA-256)
    const bodyHash = await sha256Hex(body instanceof ArrayBuffer ? body : new TextEncoder().encode(body));

    // Canonical headers
    const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${bodyHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

    // Canonical request
    const canonicalRequest = [
        method,
        path,
        '', // query string (empty)
        canonicalHeaders,
        signedHeaders,
        bodyHash,
    ].join('\n');

    // String to sign
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        await sha256Hex(new TextEncoder().encode(canonicalRequest)),
    ].join('\n');

    // Signing key
    const signingKey = await getSigningKey(secretKey, dateStamp, region, service);

    // Signature
    const signature = await hmacHex(signingKey, stringToSign);

    // Authorization header
    const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
        headers: {
            'Authorization': authHeader,
            'Content-Type': contentType,
            'x-amz-date': amzDate,
            'x-amz-content-sha256': bodyHash,
            'Host': host,
        }
    };
}

async function sha256Hex(data) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data instanceof ArrayBuffer ? data : new TextEncoder().encode(data));
    return bufToHex(hashBuffer);
}

async function hmac(key, data) {
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key instanceof ArrayBuffer ? key : new TextEncoder().encode(key),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    return crypto.subtle.sign('HMAC', cryptoKey, typeof data === 'string' ? new TextEncoder().encode(data) : data);
}

async function hmacHex(key, data) {
    return bufToHex(await hmac(key, data));
}

async function getSigningKey(secretKey, dateStamp, region, service) {
    const kDate    = await hmac('AWS4' + secretKey, dateStamp);
    const kRegion  = await hmac(kDate, region);
    const kService = await hmac(kRegion, service);
    const kSigning = await hmac(kService, 'aws4_request');
    return kSigning;
}

function bufToHex(buffer) {
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
