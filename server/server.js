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
  await Product.insertMany([ // GIVA-inspired seed data
    { title: "Anushka Sharma Silver Zircon Star Necklace", category: "Necklaces", brand: "GIVA", price: 2499, compareAtPrice: 4999, stock: 30, featured: true, rating: 4.9, image: img("1611019345293-1c1b5932d4a0"), description: "Sterling silver necklace with zircon stars, inspired by timeless elegance. Perfect for any occasion.", tags: ["silver", "necklace", "zircon"] },
    { title: "Golden Serene Heart Necklace", category: "Necklaces", brand: "GIVA", price: 1899, compareAtPrice: 3999, stock: 25, featured: true, rating: 4.8, image: img("1599454118285-a72a8d3f3c6e"), description: "A delicate golden heart pendant, symbolizing love and serenity. A perfect gift for your loved one.", tags: ["gold", "necklace", "heart"] },
    { title: "Silver Zirconia Studs", category: "Earrings", brand: "GIVA", price: 1299, stock: 50, rating: 4.7, image: img("1606418833203-c0c94a6b5e6a"), description: "Classic silver studs with sparkling zirconia, an essential for every jewellery collection.", tags: ["earrings", "silver", "studs"] },
    { title: "Rose Gold Flower Bracelet", category: "Bracelets", brand: "GIVA", price: 2199, compareAtPrice: 4299, stock: 20, featured: true, rating: 4.8, image: img("1615243242479-a0bba4430b03"), description: "An elegant rose gold bracelet featuring a delicate flower design. Adds a touch of grace to any outfit.", tags: ["bracelet", "rose gold", "flower"] },
    { title: "Oxidised Silver Peacock Jhumkas", category: "Earrings", brand: "GIVA", price: 1799, stock: 40, rating: 4.6, image: img("1629056199383-6b54c438528f"), description: "Traditional oxidised silver jhumkas with an intricate peacock motif. A statement piece for ethnic wear.", tags: ["earrings", "oxidised", "jhumka"] },
    { title: "Anushka Sharma Silver Royal Ring", category: "Rings", brand: "GIVA", price: 1599, stock: 60, rating: 4.7, image: img("1591121833933-308835c8ac8b"), description: "A majestic silver ring with a central stone, exuding royalty and charm.", tags: ["ring", "silver", "zircon"] },
    { title: "Golden Layered Necklace", category: "Necklaces", brand: "GIVA", price: 2399, stock: 35, rating: 4.5, image: img("1613332054242-2b18433d3525"), description: "Trendy and chic, this golden layered necklace is perfect for a modern look.", tags: ["necklace", "gold", "layered"] },
    { title: "Silver Minimalist Hoop Earrings", category: "Earrings", brand: "GIVA", price: 999, stock: 70, rating: 4.6, image: img("1612913529384-a9b3cce0b8be"), description: "Sleek and simple silver hoops for everyday elegance.", tags: ["earrings", "silver", "hoops"] },
    { title: "Rose Gold Zircon Tennis Bracelet", category: "Bracelets", brand: "GIVA", price: 3499, compareAtPrice: 6999, stock: 15, featured: true, rating: 4.9, image: img("1615243242479-a0bba4430b03"), description: "A stunning rose gold tennis bracelet, fully studded with high-quality zircons.", tags: ["bracelet", "rose gold", "tennis"] },
    { title: "Silver Solitaire Ring", category: "Rings", brand: "GIVA", price: 1999, stock: 45, rating: 4.8, image: img("1604543239221-38a6a090c58a"), description: "The classic solitaire ring in sterling silver. A timeless symbol of love and commitment.", tags: ["ring", "silver", "solitaire"] },
    { title: "Golden Charm Bracelet", category: "Bracelets", brand: "GIVA", price: 1699, stock: 33, rating: 4.5, image: img("1613332054242-2b18433d3525"), description: "A playful golden bracelet with assorted charms. Personalize your style.", tags: ["bracelet", "gold", "charm"] },
    { title: "Oxidised Silver Choker Necklace", category: "Necklaces", brand: "GIVA", price: 2999, stock: 22, rating: 4.7, image: img("1629056199383-6b54c438528f"), description: "A bold and beautiful oxidised silver choker for a bohemian look.", tags: ["necklace", "oxidised", "choker"] },
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
