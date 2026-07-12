// Get Training Schedule Tool — Query TrainingSchedule + CoachingDay (read-only)

import TrainingSchedule from "../../../models/TrainingSchedule.js";
import CoachingDay from "../../../models/CoachingDay.js";

const DAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

/**
 * Lấy lịch tập + giáo án coaching hôm nay/tuần này
 * @param {{ includeWorkout?: boolean }} params
 * @param {{ userId: string }} context
 */
export async function getTrainingSchedule(params, context) {
  try {
    const { includeWorkout = true } = params;

    if (!context.userId) {
      return {
        text: "Bạn cần đăng nhập để xem lịch tập. Hãy đăng nhập tại [trang đăng nhập](/login).",
        uiCard: null,
      };
    }

    // Lấy lịch tập theo clientId
    const schedules = await TrainingSchedule.find({ clientId: context.userId })
      .sort({ dayOfWeek: 1, startTime: 1 })
      .lean();

    // Lấy ngày hôm nay (Vietnam timezone)
    const now = new Date();
    const vnOffset = 7 * 60;
    const vnTime = new Date(now.getTime() + (vnOffset + now.getTimezoneOffset()) * 60000);
    // dayOfWeek trong model: 0=Thứ 2, ..., 6=CN
    // JS getDay(): 0=CN, 1=Thứ 2, ...
    const jsDay = vnTime.getDay();
    const todayIndex = jsDay === 0 ? 6 : jsDay - 1; // Convert: CN=6, T2=0, ...
    const todayStr = vnTime.toISOString().split("T")[0]; // YYYY-MM-DD

    // Lọc lịch hôm nay
    const todaySchedules = schedules.filter((s) => s.dayOfWeek === todayIndex);

    // Lấy coaching day (giáo án online coaching) hôm nay nếu cần
    let todayCoaching = null;
    if (includeWorkout) {
      todayCoaching = await CoachingDay.findOne({
        userId: context.userId,
        dateString: todayStr,
      }).lean();
    }

    // === Build text ===
    let text = "";

    if (schedules.length === 0 && !todayCoaching) {
      return {
        text: "Bạn chưa có lịch tập trong hệ thống. Liên hệ HLV để được xếp lịch tập nhé! Xem [Đội ngũ HLV](/huan-luyen-vien).",
        uiCard: null,
      };
    }

    // --- Lịch hôm nay ---
    text += `📅 **Lịch tập hôm nay (${DAY_LABELS[todayIndex]}, ${vnTime.toLocaleDateString("vi-VN")}):**\n`;

    if (todaySchedules.length > 0) {
      todaySchedules.forEach((s) => {
        text += `\n🕐 **${s.startTime} - ${s.endTime}** — ${s.exerciseType}`;
        if (s.notes) text += `\n   📝 HLV ghi chú: "${s.notes}"`;
      });
    } else {
      text += "\nHôm nay bạn không có lịch tập. Nghỉ ngơi cho cơ thể phục hồi nhé! 💪";
    }

    // --- Giáo án coaching hôm nay ---
    if (todayCoaching) {
      text += `\n\n🏋️ **Giáo án hôm nay: ${todayCoaching.title}**`;

      if (todayCoaching.note) {
        text += `\n💬 Lời dặn HLV: "${todayCoaching.note.substring(0, 150)}"`;
      }

      if (todayCoaching.exercises?.length > 0) {
        text += `\n\n📋 Danh sách bài tập (${todayCoaching.exercises.length} bài):`;
        todayCoaching.exercises.forEach((ex, i) => {
          const status = ex.completed ? "✅" : "⬜";
          text += `\n${status} ${i + 1}. **${ex.name}** — ${ex.sets} sets × ${ex.reps} reps`;
          if (ex.weight && ex.weight !== "60s") text += ` (${ex.weight})`;
        });

        const completed = todayCoaching.exercises.filter((e) => e.completed).length;
        const total = todayCoaching.exercises.length;
        text += `\n\n📊 Hoàn thành: **${completed}/${total}** bài tập`;
      }

      if (todayCoaching.videoUrl) {
        text += `\n🎥 [Xem video hướng dẫn](${todayCoaching.videoUrl})`;
      }
    } else if (todaySchedules.length > 0 && includeWorkout) {
      text += "\n\n💡 Chưa có giáo án chi tiết hôm nay. HLV sẽ cập nhật sớm!";
    }

    // --- Lịch cả tuần (tóm tắt) ---
    if (schedules.length > 0) {
      text += "\n\n📆 **Lịch tập cả tuần:**";
      for (let d = 0; d < 7; d++) {
        const daySchedules = schedules.filter((s) => s.dayOfWeek === d);
        if (daySchedules.length > 0) {
          const isToday = d === todayIndex;
          const label = isToday ? `**${DAY_LABELS[d]} (hôm nay)**` : DAY_LABELS[d];
          const times = daySchedules.map((s) => `${s.startTime} ${s.exerciseType}`).join(", ");
          text += `\n• ${label}: ${times}`;
        }
      }
    }

    text += `\n\nXem chi tiết tại [Lịch tập](/trainer/schedule).`;

    // UI Card
    const uiCard = {
      cardType: "trainingSchedule",
      data: {
        todayLabel: `${DAY_LABELS[todayIndex]} ${vnTime.toLocaleDateString("vi-VN")}`,
        todaySchedules: todaySchedules.map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          exerciseType: s.exerciseType,
          notes: s.notes || "",
        })),
        coachingDay: todayCoaching
          ? {
              title: todayCoaching.title,
              note: todayCoaching.note || "",
              exercises: todayCoaching.exercises?.map((ex) => ({
                name: ex.name,
                sets: ex.sets,
                reps: ex.reps,
                weight: ex.weight || "",
                completed: ex.completed,
              })) || [],
              clientStatus: todayCoaching.clientStatus,
            }
          : null,
        weekSchedule: schedules.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          dayLabel: DAY_LABELS[s.dayOfWeek],
          startTime: s.startTime,
          endTime: s.endTime,
          exerciseType: s.exerciseType,
        })),
      },
    };

    return { text, uiCard };
  } catch {
    return {
      text: "Chưa có dữ liệu lịch tập. Bạn có thể liên hệ HLV để được xếp lịch nhé!",
      uiCard: null,
    };
  }
}
