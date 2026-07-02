const fs = require('fs');
const files = [
    'c:/Users/PC NET/Downloads/e-commarce/functions/api/add-product.js',
    'c:/Users/PC NET/Downloads/e-commarce/functions/api/update-product.js',
    'c:/Users/PC NET/Downloads/e-commarce/functions/api/delete-product.js',
    'c:/Users/PC NET/Downloads/e-commarce/functions/api/update-settings.js'
];

const targetedPurgeSnippet = `
        // Auto-purge selective Cloudflare Cache
        if (env.CLOUDFLARE_ZONE_ID && env.CLOUDFLARE_API_TOKEN) {
            const origin = new URL(request.url).origin;
            const filesToPurge = [
                origin + "/",
                origin + "/index.html",
                origin + "/shop",
                origin + "/shop.html",
                origin + "/api/public-data",
                origin + "/api/get-products-list"
            ];
            
            const pid = typeof p !== 'undefined' && p && p.id ? p.id : (typeof id !== 'undefined' ? id : null);
            if (pid) {
                filesToPurge.push(origin + "/product?id=" + pid);
                filesToPurge.push(origin + "/product.html?id=" + pid);
                filesToPurge.push(origin + "/api/get-single-product?id=" + pid);
                filesToPurge.push(origin + "/api/public-reviews?product_id=" + pid);
            }

            context.waitUntil(
                fetch(\`https://api.cloudflare.com/client/v4/zones/\${env.CLOUDFLARE_ZONE_ID}/purge_cache\`, {
                    method: 'POST',
                    headers: { 'Authorization': \`Bearer \${env.CLOUDFLARE_API_TOKEN}\`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ files: filesToPurge })
                }).catch(() => {})
            );
        }
`;

for (let f of files) {
    let content = fs.readFileSync(f, 'utf8');
    
    // Replace the exact old block safely
    const oldBlockStart = "// Auto-purge Cloudflare Cache in background if credentials exist";
    if (content.includes(oldBlockStart)) {
        // Find the start index
        const startIndex = content.indexOf(oldBlockStart);
        // Find the next `return new Response` which indicates the end of our block
        const endIndex = content.indexOf('return new Response', startIndex);
        
        if (startIndex !== -1 && endIndex !== -1) {
            const newContent = content.substring(0, startIndex) + targetedPurgeSnippet + "\n        " + content.substring(endIndex);
            fs.writeFileSync(f, newContent);
            console.log('Updated to selective purge:', f);
        }
    }
}
