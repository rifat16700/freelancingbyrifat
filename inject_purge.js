const fs = require('fs');
const files = [
    'c:/Users/PC NET/Downloads/e-commarce/functions/api/add-product.js',
    'c:/Users/PC NET/Downloads/e-commarce/functions/api/update-product.js',
    'c:/Users/PC NET/Downloads/e-commarce/functions/api/delete-product.js',
    'c:/Users/PC NET/Downloads/e-commarce/functions/api/update-settings.js'
];

const autoPurgeSnippet = `
        // Auto-purge Cloudflare Cache in background if credentials exist
        if (env.CLOUDFLARE_ZONE_ID && env.CLOUDFLARE_API_TOKEN) {
            context.waitUntil(
                fetch(\`https://api.cloudflare.com/client/v4/zones/\${env.CLOUDFLARE_ZONE_ID}/purge_cache\`, {
                    method: 'POST',
                    headers: { 'Authorization': \`Bearer \${env.CLOUDFLARE_API_TOKEN}\`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ purge_everything: true })
                }).catch(() => {})
            );
        }
`;

for (let f of files) {
    let content = fs.readFileSync(f, 'utf8');
    if (!content.includes('CLOUDFLARE_ZONE_ID')) {
        content = content.replace(
            /return new Response\(JSON\.stringify\(\{\s*success:\s*true/g,
            autoPurgeSnippet + '\n        return new Response(JSON.stringify({ success: true'
        );
        fs.writeFileSync(f, content);
        console.log('Updated', f);
    }
}
