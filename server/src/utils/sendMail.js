import { Resend } from "resend";
import escapeHtml from "escape-html";
import { safeLog } from "./safeLogger.js";

const resend = new Resend(process.env.RESEND_API_KEY);

const deliverEmail = async (message) => {
  if (
    String(process.env.EMAIL_DELIVERY_MODE || "").toLowerCase() === "disabled"
  ) {
    safeLog.warn("mail.delivery_disabled", "Outbound email is disabled", {
      template: "staging",
    });
    return { data: { id: "" } };
  }
  return resend.emails.send(message);
};

const formatDate = (t) => {
  if (!t) return "Chưa xác nhận";
  return new Date(t).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour12: false,
  });
};

const formatTime = (t) => {
  if (!t) return "Không xác định";
  return new Date(t).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour12: false,
  });
};

// Helper để escape
const safe = (str) => (str ? escapeHtml(str) : "");

// ORDER MAIL
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
                <tr>
                  <td style="background:linear-gradient(135deg, #1e2a3a 0%, #0f1722 100%); padding:32px 24px; text-align:center;">
                    <div style="font-size:48px; margin-bottom:8px;">🏋️‍♂️</div>
                    <h1 style="margin:0; color:#fff; font-size:28px; letter-spacing:-0.5px;">HT COACHING</h1>
                    <p style="margin:8px 0 0; color:#b0c4de; font-size:16px;">Đăng ký thành công gói tập</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 28px;">
                    <p style="font-size:18px; margin:0 0 12px; color:#1e2a3a;">Chào <strong style="color:#e67e22;">${safe(order.name)}</strong>,</p>
                    <p style="font-size:16px; line-height:1.5; color:#2c3e50; margin:0 0 24px;">Cảm ơn bạn đã tin tưởng lựa chọn HT Coaching. Dưới đây là thông tin đăng ký của bạn:</p>
                    
                    <table width="100%" cellpadding="12" cellspacing="0" border="0" style="background:#f9fafc; border-radius:16px; margin-bottom:24px;">
                      <tr><td style="border-bottom:1px solid #e9ecef; font-weight:600; color:#1e2a3a;">Gói tập</td><td style="color:#2c3e50;">${safe(order.package)}</td></tr>
                      <tr><td style="border-bottom:1px solid #e9ecef; font-weight:600; color:#1e2a3a;">Số buổi</td><td style="color:#2c3e50;">${safe(order.sessions)}</td></tr>
                      <tr><td style="font-weight:600; color:#1e2a3a;">Thời gian đăng ký</td><td style="color:#2c3e50;">${formatDate(order.approvedAt)}</td></tr>
                    </table>
                    
                    <p style="font-size:14px; color:#6c757d; line-height:1.4; margin:0;">🔥 Hãy sẵn sàng để bắt đầu hành trình tập luyện! Mọi thắc mắc vui lòng liên hệ qua email này</p>
                  </td>
                </tr>
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

    const response = await deliverEmail({
      from: "HT Coaching <noreply@htcoachingweb.io.vn>",
      to,
      subject,
      html,
      headers: { "X-Entity-Ref-ID": Date.now().toString() },
    });
    safeLog.info("mail.sent", {
      template: "order",
      providerMessageId: response?.data?.id || "",
    });
  } catch (err) {
    safeLog.error("mail.order_failed", err);
  }
};

// CHECKIN MAIL
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
                <tr>
                  <td style="background:linear-gradient(135deg, #1e2a3a 0%, #0f1722 100%); padding:32px 24px; text-align:center;">
                    <div style="font-size:48px; margin-bottom:8px;">💪✅</div>
                    <h1 style="margin:0; color:#fff; font-size:28px; letter-spacing:-0.5px;">BUỔI TẬP ĐÃ XÁC NHẬN</h1>
                    <p style="margin:8px 0 0; color:#b0c4de; font-size:16px;">Check‑in thành công</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 28px;">
                    <p style="font-size:18px; margin:0 0 12px; color:#1e2a3a;">Chào <strong style="color:#e67e22;">${safe(data.name)}</strong>,</p>
                    <p style="font-size:16px; line-height:1.5; color:#2c3e50; margin:0 0 20px;">Buổi tập của bạn đã được ghi nhận. Dưới đây là thông tin chi tiết:</p>
                    
                    <table width="100%" cellpadding="12" cellspacing="0" border="0" style="background:#f9fafc; border-radius:16px; margin-bottom:24px;">
                      <tr><td style="border-bottom:1px solid #e9ecef; font-weight:600; color:#1e2a3a;">Gói tập</td><td style="color:#2c3e50;">${safe(data.package)}</td></tr>
                      <tr><td style="border-bottom:1px solid #e9ecef; font-weight:600; color:#1e2a3a;">Thời gian</td><td style="color:#2c3e50;">${formatTime(data.time)}</td></tr>
                      <tr><td style="border-bottom:1px solid #e9ecef; font-weight:600; color:#1e2a3a;">Nhóm cơ</td><td style="color:#2c3e50;">${safe(data.muscle)}</td></tr>
                      <tr><td style="font-weight:600; color:#1e2a3a;">Số buổi còn lại</td><td style="color:#2c3e50; font-size:20px; font-weight:bold;">${safe(data.remainingSessions)}</td></tr>
                    </table>
                    
                    <div style="background:#eef2f7; padding:16px; border-radius:14px; margin-bottom:16px; text-align:center;">
                      <p style="margin:0; font-size:14px; color:#2c3e50;">🏋️ Hãy đến đúng giờ và mang theo nước uống & khăn tập nhé!</p>
                    </div>
                    
                    <p style="font-size:12px; color:#6c757d; line-height:1.4; margin:24px 0 0; border-top:1px solid #e9ecef; padding-top:16px; text-align:center;">
                      📧 <strong>Đây là tin nhắn tự động, bạn không cần trả lời email này.</strong>
                    </p>
                  </td>
                </tr>
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

    const response = await deliverEmail({
      from: "HT Coaching <noreply@htcoachingweb.io.vn>",
      to,
      subject: "💪 Xác nhận buổi tập",
      html,
      headers: { "X-Entity-Ref-ID": Date.now().toString() },
    });
    safeLog.info("mail.sent", {
      template: "checkin",
      providerMessageId: response?.data?.id || "",
    });
  } catch (err) {
    safeLog.error("mail.checkin_failed", err);
  }
};

export const sendContactNotificationToAdmin = async (contact) => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL; // phải set trong .env
    if (!adminEmail) {
      safeLog.warn("mail.skipped", "ADMIN_EMAIL is not configured", {
        template: "contact_notification",
      });
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>📬 Liên hệ mới từ khách hàng</title>
      </head>
      <body style="margin:0; padding:0; background-color:#f4f4f4; font-family:'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4; padding:20px 0;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background:#ffffff; border-radius:24px; box-shadow:0 8px 20px rgba(0,0,0,0.05); overflow:hidden;">
                <tr>
                  <td style="background:linear-gradient(135deg, #e53935 0%, #b71c1c 100%); padding:32px 24px; text-align:center;">
                    <div style="font-size:48px; margin-bottom:8px;">📬✨</div>
                    <h1 style="margin:0; color:#fff; font-size:28px; letter-spacing:-0.5px;">LIÊN HỆ MỚI</h1>
                    <p style="margin:8px 0 0; color:#ffcdd2; font-size:16px;">Có khách hàng vừa gửi thông tin tư vấn</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 28px;">
                    <p style="font-size:18px; margin:0 0 12px; color:#1e2a3a;">Xin chào Admin,</p>
                    <p style="font-size:16px; line-height:1.5; color:#2c3e50; margin:0 0 24px;">Một khách hàng mới đã gửi yêu cầu tư vấn. Dưới đây là thông tin chi tiết:</p>
                    
                    <table width="100%" cellpadding="12" cellspacing="0" border="0" style="background:#f9fafc; border-radius:16px; margin-bottom:24px;">
                      <tr><td style="border-bottom:1px solid #e9ecef; font-weight:600; color:#1e2a3a;">Họ tên</td><td style="color:#2c3e50;">${escapeHtml(contact.name)}</td></tr>
                      <tr><td style="border-bottom:1px solid #e9ecef; font-weight:600; color:#1e2a3a;">Email</td><td style="color:#2c3e50;">${escapeHtml(contact.email)}</td></tr>
                      <tr><td style="border-bottom:1px solid #e9ecef; font-weight:600; color:#1e2a3a;">Số điện thoại</td><td style="color:#2c3e50;">${escapeHtml(contact.phone)}</td></tr>
                      <tr><td style="border-bottom:1px solid #e9ecef; font-weight:600; color:#1e2a3a;">Trang cá nhân</td><td style="color:#2c3e50;"><a href="${escapeHtml(contact.social)}" target="_blank" style="color:#e53935;">${escapeHtml(contact.social)}</a></td></tr>
                      <tr><td style="font-weight:600; color:#1e2a3a;">Gói tập quan tâm</td><td style="color:#2c3e50;">${escapeHtml(contact.package)}</td></tr>
                    </table>
                    
                    <div style="background:#eef2f7; padding:16px; border-radius:14px; margin-bottom:16px; text-align:center;">
                      <p style="margin:0; font-size:14px; color:#2c3e50;">📋 Hãy truy cập trang quản trị để xem chi tiết và xử lý.</p>
                    </div>
                    
                    <p style="font-size:12px; color:#6c757d; line-height:1.4; margin:24px 0 0; border-top:1px solid #e9ecef; padding-top:16px; text-align:center;">
                      📧 <strong>Đây là tin nhắn tự động từ hệ thống HT Coaching.</strong>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f8f9fa; padding:20px 28px; text-align:center; border-top:1px solid #e9ecef;">
                    <p style="margin:0; font-size:12px; color:#6c757d;">© 2026 HT Coaching – Nâng tầm sức mạnh</p>                   
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const response = await deliverEmail({
      from: "HT Coaching <noreply@htcoachingweb.io.vn>",
      to: adminEmail,
      subject: "📬 Liên hệ mới từ khách hàng",
      html,
      headers: { "X-Entity-Ref-ID": Date.now().toString() },
    });

    safeLog.info("mail.sent", {
      template: "contact_notification",
      providerMessageId: response?.data?.id || "",
    });
  } catch (err) {
    safeLog.error("mail.contact_notification_failed", err);
  }
};

// Booking mail
export const sendBookingNotificationToAdmin = async (booking) => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      safeLog.warn("mail.skipped", "ADMIN_EMAIL is not configured", {
        template: "booking_notification",
      });
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>📋 Đăng ký mới từ khách hàng</title>
      </head>
      <body style="margin:0; padding:0; background-color:#f4f4f4; font-family:'Segoe UI', Roboto, Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4; padding:20px 0;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background:#ffffff; border-radius:24px; box-shadow:0 8px 20px rgba(0,0,0,0.05); overflow:hidden;">
                <tr>
                  <td style="background:linear-gradient(135deg, #e53935 0%, #b71c1c 100%); padding:32px 24px; text-align:center;">
                    <div style="font-size:48px; margin-bottom:8px;">📋✨</div>
                    <h1 style="margin:0; color:#fff; font-size:28px; letter-spacing:-0.5px;">ĐĂNG KÝ MỚI</h1>
                    <p style="margin:8px 0 0; color:#ffcdd2; font-size:16px;">Có khách hàng vừa gửi yêu cầu tư vấn</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 28px;">
                    <p style="font-size:18px; margin:0 0 12px; color:#1e2a3a;">Xin chào Admin,</p>
                    <p style="font-size:16px; line-height:1.5; color:#2c3e50; margin:0 0 24px;">Một khách hàng mới đã gửi đăng ký gói tập. Dưới đây là thông tin chi tiết:</p>
                    
                    <table width="100%" cellpadding="12" cellspacing="0" border="0" style="background:#f9fafc; border-radius:16px; margin-bottom:24px;">
                      <tr><td style="border-bottom:1px solid #e9ecef; font-weight:600; color:#1e2a3a;">Họ tên</td><td style="color:#2c3e50;">${escapeHtml(booking.name)}</td></tr>
                      <tr><td style="border-bottom:1px solid #e9ecef; font-weight:600; color:#1e2a3a;">Số điện thoại</td><td style="color:#2c3e50;">${escapeHtml(booking.phone)}</td></tr>
                      <tr><td style="border-bottom:1px solid #e9ecef; font-weight:600; color:#1e2a3a;">Email</td><td style="color:#2c3e50;">${escapeHtml(booking.email)}</td></tr>
                      <tr><td style="border-bottom:1px solid #e9ecef; font-weight:600; color:#1e2a3a;">Gói tập</td><td style="color:#2c3e50;">${escapeHtml(booking.package)}</td></tr>
                      <tr><td style="font-weight:600; color:#1e2a3a;">Số buổi</td><td style="color:#2c3e50;">${booking.sessions} buổi</td></tr>
                    </table>
                    
                    <div style="background:#eef2f7; padding:16px; border-radius:14px; margin-bottom:16px; text-align:center;">
                      <p style="margin:0; font-size:14px; color:#2c3e50;">📋 Hãy truy cập trang quản trị để xem chi tiết và xử lý.</p>
                    </div>
                    
                    <p style="font-size:12px; color:#6c757d; line-height:1.4; margin:24px 0 0; border-top:1px solid #e9ecef; padding-top:16px; text-align:center;">
                      📧 <strong>Đây là tin nhắn tự động từ hệ thống HT Coaching.</strong>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f8f9fa; padding:20px 28px; text-align:center; border-top:1px solid #e9ecef;">
                    <p style="margin:0; font-size:12px; color:#6c757d;">© 2026 HT Coaching – Nâng tầm sức mạnh</p>                   
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const response = await deliverEmail({
      from: "HT Coaching <noreply@htcoachingweb.io.vn>",
      to: adminEmail,
      subject: "📋 Đăng ký mới từ khách hàng",
      html,
      headers: { "X-Entity-Ref-ID": Date.now().toString() },
    });

    safeLog.info("mail.sent", {
      template: "booking_notification",
      providerMessageId: response?.data?.id || "",
    });
  } catch (err) {
    safeLog.error("mail.booking_notification_failed", err);
  }
};

// SCHEDULE REMINDER MAIL — Nhắc lịch tập trước 30 phút
export const sendScheduleReminderMail = async (to, data) => {
  try {
    const dayLabels = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];
    const dayLabel = dayLabels[data.dayOfWeek] || "";

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nhắc lịch tập</title>
      </head>
      <body style="margin:0; padding:0; background-color:#f4f4f4; font-family:'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4; padding:20px 0;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background:#ffffff; border-radius:24px; box-shadow:0 8px 20px rgba(0,0,0,0.05); overflow:hidden;">
                <tr>
                  <td style="background:linear-gradient(135deg, #e67e22 0%, #d35400 100%); padding:32px 24px; text-align:center;">
                    <div style="font-size:48px; margin-bottom:8px;">⏰🏋️</div>
                    <h1 style="margin:0; color:#fff; font-size:28px; letter-spacing:-0.5px;">NHẮC LỊCH TẬP</h1>
                    <p style="margin:8px 0 0; color:#fdebd0; font-size:16px;">Còn 30 phút nữa tới giờ dạy!</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 28px;">
                    <p style="font-size:18px; margin:0 0 12px; color:#1e2a3a;">Chào <strong style="color:#e67e22;">${safe(data.trainerName)}</strong>,</p>
                    <p style="font-size:16px; line-height:1.5; color:#2c3e50; margin:0 0 24px;">Bạn có buổi tập sắp bắt đầu trong <strong style="color:#e67e22;">30 phút</strong> nữa. Dưới đây là thông tin chi tiết:</p>
                    
                    <table width="100%" cellpadding="12" cellspacing="0" border="0" style="background:#f9fafc; border-radius:16px; margin-bottom:24px;">
                      <tr><td style="border-bottom:1px solid #e9ecef; font-weight:600; color:#1e2a3a;">Khách hàng</td><td style="color:#2c3e50; font-weight:bold; font-size:18px;">${safe(data.clientName)}</td></tr>
                      <tr><td style="border-bottom:1px solid #e9ecef; font-weight:600; color:#1e2a3a;">Ngày</td><td style="color:#2c3e50;">${safe(dayLabel)}</td></tr>
                      <tr><td style="border-bottom:1px solid #e9ecef; font-weight:600; color:#1e2a3a;">Giờ</td><td style="color:#2c3e50; font-size:20px; font-weight:bold;">${safe(data.startTime)} - ${safe(data.endTime)}</td></tr>
                      <tr><td style="border-bottom:1px solid #e9ecef; font-weight:600; color:#1e2a3a;">Loại bài tập</td><td style="color:#2c3e50;">${safe(data.exerciseType)}</td></tr>
                      ${data.notes ? `<tr><td style="font-weight:600; color:#1e2a3a;">Ghi chú</td><td style="color:#2c3e50;">${safe(data.notes)}</td></tr>` : ""}
                    </table>
                    
                    <div style="background:#fef9e7; padding:16px; border-radius:14px; margin-bottom:16px; text-align:center; border:1px solid #f9e79f;">
                      <p style="margin:0; font-size:14px; color:#7d6608;">🔔 Hãy chuẩn bị sẵn sàng để đón khách hàng nhé!</p>
                    </div>
                    
                    <p style="font-size:12px; color:#6c757d; line-height:1.4; margin:24px 0 0; border-top:1px solid #e9ecef; padding-top:16px; text-align:center;">
                      📧 <strong>Đây là tin nhắn tự động từ hệ thống HT Coaching.</strong>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f8f9fa; padding:20px 28px; text-align:center; border-top:1px solid #e9ecef;">
                    <p style="margin:0; font-size:12px; color:#6c757d;">© 2026 HT Coaching – Nâng tầm sức mạnh</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const response = await deliverEmail({
      from: "HT Coaching <noreply@htcoachingweb.io.vn>",
      to,
      subject: `⏰ Nhắc lịch tập — ${data.clientName} lúc ${data.startTime}`,
      html,
      headers: { "X-Entity-Ref-ID": Date.now().toString() },
    });

    safeLog.info("mail.sent", {
      template: "schedule_reminder",
      providerMessageId: response?.data?.id || "",
    });
  } catch (err) {
    safeLog.error("mail.schedule_reminder_failed", err);
  }
};

// CONTRACT MAIL — Gửi HĐ cho khách hàng ký
export const sendContractMail = async (to, data) => {
  try {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hợp đồng huấn luyện cá nhân</title>
      </head>
      <body style="margin:0; padding:0; background-color:#f4f4f4; font-family:'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4; padding:20px 0;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background:#ffffff; border-radius:24px; box-shadow:0 8px 20px rgba(0,0,0,0.05); overflow:hidden;">
                <tr>
                  <td style="background:linear-gradient(135deg, #047857 0%, #065f46 100%); padding:32px 24px; text-align:center;">
                    <div style="font-size:48px; margin-bottom:8px;">📋✍️</div>
                    <h1 style="margin:0; color:#fff; font-size:28px; letter-spacing:-0.5px;">HỢP ĐỒNG HUẤN LUYỆN</h1>
                    <p style="margin:8px 0 0; color:#a7f3d0; font-size:16px;">Vui lòng ký xác nhận hợp đồng</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 28px;">
                    <p style="font-size:18px; margin:0 0 12px; color:#1e2a3a;">Chào <strong style="color:#e67e22;">${safe(data.clientName)}</strong>,</p>
                    <p style="font-size:16px; line-height:1.5; color:#2c3e50; margin:0 0 24px;">HLV <strong>${safe(data.trainerName)}</strong> đã tạo hợp đồng huấn luyện cá nhân cho bạn. Vui lòng xem và ký xác nhận.</p>
                    
                    <table width="100%" cellpadding="12" cellspacing="0" border="0" style="background:#f9fafc; border-radius:16px; margin-bottom:24px;">
                      <tr><td style="border-bottom:1px solid #e9ecef; font-weight:600; color:#1e2a3a;">Gói tập</td><td style="color:#2c3e50;">${safe(data.packageName)}</td></tr>
                      <tr><td style="font-weight:600; color:#1e2a3a;">Số buổi</td><td style="color:#2c3e50;">${data.sessions} buổi</td></tr>
                    </table>
                    
                    <div style="text-align:center; margin:24px 0;">
                      <a href="${safe(data.contractLink)}" target="_blank" style="display:inline-block; background:linear-gradient(135deg, #059669, #047857); color:#ffffff; font-weight:bold; font-size:16px; padding:14px 32px; border-radius:14px; text-decoration:none; letter-spacing:0.5px;">
                        📝 Xem & Ký Hợp Đồng
                      </a>
                    </div>
                    
                    <p style="font-size:13px; color:#6c757d; line-height:1.4; margin:16px 0 0; text-align:center;">Hợp đồng sẽ hết hạn sau 7 ngày nếu chưa được ký.</p>
                    
                    <p style="font-size:12px; color:#6c757d; line-height:1.4; margin:24px 0 0; border-top:1px solid #e9ecef; padding-top:16px; text-align:center;">
                      📧 <strong>Đây là tin nhắn tự động, bạn không cần trả lời email này.</strong>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f8f9fa; padding:20px 28px; text-align:center; border-top:1px solid #e9ecef;">
                    <p style="margin:0; font-size:12px; color:#6c757d;">© 2026 HT Coaching – Nâng tầm sức mạnh</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const response = await deliverEmail({
      from: "HT Coaching <noreply@htcoachingweb.io.vn>",
      to,
      subject: "📋 Hợp đồng huấn luyện cá nhân — Vui lòng ký xác nhận",
      html,
      headers: { "X-Entity-Ref-ID": Date.now().toString() },
    });

    safeLog.info("mail.sent", {
      template: "contract",
      providerMessageId: response?.data?.id || "",
    });
  } catch (err) {
    safeLog.error("mail.contract_failed", err);
  }
};
