const fs = require('fs');
const path = require('path');
const dir = 'c:/Users/PC NET/Downloads/e-commarce/functions/api';

fs.readdirSync(dir).filter(f => f.endsWith('.js')).forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Bypass the auth checks
    content = content.replace(/if \(!authHeader \|\| authHeader !== `Bearer \$\{env\.ADMIN_SECRET_TOKEN \|\| 'default_admin_token'\}`\) \{/g, 'if (false) { // Auth check bypassed as requested by user');
    
    fs.writeFileSync(filePath, content);
});
console.log('Bypassed token auth checks.');
