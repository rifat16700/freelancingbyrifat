const fs = require('fs');
let html = fs.readFileSync('checkout.html', 'utf8');

// Step 1
html = html.replace('Continue to Delivery   </button>', 'Continue to Delivery <i data-lucide="arrow-right" class="lucide-icon"></i></button>');

// Step 2
html = html.replace('  Back</button>', '<i data-lucide="arrow-left" class="lucide-icon"></i> Back</button>');
html = html.replace('Continue to Payment  </button>', 'Continue to Payment <i data-lucide="arrow-right" class="lucide-icon"></i></button>');

// Step 3
html = html.replace('x| Cash on Delivery', '<i data-lucide="banknote" class="lucide-icon"></i> Cash on Delivery');
html = html.replace('S& No advance payment needed online.', '<i data-lucide="shield-check" class="lucide-icon"></i> No advance payment needed online.');

html = html.replace('S& Place Order</button>', '<i data-lucide="check-circle" class="lucide-icon"></i> Place Order</button>');
html = html.replace('  Back', '<i data-lucide="arrow-left" class="lucide-icon"></i> Back');

// Also fix the top left back button:
html = html.replace('class="nav-icon-btn"><i data-lucide="arrow-left" class=', 'class="nav-icon-btn"><i data-lucide="arrow-left" class='); // Wait, is top left broken?
html = html.replace(' <span id="cartCountHeader"', '<i data-lucide="shopping-cart" class="lucide-icon"></i> <span id="cartCountHeader"');

// Fix summary icons
html = html.replace('/', '<i data-lucide="x" class="lucide-icon" style="width:12px;height:12px;display:inline;"></i>'); // Quantity "X"
html = html.replace(' ', '<i data-lucide="truck" class="lucide-icon" style="width:14px;height:14px;display:inline;"></i>'); // Delivery in order summary

// Fix the Bengali Tooltip
html = html.replace('??????????! ????? ???? ????????!', 'মাশাআল্লাহ! আপনার নিয়ত পরিষ্কার 🌟');

fs.writeFileSync('checkout.html', html, 'utf8');
