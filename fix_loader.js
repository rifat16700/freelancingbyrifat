const fs = require('fs');
const path = require('path');
const dir = 'c:/Users/PC NET/Downloads/e-commarce/admin';
fs.readdirSync(dir).filter(f => f.endsWith('.html')).forEach(f => {
    const fp = path.join(dir, f);
    let html = fs.readFileSync(fp, 'utf8');
    if (html.includes('showToast(\'Load failed: \' + err.message, \'error\');') && !html.includes('showUI();')) {
        html = html.replace(/showToast\('Load failed: ' \+ err.message, 'error'\);/g, `var l = document.getElementById('pageLoader'), m = document.getElementById('adminMain');
                if(l) l.style.display='none';
                if(m) m.style.display='flex';
                showToast('Load failed: ' + err.message, 'error');`);
        fs.writeFileSync(fp, html);
        console.log('Fixed ' + f);
    }
});
