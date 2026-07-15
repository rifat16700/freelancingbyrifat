const fs = require('fs');
let sql = fs.readFileSync('functions/api/product.sql/product.sql', 'utf8');

// 1. Remove public schema
sql = sql.replace(/"public"\."products"/g, '"products"');

// 2. Replace ARRAY['...'] with JSON array strings '["..."]'
// We will use a regex replacer function to carefully parse and stringify the array
sql = sql.replace(/ARRAY\[(.*?)\]/g, (match, inner) => {
    if (!inner.trim()) return "'[]'";
    
    // inner is like: 'url1', 'url2'
    // split by comma, trim, remove outer single quotes
    let items = inner.split(',').map(s => {
        s = s.trim();
        if (s.startsWith("'") && s.endsWith("'")) {
            s = s.slice(1, -1);
        }
        return s;
    });
    
    // convert back to JSON string, then escape single quotes for SQL string
    let jsonStr = JSON.stringify(items);
    // Escape single quotes if any inside the JSON string (though unlikely in img URLs)
    jsonStr = jsonStr.replace(/'/g, "''");
    
    return `'${jsonStr}'`;
});

// 3. (Optional) true/false to 1/0, but D1 supports true/false. We can leave them.

// Save the converted SQL to a new file
fs.writeFileSync('functions/api/product.sql/product_cf.sql', sql, 'utf8');
console.log("Conversion complete! Output saved to product_cf.sql");
