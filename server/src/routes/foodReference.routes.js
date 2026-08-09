import express from "express";

import { getFoodReferenceByBarcode } from "../controllers/foodReference.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { validateFoodReferenceGtin } from "../middlewares/foodReferenceLookup.js";
import { foodReferenceLookupLimiter } from "../middlewares/rateLimit.js";

const router = express.Router();

router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
});

router.get(
  "/barcode/:gtin",
  protect,
  foodReferenceLookupLimiter,
  validateFoodReferenceGtin,
  getFoodReferenceByBarcode,
);

export default router;
