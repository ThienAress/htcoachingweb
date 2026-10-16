import Counter from "../models/Counter.js";
import F1Customer from "../models/F1Customer.js";
import TrainerSubscription from "../models/TrainerSubscription.js";
import { getMaxClientsByPlan } from "./trainerPlanCatalog.service.js";

export const F1_SOFT_DELETE_RETENTION_DAYS = 7;

const quotaError = (maxCustomers, used, planTitle) => {
  const error = new Error(
    `Gói "${planTitle}" chỉ cho phép tạo tối đa ${maxCustomers} khách hàng F1 trong kỳ gói hiện tại. Bạn đã tạo ${used} khách hàng (tính cả khách đã xóa). Hãy nâng cấp gói để tạo thêm.`,
  );
  error.status = 403;
  error.code = "F1_QUOTA_EXCEEDED";
  return error;
};

// Hạn mức tính theo số khách HLV đã TẠO trong kỳ gói hiện tại, gồm cả khách đã xoá mềm và đã xoá vĩnh viễn
// (dữ liệu bị ẩn danh nhưng createdBy/createdAt còn nguyên), nên xoá rồi tạo lại không lách được giới hạn.
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
    .select("planCode planTitle startDate")
    .session(session)
    .lean();

  const maxCustomers = getMaxClientsByPlan(
    subscription?.planCode || subscription?.planTitle || "free",
  );
  const used = await F1Customer.countDocuments({
    createdBy: actor.id,
    ...(subscription?.startDate
      ? { createdAt: { $gte: subscription.startDate } }
      : {}),
  }).session(session);

  if (used >= maxCustomers) {
    throw quotaError(maxCustomers, used, subscription?.planTitle || "Miễn phí");
  }
};
