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
const { seed } = require("./seed");

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
