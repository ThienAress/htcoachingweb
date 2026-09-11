import Order from "../models/Order.js";
import User from "../models/User.js";
import {
  incrementMetric,
  observeMetric,
} from "../observability/metrics.js";
import { APP_TIME_ZONE, getVietnamDayRangeUtc } from "../utils/dateKey.js";
import { resolveClientTrainer } from "./trainingScheduleCommand.service.js";
import { calculateTodaySummary } from "./todayDashboardSummary.service.js";
import {
  isJournalDateEditable,
} from "./dailyJournalAccess.service.js";
import { resolveCustomerDashboardAccess } from "./customerDashboardAccess.service.js";
import {
  TODAY_SOURCE_DEFINITIONS,
  errorTodaySection,
  getEmptyTodaySections,
  loadTodaySources,
  readyTodaySection,
} from "./todayDashboardSources.service.js";

const id = (value) => (value ? String(value) : null);

export const getTodayProgressPromptEligibility = async (actor) => {
  const access = await resolveCustomerDashboardAccess(actor);
  return {
    eligible:
      access.hasCoaching &&
      !access.hasTrainerAccess,
    accessMode: access.accessMode,
    hasActiveCustomerPlan: access.hasActiveCustomerPlan,
    hasCoaching: access.hasCoaching,
  };
};

const resolveEligibility = async (userId) => {
  const [user, orders] = await Promise.all([
    User.findById(userId).select("email role").lean(),
    Order.find({ userId })
      .select("_id status sessions trainerId createdAt")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean(),
  ]);
  if (!user) {
    const error = new Error("Tài khoản không tồn tại");
    error.statusCode = 404;
    error.code = "USER_NOT_FOUND";
    throw error;
  }

  const email = String(user.email || "").trim().toLowerCase();
  const dashboardAccess = await resolveCustomerDashboardAccess({
    id: userId,
    role: user.role,
  });
  const orderIds = orders.map((order) => order._id);
  const activeOrder = orders.find(
    (order) => order.status === "approved" && Number(order.sessions) > 0,
  );
  if (activeOrder && dashboardAccess.accessMode === "coaching") {
    try {
      const assignment = await resolveClientTrainer({ clientId: userId });
      const trainer = await User.findById(assignment.trainerId)
        .select("name avatar")
        .lean();
      return {
        public: {
          status: "active",
          orderId: id(activeOrder._id),
          trainer: trainer
            ? {
                _id: id(trainer._id),
                name: trainer.name || "",
                avatar: trainer.avatar || "",
              }
            : null,
        },
        canViewSources: true,
        accessMode: "coaching",
        email,
        orderIds,
      };
    } catch (error) {
      if (
        error.code !== "TRAINER_ASSIGNMENT_REQUIRED" &&
        error.codeName !== "TRAINER_ASSIGNMENT_REQUIRED" &&
        error.codeName !== "INVALID_DEFAULT_TRAINER"
      ) {
        throw error;
      }
      return {
        public: {
          status: "assignment_required",
          orderId: id(activeOrder._id),
          trainer: null,
        },
        canViewSources: true,
        accessMode: "coaching",
        email,
        orderIds,
      };
    }
  }

  const hasHistory = orders.some(
    (order) =>
      order.status === "approved" ||
      order.status === "completed" ||
      (order.status === "cancelled" && Number(order.sessions) === 0),
  );
  const status =
    orders[0]?.status === "pending"
      ? "pending"
      : hasHistory
        ? "inactive"
        : "never_coached";
  if (dashboardAccess.accessMode === "self_managed") {
    return {
      public: {
        status: "active",
        orderId: null,
        trainer: null,
      },
      canViewSources: true,
      accessMode: "self_managed",
      email,
      orderIds,
    };
  }
  return {
    public: { status, orderId: null, trainer: null },
    canViewSources: false,
    accessMode: "blocked",
    email,
    orderIds,
  };
};

const aggregateSources = async (context) => {
  const loaders = loadTodaySources(context);
  const names = Object.keys(loaders);
  const results = await Promise.allSettled(Object.values(loaders));
  const partialErrors = [];
  const sections = getEmptyTodaySections();
  results.forEach((result, index) => {
      const name = names[index];
      if (result.status === "fulfilled") {
        sections[name] = readyTodaySection(name, result.value);
        return;
      }
      incrementMetric("today_dashboard.partial_errors");
      partialErrors.push({
        section: name,
        code: TODAY_SOURCE_DEFINITIONS[name].code,
      });
      sections[name] = errorTodaySection(name);
    });
  return { sections, partialErrors };
};

export const getTodayDashboard = async ({
  userId,
  dateKey,
  actorScope = "client",
}) => {
  incrementMetric("today_dashboard.requests");
  const startedAt = performance.now();
  const eligibility = await resolveEligibility(userId);
  let sections = getEmptyTodaySections();
  let partialErrors = [];

  if (eligibility.canViewSources) {
    ({ sections, partialErrors } = await aggregateSources({
      userId,
      dateKey,
      email: eligibility.email,
      orderIds: eligibility.orderIds,
      range: getVietnamDayRangeUtc(dateKey),
      actorScope,
      includeCoachingSources: eligibility.accessMode === "coaching",
    }));
  }

  observeMetric(
    "today_dashboard.aggregation_latency_ms",
    performance.now() - startedAt,
  );
  const canWriteJournal =
    actorScope === "client" &&
    eligibility.accessMode !== "blocked" &&
    eligibility.public.status === "active" &&
    process.env.TODAY_JOURNAL_WRITES_ENABLED === "true" &&
    isJournalDateEditable(dateKey) &&
    sections.journal?.status !== "error";
  const journalIsDraft =
    sections.journal?.status === "ready" &&
    sections.journal.day?.status === "draft";
  return {
    contractVersion: 2,
    accessMode: eligibility.accessMode,
    dateKey,
    timeZone: APP_TIME_ZONE,
    eligibility: eligibility.public,
    summary: eligibility.canViewSources
      ? calculateTodaySummary(sections, partialErrors)
      : {
          dayStatus: "unavailable",
          completionPercent: 0,
          formulaVersion: "today-v2",
          moduleProgress: Object.fromEntries(
            ["training", "nutrition", "journal"].map((name) => [
              name,
              {
                completed: 0,
                total: 0,
                percent: null,
                state: "not_applicable",
              },
            ]),
          ),
          attentionFlags: [],
        },
    capabilities: {
      canViewSources: eligibility.canViewSources,
      canEditJournal: canWriteJournal,
      canSubmitDay: canWriteJournal && journalIsDraft,
      canComment:
        eligibility.accessMode === "coaching" &&
        eligibility.public.status === "active" &&
        process.env.TODAY_COMMENT_WRITES_ENABLED === "true",
    },
    sections,
    partialErrors,
  };
};
