# FN Pay - Dockerized Express.js Backend Gateway

This is a production-grade, highly secure payment verification backend built for **FN Pay** to run seamlessly on **Hugging Face Spaces**. It acts as a bridge between your frontend client, the **Binance Pay API**, and your **Supabase Database**.

## Features

- **Binance Pay Order Verification**: Securely queries the official Binance Pay API using request-signing via `HMAC-SHA512` based on your API Secret and API Key.
- **Supabase Integration**: Automatically updates order status to `Verified` in your database upon successful payment verification, using robust upsert with update fallback logic.
- **Hugging Face Ready**: Perfectly packaged to run on port `7860` as standard for Hugging Face Docker Spaces.
- **Security Protections**: Double-checks payment amounts returned from Binance API to prevent client-side parameter tempering.

---

## File Structure

```text
fn-pay-backend/
├── Dockerfile           # Multi-layered optimized Node 18 Docker build
├── package.json         # Node.js dependencies and run scripts
├── server.js            # Core Express.js application logic
└── .env.example         # Template for environment configuration
```

---

## Local Development Setup

1. **Install Dependencies**:
   Ensure you have Node.js 18+ installed, then run:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Fill in your API keys, Secrets, and Supabase credentials in the `.env` file.

3. **Start the Server**:
   Run the backend in development auto-reload watch mode:
   ```bash
   npm run dev
   ```

---

## Hugging Face Spaces Deployment

To deploy this backend as a Docker Space on Hugging Face:

1. Create a **New Space** on Hugging Face.
2. Select **Docker** as the SDK.
3. Select the **Blank** template (or any Docker template).
4. Upload all files (`package.json`, `Dockerfile`, `server.js`) to the repository files tab. (Make sure this directory is directly pushed without any outer folder, or place them in the root of the space repo).
5. Navigate to **Settings** -> **Variables and Secrets** in your Space dashboard.
6. Add the following **Secrets**:
   - `BINANCE_API_KEY`: Your Binance Merchant API Identity Key.
   - `BINANCE_SECRET_KEY`: Your Binance Merchant API Secret.
   - `SUPABASE_URL`: Your Supabase Project URL.
   - `SUPABASE_SERVICE_KEY`: Your Supabase Project `service_role` key (required for write access).
   - *Optional:* `SUPABASE_TABLE_NAME`: The table you want to query/upsert (defaults to `orders`).

---

## API Endpoints

### 1. Health Status
- **Method**: `GET`
- **URL**: `/`
- **Response**:
  ```json
  {
    "status": "online",
    "service": "FN Pay Backend Gateway",
    "timestamp": "2026-06-02T16:40:00.000Z",
    "configured": {
      "binance": true,
      "supabase": true
    }
  }
  ```

### 2. Verify Transaction
- **Method**: `POST`
- **URL**: `/api/verify-payment`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  {
    "tx_id": "2394829348",        // Binance prepayId (Optional if order_id is sent)
    "order_id": "ORDER-100492",    // Your Merchant Trade No (Optional if tx_id is sent)
    "amount": 10.50               // Amount to verify
  }
  ```
- **Response (Success)**:
  ```json
  {
    "success": true,
    "message": "Payment verified successfully and database updated",
    "order": {
      "prepayId": "2394829348",
      "merchantTradeNo": "ORDER-100492",
      "amount": 10.5,
      "currency": "USDT",
      "status": "Verified"
    }
  }
  ```

---

## Security Best Practices
- **Never commit your `.env` file** or store secrets in the code. Always use Hugging Face Environment Secrets.
- **Use the `service_role` key** for Supabase securely in your backend since this server runs completely server-side and is hidden from clients.
- Always perform amount matching on the backend using the values returned directly from the payment provider to thwart client-side request tampering.
