const fs = require('fs');

let addContent = fs.readFileSync('functions/api/add-product.js', 'utf8');
addContent = addContent.replace('id, name, description, category_id, base_price, flash_sale_price,', 'id, name, description, base_price, flash_sale_price,');
addContent = addContent.replace(') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)');
addContent = addContent.replace("p.id, p.name, p.description || '', p.category_id || '',", "p.id, p.name, p.description || '',");
fs.writeFileSync('functions/api/add-product.js', addContent);

let updContent = fs.readFileSync('functions/api/update-product.js', 'utf8');
updContent = updContent.replace('name=?, description=?, category_id=?, base_price=?, flash_sale_price=?,', 'name=?, description=?, base_price=?, flash_sale_price=?,');
updContent = updContent.replace("p.name, p.description || '', p.category_id || '',", "p.name, p.description || '',");
fs.writeFileSync('functions/api/update-product.js', updContent);
