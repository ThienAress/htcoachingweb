import nodemailer from "nodemailer";

const formatTime = (t) =>
  new Date(t).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour12: false,
  });

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "hoangthiengym99@gmail.com",
    pass: "wnol ineq rjuy vxox",
  },
});

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

        <div style="text-align:center; margin-top:20px;">
          <a href="http://localhost:5173"
             style="background:#f97316; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">
             Xem chi tiết
          </a>
        </div>

        <p style="margin-top:20px;">Cảm ơn bạn đã tin tưởng HT Coaching 💪</p>

        <hr style="margin-top:30px;" />

        <p style="font-size:12px; color:#888; text-align:center;">
          © 2026 HT Coaching. All rights reserved.
        </p>

      </div>
    `;

    const info = await transporter.sendMail({
      from: `"HT Coaching" <yourgmail@gmail.com>`,
      to,
      subject,
      html,
    });

    console.log("MAIL SENT:", info.response);
  } catch (err) {
    console.error("SEND MAIL ERROR:", err);
  }
};

export const sendCheckinMail = async (to, data) => {
  const html = `
    <div style="font-family: Arial; max-width:600px; margin:auto; padding:20px;">
      
      <h2 style="color:#f97316;">HT Coaching</h2>

      <h3>📅 Xác nhận buổi tập</h3>

      <p>Chào <b>${data.name}</b>,</p>

      <p>Thông tin trước buổi tập:</p>

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

  await transporter.sendMail({
    from: `"HT Coaching" <yourgmail@gmail.com>`,
    to,
    subject: "Xác nhận buổi tập",
    html,
  });
};
