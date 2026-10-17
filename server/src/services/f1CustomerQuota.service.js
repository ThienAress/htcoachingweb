import Counter from "../models/Counter.js";
import F1Customer from "../models/F1Customer.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import { getMaxClientsByPlan } from "./trainerPlanCatalog.service.js";

export const F1_SOFT_DELETE_RETENTION_DAYS = 7;

const quotaError = (maxCustomers, used, planTitle) => {
  const error = new Error(
    `Gói "${planTitle}" chỉ cho phép tạo tối đa ${maxCustomers} khách hàng F1. Bạn đã tạo ${used} khách hàng (tính cả khách đã xóa và khách tạo ở các gói trước). Hãy nâng cấp gói để tạo thêm.`,
  );
  error.status = 403;
  error.code = "F1_QUOTA_EXCEEDED";
  return error;
};

// Hạn mức = số khách F1 HLV đã TẠO từ trước tới nay (không reset theo kỳ gói), gồm cả khách đã xoá mềm và đã xoá
// vĩnh viễn (dữ liệu bị ẩn danh nhưng createdBy còn nguyên). Nhờ vậy xoá rồi tạo lại, hoặc gia hạn cùng gói, đều không
// làm mới bộ đếm; nâng lên gói cao hơn thì giới hạn tăng và số khách đã tạo vẫn được tính.
// Admin không bị giới hạn. Gọi trong transaction: bản ghi khoá theo HLV khiến hai yêu cầu song song phải xếp hàng.
export const assertF1CreateQuota = async ({ actor, isAdmin, session }) => {
  if (isAdmin) return;

  await Counter.findOneAndUpdate(
    { key: `f1_quota_lock:${actor.id}` },
    { $inc: { value: 1 } },
    { upsert: true, setDefaultsOnInsert: true, session },
  );

  const now = new Date();
  const subscription = await TrainerSubscription.findOne({
    userId: actor.id,
    isActive: true,
    endDate: { $gt: now },
  })
    .sort({ startDate: -1 })
    .select("planCode planTitle")
    .session(session)
    .lean();

  const maxCustomers = getMaxClientsByPlan(
    subscription?.planCode || subscription?.planTitle || "free",
  );
  const used = await F1Customer.countDocuments({ createdBy: actor.id }).session(session);

  if (used >= maxCustomers) {
    throw quotaError(maxCustomers, used, subscription?.planTitle || "Miễn phí");
  }
};
