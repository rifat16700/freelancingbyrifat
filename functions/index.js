import { renderHomePage } from './_lib/render-home.js';

export async function onRequestGet(context) {
    return renderHomePage(context, null);
}
