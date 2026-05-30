import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,

  password: String,
  role: {
    type: String,
    enum: ["admin", "trainer", "user"],
    default: "user",
  },

  avatar: String,
  address: String,

  mealPlanGenerations: {
    type: Number,
    default: 0,
  },

  refreshToken: {
    type: String,
    default: null,
  },
});
// ✅ Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });

export default mongoose.model("User", userSchema);
