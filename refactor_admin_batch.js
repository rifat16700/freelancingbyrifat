const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, 'admin');
const files = fs.readdirSync(adminDir).filter(f => f.endsWith('.html'));

function processFile(file) {
    const filePath = path.join(adminDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // 1. Handle Promise.all blocks
    // This regex looks for Promise.all([ fetch(...), fetch(...) ])
    const promiseAllRegex = /Promise\.all\(\[\s*(fetch\(\(CONFIG\.HF_API_BASE\|\|""\)\+"\/api\/d1-query"[\s\S]*?\.then\(.*?\),?\s*)+\]\)/g;
    
    content = content.replace(promiseAllRegex, (match) => {
        console.log(`Matched Promise.all in ${file}`);
        
        // Extract all SQL strings from the fetch bodies
        const sqlRegex = /sql:\s*("(?:[^"\\]|\\.)*")/g;
        let sqlMatches = [];
        let m;
        while ((m = sqlRegex.exec(match)) !== null) {
            sqlMatches.push(`{ sql: ${m[1]} }`);
        }
        
        if (sqlMatches.length > 0) {
            changed = true;
            return `cfDbBatchQuery([\n            ${sqlMatches.join(',\n            ')}\n        ], true)`;
        }
        return match;
    });

    // 2. Handle single fetch blocks on page load
    // These look like: fetch((CONFIG.HF_API_BASE||"")+"/api/d1-query", { ... body: JSON.stringify({ sql: "..." }) }).then(function(r){ return r.json(); })
    const singleFetchRegex = /fetch\(\(CONFIG\.HF_API_BASE\|\|""\)\+"\/api\/d1-query",\s*\{\s*method:\s*"POST",\s*headers:\s*\{[^}]*\},\s*body:\s*JSON\.stringify\(\{\s*sql:\s*("(?:[^"\\]|\\.)*")\s*\}\)\s*\}\)\s*\n*\s*\.then\([\s\S]*?return\s*r\.json\(\);\s*\}\)/g;
    
    content = content.replace(singleFetchRegex, (match, sqlString) => {
        console.log(`Matched single fetch in ${file}`);
        changed = true;
        return `cfDbBatchQuery([{ sql: ${sqlString} }], false)`;
    });

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${file}`);
    }
}

files.forEach(processFile);
