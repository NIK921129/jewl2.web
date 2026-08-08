// server/server.js — Express + MongoDB entry point (deploy on Render)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const routes = require("./routes");
const { Product, Coupon } = require("./models");

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || "*").split(",").map((s) => s.trim()),
  })
);

app.get("/", (_req, res) => res.json({ name: "GIVA Jewellery API", status: "running" }));
app.use("/api", routes);
app.use((_req, res) => res.status(404).json({ error: "Route not found" }));

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

async function seed() {
  if ((await Product.countDocuments()) > 0) return;
  const img = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;
  await Product.insertMany([ // Enhanced GIVA-inspired seed data
    { title: "Anushka Sharma Silver Zircon Star Necklace", category: "Necklaces", brand: "GIVA", price: 2499, compareAtPrice: 4999, stock: 30, featured: true, rating: 4.9, image: img("1611019345293-1c1b5932d4a0"), description: "925 Sterling Silver necklace with sparkling zircon stars, inspired by Anushka's timeless elegance. Rhodium e-coat to prevent tarnish.", tags: ["silver", "necklace", "zircon", "anushka sharma"] },
    { title: "Golden Serene Heart Locket", category: "Necklaces", brand: "GIVA", price: 1899, compareAtPrice: 3999, stock: 25, featured: true, rating: 4.8, image: img("1599454118285-a72a8d3f3c6e"), description: "A delicate 18k gold-plated heart locket that opens up, symbolizing love and serenity. A perfect gift for your loved one.", tags: ["gold plated", "necklace", "heart", "locket"] },
    { title: "Silver Zirconia Solitaire Studs", category: "Earrings", brand: "GIVA", price: 1299, stock: 50, rating: 4.7, image: img("1606418833203-c0c94a6b5e6a"), description: "Classic 925 silver studs with brilliant-cut solitare zirconia. An essential for every jewellery collection, comes with a certificate of authenticity.", tags: ["earrings", "silver", "studs", "solitaire"] },
    { title: "Rose Gold Floral Bracelet", category: "Bracelets", brand: "GIVA", price: 2199, compareAtPrice: 4299, stock: 20, featured: true, rating: 4.8, image: img("1615243242479-a0bba4430b03"), description: "An elegant rose gold-plated bracelet featuring a delicate flower design with a zircon center. Adds a touch of grace to any outfit.", tags: ["bracelet", "rose gold", "flower"] },
    { title: "Oxidised Silver Peacock Jhumkas", category: "Earrings", brand: "GIVA", price: 1799, stock: 40, rating: 4.6, image: img("1629056199383-6b54c438528f"), description: "Traditional oxidised 925 silver jhumkas with an intricate peacock motif and ghungroo drops. A statement piece for ethnic wear.", tags: ["earrings", "oxidised", "jhumka", "peacock"] },
    { title: "Anushka Sharma Silver Royal Ring", category: "Rings", brand: "GIVA", price: 1599, stock: 60, rating: 4.7, image: img("1591121833933-308835c8ac8b"), description: "A majestic 925 silver ring with a large, central emerald-cut zircon, exuding royalty and charm. Adjustable size.", tags: ["ring", "silver", "zircon", "anushka sharma"] },
    { title: "Golden Layered Chain Necklace", category: "Necklaces", brand: "GIVA", price: 2399, stock: 35, rating: 4.5, image: img("1613332054242-2b18433d3525"), description: "Trendy and chic, this 18k gold-plated layered necklace with two distinct chains is perfect for a modern, stacked look.", tags: ["necklace", "gold plated", "layered"] },
    { title: "Silver Minimalist Hoop Earrings", category: "Earrings", brand: "GIVA", price: 999, stock: 70, rating: 4.6, image: img("1612913529384-a9b3cce0b8be"), description: "Sleek and simple 925 sterling silver hoops for everyday elegance. Lightweight and perfect for all-day wear.", tags: ["earrings", "silver", "hoops"] },
    { title: "Rose Gold Zircon Tennis Bracelet", category: "Bracelets", brand: "GIVA", price: 3499, compareAtPrice: 6999, stock: 15, featured: true, rating: 4.9, image: img("1615243242479-a0bba4430b03"), description: "A stunning rose gold-plated tennis bracelet, fully studded with high-quality, brilliant-cut zircons. Features a secure box clasp.", tags: ["bracelet", "rose gold", "tennis", "zircon"] },
    { title: "Silver Classic Solitaire Ring", category: "Rings", brand: "GIVA", price: 1999, stock: 45, rating: 4.8, image: img("1604543239221-38a6a090c58a"), description: "The classic solitaire proposal ring in 925 sterling silver. A timeless symbol of love and commitment, featuring a 1-carat equivalent zircon.", tags: ["ring", "silver", "solitaire", "proposal"] },
    { title: "Golden Evil Eye Charm Bracelet", category: "Bracelets", brand: "GIVA", price: 1699, stock: 33, rating: 4.5, image: img("1613332054242-2b18433d3525"), description: "A playful 18k gold-plated bracelet with an evil eye charm to ward off negativity. Personalize your style.", tags: ["bracelet", "gold plated", "charm", "evil eye"] },
    { title: "Oxidised Silver Ghungroo Choker", category: "Necklaces", brand: "GIVA", price: 2999, stock: 22, rating: 4.7, image: img("1629056199383-6b54c438528f"), description: "A bold and beautiful oxidised silver choker necklace adorned with ghungroo bells for a bohemian, festive look.", tags: ["necklace", "oxidised", "choker", "ghungroo"] },
  ]);
  await Coupon.insertMany([
    { code: "WELCOME10", type: "percent", value: 10, minOrder: 0 },
    { code: "NOVA500", type: "flat", value: 500, minOrder: 2999 },
  ]);
  console.log("✅ Seeded demo jewellery and coupons");
}

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log("✅ MongoDB connected");
    await seed();
    app.listen(PORT, () => console.log(`🚀 API running on port ${PORT}`));
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
