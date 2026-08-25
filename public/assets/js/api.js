/* =========================================================
   NOVA STORE — shared API client, storage, helpers, demo mode
   ========================================================= */
const CFG = window.NOVA_CONFIG;
const API = CFG.API_BASE_URL.replace(/\/$/, "");
const assetUrl = (value) => (value && String(value).startsWith("/") ? new URL(value, API.startsWith("http") ? API : window.location.origin).href : value || "");

/* ------------------------------ helpers ------------------------------ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const money = (n) => CFG.CURRENCY + Number(n || 0).toLocaleString("en-IN");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dt = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const stars = (r) => "★".repeat(Math.round(r || 0)) + "☆".repeat(5 - Math.round(r || 0));
const uid = () => Math.random().toString(36).slice(2, 9);

const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem("nova_" + k)) ?? d; } catch { return d; } },
  set: (k, v) => localStorage.setItem("nova_" + k, JSON.stringify(v)),
  del: (k) => localStorage.removeItem("nova_" + k),
};

function toast(msg, type = "ok") {
  let host = $("#toasts");
  if (!host) { host = document.createElement("div"); host.id = "toasts"; document.body.appendChild(host); }
  const el = document.createElement("div");
  el.className = "toast" + (type === "err" ? " err" : "");
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 2800);
}

/* ------------------------------ auth token ------------------------------ */
const auth = {
  token: () => store.get("token", null),
  user: () => store.get("user", null),
  save: (t, u) => { store.set("token", t); store.set("user", u); },
  clear: () => { store.del("token"); store.del("user"); },
  isAdmin: () => (store.get("user", {}) || {}).role === "admin",
};

/* ------------------------------ fetch wrapper ------------------------------ */
let DEMO = false;
async function api(path, { method = "GET", body, raw = false } = {}) {
  const isFormData = body instanceof FormData;
  const headers = isFormData ? {} : { "Content-Type": "application/json" };
  const t = auth.token();
  if (t) headers.Authorization = "Bearer " + t;
  let res;
  try {
    res = await fetch(API + path, { method, headers, body: body ? (isFormData ? body : JSON.stringify(body)) : undefined });
  } catch (e) {
    if (CFG.ALLOW_DEMO_FALLBACK) { DEMO = true; return demoApi(path, method, body); }
    throw new Error("Cannot reach the server. Please try again.");
  }
  if (raw) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}
const isDemo = () => DEMO;

/* =========================================================
   DEMO MODE — full offline store so the site works before
   the Render backend is connected. Data lives in localStorage.
   ========================================================= */
const IMG = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;
const DEMO_SEED = [
  ["Celeste Diamond Pendant", "Necklaces", 18499, 22999, 12, true, 4.9, "1523170335258-f5ed11844a49", "A refined gold-tone pendant with a brilliant-cut crystal centrepiece."],
  ["Solitaire Promise Ring", "Rings", 8999, 10999, 18, true, 4.8, "1605100804763-247f67b3557e", "A timeless solitaire ring designed for everyday elegance."],
  ["Pearl Drop Earrings", "Earrings", 4299, 0, 24, false, 4.7, "1617038220319-276d3cfab638", "Luminous pearl drops finished with a delicate gold-tone setting."],
  ["Aurora Tennis Bracelet", "Bracelets", 12499, 14999, 16, true, 4.8, "1515562141207-7a88fb7ce338", "A graceful line bracelet set with light-catching stones."],
  ["Meher Kundan Choker", "Necklaces", 15999, 0, 9, false, 4.6, "1599643478518-a784e5dc4c8f", "An ornate choker with traditional-inspired detailing for celebrations."],
  ["Mini Hoop Earrings", "Earrings", 2499, 0, 36, false, 4.5, "1535632066927-ab7c9ab60908", "Polished everyday hoops with a lightweight, comfortable fit."],
  ["Serenity Bangle Set", "Bracelets", 6999, 0, 21, false, 4.6, "1573408301185-9146fe634ad0", "A pair of textured bangles to stack or wear solo."],
  ["Zodiac Disc Necklace", "Necklaces", 5499, 0, 28, false, 4.7, "1515562141207-7a88fb7ce338", "A personal disc necklace engraved with your zodiac symbol."],
  ["Emerald Halo Ring", "Rings", 11499, 13999, 14, true, 4.8, "1603561596112-db1dcb9c58c7", "A rich emerald-green stone framed by a radiant halo."],
  ["Flora Stud Earrings", "Earrings", 3199, 0, 32, false, 4.6, "1611652022419-a9419f74343d", "Petite floral studs that add a soft sparkle to every look."],
  ["Luna Layered Chain", "Necklaces", 7499, 0, 20, false, 4.7, "1515562141207-7a88fb7ce338", "Two fine chains in one effortlessly layered silhouette."],
];
function demoDb() {
  // A versioned key ensures an existing electronics demo catalogue is refreshed.
  let db = store.get("jewellery_demo_db_v1", null);
  if (!db) {
    db = {
      products: DEMO_SEED.map((p) => ({
        _id: uid(), title: p[0], category: p[1], price: p[2], compareAtPrice: p[3], stock: p[4],
        featured: p[5], rating: p[6], image: IMG(p[7]), description: p[8], brand: "Nova", active: true,
        reviewsCount: Math.floor(Math.random() * 60), views: Math.floor(Math.random() * 500),
        createdAt: new Date().toISOString(),
      })),
      users: [], orders: [], reviews: [], messages: [], settings: {},
      coupons: [
        { _id: uid(), code: "WELCOME10", type: "percent", value: 10, minOrder: 0, active: true, usedCount: 0 },
        { _id: uid(), code: "NOVA500", type: "flat", value: 500, minOrder: 2999, active: true, usedCount: 0 },
      ],
    };
    store.set("jewellery_demo_db_v1", db);
  }
  return db;
}
const saveDemo = (db) => store.set("jewellery_demo_db_v1", db);

function demoApi(path, method, body) {
  const db = demoDb();
  const seg = path.split("?")[0].split("/").filter(Boolean);
  const qs = new URLSearchParams(path.split("?")[1] || "");
  const me = auth.user() || {};
  const done = (v) => { saveDemo(db); return v; };

  // auth
  if (path === "/auth/signup") {
    if (db.users.find((u) => u.email === body.email.toLowerCase())) throw new Error("Email already registered — please login");
    const u = { _id: uid(), name: body.name, email: body.email.toLowerCase(), password: body.password, role: "customer", createdAt: new Date().toISOString(), bag: [], wishlist: [] };
    db.users.push(u);
    return done({ token: "demo." + u._id, user: u });
  }
  if (path === "/auth/login") {
    if (body.email.toLowerCase() === "admin" && body.password === "123456")
      return { token: "demo.admin", user: { name: "Administrator", email: "admin", role: "admin" } };
    const u = db.users.find((x) => x.email === body.email.toLowerCase() && x.password === body.password);
    if (!u) throw new Error("Invalid email or password");
    return { token: "demo." + u._id, user: u };
  }
  if (path === "/auth/me") return me;

  // Public storefront settings
  if (path === "/settings/storefront") return db.settings?.storefront || {};
  if (path === "/settings/chat_widget") return db.settings?.chat_widget || {};
  if (path === "/settings/upi") return db.settings?.upi_id || "";

  // catalogue
  if (seg[0] === "products" && seg.length === 1) {
    let items = db.products.filter((p) => p.active);
    const q = (qs.get("q") || "").toLowerCase();
    if (q) items = items.filter((p) => (p.title + p.category).toLowerCase().includes(q));
    const cat = qs.get("category");
    if (cat && cat !== "all") items = items.filter((p) => p.category === cat);
    if (qs.get("featured") === "1") items = items.filter((p) => p.featured);
    const s = qs.get("sort");
    if (s === "priceAsc") items.sort((a, b) => a.price - b.price);
    if (s === "priceDesc") items.sort((a, b) => b.price - a.price);
    if (s === "rating") items.sort((a, b) => b.rating - a.rating);
    if (s === "popular") items.sort((a, b) => b.views - a.views);
    return { items, total: items.length, categories: [...new Set(db.products.map((p) => p.category))] };
  }
  if (seg[0] === "products" && seg.length === 2) {
    const p = db.products.find((x) => x._id === seg[1]);
    if (!p) throw new Error("Product not found");
    return { product: p, reviews: db.reviews.filter((r) => r.product === p._id) };
  }
  if (seg[0] === "products" && seg[2] === "reviews") {
    const r = { _id: uid(), product: seg[1], name: body.name || me.name, rating: body.rating, comment: body.comment, createdAt: new Date().toISOString() };
    db.reviews.push(r); return done(r);
  }
  if (path === "/coupons/validate") {
    const c = db.coupons.find((x) => x.code === (body.code || "").toUpperCase() && x.active);
    if (!c) throw new Error("Invalid coupon code");
    if (body.subtotal < c.minOrder) throw new Error(`Minimum order ${c.minOrder} required`);
    return { code: c.code, discount: Math.min(c.type === "percent" ? Math.round((body.subtotal * c.value) / 100) : c.value, body.subtotal) };
  }
  if (path === "/contact") { db.messages.unshift({ _id: uid(), ...body, read: false, createdAt: new Date().toISOString() }); return done({ ok: true }); }

  // orders
  if (path === "/orders" && method === "POST") {
    let subtotal = 0; const items = [];
    body.items.forEach((it) => {
      const p = db.products.find((x) => x._id === it.productId); if (!p) return;
      subtotal += p.price * it.qty; p.stock = Math.max(0, p.stock - it.qty);
      items.push({ productId: p._id, title: p.title, price: p.price, qty: it.qty, image: p.image });
    });
    let discount = 0;
    const c = db.coupons.find((x) => x.code === (body.coupon || "").toUpperCase());
    if (c) discount = Math.min(c.type === "percent" ? Math.round((subtotal * c.value) / 100) : c.value, subtotal);
    const shipping = subtotal - discount >= 999 ? 0 : 49;
    const o = { _id: uid(), orderNo: "ORD-" + Date.now().toString(36).toUpperCase(), email: me.email, items, subtotal, discount, shipping, total: subtotal - discount + shipping, coupon: body.coupon, paymentMethod: body.paymentMethod, shippingAddress: body.shippingAddress, status: "pending", createdAt: new Date().toISOString() };
    db.orders.unshift(o); return done(o);
  }
  if (path === "/orders/mine") return db.orders.filter((o) => o.email === me.email);
  if (seg[0] === "orders" && seg[2] === "cancel") {
    const o = db.orders.find((x) => x._id === seg[1]); if (o) o.status = "cancelled"; return done(o);
  }

  // admin
  if (path === "/admin/stats") {
    const revenue = db.orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);
    const byStatus = {}; db.orders.forEach((o) => (byStatus[o.status] = (byStatus[o.status] || 0) + 1));
    const days = [...Array(14)].map((_, i) => {
      const key = new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10);
      const d = db.orders.filter((o) => (o.createdAt || "").slice(0, 10) === key);
      return { date: key, orders: d.length, revenue: d.reduce((s, o) => s + o.total, 0) };
    });
    const ps = {}; db.orders.forEach((o) => o.items.forEach((i) => (ps[i.title] = (ps[i.title] || 0) + i.qty)));
    return {
      revenue, orders: db.orders.length, products: db.products.length, users: db.users.length,
      unreadMessages: db.messages.filter((m) => !m.read).length,
      avgOrder: db.orders.length ? Math.round(revenue / db.orders.length) : 0,
      byStatus, days, topProducts: Object.entries(ps).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([title, qty]) => ({ title, qty })),
      lowStock: db.products.filter((p) => p.stock <= 5), recent: db.orders.slice(0, 10),
    };
  }
  const coll = { products: "products", orders: "orders", users: "users", coupons: "coupons", reviews: "reviews", messages: "messages" }[seg[1]];
  if (seg[0] === "admin" && coll) {
    if (seg[1] === "users" && method === "GET")
      return db.users.map((u) => ({ ...u, orderCount: db.orders.filter((o) => o.email === u.email).length, spent: db.orders.filter((o) => o.email === u.email).reduce((s, o) => s + o.total, 0) }));
    if (seg[1] === "orders" && seg[2] === "approvals" && method === "GET")
      return db.orders.filter(o => o.status === "awaiting_approval");
    if (method === "GET") return db[coll];
    if (method === "POST" && seg[2] === "bulk") {
      body.ids.forEach((id) => {
        const p = db.products.find((x) => x._id === id); if (!p) return;
        if (body.action === "activate") p.active = !!body.value;
        if (body.action === "feature") p.featured = !!body.value;
        if (body.action === "stock") p.stock = +body.value;
        if (body.action === "price") p.price = +body.value;
      });
      if (body.action === "delete") db.products = db.products.filter((p) => !body.ids.includes(p._id));
      return done({ ok: true });
    }
    if (method === "POST") { const doc = { _id: uid(), createdAt: new Date().toISOString(), ...body }; db[coll].unshift(doc); return done(doc); }
    if (method === "PUT") { const d = db[coll].find((x) => x._id === seg[2]); Object.assign(d || {}, body); return done(d); }
    if (method === "DELETE") { db[coll] = db[coll].filter((x) => x._id !== seg[2]); return done({ ok: true }); }
  }
  if (path === "/admin/settings") {
    db.settings ||= {};
    if (method === "GET") return Object.entries(db.settings).map(([key, value]) => ({ _id: key, key, value }));
    if (method === "PUT") {
      if (!body?.key) throw new Error("Setting key is required");
      db.settings[body.key] = body.value;
      return done({ _id: body.key, key: body.key, value: body.value });
    }
  }
  if (path.startsWith("/admin/export/")) return db[seg[2]] || [];
  return {};
}
