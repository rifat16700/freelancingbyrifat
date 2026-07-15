const fs = require('fs');
let c = fs.readFileSync('checkout.html', 'utf8');

const injectionPointStr = `            }).catch(function() { return { data: [] }; });
        } else {`;

const replaceStr = `            }).catch(function() { return { data: [] }; });
        } else if (CONFIG.DB_PROVIDER === 'cf_db') {
            var masterPromise = fetch((CONFIG.HF_API_BASE||"")+"/api/checkout-data").then(function(r){return r.json();}).catch(function(e){return {success:false, data:{}};});
            p1 = masterPromise.then(function(r) {
                var doc = (r.success && r.data && r.data.settings) ? r.data.settings : {};
                if (typeof doc.messaging_apps === 'string') try { doc.messaging_apps = JSON.parse(doc.messaging_apps); } catch(e){}
                if (typeof doc.crypto_coins === 'string') try { doc.crypto_coins = JSON.parse(doc.crypto_coins); } catch(e){}
                return { data: doc };
            });
            p2 = masterPromise.then(function(r) {
                var zones = (r.success && r.data && r.data.zones) ? r.data.zones : [];
                return { data: zones.map(function(d) { if(typeof d.gallery_images==='string') try{ d.gallery_images=JSON.parse(d.gallery_images); }catch(e){} return d; }) };
            });
            p3 = masterPromise.then(function(r) {
                var addonsList = (r.success && r.data && r.data.addons) ? r.data.addons : [];
                return { data: addonsList.map(function(d) { d.is_active = (d.is_active === 1 || d.is_active === true); if(typeof d.gallery_images==='string') try{ d.gallery_images=JSON.parse(d.gallery_images); }catch(e){} return d; }) };
            });
            p4 = masterPromise.then(function(r) {
                var promoList = (r.success && r.data && r.data.promos) ? r.data.promos : [];
                return { data: promoList.map(function(d) {
                    d.is_active = (d.is_active === 1 || d.is_active === true);
                    d.is_repeated_config = (d.is_repeated_config === 1 || d.is_repeated_config === true);
                    ['applicable_products','applicable_categories','applicable_districts','applicable_payments'].forEach(function(k){
                        if(typeof d[k]==='string') try{ d[k]=JSON.parse(d[k]); }catch(e){}
                    });
                    return d;
                })};
            });
            p5 = masterPromise.then(function(r) {
                var addOnceList = (r.success && r.data && r.data.add_once) ? r.data.add_once : [];
                return { data: addOnceList.map(function(d) { if(typeof d.gallery_images==='string') try{ d.gallery_images=JSON.parse(d.gallery_images); }catch(e){} if(typeof d.variants==='string') try{ d.variants=JSON.parse(d.variants); }catch(e){} return d; }) };
            });
        } else {`;

c = c.replace(/\r/g, "");
const normInjectionPointStr = injectionPointStr.replace(/\r/g, "");

if (c.indexOf(normInjectionPointStr) !== -1) {
    c = c.replace(normInjectionPointStr, replaceStr);
    fs.writeFileSync('checkout.html', c);
    console.log("Injected cf_db data fetch block successfully!");
} else {
    console.log("Could not find injection point.");
}
