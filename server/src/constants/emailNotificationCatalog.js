export const EMAIL_NOTIFICATION_CATALOG_VERSION = "2026-08-29";

const deepFreeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

export const EMAIL_NOTIFICATION_CATALOG = deepFreeze([
  {
    notificationKey: "order_approved",
    feature: "Duyệt đơn hàng",
    trigger: "Admin duyệt đơn hàng đang chờ",
    recipient: "Khách hàng",
    condition: "Đơn hàng có email người nhận",
    delivery: "Best-effort · không chặn thao tác duyệt",
    templateKey: "order",
    sender: "sendMail",
  },
  {
    notificationKey: "checkin_recorded",
    feature: "Check-in buổi tập",
    trigger: "Check-in mới được ghi nhận thành công",
    recipient: "Khách hàng",
    condition: "Order có email và không phải idempotent replay",
    delivery: "Best-effort · không chặn kết quả check-in",
    templateKey: "checkin",
    sender: "sendCheckinMail",
  },
  {
    notificationKey: "contact_created",
    feature: "Yêu cầu tư vấn mới",
    trigger: "Khách gửi form liên hệ",
    recipient: "Admin",
    condition: "Biến ADMIN_EMAIL đã được cấu hình",
    delivery: "Bất đồng bộ · không chặn phản hồi form",
    templateKey: "contact_notification",
    sender: "sendContactNotificationToAdmin",
  },
  {
    notificationKey: "booking_created",
    feature: "Đăng ký gói tập mới",
    trigger: "Khách hoàn tất form đăng ký",
    recipient: "Admin",
    condition: "Biến ADMIN_EMAIL đã được cấu hình",
    delivery: "Bất đồng bộ · không chặn phản hồi form",
    templateKey: "booking_notification",
    sender: "sendBookingNotificationToAdmin",
  },
  {
    notificationKey: "schedule_reminder",
    feature: "Nhắc lịch tập",
    trigger: "Cron phát hiện lịch active còn khoảng 30 phút",
    recipient: "HLV / Admin phụ trách",
    condition: "Lịch scheduled, có email và occurrence chưa được gửi",
    delivery: "Cron mỗi 5 phút · có claim và retry",
    templateKey: "schedule_reminder",
    sender: "sendScheduleReminderMail",
  },
  {
    notificationKey: "contract_sent",
    feature: "Hợp đồng chờ ký",
    trigger: "HLV/Admin gửi hợp đồng cho khách",
    recipient: "Khách hàng",
    condition: "Hợp đồng có email khách hàng",
    delivery: "Best-effort sau khi chuyển trạng thái hợp đồng",
    templateKey: "contract",
    sender: "sendContractMail",
  },
  {
    notificationKey: "trainer_grant_invitation",
    feature: "Mời nhận gói HLV",
    trigger: "Admin cấp gói cho email chưa có tài khoản",
    recipient: "Email HLV được cấp",
    condition: "PendingTrainerGrant đã được tạo thành công",
    delivery: "Best-effort sau khi lưu grant",
    templateKey: "trainer_grant_invitation",
    sender: "sendTrainerGrantInvitationMail",
  },
  {
    notificationKey: "trainer_subscription_activated",
    feature: "Kích hoạt gói HLV",
    trigger: "Mua gói, cấp trực tiếp hoặc nhận grant thành công",
    recipient: "HLV",
    condition: "TrainerSubscription đã được commit",
    delivery: "Best-effort sau transaction",
    templateKey: "trainer_subscription_activated",
    sender: "sendTrainerSubscriptionActivatedMail",
  },
  {
    notificationKey: "practice_center_simulation",
    feature: "Trung tâm thực hành",
    trigger: "Admin/HLV chủ động chạy kịch bản Order hoặc Check-in mô phỏng",
    recipient: "Tài khoản đang đăng nhập",
    condition: "Đủ entitlement, quota và delivery unit chưa hoàn tất",
    delivery: "Fail-closed · per-delivery idempotency và quota refund",
    templateKey: "practice_order_or_checkin",
    sender: "sendPracticeCenterMail",
  },
  {
    notificationKey: "morning_health_reminder",
    feature: "Nhắc Mục tiêu sức khỏe buổi sáng",
    trigger: "Cron chạy trong khung 07:00–08:59 giờ Việt Nam",
    recipient: "Khách coaching đã chủ động bật trong Tài khoản",
    condition:
      "Còn buổi, có HLV, Today Dashboard khả dụng và chưa submit nhật ký ngày",
    delivery: "Fail-closed · một delivery/người/ngày, có claim và retry",
    templateKey: "morning_health_reminder",
    sender: "sendMorningHealthReminderMail",
  },
]);
