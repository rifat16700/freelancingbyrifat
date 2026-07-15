/**
 * Config-Driven Universal Tracking Architecture
 * This script runs on the frontend, fetches the tracking config, and handles event routing.
 */

(function () {
    let config = null;
    let initialized = false;

    // Load config at startup
    async function loadConfig() {
        try {
            const res = await fetch('/tracking-config.json');
            if (res.ok) {
                config = await res.json();
                initializeTracking();
            }
        } catch (e) {
            console.error('Tracking config failed to load:', e);
        }
    }

    function generateEventId() {
        return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Initialize browser scripts if needed
    function initializeTracking() {
        if (!config || config.tracking_mode === 'built_in_server_side' || config.tracking_mode === 'custom_external') {
            // Don't inject browser scripts if strict server-side
            return;
        }

        // We only initialize browser scripts if mode is 'browser_only' or 'smart_fallback'
        initialized = true;

        // Meta Pixel Init
        if (config.meta_pixel_id) {
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', config.meta_pixel_id);
            fbq('track', 'PageView');
        }

        // GA4 Init
        if (config.ga4_id) {
            const script = document.createElement('script');
            script.async = true;
            script.src = `https://www.googletagmanager.com/gtag/js?id=${config.ga4_id}`;
            document.head.appendChild(script);

            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('config', config.ga4_id);
        }

        // GTM Init
        if (config.gtm_id) {
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer',config.gtm_id);
        }

        // Clarity Init
        if (config.clarity_id) {
            (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", config.clarity_id);
        }
    }

    // Helper to detect AdBlocker
    async function isAdBlockerActive() {
        try {
            await fetch('https://connect.facebook.net/en_US/fbevents.js', { mode: 'no-cors' });
            return false;
        } catch (e) {
            return true;
        }
    }

    // The Global Tracking Event Function
    window.fireTrackingEvent = async function (eventName, eventData = {}) {
        if (!config) {
            console.warn('Tracking config not loaded yet. Retrying in 500ms...');
            setTimeout(() => window.fireTrackingEvent(eventName, eventData), 500);
            return;
        }

        const eventId = generateEventId();
        const payload = {
            event_name: eventName,
            event_time: Math.floor(Date.now() / 1000),
            event_id: eventId,
            event_source_url: window.location.href,
            custom_data: eventData
        };

        const mode = config.tracking_mode;

        let useServerSide = (mode === 'built_in_server_side');

        if (mode === 'smart_fallback') {
            const blocked = await isAdBlockerActive();
            if (blocked) {
                useServerSide = true;
            }
        }

        if (useServerSide) {
            // Send to our Pages Function
            fetch('/api/tracking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(e => console.error('Server-side tracking failed:', e));
        } else if (mode === 'custom_external' && config.custom_external_url) {
            // Send to external server (e.g. Stape.io)
            fetch(config.custom_external_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(e => console.error('External tracking failed:', e));
        } else {
            // Browser Only or Smart Fallback (not blocked)
            if (config.meta_pixel_id && typeof fbq !== 'undefined') {
                fbq('track', eventName, eventData, { eventID: eventId });
            }
            if (config.ga4_id && typeof gtag !== 'undefined') {
                gtag('event', eventName, eventData);
            }
            if (config.gtm_id && typeof dataLayer !== 'undefined') {
                dataLayer.push({ event: eventName, ...eventData, event_id: eventId });
            }
        }
    };

    loadConfig();
})();
