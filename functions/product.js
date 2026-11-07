import { renderProductPage } from './_lib/render-product.js';

export async function onRequestGet(context) {
    return renderProductPage(context, null);
}
