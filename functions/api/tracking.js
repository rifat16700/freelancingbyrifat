export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const payload = await request.json();

        // 1. Fetch current tracking configuration from the deployed site
        const url = new URL(request.url);
        const configUrl = `${url.origin}/tracking-config.json`;
        
        let config = null;
        try {
            const configRes = await fetch(configUrl);
            if (configRes.ok) {
                config = await configRes.json();
            }
        } catch (e) {
            console.error("Failed to fetch tracking config:", e);
        }

        if (!config) {
            return new Response(JSON.stringify({ error: "Config not found" }), { status: 404 });
        }

        const clientIp = request.headers.get('CF-Connecting-IP') || '';
        const userAgent = request.headers.get('User-Agent') || '';
        
        const promises = [];

        // 2. Send to Meta CAPI if configured
        if (config.meta_pixel_id && env.META_API_TOKEN) {
            const metaPayload = {
                data: [
                    {
                        event_name: payload.event_name,
                        event_time: payload.event_time,
                        event_id: payload.event_id,
                        event_source_url: payload.event_source_url,
                        action_source: "website",
                        user_data: {
                            client_ip_address: clientIp,
                            client_user_agent: userAgent
                            // Add fbp, fbc from cookies if available in headers
                        },
                        custom_data: payload.custom_data || {}
                    }
                ]
            };

            const metaUrl = `https://graph.facebook.com/v18.0/${config.meta_pixel_id}/events?access_token=${env.META_API_TOKEN}`;
            promises.push(
                fetch(metaUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(metaPayload)
                }).catch(e => console.error("Meta CAPI Error:", e))
            );
        }

        // 3. Send to GA4 Measurement Protocol if configured
        if (config.ga4_id && env.GA4_API_SECRET) {
            // NOTE: GA4 Measurement Protocol requires an api_secret and a client_id
            // For a robust implementation, client_id should be extracted from the _ga cookie.
            const ga4Payload = {
                client_id: "server_" + payload.event_id, // Fallback client_id
                events: [{
                    name: payload.event_name,
                    params: {
                        ...payload.custom_data,
                        session_id: payload.event_id // Fallback session logic
                    }
                }]
            };

            const gaUrl = `https://www.google-analytics.com/mp/collect?measurement_id=${config.ga4_id}&api_secret=${env.GA4_API_SECRET}`;
            promises.push(
                fetch(gaUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(ga4Payload)
                }).catch(e => console.error("GA4 Error:", e))
            );
        }

        // We don't wait for promises to finish to keep the response extremely fast
        // Cloudflare Workers "waitUntil" keeps the execution alive after response
        context.waitUntil(Promise.allSettled(promises));

        // Return 200 OK immediately
        return new Response(JSON.stringify({ success: true, event_id: payload.event_id }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: "Server error", details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
