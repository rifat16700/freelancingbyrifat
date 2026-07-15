const fs = require('fs');

let html = fs.readFileSync('admin/dashboard.html', 'utf8');

// Replace the two separate cfDbBatchQuery calls with a single one.
const oldBlock1 = `
        } else if (CONFIG.DB_PROVIDER === 'cf_db') {
            cfDbBatchQuery([{ sql: "SELECT * FROM orders ORDER BY created_at DESC" }], false)
            .then(function(d) {
                var orders = (d.success && d.result && d.result[0].results) ? d.result[0].results : [];
`;

const oldBlock2 = `
        } else if (CONFIG.DB_PROVIDER === 'cf_db') {
            cfDbBatchQuery([{ sql: "SELECT COUNT(*) as cnt FROM products WHERE is_active = 1" }], false)
            .then(function(d) {
                var count = (d.success && d.result && d.result[0].results) ? d.result[0].results[0].cnt : 0;
                document.getElementById('statProducts').textContent = count;
            });
        }
`;

html = html.replace(oldBlock1, `
        } else if (CONFIG.DB_PROVIDER === 'cf_db') {
            cfDbBatchQuery([
                { sql: "SELECT * FROM orders ORDER BY created_at DESC" },
                { sql: "SELECT COUNT(*) as cnt FROM products WHERE is_active = 1" }
            ], true)
            .then(function(results) {
                var dOrders = results[0];
                var dCount = results[1];
                var orders = (dOrders.success && dOrders.result && dOrders.result[0].results) ? dOrders.result[0].results : [];
                var count = (dCount.success && dCount.result && dCount.result[0].results && dCount.result[0].results[0]) ? dCount.result[0].results[0].cnt : 0;
                document.getElementById('statProducts').textContent = count;
`);

html = html.replace(oldBlock2, `
        } else if (CONFIG.DB_PROVIDER === 'cf_db') {
            // Handled by the batch query above
        }
`);

fs.writeFileSync('admin/dashboard.html', html, 'utf8');
console.log('Dashboard patched.');
