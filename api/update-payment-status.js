// Vercel Serverless Function — POST /api/update-payment-status
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

    // NO ADMIN TOKEN CHECK - This is a public endpoint used by the frontend after gateway verification
    try {
        const { id, upData } = req.body;
        if (!id || !upData) throw new Error("No id or upData provided");

        // SECURITY: Restrict which fields can be updated publicly!
        const allowedFields = ['payment_status', 'payment_trx_id', 'status'];
        const updateFields = [];
        const params = [];

        for (const [key, value] of Object.entries(upData)) {
            if (allowedFields.includes(key)) {
                updateFields.push(`${key} = ?`);
                params.push(value);
            }
        }

        if (updateFields.length === 0) return res.status(200).json({ success: true });

        const query = `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`;
        params.push(id);

        const d1Res = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${process.env.CF_DB_ID}/query`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.CF_WRITE_TOKEN}`
                },
                body: JSON.stringify({ sql: query, params })
            }
        );

        const data = await d1Res.json();
        if (!data.success) throw new Error(data.errors?.[0]?.message || 'D1 Error');

        return res.status(200).json({ success: true });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
