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

const allowedOrigins = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
// `cors` treats ["*"] as a literal domain rather than a wildcard. Use true to
// reflect the request origin when public cross-origin access is intended.
const corsOrigin = allowedOrigins.includes("*") ? true : allowedOrigins;

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(
  cors({
    origin: corsOrigin,
  })
);

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use("/uploads", express.static(uploadsDir));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: corsOrigin },
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
    if (user.role === "admin") socket.join("admins");
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
    { title: "Celeste Diamond Pendant", category: "Necklaces", brand: "NOVA", price: 18499, compareAtPrice: 22999, stock: 12, featured: true, rating: 4.9, image: img("1523170335258-f5ed11844a49"), description: "A refined gold-tone pendant with a brilliant-cut crystal centrepiece.", tags: ["necklace", "pendant", "gold"] },
    { title: "Solitaire Promise Ring", category: "Rings", brand: "NOVA", price: 8999, compareAtPrice: 10999, stock: 18, featured: true, rating: 4.8, image: img("1605100804763-247f67b3557e"), description: "A timeless solitaire ring designed for everyday elegance.", tags: ["ring", "solitaire"] },
    { title: "Pearl Drop Earrings", category: "Earrings", brand: "NOVA", price: 4299, stock: 24, rating: 4.7, image: img("1617038220319-276d3cfab638"), description: "Luminous pearl drops finished with a delicate gold-tone setting." },
    { title: "Aurora Tennis Bracelet", category: "Bracelets", brand: "NOVA", price: 12499, compareAtPrice: 14999, stock: 16, featured: true, rating: 4.8, image: img("1515562141207-7a88fb7ce338"), description: "A graceful line bracelet set with light-catching stones." },
    { title: "Meher Kundan Choker", category: "Necklaces", brand: "NOVA", price: 15999, stock: 9, rating: 4.6, image: img("1599643478518-a784e5dc4c8f"), description: "An ornate choker with traditional-inspired detailing for celebrations." },
    { title: "Mini Hoop Earrings", category: "Earrings", brand: "NOVA", price: 2499, stock: 36, rating: 4.5, image: img("1535632066927-ab7c9ab60908"), description: "Polished everyday hoops with a lightweight, comfortable fit." },
    { title: "Serenity Bangle Set", category: "Bracelets", brand: "NOVA", price: 6999, stock: 21, rating: 4.6, image: img("1573408301185-9146fe634ad0"), description: "A pair of textured bangles to stack or wear solo." },
    { title: "Zodiac Disc Necklace", category: "Necklaces", brand: "NOVA", price: 5499, stock: 28, rating: 4.7, image: img("1515562141207-7a88fb7ce338"), description: "A personal disc necklace engraved with your zodiac symbol." },
    { title: "Emerald Halo Ring", category: "Rings", brand: "NOVA", price: 11499, compareAtPrice: 13999, stock: 14, featured: true, rating: 4.8, image: img("1603561596112-db1dcb9c58c7"), description: "A rich emerald-green stone framed by a radiant halo." },
    { title: "Flora Stud Earrings", category: "Earrings", brand: "NOVA", price: 3199, stock: 32, rating: 4.6, image: img("1611652022419-a9419f74343d"), description: "Petite floral studs that add a soft sparkle to every look." },
    { title: "Luna Layered Chain", category: "Necklaces", brand: "NOVA", price: 7499, stock: 20, rating: 4.7, image: img("1515562141207-7a88fb7ce338"), description: "Two fine chains in one effortlessly layered silhouette." },
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
