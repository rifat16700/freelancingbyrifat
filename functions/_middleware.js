// Middleware has been disabled. Configs are now generated at build time via build.js
export async function onRequest(context) {
    return context.next();
}

