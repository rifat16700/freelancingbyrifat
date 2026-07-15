const fs = require('fs');
let sql = fs.readFileSync('functions/api/product.sql/product.sql', 'utf8');

// 1. Remove public schema
sql = sql.replace(/"public"\."products"/g, '"products"');

// 2. Replace ARRAY['...'] with JSON array strings '["..."]'
sql = sql.replace(/ARRAY\[(.*?)\]/g, (match, inner) => {
    if (!inner.trim()) return "'[]'";
    
    let items = inner.split(',').map(s => {
        s = s.trim();
        if (s.startsWith("'") && s.endsWith("'")) {
            s = s.slice(1, -1);
        }
        return s;
    });
    
    let jsonStr = JSON.stringify(items);
    jsonStr = jsonStr.replace(/'/g, "''");
    
    return `'${jsonStr}'`;
});

// 3. Fix unquoted [{ ... }] variants
sql = sql.replace(/, \s*(\[\{.*?\}\])\s*,/g, (match, jsonInner) => {
    jsonInner = jsonInner.replace(/'/g, "''");
    return `, '${jsonInner}',`;
});

fs.writeFileSync('functions/api/product.sql/product_cf.sql', sql, 'utf8');
console.log("Fixed unquoted JSON arrays and escaped single quotes!");
