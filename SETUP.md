# NOVA Store — Full Setup Guide

A commercial-grade e-commerce platform:

- **Frontend** — plain HTML, CSS and JavaScript (no framework, no build step) in `public/`
- **Backend** — Node.js + Express + Mongoose REST API in `server/`
- **Database** — MongoDB Atlas
- **Hosting** — Vercel (frontend) + Render (backend)

---

## 0. What you need

| Account | Purpose | Cost |
|---|---|---|
| GitHub | stores the code | free |
| MongoDB Atlas | database | free tier |
| Render | runs the API | free tier |
| Vercel | serves the store | free tier |
| Google AI Studio (optional) | "Data Play" AI admin assistant | free tier |

---

## 1. Push the code to GitHub

```sh
git init
git add .
git commit -m "NOVA store"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

Repository layout that matters:

```
public/     ← frontend (deployed to Vercel)
  index.html      storefront
  admin.html      admin control centre  (/admin)
  vercel.json     clean URLs + /api proxy to Render
  assets/css/styles.css
  assets/js/config.js | api.js | app.js | admin.js
server/     ← backend (deployed to Render)
  server.js  routes.js  models.js  package.json  .env.example
render.yaml ← optional one-click Render blueprint
```

---

## 2. MongoDB Atlas

1. Create a free **M0** cluster at <https://cloud.mongodb.com>.
2. **Database Access → Add New Database User** — username + strong password, role *Read and write to any database*.
3. **Network Access → Add IP Address → Allow access from anywhere** (`0.0.0.0/0`). Render's outbound IPs are dynamic, so this is required on the free plan.
4. **Connect → Drivers** and copy the string. Insert your password and add the database name:

```
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/nova?retryWrites=true&w=majority
```

> If the password contains `@ : / ? # & %`, URL-encode it (`@` → `%40`).

---

## 3. Deploy the backend on Render

1. <https://dashboard.render.com> → **New → Web Service** → connect your GitHub repo.
2. Settings:
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`
3. **Environment → Add environment variables**:

| Key | Value |
|---|---|
| `MONGODB_URI` | your Atlas string from step 2 |
| `JWT_SECRET` | a long random string (`openssl rand -hex 32`) |
| `ADMIN_ID` | your admin login id, e.g. `admin` |
| `ADMIN_PASSWORD` | a strong password |
| `CORS_ORIGIN` | `https://your-store.vercel.app` (comma separate more) |
| `CURRENCY` | `INR` |
| `SHIPPING_FEE` | `49` |
| `FREE_SHIPPING_OVER` | `999` |
| `UPLOADS_DIR` | `/var/data/uploads` *(only if you attach a disk)* |
| `GEMINI_API_KEY` | optional, enables admin **Data Play** |

4. Deploy. When the log shows `✅ MongoDB connected` and `🚀 API running`, open
   `https://<your-service>.onrender.com/api/health` — it must return `{"ok":true}`.
   On first boot the API seeds 11 demo products and 2 coupons.

**Alternative:** commit `render.yaml` and use **New → Blueprint** instead; Render reads every
setting from that file and only asks for the secret values.

> **Payment screenshots:** uploads live on the server's disk. Render's free plan has an
> ephemeral filesystem, so files vanish on redeploy. Attach a **persistent disk** mounted at
> `/var/data` (paid plan) and set `UPLOADS_DIR=/var/data/uploads` to keep them.

> **Cold starts:** the free plan sleeps after 15 idle minutes; the first request then takes
> ~30 s. Upgrade to Starter for an always-on store.

---

## 4. Point the frontend at the API

Edit **`public/vercel.json`** and replace the placeholder host with your Render URL:

```json
{ "source": "/api/(.*)", "destination": "https://<your-service>.onrender.com/api/$1" }
```

This proxy means the browser only ever calls the same origin, so **CORS can never break the
store**. Leave `API_BASE_URL: "/api"` in `public/assets/js/config.js` as it is.

Optional in `config.js`:

- `SOCKET_URL` — set to `https://<your-service>.onrender.com` to get live "new order"
  notifications in the admin panel (Socket.IO can't go through the Vercel proxy).
- `ALLOW_DEMO_FALLBACK` — keep `true` so the store still renders demo data if the API is asleep;
  set to `false` for a strictly live store.

Commit and push.

---

## 5. Deploy the frontend on Vercel

1. <https://vercel.com/new> → import the same repo.
2. Settings:
   - **Framework Preset**: `Other`
   - **Root Directory**: `public`  ← important, this is where `vercel.json` lives
   - **Build Command**: leave empty
   - **Output Directory**: leave empty
3. Deploy. You get `https://your-store.vercel.app`.
4. Go back to Render and set `CORS_ORIGIN` to that exact URL (plus your custom domain later),
   then redeploy the API.

Custom domain: Vercel → **Settings → Domains → Add**, then follow the DNS instructions and add
the domain to `CORS_ORIGIN` on Render too.

---

## 6. First run checklist

| Check | URL | Expected |
|---|---|---|
| API alive | `/api/health` (Render) | `{"ok":true}` |
| Products load | `https://your-store.vercel.app` | 11 demo products |
| Admin login | `https://your-store.vercel.app/admin` | sign in with `ADMIN_ID` / `ADMIN_PASSWORD` |
| Customer signup | store → Account | creates a real user in Atlas |
| Order flow | add to bag → checkout → order | stock decreases, order appears in admin |

---

## 7. Running everything locally

```sh
# terminal 1 — API
cd server
cp .env.example .env      # fill in MONGODB_URI etc.
npm install
npm run dev               # http://localhost:5000

# terminal 2 — storefront
cd public
npx serve -l 3000         # http://localhost:3000
```

Locally there is no Vercel proxy, so temporarily set in `public/assets/js/config.js`:

```js
API_BASE_URL: "http://localhost:5000/api",
SOCKET_URL: "http://localhost:5000",
```

and add `http://localhost:3000` to `CORS_ORIGIN` in `server/.env`.

---

## 8. What you can control from the admin panel

Everything below is editable at `/admin` — no code changes, no redeploy:

- **Dashboard / Statistics** — revenue, order counts, 14-day trend, top products, low stock
- **Products / Add product / Inventory** — full CRUD, bulk price, stock, feature, activate, delete
- **Storefront** — hero pill, headline, sub-headline, hero image and both CTA buttons
- **Orders** — status (awaiting payment → approval → paid → processing → shipped → delivered →
  cancelled/refunded), tracking number, notes; cancelling restores stock automatically
- **Payment approvals** — review customer UPI screenshots and approve or reject
- **Payments** — set the UPI id customers pay to
- **Coupons** — percent or flat, minimum order, expiry, active toggle, usage count
- **Customers & IDs** — create logins, reset passwords, block/unblock, see spend per customer
- **Bag lists** — what each customer left in their bag
- **Reviews / Messages** — moderate reviews, read and delete contact messages
- **Live Chat** — plug in a Tawk.to widget id
- **Data Play** — describe a catalogue change in plain English; Gemini proposes actions and you
  approve them before anything is written (requires `GEMINI_API_KEY`)
- **Data export** — CSV or JSON download of orders, products, users, coupons, reviews, messages
- **Settings** — store level defaults

---

## 9. Security notes (already implemented)

- Passwords hashed with bcrypt; JWTs signed with `JWT_SECRET`, 30-day expiry
- Admin credentials come from environment variables only — never stored in the frontend
- Every `/api/admin/*` route requires a valid admin token server-side
- **Order totals are recomputed on the server** from live product prices, so a tampered cart
  cannot change what a customer is charged
- Stock is reserved atomically at checkout and released on cancellation
- Rate limiting on login (10/min), signup (8/min) and contact (5/min) per IP
- Uploads restricted to images, max 5 MB
- Regex user input is escaped before it reaches MongoDB
- `nosniff`, `DENY` framing and `no-referrer` headers on every response
- Password hashes are stripped from every API response and every export

**Before going live:** change `ADMIN_PASSWORD`, set a real `JWT_SECRET`, and restrict
`CORS_ORIGIN` to your own domains.

---

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| Store shows demo products only | API asleep or `vercel.json` still has the placeholder host |
| `MongoDB connection failed` | wrong password, or Atlas Network Access missing `0.0.0.0/0` |
| CORS error in the console | you're calling Render directly — use the `/api` proxy, or add the exact origin to `CORS_ORIGIN` |
| Admin login fails | `ADMIN_ID` / `ADMIN_PASSWORD` not set on Render, or service not redeployed |
| Uploaded screenshots disappear | ephemeral disk — attach a Render disk and set `UPLOADS_DIR` |
| First request very slow | Render free-plan cold start |
| `/admin` gives 404 | Vercel **Root Directory** is not set to `public` |
