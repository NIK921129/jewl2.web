// server/models.js — all Mongoose schemas in one file
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    blocked: { type: Boolean, default: false },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    wishlist: { type: [String], default: [] },
    bag: { type: Array, default: [] }, // saved cart / bag list
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

const ProductSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, default: "" },
    description: { type: String, default: "" },
    category: { type: String, default: "General", index: true },
    brand: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, default: 0 },
    stock: { type: Number, default: 0 },
    sku: { type: String, default: "" },
    image: { type: String, default: "" },
    gallery: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    rating: { type: Number, default: 4.5 },
    reviewsCount: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const OrderSchema = new mongoose.Schema(
  {
    orderNo: { type: String, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    email: String,
    items: { type: Array, default: [] }, // {productId,title,price,qty,image}
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    coupon: { type: String, default: "" },
    paymentMethod: { type: String, default: "cod" },
    status: {
      type: String,
      enum: ["awaiting_payment", "awaiting_approval", "pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"],
      default: "pending",
    },
    shippingAddress: { type: Object, default: {} },
    tracking: { type: String, default: "" },
    paymentScreenshot: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

const CouponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, uppercase: true, unique: true },
    type: { type: String, enum: ["percent", "flat"], default: "percent" },
    value: { type: Number, default: 10 },
    minOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    usedCount: { type: Number, default: 0 },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const ReviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", index: true },
    email: String,
    name: String,
    rating: { type: Number, min: 1, max: 5, default: 5 },
    comment: { type: String, default: "" },
  },
  { timestamps: true }
);

const MessageSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    subject: { type: String, default: "" },
    message: String,
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const SettingSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true },
    value: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

module.exports = {
  User: mongoose.model("User", UserSchema),
  Product: mongoose.model("Product", ProductSchema),
  Order: mongoose.model("Order", OrderSchema),
  Coupon: mongoose.model("Coupon", CouponSchema),
  Review: mongoose.model("Review", ReviewSchema),
  Message: mongoose.model("Message", MessageSchema),
  Setting: mongoose.model("Setting", SettingSchema),
};
