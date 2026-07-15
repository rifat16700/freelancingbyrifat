const fs = require('fs');

let prod = fs.readFileSync('product.html', 'utf8');
prod = prod.replace(/imo:\s*'data:image\/svg\+xml;utf8,<svg xmlns='http:\/\/www\.w3\.org\/2000\/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%2300a0dc'\/><text x='50' y='65' font-family='sans-serif' font-size='40' font-weight='bold' fill='%23fff' text-anchor='middle'>imo<\/text><\/svg>'/g, 
"imo: 'data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><rect width=\"100\" height=\"100\" rx=\"20\" fill=\"%2300a0dc\"/><text x=\"50\" y=\"65\" font-family=\"sans-serif\" font-size=\"40\" font-weight=\"bold\" fill=\"%23fff\" text-anchor=\"middle\">imo</text></svg>'");
fs.writeFileSync('product.html', prod, 'utf8');

let ts = fs.readFileSync('temp_settings.html', 'utf8');
ts = ts.replace(/icon:'data:image\/svg\+xml;utf8,<svg xmlns='http:\/\/www\.w3\.org\/2000\/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%2300a0dc'\/><text x='50' y='65' font-family='sans-serif' font-size='40' font-weight='bold' fill='%23fff' text-anchor='middle'>imo<\/text><\/svg>'/g, 
"icon: 'data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><rect width=\"100\" height=\"100\" rx=\"20\" fill=\"%2300a0dc\"/><text x=\"50\" y=\"65\" font-family=\"sans-serif\" font-size=\"40\" font-weight=\"bold\" fill=\"%23fff\" text-anchor=\"middle\">imo</text></svg>'");
fs.writeFileSync('temp_settings.html', ts, 'utf8');
