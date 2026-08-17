import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    // Ai thực hiện hành động
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Role của người thực hiện tại thời điểm hành động
    actorRole: {
      type: String,
      enum: ["admin", "trainer", "user"],
      required: true,
    },

    // Hành động cụ thể
    action: {
      type: String,
      required: true,
      enum: [
        "approve_deposit",
        "reject_deposit",
        "delete_deposit",
        "reverse_deposit",
        "approve_incoming_bank_transaction",
        "ignore_incoming_bank_transaction",
        "reverse_incoming_bank_transaction",
        "manual_adjustment",
        "purchase_with_wallet",
        "purchase_trainer_plan",
        "purchase_fitness_plus_plan",
        "cancel_trainer_subscription",
        "grant_trainer_plan",
        "create_pending_trainer_grant",
        "claim_pending_trainer_grant",
        "revoke_pending_trainer_grant",
        "delete_order",
        "refund",
        "change_user_role",
        "admin_login",
        "create_training_schedule",
        "reschedule_training_schedule",
        "cancel_training_schedule",
        "complete_training_schedule",
        "cancel_all_training_schedules",
        "update_booking_status",
        "archive_booking",
        "upload_f1_media",
        "read_f1_media",
        "request_f1_media_deletion",
        "complete_f1_media_deletion",
        "request_f1_data_deletion",
        "complete_f1_data_deletion",
        "read_daily_journal",
        "delete_daily_journal_data",
        "retention_delete_daily_journal",
        "delete_saved_meal_plan_data",
        "retention_delete_saved_meal_plan",
        "delete_coaching_habit_data",
        "retention_delete_coaching_habit",
        "delete_weekly_checkin_data",
        "retention_delete_weekly_checkin",
        "delete_coaching_comment_data",
        "retention_delete_coaching_comment",
        "retention_delete_in_app_notification",
        "delete_today_dashboard_data",
        "export_coaching_activity",
        "read_trainer_client_overview",
        "read_client_progress",
        "write_wellness_target",
        "delete_wellness_target_data",
        "retention_delete_wellness_target",
        "read_coaching_comment_thread",
        "write_coaching_comment",
        "generate_f1_ai_report",
        "generate_f1_forecast",
        "generate_f1_prediction",
        "create_skill_radar_source",
      ],
    },

    // Đối tượng bị tác động
    targetType: {
      type: String,
      enum: [
        "deposit_request",
        "incoming_bank_transaction",
        "wallet",
        "order",
        "user",
        "trainer_subscription",
        "fitness_subscription",
        "pending_trainer_grant",
        "training_schedule",
        "booking",
        "f1_customer",
        "f1_media",
        "f1_ai_report",
        "f1_outcome_forecast",
        "f1_result_prediction",
        "daily_journal",
        "saved_meal_plan",
        "coaching_habit",
        "weekly_checkin",
        "coaching_comment",
        "wellness_target",
        "skill_radar_source",
      ],
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    targetKey: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    outcome: {
      type: String,
      enum: ["succeeded", "failed"],
      default: "succeeded",
    },

    // Chi tiết hành động (số dư trước/sau, lý do, v.v.)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    ipAddress: {
      type: String,
    },

    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
    // KHÔNG CHO XOÁ audit log — chỉ ghi thêm
    capped: false,
  }
);

// ✅ Indexes
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);
