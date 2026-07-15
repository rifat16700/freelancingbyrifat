# Google Tag Manager (GTM) Tracking Guide

আপনার ই-কমার্স সাইটে `window.fireTrackingEvent()` ফাংশনের মাধ্যমে GTM-এর `dataLayer`-এ ইভেন্ট পুশ করা হচ্ছে। Facebook Pixel এবং GA4-এর জন্য ট্যাগ, ট্রিগার এবং ভ্যারিয়েবল সেটআপ করার সম্পূর্ণ নির্দেশিকা নিচে দেওয়া হলো।

## ১. Event Names (Custom Triggers)

GTM-এ **Custom Event** টাইপের ট্রিগার (Trigger) তৈরি করার সময় নিচের ইভেন্ট নামগুলো (Event Name) হুবহু ব্যবহার করতে হবে:

| Event Name | কখন ফায়ার হয়? |
| :--- | :--- |
| `PageView` | যেকোনো পেজ লোড হওয়ার সাথে সাথে। |
| `ViewContent` | কোনো প্রোডাক্টের বিস্তারিত পেজে (`product.html`) ভিজিট করলে। |
| `AddToCart` | কার্টে প্রোডাক্ট অ্যাড করলে বা 'Direct Order' বাটনে ক্লিক করলে। |
| `InitiateCheckout` | চেকআউট পেজে (`checkout.html`) গেলে। |
| `Purchase` | পেমেন্ট বা অর্ডার সাকসেসফুল হওয়ার পর (`success.html`)-এ। |

*(নোট: প্রতিটি ইভেন্টের সাথে `event_id` নামে একটি ইউনিক আইডি ডেটা লেয়ারে যাচ্ছে, যা Facebook Conversions API-এ Event Deduplication-এর কাজে লাগবে।)*

---

## ২. Data Variables (Data Layer Variables)

প্রতিটি ইভেন্টের সাথে `dataLayer`-এ নিচের কাস্টম ডেটা বা প্যারামিটারগুলো পাস হচ্ছে:

### `ViewContent` এবং `AddToCart`
- `content_ids`: প্রোডাক্টের আইডি (Array হিসেবে, যেমন: `["prod_123"]`)
- `content_name`: প্রোডাক্টের নাম
- `currency`: কারেন্সি (সবসময় `'BDT'`)
- `value`: প্রোডাক্টের দাম (ফ্ল্যাশ সেল ডিসকাউন্ট বাদ দিয়ে ফাইনাল দাম)

### `InitiateCheckout`
- `currency`: কারেন্সি (`'BDT'`)
- `value`: কার্টে থাকা সব আইটেমের মোট দাম (Initial Total)
- `num_items`: কার্টে থাকা মোট আইটেমের সংখ্যা

### `Purchase`
- `transaction_id`: অর্ডারের ইউনিক আইডি (Invoice/Order ID)
- `currency`: কারেন্সি (`'BDT'`)
- `value`: ডেলিভারি চার্জ সহ অর্ডারের সর্বমোট দাম (Grand Total)

---

## ৩. Usage Guide (How to Setup in GTM)

GTM-এর ভেতরে এই ডেটাগুলো ধরার জন্য আপনাকে **Data Layer Variable** তৈরি করতে হবে।

### Data Layer Variable তৈরি করার নিয়ম:
১. GTM ড্যাশবোর্ড থেকে **Variables** মেনুতে যান এবং **User-Defined Variables** সেকশন থেকে **New** বাটনে ক্লিক করুন।
২. Variable Configuration-এ ক্লিক করে Type হিসেবে **Data Layer Variable** সিলেক্ট করুন।
৩. **Data Layer Variable Name**-এর ঘরে নিচের নামগুলো হুবহু বসান।
৪. ভ্যারিয়েবলটির একটি নাম দিয়ে সেভ করুন (যেমন: `dlv - value`)।

**তৈরি করার জন্য প্রয়োজনীয় ভ্যারিয়েবল লিস্ট:**

| GTM-এ আপনার দেওয়া নাম (Suggested) | Data Layer Variable Name (হুবহু বসাতে হবে) |
| :--- | :--- |
| `dlv - content_ids` | `content_ids` |
| `dlv - content_name` | `content_name` |
| `dlv - currency` | `currency` |
| `dlv - value` | `value` |
| `dlv - num_items` | `num_items` |
| `dlv - transaction_id` | `transaction_id` |
| `dlv - event_id` | `event_id` |

### Facebook Pixel ও GA4 Tag সেটআপ করার শর্ট গাইড:
- **Trigger**: ১ নম্বর সেকশনের টেবিল থেকে ইভেন্ট নাম (যেমন: `Purchase`) দিয়ে GTM-এ Custom Event Trigger তৈরি করুন।
- **Tag Variables**: Facebook Pixel বা GA4 ট্যাগ কনফিগার করার সময় প্যারামিটারের ভ্যালু হিসেবে আপনার তৈরি করা ভ্যারিয়েবলগুলো ব্যবহার করুন। 
  - যেমন: Value ফিল্ডে `{{dlv - value}}`, Currency ফিল্ডে `{{dlv - currency}}` এবং Content IDs ফিল্ডে `{{dlv - content_ids}}` বসিয়ে দিন।
