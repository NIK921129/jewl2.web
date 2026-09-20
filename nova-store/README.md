# NOVA — Fine Jewellery Store (pure HTML / CSS / JS)

No frameworks, no build step. The whole site is static files; an optional
Express + MongoDB API in `server/` adds real orders and content management.

## Structure

```
index.html               storefront
admin.html               admin panel
assets/css/styles.css    full design system (light + dark themes)
assets/js/api.js         runtime config + API client + offline demo data
assets/js/app.js         storefront logic (catalogue, cart, checkout)
assets/js/admin.js       admin logic (products, orders, coupons, stats)
server/                  optional Express API (deployable to Render, see render.yaml)
```

## Run locally (demo mode)

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Without a backend the site runs on built-in demo data (products, coupons,
orders) so every page stays browsable.

## Run the API (optional)

```bash
cd server
npm install
cp .env.example .env    # set MONGODB_URI, ADMIN_ID, ADMIN_PASSWORD
npm start               # http://localhost:5000/api
```

Then point the storefront at it in `assets/js/api.js`:
- behind a proxy that forwards `/api` (recommended), keep `API_BASE_URL: "/api"`;
- direct cross-origin, set `API_BASE_URL: "http://localhost:5000/api"`.

## Proxy snippet (Vercel or any host that rewrites paths)

```json
{ "rewrites": [{ "source": "/api/(.*)", "destination": "https://YOUR-API.onrender.com/api/$1" }] }
```

## Admin

Open `/admin.html` and sign in with your `ADMIN_ID` / `ADMIN_PASSWORD`
environment values. The panel manages products, inventory, orders, coupons,
reviews, customers, storefront copy and includes data exports.
