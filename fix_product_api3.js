const fs = require('fs');

function fixAdd() {
    let add = fs.readFileSync('functions/api/add-product.js', 'utf8');
    
    // Fix INSERT INTO statement
    add = add.replace(/INSERT INTO products \([\s\S]*?\) VALUES \([\s\S]*?\)/, `INSERT INTO products (
                id, name, description, base_price, flash_sale_price,
                gallery_images, video_url, variants,
                is_active, is_featured, is_add_once, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`);
            
    // Fix params array
    add = add.replace(/const params = \[[\s\S]*?\];/, `const params = [
            p.id, p.name, p.description || '',
            p.base_price || 0, p.flash_sale_price || 0,
            typeof p.gallery_images === 'string' ? p.gallery_images : JSON.stringify(p.gallery_images || []),
            p.video_url || '',
            typeof p.variants === 'string' ? p.variants : JSON.stringify(p.variants || []),
            p.is_active ? 1 : 0, p.is_featured ? 1 : 0, p.is_add_once ? 1 : 0
        ];`);
        
    fs.writeFileSync('functions/api/add-product.js', add);
}

function fixUpd() {
    let upd = fs.readFileSync('functions/api/update-product.js', 'utf8');
    
    // Fix UPDATE SET statement
    upd = upd.replace(/SET[\s\S]*?WHERE/, `SET
                name=?, description=?, base_price=?, flash_sale_price=?,
                gallery_images=?, video_url=?, variants=?,
                is_active=?, is_featured=?, is_add_once=?
            WHERE`);
            
    // Fix params array
    upd = upd.replace(/const params = \[[\s\S]*?\];/, `const params = [
            p.name, p.description || '',
            p.base_price || 0, p.flash_sale_price || 0,
            typeof p.gallery_images === 'string' ? p.gallery_images : JSON.stringify(p.gallery_images || []),
            p.video_url || '',
            typeof p.variants === 'string' ? p.variants : JSON.stringify(p.variants || []),
            p.is_active ? 1 : 0, p.is_featured ? 1 : 0, p.is_add_once ? 1 : 0,
            p.id
        ];`);
        
    fs.writeFileSync('functions/api/update-product.js', upd);
}

fixAdd();
fixUpd();
