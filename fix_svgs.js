const fs = require('fs');

const files = ['admin/settings.html', 'cart.html', 'temp_settings.html', 'product.html', 'checkout.html'];

files.forEach(f => {
    if(fs.existsSync(f)) {
        let c = fs.readFileSync(f, 'utf8');
        let orig = c;
        // Fix imo SVG string literal single quotes inside single quotes
        c = c.replace(/xmlns='http:\/\/www\.w3\.org\/2000\/svg'/g, 'xmlns="http://www.w3.org/2000/svg"');
        c = c.replace(/viewBox='0 0 100 100'/g, 'viewBox="0 0 100 100"');
        c = c.replace(/width='100'/g, 'width="100"');
        c = c.replace(/height='100'/g, 'height="100"');
        c = c.replace(/rx='20'/g, 'rx="20"');
        c = c.replace(/fill='%2300a0dc'/g, 'fill="%2300a0dc"');
        c = c.replace(/x='50'/g, 'x="50"');
        c = c.replace(/y='65'/g, 'y="65"');
        c = c.replace(/font-family='sans-serif'/g, 'font-family="sans-serif"');
        c = c.replace(/font-size='40'/g, 'font-size="40"');
        c = c.replace(/font-weight='bold'/g, 'font-weight="bold"');
        c = c.replace(/fill='%23fff'/g, 'fill="%23fff"');
        c = c.replace(/text-anchor='middle'/g, 'text-anchor="middle"');
        
        if (c !== orig) {
            fs.writeFileSync(f, c);
            console.log('Fixed SVG in', f);
        }
    }
});
