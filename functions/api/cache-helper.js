export async function purgeAndWarmup(env, requestUrlOrigin, urlsToPurge) {
    if (!env.CLOUDFLARE_ZONE_ID || !env.CLOUDFLARE_API_TOKEN || !urlsToPurge || urlsToPurge.length === 0) {
        return;
    }
    
    try {
        // 1. Purge Cache
        await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/purge_cache`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ files: urlsToPurge })
        });
        
        // 2. Warm up Cache
        // We do not await this, so it runs asynchronously in the background.
        // It fetches the purged URLs so they are re-cached by Cloudflare immediately.
        urlsToPurge.forEach(url => {
            fetch(url).catch(() => {});
        });
    } catch (e) {
        console.error("Cache purge/warmup failed", e);
    }
}
