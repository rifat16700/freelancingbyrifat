// ============================================================
// functions/api/master-db.js
// Cloudflare Pages Function — Universal DB Adapter
// Routes all queries to either Supabase or Appwrite
// based on the DB_PROVIDER environment variable.
// ============================================================

import { getConfig } from '../utils/config.js';

// ── JSON fields that are stored as strings in Appwrite ───────
// These are JSONB columns in Supabase → stored as JSON strings in Appwrite
const JSON_FIELDS = [
    'variants', 'gallery_images', 'items', 'addons',
    'messaging_apps', 'product_ids', 'category_ids',
    'districts', 'delivery_zones', 'telegram_main_chats',
    'crypto_coins'
];

// ── Serialize JS object → JSON string for Appwrite inserts ───
function serializeJsonFields(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const out = { ...payload };
    for (const key of JSON_FIELDS) {
        if (key in out && typeof out[key] !== 'string') {
            out[key] = JSON.stringify(out[key]);
        }
    }
    return out;
}

// ── Parse JSON strings back to objects after reading ─────────
function deserializeJsonFields(row) {
    if (!row || typeof row !== 'object') return row;
    const out = { ...row };
    for (const key of JSON_FIELDS) {
        if (key in out && typeof out[key] === 'string') {
            const trimmed = out[key].trim();
            if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                try { out[key] = JSON.parse(out[key]); } catch (_) {}
            }
        }
    }
    return out;
}

// ── HMAC token verify (mirrors admin-auth.js logic) ─────────
async function verifyAdminToken(token, signingKey) {
    if (!token || !signingKey) return false;
    try {
        const [b64, sig] = token.split('.');
        if (!b64 || !sig) return false;
        const payload  = atob(b64);
        const data     = JSON.parse(payload);
        if (Date.now() > data.exp) return false;

        const enc      = new TextEncoder();
        const key      = await crypto.subtle.importKey(
            'raw', enc.encode(signingKey),
            { name: 'HMAC', hash: 'SHA-256' },
            false, ['sign']
        );
        const raw      = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
        const expected = btoa(String.fromCharCode(...new Uint8Array(raw)));
        return sig === expected;
    } catch { return false; }
}

export async function onRequestPost(context) {
    const config = getConfig(context.env);

    const corsHeaders = {
        'Content-Type':                'application/json',
        'Access-Control-Allow-Origin': '*',
    };

    try {
        const req = await context.request.json();
        const { table, action } = req;

        if (!table || !action) {
            return new Response(
                JSON.stringify({ error: 'Missing table or action' }),
                { status: 400, headers: corsHeaders }
            );
        }

        // ── Verify HMAC admin token ──────────────────────────
        const adminToken = req.adminToken || '';
        const SIGNING_KEY = config.DB_PROVIDER === 'appwrite'
            ? config.APPWRITE_API_KEY
            : config.SUPABASE_ANON_KEY;
        const isAdmin = adminToken ? await verifyAdminToken(adminToken, SIGNING_KEY) : false;

        // Non-admin write attempts → block
        const WRITE_ACTIONS = ['insert', 'update', 'upsert', 'delete'];
        if (WRITE_ACTIONS.includes(action) && !isAdmin) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized. Admin login required.' }),
                { status: 401, headers: corsHeaders }
            );
        }

        if (config.DB_PROVIDER === 'appwrite') {
            // Appwrite: pass isAdmin flag — uses API key for DB ops
            return await handleAppwrite(config, req, corsHeaders, isAdmin);
        } else {
            // Supabase: pass the actual user JWT for proper RLS
            return await handleSupabase(config, req, corsHeaders, isAdmin, adminToken);
        }

    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'MasterDB request failed', details: String(error) }),
            { status: 500, headers: corsHeaders }
        );
    }
}

// ─────────────────────────────────────────────────────────────
// SUPABASE HANDLER
// ─────────────────────────────────────────────────────────────
async function handleSupabase(config, req, corsHeaders, isAdmin = false, userJwt = '') {
    const {
        table, action,
        selectCols, filters, orderObj, limitNum,
        isSingle, payloadData, headFlag, countType, rangeArr,
    } = req;

    // ── Key selection logic ────────────────────────────────
    // Admin + SERVICE_ROLE exists  → use service_role (full RLS bypass)
    // Admin + no SERVICE_ROLE      → use user JWT (proper authenticated RLS)
    // Public                       → use anon key (read-only public access)
    let authKey;
    if (isAdmin && config.SUPABASE_SERVICE_ROLE_KEY) {
        authKey = config.SUPABASE_SERVICE_ROLE_KEY;
    } else if (isAdmin && userJwt) {
        authKey = userJwt;   // user JWT → RLS sees authenticated user
    } else {
        authKey = config.SUPABASE_ANON_KEY;
    }

    let url = `${config.SUPABASE_URL}/rest/v1/${table}`;
    const params = new URLSearchParams();

    // SELECT columns
    if (selectCols && action === 'select') {
        params.append('select', selectCols);
    }

    // FILTERS  — supports: eq, neq, lt, lte, gt, gte, like, in
    if (filters && filters.length > 0) {
        filters.forEach(f => {
            const col = f.args[0];
            const val = f.args[1];
            if (f.method === 'in') {
                // PostgREST in filter: ?col=in.(a,b,c)
                const list = Array.isArray(val) ? val.join(',') : val;
                params.append(col, `in.(${list})`);
            } else {
                params.append(col, `${f.method}.${val}`);
            }
        });
    }

    // ORDER
    if (orderObj) {
        params.append('order', `${orderObj.col}.${orderObj.ascending ? 'asc' : 'desc'}`);
    }

    // LIMIT
    if (limitNum) {
        params.append('limit', limitNum);
    }

    const qs = params.toString();
    if (qs) url += `?${qs}`;

    const headers = {
        'apikey':        authKey,
        'Authorization': `Bearer ${authKey}`,
        'Content-Type':  'application/json',
    };

    let method = 'GET';
    let body   = null;
    const prefer = [];

    if (countType)           prefer.push(`count=${countType}`);
    if (isSingle && action === 'select') headers['Accept'] = 'application/vnd.pgrst.object+json';

    if (action === 'insert') {
        method = 'POST';
        body   = JSON.stringify(Array.isArray(payloadData) ? payloadData : [payloadData]);
        prefer.push('return=representation');
    } else if (action === 'update') {
        method = 'PATCH';
        body   = JSON.stringify(payloadData);
        prefer.push('return=representation');
    } else if (action === 'upsert') {
        method = 'POST';
        body   = JSON.stringify(Array.isArray(payloadData) ? payloadData : [payloadData]);
        prefer.push('resolution=merge-duplicates', 'return=representation');
    } else if (action === 'delete') {
        method = 'DELETE';
        prefer.push('return=representation');
    } else if (headFlag) {
        method = 'HEAD';
    }

    if (prefer.length > 0) headers['Prefer'] = prefer.join(',');

    // RANGE (pagination)
    if (rangeArr) {
        headers['Range-Unit'] = 'items';
        headers['Range']      = `${rangeArr[0]}-${rangeArr[1]}`;
    }

    const response = await fetch(url, { method, headers, body });

    let data  = null;
    let error = null;
    let count = null;

    if (!response.ok) {
        error = await response.json().catch(() => ({ message: response.statusText }));
    } else {
        if (method !== 'HEAD' && response.status !== 204) {
            data = await response.json().catch(() => null);
        }
        const contentRange = response.headers.get('content-range');
        if (contentRange) {
            const parts = contentRange.split('/');
            count = parts[1] && parts[1] !== '*' ? parseInt(parts[1], 10) : null;
        }
    }

    return new Response(JSON.stringify({ data, error, count }), {
        status:  200,
        headers: corsHeaders,
    });
}

// ── Map Supabase field names → Appwrite attribute names ─────
function mapFieldName(col) {
    const MAP = {
        'id':         '$id',
        'created_at': '$createdAt',
        'updated_at': '$updatedAt',
    };
    return MAP[col] || col;
}

// ── Appwrite query builder (JSON format for v1.9.5+) ────────
const Q = {
    equal:              (attr, val)  => JSON.stringify({ method: 'equal',              attribute: attr, values: Array.isArray(val) ? val : [val] }),
    notEqual:           (attr, val)  => JSON.stringify({ method: 'notEqual',           attribute: attr, values: Array.isArray(val) ? val : [val] }),
    lessThan:           (attr, val)  => JSON.stringify({ method: 'lessThan',           attribute: attr, values: [val] }),
    lessThanEqual:      (attr, val)  => JSON.stringify({ method: 'lessThanEqual',      attribute: attr, values: [val] }),
    greaterThan:        (attr, val)  => JSON.stringify({ method: 'greaterThan',        attribute: attr, values: [val] }),
    greaterThanEqual:   (attr, val)  => JSON.stringify({ method: 'greaterThanEqual',   attribute: attr, values: [val] }),
    search:             (attr, val)  => JSON.stringify({ method: 'search',             attribute: attr, values: [val] }),
    orderAsc:           (attr)       => JSON.stringify({ method: 'orderAsc',           attribute: attr }),
    orderDesc:          (attr)       => JSON.stringify({ method: 'orderDesc',          attribute: attr }),
    limit:              (n)          => JSON.stringify({ method: 'limit',              values: [n] }),
    offset:             (n)          => JSON.stringify({ method: 'offset',             values: [n] }),
    select:             (cols)       => JSON.stringify({ method: 'select',             values: cols }),
};

// ─────────────────────────────────────────────────────────────
// APPWRITE HANDLER
// ─────────────────────────────────────────────────────────────
// Helper: strip unknown attributes and retry insert
// Appwrite rejects fields not in the collection schema.
// This function removes offending fields one by one and retries.
// ─────────────────────────────────────────────────────────────
async function stripAndRetryInsert(baseUrl, headers, data) {
    let payload = { ...data };
    let attempts = 0;
    while (attempts < 20) {
        const body = JSON.stringify({ documentId: crypto.randomUUID(), data: payload });
        const res  = await fetch(baseUrl, { method: 'POST', headers, body });
        if (res.ok) return mapDoc(await res.json());
        const err = await res.json();
        const msg = err.message || '';
        // Extract the unknown attribute name from error message
        const match = msg.match(/Unknown attribute[:\s"]+([a-zA-Z0-9_$]+)/i);
        if (match && match[1]) {
            delete payload[match[1]]; // remove the offending field
            attempts++;
        } else {
            throw err; // different error — rethrow
        }
    }
    throw new Error('Too many unknown attributes — check Appwrite collection schema');
}

// ─────────────────────────────────────────────────────────────
// APPWRITE HANDLER
// ─────────────────────────────────────────────────────────────
async function handleAppwrite(config, req, corsHeaders) {
    const {
        table, action,
        selectCols, filters, orderObj, limitNum,
        isSingle, payloadData, headFlag, rangeArr,
    } = req;

    const dbId     = config.APPWRITE_DATABASE_ID;
    const collKey  = `APPWRITE_COLLECTION_${table.toUpperCase()}`;
    const collId   = config[collKey] || table;
    const baseUrl  = `${config.APPWRITE_ENDPOINT}/databases/${dbId}/collections/${collId}/documents`;

    const headers = {
        'X-Appwrite-Project': config.APPWRITE_PROJECT,
        'X-Appwrite-Key':     config.APPWRITE_API_KEY,
        'Content-Type':       'application/json',
    };

    let data  = null;
    let error = null;
    let count = null;

    try {

        // ── SELECT ──────────────────────────────────────────────
        if (action === 'select' || headFlag) {
            const params = new URLSearchParams();

            // Filters
            if (filters && filters.length > 0) {
                filters.forEach(f => {
                    const col = mapFieldName(f.args[0]);
                    const val = f.args[1];

                    switch (f.method) {
                        case 'eq':   params.append('queries[]', Q.equal(col, val));            break;
                        case 'neq':  params.append('queries[]', Q.notEqual(col, val));         break;
                        case 'lt':   params.append('queries[]', Q.lessThan(col, val));         break;
                        case 'lte':  params.append('queries[]', Q.lessThanEqual(col, val));    break;
                        case 'gt':   params.append('queries[]', Q.greaterThan(col, val));      break;
                        case 'gte':  params.append('queries[]', Q.greaterThanEqual(col, val)); break;
                        case 'like': params.append('queries[]', Q.search(col, val));           break;
                        case 'in':   params.append('queries[]', Q.equal(col, Array.isArray(val) ? val : [val])); break;
                    }
                });
            }

            // Order — map field names to Appwrite system attrs
            if (orderObj) {
                const col = mapFieldName(orderObj.col);
                const q   = orderObj.ascending ? Q.orderAsc(col) : Q.orderDesc(col);
                params.append('queries[]', q);
            }

            // Limit / Range
            if (rangeArr) {
                params.append('queries[]', Q.limit(rangeArr[1] - rangeArr[0] + 1));
                params.append('queries[]', Q.offset(rangeArr[0]));
            } else if (limitNum) {
                params.append('queries[]', Q.limit(limitNum));
            }

            // Select specific columns
            if (selectCols && selectCols !== '*') {
                const cols = selectCols.split(',').map(c => c.trim()).filter(Boolean);
                params.append('queries[]', Q.select(cols));
            }

            const fetchUrl = params.toString() ? `${baseUrl}?${params}` : baseUrl;
            const res      = await fetch(fetchUrl, { method: 'GET', headers });

            if (!res.ok) throw await res.json();

            const json = await res.json();
            count = json.total;
            data  = json.documents.map(mapDoc);

            if (isSingle) data = data.length > 0 ? data[0] : null;


        // ── INSERT ──────────────────────────────────────
        } else if (action === 'insert') {
            const rows    = Array.isArray(payloadData) ? payloadData : [payloadData];
            const results = [];

            for (const row of rows) {
                const serialized = serializeJsonFields(row);
                // Remove id/$id from data — Appwrite manages $id separately
                delete serialized.id;
                delete serialized['$id'];
                const body = JSON.stringify({ documentId: crypto.randomUUID(), data: serialized });
                const res  = await fetch(baseUrl, { method: 'POST', headers, body });
                if (!res.ok) {
                    const errJson = await res.json();
                    // If unknown attribute error, strip offending field and retry
                    if (res.status === 422 || (errJson.message && errJson.message.includes('Unknown attribute'))) {
                        const clean = await stripAndRetryInsert(baseUrl, headers, serialized);
                        results.push(clean);
                    } else {
                        throw errJson;
                    }
                } else {
                    results.push(mapDoc(await res.json()));
                }
            }

            data = Array.isArray(payloadData) ? results : results[0];


        // ── UPSERT ──────────────────────────────────────────────
        // Appwrite has no native upsert; we try UPDATE then INSERT
        } else if (action === 'upsert') {
            const rows    = Array.isArray(payloadData) ? payloadData : [payloadData];
            const results = [];

            for (const row of rows) {
                const serialized = serializeJsonFields(row);
                // Remove id/$id from the data payload (Appwrite rejects numeric IDs as field values)
                const docIdRaw = row.id || row['$id'] || null;
                delete serialized.id;
                delete serialized['$id'];

                let patched = false;

                // If we have an id, try PATCH by $id first
                if (docIdRaw) {
                    const patchRes = await fetch(`${baseUrl}/${docIdRaw}`, {
                        method: 'PATCH',
                        headers,
                        body: JSON.stringify({ data: serialized }),
                    });
                    if (patchRes.ok) {
                        results.push(mapDoc(await patchRes.json()));
                        patched = true;
                    }
                }

                // If PATCH by id failed, try finding the first document in the collection
                if (!patched) {
                    const listRes = await fetch(`${baseUrl}?${new URLSearchParams({ 'queries[]': JSON.stringify({ method: 'limit', values: [1] }) })}`, { method: 'GET', headers });
                    if (listRes.ok) {
                        const listJson = await listRes.json();
                        if (listJson.documents && listJson.documents.length > 0) {
                            const existingId = listJson.documents[0]['$id'];
                            // Try patch with stripped attributes logic
                            let payload = { ...serialized };
                            let patchAttempts = 0;
                            while (!patched && patchAttempts < 20) {
                                const patchRes2 = await fetch(`${baseUrl}/${existingId}`, {
                                    method: 'PATCH',
                                    headers,
                                    body: JSON.stringify({ data: payload }),
                                });
                                if (patchRes2.ok) {
                                    results.push(mapDoc(await patchRes2.json()));
                                    patched = true;
                                } else {
                                    const err = await patchRes2.json();
                                    const msg = err.message || '';
                                    const match = msg.match(/Unknown attribute[:\s"]+([a-zA-Z0-9_$]+)/i);
                                    if (match && match[1]) {
                                        delete payload[match[1]];
                                        patchAttempts++;
                                    } else {
                                        break; // throw or continue to insert fallback
                                    }
                                }
                            }
                        }
                    }
                }

                // Fall back to INSERT (new document)
                if (!patched) {
                    const body = JSON.stringify({ documentId: crypto.randomUUID(), data: serialized });
                    const res  = await fetch(baseUrl, { method: 'POST', headers, body });
                    if (!res.ok) {
                        const errJson = await res.json();
                        if (res.status === 422 || (errJson.message && errJson.message.includes('Unknown attribute'))) {
                            const clean = await stripAndRetryInsert(baseUrl, headers, serialized);
                            results.push(clean);
                        } else {
                            throw errJson;
                        }
                    } else {
                        results.push(mapDoc(await res.json()));
                    }
                }
            }

            data = Array.isArray(payloadData) ? results : results[0];


        // ── UPDATE ──────────────────────────────────────────────
        } else if (action === 'update') {
            // Find document IDs via filters
            const docIds = await resolveDocIds(baseUrl, headers, filters, config);
            if (!docIds.length) throw new Error('UPDATE: no matching documents found');

            const serialized = serializeJsonFields(payloadData);
            // Remove id/$id — Appwrite rejects these as writeable fields
            delete serialized.id;
            delete serialized['$id'];
            const results = [];

            for (const docId of docIds) {
                let payload = { ...serialized };
                let patched = false;
                let attempts = 0;
                while (!patched && attempts < 20) {
                    const body = JSON.stringify({ data: payload });
                    const res  = await fetch(`${baseUrl}/${docId}`, { method: 'PATCH', headers, body });
                    if (res.ok) {
                        results.push(mapDoc(await res.json()));
                        patched = true;
                    } else {
                        const err = await res.json();
                        const msg = err.message || '';
                        const match = msg.match(/Unknown attribute[:\s"]+([a-zA-Z0-9_$]+)/i);
                        if (match && match[1]) {
                            delete payload[match[1]];
                            attempts++;
                        } else {
                            throw err;
                        }
                    }
                }
            }

            data = results;


        // ── DELETE ──────────────────────────────────────────────
        } else if (action === 'delete') {
            const docIds = await resolveDocIds(baseUrl, headers, filters, config);
            if (!docIds.length) { data = []; return; }

            for (const docId of docIds) {
                const res = await fetch(`${baseUrl}/${docId}`, { method: 'DELETE', headers });
                if (!res.ok && res.status !== 404) throw await res.json();
            }

            data = [];
        }

    } catch (err) {
        error = { message: err.message || String(err), details: err };
    }

    return new Response(JSON.stringify({ data, error, count }), {
        status:  200,
        headers: corsHeaders,
    });
}

// Map Appwrite document fields → frontend-compatible field names
function mapDoc(doc) {
    if (!doc) return doc;
    const out = { ...doc };
    out.id         = doc.$id;
    out.created_at = doc.$createdAt;
    out.updated_at = doc.$updatedAt;
    delete out.$id;
    delete out.$createdAt;
    delete out.$updatedAt;
    delete out.$permissions;
    delete out.$collectionId;
    delete out.$databaseId;
    return deserializeJsonFields(out);
}

// Resolve matching document IDs for UPDATE / DELETE
async function resolveDocIds(baseUrl, headers, filters) {
    const eqIdFilter = filters
        ? filters.find(f => f.method === 'eq' && (f.args[0] === 'id' || f.args[0] === '$id'))
        : null;

    if (eqIdFilter) return [eqIdFilter.args[1]];

    // Build query and fetch matching docs using JSON format
    const params = new URLSearchParams();
    if (filters) {
        filters.forEach(f => {
            const col = f.args[0] === 'id' ? '$id' : f.args[0];
            const val = f.args[1];
            if (f.method === 'eq') params.append('queries[]', Q.equal(col, val));
        });
    }
    params.append('queries[]', Q.limit(100));

    const url = `${baseUrl}?${params}`;
    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) return [];

    const json = await res.json();
    return (json.documents || []).map(d => d.$id);
}
