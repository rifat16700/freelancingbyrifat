const fs = require('fs');
let content = fs.readFileSync('checkout.html', 'utf8');

content = content.replace(/<a href="cart\.html" class="nav-icon-btn">.*<\/a>/, '<a href="cart.html" class="nav-icon-btn"><i data-lucide="arrow-left" class="lucide-icon"></i></a>');
content = content.replace(/<div style="margin-left:auto;font-size:13px;color:#888;">.*?Secure Checkout<\/div>/, '<div style="margin-left:auto;font-size:13px;color:#888;"><i data-lucide="lock" class="lucide-icon"></i> Secure Checkout</div>');
content = content.replace(/<div class="section-card-title">.*?Step 1: Customer Information<\/div>/, '<div class="section-card-title"><i data-lucide="user" class="lucide-icon"></i> Step 1: Customer Information</div>');
content = content.replace(/<div style="font-size:13px;font-weight:800;color:#627EEA;margin-bottom:10px;display:flex;align-items:center;gap:6px;">[\s\S]*?Add-Once Products <span style="font-size:11px;font-weight:500;color:#888;">\(Optional\)<\/span>\s*<\/div>/, '<div style="font-size:13px;font-weight:800;color:#627EEA;margin-bottom:10px;display:flex;align-items:center;gap:6px;"><i data-lucide="package-plus" class="lucide-icon"></i> Add-Once Products <span style="font-size:11px;font-weight:500;color:#888;">(Optional)</span></div>');
content = content.replace(/<button id="addOnceViewMoreBtn"[^>]*>[\s\S]*?View More Add-Once Products\s*<\/button>/, '<button id="addOnceViewMoreBtn" onclick="openAddOnceSheet()" style="display:none; width:100%; margin-top:4px; padding:10px; border:1.5px dashed rgba(98,126,234,0.4); border-radius:10px; background:rgba(98,126,234,0.04); color:#627EEA; font-size:13px; font-weight:700; cursor:pointer; transition:all 0.2s;"><i data-lucide="package-plus" class="lucide-icon"></i> View More Add-Once Products</button>');
content = content.replace(/<div style="font-size:13px;font-weight:700;color:#FF9500;margin-bottom:4px;">.*?Advance Required<\/div>/, '<div style="font-size:13px;font-weight:700;color:#FF9500;margin-bottom:4px;"><i data-lucide="alert-triangle" class="lucide-icon"></i> Advance Required</div>');
content = content.replace(/<button class="transfer-tab-btn active" id="tabNational" onclick="switchTransferTab\('national'\)">[\s\S]*?National Transfer\s*<\/button>/, '<button class="transfer-tab-btn active" id="tabNational" onclick="switchTransferTab(\'national\')"><i data-lucide="landmark" class="lucide-icon"></i> National Transfer</button>');
content = content.replace(/<button class="transfer-tab-btn" id="tabInternational" onclick="switchTransferTab\('international'\)">[\s\S]*?International Transfer\s*<\/button>/, '<button class="transfer-tab-btn" id="tabInternational" onclick="switchTransferTab(\'international\')"><i data-lucide="globe" class="lucide-icon"></i> International Transfer</button>');
content = content.replace(/<label class="form-label" style="font-weight:700;font-size:13px;">.*?Transaction ID \/ TxHash \*<\/label>/, '<label class="form-label" style="font-weight:700;font-size:13px;"><i data-lucide="hash" class="lucide-icon"></i> Transaction ID / TxHash *</label>');
content = content.replace(/<button class="verify-btn" id="verifyCryptoBtn" onclick="verifyCryptoCheck\(event\)" style="display:none;">[\s\S]*?Verify & Pay\s*<\/button>/, '<button class="verify-btn" id="verifyCryptoBtn" onclick="verifyCryptoCheck(event)" style="display:none;"><i data-lucide="shield-check" class="lucide-icon"></i> Verify & Pay</button>');
content = content.replace(/<button id="removePromoBtn"[^>]*>.*?<\/button>/, '<button id="removePromoBtn" onclick="removePromo()" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; color:#ff3b30; font-size:16px; font-weight:bold; cursor:pointer; display:none; padding:4px; line-height:1;" title="Remove Promo"><i data-lucide="x" class="lucide-icon"></i></button>');
content = content.replace(/<button class="btn btn-outline" onclick="openAllCouponsModal\(\)"[^>]*>.*?Coupons<\/button>/, '<button class="btn btn-outline" onclick="openAllCouponsModal()" style="border:1px dashed var(--primary);font-size:12px;white-space:nowrap;padding:10px 12px;background:rgba(255,77,77,0.03);border-radius:12px;font-weight:700;"><i data-lucide="ticket" class="lucide-icon"></i> Coupons</button>');

// Bengali text replacements
content = content.replace(/<span style="font-size: 14\.5px; color: #1C1C1E; line-height: 1\.5; text-align: left; font-weight: 600;">[\s\S]*?<\/span>/g, function(match, offset, str) {
    if (match.includes('??????')) {
        return '<span style="font-size: 14.5px; color: #1C1C1E; line-height: 1.5; text-align: left; font-weight: 600;">??? ???????, ?? ?????? ?????? ???? ???????????????? ????? ?? ???? ??????? ??? ???? ??? ???? ??? ?????? ???? ?????? ????</span>';
    }
    if (match.includes('?') || match.includes('????')) {
        return '<span style="font-size: 14.5px; color: #1C1C1E; line-height: 1.5; text-align: left; font-weight: 600;">???? ???? ???? ???????? ??????? ???? ????? ?????? ????</span>';
    }
    return match;
});

content = content.replace(/<div id="funTooltip1"([^>]+)>[\s\S]*?<div style/g, '<div id="funTooltip1">??????????! ????? ???? ????????!<div style');

fs.writeFileSync('checkout.html', content, 'utf8');
