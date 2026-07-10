import "./env.js";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const isEmailVerified = profile.emails?.[0]?.verified !== false;

        if (!email || !isEmailVerified) {
          return done(null, false, { message: "Email Google chưa được xác thực" });
        }

        // Check admin email từ env (dùng chung biến ADMIN_EMAIL, hỗ trợ nhiều email cách nhau bởi dấu phẩy)
        const adminEmails = process.env.ADMIN_EMAIL
          ? process.env.ADMIN_EMAIL.split(",").map((e) => e.trim().toLowerCase())
          : [];
        const isAdminEmail = adminEmails.includes(email.toLowerCase());

        let user = await User.findOne({ email });

        if (user) {
          // Nếu email thuộc danh sách admin nhưng role chưa đúng → cập nhật
          if (isAdminEmail && user.role !== "admin") {
            user.role = "admin";
            await user.save();
          }
          return done(null, user);
        }

        // User mới — auto set admin nếu email trùng
        user = await User.create({
          name: profile.displayName,
          email,
          avatar: profile.photos?.[0]?.value || "",
          role: isAdminEmail ? "admin" : "user",
        });

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    },
  ),
);
