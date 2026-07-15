const fs = require('fs');

async function getSchema() {
    const res = await fetch('https://store.freelancingbyrifat.top/api/admin-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: "PRAGMA table_info(settings);" })
    });
    const text = await res.text();
    console.log(text);
}

getSchema();
