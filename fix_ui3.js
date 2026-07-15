const fs = require('fs');
let html = fs.readFileSync('checkout.html', 'utf8');

html = html.replace(/Continue to Delivery[^<]+<\/button>/g, 'Continue to Delivery <i data-lucide="arrow-right" class="lucide-icon"></i></button>');
html = html.replace(/Continue to Payment[^<]+<\/button>/g, 'Continue to Payment <i data-lucide="arrow-right" class="lucide-icon"></i></button>');
html = html.replace(/onclick="goStep\(1\)">[^<]+Back<\/button>/g, 'onclick="goStep(1)"><i data-lucide="arrow-left" class="lucide-icon"></i> Back</button>');
html = html.replace(/onclick="goStep\(2\)">[^<]+Back<\/button>/g, 'onclick="goStep(2)"><i data-lucide="arrow-left" class="lucide-icon"></i> Back</button>');

// Also fix the Cash on Delivery radio button label that still has the broken emoji
html = html.replace(/<span style="font-size:20px;">[^<]+<\/span>\s*<span style="font-size:15px;font-weight:700;color:var\(--text-dark\);">\s*Cash on Delivery/g, '<i data-lucide="banknote" class="lucide-icon"></i> <span style="font-size:15px;font-weight:700;color:var(--text-dark);">Cash on Delivery');

// And remove any leftover ` ` in Cash on Delivery label if any
html = html.replace(/x\| Cash on Delivery/g, 'Cash on Delivery');

fs.writeFileSync('checkout.html', html, 'utf8');
