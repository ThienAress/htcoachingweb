import User from "../models/User.js";
import PracticeEmailDelivery from "../models/PracticeEmailDelivery.js";
import { resolveRequestServicePolicy } from "./serviceAccessPolicy.service.js";
import {
  consumeServiceUsage,
  getServiceUsageQuota,
  refundServiceUsage,
  resolveServiceUsageActor,
} from "./serviceUsageLedger.service.js";
import { sendPracticeCenterMail } from "../utils/sendMail.js";

export const PRACTICE_CENTER_SCENARIOS = Object.freeze({
  order: Object.freeze({
    key: "order",
    label: "Order được duyệt",
    description: "Xem email xác nhận khi gói tập bắt đầu.",
    cost: 1,
    deliveries: Object.freeze(["order"]),
  }),
  checkin: Object.freeze({
    key: "checkin",
    label: "Check-in buổi tập",
    description: "Xem email ghi nhận buổi tập và số buổi còn lại.",
    cost: 1,
    deliveries: Object.freeze(["checkin"]),
  }),
  journey: Object.freeze({
    key: "journey",
    label: "Toàn bộ hành trình",
    description: "Nhận lần lượt email Order và Check-in.",
    cost: 2,
    deliveries: Object.freeze(["order", "checkin"]),
  }),
});

const findRecipient = async (actor) => {
  const user = await User.findById(actor.id).select("name email").lean();
  if (!user?.email) {
    throw Object.assign(new Error("Tài khoản chưa có email để nhận mô phỏng"), {
      code: "PRACTICE_RECIPIENT_UNAVAILABLE",
      statusCode: 422,
    });
  }
  return { name: user.name || "HLV", email: user.email };
};

const serializeScenarios = () =>
  Object.values(PRACTICE_CENTER_SCENARIOS).map(
    ({ key, label, description, cost }) => ({ key, label, description, cost }),
  );

export const getPracticeCenterState = async ({ actor }) => {
  const recipient = await findRecipient(actor);
  const requestContext = { user: actor };
  const { tier, policy } = await resolveRequestServicePolicy(
    requestContext,
    "practice_email",
  );
  const quota = await getServiceUsageQuota({
    serviceKey: "practice_email",
    tier,
    policy,
    actor: resolveServiceUsageActor(requestContext),
  });
  return {
    recipient: recipient.email,
    scenarios: serializeScenarios(),
    quota,
  };
};

const DELIVERY_CLAIM_TIMEOUT_MS = 10 * 60 * 1000;

const practiceError = (statusCode, code, message, details = {}) =>
  Object.assign(new Error(message), { statusCode, code, ...details });

const loadOrCreateDelivery = async ({ actor, definition, requestId }) => {
  let delivery;
  try {
    delivery = await PracticeEmailDelivery.findOneAndUpdate(
      { userId: actor.id, requestId },
      {
        $setOnInsert: {
          userId: actor.id,
          requestId,
          scenario: definition.key,
          deliveries: definition.deliveries.map((key) => ({ key })),
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
    delivery = await PracticeEmailDelivery.findOne({
      userId: actor.id,
      requestId,
    });
  }
  if (!delivery || delivery.scenario !== definition.key) {
    throw practiceError(
      409,
      "PRACTICE_REQUEST_ID_CONFLICT",
      "Mã yêu cầu đã được dùng cho kịch bản khác",
    );
  }
  return delivery;
};

const claimDeliveryUnit = ({ deliveryId, key, now }) =>
  PracticeEmailDelivery.findOneAndUpdate(
    {
      _id: deliveryId,
      deliveries: {
        $elemMatch: {
          key,
          $or: [
            { status: "pending" },
            {
              status: "processing",
              claimedAt: {
                $lte: new Date(now.getTime() - DELIVERY_CLAIM_TIMEOUT_MS),
              },
            },
          ],
        },
      },
    },
    {
      $set: {
        "deliveries.$.status": "processing",
        "deliveries.$.claimedAt": now,
      },
    },
    { returnDocument: "after" },
  );

export const deliverPracticeCenterScenarioRequest = async ({
  actor,
  scenario,
  requestId,
}) => {
  const definition = PRACTICE_CENTER_SCENARIOS[scenario];
  if (!definition) {
    throw Object.assign(new Error("Kịch bản mô phỏng không hợp lệ"), {
      code: "PRACTICE_SCENARIO_INVALID",
      statusCode: 400,
    });
  }
  const recipient = await findRecipient(actor);
  const requestContext = { user: actor };
  const { tier, policy } = await resolveRequestServicePolicy(
    requestContext,
    "practice_email",
  );
  const usageActor = resolveServiceUsageActor(requestContext);
  const record = await loadOrCreateDelivery({ actor, definition, requestId });
  const sent = record.deliveries
    .filter(({ status }) => status === "sent")
    .map(({ key }) => key);
  let quota = await getServiceUsageQuota({
    serviceKey: "practice_email",
    tier,
    policy,
    actor: usageActor,
  });

  for (const deliveryScenario of definition.deliveries) {
    if (sent.includes(deliveryScenario)) continue;
    const now = new Date();
    const claimed = await claimDeliveryUnit({
      deliveryId: record._id,
      key: deliveryScenario,
      now,
    });
    if (!claimed) {
      const current = await PracticeEmailDelivery.findById(record._id).lean();
      const state = current?.deliveries?.find(
        ({ key }) => key === deliveryScenario,
      );
      if (state?.status === "sent") {
        sent.push(deliveryScenario);
        continue;
      }
      throw practiceError(
        409,
        "PRACTICE_DELIVERY_IN_PROGRESS",
        "Yêu cầu mô phỏng này đang được xử lý",
        { quota, sent, pending: [deliveryScenario] },
      );
    }

    let usage;
    try {
      usage = await consumeServiceUsage({
        serviceKey: "practice_email",
        tier,
        policy,
        actor: usageActor,
        operationKey: `${requestId}:${deliveryScenario}`,
        cost: 1,
      });
      quota = usage.quota;
    } catch (error) {
      await PracticeEmailDelivery.updateOne(
        { _id: record._id, "deliveries.key": deliveryScenario },
        {
          $set: {
            "deliveries.$.status": "pending",
            "deliveries.$.claimedAt": null,
          },
        },
      );
      throw practiceError(
        503,
        "SERVICE_USAGE_UNAVAILABLE",
        "Tạm thời chưa thể xác minh hạn mức sử dụng",
        { cause: error, quota, sent, pending: [deliveryScenario] },
      );
    }
    if (!usage.allowed) {
      await PracticeEmailDelivery.updateOne(
        { _id: record._id, "deliveries.key": deliveryScenario },
        {
          $set: {
            "deliveries.$.status": "pending",
            "deliveries.$.claimedAt": null,
          },
        },
      );
      throw practiceError(
        429,
        "PRACTICE_EMAIL_QUOTA_EXCEEDED",
        "Bạn đã dùng hết lượt mô phỏng trong 24 giờ",
        { quota, sent, pending: [deliveryScenario] },
      );
    }
    try {
      const delivered = await sendPracticeCenterMail(recipient.email, {
        scenario: deliveryScenario,
        name: recipient.name,
        requestId,
      });
      await PracticeEmailDelivery.updateOne(
        { _id: record._id, "deliveries.key": deliveryScenario },
        {
          $set: {
            "deliveries.$.status": "sent",
            "deliveries.$.claimedAt": null,
            "deliveries.$.deliveredAt": new Date(),
            "deliveries.$.providerMessageId":
              delivered?.providerMessageId || "",
          },
        },
      );
      sent.push(deliveryScenario);
    } catch (error) {
      try {
        quota = await refundServiceUsage({ reservation: usage.reservation });
      } catch (refundError) {
        try {
          await PracticeEmailDelivery.updateOne(
            { _id: record._id, "deliveries.key": deliveryScenario },
            {
              $set: {
                "deliveries.$.status": "unknown",
                "deliveries.$.claimedAt": null,
              },
            },
          );
        } catch {
          // A stale processing claim can retry safely because provider delivery
          // uses the same idempotency key for this request and delivery unit.
        }
        throw practiceError(
          503,
          "PRACTICE_REFUND_UNCONFIRMED",
          "Chưa thể xác nhận hoàn lượt mô phỏng; yêu cầu đã được dừng để tránh tính hoặc gửi trùng",
          {
            cause: refundError,
            quota,
            sent,
            pending: [],
            unknown: [deliveryScenario],
          },
        );
      }
      await PracticeEmailDelivery.updateOne(
        { _id: record._id, "deliveries.key": deliveryScenario },
        {
          $set: {
            "deliveries.$.status": "pending",
            "deliveries.$.claimedAt": null,
          },
        },
      );
      const pending = definition.deliveries.filter((key) => !sent.includes(key));
      throw practiceError(
        502,
        sent.length > 0
          ? "PRACTICE_EMAIL_PARTIAL_DELIVERY"
          : "PRACTICE_EMAIL_DELIVERY_FAILED",
        sent.length > 0
          ? "Đã gửi một phần email mô phỏng; bạn có thể thử lại phần còn thiếu"
          : "Chưa thể gửi email mô phỏng; lượt sử dụng đã được hoàn lại",
        { cause: error, quota, sent, pending },
      );
    }
  }
  await PracticeEmailDelivery.updateOne(
    { _id: record._id },
    { $set: { completedAt: new Date() } },
  );
  return {
    recipient: recipient.email,
    scenario: definition.key,
    sent,
    quota,
  };
};
