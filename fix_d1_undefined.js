const fs = require('fs');
const path = require('path');
const dir = 'c:/Users/PC NET/Downloads/e-commarce/functions/api';
fs.readdirSync(dir).filter(f => f.endsWith('.js')).forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/\.bind\(\.\.\.params\)/g, '.bind(...params.map(v => v === undefined ? null : v))');
    content = content.replace(/\.bind\(\.\.\.queryArgs\)/g, '.bind(...queryArgs.map(v => v === undefined ? null : v))');
    fs.writeFileSync(filePath, content);
});
console.log('Fixed undefined D1 bindings.');
