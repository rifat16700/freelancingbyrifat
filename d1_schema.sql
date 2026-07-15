<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page Not Found — 404</title>
    <link rel="stylesheet" href="assets/css/style.css">
    <link rel="stylesheet" href="assets/css/premium-icons.css">
    <script src="https://unpkg.com/@lottiefiles/dotlottie-wc@0.9.10/dist/dotlottie-wc.js" type="module"></script>
    <style>
        body { background: linear-gradient(135deg, #f0f4ff, #e8ecf5); min-height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; font-family: 'Inter', sans-serif; margin: 0; padding: 20px; }
        .error-container { max-width: 450px; width: 100%; background: #fff; border-radius: 24px; padding: 40px 30px; box-shadow: 0 20px 40px rgba(0,0,0,0.08); animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
        .error-anim { width: 220px; height: 220px; margin: 0 auto 10px; }
        .error-title { font-size: 24px; font-weight: 900; color: #111; margin-bottom: 10px; }
        .error-desc { font-size: 15px; color: #666; margin-bottom: 30px; line-height: 1.6; }
        .btn-continue { display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: linear-gradient(135deg, var(--primary, #8B1A1A), var(--primary-dark, #5C1111)); color: #fff; text-decoration: none; font-weight: 700; padding: 14px 28px; border-radius: 12px; font-size: 15px; transition: 0.3s; box-shadow: 0 8px 20px rgba(139,26,26,0.25); border: none; cursor: pointer; }
        .btn-continue:hover { transform: translateY(-3px); box-shadow: 0 12px 25px rgba(139,26,26,0.35); }
        @keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body>

<div class="error-container">
    <div class="error-anim">
        <!-- Awesome 404 Search/Magnifying Glass Lottie -->
        <dotlottie-wc src="https://lottie.host/80c2cf50-8b0d-42bc-a22d-304bfaeeb58d/FvLg6L4y0B.lottie" autoplay loop></dotlottie-wc>
    </div>
    <h1 class="error-title">Oops! Not Found</h1>
    <p class="error-desc">The page or product you are looking for doesn't exist or has been removed.</p>
    <a href="shop.html" class="btn-continue">
        <i data-lucide="shopping-bag" style="width:20px;height:20px;"></i>
        Continue Shopping
    </a>
</div>

<script src="https://unpkg.com/lucide@latest"></script>
<script>
    if (typeof lucide !== 'undefined') lucide.createIcons();
    // Fallback if lottie fails to load
    setTimeout(function() {
        var lottieEl = document.querySelector('dotlottie-wc');
        if (!lottieEl.shadowRoot && !lottieEl.innerHTML) {
            document.querySelector('.error-anim').innerHTML = '<div style="font-size:80px;line-height:220px;">🕵️‍♂️</div>';
        }
    }, 3000);
</script>
</body>
</html>



