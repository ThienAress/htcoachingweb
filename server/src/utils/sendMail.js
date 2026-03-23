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

// ================== ORDER MAIL ==================
export const sendMail = async (to, subject, order) => {
  try {
    const html = `
      <div style="font-family: Arial; padding:20px;">
        <h2>🎉 Đăng ký thành công</h2>
        <p>Chào <b>${order.name}</b></p>
        <p>Gói: ${order.package}</p>
        <p>Số buổi: ${order.sessions}</p>
      </div>
    `;

    const res = await resend.emails.send({
      from: "onboarding@resend.dev",
      to,
      subject,
      html,
    });

    console.log("✅ ORDER MAIL:", res);
  } catch (err) {
    console.error("❌ ORDER MAIL ERROR:", err);
  }
};

// ================== CHECKIN MAIL ==================
export const sendCheckinMail = async (to, data) => {
  try {
    const html = `
      <div style="font-family: Arial; padding:20px;">
        <h2>📅 Xác nhận buổi tập</h2>
        <p>Chào <b>${data.name}</b></p>
        <ul>
          <li>Gói: ${data.package}</li>
          <li>Thời gian: ${formatTime(data.time)}</li>
          <li>Nhóm cơ: ${data.muscle}</li>
          <li>Còn lại: ${data.remainingSessions}</li>
        </ul>
      </div>
    `;

    const res = await resend.emails.send({
      from: "onboarding@resend.dev",
      to,
      subject: "Xác nhận buổi tập",
      html,
    });

    console.log("✅ CHECKIN MAIL:", res);
  } catch (err) {
    console.error("❌ CHECKIN MAIL ERROR:", err);
  }
};
