# ☁️ Cloudflare R2 Image Storage — Setup Guide
**Project: Freelancing By Rifat E-Commerce**

এই গাইড অনুসরণ করলে আপনার e-commerce সাইটে নিজের Cloudflare R2 সার্ভারে ছবি আপলোড হবে — সম্পূর্ণ ফ্রি (Free Tier), ফাস্ট, এবং নিজের ডোমেইনে।

---

## কীভাবে কাজ করে

```
Admin Panel → Upload বাটন
       ↓
  /api/r2-upload  (Cloudflare Function)
       ↓
  R2 Bucket এ সেভ হয়
       ↓
  images.yoursite.com/products/file.jpg  (CDN cached URL)
       ↓
  Database এ URL সেভ হয়
```

- **ImgBB এখনো কাজ করবে** — R2 ফেইল করলে ImgBB তে fallback হবে।
- **ImgBB থাকা পুরনো ছবি** আগের মতোই দেখাবে — কোনো পরিবর্তন নেই।
- **নতুন ছবি** Upload বাটনে ক্লিক করলে R2 তে যাবে।

---

## আপনি যা করেছেন (ধরে নেওয়া হচ্ছে)

- [x] Cloudflare একাউন্টে R2 বাকেট তৈরি করেছেন
- [x] বাকেটে একটি Custom Domain (যেমন `images.freelancingbyrifat.top`) কানেক্ট করেছেন

---

## এখন আপনাকে যা করতে হবে (Step-by-Step)

### Step 1: R2 Bucket Public Access নিশ্চিত করুন

1. Cloudflare Dashboard (dash.cloudflare.com) → **R2 Object Storage**
2. আপনার বাকেটে ক্লিক করুন
3. **Settings** ট্যাবে যান
4. **Public Access** সেকশনে Custom Domain কানেক্ট আছে কিনা নিশ্চিত করুন
5. Custom Domain টি নোট করুন (যেমন: `https://images.freelancingbyrifat.top`)

> **গুরুত্বপূর্ণ:** R2 বাকেটে Custom Domain না থাকলে ছবি পাবলিকলি দেখানো যাবে না।

---

### Step 2: Cloudflare Pages এ R2 Binding যোগ করুন

1. Cloudflare Dashboard → **Workers & Pages**
2. আপনার Pages প্রজেক্টে ক্লিক করুন
3. **Settings** → **Functions** ট্যাবে যান
4. **R2 Bucket Bindings** সেকশনে → **Add binding**:
   - **Variable name:** `R2_BUCKET`  (হুবহু এভাবে)
   - **R2 Bucket:** আপনার বাকেট সিলেক্ট করুন
5. **Save** করুন

---

### Step 3: Environment Variable যোগ করুন

1. একই **Settings** পেজে **Environment Variables** → **Add variable**:
   - **Variable name:** `R2_PUBLIC_URL`
   - **Value:** `https://images.freelancingbyrifat.top`  (আপনার Custom Domain, trailing slash ছাড়া)
2. **Production** এবং **Preview** দুটোতেই সেট করুন
3. **Save** করুন

---

### Step 4: Redeploy

Settings পরিবর্তনের পর নতুন commit push করুন অথবা Deployments থেকে Retry করুন।

---

## Test করার পদ্ধতি

1. Admin Panel → **Products**
2. যেকোনো product **Edit** করুন
3. Gallery এর **Upload** বাটনে ক্লিক করুন
4. ছবি সিলেক্ট করুন
5. Toast এ `Uploaded via R2!` দেখালে সফল!

---

## ফাইল স্ট্রাকচার (কোড পরিবর্তন)

```
e-commarce/
├── functions/api/
│   └── r2-upload.js          [NEW] R2 আপলোড Cloudflare Function
├── assets/js/
│   ├── imgbb-uploader.js     [UNCHANGED] ImgBB fallback
│   └── r2-uploader.js        [NEW] R2 JS Library + smartUpload()
└── admin/
    ├── products.html          [UPDATED] smartUpload() ব্যবহার করছে
    └── settings.html          [UPDATED] smartUpload() ব্যবহার করছে
```

---

## Environment Variables Summary

| Variable Name | Value | কোথায় |
|--------------|-------|--------|
| `R2_PUBLIC_URL` | `https://images.yoursite.top` | Pages → Env Variables |

| Binding Name | Type | কোথায় |
|-------------|------|--------|
| `R2_BUCKET` | R2 Bucket | Pages → Functions → R2 Bindings |

---

## R2 Free Tier সীমা

| Resource | Free Limit |
|----------|-----------|
| Storage | 10 GB/মাস |
| Write ops | 1 Million/মাস |
| Read ops | 10 Million/মাস |
| **Bandwidth** | **সম্পূর্ণ ফ্রি!** |

---

## সমস্যা হলে

- **"R2_BUCKET binding নেই"** → Step 2 করুন, Variable name হুবহু `R2_BUCKET`
- **"R2_PUBLIC_URL নেই"** → Step 3 করুন
- **ছবি upload হয় কিন্তু দেখায় না** → Custom Domain সঠিক কিনা চেক করুন
- **R2 fail, ImgBB তে যাচ্ছে** → Console এ error দেখুন। ImgBB API Key থাকলে fallback কাজ করবে।
