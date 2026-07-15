const fs = require('fs');
let lines = fs.readFileSync('checkout.html', 'utf8').split('\n');

for(let i=0; i<lines.length; i++) {
    if(lines[i].includes('<div style="color:#888;">\' + (item.color||\'\') + \' / \' + (item.size||\'\') + \'')) {
        lines[i] = "                            '<div style=\"color:#888;\">' + (item.color||'') + ' / ' + (item.size||'') + ' x ' + (item.quantity||1) + '</div>' +";
    }
}

fs.writeFileSync('checkout.html', lines.join('\n'), 'utf8');
