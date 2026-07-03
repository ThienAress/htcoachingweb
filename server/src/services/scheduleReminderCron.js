import TrainingSchedule from "../models/TrainingSchedule.js";
import User from "../models/User.js";
import { sendScheduleReminderMail } from "../utils/sendMail.js";

/**
 * Cron Job: Nhắc lịch tập trước 30 phút
 *
 * Chạy mỗi 5 phút. Kiểm tra lịch tập sắp diễn ra trong 30 phút tới.
 * Gửi email nhắc cho trainer và đánh dấu reminderSent = true.
 */

const INTERVAL_MS = 5 * 60 * 1000; // 5 phút
const REMINDER_MINUTES = 30; // Nhắc trước 30 phút

// Chuyển dayOfWeek JS (0=Sun) sang dayOfWeek app (0=Mon...6=Sun)
function getAppDayOfWeek() {
  const jsDay = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
  ).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

// Lấy giờ:phút hiện tại theo timezone VN
function getCurrentTimeVN() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
  );
  return { hours: now.getHours(), minutes: now.getMinutes() };
}

// Tính target time (giờ mà buổi tập bắt đầu) = now + REMINDER_MINUTES
function getTargetTime() {
  const { hours, minutes } = getCurrentTimeVN();
  const totalMin = hours * 60 + minutes + REMINDER_MINUTES;

  // Nếu vượt qua 24h (1440 phút), wrap around
  const wrappedMin = totalMin % 1440;
  const targetH = Math.floor(wrappedMin / 60);
  const targetM = wrappedMin % 60;

  return `${String(targetH).padStart(2, "0")}:${String(targetM).padStart(2, "0")}`;
}

async function checkAndSendReminders() {
  try {
    const todayDow = getAppDayOfWeek();
    const targetTime = getTargetTime();
    const { hours, minutes } = getCurrentTimeVN();
    const currentTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

    // Tìm tất cả schedule:
    // - Đúng ngày hôm nay
    // - startTime nằm trong khoảng [currentTime, currentTime + 30min + 5min buffer]
    // - Chưa gửi reminder
    // - Chưa hết hạn
    const schedules = await TrainingSchedule.find({
      dayOfWeek: todayDow,
      reminderSent: false,
      expiresAt: { $gt: new Date() },
      // startTime trong khoảng sắp tới
      // Tìm schedule có startTime <= targetTime (30p nữa)
      // và startTime > currentTime (chưa bắt đầu)
      startTime: { $gt: currentTime, $lte: targetTime },
    }).lean();

    if (schedules.length === 0) return;

    console.log(
      `⏰ [Reminder] Tìm thấy ${schedules.length} buổi tập sắp bắt đầu (${currentTime} → ${targetTime})`
    );

    // Group theo trainerId để batch query user
    const trainerIds = [...new Set(schedules.map((s) => s.trainerId.toString()))];
    const trainers = await User.find({ _id: { $in: trainerIds } })
      .select("_id name email role")
      .lean();

    const trainerMap = {};
    trainers.forEach((t) => {
      trainerMap[t._id.toString()] = t;
    });

    // Gửi email cho từng schedule
    const sentIds = [];
    for (const schedule of schedules) {
      const trainer = trainerMap[schedule.trainerId.toString()];
      if (!trainer || !trainer.email) {
        console.warn(
          `⚠️ [Reminder] Trainer ${schedule.trainerId} không có email, bỏ qua`
        );
        continue;
      }

      // Admin dùng email thật thay vì email OAuth ảo
      const recipientEmail = trainer.role === "admin"
        ? (process.env.ADMIN_REAL_EMAIL || trainer.email)
        : trainer.email;

      await sendScheduleReminderMail(recipientEmail, {
        trainerName: trainer.name || "Trainer",
        clientName: schedule.clientName,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        exerciseType: schedule.exerciseType,
        notes: schedule.notes,
      });

      sentIds.push(schedule._id);
    }

    // Đánh dấu đã gửi
    if (sentIds.length > 0) {
      await TrainingSchedule.updateMany(
        { _id: { $in: sentIds } },
        { $set: { reminderSent: true } }
      );
      console.log(`✅ [Reminder] Đã gửi ${sentIds.length} email nhắc lịch tập`);
    }
  } catch (err) {
    console.error("❌ [Reminder] Lỗi khi gửi nhắc lịch tập:", err.message);
  }
}

export function startScheduleReminderCron() {
  console.log(
    `⏰ [Reminder] Khởi động cron: nhắc lịch tập trước ${REMINDER_MINUTES} phút (check mỗi 5 phút)`
  );

  // Chạy lần đầu sau 10 giây (đợi DB connect)
  setTimeout(checkAndSendReminders, 10000);

  // Lặp lại mỗi 5 phút
  setInterval(checkAndSendReminders, INTERVAL_MS);
}
