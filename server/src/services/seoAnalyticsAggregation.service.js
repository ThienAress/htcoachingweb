import BlogPost from "../models/BlogPost.js";
import Booking from "../models/Booking.js";
import ContactMessage from "../models/ContactMessage.js";
import SeoDailyMetric from "../models/SeoDailyMetric.js";
import { GA4_PRODUCTION_DATA_SCOPE } from "./seoAnalytics.constants.js";

const escapedRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const metricSum = (conditions, field) => ({
  $sum: {
    $cond: [
      { $and: conditions },
      { $ifNull: [`$metrics.${field}`, 0] },
      0,
    ],
  },
});

const analyticsLookup = (startDate, endDate) => ({
  from: SeoDailyMetric.collection.name,
  let: { contentPath: { $concat: ["/blog/", "$slug", "/"] } },
  pipeline: [
    {
      $match: {
        $expr: {
          $and: [
            { $gte: ["$dateKey", startDate] },
            { $lte: ["$dateKey", endDate] },
            {
              $or: [
                { $eq: ["$provider", "gsc"] },
                {
                  $and: [
                    { $eq: ["$provider", "ga4"] },
                    { $eq: ["$dataScope", GA4_PRODUCTION_DATA_SCOPE] },
                  ],
                },
              ],
            },
            {
              $or: [
                {
                  $and: [
                    { $eq: ["$dimension", "page"] },
                    { $eq: ["$dimensionKey", "$$contentPath"] },
                  ],
                },
                { $eq: ["$contentPath", "$$contentPath"] },
              ],
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        clicks: metricSum(
          [{ $eq: ["$provider", "gsc"] }, { $eq: ["$dimension", "page"] }],
          "clicks",
        ),
        impressions: metricSum(
          [{ $eq: ["$provider", "gsc"] }, { $eq: ["$dimension", "page"] }],
          "impressions",
        ),
        activeUsers: metricSum(
          [{ $eq: ["$provider", "ga4"] }, { $eq: ["$dimension", "page"] }],
          "activeUsers",
        ),
        engagedReads: metricSum(
          [
            { $eq: ["$provider", "ga4"] },
            { $eq: ["$dimension", "event"] },
          ],
          "engagedReads",
        ),
        ctaClicks: metricSum(
          [
            { $eq: ["$provider", "ga4"] },
            { $eq: ["$dimension", "event"] },
          ],
          "ctaClicks",
        ),
      },
    },
  ],
  as: "analytics",
});

const leadLookup = (collection, start, endExclusive, output) => ({
  from: collection,
  let: { contentSlug: "$slug" },
  pipeline: [
    {
      $match: {
        $expr: {
          $and: [
            { $eq: ["$attribution.contentSlug", "$$contentSlug"] },
            { $gte: ["$createdAt", start] },
            { $lt: ["$createdAt", endExclusive] },
          ],
        },
      },
    },
    { $count: "count" },
  ],
  as: output,
});

const blogSort = (sort, direction) => {
  const fields = {
    publishedAt: "publishedAt",
    title: "title",
    clicks: "clicks",
    impressions: "impressions",
    activeUsers: "activeUsers",
    engagedReads: "engagedReads",
    ctaClicks: "ctaClicks",
    leads: "leads",
    conversionRate: "conversionRate",
    legacyViews: "legacyViews",
  };
  return { [fields[sort] || "publishedAt"]: direction === "asc" ? 1 : -1, _id: 1 };
};

export const aggregateBlogPerformance = async ({
  startDate,
  endDate,
  start,
  endExclusive,
  page,
  limit,
  search = "",
  sort,
  direction,
}) => {
  const match = { status: "published" };
  if (search) match.title = { $regex: escapedRegex(search), $options: "i" };
  const [result] = await BlogPost.aggregate([
    { $match: match },
    { $lookup: analyticsLookup(startDate, endDate) },
    {
      $lookup: leadLookup(
        ContactMessage.collection.name,
        start,
        endExclusive,
        "contactLeads",
      ),
    },
    {
      $lookup: leadLookup(
        Booking.collection.name,
        start,
        endExclusive,
        "bookingLeads",
      ),
    },
    {
      $addFields: {
        analytics: { $ifNull: [{ $arrayElemAt: ["$analytics", 0] }, {}] },
        contactLeadCount: {
          $ifNull: [{ $arrayElemAt: ["$contactLeads.count", 0] }, 0],
        },
        bookingLeadCount: {
          $ifNull: [{ $arrayElemAt: ["$bookingLeads.count", 0] }, 0],
        },
      },
    },
    {
      $addFields: {
        clicks: { $ifNull: ["$analytics.clicks", 0] },
        impressions: { $ifNull: ["$analytics.impressions", 0] },
        activeUsers: { $ifNull: ["$analytics.activeUsers", 0] },
        engagedReads: { $ifNull: ["$analytics.engagedReads", 0] },
        ctaClicks: { $ifNull: ["$analytics.ctaClicks", 0] },
        leads: { $add: ["$contactLeadCount", "$bookingLeadCount"] },
        legacyViews: "$views",
      },
    },
    {
      $addFields: {
        ctr: {
          $cond: [
            { $gt: ["$impressions", 0] },
            { $divide: ["$clicks", "$impressions"] },
            0,
          ],
        },
        conversionRate: {
          $cond: [
            { $gt: ["$activeUsers", 0] },
            { $multiply: [{ $divide: ["$leads", "$activeUsers"] }, 100] },
            0,
          ],
        },
      },
    },
    { $sort: blogSort(sort, direction) },
    {
      $facet: {
        items: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              title: 1,
              slug: 1,
              category: 1,
              publishedAt: 1,
              clicks: 1,
              impressions: 1,
              ctr: 1,
              activeUsers: 1,
              engagedReads: 1,
              ctaClicks: 1,
              leads: 1,
              conversionRate: 1,
              legacyViews: 1,
            },
          },
        ],
        total: [{ $count: "count" }],
      },
    },
  ]);
  const total = result?.total?.[0]?.count || 0;
  return {
    items: result?.items || [],
    pagination: { total, page, limit, totalPages: Math.max(Math.ceil(total / limit), 1) },
  };
};
