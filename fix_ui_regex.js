const fs = require('fs');
let html = fs.readFileSync('checkout.html', 'utf8');

// Replace all \ufffd marks with lucide icons where appropriate.
// Continue to Delivery
html = html.replace(/Continue to Delivery[\s\ufffd]+<\/button>/g, 'Continue to Delivery <i data-lucide="arrow-right" class="lucide-icon"></i></button>');

// Back buttons
html = html.replace(/[\s\ufffd]+Back<\/button>/g, '<i data-lucide="arrow-left" class="lucide-icon"></i> Back</button>');

// Continue to Payment
html = html.replace(/Continue to Payment[\s\ufffd]+<\/button>/g, 'Continue to Payment <i data-lucide="arrow-right" class="lucide-icon"></i></button>');

// Place Order
html = html.replace(/<button class="btn btn-primary btn-full" id="placeOrderBtn" onclick="placeOrder\(\)"[^>]*>[\s\ufffd]+Place Order<\/button>/g, '<button class="btn btn-primary btn-full" id="placeOrderBtn" onclick="placeOrder()" style="font-size:16px;padding:14px;border-radius:12px;background:var(--primary);color:var(--white);font-weight:700;"><i data-lucide="check-circle" class="lucide-icon"></i> Place Order</button>');

// Fix "Cash on Delivery" radio button
html = html.replace(/[\s\ufffd]+Cash on Delivery/g, '<i data-lucide="banknote" class="lucide-icon"></i> Cash on Delivery');

// Fix "No advance payment needed online"
html = html.replace(/[\s\ufffd]+No advance payment needed online\./g, '<i data-lucide="shield-check" class="lucide-icon"></i> No advance payment needed online.');

// Fix Order Summary items:
html = html.replace(/<span style="color:#888;font-size:11px;margin-right:2px;">[\s\ufffd]+<\/span>1/g, '<span style="color:#888;font-size:11px;margin-right:2px;"><i data-lucide="x" class="lucide-icon" style="width:10px;height:10px;"></i></span>1');

html = html.replace(/<span>Delivery[\s\ufffd]+<\/span>/g, '<span>Delivery <i data-lucide="truck" class="lucide-icon" style="width:14px;height:14px;"></i></span>');

// Fix the Bengali Text
html = html.replace(/\?{10}!\s*\?{5}\s*\?{4}\s*\?{8}!/g, 'মাশাআল্লাহ! আপনার নিয়ত পরিষ্কার 🌟');

fs.writeFileSync('checkout.html', html, 'utf8');
