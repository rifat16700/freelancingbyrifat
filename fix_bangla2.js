const fs = require('fs');
let html = fs.readFileSync('checkout.html', 'utf8');

// Replace the checkboxes
html = html.replace(/<span[^>]*>\s*αª«αª┐ αª¿αª┐αª╢[^<]*<\/span>/g, '<span style="font-size: 14.5px; color: #1C1C1E; line-height: 1.5; text-align: left; font-weight: 600;">\n                                আমি নিশ্চিত, এই অর্ডারটি আমি রিসিভ করতে প্রতিশ্রুতিবদ্ধ। রিসিভ না করলে আল্লাহর গজব আমার উপর পড়বে এবং পরকালে কঠোর শাস্তি হবে।\n                            </span>');
html = html.replace(/<span[^>]*>\s*αª¬αªúαºìαª» αª╣αª╛αªñ[^<]*<\/span>/g, '<span style="font-size: 14.5px; color: #1C1C1E; line-height: 1.5; text-align: left; font-weight: 600;">\n                                পণ্য হাতে পেয়ে ডেলিভারি ম্যানের কাছে মূল্য পরিশোধ করুন\n                            </span>');

// Replace the tooltips
html = html.replace(/αª«αª╛αª╢αª╛αªåαª▓αºìαª▓αª╛αª╣! αªåαª¬αª¿αª╛αª░ αª¿αª┐αºƒαªñ αª¬αª░αª┐αª╖αºìαªòαª╛αª░ ≡ƒîƒ/g, 'মাশাআল্লাহ! আপনার নিয়ত পরিষ্কার 😇');
html = html.replace(/αªºαª¿αºìαª»αª¼αª╛αªª!/g, 'ধন্যবাদ!');

// Replace the alerts
html = html.replace(/alert\('αª░αºìαªí[^']+'\);/g, (match) => {
    if (match.includes('αª«αª┐ αª¿αª┐αª╢')) {
        return "alert('অর্ডার কনফার্ম করতে দয়া করে \"আমি নিশ্চিত...\" বক্সে টিক দিন!');";
    }
    if (match.includes('αª¬αªúαºìαª»')) {
        return "alert('অর্ডার কনফার্ম করতে দয়া করে \"পণ্য হাতে পেয়ে...\" বক্সে টিক দিন!');";
    }
    return match;
});

// Replace comment mojibakes just so the code is clean (optional but good)
html = html.replace(/αªÑ┐╜"  αª▓αª╛αªªαª╛/g, 'থেকে আলাদা');
html = html.replace(/αª╣αª▓  αª▓αª╛αªªαª╛/g, 'হলে আলাদা');
html = html.replace(/αªÑ┐╜" load "αª░9/g, 'থেকে load করে');
html = html.replace(/αª╢αºüαªºαºü COD select αª╣αª▓ αªª┐╜ αª╛αª¼/g, 'শুধুমাত্র COD select হলে দেখাবে');
html = html.replace(/selectPayment\(\) αªÅ control αª╣αª»αª╝/g, 'selectPayment() এ control হয়');
html = html.replace(/αª░ αª░αª╛ 9/g, 'করা');
html = html.replace(/payment type αª¼┐╜: αª¿αª┐αª▓ αª╕αªáαª┐"αª¡αª╛αª¼ show\/hide αª╣αª¼/g, 'payment type বুঝে সঠিক ভাবে show/hide হবে');
html = html.replace(/αª╕┐╜! transaction αªÅαª░ ID αªªαª╛/g, 'সঠিক transaction এর ID দিন');
html = html.replace(/direct key clear "αª░9   main cart ┐╜"αºìαª╖αªñ αªÑαª╛"αª¼/g, 'direct key clear করে main cart এ ফেরত যাবে');
html = html.replace(/order save "αª░9/g, 'order save করে');
html = html.replace(/Admin    Settings    Crypto & Binance Pay αªÑ┐╜" αª»9  "αª░9αÑñ/g, 'Admin -> Settings -> Crypto & Binance Pay থেকে যোগ করুন।');
html = html.replace(/Cloudflare proxy fail αª╣αª▓ Supabase backup/g, 'Cloudflare proxy fail হলে Supabase backup');

fs.writeFileSync('checkout.html', html);
