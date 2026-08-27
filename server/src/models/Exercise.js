import mongoose from "mongoose";

export const TECHNICAL_DIFFICULTY_CRITERIA = [
  "coordination",
  "stability",
  "mobility",
  "setup",
  "errorConsequence",
];

export const deriveTechnicalDifficultyRating = (rubric) => {
  if (
    !rubric ||
    TECHNICAL_DIFFICULTY_CRITERIA.some((criterion) => {
      const value = rubric[criterion];
      return !Number.isInteger(value) || value < 0 || value > 2;
    })
  ) {
    return null;
  }

  const total = TECHNICAL_DIFFICULTY_CRITERIA.reduce(
    (sum, criterion) => sum + rubric[criterion],
    0,
  );
  if (total <= 1) return 1;
  if (total <= 3) return 2;
  if (total <= 5) return 3;
  if (total <= 7) return 4;
  return 5;
};

const technicalDifficultyCriterion = {
  type: Number,
  min: 0,
  max: 2,
  validate: {
    validator: Number.isInteger,
    message: "Tiêu chí độ phức tạp kỹ thuật phải là số nguyên",
  },
};

const technicalDifficultySchema = new mongoose.Schema(
  {
    coordination: technicalDifficultyCriterion,
    stability: technicalDifficultyCriterion,
    mobility: technicalDifficultyCriterion,
    setup: technicalDifficultyCriterion,
    errorConsequence: technicalDifficultyCriterion,
    rationale: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  { _id: false },
);

const exerciseInstructionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
  },
  { _id: false },
);

const exerciseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    muscleGroup: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    videoUrl: {
      type: String,
      default: "",
    },
    videoPublicId: {
      type: String,
      default: "",
      select: false,
    },
    imageUrl: {
      type: String,
      default: "",
    },
    instructions: {
      type: [exerciseInstructionSchema],
      default: [],
      validate: {
        validator: (steps) => steps.length <= 30,
        message: "Hướng dẫn setup tối đa 30 bước",
      },
    },
    technicalDifficulty: {
      type: technicalDifficultySchema,
      default: undefined,
    },
  },
  {
    timestamps: true,
  },
);

exerciseSchema.index({ name: "text" });
exerciseSchema.index({ muscleGroup: 1 });

export default mongoose.model("Exercise", exerciseSchema);
