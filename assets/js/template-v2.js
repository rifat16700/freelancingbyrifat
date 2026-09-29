// Template V2 Full Page Engine (Tailwind Based)

function toggleFavorite(e, id) {
    e.preventDefault();
    e.stopPropagation();
    let favs = [];
    try { favs = JSON.parse(localStorage.getItem('wishlist')) || []; } catch(e){}
    let idx = favs.indexOf(id);
    if (idx > -1) {
        favs.splice(idx, 1);
        e.currentTarget.innerHTML = '<i class="fa-regular fa-heart"></i>';
        e.currentTarget.classList.remove('text-red-500');
        e.currentTarget.classList.add('text-secondary');
    } else {
        favs.push(id);
        e.currentTarget.innerHTML = '<i class="fa-solid fa-heart"></i>';
        e.currentTarget.classList.remove('text-secondary');
        e.currentTarget.classList.add('text-red-500');
    }
    localStorage.setItem('wishlist', JSON.stringify(favs));
    if(typeof showToast === 'function') showToast(idx > -1 ? 'Removed from favorites' : 'Added to favorites');
}

function initV2Theme(banners, cats, homeSects) {
    // Hide V1 Elements
    var nav = document.getElementById('mainNavbar');
    if (nav) nav.style.display = 'none';
    
    var main = document.querySelector('main');
    if (main) main.style.display = 'none';
    
    var footer = document.getElementById('mainFooter');
    if (footer) footer.style.display = 'none';
    
    var mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) mobileMenu.style.display = 'none';

    var oldMobileNav = document.querySelector('.mobile-bottom-nav');
    if (oldMobileNav) oldMobileNav.style.display = 'none';

    // Create V2 Wrapper
    var v2Wrap = document.getElementById('v2-theme-wrapper');
    if (!v2Wrap) {
        v2Wrap = document.createElement('div');
        v2Wrap.id = 'v2-theme-wrapper';
        v2Wrap.className = 'w-full bg-white transition-all duration-500 ease-in-out mx-auto relative shadow-sm min-h-screen text-secondary font-lato pb-16 md:pb-0';
        document.body.appendChild(v2Wrap);
    }
    
    renderFullV2Page(v2Wrap, banners, cats, homeSects);
}

function renderFullV2Page(container, paramBanners, cats, homeSects) {
    var storeName = window.globalSettings ? (window.globalSettings.store_name || 'My Store') : 'My Store';
    var email = window.globalSettings ? (window.globalSettings.contact_email || 'contact@store.com') : 'contact@store.com';
    var phone = window.globalSettings ? (window.globalSettings.contact_phone || '') : '';

    var cartCount = 0;
    if (typeof getCart === 'function') {
        var cart = getCart();
        cart.forEach(function(i){ cartCount += i.quantity; });
    }

    let favs = [];
    try { favs = JSON.parse(localStorage.getItem('wishlist')) || []; } catch(e){}

    // --- Banners ---
    var sliderBanners = (paramBanners && paramBanners.length) ? paramBanners : [{
        image_url: 'https://images.unsplash.com/photo-1618220179428-22790b46a0eb?auto=format&fit=crop&w=1920&q=80',
        title: 'Demo Banner',
        link_url: ''
    }];

    var slidesHtml = sliderBanners.map(function(b) {
        var rawLink = (b.link_url || '').trim();
        var linkData = null;
        try { if(rawLink.startsWith('{')) linkData = JSON.parse(rawLink); } catch(e){}
        var fullUrl = linkData ? linkData.url : rawLink;
        if (fullUrl && !fullUrl.startsWith('http') && !fullUrl.startsWith('/') && !fullUrl.startsWith('.')) fullUrl = 'https://' + fullUrl;
        
        var inner = '<img src="' + b.image_url + '" alt="' + (b.title||'') + '" class="w-full h-full object-cover pointer-events-none">';
        if (fullUrl) {
            inner += '<a href="' + fullUrl + '" style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:20;"></a>';
        }
        return '<div class="min-w-full h-full relative flex-shrink-0 slide-v2">' + inner + '</div>';
    }).join('');

    var dotsHtml = sliderBanners.map(function(b, i) {
        return '<button class="slider-dot-v2 w-2 h-2 md:w-3 md:h-3 rounded-full ' + (i===0 ? 'bg-primary' : 'bg-transparent') + ' border-2 border-primary transition-colors cursor-pointer" data-index="'+i+'"></button>';
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
        var favIcon = isFav ? '<i class="fa-solid fa-heart"></i>' : '<i class="fa-regular fa-heart"></i>';
        var favColor = isFav ? 'text-red-500' : 'text-secondary';

        var activeClass = isActive ? 'bg-hover-blue text-white' : 'bg-white';
        var titleColor = isActive ? 'text-white' : 'text-primary';
        var priceColor = isActive ? 'text-white' : 'text-secondary';
        var codeColor = isActive ? 'text-white' : 'text-secondary';
        var dots = isActive ? 
            '<span class="w-2 h-1 md:w-3 md:h-1 bg-[#05E6B7] rounded"></span><span class="w-2 h-1 md:w-3 md:h-1 bg-primary rounded"></span><span class="w-2 h-1 md:w-3 md:h-1 bg-white rounded"></span>' : 
            '<span class="w-2 h-1 md:w-3 md:h-1 bg-[#05E6B7] rounded"></span><span class="w-2 h-1 md:w-3 md:h-1 bg-primary rounded"></span><span class="w-2 h-1 md:w-3 md:h-1 bg-blue-700 rounded"></span>';

        return `
        <a href="product.html?id=${p.id}" class="product-card-hover group shadow-[0_0_15px_rgba(0,0,0,0.08)] rounded-lg transition-all duration-300 relative block bg-white overflow-hidden flex flex-col h-full">
            <div class="bg-gray-50 relative h-[180px] md:h-[280px] flex justify-center items-center overflow-hidden p-4 shrink-0">
                <img src="${img}" alt="${p.name}" class="max-h-full max-w-full object-contain group-hover:scale-110 transition duration-300 mix-blend-multiply">
                
                <!-- Top Right Favorite -->
                <button class="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/80 backdrop-blur shadow flex items-center justify-center hover:bg-white transition ${favColor} z-10" onclick="toggleFavorite(event, '${p.id}')">
                    ${favIcon}
                </button>
                
                ${hasDiscount ? `<div class="absolute top-2 left-2 bg-red-500 text-white text-[10px] md:text-xs font-bold px-2 py-1 rounded">Sale</div>` : ''}
            </div>
            
            <div class="card-bottom p-3 md:p-5 text-center transition-colors duration-300 ${activeClass} flex-grow flex flex-col justify-between">
                <div>
                    <h3 class="font-josefin font-bold text-[13px] md:text-lg ${titleColor} mb-2 line-clamp-2 leading-tight">${p.name}</h3>
                    <div class="flex justify-center gap-1 mb-3">${dots}</div>
                </div>
                
                <div>
                    <p class="text-[10px] md:text-sm ${codeColor} font-josefin mb-2 opacity-70">Code: ${p.id.substring(0,6)}</p>
                    <div class="flex justify-center items-center gap-2">
                        <span class="${priceColor} font-bold font-lato text-[14px] md:text-lg">৳${finalPrice.toFixed(2)}</span>
                        ${hasDiscount ? `<span class="text-[10px] md:text-sm text-gray-400 line-through">৳${price}</span>` : ''}
                    </div>
                </div>
            </div>
            
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
                <button class="bg-primary hover:bg-pink-600 text-white font-bold py-2 px-4 rounded shadow-lg flex items-center gap-2 pointer-events-auto transform translate-y-4 group-hover:translate-y-0 transition-all" onclick="event.preventDefault(); if(typeof quickAddToCart === 'function') quickAddToCart(event, '${p.id}')">
                    <i class="fa-solid fa-cart-plus"></i> Add to Cart
                </button>
            </div>
        </a>`;
    }

    var flashProdsHtml = flashSaleProds.slice(0, 4).map(p => makeCard(p, false)).join('');
    var featuredProdsHtml = otherProds.slice(0, 4).map((p, i) => makeCard(p, i === 1)).join('');
    var allProdsHtml = activeProds.slice(0, 20).map(p => makeCard(p, false)).join('');

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
                    <select class="bg-transparent border-none outline-none cursor-pointer text-white"><option class="text-black">English</option></select>
                    <select class="bg-transparent border-none outline-none cursor-pointer text-white"><option class="text-black">BDT</option></select>
                    <a href="login.html" class="flex items-center gap-1 hover:text-gray-200">Login <i class="fa-regular fa-user"></i></a>
                    <a href="cart.html" class="hover:text-gray-200 relative"><i class="fa-solid fa-cart-shopping"></i> <span class="absolute -top-2 -right-2 bg-primary text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">${cartCount}</span></a>
                </div>
            </div>
        </div>

        <!-- Navbar -->
        <header class="bg-white py-4 md:py-6 sticky top-0 z-50 shadow-sm">
            <div class="container mx-auto px-4 lg:px-24">
                <div class="flex justify-between items-center">
                    <a href="index.html" class="text-2xl md:text-3xl font-bold font-josefin text-secondary flex items-center gap-2">
                        <i class="fa-solid fa-bag-shopping text-primary"></i> ${storeName}
                    </a>
                    <nav class="hidden md:flex gap-4 lg:gap-8 font-lato text-sm lg:text-base items-center">
                        <a href="index.html" class="text-primary font-bold">Home</a>
                        <a href="shop.html" class="hover:text-primary transition-colors">Products</a>
                        <a href="track.html" class="hover:text-primary transition-colors">Track Order</a>
                    </nav>
                    <div class="hidden md:flex w-[200px] lg:w-[300px] border border-gray-300 rounded-md overflow-hidden">
                        <input type="text" id="v2Search" class="px-4 py-1.5 w-full outline-none text-sm" placeholder="Search...">
                        <button class="bg-primary text-white px-4 py-1.5 hover:bg-pink-600 transition" onclick="if(document.getElementById('v2Search').value) window.location.href='shop.html?q='+document.getElementById('v2Search').value"><i class="fa-solid fa-magnifying-glass"></i></button>
                    </div>
                    <!-- Mobile Cart Icon -->
                    <a href="cart.html" class="md:hidden text-secondary hover:text-primary relative text-xl">
                        <i class="fa-solid fa-cart-shopping"></i> 
                        <span class="absolute -top-2 -right-2 bg-primary text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">${cartCount}</span>
                    </a>
                </div>
            </div>
        </header>

        <!-- Hero Slider -->
        <section class="relative w-full h-[220px] sm:h-[350px] md:h-[450px] lg:h-[550px] overflow-hidden group select-none bg-gray-50">
            <div id="sliderTrackV2" class="flex transition-transform duration-500 ease-in-out h-full w-full cursor-grab active:cursor-grabbing">
                ${slidesHtml}
            </div>
            ${sliderBanners.length > 1 ? `
            <button onclick="prevSlideV2()" class="absolute left-2 md:left-8 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-primary w-8 h-8 md:w-12 md:h-12 rounded-full flex justify-center items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 shadow-md z-20 cursor-pointer">
                <i class="fa-solid fa-chevron-left text-sm md:text-xl"></i>
            </button>
            <button onclick="nextSlideV2()" class="absolute right-2 md:right-8 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-primary w-8 h-8 md:w-12 md:h-12 rounded-full flex justify-center items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 shadow-md z-20 cursor-pointer">
                <i class="fa-solid fa-chevron-right text-sm md:text-xl"></i>
            </button>
            <div class="absolute bottom-4 md:bottom-8 left-1/2 transform -translate-x-1/2 flex gap-2 md:gap-3 z-20">
                ${dotsHtml}
            </div>` : ''}
        </section>

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
                    <a href="shop.html" class="inline-block bg-white text-primary border-2 border-primary font-bold py-3 px-8 rounded hover:bg-primary hover:text-white transition duration-300">Browse All Products</a>
                </div>
            </div>
        </section>` : ''}

        <!-- What Shopex Offer -->
        <section class="py-10 md:py-16 bg-white">
            <div class="container mx-auto px-4 lg:px-24">
                <h2 class="text-xl md:text-4xl font-bold font-josefin text-center mb-6 md:mb-12 text-secondary">What ${storeName} Offers!</h2>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-8">
                    <div class="bg-white p-4 md:p-8 text-center shadow-[0_4px_25px_rgba(0,0,0,0.08)] rounded hover:scale-105 transition-transform">
                        <img src="https://cdn-icons-png.flaticon.com/512/411/411776.png" alt="Delivery" class="w-8 h-8 md:w-16 md:h-16 mx-auto mb-2 md:mb-5 opacity-70">
                        <h3 class="text-[12px] md:text-xl font-josefin font-bold text-secondary mb-1 md:mb-4">24/7 Support</h3>
                        <p class="text-gray-400 text-[9px] md:text-sm leading-relaxed font-lato">We are here for you 24/7. Quality support guaranteed.</p>
                    </div>
                    <div class="bg-white p-4 md:p-8 text-center shadow-[0_4px_25px_rgba(0,0,0,0.08)] rounded hover:scale-105 transition-transform">
                        <img src="https://cdn-icons-png.flaticon.com/512/2830/2830305.png" alt="Cashback" class="w-8 h-8 md:w-16 md:h-16 mx-auto mb-2 md:mb-5 opacity-70">
                        <h3 class="text-[12px] md:text-xl font-josefin font-bold text-secondary mb-1 md:mb-4">Cashback</h3>
                        <p class="text-gray-400 text-[9px] md:text-sm leading-relaxed font-lato">Get exclusive cashbacks on your purchases.</p>
                    </div>
                    <div class="bg-white p-4 md:p-8 text-center shadow-[0_4px_25px_rgba(0,0,0,0.08)] rounded hover:scale-105 transition-transform">
                        <img src="https://cdn-icons-png.flaticon.com/512/1067/1067566.png" alt="Quality" class="w-8 h-8 md:w-16 md:h-16 mx-auto mb-2 md:mb-5 opacity-70">
                        <h3 class="text-[12px] md:text-xl font-josefin font-bold text-secondary mb-1 md:mb-4">Premium Quality</h3>
                        <p class="text-gray-400 text-[9px] md:text-sm leading-relaxed font-lato">We ensure the best quality products for our customers.</p>
                    </div>
                    <div class="bg-white p-4 md:p-8 text-center shadow-[0_4px_25px_rgba(0,0,0,0.08)] rounded hover:scale-105 transition-transform">
                        <img src="https://cdn-icons-png.flaticon.com/512/3358/3358864.png" alt="Hours" class="w-8 h-8 md:w-16 md:h-16 mx-auto mb-2 md:mb-5 opacity-70">
                        <h3 class="text-[12px] md:text-xl font-josefin font-bold text-secondary mb-1 md:mb-4">Fast Delivery</h3>
                        <p class="text-gray-400 text-[9px] md:text-sm leading-relaxed font-lato">Super fast delivery inside and outside Dhaka.</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- Minimal Footer for V2 -->
        <footer class="bg-gray-100 py-10">
            <div class="container mx-auto px-4 lg:px-24 text-center">
                <h3 class="text-2xl font-josefin font-bold text-secondary mb-4">${storeName}</h3>
                <p class="text-gray-500 text-sm mb-4">Your trusted shopping destination.</p>
                <div class="flex justify-center gap-4 text-gray-400">
                    <a href="#" class="hover:text-primary"><i class="fa-brands fa-facebook"></i></a>
                    <a href="#" class="hover:text-primary"><i class="fa-brands fa-instagram"></i></a>
                    <a href="#" class="hover:text-primary"><i class="fa-brands fa-youtube"></i></a>
                </div>
                <div class="mt-8 text-xs text-gray-400 mb-6 md:mb-0">© ${new Date().getFullYear()} ${storeName}. All rights reserved.</div>
            </div>
        </footer>

        <!-- Mobile Bottom Nav (V2 Custom) -->
        <div class="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 z-50 flex justify-around items-center py-2 px-1 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
            <a href="index.html" class="flex flex-col items-center text-primary w-1/4">
                <i class="fa-solid fa-house text-lg mb-1"></i>
                <span class="text-[10px] font-bold">Home</span>
            </a>
            <a href="shop.html" class="flex flex-col items-center text-gray-400 hover:text-primary w-1/4 transition-colors">
                <i class="fa-solid fa-store text-lg mb-1"></i>
                <span class="text-[10px] font-bold">Shop</span>
            </a>
            <a href="cart.html" class="flex flex-col items-center text-gray-400 hover:text-primary w-1/4 transition-colors relative">
                <i class="fa-solid fa-cart-shopping text-lg mb-1"></i>
                <span class="text-[10px] font-bold">Cart</span>
                <span class="absolute top-0 right-3 bg-primary text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center">${cartCount}</span>
            </a>
            <a href="profile.html" class="flex flex-col items-center text-gray-400 hover:text-primary w-1/4 transition-colors">
                <i class="fa-regular fa-user text-lg mb-1"></i>
                <span class="text-[10px] font-bold">Profile</span>
            </a>
        </div>
    `;

    if (sliderBanners.length > 1) {
        window.slideIdxV2 = 0;
        window.slideTotalV2 = sliderBanners.length;
        window.startSliderV2();
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
            d.classList.add('bg-primary');
            d.classList.remove('bg-transparent');
        } else {
            d.classList.remove('bg-primary');
            d.classList.add('bg-transparent');
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
