// Template V2 Full Page Engine (Tailwind Based)

function toggleFavorite(e, id, name, price, image) {
    e.preventDefault();
    e.stopPropagation();
    let favs = [];
    try { favs = JSON.parse(localStorage.getItem('wishlist')) || []; } catch(e){}
    
    // Check if favs contains string IDs (old format) or objects (new format)
    let idx = favs.findIndex(f => (typeof f === 'string' ? f === id : f.id === id));
    
    if (idx > -1) {
        favs.splice(idx, 1);
        e.currentTarget.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>';
        e.currentTarget.classList.remove('text-red-500');
        e.currentTarget.classList.add('text-gray-500');
    } else {
        favs.push({id: id, name: name, price: price, image: image});
        e.currentTarget.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" /></svg>';
        e.currentTarget.classList.remove('text-gray-500');
        e.currentTarget.classList.add('text-red-500');
    }
    localStorage.setItem('wishlist', JSON.stringify(favs));
    if(typeof showToast === 'function') showToast(idx > -1 ? 'Removed from favorites' : 'Added to favorites');
}

function setDynamicContrast() {
    var primary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#8B1A1A';
    var r = 0, g = 0, b = 0;
    if (primary.startsWith('#')) {
        var hex = primary.replace('#','');
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        r = parseInt(hex.substring(0,2), 16) || 0;
        g = parseInt(hex.substring(2,4), 16) || 0;
        b = parseInt(hex.substring(4,6), 16) || 0;
    } else if (primary.startsWith('rgb')) {
        var parts = primary.match(/\d+/g);
        if(parts && parts.length >= 3) { r = parseInt(parts[0]); g = parseInt(parts[1]); b = parseInt(parts[2]); }
    }
    var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    var contrastColor = luminance > 0.5 ? '#1A1A1A' : '#FFFFFF';
    document.documentElement.style.setProperty('--primary-contrast', contrastColor);
    if (!document.getElementById('dynamic-contrast-style')) {
        var s = document.createElement('style');
        s.id = 'dynamic-contrast-style';
        s.innerHTML = '.hover-dynamic-text:hover { color: var(--primary-contrast) !important; } .text-dynamic { color: var(--primary-contrast) !important; }';
        document.head.appendChild(s);
    }
}

function initV2Theme(banners, cats, homeSects) {
    setDynamicContrast();
    // Hide V1 Elements
    var nav = document.getElementById('mainNavbar');
    if (nav) nav.style.display = 'none';
    
    var main = document.querySelector('main');
    if (main) main.style.display = 'none';
    
    var footer = document.getElementById('mainFooter');
    
    var mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) mobileMenu.style.display = 'none';

    var oldMobileNav = document.querySelector('.mobile-bottom-nav');
    if (oldMobileNav) oldMobileNav.style.display = 'none';

    // Create V2 Wrapper
    var v2Wrap = document.getElementById('v2-theme-wrapper');
    if (!v2Wrap) {
        v2Wrap = document.createElement('div');
        v2Wrap.id = 'v2-theme-wrapper';
        v2Wrap.className = 'w-full bg-white transition-all duration-500 ease-in-out mx-auto relative shadow-sm min-h-screen text-secondary font-lato';
        document.body.appendChild(v2Wrap);
    }
    
    renderFullV2Page(v2Wrap, banners, cats, homeSects);

    // Show the real site footer at the bottom of the V2 page
    if (footer) {
        footer.style.display = '';
        footer.style.marginTop = '0';
        v2Wrap.appendChild(footer);
    }
}

function renderFullV2Page(container, paramBanners, cats, homeSects) {
    var sSettings = window.siteSettings || window.globalSettings || {};
    var storeName = sSettings.store_name || (typeof CONFIG !== 'undefined' ? CONFIG.STORE_NAME : 'My Store');
    var email = sSettings.contact_email || 'contact@store.com';
    var phone = sSettings.contact_phone || '';

    var cartCount = 0;
    if (typeof getCart === 'function') {
        var cart = getCart();
        cart.forEach(function(i){ cartCount += i.quantity; });
    }

    let favs = [];
    try { favs = JSON.parse(localStorage.getItem('wishlist')) || []; } catch(e){}

    // --- Banners ---
    var useHardcodedTestBanners = true; // Set to false to use DB banners
    var sliderBanners = [];

    if (useHardcodedTestBanners) {
        sliderBanners = [
            { image_url: 'https://img.freelancingbyrifat.top/IMLda2WunoL4s.png', title: 'Test 1', link_url: '' },
            { image_url: 'https://img.freelancingbyrifat.top/IMJ7Q9Qgc737Q.png', title: 'Test 2', link_url: '' }
        ];
    } else {
        sliderBanners = (paramBanners && paramBanners.length) ? paramBanners : [{
            image_url: 'https://images.unsplash.com/photo-1618220179428-22790b46a0eb?auto=format&fit=crop&w=1920&q=80',
            title: 'Demo Banner',
            link_url: ''
        }];
    }

    var slidesHtml = sliderBanners.map(function(b) {
        var rawLink = (b.link_url || '').trim();
        var linkData = null;
        try { if(rawLink.startsWith('{')) linkData = JSON.parse(rawLink); } catch(e){}
        var fullUrl = linkData ? linkData.url : rawLink;
        if (fullUrl && !fullUrl.startsWith('http') && !fullUrl.startsWith('/') && !fullUrl.startsWith('.')) fullUrl = 'https://' + fullUrl;
        
        var inner = '<div class="w-full h-[25vh] md:h-[35vh] lg:h-[40vh] relative bg-[#f5f5f5] overflow-hidden"><img src="' + b.image_url + '" alt="' + (b.title||'') + '" style="width: 100% !important; height: 100% !important; object-fit: contain !important; pointer-events: none;" class="w-full h-full pointer-events-none"></div>';
        if (fullUrl) {
            inner += '<a href="' + fullUrl + '" style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:20;"></a>';
        }
        return '<div class="min-w-full relative flex-shrink-0 flex items-center justify-center slide-v2 bg-transparent">' + inner + '</div>';
    }).join('');

    var dotsHtml = sliderBanners.map(function(b, i) {
        return '<button class="slider-dot-v2 w-2 h-2 md:w-3 md:h-3 rounded-full transition-colors cursor-pointer" data-index="'+i+'" style="border: 2px solid var(--primary); background: ' + (i===0 ? 'var(--primary)' : 'transparent') + '"></button>';
    }).join('');

    // --- Products ---
    var activeProds = (typeof allProducts !== 'undefined') ? allProducts : [];
    
    // Categorize Products
    var flashSaleProds = activeProds.filter(p => p.flash_sale_price > 0);
    var otherProds = activeProds.filter(p => !(p.flash_sale_price > 0));

    function makeCard(p, isActive) {
        var img = (p.gallery_images && p.gallery_images[0]) ? p.gallery_images[0] : 'assets/images/placeholder.jpg';
        var price = parseFloat(p.price || p.base_price || 0).toFixed(2);
        
        var finalPrice = parseFloat(p.base_price || p.price || 0);
        var hasDiscount = p.flash_sale_price > 0;
        if (hasDiscount) finalPrice = finalPrice - parseFloat(p.flash_sale_price);
        
        var isFav = favs.includes(p.id);
        var favIcon = isFav ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 md:h-5 md:w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" /></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>';
        var favColor = isFav ? 'text-red-500' : 'text-gray-500';

        var activeClass = isActive ? 'bg-hover-blue text-white' : 'bg-white';
        var titleColor = isActive ? 'text-white' : 'text-primary';
        var priceColor = isActive ? 'text-white' : 'text-secondary';
        var codeColor = isActive ? 'text-white' : 'text-secondary';

        return `
        <a href="product.html?id=${p.id}" class="product-card-hover group shadow-md hover:shadow-lg rounded-lg transition-all duration-300 relative block bg-white overflow-hidden flex flex-col h-full border border-gray-100">
            <div class="relative h-[160px] md:h-[250px] w-full overflow-hidden shrink-0">
                <img src="${img}" alt="${p.name}" width="300" height="300" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                
                <!-- Top Right Favorite -->
                <button aria-label="Add to Wishlist" class="absolute top-2 right-2 w-7 h-7 md:w-8 md:h-8 rounded-full bg-white/90 backdrop-blur shadow flex items-center justify-center hover:bg-white transition ${favColor} z-10" onclick="toggleFavorite(event, '${p.id}', '${p.name.replace(/'/g, "\\'")}', '${p.sale_price || p.price}', '${img}')">
                    ${favIcon}
                </button>
                
                ${hasDiscount ? `<div class="absolute top-2 left-2 bg-red-700 text-white text-[9px] md:text-xs font-bold px-2 py-1 rounded shadow">Sale</div>` : ''}

                <!-- Add to Cart (Permanent Mobile & PC) -->
                <button aria-label="Add to Cart" class="absolute bottom-2 right-2 w-8 h-8 md:w-10 md:h-10 text-dynamic rounded-full shadow-lg flex items-center justify-center z-10 transition-transform duration-300 hover:scale-110" style="background: var(--primary);" onclick="event.preventDefault(); if(typeof quickAddToCart === 'function') quickAddToCart(event, '${p.id}')">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </button>
            </div>
            
            <div class="p-3 md:p-4 text-left transition-colors duration-300 ${activeClass} flex-grow flex flex-col justify-between">
                <div>
                    <h3 class="font-josefin font-bold text-[12px] md:text-base ${titleColor} mb-1 line-clamp-2 leading-snug">${p.name}</h3>
                    <p class="text-[9px] md:text-xs ${codeColor} font-josefin mb-2 opacity-80">Code: ${p.id.substring(0,6)}</p>
                </div>
                
                <div class="flex items-center gap-2 mt-auto">
                    <span class="${priceColor} font-bold font-lato text-[14px] md:text-lg">৳${finalPrice.toFixed(2)}</span>
                    ${hasDiscount ? `<span class="text-[10px] md:text-xs text-gray-500 line-through">৳${price}</span>` : ''}
                </div>
            </div>
        </a>`;
    }

    var flashProdsHtml = flashSaleProds.slice(0, 4).map(p => makeCard(p, false)).join('');
    var featuredProdsHtml = otherProds.slice(0, 4).map((p, i) => makeCard(p, i === 1)).join('');
    var allProdsHtml = activeProds.slice(0, 20).map(p => makeCard(p, false)).join('');

    // --- Categories ---
    var catsHtml = '';
    if (cats && cats.length) {
        var catItems = cats.map(function(c) {
            var iconUrl = (c.icon_url || c.image_url || '').trim();
            var catImg = '';
            if (iconUrl.startsWith('<')) {
                catImg = `<div class="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gray-100 flex items-center justify-center text-primary shadow-sm mb-2 group-hover:scale-110 transition-transform overflow-hidden [&>svg]:w-6 [&>svg]:h-6 md:[&>svg]:w-8 md:[&>svg]:h-8">${iconUrl}</div>`;
            } else if (iconUrl) {
                catImg = `<img src="${iconUrl}" alt="${c.name}" width="64" height="64" class="w-12 h-12 md:w-16 md:h-16 object-cover rounded-full shadow-sm mb-2 group-hover:scale-110 transition-transform">`;
            } else {
                catImg = `<div class="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 shadow-sm mb-2 group-hover:scale-110 transition-transform"><i class="fa-solid fa-list"></i></div>`;
            }
            return `
            <a href="shop.html?category=${c.id}" class="flex flex-col items-center min-w-[70px] md:min-w-[100px] group flex-shrink-0">
                ${catImg}
                <span class="text-[10px] md:text-sm font-bold text-center text-secondary group-hover:text-primary line-clamp-1">${c.name}</span>
            </a>
            `;
        }).join('');
        
        catsHtml = `
        <section class="py-6 md:py-10 bg-white border-b border-gray-100">
            <div class="container mx-auto px-4 lg:px-24">
                <div class="flex justify-between items-center mb-4 md:mb-6">
                    <h2 class="text-lg md:text-2xl font-bold font-josefin text-secondary">Categories</h2>
                </div>
                <div class="flex overflow-x-auto gap-4 md:gap-8 pb-4 hide-scrollbar cursor-grab active:cursor-grabbing" style="scrollbar-width: none; -ms-overflow-style: none;">
                    ${catItems}
                </div>
            </div>
        </section>
        `;
    }

    container.innerHTML = `
        <!-- Top Bar -->
        <div class="bg-top-bar text-white py-2 text-sm font-josefin hidden md:block">
            <div class="container mx-auto px-4 lg:px-24 flex justify-between items-center">
                <div class="flex gap-6">
                    <a href="mailto:${email}" class="flex items-center gap-2 hover:text-gray-200">
                        <i class="fa-regular fa-envelope"></i> ${email}
                    </a>
                    ${phone ? `<a href="tel:${phone}" class="flex items-center gap-2 hover:text-gray-200"><i class="fa-solid fa-phone-volume"></i> ${phone}</a>` : ''}
                </div>
                <div class="flex gap-4 items-center">
                    <select aria-label="Language" class="bg-transparent border-none outline-none cursor-pointer text-white"><option class="text-black">English</option></select>
                    <select aria-label="Currency" class="bg-transparent border-none outline-none cursor-pointer text-white"><option class="text-black">BDT</option></select>
                    <a href="login.html" class="flex items-center gap-1 hover:text-gray-200">Login <i class="fa-regular fa-user"></i></a>
                    <a href="cart.html" class="hover:text-gray-200 relative"><i class="fa-solid fa-cart-shopping"></i> <span class="absolute -top-2 -right-2 bg-primary text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">${cartCount}</span></a>
                </div>
            </div>
        </div>

        <!-- Navbar -->
        <header class="bg-white py-3 md:py-4 sticky top-0 z-50 shadow-sm">
            <div class="container mx-auto px-4 lg:px-24">
                <!-- Mobile: Row 1 (Logo/Name + Icons), Row 2 (Search) -->
                <!-- Desktop: Logo/Name + Search + Icons -->
                <div class="flex flex-wrap items-center justify-between gap-y-3">
                    
                    <!-- Logo & Store Name -->
                    <a href="index.html" class="flex items-center gap-2 text-xl md:text-2xl font-bold font-josefin text-secondary shrink-0">
                        ${(window.globalSettings && window.globalSettings.store_logo) ? `<img src="${window.globalSettings.store_logo}" alt="Logo" class="h-6 md:h-8 object-contain">` : `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 md:h-8 md:w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>`}
                        <span class="truncate max-w-[120px] md:max-w-[200px]">${storeName}</span>
                    </a>

                    <!-- Desktop Search -->
                    <div class="hidden md:flex flex-grow justify-center px-4">
                        <div class="flex w-full max-w-[400px] border border-gray-300 rounded-md overflow-hidden">
                            <input type="text" id="v2SearchDesktop" class="px-4 py-1.5 w-full outline-none text-sm" placeholder="Search...">
                            <button aria-label="Search" class="text-dynamic px-4 py-1.5 transition hover:opacity-90" style="background: var(--primary);" onclick="if(document.getElementById('v2SearchDesktop').value) window.location.href='shop.html?q='+document.getElementById('v2SearchDesktop').value"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></button>
                        </div>
                    </div>

                    <!-- Desktop & Mobile Icons (Profile, Track, Cart) -->
                    <div class="flex items-center gap-4 md:gap-6">
                        <a href="profile.html" aria-label="Profile" class="text-secondary text-lg flex flex-col items-center group transition-colors" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color=''">
                            <i data-lucide="user" class="lucide-icon group-hover:scale-110 transition-transform" style="width:24px;height:24px;"></i>
                        </a>
                        <a href="track.html" aria-label="Track Order" class="text-secondary text-lg flex flex-col items-center group transition-colors" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color=''">
                            <i data-lucide="package" class="lucide-icon icon-bounce group-hover:scale-110 transition-transform" style="width:24px;height:24px;"></i>
                        </a>
                        <a href="cart.html" aria-label="Cart" class="text-secondary relative text-lg flex flex-col items-center group transition-colors" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color=''">
                            <i data-lucide="shopping-cart" class="lucide-icon icon-bounce group-hover:scale-110 transition-transform" style="width:24px;height:24px;"></i>
                            <span class="cart-badge-v2 absolute -top-2 -right-2 text-dynamic text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center" style="background: var(--primary); display:${cartCount > 0 ? 'flex' : 'none'}">${cartCount}</span>
                        </a>
                    </div>

                    <!-- Mobile Search Bar (Row 2) -->
                    <div class="w-full md:hidden flex border border-gray-300 rounded-md overflow-hidden mt-1">
                        <input type="text" id="v2SearchMobile" class="px-4 py-2 w-full outline-none text-sm" placeholder="Search products...">
                        <button aria-label="Search" class="text-dynamic px-4 py-2 transition hover:opacity-90" style="background: var(--primary);" onclick="if(document.getElementById('v2SearchMobile').value) window.location.href='shop.html?q='+document.getElementById('v2SearchMobile').value"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></button>
                    </div>

                </div>
            </div>
        </header>

        <main>

        <!-- Hero Slider (No Fixed Height) -->
        <section class="relative w-full overflow-hidden group select-none bg-gray-50 flex items-center justify-center">
            <div id="sliderTrackV2" class="flex transition-transform duration-500 ease-in-out h-full w-full cursor-grab active:cursor-grabbing">
                ${slidesHtml}
            </div>
            ${sliderBanners.length > 1 ? `
            <button onclick="prevSlideV2()" class="absolute left-2 md:left-8 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-primary w-8 h-8 md:w-12 md:h-12 rounded-full flex justify-center items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 shadow-md z-20 cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onclick="nextSlideV2()" class="absolute right-2 md:right-8 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-primary w-8 h-8 md:w-12 md:h-12 rounded-full flex justify-center items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 shadow-md z-20 cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
            </button>
            <div class="absolute bottom-4 md:bottom-8 left-1/2 transform -translate-x-1/2 flex gap-2 md:gap-3 z-20">
                ${dotsHtml}
            </div>` : ''}
        </section>

        ${catsHtml}

        <!-- Flash Deals -->
        ${flashProdsHtml ? `
        <section class="py-10 md:py-20 bg-[#FFF5F5]">
            <div class="container mx-auto px-4 lg:px-24">
                <div class="flex justify-between items-center mb-6 md:mb-10">
                    <h2 class="text-xl md:text-3xl font-bold font-josefin text-secondary flex items-center gap-2">
                        <i class="fa-solid fa-bolt text-yellow-500"></i> Flash Deals
                    </h2>
                    <a href="shop.html?sale=true" class="text-primary text-sm md:text-base font-bold hover:underline">View All <i class="fa-solid fa-arrow-right ml-1"></i></a>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                    ${flashProdsHtml}
                </div>
            </div>
        </section>` : ''}

        <!-- Featured Products -->
        ${featuredProdsHtml ? `
        <section class="py-10 md:py-20">
            <div class="container mx-auto px-4 lg:px-24">
                <div class="flex justify-between items-center mb-6 md:mb-10">
                    <h2 class="text-xl md:text-3xl font-bold font-josefin text-secondary">Featured Products</h2>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                    ${featuredProdsHtml}
                </div>
            </div>
        </section>` : ''}

        <!-- All Products -->
        ${allProdsHtml ? `
        <section class="py-10 md:py-16 bg-gray-50">
            <div class="container mx-auto px-4 lg:px-24">
                <div class="flex justify-between items-center mb-6 md:mb-10">
                    <h2 class="text-xl md:text-3xl font-bold font-josefin text-secondary">All Products</h2>
                    <a href="shop.html" class="text-primary text-sm md:text-base font-bold hover:underline">View All <i class="fa-solid fa-arrow-right ml-1"></i></a>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
                    ${allProdsHtml}
                </div>
                <div class="text-center mt-10">
                    <a href="shop.html" class="inline-block bg-white font-bold py-3 px-8 rounded transition duration-300" style="color: var(--primary); border: 2px solid var(--primary);" onmouseover="this.style.backgroundColor='var(--primary)'; this.style.color='var(--primary-contrast)';" onmouseout="this.style.backgroundColor='white'; this.style.color='var(--primary)';">Browse All Products</a>
                </div>
            </div>
        </section>` : ''}

        <!-- What Shopex Offer -->
        <section class="py-10 md:py-16 bg-white">
            <div class="container mx-auto px-4 lg:px-24">
                <h2 class="text-xl md:text-4xl font-bold font-josefin text-center mb-6 md:mb-12 text-secondary">What ${storeName} Offers!</h2>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-8">
                    <div class="bg-white p-4 md:p-8 text-center shadow-[0_4px_25px_rgba(0,0,0,0.08)] rounded hover:scale-105 transition-transform">
                        <img src="https://cdn-icons-png.flaticon.com/512/411/411776.png" alt="Delivery" width="64" height="64" class="w-8 h-8 md:w-16 md:h-16 mx-auto mb-2 md:mb-5 opacity-70">
                        <h3 class="text-[12px] md:text-xl font-josefin font-bold text-secondary mb-1 md:mb-4">24/7 Support</h3>
                        <p class="text-gray-500 text-[9px] md:text-sm leading-relaxed font-lato">We are here for you 24/7. Quality support guaranteed.</p>
                    </div>
                    <div class="bg-white p-4 md:p-8 text-center shadow-[0_4px_25px_rgba(0,0,0,0.08)] rounded hover:scale-105 transition-transform">
                        <img src="https://cdn-icons-png.flaticon.com/512/2830/2830305.png" alt="Cashback" width="64" height="64" class="w-8 h-8 md:w-16 md:h-16 mx-auto mb-2 md:mb-5 opacity-70">
                        <h3 class="text-[12px] md:text-xl font-josefin font-bold text-secondary mb-1 md:mb-4">Cashback</h3>
                        <p class="text-gray-500 text-[9px] md:text-sm leading-relaxed font-lato">Get exclusive cashbacks on your purchases.</p>
                    </div>
                    <div class="bg-white p-4 md:p-8 text-center shadow-[0_4px_25px_rgba(0,0,0,0.08)] rounded hover:scale-105 transition-transform">
                        <img src="https://cdn-icons-png.flaticon.com/512/1067/1067566.png" alt="Quality" width="64" height="64" class="w-8 h-8 md:w-16 md:h-16 mx-auto mb-2 md:mb-5 opacity-70">
                        <h3 class="text-[12px] md:text-xl font-josefin font-bold text-secondary mb-1 md:mb-4">Premium Quality</h3>
                        <p class="text-gray-500 text-[9px] md:text-sm leading-relaxed font-lato">We ensure the best quality products for our customers.</p>
                    </div>
                    <div class="bg-white p-4 md:p-8 text-center shadow-[0_4px_25px_rgba(0,0,0,0.08)] rounded hover:scale-105 transition-transform">
                        <img src="https://cdn-icons-png.flaticon.com/512/3358/3358864.png" alt="Hours" width="64" height="64" class="w-8 h-8 md:w-16 md:h-16 mx-auto mb-2 md:mb-5 opacity-70">
                        <h3 class="text-[12px] md:text-xl font-josefin font-bold text-secondary mb-1 md:mb-4">Fast Delivery</h3>
                        <p class="text-gray-500 text-[9px] md:text-sm leading-relaxed font-lato">Super fast delivery inside and outside Dhaka.</p>
                    </div>
                </div>
            </div>
        </section>

        </main>

    `;

    if (sliderBanners.length > 1) {
        window.slideIdxV2 = 0;
        window.slideTotalV2 = sliderBanners.length;
        window.startSliderV2();
    }

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// Slider Logic
window.slideIdxV2 = 0;
window.slideTotalV2 = 0;
window.slideTimerV2 = null;

function updateSliderV2() {
    var track = document.getElementById('sliderTrackV2');
    if (track) track.style.transform = 'translateX(-' + (window.slideIdxV2 * 100) + '%)';
    document.querySelectorAll('.slider-dot-v2').forEach(function(d, i) {
        if (i === window.slideIdxV2) {
            d.style.background = 'var(--primary)';
        } else {
            d.style.background = 'transparent';
        }
    });
}
function nextSlideV2() {
    window.slideIdxV2 = (window.slideIdxV2 + 1) % window.slideTotalV2;
    updateSliderV2();
}
function prevSlideV2() {
    window.slideIdxV2 = (window.slideIdxV2 - 1 + window.slideTotalV2) % window.slideTotalV2;
    updateSliderV2();
}
function startSliderV2() {
    clearInterval(window.slideTimerV2);
    window.slideTimerV2 = setInterval(nextSlideV2, 4000);
}
