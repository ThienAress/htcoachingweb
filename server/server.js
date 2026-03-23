import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import passport from "passport";

import connectDB from "./src/config/db.js";
import "./src/config/passport.js";

import authRoutes from "./src/routes/auth.routes.js";
import userRoutes from "./src/routes/user.routes.js";
import orderRoutes from "./src/routes/order.routes.js";
import checkinRoutes from "./src/routes/checkin.routes.js";

import bcrypt from "bcryptjs";
import User from "./src/models/User.js";
import Order from "./src/models/Order.js";

// ✅ TẠO APP (QUAN TRỌNG)
const app = express();

// ✅ CONNECT DATABASE
connectDB();

// ✅ MIDDLEWARE
app.use(
  cors({
    origin: ["http://localhost:5173", "https://htcoachingweb.netlify.app"],
    credentials: true,
  }),
);

app.use(express.json());
app.use(passport.initialize());

// ✅ ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/checkin", checkinRoutes);

// ✅ CREATE ADMIN (chỉ chạy 1 lần)
app.get("/create-admin", async (req, res) => {
  try {
    const existing = await User.findOne({ email: "admin@gmail.com" });

    if (existing) {
      return res.json({ message: "Admin đã tồn tại" });
    }

    const hashedPassword = await bcrypt.hash("123456", 10);

    const admin = await User.create({
      name: "Admin",
      email: "admin@gmail.com",
      password: hashedPassword,
      role: "admin",
    });

    res.json(admin);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ FIX USERID CHO ORDER
app.get("/fix-userid", async (req, res) => {
  try {
    const orders = await Order.find();

    let updated = 0;

    for (let o of orders) {
      const user = await User.findOne({
        email: o.email?.toLowerCase().trim(),
      });

      if (user) {
        o.userId = user._id;
        await o.save();
        updated++;
      }
    }

    res.json({ updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi fix userId" });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server chạy tại port ${process.env.PORT}`);
});
