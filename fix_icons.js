const fs = require('fs');

const files = ['product.html', 'cart.html', 'admin/settings.html', 'temp_settings.html'];

const imoDataUri = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%2300a0dc"/><text x="50" y="65" font-family="sans-serif" font-size="40" font-weight="bold" fill="%23fff" text-anchor="middle">imo</text></svg>';
const skypeUri = 'https://api.iconify.design/logos:skype.svg';

files.forEach(file => {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        content = content.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/simple-icons@v13\/icons\/imo\.svg/g, imoDataUri);
        content = content.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/simple-icons@v13\/icons\/skype\.svg/g, skypeUri);
        fs.writeFileSync(file, content, 'utf8');
    }
});
