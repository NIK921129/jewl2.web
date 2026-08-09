// server/routes.js — every API route (public, customer, admin)
const express = require("express");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const jwt = require("jsonwebtoken");
const { User, Product, Order, Coupon, Review, Message, Setting } = require("./models");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "change_me_secret";
const ADMIN_ID = process.env.ADMIN_ID || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";
const CURRENCY = process.env.CURRENCY || "INR";
const FREE_SHIPPING_OVER = Number(process.env.FREE_SHIPPING_OVER || 999);
const SHIPPING_FEE = Number(process.env.SHIPPING_FEE || 49);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.params.id}-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

const sign = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });

function auth(required = true) {
  return (req, res, next) => {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) {
      if (required) return res.status(401).json({ error: "Login required" });
      return next();
    }
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      if (required) return res.status(401).json({ error: "Session expired, please login again" });
      next();
    }
  };
}
const adminOnly = [
  auth(true),
  (req, res, next) =>
    req.user && req.user.role === "admin" ? next() : res.status(403).json({ error: "Admin only" }),
];
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => res.status(500).json({ error: e.message }));
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ---------------------------------- meta --------------------------------- */
router.get("/health", (_req, res) => res.json({ ok: true, time: new Date() }));
router.get("/health", (_req, res) => res.json({ ok: true, time: new Date() }));
router.get("/config", (_req, res) =>
  res.json({ currency: CURRENCY, freeShippingOver: FREE_SHIPPING_OVER, shippingFee: SHIPPING_FEE })
);

router.get(
  "/settings/storefront",
  wrap(async (_req, res) => {
    res.json((await Setting.findOne({ key: "storefront" }))?.value || {});
  })
);

router.get(
  "/settings/chat_widget",
  wrap(async (_req, res) => {
    res.json((await Setting.findOne({ key: "chat_widget" }))?.value || {});
  })
);

router.get(
  "/settings/upi",
  wrap(async (_req, res) => {
    res.json((await Setting.findOne({ key: "upi_id" }))?.value || "");
  })
);

/* ---------------------------------- auth ---------------------------------- */
router.post(
  "/auth/signup",
  wrap(async (req, res) => {
    const { name = "", email = "", password = "" } = req.body || {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email" });
    if (String(password).length < 6) return res.status(400).json({ error: "Password must be 6+ characters" });
    if (await User.findOne({ email: email.toLowerCase() }))
      return res.status(409).json({ error: "Email already registered — please login" });
    const user = await User.create({
      name: name.trim().slice(0, 80),
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 10),
    });
    res.json({ token: sign({ id: user.id, email: user.email, role: user.role }), user: safeUser(user) });
  })
);

router.post(
  "/auth/login",
  wrap(async (req, res) => {
    const { email = "", password = "" } = req.body || {};
    // Admin master credentials from environment variables
    if (email.trim().toLowerCase() === ADMIN_ID.toLowerCase() && password === ADMIN_PASSWORD) {
      return res.json({
        token: sign({ id: "admin", email: ADMIN_ID, role: "admin" }),
        user: { name: "Administrator", email: ADMIN_ID, role: "admin" },
      });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      return res.status(401).json({ error: "Invalid email or password" });
    if (user.blocked) return res.status(403).json({ error: "Account blocked. Contact support." });
    res.json({ token: sign({ id: user.id, email: user.email, role: user.role }), user: safeUser(user) });
  })
);

router.get(
  "/auth/me",
  auth(true),
  wrap(async (req, res) => {
    if (req.user.role === "admin" && req.user.id === "admin")
      return res.json({ name: "Administrator", email: ADMIN_ID, role: "admin" });
    const u = await User.findById(req.user.id);
    if (!u) return res.status(404).json({ error: "User not found" });
    res.json(safeUser(u));
  })
);

router.put(
  "/auth/me",
  auth(true),
  wrap(async (req, res) => {
    const { name, phone, address, wishlist, bag } = req.body || {};
    const u = await User.findByIdAndUpdate(
      req.user.id,
      { $set: clean({ name, phone, address, wishlist, bag }) },
      { new: true }
    );
    res.json(safeUser(u));
  })
);

router.post(
  "/auth/password",
  auth(true),
  wrap(async (req, res) => {
    const { current, next } = req.body || {};
    const u = await User.findById(req.user.id);
    if (!u || !(await bcrypt.compare(current || "", u.passwordHash)))
      return res.status(400).json({ error: "Current password is incorrect" });
    if (String(next || "").length < 6) return res.status(400).json({ error: "New password must be 6+ characters" });
    u.passwordHash = await bcrypt.hash(next, 10);
    await u.save();
    res.json({ ok: true });
  })
);

/* -------------------------------- products -------------------------------- */
router.get(
  "/products",
  wrap(async (req, res) => {
    const { q, category, min, max, sort = "new", page = 1, limit = 60, featured } = req.query;
    const filter = { active: true };
    if (q) filter.$or = [{ title: new RegExp(esc(q), "i") }, { tags: new RegExp(esc(q), "i") }, { brand: new RegExp(esc(q), "i") }];
    if (category && category !== "all") filter.category = category;
    if (featured === "1") filter.featured = true;
    if (min || max) filter.price = clean({ $gte: min ? +min : undefined, $lte: max ? +max : undefined });
    const sorts = { new: { createdAt: -1 }, priceAsc: { price: 1 }, priceDesc: { price: -1 }, rating: { rating: -1 }, popular: { views: -1 } };
    const skip = (Math.max(1, +page) - 1) * Math.min(100, +limit);
    const [items, total] = await Promise.all([
      Product.find(filter).sort(sorts[sort] || sorts.new).skip(skip).limit(Math.min(100, +limit)),
      Product.countDocuments(filter),
    ]);
    res.json({ items, total, categories: await Product.distinct("category", { active: true }) });
  })
);

router.get(
  "/products/:id",
  wrap(async (req, res) => {
    const p = await Product.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true });
    if (!p) return res.status(404).json({ error: "Product not found" });
    const reviews = await Review.find({ product: p.id }).sort({ createdAt: -1 }).limit(20);
    res.json({ product: p, reviews });
  })
);

router.post(
  "/products/:id/reviews",
  auth(true),
  wrap(async (req, res) => {
    const { rating = 5, comment = "", name = "" } = req.body || {};
    const r = await Review.create({ product: req.params.id, email: req.user.email, name, rating, comment });
    const all = await Review.find({ product: req.params.id });
    const avg = all.reduce((s, x) => s + x.rating, 0) / (all.length || 1);
    await Product.findByIdAndUpdate(req.params.id, { rating: Math.round(avg * 10) / 10, reviewsCount: all.length });
    res.json(r);
  })
);

/* --------------------------------- coupons -------------------------------- */
router.post(
  "/coupons/validate",
  wrap(async (req, res) => {
    const { code = "", subtotal = 0 } = req.body || {};
    const c = await Coupon.findOne({ code: code.toUpperCase(), active: true });
    if (!c) return res.status(404).json({ error: "Invalid coupon code" });
    if (c.expiresAt && c.expiresAt < new Date()) return res.status(400).json({ error: "Coupon expired" });
    if (subtotal < c.minOrder) return res.status(400).json({ error: `Minimum order ${c.minOrder} required` });
    const discount = c.type === "percent" ? Math.round((subtotal * c.value) / 100) : c.value;
    res.json({ code: c.code, discount: Math.min(discount, subtotal) });
  })
);

/* --------------------------------- orders --------------------------------- */
router.post(
  "/orders",
  auth(true),
  wrap(async (req, res) => {
    const { items = [], coupon = "", shippingAddress = {}, paymentMethod = "cod" } = req.body || {};
    if (!items.length) return res.status(400).json({ error: "Your bag is empty" });
    let subtotal = 0;
    const lines = [];
    for (const it of items) {
      const p = await Product.findById(it.productId);
      if (!p) continue;
      const qty = Math.max(1, Math.min(99, +it.qty || 1));
      subtotal += p.price * qty;
      lines.push({ productId: p.id, title: p.title, price: p.price, qty, image: p.image });
      await Product.findByIdAndUpdate(p.id, { $inc: { stock: -qty } });
    }
    let discount = 0;
    if (coupon) {
      const c = await Coupon.findOne({ code: coupon.toUpperCase(), active: true });
      if (c && subtotal >= c.minOrder) {
        discount = Math.min(c.type === "percent" ? Math.round((subtotal * c.value) / 100) : c.value, subtotal);
        await Coupon.findByIdAndUpdate(c.id, { $inc: { usedCount: 1 } });
      }
    }
    const shipping = subtotal - discount >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FEE;
    const order = await Order.create({
      orderNo: "ORD-" + Date.now().toString(36).toUpperCase(),
      user: req.user.id !== "admin" ? req.user.id : undefined,
      email: req.user.email,
      items: lines,
      subtotal,
      discount,
      shipping,
      total: subtotal - discount + shipping,
      coupon,
      paymentMethod,
      shippingAddress,
      status: "awaiting_payment",
    });
    req.io.to("admins").emit("new_order", order);
    res.json(order);
  })
);

router.get(
  "/orders/:id",
  auth(true),
  wrap(async (req, res) => {
    const o = await Order.findOne({ _id: req.params.id, email: req.user.email });
    if (!o) return res.status(404).json({ error: "Order not found" });
    res.json(o);
  })
);

router.post("/orders/:id/screenshot", auth(true), upload.single("screenshot"), wrap(async (req, res) => {
  const o = await Order.findByIdAndUpdate(req.params.id, { paymentScreenshot: `/uploads/${req.file.filename}`, status: "awaiting_approval" }, { new: true });
  res.json(o);
}));

router.get(
  "/orders/mine",
  auth(true),
  wrap(async (req, res) => res.json(await Order.find({ email: req.user.email }).sort({ createdAt: -1 })))
);

router.post(
  "/orders/:id/cancel",
  auth(true),
  wrap(async (req, res) => {
    const o = await Order.findOne({ _id: req.params.id, email: req.user.email });
    if (!o) return res.status(404).json({ error: "Order not found" });
    if (["shipped", "delivered"].includes(o.status)) return res.status(400).json({ error: "Order already shipped" });
    o.status = "cancelled";
    await o.save();
    res.json(o);
  })
);

/* -------------------------------- contact --------------------------------- */
router.post(
  "/contact",
  wrap(async (req, res) => {
    const { name = "", email = "", subject = "", message = "" } = req.body || {};
    if (!email || !message) return res.status(400).json({ error: "Email and message are required" });
    res.json(await Message.create({ name, email, subject, message }));
  })
);

/* ================================== ADMIN ================================= */
router.get(
  "/admin/stats",
  adminOnly,
  wrap(async (_req, res) => {
    const [orders, products, users, messages] = await Promise.all([
      Order.find().sort({ createdAt: -1 }),
      Product.countDocuments(),
      User.countDocuments(),
      Message.countDocuments({ read: false }),
    ]);
    const revenue = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);
    const byStatus = {};
    orders.forEach((o) => (byStatus[o.status] = (byStatus[o.status] || 0) + 1));
    const days = [...Array(14)].map((_, i) => {
      const d = new Date(Date.now() - (13 - i) * 864e5);
      const key = d.toISOString().slice(0, 10);
      const dayOrders = orders.filter((o) => o.createdAt.toISOString().slice(0, 10) === key);
      return { date: key, orders: dayOrders.length, revenue: dayOrders.reduce((s, o) => s + o.total, 0) };
    });
    const productSales = {};
    orders.forEach((o) => o.items.forEach((i) => (productSales[i.title] = (productSales[i.title] || 0) + i.qty)));
    const topProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([title, qty]) => ({ title, qty }));
    const lowStock = await Product.find({ stock: { $lte: 5 } }).limit(20);
    res.json({
      revenue,
      orders: orders.length,
      products,
      users,
      unreadMessages: messages,
      avgOrder: orders.length ? Math.round(revenue / orders.length) : 0,
      byStatus,
      days,
      topProducts,
      lowStock,
      recent: orders.slice(0, 10),
    });
  })
);

// products CRUD
router.get("/admin/products", adminOnly, wrap(async (req, res) => {
  const q = req.query.q ? { title: new RegExp(esc(req.query.q), "i") } : {};
  res.json(await Product.find(q).sort({ createdAt: -1 }));
}));
router.post("/admin/products", adminOnly, wrap(async (req, res) => res.json(await Product.create(req.body))));
router.put("/admin/products/:id", adminOnly, wrap(async (req, res) =>
  res.json(await Product.findByIdAndUpdate(req.params.id, req.body, { new: true }))));
router.delete("/admin/products/:id", adminOnly, wrap(async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));
router.post("/admin/products/bulk", adminOnly, wrap(async (req, res) => {
  const { ids = [], action, value } = req.body || {};
  if (action === "delete") await Product.deleteMany({ _id: { $in: ids } });
  if (action === "activate") await Product.updateMany({ _id: { $in: ids } }, { active: !!value });
  if (action === "feature") await Product.updateMany({ _id: { $in: ids } }, { featured: !!value });
  if (action === "stock") await Product.updateMany({ _id: { $in: ids } }, { stock: +value || 0 });
  if (action === "price") await Product.updateMany({ _id: { $in: ids } }, { price: +value || 0 });
  res.json({ ok: true });
}));

// orders management
router.get("/admin/orders", adminOnly, wrap(async (req, res) => {
  const { status, q } = req.query;
  const f = {};
  if (status && status !== "all") f.status = status;
  if (q) f.$or = [{ orderNo: new RegExp(esc(q), "i") }, { email: new RegExp(esc(q), "i") }];
  res.json(await Order.find(f).sort({ createdAt: -1 }));
}));
router.get("/admin/orders/approvals", adminOnly, wrap(async (_req, res) => {
  res.json(await Order.find({ status: "awaiting_approval" }).sort({ createdAt: -1 }));
}));

router.put("/admin/orders/:id", adminOnly, wrap(async (req, res) =>
  res.json(await Order.findByIdAndUpdate(req.params.id, clean(req.body), { new: true }))));
router.delete("/admin/orders/:id", adminOnly, wrap(async (req, res) => {
  await Order.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

// users management (create ids + passwords, bag list, block)
router.get("/admin/users", adminOnly, wrap(async (req, res) => {
  const q = req.query.q ? { email: new RegExp(esc(req.query.q), "i") } : {};
  const users = await User.find(q).sort({ createdAt: -1 });
  const orders = await Order.find();
  res.json(users.map((u) => {
    const mine = orders.filter((o) => o.email === u.email);
    return { ...safeUser(u), orderCount: mine.length, spent: mine.reduce((s, o) => s + o.total, 0) };
  }));
}));
router.post("/admin/users", adminOnly, wrap(async (req, res) => {
  const { name = "", email = "", password = "123456", role = "customer" } = req.body || {};
  if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ error: "Email exists" });
  const u = await User.create({ name, email: email.toLowerCase(), role, passwordHash: await bcrypt.hash(password, 10) });
  res.json(safeUser(u));
}));
router.put("/admin/users/:id", adminOnly, wrap(async (req, res) => {
  const body = clean(req.body);
  if (body.password) { body.passwordHash = await bcrypt.hash(body.password, 10); delete body.password; }
  res.json(safeUser(await User.findByIdAndUpdate(req.params.id, body, { new: true })));
}));
router.delete("/admin/users/:id", adminOnly, wrap(async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

// coupons
router.get("/admin/coupons", adminOnly, wrap(async (_req, res) => res.json(await Coupon.find().sort({ createdAt: -1 }))));
router.post("/admin/coupons", adminOnly, wrap(async (req, res) => res.json(await Coupon.create(req.body))));
router.put("/admin/coupons/:id", adminOnly, wrap(async (req, res) =>
  res.json(await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true }))));
router.delete("/admin/coupons/:id", adminOnly, wrap(async (req, res) => {
  await Coupon.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

// messages + reviews
router.get("/admin/messages", adminOnly, wrap(async (_req, res) => res.json(await Message.find().sort({ createdAt: -1 }))));
router.put("/admin/messages/:id", adminOnly, wrap(async (req, res) =>
  res.json(await Message.findByIdAndUpdate(req.params.id, { read: true }, { new: true }))));
router.delete("/admin/messages/:id", adminOnly, wrap(async (req, res) => {
  await Message.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));
router.get("/admin/reviews", adminOnly, wrap(async (_req, res) => res.json(await Review.find().sort({ createdAt: -1 }).limit(200))));
router.delete("/admin/reviews/:id", adminOnly, wrap(async (req, res) => {
  await Review.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

// settings
router.get("/admin/settings", adminOnly, wrap(async (_req, res) => res.json(await Setting.find())));
router.put("/admin/settings", adminOnly, wrap(async (req, res) => {
  const { key, value } = req.body || {};
  if (!key || !value) return res.status(400).json({ error: "Key and value are required" });
  res.json(await Setting.findOneAndUpdate({ key }, { value }, { upsert: true, new: true }));
}));

// data export (CSV / JSON download)
router.get(
  "/admin/export/:type",
  adminOnly,
  wrap(async (req, res) => {
    const map = { orders: Order, products: Product, users: User, coupons: Coupon, reviews: Review, messages: Message };
    const Model = map[req.params.type];
    if (!Model) return res.status(400).json({ error: "Unknown export type" });
    const rows = (await Model.find().lean()).map((r) => {
      const { passwordHash, __v, ...rest } = r;
      return rest;
    });
    if (req.query.format === "json") return res.json(rows);
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""').replace(/\n/g, " ")}"`).join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=${req.params.type}.csv`);
    res.send(csv);
  })
);

function safeUser(u) {
  if (!u) return null;
  const { passwordHash, __v, ...rest } = u.toObject ? u.toObject() : u;
  return rest;
}
function clean(o) {
  const r = {};
  Object.entries(o || {}).forEach(([k, v]) => v !== undefined && (r[k] = v));
  return r;
}

module.exports = router;
