// Template V2 Full Page Engine (Tailwind Based)

function initV2Theme() {
    // Hide V1 Elements
    var nav = document.getElementById('mainNavbar');
    if (nav) nav.style.display = 'none';
    
    var main = document.querySelector('main');
    if (main) main.style.display = 'none';
    
    var footer = document.getElementById('mainFooter');
    if (footer) footer.style.display = 'none';
    
    var mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenu) mobileMenu.style.display = 'none';

    // Create V2 Wrapper
    var v2Wrap = document.getElementById('v2-theme-wrapper');
    if (!v2Wrap) {
        v2Wrap = document.createElement('div');
        v2Wrap.id = 'v2-theme-wrapper';
        v2Wrap.className = 'w-full bg-white transition-all duration-500 ease-in-out mx-auto relative shadow-sm min-h-screen text-secondary font-lato';
        document.body.appendChild(v2Wrap);
    }
    
    renderFullV2Page(v2Wrap);
}

function renderFullV2Page(container) {
    var storeName = window.globalSettings ? (window.globalSettings.store_name || 'My Store') : 'My Store';
    var email = window.globalSettings ? (window.globalSettings.contact_email || 'contact@store.com') : 'contact@store.com';
    var phone = window.globalSettings ? (window.globalSettings.contact_phone || '') : '';

    var cartCount = 0;
    if (typeof getCart === 'function') {
        var cart = getCart();
        cart.forEach(function(i){ cartCount += i.quantity; });
    }

    // --- Banners ---
    var sliderBanners = (typeof banners !== 'undefined' && banners && banners.length) ? banners : [{
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
    
    function makeCard(p, isActive) {
        var img = (p.gallery_images && p.gallery_images[0]) ? p.gallery_images[0] : 'assets/images/placeholder.jpg';
        var price = parseFloat(p.price || p.base_price || 0).toFixed(2);
        var activeClass = isActive ? 'bg-hover-blue text-white' : 'bg-white';
        var titleColor = isActive ? 'text-white' : 'text-primary';
        var priceColor = isActive ? 'text-white' : 'text-secondary';
        var codeColor = isActive ? 'text-white' : 'text-secondary';
        var dots = isActive ? 
            '<span class="w-2 h-1 md:w-3 md:h-1 bg-[#05E6B7] rounded"></span><span class="w-2 h-1 md:w-3 md:h-1 bg-primary rounded"></span><span class="w-2 h-1 md:w-3 md:h-1 bg-white rounded"></span>' : 
            '<span class="w-2 h-1 md:w-3 md:h-1 bg-[#05E6B7] rounded"></span><span class="w-2 h-1 md:w-3 md:h-1 bg-primary rounded"></span><span class="w-2 h-1 md:w-3 md:h-1 bg-blue-700 rounded"></span>';

        return `
        <a href="product.html?id=${p.id}" class="product-card-hover group shadow-[0_0_15px_rgba(0,0,0,0.1)] rounded transition-all duration-300 relative block bg-white">
            <div class="bg-gray-100 relative h-[150px] md:h-[250px] flex justify-center items-center overflow-hidden p-2 md:p-4">
                <img src="${img}" alt="${p.name}" class="h-4/5 object-contain group-hover:scale-110 transition duration-300 mix-blend-multiply">
                <div class="hover-icons absolute top-2 left-2 md:top-3 md:left-3 flex md:flex-row flex-col gap-1 md:gap-2">
                    <div class="w-6 h-6 md:w-8 md:h-8 rounded-full bg-white text-blue-900 flex justify-center items-center hover:bg-gray-200" onclick="event.preventDefault(); if(typeof quickAddToCart === 'function') quickAddToCart(event, '${p.id}')"><i class="fa-solid fa-cart-shopping text-[10px] md:text-sm"></i></div>
                </div>
                <div class="hover-icons absolute bottom-2 md:bottom-4 bg-green-500 text-white text-[10px] md:text-xs font-josefin py-1 md:py-2 px-2 md:px-4 rounded w-[90%] md:w-[120px] text-center">View Details</div>
            </div>
            <div class="card-bottom p-3 md:p-5 text-center transition-colors duration-300 ${activeClass}">
                <h3 class="font-josefin font-bold text-[12px] md:text-lg ${titleColor} mb-1 md:mb-2 truncate">${p.name}</h3>
                <div class="flex justify-center gap-1 mb-1 md:mb-3">${dots}</div>
                <p class="text-[10px] md:text-sm ${codeColor} font-josefin mb-1 md:mb-2">Code - ${p.id.substring(0,6)}</p>
                <span class="${priceColor} font-lato text-[12px] md:text-base">৳${price}</span>
            </div>
        </a>`;
    }

    var featuredProdsHtml = activeProds.slice(0, 4).map((p, i) => makeCard(p, i === 1)).join('');
    if(!featuredProdsHtml) featuredProdsHtml = '<div class="col-span-4 text-center py-10 text-gray-500">No products available.</div>';

    var latestProdsHtml = activeProds.slice(4, 10).map(p => {
        var img = (p.gallery_images && p.gallery_images[0]) ? p.gallery_images[0] : 'assets/images/placeholder.jpg';
        var price = parseFloat(p.price || p.base_price || 0).toFixed(2);
        var strike = (p.compare_price > p.price) ? `<span class="text-primary font-lato line-through hidden sm:inline">৳${parseFloat(p.compare_price).toFixed(2)}</span>` : '';
        return `
        <a href="product.html?id=${p.id}" class="group block">
            <div class="bg-gray-50 h-[150px] md:h-[300px] relative flex justify-center items-center transition hover:bg-white hover:shadow-lg rounded overflow-hidden">
                <img src="${img}" alt="${p.name}" class="h-3/4 object-contain mix-blend-multiply">
                <div class="absolute bottom-2 left-2 flex flex-col gap-1 md:gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div class="w-6 h-6 md:w-8 md:h-8 rounded-full bg-white shadow text-secondary hover:bg-gray-100 flex items-center justify-center" onclick="event.preventDefault(); if(typeof quickAddToCart === 'function') quickAddToCart(event, '${p.id}')"><i class="fa-solid fa-cart-shopping text-[10px] md:text-sm"></i></div>
                </div>
            </div>
            <div class="flex justify-between items-center mt-2 md:mt-4 px-1">
                <h3 class="font-josefin text-secondary font-semibold text-[11px] md:text-lg border-b-2 border-white group-hover:border-primary transition-colors truncate w-[60%]">${p.name}</h3>
                <div class="flex gap-1 md:gap-2 text-[10px] md:text-sm">
                    <span class="text-secondary font-lato">৳${price}</span>
                    ${strike}
                </div>
            </div>
        </a>`;
    }).join('');

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
                    <a href="index.html" class="text-3xl font-bold font-josefin text-secondary">${storeName}</a>
                    <nav class="hidden md:flex gap-4 lg:gap-8 font-lato text-sm lg:text-base items-center">
                        <a href="index.html" class="text-primary font-bold">Home</a>
                        <a href="shop.html" class="hover:text-primary transition-colors">Products</a>
                        <a href="track.html" class="hover:text-primary transition-colors">Track Order</a>
                    </nav>
                    <div class="hidden md:flex w-[200px] lg:w-[300px] border border-gray-300 rounded-md overflow-hidden">
                        <input type="text" id="v2Search" class="px-4 py-1.5 w-full outline-none text-sm" placeholder="Search...">
                        <button class="bg-primary text-white px-4 py-1.5 hover:bg-pink-600 transition" onclick="if(document.getElementById('v2Search').value) window.location.href='shop.html?q='+document.getElementById('v2Search').value"><i class="fa-solid fa-magnifying-glass"></i></button>
                    </div>
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

        <!-- Featured Products -->
        <section class="py-10 md:py-20">
            <div class="container mx-auto px-4 lg:px-24">
                <h2 class="text-xl md:text-4xl font-bold font-josefin text-center mb-6 md:mb-12 text-secondary">Featured Products</h2>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-8">
                    ${featuredProdsHtml}
                </div>
            </div>
        </section>

        <!-- Latest Products -->
        ${latestProdsHtml ? `
        <section class="py-10 md:py-16">
            <div class="container mx-auto px-4 lg:px-24">
                <h2 class="text-xl md:text-4xl font-bold font-josefin text-center mb-4 md:mb-6 text-secondary">Latest Products</h2>
                <ul class="flex justify-center gap-3 md:gap-12 mb-6 md:mb-12 font-lato text-secondary text-[10px] md:text-base flex-wrap">
                    <li class="text-primary border-b-2 border-primary cursor-pointer hover:text-primary transition">New Arrival</li>
                    <li class="cursor-pointer hover:text-primary transition"><a href="shop.html">Best Seller</a></li>
                </ul>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-8">
                    ${latestProdsHtml}
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
        <footer class="bg-gray-100 py-10 mt-10">
            <div class="container mx-auto px-4 lg:px-24 text-center">
                <h3 class="text-2xl font-josefin font-bold text-secondary mb-4">${storeName}</h3>
                <p class="text-gray-500 text-sm mb-4">Your trusted shopping destination.</p>
                <div class="flex justify-center gap-4 text-gray-400">
                    <a href="#" class="hover:text-primary"><i class="fa-brands fa-facebook"></i></a>
                    <a href="#" class="hover:text-primary"><i class="fa-brands fa-instagram"></i></a>
                    <a href="#" class="hover:text-primary"><i class="fa-brands fa-youtube"></i></a>
                </div>
                <div class="mt-8 text-xs text-gray-400">© ${new Date().getFullYear()} ${storeName}. All rights reserved.</div>
            </div>
        </footer>
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
