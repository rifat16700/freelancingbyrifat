// ============================================================
// assets/js/r2-uploader.js — Cloudflare R2 Image Upload Utility
// Project: Freelancing By Rifat E-Commerce
//
// Usage:
//   r2Upload(file)  → Promise<{ url, thumb, key }>
//   createR2Btn(onSuccess, opts) → HTMLButtonElement
//
// ImgBB এর পাশাপাশি কাজ করে — একটু বেশি ফাস্ট এবং নিজের server এ।
// ============================================================

/**
 * Cloudflare R2 এ একটি ছবি আপলোড করে।
 * @param {File} file - ফাইল ইনপুট থেকে পাওয়া File object
 * @returns {Promise<{url:string, thumb:string, key:string}>}
 */
function r2Upload(file) {
    return new Promise(function(resolve, reject) {
        if (!file) {
            reject(new Error('কোনো ফাইল সিলেক্ট করা হয়নি।'));
            return;
        }

        var formData = new FormData();
        formData.append('file', file);

        // আমাদের নিজের Cloudflare Function এ পাঠাও
        fetch('/api/r2-upload', {
            method: 'POST',
            body: formData
        })
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (data.success) {
                resolve({
                    url:         data.url,
                    display_url: data.display_url || data.url,
                    thumb:       data.thumb || data.url,
                    key:         data.key,
                    via:         'r2'   // কোথা থেকে আপলোড হয়েছে বোঝার জন্য
                });
            } else {
                reject(new Error(data.error || 'R2 upload failed'));
            }
        })
        .catch(function(err) {
            reject(new Error('Network error: ' + err.message));
        });
    });
}

/**
 * ImgBB বা R2 — যেকোনো একটায় আপলোড করে।
 * R2 থাকলে R2 তে, না থাকলে ImgBB তে fallback।
 * @param {File} file
 * @param {string} preferredMethod - 'r2' | 'imgbb' | 'auto'
 * @param {string} imgbbKey - ImgBB API Key (optional)
 */
function smartUpload(file, preferredMethod, imgbbKey) {
    preferredMethod = preferredMethod || 'auto';

    // 'auto' মানে R2 আগে try, fail হলে imgbb
    if (preferredMethod === 'r2' || preferredMethod === 'auto') {
        return r2Upload(file).catch(function(r2Err) {
            // R2 fail হলে imgbb তে try করো (auto mode এ)
            if (preferredMethod === 'auto' && imgbbKey) {
                console.warn('R2 upload failed, falling back to ImgBB:', r2Err.message);
                return imgbbUpload(file, imgbbKey);
            }
            throw r2Err;
        });
    } else {
        // imgbb only
        if (!imgbbKey) return Promise.reject(new Error('ImgBB API Key নেই।'));
        return imgbbUpload(file, imgbbKey);
    }
}

/**
 * R2 আপলোড বাটন তৈরি করে দেয় (ImgBB এর createImgbbBtn এর মতো)।
 */
function createR2Btn(onSuccess, opts) {
    opts = opts || {};
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = opts.btnClass || 'btn btn-ghost btn-sm imgbb-upload-btn';
    btn.title = 'R2 তে আপলোড করো (নিজের সার্ভার)';
    btn.innerHTML = opts.btnText || '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> R2 Upload';

    btn.addEventListener('click', function() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = opts.accept || 'image/*';
        input.onchange = function() {
            var file = input.files[0];
            if (!file) return;

            var origHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin-icon"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Uploading...';
            btn.style.opacity = '0.7';

            r2Upload(file)
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
                        showToast('❌ R2 Upload failed: ' + err.message, 'error');
                    } else {
                        alert('R2 Upload failed: ' + err.message);
                    }
                });
        };
        input.click();
    });

    return btn;
}
