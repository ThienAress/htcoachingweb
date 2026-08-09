import Booking from "../models/Booking.js";
import ContactMessage from "../models/ContactMessage.js";
import F1Customer from "../models/F1Customer.js";
import Order from "../models/Order.js";

const ASSESSED_STATUSES = [
  "assessment_completed",
  "ai_report_generated",
  "program_started",
];
const CUSTOMER_ORDER_STATUSES = ["approved", "completed"];

const originKey = (document) => {
  if (document.originBookingId) {
    return `booking:${document.originBookingId}`;
  }
  if (document.originContactMessageId) {
    return `contact:${document.originContactMessageId}`;
  }
  return "";
};

const explicitOriginMatch = (bookingIds, contactIds) => ({
  $or: [
    { originBookingId: { $in: bookingIds } },
    { originContactMessageId: { $in: contactIds } },
  ],
});

const leadFilter = ({ start, endExclusive, contentSlug }) => ({
  createdAt: { $gte: start, $lt: endExclusive },
  ...(contentSlug ? { "attribution.contentSlug": contentSlug } : {}),
});

export const getExplicitConversionFunnel = async ({
  start,
  endExclusive,
  contentSlug = "",
}) => {
  const [bookingLeads, contactLeads] = await Promise.all([
    Booking.find(leadFilter({ start, endExclusive, contentSlug }))
      .select("_id")
      .lean(),
    ContactMessage.find(leadFilter({ start, endExclusive, contentSlug }))
      .select("_id")
      .lean(),
  ]);
  const bookingIds = bookingLeads.map(({ _id }) => _id);
  const contactIds = contactLeads.map(({ _id }) => _id);
  const hasLeadCohort = bookingIds.length > 0 || contactIds.length > 0;
  const originMatch = explicitOriginMatch(bookingIds, contactIds);

  const [assessments, programStarts, approvedOrders] = hasLeadCohort
    ? await Promise.all([
        F1Customer.find({
          ...originMatch,
          status: { $in: ASSESSED_STATUSES },
        })
          .select("+originBookingId +originContactMessageId")
          .lean(),
        F1Customer.find({ ...originMatch, status: "program_started" })
          .select("+originBookingId +originContactMessageId")
          .lean(),
        Order.find({
          ...originMatch,
          status: { $in: CUSTOMER_ORDER_STATUSES },
        })
          .select("+originBookingId +originContactMessageId")
          .lean(),
      ])
    : [[], [], []];

  const assessmentOrigins = new Set(assessments.map(originKey).filter(Boolean));
  const customerOrigins = new Set(
    [...programStarts, ...approvedOrders].map(originKey).filter(Boolean),
  );

  let unattributed = { assessments: 0, customers: 0 };
  if (!contentSlug) {
    const createdAt = { $gte: start, $lt: endExclusive };
    const noOrigin = {
      originBookingId: null,
      originContactMessageId: null,
    };
    const [unattributedAssessments, unattributedPrograms, unattributedOrders] =
      await Promise.all([
        F1Customer.countDocuments({
          ...noOrigin,
          createdAt,
          status: { $in: ASSESSED_STATUSES },
        }),
        F1Customer.countDocuments({
          ...noOrigin,
          createdAt,
          status: "program_started",
        }),
        Order.countDocuments({
          ...noOrigin,
          createdAt,
          status: { $in: CUSTOMER_ORDER_STATUSES },
        }),
      ]);
    unattributed = {
      assessments: unattributedAssessments,
      customers: unattributedPrograms + unattributedOrders,
    };
  }

  return {
    assessments: assessmentOrigins.size,
    customers: customerOrigins.size,
    unattributed,
  };
};
