const q = [
  'SELECT * FROM settings WHERE id = 1',
  'SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order',
  'SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order',
  'SELECT * FROM products WHERE is_active = 1',
  'SELECT * FROM home_sections WHERE is_active = 1 ORDER BY sort_order',
  'SELECT * FROM product_categories',
  'SELECT * FROM devtools WHERE id = "1"'
];

const run = async () => {
  for(let i=0; i<q.length; i++) {
    try {
      const r = await fetch('https://store.freelancingbyrifat.top/api/admin-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: q[i] })
      });
      const d = await r.json();
      if(d.success) console.log(q[i] + ' OK');
      else console.log(q[i] + ' ERROR: ' + d.error);
    } catch(e) {
      console.log(e);
    }
  }
};
run();
