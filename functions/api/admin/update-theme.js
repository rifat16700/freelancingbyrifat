// functions/api/admin/update-theme.js

import { verifyAdminRequest, CORS } from '../_auth-helper.js';

export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS });

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const adminUser = await verifyAdminRequest(request, env, body);
        if (!adminUser) {
            return new Response(JSON.stringify({ error: "Unauthorized: Valid Admin session token required." }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
        }
        const cssPayload = body.css_payload;
        const layoutPayload = body.layout_payload || "window.THEME_LAYOUT = { hero: (typeof CONFIG !== 'undefined' && CONFIG.TEMPLATE_VERSION) ? CONFIG.TEMPLATE_VERSION : 'v1' };";

        if (!cssPayload) {
            return new Response(JSON.stringify({ error: "Missing css_payload in request." }), { status: 400, headers: CORS });
        }

        // GitHub Configuration
        const githubToken = env.GITHUB_TOKEN;
        const owner = env.GITHUB_OWNER;
        const repo = env.GITHUB_REPO;

        if (!githubToken || !owner || !repo) {
            return new Response(JSON.stringify({ error: "Missing GitHub configuration in environment variables." }), { status: 500, headers: CORS });
        }

        // Trigger GitHub Action Workflow
        const workflowUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/update-theme.yml/dispatches`;

        const githubResponse = await fetch(workflowUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `Bearer ${githubToken}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Cloudflare-Pages-Worker'
            },
            body: JSON.stringify({
                ref: 'main',
                inputs: {
                    css_payload: cssPayload
                }
            })
        });

        if (!githubResponse.ok) {
            const errBody = await githubResponse.text();
            console.error("GitHub API Error:", errBody);
            return new Response(JSON.stringify({ error: "Failed to trigger GitHub Action.", details: errBody }), { status: 500, headers: CORS });
        }

        return new Response(JSON.stringify({ success: true, message: "Theme rebuild triggered on GitHub successfully!" }), {
            status: 200,
            headers: CORS
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
    }
}
