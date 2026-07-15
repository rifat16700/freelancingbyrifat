const fs = require('fs');
let html = fs.readFileSync('checkout.html', 'utf8');

// 1. Fix the top line
html = html.replace(/^\ufffd*<!DOCTYPE html>/i, '<!DOCTYPE html>');
html = html.replace(/^\ufffd<!DOCTYPE html>/i, '<!DOCTYPE html>');
html = html.replace(/^.*<!DOCTYPE/i, '<!DOCTYPE');

// 2. Fix the quantity multiplier (the /  1)
html = html.replace(/<span style="color:#888;font-size:11px;margin-right:2px;">[\s\ufffd]+<\/span>/g, '<span style="color:#888;font-size:11px;margin-right:2px;"><i data-lucide="x" class="lucide-icon" style="width:10px;height:10px;"></i></span>');

// 3. Fix the Delivery row
html = html.replace(/<span>Delivery<\/span><span id="smDelivery">[\s\ufffd]+<\/span>/g, '<span>Delivery</span><span id="smDelivery"></span>');
html = html.replace(/'\ufffd\s*'/g, "''");
html = html.replace(/'\s*\ufffd\s*'/g, "''");

// Also replace the remaining \ufffd in any remaining buttons just in case
html = html.replace(/[\s\ufffd]+Back<\/button>/g, '<i data-lucide="arrow-left" class="lucide-icon"></i> Back</button>');

fs.writeFileSync('checkout.html', html, 'utf8');
