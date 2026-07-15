# Fix broken SVG/character encoding issues in checkout.html
# Read the file
$filePath = "c:\Users\PC NET\Downloads\e-commarce\checkout.html"
$content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)

Write-Host "Original file size: $($content.Length) chars"

# ============================================================
# FIX 1: Broken chevron in pay-card and pay-sub-card
# Γ¼║ => > (simple right arrow chevron)
# ============================================================
$content = $content -replace 'class="pay-card-chevron">Γ¼║<', 'class="pay-card-chevron">›<'
$content = $content -replace 'class="pay-sub-chevron">Γ¼║<', 'class="pay-sub-chevron">›<'
Write-Host "Fixed: chevron arrows"

# ============================================================
# FIX 2: Copy button in buildManualDetail - broken icon
# \x1c9 => 📋 (clipboard emoji)
# ============================================================
# The broken char at line 1058 - copy icon button
$content = $content -replace ([char]0x1C) + '9', '📋'
Write-Host "Fixed: copy button icon"

# ============================================================
# FIX 3: buildInternationalOptions broken emojis
# Line 1915: ┐╜ (Binance icon) => 🟡 
# Line 1930: ┐╜" (crypto icon) => 💎
# Line 1941: broken text in "No international payment" message
# ============================================================
$content = $content -replace '<span style="font-size:26px;">┐╜</span>', '<span style="font-size:26px;">🟡</span>'
$content = $content -replace '<span style="font-size:26px;">┐╜"</span>', '<span style="font-size:26px;">💎</span>'
Write-Host "Fixed: international payment icons"

# ============================================================
# FIX 4: "No international payment method configured" broken message
# ============================================================
$oldMsg = '┐╜∩╕Å No international payment method configured.<br>Admin  → Settings  → Crypto &amp; Binance Pay αªÑ┐╜" αª»9 "αª░9αÑñ'
$newMsg = '⚠️ No international payment method configured.<br>Admin → Settings → Crypto &amp; Binance Pay এ যান কনফিগার করুন'
$content = $content -replace [regex]::Escape('┐╜∩╕Å No international payment method configured.<br>Admin  \u0019 Settings  \u0019 Crypto &amp; Binance Pay αªÑ┐╜" αª»9\u0014 "αª░9αÑñ'), $newMsg

# More targeted approach - find the broken no-intl message
$content = $content -replace [regex]::Escape('┐╜∩╕Å No international payment method configured.'), '⚠️ No international payment method configured.'
$content = $content -replace [regex]::Escape('αªÑ┐╜" αª»9'), 'এ যান'
$content = $content -replace [regex]::Escape('αª░9αÑñ'), 'কনফিগার করুন'
Write-Host "Fixed: no-intl message"

# ============================================================
# FIX 5: Binance section broken icons (line ~1984)
# ┐╜ Send USDT => 🔑 Send USDT  (or ⚡)
# ============================================================
$content = $content -replace [regex]::Escape('┐╜ Send USDT (Binance Pay)'), '⚡ Send USDT (Binance Pay)'
Write-Host "Fixed: Binance Send USDT label"

# ============================================================  
# FIX 6: crypto section broken emoji (line ~2012, 2059)
# <span style="font-size:20px;">→</span>  => network icon
# ============================================================
# \x19 chars that are broken control characters used as icons in Telegram msg & crypto section
# Replace \x19 used as bullet/icon in the crypto network listing  
$content = $content -replace '<span style="font-size:20px;">' + [char]0x19 + '</span>', '<span style="font-size:20px;">🔗</span>'
$content = $content -replace '<span style="font-size:18px;">:' + [char]0x1C + '️</span>', '<span style="font-size:18px;">🌐</span>'
Write-Host "Fixed: crypto network icons"

# ============================================================
# FIX 7: Copy button text "Copy" with broken char (line ~2230)
# btn.textContent = '\x1c9 Copy' => btn.textContent = '📋 Copy'
# ============================================================
$content = $content -replace "btn\.textContent = '" + [char]0x1C + "9 Copy'", "btn.textContent = '📋 Copy'"
Write-Host "Fixed: copy button textContent"

# ============================================================
# FIX 8: Verify status messages with broken chars
# ============================================================
# '\x1d Verifying...' => '⏳ Verifying...'
$content = $content -replace "btn\.textContent = '" + [char]0x1D + " Verifying\.\.\.'", "btn.textContent = '⏳ Verifying...'"
# '\x1d Checking transaction...' => '⏳ Checking transaction...'
$content = $content -replace "setVerifyStatus\('" + [char]0x1D + " Checking transaction\.\.\.'", "setVerifyStatus('⏳ Checking transaction...'"
# ' Verified \x1d Placing Order...' => '✅ Verified → Placing Order...'
$content = $content -replace " Verified " + [char]0x1D + " Placing Order\.\.\.", " ✅ Verified → Placing Order..."
# ' Recorded \x1d Placing Order...' => '✅ Recorded → Placing Order...'
$content = $content -replace " Recorded " + [char]0x1D + " Placing Order\.\.\.", " ✅ Recorded → Placing Order..."
# '\x1d\x1e Connecting...' => '🔄 Connecting...'
$content = $content -replace "setVerifyStatus\('" + [char]0x1D + [char]0x1E + " Connecting to backup system", "setVerifyStatus('🔄 Connecting to backup system"
Write-Host "Fixed: verify status messages"

# ============================================================
# FIX 9: Telegram message broken emoji chars
# ============================================================
# Fix emoji chars in telegram messages
# \x1d => (remove or replace with appropriate)
# \x18 (person icon) => 👤
# \x1c~ (phone icon) => 📞
# \x1c (location) => 📍
# \x19 (money/payment) => 💰
# \x1d\x18 => 🔖
# \x1c (items) => 📦
$content = $content -replace "var msg = ': \*NEW ORDER\* " + [char]0x1D + " #'", "var msg = '🛒 *NEW ORDER* - #'"
$content = $content -replace "'" + [char]0x18 + " ' \+", "'👤 ' +"
$content = $content -replace "'\| " + [char]0x1C + "~ ' \+", "'| 📞 ' +"
$content = $content -replace "'" + [char]0x1C + " ' \+ \(order\.district", "'📍 ' + (order.district"
$content = $content -replace "'" + [char]0x1C + " Type: '", "'🚚 Type: '"
$content = $content -replace "'" + [char]0x19 + " Method: '", "'💳 Method: '"
$content = $content -replace "'" + [char]0x19 + " Total: '", "'💰 Total: '"
$content = $content -replace "'" + [char]0x1D + [char]0x18 + " TrxID:", "'🔖 TrxID:"
$content = $content -replace "'" + [char]0x1C + " Items: '", "'📦 Items: '"
# Draft order telegram
$content = $content -replace "':" + [char]0x19 + " Items: '", "'📦 Items: '"
$content = $content -replace "'" + [char]0x19 + " Cart Value: '", "'💰 Cart Value: '"
$content = $content -replace "'" + [char]0x18 + " ' \+ name", "'👤 ' + name"
$content = $content -replace "'" + [char]0x1C + "~ ' \+ phone", "'📞 ' + phone"
Write-Host "Fixed: Telegram message emojis"

# ============================================================
# FIX 10: Promo/coupon message icons
# ============================================================
# '\x1e Coupon removed.' => '✅ Coupon removed.'
$content = $content -replace "msg\.innerHTML = '" + [char]0x1E + " Coupon removed\.'", "msg.innerHTML = '✅ Coupon removed.'"
# ':\x1d Invalid or inactive promo code' => '❌ Invalid or inactive promo code'  
$content = $content -replace "msg\.innerHTML = ':" + [char]0x1D + " Invalid", "msg.innerHTML = '❌ Invalid"
$content = $content -replace "msg\.innerHTML = ':" + [char]0x1D + " This promo", "msg.innerHTML = '❌ This promo"
$content = $content -replace "msg\.innerHTML = ':" + [char]0x1D + " Minimum", "msg.innerHTML = '❌ Minimum"
$content = $content -replace "msg\.innerHTML = ':" + [char]0x1D + " Coupon not valid", "msg.innerHTML = '❌ Coupon not valid"
$content = $content -replace "msg\.innerHTML = ':" + [char]0x1D + " Coupon only valid", "msg.innerHTML = '❌ Coupon only valid"
Write-Host "Fixed: promo/coupon messages"

# ============================================================
# FIX 11: Settings arrow icons in various places
# \x19 used as → arrow in settings paths
# ============================================================
$content = $content -replace "Admin  " + [char]0x19 + " Settings  " + [char]0x19 + " Crypto", "Admin → Settings → Crypto"
$content = $content -replace "Pay  " + [char]0x19 + " History  " + [char]0x19, "Pay → History →"
Write-Host "Fixed: settings arrows"

# ============================================================
# FIX 12: Section comment lines (cosmetic, but cleaner)
# Lines like: // \x1d┐╜\x1d Accordion card builders...
# ============================================================
# These are just comments - clean up the garbage chars
$content = $content -replace '// [\x00-\x1F]+([\x00-\x1F┐╜]*)(.+?)[\x00-\x1F┐╜]*$', '// $2'
Write-Host "Fixed: comment lines"

# Save the fixed file
[System.IO.File]::WriteAllText($filePath, $content, [System.Text.Encoding]::UTF8)
Write-Host ""
Write-Host "✅ File saved successfully!"
Write-Host "Fixed file size: $($content.Length) chars"
