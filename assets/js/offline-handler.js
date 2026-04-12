// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Assume sw.js is in the root directory relative to the host
        navigator.serviceWorker.register('/sw.js').then((registration) => {
            console.log('SW registered with scope:', registration.scope);
        }).catch((err) => {
            console.log('SW registration failed:', err);
        });
    });
}

// Global Online/Offline Event Listeners
// Global Online/Offline Event Listeners
window.addEventListener('offline', () => {
    // If the browser registers as offline, route to the dedicated offline page.
    const currentUrl = window.location.pathname + window.location.search;
    if (!currentUrl.includes('/offline.html')) {
        window.location.href = '/offline.html?redirect=' + encodeURIComponent(currentUrl);
    }
});

// Remove overlay logic if it was lingering, though a hard reload clears it.
window.addEventListener('online', () => {
    if (window.location.pathname.includes('/offline.html')) {
        // Go back to the redirect target or root
        const params = new URLSearchParams(window.location.search);
        const redirectUrl = params.get('redirect') || '/';
        window.location.href = redirectUrl;
    }
});

// Optional 'Go Offline' manual simulator
function simulateOfflineMode() {
    window.location.href = '/offline.html#simulate';
}
