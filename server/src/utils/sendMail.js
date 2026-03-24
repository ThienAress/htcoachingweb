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
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Xác nhận đăng ký</title>
      </head>
      <body style="margin:0; padding:0; background-color:#f4f4f4; font-family:'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4; padding:20px 0;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background:#ffffff; border-radius:24px; box-shadow:0 8px 20px rgba(0,0,0,0.05); overflow:hidden;">
                <!-- Header với hiệu ứng gym -->
                <tr>
                  <td style="background:linear-gradient(135deg, #1e2a3a 0%, #0f1722 100%); padding:32px 24px; text-align:center;">
                    <div style="font-size:48px; margin-bottom:8px;">🏋️‍♂️</div>
                    <h1 style="margin:0; color:#fff; font-size:28px; letter-spacing:-0.5px;">HT COACHING</h1>
                    <p style="margin:8px 0 0; color:#b0c4de; font-size:16px;">Đăng ký thành công gói tập</p>
                  </td>
                </tr>
                <!-- Nội dung chính -->
                <tr>
                  <td style="padding:32px 28px;">
                    <p style="font-size:18px; margin:0 0 12px; color:#1e2a3a;">Chào <strong style="color:#e67e22;">${order.name}</strong>,</p>
                    <p style="font-size:16px; line-height:1.5; color:#2c3e50; margin:0 0 24px;">Cảm ơn bạn đã tin tưởng lựa chọn HT Coaching. Dưới đây là thông tin đăng ký của bạn:</p>
                    
                    <table width="100%" cellpadding="12" cellspacing="0" border="0" style="background:#f9fafc; border-radius:16px; margin-bottom:24px;">
                      <tr><td style="border-bottom:1px solid #e9ecef; font-weight:600; color:#1e2a3a;">Gói tập</td><td style="color:#2c3e50;">${order.package}</td></tr>
                      <tr><td style="border-bottom:1px solid #e9ecef; font-weight:600; color:#1e2a3a;">Số buổi</td><td style="color:#2c3e50;">${order.sessions}</td></tr>
                      <tr><td style="font-weight:600; color:#1e2a3a;">Thời gian đăng ký</td><td style="color:#2c3e50;">${formatTime(order.createdAt)}</td></tr>
                    </table>
                    
                    <p style="font-size:14px; color:#6c757d; line-height:1.4; margin:0;">🔥 Hãy sẵn sàng để bắt đầu hành trình tập luyện! Mọi thắc mắc vui lòng liên hệ qua email này</p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background:#f8f9fa; padding:20px 28px; text-align:center; border-top:1px solid #e9ecef;">
                    <p style="margin:0; font-size:12px; color:#6c757d;">© 2026 HT Coaching – Nâng tầm sức mạnh</p>
                    <p style="margin:6px 0 0; font-size:12px; color:#adb5bd;">Email này được gửi tự động, vui lòng không phản hồi trực tiếp.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const res = await resend.emails.send({
      from: "HT Coaching <noreply@htcoachingweb.io.vn>",
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
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Xác nhận buổi tập</title>
      </head>
      <body style="margin:0; padding:0; background-color:#f4f4f4; font-family:'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4; padding:20px 0;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background:#ffffff; border-radius:24px; box-shadow:0 8px 20px rgba(0,0,0,0.05); overflow:hidden;">
                <!-- Header gym style -->
                <tr>
                  <td style="background:linear-gradient(135deg, #1e2a3a 0%, #0f1722 100%); padding:32px 24px; text-align:center;">
                    <div style="font-size:48px; margin-bottom:8px;">💪✅</div>
                    <h1 style="margin:0; color:#fff; font-size:28px; letter-spacing:-0.5px;">BUỔI TẬP ĐÃ XÁC NHẬN</h1>
                    <p style="margin:8px 0 0; color:#b0c4de; font-size:16px;">Check‑in thành công</p>
                  </td>
                </tr>
                <!-- Nội dung chính -->
                <tr>
                  <td style="padding:32px 28px;">
                    <p style="font-size:18px; margin:0 0 12px; color:#1e2a3a;">Chào <strong style="color:#e67e22;">${data.name}</strong>,</p>
                    <p style="font-size:16px; line-height:1.5; color:#2c3e50; margin:0 0 20px;">Buổi tập của bạn đã được ghi nhận. Dưới đây là thông tin chi tiết:</p>
                    
                    <table width="100%" cellpadding="12" cellspacing="0" border="0" style="background:#f9fafc; border-radius:16px; margin-bottom:24px;">
                      <tr><td style="border-bottom:1px solid #e9ecef; font-weight:600; color:#1e2a3a;">Gói tập</td><td style="color:#2c3e50;">${data.package}</td></tr>
                      <tr><td style="border-bottom:1px solid #e9ecef; font-weight:600; color:#1e2a3a;">Thời gian</td><td style="color:#2c3e50;">${formatTime(data.time)}</td></tr>
                      <tr><td style="border-bottom:1px solid #e9ecef; font-weight:600; color:#1e2a3a;">Nhóm cơ</td><td style="color:#2c3e50;">${data.muscle}</td></tr>
                      <tr><td style="font-weight:600; color:#1e2a3a;">Số buổi còn lại</td><td style="color:#2c3e50; font-size:20px; font-weight:bold;">${data.remainingSessions}</td></tr>
                    </table>
                    
                    <div style="background:#eef2f7; padding:16px; border-radius:14px; margin-bottom:16px; text-align:center;">
                      <p style="margin:0; font-size:14px; color:#2c3e50;">🏋️ Hãy đến đúng giờ và mang theo nước uống & khăn tập nhé!</p>
                    </div>
                    
                    <!-- Dòng thông báo tự động -->
                    <p style="font-size:12px; color:#6c757d; line-height:1.4; margin:24px 0 0; border-top:1px solid #e9ecef; padding-top:16px; text-align:center;">
                      📧 <strong>Đây là tin nhắn tự động, bạn không cần trả lời email này.</strong>
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background:#f8f9fa; padding:20px 28px; text-align:center; border-top:1px solid #e9ecef;">
                    <p style="margin:0; font-size:12px; color:#6c757d;">© 2026 HT Coaching – Đồng hành cùng bạn chinh phục mọi mục tiêu</p>                   
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const res = await resend.emails.send({
      from: "HT Coaching <noreply@htcoachingweb.io.vn>",
      to,
      subject: "💪 Xác nhận buổi tập",
      html,
    });

    console.log("✅ CHECKIN MAIL:", res);
  } catch (err) {
    console.error("❌ CHECKIN MAIL ERROR:", err);
  }
};
