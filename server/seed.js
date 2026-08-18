// server/seed.js — demo data seeding logic
const { Product, Coupon } = require("./models");

async function seed() {
  if ((await Product.countDocuments()) > 0) return;
  const img = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;
  await Product.insertMany([
    { title: "Aurora Wireless Headphones", category: "Audio", brand: "Nova", price: 4999, compareAtPrice: 7999, stock: 24, featured: true, rating: 4.8, image: img("1505740420928-5e560c06d30e"), description: "Active noise cancelling over-ear headphones with 40h battery life.", tags: ["audio", "wireless"], active: true },
    { title: "Pulse Smart Watch", category: "Wearables", brand: "Nova", price: 6499, compareAtPrice: 8999, stock: 18, featured: true, rating: 4.6, image: img("1523275335684-37898b6baf30"), description: "AMOLED display, heart-rate + SpO2, 7-day battery.", tags: ["watch"], active: true },
    { title: "Studio Mechanical Keyboard", category: "Computing", brand: "Keyz", price: 5799, stock: 12, rating: 4.7, image: img("1587829741301-dc798b83add3"), description: "Hot-swappable switches, RGB backlight, aluminium body.", active: true },
    { title: "Nimbus Bluetooth Speaker", category: "Audio", brand: "Nova", price: 2999, compareAtPrice: 3999, stock: 40, featured: true, rating: 4.5, image: img("1608043152269-423dbba4e7e1"), description: "360° sound, IPX7 waterproof, 20h playtime.", active: true },
    { title: "Vision 4K Action Camera", category: "Cameras", brand: "Vision", price: 11999, stock: 8, rating: 4.4, image: img("1526170375885-4d8ecf77b99f"), description: "4K60 stabilised video, waterproof to 30m.", active: true },
    { title: "Feather Laptop Sleeve", category: "Accessories", brand: "Carry", price: 1299, stock: 60, rating: 4.3, image: img("1553062407-98eeb64c6a62"), description: "Water resistant 14\" sleeve with magnetic flap.", active: true },
    { title: "Orbit Wireless Mouse", category: "Computing", brand: "Keyz", price: 1899, stock: 35, rating: 4.5, image: img("1527864550417-7fd91fc51a46"), description: "Silent clicks, 4000 DPI, USB-C rechargeable.", active: true },
    { title: "Halo Desk Lamp", category: "Home", brand: "Lumen", price: 2499, stock: 22, rating: 4.6, image: img("1507473885765-e6ed057f782c"), description: "Dimmable LED lamp with wireless charging base.", active: true },
    { title: "Trail Running Shoes", category: "Fashion", brand: "Stride", price: 3999, compareAtPrice: 5499, stock: 30, rating: 4.4, image: img("1542291026-7eec264c27ff"), description: "Lightweight grip sole for road and trail.", active: true },
    { title: "Everyday Backpack 22L", category: "Accessories", brand: "Carry", price: 2799, stock: 27, featured: true, rating: 4.7, image: img("1553062407-98eeb64c6a62"), description: "Padded laptop bay, hidden pockets, rain cover.", active: true },
    { title: "Ceramic Pour-Over Set", category: "Home", brand: "Brew", price: 1799, stock: 15, rating: 4.8, image: img("1495474472287-4d71bcdd2085"), description: "Hand-glazed dripper with borosilicate carafe.", active: true },
    { title: "Zen Yoga Mat", category: "Fitness", brand: "Zen", price: 1499, stock: 44, rating: 4.2, image: img("1518611012118-696072aa579a"), description: "6mm non-slip TPE mat with carry strap.", active: true },
  ]);
  await Coupon.insertMany([
    { code: "WELCOME10", type: "percent", value: 10, minOrder: 0 },
    { code: "NOVA500", type: "flat", value: 500, minOrder: 2999 },
  ]);
  console.log("✅ Seeded demo products and coupons");
}

module.exports = { seed };