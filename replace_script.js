const fs = require('fs');

let html = fs.readFileSync('checkout.html', 'utf8');

const chunk1 = fs.readFileSync('chunk1.txt', 'utf8').trimEnd();
const chunk2 = fs.readFileSync('chunk2.txt', 'utf8').trimEnd();
const chunk3 = fs.readFileSync('chunk3.txt', 'utf8').trimEnd();

if (html.includes(chunk1)) {
    html = html.replace(chunk1, "    var insertPromise = saveOrder(orderData);");
    console.log("Chunk 1 replaced!");
} else {
    console.log("Chunk 1 not found in HTML! (Length: " + chunk1.length + ")");
}

if (html.includes(chunk2)) {
    html = html.replace(chunk2, "    var insertPromise = Promise.resolve({ data: [{ id: orderId }], error: null });");
    console.log("Chunk 2 replaced!");
} else {
    console.log("Chunk 2 not found in HTML! (Length: " + chunk2.length + ")");
}

if (html.includes(chunk3)) {
    html = html.replace(chunk3, "    var insertOrderPromise = saveOrder(orderData);");
    console.log("Chunk 3 replaced!");
} else {
    console.log("Chunk 3 not found in HTML! (Length: " + chunk3.length + ")");
}

fs.writeFileSync('checkout.html', html, 'utf8');
console.log("Replacement finished!");
