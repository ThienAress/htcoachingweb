import mongoose from "mongoose";

const f1AiRuleConditionSchema = new mongoose.Schema({
  field: {
    type: String,
    required: true,
    // e.g., "customer.healthScreening.hasPainNow", "customer.bodyMetrics.bmi"
  },
  operator: {
    type: String,
    required: true,
    enum: ["EQUals", "NOT_EQUals", "GREATER_THAN", "LESS_THAN", "INCLUDES", "NOT_INCLUDES", "EXISTS", "NOT_EXISTS", "TRUE", "FALSE"],
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    // e.g., true, 25, "fat_loss", ["chest_pain", "dizziness"]
  },
});

const f1AiRuleSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      // e.g., "HOLD_TEST_PAIN", "CARDIO_FAT_LOSS"
    },
    name: {
      type: String,
      required: true,
      // e.g., "Ngừng test nếu đang đau"
    },
    category: {
      type: String,
      required: true,
      enum: ["hold_test", "general_advice", "special_care", "cardio", "resistance", "flexibility", "nutrition", "other"],
      // Used to group rules in the report
    },
    description: {
      type: String,
      // Internal description for admin
    },
    priority: {
      type: Number,
      default: 0,
      // Higher priority rules evaluated first, or to order output
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // The conditions to evaluate. Evaluated as AND (all conditions must pass).
    // For OR, create multiple rules with the same output, or support complex expressions later.
    conditions: [f1AiRuleConditionSchema],
    
    // The output recommendation if conditions are met
    recommendation: {
      title: { type: String }, // Optional heading
      content: { type: String, required: true }, // The actual advice text, supports variables like {{customer.fullName}}
    },
    
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }
  },
  { timestamps: true }
);

// Indexes for faster lookup
f1AiRuleSchema.index({ category: 1, isActive: 1 });
f1AiRuleSchema.index({ code: 1 });

const F1AiRule = mongoose.model("F1AiRule", f1AiRuleSchema);
export default F1AiRule;
