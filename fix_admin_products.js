const fs = require('fs');
let html = fs.readFileSync('admin/products.html', 'utf8');

// Replace mojibake UI elements
html = html.replace(/<title>Products â€” Admin Panel<\/title>/g, '<title>Products — Admin Panel</title>');
html = html.replace(/<button class="hamburger-btn" onclick="openSidebar\(\)">â˜°<\/button>/g, '<button class="hamburger-btn" onclick="openSidebar()">☰</button>');
html = html.replace(/<button class="modal-close" onclick="closeModal\('productModal'\)">âœ•<\/button>/g, '<button class="modal-close" onclick="closeModal(\'productModal\')">✖</button>');
html = html.replace(/<div class="form-hint">à¦¯à§‡à¦•à§‹à¦¨à§‹ à¦\xadà¦¿à¦¡à¦¿à¦“ à¦²à¦¿à¦™à§\x8dà¦• à¦¦à¦¾à¦“ â€” Auto-detect à¦•à¦°à¦¬à§‡à¥¤ à¦¨à¦¾ à¦¹à¦²à§‡ à¦¨à¦¿à¦š à¦¥à§‡à¦•à§‡ Platform à¦¸à¦¿à¦²à§‡à¦•à§\x8dà¦Ÿ à¦•à¦°à§‹à¥¤<\/div>/g, '<div class="form-hint">যেকোনো ভিডিও লিঙ্ক দাও — Auto-detect করবে। না হলে নিচ থেকে Platform সিলেক্ট করো।</div>');
html = html.replace(/<option value="youtube">â–▶ï¸ YouTube<\/option>/g, '<option value="youtube">▶️ YouTube</option>');
html = html.replace(/â—   Active/g, '●  Active');
html = html.replace(/â—  Inactive/g, '●  Inactive');
html = html.replace(/âœ•/g, '✖');
html = html.replace(/â”€â”€/g, '──');
html = html.replace(/â–▶ï¸/g, '▶️');
html = html.replace(/â§³/g, '৳');
html = html.replace(/âœ-/g, '✖'); // Minus or cross
html = html.replace(/ðŸ’¾/g, '💾');
html = html.replace(/âœ\*/g, '✖');

// In case the button in product modal says "ðŸ’¾ Save Product" or "âœ-", let's be more specific with the replacements if any missed.
// Taka symbol in JS logic
html = html.replace(/EXTRA PRICE â§³/g, 'EXTRA PRICE ৳');
html = html.replace(/Extra â§³/g, 'Extra ৳');

fs.writeFileSync('admin/products.html', html);
