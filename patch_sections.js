const fs = require('fs');

let html = fs.readFileSync('admin/sections.html', 'utf8');

const oldBlock = `
    } else if (CONFIG.DB_PROVIDER === 'cf_db') {
        p1 = cfDbBatchQuery([{ sql: "SELECT s.*, c.name as category_name FROM home_sections s LEFT JOIN categories c ON s.category_id = c.id ORDER BY s.sort_order" }], false)
            .then(function(d) {
                var data = (d.success && d.result && d.result[0].results) ? d.result[0].results : [];
                return { data: data.map(function(s) {
                    s.is_active = s.is_active === 1;
                    if (s.product_ids && typeof s.product_ids === 'string') try { s.product_ids = JSON.parse(s.product_ids); } catch(e){}
                    if (s.category_name) s.categories = { name: s.category_name };
                    return s;
                }) };
            });
        p2 = cfDbBatchQuery([{ sql: "SELECT id, name FROM categories WHERE is_active = 1 ORDER BY sort_order" }], false)
            .then(function(d) { return { data: (d.success && d.result && d.result[0].results) ? d.result[0].results : [] }; });
    }
`;

html = html.replace(oldBlock, `
    } else if (CONFIG.DB_PROVIDER === 'cf_db') {
        var batchPromise = cfDbBatchQuery([
            { sql: "SELECT s.*, c.name as category_name FROM home_sections s LEFT JOIN categories c ON s.category_id = c.id ORDER BY s.sort_order" },
            { sql: "SELECT id, name FROM categories WHERE is_active = 1 ORDER BY sort_order" }
        ], true);
        
        p1 = batchPromise.then(function(results) {
            var d = results[0];
            var data = (d.success && d.result && d.result[0].results) ? d.result[0].results : [];
            return { data: data.map(function(s) {
                s.is_active = s.is_active === 1;
                if (s.product_ids && typeof s.product_ids === 'string') try { s.product_ids = JSON.parse(s.product_ids); } catch(e){}
                if (s.category_name) s.categories = { name: s.category_name };
                return s;
            }) };
        });
        
        p2 = batchPromise.then(function(results) {
            var d = results[1];
            return { data: (d.success && d.result && d.result[0].results) ? d.result[0].results : [] };
        });
    }
`);

fs.writeFileSync('admin/sections.html', html, 'utf8');
console.log('Sections patched.');
