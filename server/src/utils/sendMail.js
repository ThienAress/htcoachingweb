import nodemailer from "nodemailer";

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

// 🔥 dùng ENV (QUAN TRỌNG)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ================== ORDER MAIL ==================
export const sendMail = async (to, subject, order) => {
  try {
    console.log("SEND MAIL DATA:", order);

    const html = `
      <div style="font-family: Arial; max-width:600px; margin:auto; border:1px solid #eee; padding:20px; border-radius:8px;">
        
        <h2 style="color:#f97316; text-align:center;">HT Coaching</h2>

        <h3 style="text-align:center;">🎉 Xác nhận đăng ký thành công</h3>

        <p>Chào <b>${order?.name || "Khách hàng"}</b>,</p>

        <p>Bạn đã đăng ký gói tập thành công với thông tin sau:</p>

        <table style="width:100%; border-collapse: collapse; margin-top:10px;">
          <tr>
            <td style="padding:8px;"><b>Gói tập:</b></td>
            <td style="padding:8px;">${order?.package || ""}</td>
          </tr>

          <tr>
            <td style="padding:8px;"><b>Số buổi:</b></td>
            <td style="padding:8px;">${order?.sessions || ""}</td>
          </tr>

          <tr>
            <td style="padding:8px;"><b>Phòng tập:</b></td>
            <td style="padding:8px;">${order?.gym || ""}</td>
          </tr>

          <tr>
            <td style="padding:8px;"><b>Thời gian:</b></td>
            <td style="padding:8px;">${order?.schedule || ""}</td>
          </tr>
        </table>

        <p style="margin-top:20px;">Cảm ơn bạn đã tin tưởng HT Coaching 💪</p>

      </div>
    `;

    const info = await transporter.sendMail({
      from: `"HT Coaching" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("MAIL SENT:", info.response);
  } catch (err) {
    console.error("SEND MAIL ERROR:", err);
  }
};

// ================== CHECKIN MAIL ==================
export const sendCheckinMail = async (to, data) => {
  try {
    console.log("CHECKIN MAIL DATA:", data);

    const html = `
      <div style="font-family: Arial; max-width:600px; margin:auto; padding:20px;">
        
        <h2 style="color:#f97316;">HT Coaching</h2>

        <h3>📅 Xác nhận buổi tập</h3>

        <p>Chào <b>${data.name}</b>,</p>

        <p>Thông tin buổi tập:</p>

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

    const info = await transporter.sendMail({
      from: `"HT Coaching" <${process.env.EMAIL_USER}>`,
      to,
      subject: "Xác nhận buổi tập",
      html,
    });

    console.log("CHECKIN MAIL SENT:", info.response);
  } catch (err) {
    console.error("CHECKIN MAIL ERROR:", err);
  }
};
