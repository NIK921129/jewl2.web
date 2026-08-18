// server/server.js — Express + MongoDB entry point (deploy on Render)
require("dotenv").config();
const express = require("express");
const fs = require("fs");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const routes = require("./routes");
const { Product, Coupon, Setting } = require("./models");

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(
  cors((req, callback) => {
    const origin = req.header('Origin');
    const allowedOrigins = (process.env.CORS_ORIGIN || 'http://127.0.0.1:5500,http://localhost:5500').split(',').map(s => s.trim());
    const corsOptions = { origin: allowedOrigins.includes(origin) };
    callback(null, corsOptions);
  })
);

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use("/uploads", express.static(uploadsDir));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: (process.env.CORS_ORIGIN || "*").split(",").map((s) => s.trim()) },
});

// Middleware to pass io instance to routes
app.use((req, _res, next) => {
  req.io = io;
  next();
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(); // allow non-auth connections
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET || "change_me_secret");
    if (user.role === "admin") {
      socket.join("admins");
    }
    if (user.id) socket.join(user.id.toString()); // Join a room for this specific user
  } catch (e) { console.error("Socket auth error:", e.message); }
  next();
});

app.get("/", (_req, res) => res.json({ name: "NOVA Store API", status: "running" }));
app.use("/api", routes);
app.use((_req, res) => res.status(404).json({ error: "Route not found" }));

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

async function seed() {
  if ((await Product.countDocuments()) > 0) return;
  const img = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;
  await Product.insertMany([
    { title: "Aurora Wireless Headphones", category: "Audio", brand: "Nova", price: 4999, compareAtPrice: 7999, stock: 24, featured: true, rating: 4.8, image: img("1505740420928-5e560c06d30e"), description: "Active noise cancelling over-ear headphones with 40h battery life.", tags: ["audio", "wireless"] },
    { title: "Pulse Smart Watch", category: "Wearables", brand: "Nova", price: 6499, compareAtPrice: 8999, stock: 18, featured: true, rating: 4.6, image: img("1523275335684-37898b6baf30"), description: "AMOLED display, heart-rate + SpO2, 7-day battery.", tags: ["watch"] },
    { title: "Studio Mechanical Keyboard", category: "Computing", brand: "Keyz", price: 5799, stock: 12, rating: 4.7, image: img("1587829741301-dc798b83add3"), description: "Hot-swappable switches, RGB backlight, aluminium body." },
    { title: "Nimbus Bluetooth Speaker", category: "Audio", brand: "Nova", price: 2999, compareAtPrice: 3999, stock: 40, featured: true, rating: 4.5, image: img("1608043152269-423dbba4e7e1"), description: "360° sound, IPX7 waterproof, 20h playtime." },
    { title: "Vision 4K Action Camera", category: "Cameras", brand: "Vision", price: 11999, stock: 8, rating: 4.4, image: img("1526170375885-4d8ecf77b99f"), description: "4K60 stabilised video, waterproof to 30m." },
    { title: "Feather Laptop Sleeve", category: "Accessories", brand: "Carry", price: 1299, stock: 60, rating: 4.3, image: img("1553062407-98eeb64c6a62"), description: "Water resistant 14\" sleeve with magnetic flap." },
    { title: "Orbit Wireless Mouse", category: "Computing", brand: "Keyz", price: 1899, stock: 35, rating: 4.5, image: img("1527864550417-7fd91fc51a46"), description: "Silent clicks, 4000 DPI, USB-C rechargeable." },
    { title: "Halo Desk Lamp", category: "Home", brand: "Lumen", price: 2499, stock: 22, rating: 4.6, image: img("1507473885765-e6ed057f782c"), description: "Dimmable LED lamp with wireless charging base." },
    { title: "Trail Running Shoes", category: "Fashion", brand: "Stride", price: 3999, compareAtPrice: 5499, stock: 30, rating: 4.4, image: img("1542291026-7eec264c27ff"), description: "Lightweight grip sole for road and trail." },
    { title: "Everyday Backpack 22L", category: "Accessories", brand: "Carry", price: 2799, stock: 27, featured: true, rating: 4.7, image: img("1553062407-98eeb64c6a62"), description: "Padded laptop bay, hidden pockets, rain cover." },
    { title: "Ceramic Pour-Over Set", category: "Home", brand: "Brew", price: 1799, stock: 15, rating: 4.8, image: img("1495474472287-4d71bcdd2085"), description: "Hand-glazed dripper with borosilicate carafe." },
    { title: "Zen Yoga Mat", category: "Fitness", brand: "Zen", price: 1499, stock: 44, rating: 4.2, image: img("1518611012118-696072aa579a"), description: "6mm non-slip TPE mat with carry strap." },
  ]);
  await Coupon.insertMany([
    { code: "WELCOME10", type: "percent", value: 10, minOrder: 0 },
    { code: "NOVA500", type: "flat", value: 500, minOrder: 2999 },
  ]);
  console.log("✅ Seeded demo products and coupons");
}

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log("✅ MongoDB connected");
    await seed();
    server.listen(PORT, () => console.log(`🚀 API running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed.");
    if (err.message.includes("querySrv ENOTFOUND") || err.message.includes("queryTxt ENOTFOUND")) {
      console.error("   Hint: Check if the MONGODB_URI is correct. It seems there was a DNS resolution issue.");
    } else if (err.message.includes("bad auth") || err.message.includes("Authentication failed")) {
      console.error("   Hint: Check your username and password in the MONGODB_URI.");
    } else if (err.message.includes("closed") || err.message.includes("connect ETIMEDOUT")) {
      console.error("   Hint: The most common cause for this is the MongoDB Atlas IP Access List. Make sure your server's IP address (or 0.0.0.0/0 for 'anywhere') is added.");
    }
    console.error("   Full error:", err.message);
    process.exit(1);
  });
