export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        // Authenticate admin request if needed here (e.g. check session cookie)
        // For now, we proceed assuming authorization is handled elsewhere or is simple

        const payload = await request.json();

        // Environment variables needed:
        // GITHUB_TOKEN - A Personal Access Token with repo access
        // GITHUB_OWNER - The owner of the repository (e.g. your username)
        // GITHUB_REPO - The name of the repository
        
        const githubToken = env.GITHUB_TOKEN;
        const owner = env.GITHUB_OWNER;
        const repo = env.GITHUB_REPO;

        if (!githubToken || !owner || !repo) {
            return new Response(JSON.stringify({ error: "Missing GitHub configuration in environment variables." }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Trigger GitHub Action Workflow
        const workflowUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/update-tracking.yml/dispatches`;
        
        const githubResponse = await fetch(workflowUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `Bearer ${githubToken}`,
                'User-Agent': 'Cloudflare-Pages-Function'
            },
            body: JSON.stringify({
                ref: 'main', // or whatever your default branch is
                inputs: {
                    config_payload: JSON.stringify(payload)
                }
            })
        });

        if (!githubResponse.ok) {
            const errBody = await githubResponse.text();
            console.error("GitHub API Error:", errBody);
            return new Response(JSON.stringify({ error: "Failed to trigger GitHub Action.", details: errBody }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ success: true, message: "GitHub Action triggered successfully." }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: "Server error processing request.", details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
