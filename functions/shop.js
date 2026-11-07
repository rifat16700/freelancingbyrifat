import { renderShopPage } from './_lib/render-shop.js';

export async function onRequestGet(context) {
    return renderShopPage(context, null);
}
