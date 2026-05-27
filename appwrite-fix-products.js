const ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';
const PROJECT_ID = '69de4fa50032182e9b91';
const API_KEY = 'standard_360879e9675a24ef2d8dbba7ff08c36a3157f50a8707e5fa11ad7ac393b7f6c608dbf5781f2741f4833323f676e5857d52063eacf19371591a48db65d65371bead6cf8ac6e16927a268aedabf2a02bd78cf8eb9f55d1cf9c2b4ed62f26b83e871075868759e97a4ee4e2199d353f5d870960e1d80ad0d65cfc04bd8c889094eb';
const DB_ID = 'ecommerce_db';
const COLL_ID = 'products';

const missingAttributes = [
    { id: 'video_url', type: 'string', size: 1000000 },
    { id: 'description', type: 'string', size: 1000000 },
    { id: 'variants', type: 'string', size: 1000000 },
    { id: 'gallery_images', type: 'string', size: 1000000 }
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

async function fixProducts() {
    if (API_KEY === 'ENTER_YOUR_API_KEY_HERE') {
        console.error('ERROR: Please enter your API_KEY on line 3!');
        return;
    }

    console.log(`\n> Fixing collection: ${COLL_ID}`);

    for (const attr of missingAttributes) {
        let path = `/databases/${DB_ID}/collections/${COLL_ID}/attributes/${attr.type}`;
        let payload = { key: attr.id, required: false, array: false };
        
        if (attr.type === 'string') payload.size = attr.size || 255;

        try {
            await req('POST', path, payload);
            console.log(`    [+] Added attribute: ${attr.id} (${attr.type}) with size ${attr.size}`);
        } catch(e) {
            if (e.exists) console.log(`    [~] Attribute ${attr.id} exists`);
            else console.log(`    [!] Error on ${attr.id}: ${e.message}`);
        }
        await sleep(1000); 
    }
    
    console.log('\n✅ DONE! Please check Appwrite dashboard.');
}

fixProducts();
