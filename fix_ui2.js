const fs = require('fs');
let html = fs.readFileSync('checkout.html', 'utf8');

// Line 177: Continue to Delivery
html = html.replace('Continue to Delivery   </button>', 'Continue to Delivery <i data-lucide="arrow-right" class="lucide-icon"></i></button>');

// Line 221: Back
html = html.replace('onclick="goStep(1)">  Back</button>', 'onclick="goStep(1)"><i data-lucide="arrow-left" class="lucide-icon"></i> Back</button>');

// Line 358: Back
html = html.replace('onclick="goStep(2)">  Back</button>', 'onclick="goStep(2)"><i data-lucide="arrow-left" class="lucide-icon"></i> Back</button>');

// Line 375: Delivery icon in summary
html = html.replace('<span id="smDelivery"> </span>', '<span id="smDelivery"><i data-lucide="truck" class="lucide-icon" style="width:14px;height:14px;"></i></span>');
html = html.replace("deliveryCharge > 0 ? '৳' + deliveryCharge : ' ';", "deliveryCharge > 0 ? '৳' + deliveryCharge : '<i data-lucide=\"truck\" class=\"lucide-icon\" style=\"width:14px;height:14px;\"></i>';");

// Continue to Payment (wait, where is it?)
html = html.replace('Continue to Payment   </button>', 'Continue to Payment <i data-lucide="arrow-right" class="lucide-icon"></i></button>');

fs.writeFileSync('checkout.html', html, 'utf8');
