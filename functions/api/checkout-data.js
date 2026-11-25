import {
    ensureBrandSchema,
    resolveBrand,
    getAllActiveBrands,
    mergeSettingsWithBrand
} from '../_lib/brand.js';

export async function onRequestGet(context) {
    const { env, request } = context;

    if (!env.DB) {
        return Response.json({ success: false, error: "Database not configured" });
    }

    try {
        await ensureBrandSchema(env);
        try { await env.DB.prepare("ALTER TABLE settings ADD COLUMN web3_wallet_address TEXT DEFAULT ''").run(); } catch (e) {}

        const url = new URL(request.url);
        const brandParam = (url.searchParams.get("brand") || url.searchParams.get("brand_id") || "").trim();

        let activeBrand = null;
        if (brandParam) {
            const resolved = await resolveBrand(env, brandParam, true);
            activeBrand = resolved.brand;
        }

        const p1 = env.DB.prepare("SELECT * FROM settings WHERE id=1");
        const p2 = env.DB.prepare("SELECT * FROM delivery_zones");
        const p3 = env.DB.prepare("SELECT * FROM addons WHERE is_active=1 ORDER BY created_at");
        // Return all active promos (with brand_id included) so Checkout can validate global (brand_id IS NULL) vs brand-specific promos
        const p4 = env.DB.prepare("SELECT * FROM promos WHERE is_active=1 LIMIT 500");

        let p5;
        if (activeBrand) {
            p5 = env.DB.prepare("SELECT id,name,base_price,flash_sale_price,gallery_images,variants,brand_id FROM products WHERE is_add_once=1 AND is_active=1 AND brand_id = ?").bind(activeBrand.id);
        } else {
            p5 = env.DB.prepare("SELECT id,name,base_price,flash_sale_price,gallery_images,variants,brand_id FROM products WHERE is_add_once=1 AND is_active=1 AND (brand_id IS NULL OR brand_id = '' OR show_on_main = 1)");
        }

        const [rawSettingsRes, zones, addons, promos, add_once, allBrands] = await Promise.all([
            p1.all(),
            p2.all(),
            p3.all(),
            p4.all(),
            p5.all().catch(() => ({ results: [] })),
            getAllActiveBrands(env)
        ]);

        const rawSettings = (rawSettingsRes.results && rawSettingsRes.results.length) ? rawSettingsRes.results[0] : {};
        if (!rawSettings.web3_wallet_address && rawSettings.ai_config) {
            try {
                const aiCfg = typeof rawSettings.ai_config === 'string' ? JSON.parse(rawSettings.ai_config) : rawSettings.ai_config;
                if (aiCfg && aiCfg.web3WalletAddress) rawSettings.web3_wallet_address = aiCfg.web3WalletAddress;
            } catch (e) {}
        }
        const mergedSettings = mergeSettingsWithBrand(rawSettings, activeBrand);

        const data = {
            settings: mergedSettings,
            brand: activeBrand || null,
            brands: allBrands,
            zones: zones.results || [],
            addons: addons.results || [],
            promos: promos.results || [],
            add_once: add_once.results || [],
            web3_config: {
                reown_project_id: env.REOWN_PROJECT_ID || "",
                merchant_wallet: mergedSettings.web3_wallet_address || env.MERCHANT_WALLET || "",
                usdt_contract: env.USDT_CONTRACT || "0x55d398326f99059fF775485246999027B3197955",
                usdt_decimals: Number(env.USDT_DECIMALS || 18),
                chain_id: 56
            }
        };

        return new Response(JSON.stringify({ success: true, data }), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });
    } catch (e) {
        return Response.json({ success: false, error: e.message }, { status: 500 });
    }
}
