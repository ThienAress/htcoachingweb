import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// format time
const formatTime = (t) =>
  new Date(t).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour12: false,
  });

// ================== CHECKIN MAIL ==================
export const sendCheckinMail = async (to, data) => {
  try {
    console.log("📧 RESEND MAIL DATA:", data);

    const html = `
      <div style="font-family: Arial; max-width:600px; margin:auto; padding:20px;">
        
        <h2 style="color:#f97316;">HT Coaching</h2>

        <h3>📅 Xác nhận buổi tập</h3>

        <p>Chào <b>${data.name}</b>,</p>

        <ul>
          <li><b>Gói:</b> ${data.package}</li>
          <li><b>Thời gian:</b> ${formatTime(data.time)}</li>
          <li><b>Nhóm cơ:</b> ${data.muscle}</li>
          <li><b>Ghi chú:</b> ${data.note || "-"}</li>
          <li><b>Còn lại:</b> ${data.remainingSessions} buổi</li>
        </ul>

        <p>💪 Tiếp tục cố gắng nhé!</p>
      </div>
    `;

    const response = await resend.emails.send({
      from: "onboarding@resend.dev", // dùng tạm domain của resend
      to,
      subject: "Xác nhận buổi tập",
      html,
    });

    console.log("✅ RESEND SUCCESS:", response);
  } catch (err) {
    console.error("❌ RESEND ERROR:", err);
  }
};
