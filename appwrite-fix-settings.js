const ENDPOINT   = 'https://sgp.cloud.appwrite.io/v1';
const PROJECT_ID = '69de4fa50032182e9b91';
const API_KEY    = 'ENTER_YOUR_API_KEY_HERE';  // ← এখানে API Key দাও
const DB_ID      = 'ecommerce_db';

// এই field গুলো Appwrite Dashboard থেকে আগে DELETE করো,
// তারপর এই script রান করো। তাহলে 1,000,000 size দিয়ে নতুন করে তৈরি হবে।
const fixes = [
    { collection: 'settings', id: 'messaging_apps',      type: 'string', size: 1000000 },
    { collection: 'settings', id: 'telegram_main_chats', type: 'string', size: 1000000 },
    { collection: 'settings', id: 'crypto_coins',        type: 'string', size: 1000000 },
];

async function req(method, path, body) {
    const url = `${ENDPOINT}${path}`;
    const headers = { 'X-Appwrite-Project': PROJECT_ID, 'X-Appwrite-Key': API_KEY, 'Content-Type': 'application/json' };
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
    if (!res.ok) {
        const e = await res.json();
        if (e.code === 409) return { exists: true };
        throw new Error(e.message || 'Unknown error');
    }
    return await res.json();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
    if (API_KEY === 'ENTER_YOUR_API_KEY_HERE') {
        console.error('ERROR: API Key দাও (line 4)!');
        return;
    }

    for (const f of fixes) {
        const path = `/databases/${DB_ID}/collections/${f.collection}/attributes/${f.type}`;
        const payload = { key: f.id, required: false, array: false, size: f.size };
        try {
            await req('POST', path, payload);
            console.log(`[+] Added: ${f.collection}.${f.id} (size: ${f.size})`);
        } catch(e) {
            if (e.exists) console.log(`[~] Already exists: ${f.id} — Dashboard থেকে Delete করো আগে!`);
            else console.log(`[!] Error on ${f.id}: ${e.message}`);
        }
        await sleep(800);
    }
    console.log('\n✅ Done!');
}

run();
