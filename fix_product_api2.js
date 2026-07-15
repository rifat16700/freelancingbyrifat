const fs = require('fs');

let addContent = fs.readFileSync('functions/api/add-product.js', 'utf8');
addContent = addContent.replace(
    'stock_status, gallery_images, video_url, variants,\n                is_active, is_featured, is_add_once, created_at, updated_at',
    'gallery_images, video_url, variants,\n                is_active, is_featured, is_add_once, created_at'
);
addContent = addContent.replace(
    ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
    ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
);
addContent = addContent.replace(
    "p.base_price || 0, p.flash_sale_price || 0, p.stock_status || 'In Stock',",
    "p.base_price || 0, p.flash_sale_price || 0,"
);
fs.writeFileSync('functions/api/add-product.js', addContent);

let updContent = fs.readFileSync('functions/api/update-product.js', 'utf8');
updContent = updContent.replace(
    'stock_status=?, gallery_images=?, video_url=?, variants=?,\n                is_active=?, is_featured=?, is_add_once=?, updated_at=CURRENT_TIMESTAMP',
    'gallery_images=?, video_url=?, variants=?,\n                is_active=?, is_featured=?, is_add_once=?'
);
updContent = updContent.replace(
    "p.base_price || 0, p.flash_sale_price || 0, p.stock_status || 'In Stock',",
    "p.base_price || 0, p.flash_sale_price || 0,"
);
fs.writeFileSync('functions/api/update-product.js', updContent);
