const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, searchRegex, replacement) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(searchRegex, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed ' + path.basename(filePath));
}

// 1. admin-query.js
let adminQueryPath = 'functions/api/admin-query.js';
let aqContent = fs.readFileSync(adminQueryPath, 'utf8');
aqContent = aqContent.replace(
    /if\s*\(sqlUpper\.includes\(\"PROMOS\"\).*?\{[\s\S]*?const filesToPurge = \[ origin \+ \"\/api\/checkout-data\" \];[\s\S]*?context\.waitUntil.*?\}[\s\S]*?\}/,
    `if (sqlUpper.includes("PROMOS") || sqlUpper.includes("ADDONS") || sqlUpper.includes("DELIVERY_ZONES") || sqlUpper.includes("SETTINGS") || sqlUpper.includes("HOME_SECTIONS") || sqlUpper.includes("BANNERS") || sqlUpper.includes("CATEGORIES")) {
                const origin = new URL(request.url).origin;
                const filesToPurge = [ origin + "/api/checkout-data", origin + "/api/public-data" ];
                context.waitUntil(purgeAndWarmup(env, origin, filesToPurge));
            }`
);
fs.writeFileSync(adminQueryPath, aqContent, 'utf8');
console.log('Fixed admin-query.js');

// 2. add-product.js
replaceInFile('functions/api/add-product.js', 
    /const filesToPurge = \[\s*origin \+ "\/api\/get-products-list"\s*\];[\s\S]*?if \(p\.is_add_once\) \{[\s\S]*?filesToPurge\.push\(origin \+ "\/api\/checkout-data"\);[\s\S]*?\}/,
    `const filesToPurge = [ origin + "/api/public-data", origin + "/api/checkout-data" ];`
);

// 3. update-product.js
replaceInFile('functions/api/update-product.js', 
    /const filesToPurge = \[\s*origin \+ "\/api\/get-products-list",\s*origin \+ "\/api\/get-single-product\?id=" \+ p\.id\s*\];[\s\S]*?if \(p\.is_add_once\) \{[\s\S]*?filesToPurge\.push\(origin \+ "\/api\/checkout-data"\);[\s\S]*?\}/,
    `const filesToPurge = [ origin + "/api/public-data", origin + "/api/checkout-data", origin + "/api/get-single-product?id=" + p.id ];`
);

// 4. delete-product.js
replaceInFile('functions/api/delete-product.js', 
    /const filesToPurge = \[\s*origin \+ "\/api\/get-products-list",\s*origin \+ "\/api\/get-single-product\?id=" \+ id\s*\];[\s\S]*?filesToPurge\.push\(origin \+ "\/api\/checkout-data"\);/,
    `const filesToPurge = [ origin + "/api/public-data", origin + "/api/checkout-data", origin + "/api/get-single-product?id=" + id ];`
);

// 5. update-settings.js
replaceInFile('functions/api/update-settings.js', 
    /const filesToPurge = \[\s*origin \+ "\/api\/get-settings",\s*origin \+ "\/api\/checkout-data"\s*\];/,
    `const filesToPurge = [ origin + "/api/public-data", origin + "/api/checkout-data", origin + "/api/get-settings" ];`
);
