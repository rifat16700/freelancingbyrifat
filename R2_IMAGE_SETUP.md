# ☁️ Cloudflare R2 Image Storage — Setup Guide
**Project: Freelancing By Rifat E-Commerce**

## আপনার Situation

```
Account A (Domain Account):
  ✅ Domain: freelancingbyrifat.top
  ✅ R2 Bucket: (আপনার bucket)
  ✅ Custom Domain on R2: images.freelancingbyrifat.top

Account B (Pages Account):
  ✅ Cloudflare Pages (আপনার সাইট)
  ✅ Cloudflare Functions (/api/*)
```

**সমাধান:** R2 Binding ব্যবহার না করে **S3-Compatible API + API Token** দিয়ে সরাসরি Account B থেকে Account A এর R2 তে আপলোড করা হবে।

---

## কীভাবে কাজ করে

```
Admin Panel (Account B এর Pages)
       ↓
  /api/r2-upload Function
       ↓  (S3 API + API Token দিয়ে সই করা request)
  Account A এর R2 Bucket
       ↓
  images.freelancingbyrifat.top/products/file.jpg (CDN cached)
```

---

## আপনাকে যা করতে হবে

### Step 1: Account A তে R2 API Token তৈরি করুন

1. **Account A** এর Cloudflare Dashboard এ লগিন করুন
2. **My Profile** → **API Tokens** এ যান (উপরে ডানদিকে Avatar এ ক্লিক)
3. **Create Token** → **Create Custom Token**
4. নিচের settings দিন:
   - **Token name:** `R2 Upload Token` (যেকোনো নাম)
   - **Permissions:**
     - `Account` → `Cloudflare R2 Storage:Admin` (অথবা `Edit`)
   - **Account Resources:** Include → আপনার Account
5. **Continue to Summary** → **Create Token**
6. Token দেখাবে — **এখনই কপি করুন, পরে আর দেখাবে না!**

> **⚠️ এটা API Token, R2 API Token আলাদা।** R2 বাকেটের ভেতর থেকে না, My Profile থেকে করতে হবে।

---

### Step 2: Account A এর Account ID বের করুন

1. Account A এর Dashboard এ যান
2. যেকোনো পেজের ডানদিকে **Account ID** দেখতে পাবেন (32 অক্ষরের hex string)
3. কপি করুন

---

### Step 3: R2 API Keys তৈরি করুন (Access Key ID + Secret)

> API Token আলাদা, R2 তে S3-compatible access এর জন্য আলাদা **Access Key** লাগে।

1. Account A → **R2 Object Storage**
2. পেজের উপরে ডানদিকে **Manage R2 API Tokens** ক্লিক করুন
3. **Create API token** ক্লিক করুন:
   - **Token Name:** `Pages Upload Key`
   - **Permissions:** `Object Read & Write`
   - **Specify bucket:** আপনার বাকেটটি সিলেক্ট করুন
4. **Create API Token** ক্লিক করুন
5. এখন দেখাবে:
   - ✅ **Access Key ID** — কপি করুন
   - ✅ **Secret Access Key** — কপি করুন (একবারই দেখায়!)

---

### Step 4: Account B এর Cloudflare Pages এ Environment Variables সেট করুন

1. **Account B** এর Dashboard → **Workers & Pages** → আপনার Pages প্রজেক্ট
2. **Settings** → **Environment Variables** → **Add variable** (একে একে সব যোগ করুন):

| Variable Name | Value |
|--------------|-------|
| `R2_ACCOUNT_ID` | Account A এর Account ID (Step 2 থেকে) |
| `R2_BUCKET_NAME` | আপনার R2 Bucket এর নাম |
| `R2_ACCESS_KEY_ID` | Step 3 এর Access Key ID |
| `R2_SECRET_ACCESS_KEY` | Step 3 এর Secret Access Key |
| `R2_PUBLIC_URL` | `https://images.freelancingbyrifat.top` |

3. **Production** এবং **Preview** — দুটোতেই সেট করুন
4. **Save** করুন

> **Secret Access Key** কে `Encrypt` (🔒) করে রাখুন — Security এর জন্য।

---

### Step 5: Redeploy

নতুন commit push করুন অথবা Deployments → Retry deployment।

---

## Test করার পদ্ধতি

1. Admin Panel → **Products** → Edit
2. Gallery এ **Upload** বাটন ক্লিক করুন
3. ছবি সিলেক্ট করুন
4. Toast এ `✅ Uploaded via ☁️ R2!` দেখালে সফল!

Browser Console এ test করুন:
```javascript
const fd = new FormData();
// fd.append('file', yourFile);
fetch('/api/r2-upload', { method: 'POST', body: fd })
  .then(r => r.json())
  .then(console.log);
```

---

## ফাইল Structure

```
functions/api/
  r2-upload.js     ← S3-Compatible API দিয়ে upload (Account আলাদা হলেও কাজ করে)

assets/js/
  imgbb-uploader.js  ← ImgBB (fallback)
  r2-uploader.js     ← R2 JS client + smartUpload()

admin/
  products.html      ← smartUpload() ব্যবহার করছে
  settings.html      ← smartUpload() ব্যবহার করছে
```

---

## সমস্যা হলে

### "Environment variables নেই" error
→ Step 4 সম্পূর্ণ করুন। সব 5টি variable সেট করুন।

### "R2 upload failed (403)" error
→ Access Key ID / Secret Access Key ভুল, অথবা bucket permission নেই।
→ Step 3 আবার করুন এবং bucket সিলেক্ট করতে ভুলবেন না।

### "R2 upload failed (404)" error
→ Bucket Name ভুল। `R2_BUCKET_NAME` exact bucket নাম দিন।

### ছবি upload হয় কিন্তু দেখায় না (broken image)
→ `R2_PUBLIC_URL` ভুল, অথবা Custom Domain R2 বাকেটে ঠিকমতো connected নেই।

### R2 fail হয়ে ImgBB তে যাচ্ছে
→ Console এ error message দেখুন এবং উপরের সমাধান ফলো করুন।
→ ImgBB API Key থাকলে ছবি upload হবে (fallback কাজ করবে)।
