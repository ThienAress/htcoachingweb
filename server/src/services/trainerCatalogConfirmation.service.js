import {
  getTrainerPlanAmount,
  getTrainerPlanCatalogMeta,
} from "./trainerPlanCatalog.service.js";
import { trainerSubscriptionError } from "./trainerSubscriptionLifecycle.service.js";

export const assertTrainerCatalogConfirmation = ({
  body,
  planCode,
  billingCycle,
}) => {
  const meta = getTrainerPlanCatalogMeta();
  const canonicalAmount = getTrainerPlanAmount(planCode, billingCycle);
  const confirmed =
    body?.protocolVersion === meta.protocolVersion &&
    body?.catalogFingerprint === meta.catalogFingerprint &&
    body?.expectedAmount === canonicalAmount;
  if (!confirmed) {
    throw trainerSubscriptionError(
      409,
      "CATALOG_CHANGED",
      "Bảng giá đã thay đổi. Vui lòng tải lại và xác nhận giá mới.",
    );
  }
  return canonicalAmount;
};
