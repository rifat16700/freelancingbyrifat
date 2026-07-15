const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\PC NET\\Downloads\\e-commarce\\admin';

const mappings = {
    '💾': '💾',
    '🎁': '🎁',
    '🎉': '🎉'
};

function fixFile(filePath) {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        let originalContent = content;
        
        // Fix Mojibake
        for (const [bad, good] of Object.entries(mappings)) {
            content = content.split(bad).join(good);
        }
        
        // Add lucide.createIcons() after innerHTML injection in specific modal functions
        
        // In orders.html
        content = content.replace("document.getElementById('orderModalContent').innerHTML = content;\n        document.getElementById('orderModal').classList.add('show');", "document.getElementById('orderModalContent').innerHTML = content;\n        if (typeof lucide !== 'undefined') lucide.createIcons();\n        document.getElementById('orderModal').classList.add('show');");
        content = content.replace("tbody.innerHTML = html;\n    }", "tbody.innerHTML = html;\n        if (typeof lucide !== 'undefined') lucide.createIcons();\n    }");
        
        // In products.html
        content = content.replace("document.getElementById('productForm').innerHTML = content;\n        document.getElementById('productModal').classList.add('show');", "document.getElementById('productForm').innerHTML = content;\n        if (typeof lucide !== 'undefined') lucide.createIcons();\n        document.getElementById('productModal').classList.add('show');");
        content = content.replace("grid.innerHTML = html;\n    }", "grid.innerHTML = html;\n        if (typeof lucide !== 'undefined') lucide.createIcons();\n    }");
        content = content.replace("tmp.innerHTML = html;", "tmp.innerHTML = html;\n                    if (typeof lucide !== 'undefined') lucide.createIcons();");
        
        // In promos.html
        content = content.replace("document.getElementById('promoBody').innerHTML = html;", "document.getElementById('promoBody').innerHTML = html;\n        if (typeof lucide !== 'undefined') lucide.createIcons();");
        
        // In reviews.html
        content = content.replace("list.innerHTML = html;", "list.innerHTML = html;\n        if (typeof lucide !== 'undefined') lucide.createIcons();");

        // In settings.html
        content = content.replace("coinDiv.innerHTML = headerHtml;\n            coinDiv.appendChild(netsWrap);", "coinDiv.innerHTML = headerHtml;\n            if (typeof lucide !== 'undefined') lucide.createIcons();\n            coinDiv.appendChild(netsWrap);");
        
        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log('Fixed', filePath);
        }
    }
}

const htmlFiles = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
for (const file of htmlFiles) {
    fixFile(path.join(dir, file));
}
