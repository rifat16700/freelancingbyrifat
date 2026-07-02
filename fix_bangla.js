const fs = require('fs');
let html = fs.readFileSync('checkout.html', 'utf8');

// Fix Taka Sign (which became αº│ or something like that)
html = html.replace(/αº│/g, '৳');

// The original corrupted text for Promise 1
const prom1_corrupted = 'αª«αª┐ αª¿αª┐αª╢αºìαª┐αªñ, αªÅ αª░αºìαªíαª╛αª░ αª╕αªñαºìαª»αª┐ αª¿αª┐αªñ αª¬αºìαª░αªñαª┐αª╢αºìαª░αºüαªñαª┐αª¼αªªαºìαªºαÑñ αª░αª┐αª╕αª┐αª¡ αª¿αª╛ "αª░αª▓  αª▓αºìαª▓αª╛αª╣αª░  αª¼  αª«αª╛αª░ 0αª¬αª░ αª¬αª¼ αªÅαª¼  αª¬αª░"αª╛αª▓ "αªá9αª░ αª╢αª╛αª╕αºìαªñαª┐ αª╣αª¼αÑñ';
const prom1_fixed = 'আমি নিশ্চিত, এই অর্ডারটি আমি রিসিভ করতে প্রতিশ্রুতিবদ্ধ। রিসিভ না করলে আল্লাহর গজব আমার উপর পড়বে এবং পরকালে কঠোর শাস্তি হবে।';
html = html.replace(prom1_corrupted, prom1_fixed);

const tooltip1_corrupted = 'αª«αª╛αª╢αª╛αªåαª▓αºìαª▓αª╛αª╣! αªåαª¬αª¿αª╛αª░ αª¿αª┐αºƒαªñ αª¬αª░αª┐αª╖αºìαªòαª╛αª░ ≡ƒîƒ';
const tooltip1_fixed = 'মাশাআল্লাহ! আপনার নিয়ত পরিষ্কার 😇';
html = html.replace(tooltip1_corrupted, tooltip1_fixed);

const prom2_corrupted = 'αª¬αªúαºìαª» αª╣αª╛αªñ αª¬┐╜x αªíαª▓αª┐αª¡αª╛αª░αª┐ αª«αºìαª»αª╛αª¿αª░ "αª╛: αª« αª▓αºìαª» αª¬αª░αª┐αª╢9αªº "αª░αºüαª¿';
const prom2_fixed = 'পণ্য হাতে পেয়ে ডেলিভারি ম্যানের কাছে মূল্য পরিশোধ করুন';
html = html.replace(prom2_corrupted, prom2_fixed);

const tooltip2_corrupted = 'αªºαª¿αºìαª»αª¼αª╛αªª!';
const tooltip2_fixed = 'ধন্যবাদ!';
html = html.replace(tooltip2_corrupted, tooltip2_fixed);

// Fix the missing lucide.createIcons() after buildPaymentOptions()
if (!html.includes('lucide.createIcons(); }')) {
    html = html.replace(/buildPaymentOptions\(\);\s*}/, 'buildPaymentOptions();\n        if (typeof lucide !== \'undefined\') lucide.createIcons();\n    }');
}

fs.writeFileSync('checkout.html', html);
console.log('Fixed Bengali text and icons');
