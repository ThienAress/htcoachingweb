import dns from "dns";
import "../src/config/env.js";

if (process.env.NODE_ENV !== "production") {
  dns.setServers(["1.1.1.1", "1.0.0.1"]);
}

import connectDB from "../src/config/db.js";
import Food from "../src/models/Food.js";
import mongoose from "mongoose";

const roundToOneDecimal = (val) => {
  if (typeof val !== "number") return val;
  return Math.round(val * 10) / 10;
};

const roundAllFoods = async () => {
  try {
    await connectDB();
    const foods = await Food.find({});
    console.log(`Đang quét ${foods.length} thực phẩm trong database...`);
    
    let updatedCount = 0;
    for (const food of foods) {
      const newProtein = roundToOneDecimal(food.protein);
      const newCarb = roundToOneDecimal(food.carb);
      const newFat = roundToOneDecimal(food.fat);
      const newCalories = roundToOneDecimal(food.calories);
      
      // Chỉ lưu nếu có thay đổi thực tế
      if (
        newProtein !== food.protein ||
        newCarb !== food.carb ||
        newFat !== food.fat ||
        newCalories !== food.calories
      ) {
        food.protein = newProtein;
        food.carb = newCarb;
        food.fat = newFat;
        food.calories = newCalories;
        await food.save();
        updatedCount++;
      }
    }
    
    console.log(`ROUND_SUCCESS: Đã làm tròn thành công ${updatedCount} thực phẩm trong DB.`);
    await mongoose.connection.close();
  } catch (error) {
    console.error("ROUND_ERROR:", error.message);
    process.exit(1);
  }
};

roundAllFoods();
