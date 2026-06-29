const fs = require('fs');

let content = fs.readFileSync('checkout.html', 'utf8');

// Add lucide.createIcons() inside the Promise.all().then()
if (!content.includes("lucide.createIcons(); // dynamic render")) {
    content = content.replace(/loadBdDivisions\(\);/, "loadBdDivisions();\n        setTimeout(() => { if(typeof lucide !== 'undefined') lucide.createIcons(); }, 100); // dynamic render");
}

fs.writeFileSync('checkout.html', content, 'utf8');
