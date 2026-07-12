// Get Workout Plan Tool — Query WorkoutPlan model (read-only)

import WorkoutPlan from "../../../models/WorkoutPlan.js";

/**
 * Lấy giáo án tập luyện của khách hàng
 * @param {{ date?: string, limit?: number }} params
 * @param {{ userId: string }} context
 * @returns {{ text: string, uiCard: object }}
 */
export async function getWorkoutPlan(params, context) {
  const { date, limit = 3 } = params;

  if (!context.userId) {
    return {
      text: "Bạn cần đăng nhập để xem giáo án. Hãy đăng nhập tại [trang đăng nhập](/login).",
      uiCard: null,
    };
  }

  const query = {
    clientId: context.userId,
    status: { $in: ["published", "completed"] },
  };

  // Nếu có ngày cụ thể, tìm giáo án gần ngày đó nhất
  if (date) {
    const targetDate = new Date(date);
    if (!isNaN(targetDate.getTime())) {
      query.planDate = {
        $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
        $lte: new Date(targetDate.setHours(23, 59, 59, 999)),
      };
    }
  }

  const plans = await WorkoutPlan.find(query)
    .sort({ planDate: -1 })
    .limit(Math.min(limit, 5))
    .lean();

  if (plans.length === 0) {
    // Nếu tìm theo ngày mà không có, thử lấy giáo án gần nhất
    if (date) {
      const latestPlan = await WorkoutPlan.findOne({
        clientId: context.userId,
        status: { $in: ["published", "completed"] },
      })
        .sort({ planDate: -1 })
        .lean();

      if (latestPlan) {
        const planDate = new Date(latestPlan.planDate).toLocaleDateString("vi-VN");
        return {
          text: `Không tìm thấy giáo án vào ngày ${date}. Giáo án gần nhất là ngày **${planDate}**: "${latestPlan.title}".`,
          uiCard: null,
        };
      }
    }

    return {
      text: "Bạn chưa có giáo án nào trong hệ thống. Liên hệ HLV để được lên giáo án tập luyện nhé!",
      uiCard: null,
    };
  }

  // Text cho LLM
  let text = `📋 **Giáo án tập luyện** (${plans.length} buổi gần nhất):\n`;

  plans.forEach((plan, i) => {
    const planDate = new Date(plan.planDate).toLocaleDateString("vi-VN");
    const exerciseCount = plan.sections?.reduce(
      (sum, sec) => sum + (sec.exercises?.length || 0),
      0
    ) || 0;
    const statusLabel = plan.status === "completed" ? "✅ Hoàn thành" : "📝 Đang tiến hành";

    text += `\n${i + 1}. **${plan.title}** (${planDate}) — ${statusLabel}`;
    text += `\n   ${exerciseCount} bài tập`;

    if (plan.sections?.length > 0) {
      const sectionNames = plan.sections.map((s) => s.name).join(", ");
      text += ` | Phần: ${sectionNames}`;
    }

    if (plan.trainerNote) {
      text += `\n   💬 HLV ghi chú: "${plan.trainerNote.substring(0, 100)}${plan.trainerNote.length > 100 ? "..." : ""}"`;
    }
  });

  // UI Card data
  const uiCard = {
    cardType: "workoutPlan",
    data: {
      plans: plans.map((plan) => ({
        title: plan.title,
        planDate: plan.planDate,
        status: plan.status,
        trainerNote: plan.trainerNote || "",
        overallAssessment: plan.overallAssessment || "",
        sections: plan.sections?.map((sec) => ({
          name: sec.name,
          icon: sec.icon || "",
          exercises: sec.exercises?.map((ex) => ({
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            tempo: ex.tempo,
            assessment: ex.assessment,
          })) || [],
        })) || [],
      })),
    },
  };

  return { text, uiCard };
}
