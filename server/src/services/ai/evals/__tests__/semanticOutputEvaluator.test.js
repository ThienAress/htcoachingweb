import { describe, expect, it } from "vitest";

import { evaluateSemanticOutput } from "../semanticOutputEvaluator.js";
import { buildScopePreservationFallback, parseScopePreservationRequest } from "../../scopePreservation.js";

const workoutRequest =
  "Tạo lịch tăng cơ 4 ngày/tuần cho người mới, chỉ có đôi tạ đơn điều chỉnh và dây kháng lực.";
const workoutText = [
  "Buổi 1: Dumbbell Floor Press trên sàn — 3 hiệp x 10 lần, RPE 8, nghỉ 90 giây.",
  "Buổi 2: Goblet Squat — 3 hiệp x 10 lần, RPE 8, nghỉ 90 giây.",
  "Buổi 3: Resistance Band Row — 3 hiệp x 12 lần, RPE 8, nghỉ 60 giây.",
  "Buổi 4: Dumbbell Romanian Deadlift — 3 hiệp x 10 lần, RPE 8, nghỉ 90 giây.",
  "Tuần deload giảm khoảng 30% volume.",
].join("\n");

const mealCard = ({ adjustments = [] } = {}) => ({
  cardType: "meal",
  data: {
    status: "complete",
    totals: { protein: 160, carb: 280, fat: 82.2, calories: 2499.8 },
    meals: Array.from({ length: 4 }, (_, index) => ({
      totals: { protein: 40, carb: 70, fat: 20.55, calories: 624.95 },
      foods: [{
        foodId: `food-${index + 1}`,
        name: `Món ${index + 1}`,
        macros: { protein: 40, carb: 70, fat: 20.55 },
        calories: 624.95,
      }],
    })),
    price: { status: "verified" },
    safety: {
      status: "verified",
      allergenConstraintsApplied: true,
    },
    adjustments,
  },
});

const sevenDayPlan = Array.from({ length: 7 }, (_, index) => [
  `Ngày ${index + 1}:`,
  "- Ăn uống: ba bữa chính với nguồn protein, rau và tinh bột phù hợp.",
  `- Tập luyện: ${index % 2 === 0 ? "tập sức mạnh toàn thân" : "đi bộ phục hồi"} trong 30 phút.`,
].join("\n")).join("\n");

describe("evaluateSemanticOutput", () => {
  it("reports a missing scoped adjustment as a closed failure instead of throwing", () => {
    expect(evaluateSemanticOutput({ output: { cards: [{
      cardType: "meal", data: { status: "missing_data", reason: "scoped_adjustment_impossible" },
    }] }, rules: [{ type: "scoped_meal_adjustment", allowedFoodIds: ["rice", "oil"] }] }))
      .toEqual(["scoped meal adjustments are missing"]);
  });

  it("accepts a negated workout mutation in the server's deficit-only fallback", () => {
    const request = parseScopePreservationRequest(
      "Giữ nguyên toàn bộ kế hoạch vừa rồi nhưng đổi mức thâm hụt từ 300 kcal thành 700 kcal. Giải thích phần nào đã thay đổi.",
    );
    const text = buildScopePreservationFallback(request);
    expect(evaluateSemanticOutput({ output: { text }, rules: [
      { type: "preserve_scope", changedValue: "700 kcal" },
    ] })).toEqual([]);
  });

  it("still rejects an unapproved workout change after a deficit-only request", () => {
    for (const text of [
      "Chỉ mức thâm hụt thay đổi thành 700 kcal; lịch tập và mọi phần khác giữ nguyên. Đồng thời giảm lịch tập từ 4 buổi xuống 3 buổi.",
      "Chỉ mức thâm hụt thay đổi thành 700 kcal; mọi phần khác giữ nguyên. Mình chưa tự thay đổi lịch tập, nhưng giảm số buổi từ 4 xuống 3.",
    ]) {
      expect(evaluateSemanticOutput({ output: { text }, rules: [
        { type: "preserve_scope", changedValue: "700 kcal" },
      ] })).toContain("coaching advisory changed the requested plan without permission");
    }
  });

  it("accepts normalized oracle observations for the 11-question semantic rules", () => {
    const results = [
      evaluateSemanticOutput({
        output: { cards: [mealCard()] },
        rules: [{ type: "meal_numeric", targetCalories: 2500, toleranceCalories: 100, minimumProteinGrams: 150 }],
      }),
      evaluateSemanticOutput({
        output: {
          cards: [{
            cardType: "exercise",
            data: {
              requestedCount: 5,
              resultCount: 5,
              catalogInsufficient: false,
              exercises: Array.from({ length: 5 }, (_, index) => ({ name: `Bodyweight Push-up ${index + 1}` })),
            },
          }],
        },
        rules: [{ type: "exercise_card", requestedCount: 5, forbiddenTerms: ["barbell", "machine"] }],
      }),
      evaluateSemanticOutput({
        output: { text: workoutText, cards: [] },
        rules: [
          { type: "workout_structure", minDays: 4, request: workoutRequest, requireDeload: true },
          { type: "no_flat_exercise_card" },
        ],
      }),
      evaluateSemanticOutput({
        output: {
          text: "Đã đổi mức thâm hụt từ 300 kcal thành 700 kcal. Chỉ mức thâm hụt thay đổi; toàn bộ thực đơn và lịch tập giữ nguyên. Thâm hụt sâu có thể ảnh hưởng phục hồi; bạn có muốn mình đánh giá lại lịch tập không?",
        },
        rules: [{ type: "preserve_scope", changedValue: "700 kcal" }],
      }),
      evaluateSemanticOutput({
        output: { text: sevenDayPlan },
        rules: [{ type: "seven_day_coverage", requireMealAndTraining: true }],
      }),
      evaluateSemanticOutput({
        output: { trace: { conversationId: "c1", retryConversationId: "c1", turnId: "t1", retryTurnId: "t1" } },
        rules: [{ type: "retry_continuity", conversationId: "c1", turnId: "t1" }],
      }),
      evaluateSemanticOutput({
        output: { cards: [mealCard()] },
        rules: [{ type: "meal_safety_price", priceRequired: true }],
      }),
      evaluateSemanticOutput({
        output: { cards: [mealCard({ adjustments: [{ foodId: "rice", name: "Cơm trắng" }] })] },
        rules: [{ type: "scoped_meal_adjustment", allowedFoodIds: ["rice", "oil"] }],
      }),
      evaluateSemanticOutput({
        output: {
          text: "Thông tin đã xác minh từ [nguồn công khai](https://example.org/ronaldo).",
          trace: { webSearchOutcome: "grounded" },
        },
        rules: [{ type: "web_search" }],
      }),
      evaluateSemanticOutput({
        output: {
          text: [
            "TDEE là ước tính; mình cần tối đa 5 nhóm thông tin sau:",
            "1. Giới tính, tuổi, chiều cao và cân nặng hiện tại?",
            "2. Mục tiêu của bạn là giảm mỡ, tăng cơ hay giữ cân?",
            "3. Công việc, số bước và số buổi tập mỗi tuần?",
            "4. Kinh nghiệm tập và thiết bị hiện có?",
            "5. Bạn có chấn thương nào cần lưu ý không?",
          ].join("\n"),
        },
        rules: [{ type: "intake_questions", requestType: "workout" }],
      }),
    ];

    expect(results.flat()).toEqual([]);
  });

  it("fails from the observed output instead of trusting precomputed pass flags", () => {
    const brokenMeal = mealCard({
      adjustments: [{ foodId: "chicken", name: "Ức gà" }],
    });
    brokenMeal.data.totals = { protein: 90, carb: 100, fat: 20, calories: 2500 };
    brokenMeal.data.meals = [{ totals: { calories: 900 } }];
    brokenMeal.data.price = { status: "unverified" };
    const failures = [
      ...evaluateSemanticOutput({
        output: { cards: [brokenMeal] },
        rules: [
          { type: "meal_numeric", targetCalories: 2500, toleranceCalories: 25, minimumProteinGrams: 150 },
          { type: "meal_safety_price", priceRequired: true },
          { type: "scoped_meal_adjustment", allowedFoodIds: ["rice"] },
        ],
      }),
      ...evaluateSemanticOutput({
        output: {
          text: "Buổi 1: Barbell Bench Press. Deload còn 30%.",
          cards: [{ cardType: "exercise", data: { catalogInsufficient: true, exercises: [{ name: "Barbell Bench Press" }] } }],
        },
        rules: [
          { type: "exercise_card", requestedCount: 5, forbiddenTerms: ["barbell"] },
          { type: "workout_structure", minDays: 4, request: workoutRequest, requireDeload: true },
          { type: "no_flat_exercise_card" },
          { type: "seven_day_coverage" },
        ],
      }),
      ...evaluateSemanticOutput({
        output: {
          trace: { conversationId: "c2", retryConversationId: "c3", turnId: "t2", retryTurnId: "t3", webSearchOutcome: "provider_error" },
          text: [
            "Đã đổi sang thâm hụt 700 kcal và giảm lịch tập từ 4 buổi xuống 3 buổi.",
            "TDEE chính xác.",
            "1. Giới tính?",
            "2. Tuổi?",
            "3. Chiều cao?",
            "4. Cân nặng?",
            "5. Dị ứng thực phẩm?",
            "6. Chế độ ăn?",
          ].join("\n"),
        },
        rules: [
          { type: "preserve_scope", changedValue: "700 kcal" },
          { type: "retry_continuity", conversationId: "c2", turnId: "t2" },
          { type: "web_search" },
          { type: "intake_questions", requestType: "workout" },
        ],
      }),
    ];

    expect(failures).toEqual(expect.arrayContaining([
      expect.stringContaining("4P + 4C + 9F"),
      expect.stringContaining("below minimum"),
      expect.stringContaining("exercise count"),
      expect.stringContaining("flat exercise card"),
      expect.stringContaining("locked plan"),
      expect.stringContaining("retry continuity"),
      expect.stringContaining("web search"),
      expect.stringContaining("intake question count"),
    ]));
  });

  it("rejects meal cards whose food items contradict the meal and plan totals", () => {
    const inconsistentMeal = mealCard();
    inconsistentMeal.data.meals = inconsistentMeal.data.meals.map((meal, index) => ({
      ...meal,
      foods: [{
        foodId: `food-${index + 1}`,
        name: `Món ${index + 1}`,
        macros: { protein: 0, carb: 0, fat: 0 },
        calories: 0,
      }],
    }));

    const failures = evaluateSemanticOutput({
      output: { cards: [inconsistentMeal] },
      rules: [{
        type: "meal_numeric",
        targetCalories: 2500,
        toleranceCalories: 100,
        minimumProteinGrams: 150,
      }],
    });

    expect(failures).toEqual(expect.arrayContaining([
      expect.stringContaining("food items"),
    ]));
  });

  it("rejects seven bare day labels without user-visible meal and training content", () => {
    const failures = evaluateSemanticOutput({
      output: {
        text: "Ngày 1, Ngày 2, Ngày 3, Ngày 4, Ngày 5, Ngày 6, Ngày 7",
      },
      rules: [{ type: "seven_day_coverage", requireMealAndTraining: true }],
    });

    expect(failures).toContain("seven-day plan is missing meal or training detail for at least one day");
  });

  it("evaluates the persisted assistant DTO shape used by the controller", () => {
    const failures = evaluateSemanticOutput({
      output: {
        assistantMessage: {
          content: "Thông tin đã xác minh từ [nguồn công khai](https://example.org/ronaldo).",
          answerTrace: { webSearchOutcome: "grounded" },
        },
        cards: [],
      },
      rules: [{ type: "web_search" }],
    });

    expect(failures).toEqual([]);
  });

  it("accepts ingredient-level evidence only with an explicit product-label warning", () => {
    const limited = mealCard();
    limited.data.safety = {
      status: "ingredient_verified",
      allergenConstraintsApplied: true,
      crossContactStatus: "product_label_required",
      warning: "Hãy kiểm tra nhãn sản phẩm và xác nhận với nhà sản xuất trước khi dùng.",
    };

    expect(evaluateSemanticOutput({
      output: { text: limited.data.safety.warning, cards: [limited] },
      rules: [{ type: "meal_safety_price", priceRequired: true }],
    })).toEqual([]);

    expect(evaluateSemanticOutput({
      output: { text: "Đã kiểm tra dị ứng.", cards: [limited] },
      rules: [{ type: "meal_safety_price", priceRequired: true }],
    })).toContain("ingredient-level allergen evidence lacks a visible product-label warning");
  });

  it("rejects ingredient-only evidence when package-label safety is required", () => {
    const limited = mealCard();
    limited.data.safety = {
      status: "ingredient_verified",
      allergenConstraintsApplied: true,
      crossContactStatus: "product_label_required",
      warning: "Hãy kiểm tra nhãn sản phẩm trước khi dùng.",
    };

    expect(evaluateSemanticOutput({
      output: { text: limited.data.safety.warning, cards: [limited] },
      rules: [{
        type: "meal_safety_price",
        priceRequired: true,
        requirePackageLabelSafety: true,
      }],
    })).toContain("meal allergy constraint requires package-label verification");
  });
});
