// ============================================================
// imgbb-uploader.js — ImgBB Image Upload Utility
// Project: Freelancing By Rifat E-Commerce
// Usage: imgbbUpload(file, apiKey) → Promise<{ url, thumb, delete_url }>
// ============================================================

/**
 * ImgBB তে একটি ছবি আপলোড করে।
 * @param {File} file - ফাইল ইনপুট থেকে পাওয়া File object
 * @param {string} apiKey - ImgBB API Key (imgbb.com/api থেকে পাবে)
 * @returns {Promise<{url:string, thumb:string, delete_url:string}>}
 */
function imgbbUpload(file, apiKey) {
    return new Promise(function(resolve, reject) {
        if (!file) {
            reject(new Error('কোনো ফাইল সিলেক্ট করা হয়নি।'));
            return;
        }

        var provider = localStorage.getItem('admin_image_provider') || 'imgbb';

        if (provider === 'r2') {
            var r2FormData = new FormData();
            r2FormData.append('file', file);

            var apiBase = (typeof CONFIG !== 'undefined' && CONFIG.HF_API_BASE) ? CONFIG.HF_API_BASE.replace(/\/+$/, '') : '';
            var r2Url = apiBase + '/api/r2-upload';

            fetch(r2Url, {
                method: 'POST',
                body: r2FormData
            })
            .then(function(res) { return res.json(); })
            .then(function(data) {
                if (data.success) {
                    resolve({
                        url: data.url,
                        display_url: data.display_url,
                        thumb: data.thumb,
                        delete_url: '',
                        viewer_url: data.url,
                        via: 'r2'
                    });
                } else {
                    reject(new Error(data.error || 'R2 upload failed'));
                }
            })
            .catch(function(err) {
                reject(new Error('R2 Network error: ' + err.message));
            });
            return; // R2 flow done
        }

        // --- Original ImgBB Flow ---
        if (!apiKey) {
            reject(new Error('ImgBB API Key সেট করা নেই। Settings → Provider check করো।'));
            return;
        }

        var reader = new FileReader();
        reader.onload = function(e) {
            // Base64 থেকে "data:image/...;base64," prefix বাদ দাও
            var base64 = e.target.result.split(',')[1];

            var formData = new FormData();
            formData.append('key', apiKey);
            formData.append('image', base64);
            formData.append('name', file.name.replace(/\.[^.]+$/, ''));

            fetch('https://api.imgbb.com/1/upload', {
                method: 'POST',
                body: formData
            })
            .then(function(res) { return res.json(); })
            .then(function(data) {
                if (data.success) {
                    resolve({
                        url:        data.data.url,        // Direct image URL (i.ibb.co/...)
                        display_url: data.data.display_url,
                        thumb:      data.data.thumb ? data.data.thumb.url : data.data.url,
                        delete_url: data.data.delete_url,
                        viewer_url: data.data.url_viewer,  // imgbb viewer page
                        via: 'imgbb'
                    });
                } else {
                    reject(new Error(data.error ? data.error.message : 'ImgBB upload failed'));
                }
            })
            .catch(function(err) {
                reject(new Error('Network error: ' + err.message));
            });
        };
        reader.onerror = function() { reject(new Error('File read করতে পারেনি।')); };
        reader.readAsDataURL(file);
    });
}

/**
 * ImgBB API Key পড়ে — settings localStorage cache অথবা CONFIG থেকে।
 */
function getImgbbKey() {
    // Admin settings.html থেকে সেভ করা key (localStorage এ cache করা)
    var cached = localStorage.getItem('imgbb_api_key');
    if (cached) return cached;
    // config.js এ থাকলে
    if (typeof CONFIG !== 'undefined' && CONFIG.IMGBB_API_KEY) return CONFIG.IMGBB_API_KEY;
    return null;
}

/**
 * একটি "Upload Image" বাটন তৈরি করে দেয়।
 * @param {function} onSuccess - callback(url) — আপলোড হলে direct URL পাবে
 * @param {object} opts - { btnClass, btnText, accept }
 * @returns {HTMLButtonElement}
 */
function createImgbbBtn(onSuccess, opts) {
    opts = opts || {};
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = opts.btnClass || 'btn btn-ghost btn-sm imgbb-upload-btn';
    btn.title = 'ImgBB তে আপলোড করো';
    btn.innerHTML = opts.btnText || '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload';

    btn.addEventListener('click', function() {
        var provider = localStorage.getItem('admin_image_provider') || 'imgbb';
        var apiKey = getImgbbKey();
        
        if (provider === 'imgbb' && !apiKey) {
            // Key নেই — জানাও
            if (typeof showToast === 'function') {
                showToast('⚠️ ImgBB API Key সেট করা নেই! Settings থেকে দাও।', 'warning');
            } else {
                alert('ImgBB API Key সেট করা নেই। Settings → ImgBB API Key দাও।');
            }
            return;
        }

        // File picker খোলো
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = opts.accept || 'image/*';
        input.onchange = function() {
            var file = input.files[0];
            if (!file) return;

            // বাটনে loading দেখাও
            var origHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin-icon"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Uploading...';
            btn.style.opacity = '0.7';

            imgbbUpload(file, apiKey)
                .then(function(result) {
                    btn.disabled = false;
                    btn.innerHTML = origHtml;
                    btn.style.opacity = '';
                    onSuccess(result);
                })
                .catch(function(err) {
                    btn.disabled = false;
                    btn.innerHTML = origHtml;
                    btn.style.opacity = '';
                    if (typeof showToast === 'function') {
                        showToast('❌ Upload failed: ' + err.message, 'error');
                    } else {
                        alert('Upload failed: ' + err.message);
                    }
                });
        };
        input.click();
    });

    return btn;
}

// Spin animation CSS (একবারই inject করে)
(function() {
    if (document.getElementById('imgbb-uploader-style')) return;
    var style = document.createElement('style');
    style.id = 'imgbb-uploader-style';
    style.textContent = [
        '@keyframes imgbb-spin { to { transform: rotate(360deg); } }',
        '.imgbb-upload-btn .spin-icon { animation: imgbb-spin 0.8s linear infinite; }',
        '.imgbb-upload-btn { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }',
        '.imgbb-img-preview { width: 100%; height: 100%; object-fit: cover; border-radius: 8px; display: block; }',
        '.imgbb-preview-wrap {',
        '  position: relative; border-radius: 10px; overflow: hidden;',
        '  border: 1px solid var(--border, rgba(255,255,255,0.1));',
        '  background: var(--bg-card, #1c1c1e);',
        '  display: flex; align-items: center; justify-content: center;',
        '}',
        '.imgbb-preview-wrap .imgbb-preview-placeholder {',
        '  display: flex; flex-direction: column; align-items: center; justify-content: center;',
        '  color: rgba(255,255,255,0.3); font-size: 12px; gap: 6px; padding: 20px; text-align: center;',
        '}',
        '.imgbb-preview-wrap .imgbb-preview-placeholder svg { opacity: 0.4; }',
        '.imgbb-upload-row { display: flex; gap: 8px; align-items: center; }',
        '.imgbb-upload-row .form-input { flex: 1; }',
    ].join('\n');
    document.head.appendChild(style);
})();
