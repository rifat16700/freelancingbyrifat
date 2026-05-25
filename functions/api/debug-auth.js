// functions/api/debug-auth.js
// Temporary debug — test if Appwrite auth is reachable
// Visit: /api/debug-auth

import { getConfig } from '../utils/config.js';

export async function onRequest(context) {
    const config = getConfig(context.env);
    const result = {
        DB_PROVIDER:       config.DB_PROVIDER,
        APPWRITE_ENDPOINT: config.APPWRITE_ENDPOINT || '❌ NOT SET',
        APPWRITE_PROJECT:  config.APPWRITE_PROJECT  ? '✅ SET' : '❌ NOT SET',
        APPWRITE_API_KEY:  config.APPWRITE_API_KEY  ? '✅ SET' : '❌ NOT SET',
        SUPABASE_URL:      config.SUPABASE_URL       ? '✅ SET' : '❌ NOT SET',
        SUPABASE_ANON_KEY: config.SUPABASE_ANON_KEY  ? '✅ SET' : '❌ NOT SET',
    };

    // Test Appwrite account endpoint reachability
    if (config.DB_PROVIDER === 'appwrite' && config.APPWRITE_PROJECT) {
        try {
            const testRes = await fetch(`${config.APPWRITE_ENDPOINT}/account`, {
                headers: {
                    'X-Appwrite-Project': config.APPWRITE_PROJECT,
                    'Content-Type': 'application/json',
                },
            });
            const testData = await testRes.json();
            result.appwrite_account_ping = testRes.status;
            result.appwrite_account_response = testData.message || testData.type || JSON.stringify(testData).substring(0, 100);
        } catch (e) {
            result.appwrite_account_ping = '❌ fetch error: ' + e.message;
        }

        // Test a dummy login to see the exact error
        try {
            const loginRes = await fetch(`${config.APPWRITE_ENDPOINT}/account/sessions/email`, {
                method: 'POST',
                headers: {
                    'X-Appwrite-Project': config.APPWRITE_PROJECT,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: 'test@test.com', password: 'wrongpassword123' }),
            });
            const loginData = await loginRes.json();
            result.appwrite_login_status = loginRes.status;
            result.appwrite_login_error = loginData.message || loginData.type || 'unknown';
            // If 401, endpoint works but wrong credentials - that's GOOD
            // If 400/404, endpoint format is wrong
        } catch (e) {
            result.appwrite_login_test = '❌ fetch error: ' + e.message;
        }
    }

    return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
}
