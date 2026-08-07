import AnalyticsSyncState from "../models/AnalyticsSyncState.js";
import BlogPost from "../models/BlogPost.js";
import Booking from "../models/Booking.js";
import ContactMessage from "../models/ContactMessage.js";
import SeoDailyMetric from "../models/SeoDailyMetric.js";
import {
  aggregateBlogPerformance,
} from "./seoAnalyticsAggregation.service.js";
import { aggregateKeywordPerformance } from "./seoAnalyticsKeywordAggregation.service.js";
import { getExplicitConversionFunnel } from "./seoConversionFunnel.service.js";

const STALE_AFTER_MS = 48 * 60 * 60 * 1000;

const dateBounds = (startDate, endDate) => {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const endExclusive = new Date(`${endDate}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  return { start, endExclusive };
};

const previousWindow = (startDate, endDate) => {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const previousEnd = new Date(start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - days + 1);
  return {
    previousStartDate: previousStart.toISOString().slice(0, 10),
    previousEndDate: previousEnd.toISOString().slice(0, 10),
  };
};

const groupDimension = async (dimension, contentPath, startDate, endDate) =>
  SeoDailyMetric.aggregate([
    {
      $match: {
        provider: "ga4",
        dimension,
        contentPath,
        dateKey: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: "$dimensionKey",
        activeUsers: { $sum: "$metrics.activeUsers" },
      },
    },
    { $sort: { activeUsers: -1, _id: 1 } },
    { $limit: 20 },
    { $project: { _id: 0, key: "$_id", activeUsers: 1 } },
  ]);

const providerHealth = (provider, configured, state, now) => {
  if (!configured) return { provider, health: "not_configured", lastSyncedAt: null };
  if (!state) return { provider, health: "never_synced", lastSyncedAt: null };
  const lastSyncedAt = state.lastSuccessAt || null;
  const stale = !lastSyncedAt || now.getTime() - lastSyncedAt.getTime() > STALE_AFTER_MS;
  let health = state.status === "partial" ? "partial" : state.status === "error" ? "error" : "ready";
  if (stale && health === "ready") health = "stale";
  return {
    provider,
    health,
    stale,
    lastSyncedAt,
    errorCode: state.lastErrorCode || "",
  };
};

export const createSeoAnalyticsReadService = ({
  providerConfiguration = { ga4: false, gsc: false },
  now = () => new Date(),
  getConversionFunnel = getExplicitConversionFunnel,
} = {}) => {
  const getProviders = async () => {
    const states = await AnalyticsSyncState.find({
      provider: { $in: ["ga4", "gsc"] },
    }).lean();
    const stateMap = new Map(states.map((state) => [state.provider, state]));
    return ["ga4", "gsc"].map((provider) =>
      providerHealth(
        provider,
        Boolean(providerConfiguration[provider]),
        stateMap.get(provider),
        now(),
      ),
    );
  };

  return {
    getProviders,

    async getOverview({ startDate, endDate }) {
      const { start, endExclusive } = dateBounds(startDate, endDate);
      const [aggregate, contactLeads, bookingLeads, providers, conversions] = await Promise.all([
        SeoDailyMetric.aggregate([
          {
            $match: {
              dateKey: { $gte: startDate, $lte: endDate },
              $or: [
                { dimension: "overview" },
                { dimension: "event", contentPath: "" },
              ],
            },
          },
          {
            $group: {
              _id: null,
              impressions: { $sum: "$metrics.impressions" },
              clicks: { $sum: "$metrics.clicks" },
              activeUsers: { $sum: "$metrics.activeUsers" },
              newUsers: { $sum: "$metrics.newUsers" },
              returningUsers: { $sum: "$metrics.returningUsers" },
              engagedReads: { $sum: "$metrics.engagedReads" },
              ctaClicks: { $sum: "$metrics.ctaClicks" },
              trackedLeads: { $sum: "$metrics.leads" },
              weightedPosition: {
                $sum: { $multiply: ["$metrics.position", "$metrics.impressions"] },
              },
            },
          },
        ]),
        ContactMessage.countDocuments({ createdAt: { $gte: start, $lt: endExclusive } }),
        Booking.countDocuments({ createdAt: { $gte: start, $lt: endExclusive } }),
        getProviders(),
        getConversionFunnel({ start, endExclusive }),
      ]);
      const values = aggregate[0] || {};
      const impressions = values.impressions || 0;
      const clicks = values.clicks || 0;
      return {
        range: { startDate, endDate },
        kpis: {
          impressions,
          clicks,
          ctr: impressions > 0 ? clicks / impressions : 0,
          position:
            impressions > 0 ? (values.weightedPosition || 0) / impressions : 0,
          activeUsers: values.activeUsers || 0,
          newUsers: values.newUsers || 0,
          returningUsers: values.returningUsers || 0,
          engagedReads: values.engagedReads || 0,
          ctaClicks: values.ctaClicks || 0,
          trackedLeads: values.trackedLeads || 0,
          leads: contactLeads + bookingLeads,
          contactLeads,
          bookingLeads,
          assessments: conversions.assessments,
          customers: conversions.customers,
          unattributedAssessments: conversions.unattributed.assessments,
          unattributedCustomers: conversions.unattributed.customers,
        },
        providers,
      };
    },

    async getBlogPerformance(options) {
      const normalized = {
        ...options,
        page: Number(options.page) || 1,
        limit: Number(options.limit) || 20,
        sort: options.sort || "publishedAt",
        direction: options.direction || "desc",
        search: options.search || "",
      };
      const bounds = dateBounds(normalized.startDate, normalized.endDate);
      return aggregateBlogPerformance({ ...normalized, ...bounds });
    },

    async getKeywordPerformance(options) {
      const normalized = {
        ...options,
        page: Number(options.page) || 1,
        limit: Number(options.limit) || 20,
        sort: options.sort || "clicks",
        direction: options.direction || "desc",
        search: options.search || "",
      };
      return aggregateKeywordPerformance({
        ...normalized,
        ...previousWindow(normalized.startDate, normalized.endDate),
      });
    },

    async getBlogDetail({ slug, startDate, endDate }) {
      const blog = await BlogPost.findOne({ slug, status: "published" })
        .select("title slug category publishedAt views")
        .lean();
      if (!blog) return null;
      const contentPath = `/blog/${slug}/`;
      const { start, endExclusive } = dateBounds(startDate, endDate);
      const [trend, queries, sources, devices, contactLeads, bookingLeads, conversions] =
        await Promise.all([
          SeoDailyMetric.aggregate([
            {
              $match: {
                dateKey: { $gte: startDate, $lte: endDate },
                $or: [
                  { dimension: "page", dimensionKey: contentPath },
                  { dimension: "event", contentPath },
                ],
              },
            },
            {
              $group: {
                _id: "$dateKey",
                clicks: { $sum: "$metrics.clicks" },
                impressions: { $sum: "$metrics.impressions" },
                activeUsers: { $sum: "$metrics.activeUsers" },
                engagedReads: { $sum: "$metrics.engagedReads" },
                ctaClicks: { $sum: "$metrics.ctaClicks" },
              },
            },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, dateKey: "$_id", clicks: 1, impressions: 1, activeUsers: 1, engagedReads: 1, ctaClicks: 1 } },
          ]),
          SeoDailyMetric.aggregate([
            {
              $match: {
                provider: "gsc",
                dimension: "query",
                contentPath,
                dateKey: { $gte: startDate, $lte: endDate },
              },
            },
            {
              $group: {
                _id: "$dimensionKey",
                clicks: { $sum: "$metrics.clicks" },
                impressions: { $sum: "$metrics.impressions" },
              },
            },
            { $sort: { clicks: -1, _id: 1 } },
            { $limit: 20 },
            { $project: { _id: 0, query: "$_id", clicks: 1, impressions: 1 } },
          ]),
          groupDimension("source_medium", contentPath, startDate, endDate),
          groupDimension("device", contentPath, startDate, endDate),
          ContactMessage.countDocuments({
            "attribution.contentSlug": slug,
            createdAt: { $gte: start, $lt: endExclusive },
          }),
          Booking.countDocuments({
            "attribution.contentSlug": slug,
            createdAt: { $gte: start, $lt: endExclusive },
          }),
          getConversionFunnel({ start, endExclusive, contentSlug: slug }),
        ]);
      const totals = trend.reduce(
        (sum, item) => ({
          activeUsers: sum.activeUsers + item.activeUsers,
          engagedReads: sum.engagedReads + item.engagedReads,
          ctaClicks: sum.ctaClicks + item.ctaClicks,
        }),
        { activeUsers: 0, engagedReads: 0, ctaClicks: 0 },
      );
      return {
        blog: {
          title: blog.title,
          slug: blog.slug,
          category: blog.category,
          publishedAt: blog.publishedAt,
          legacyViews: blog.views || 0,
        },
        trend,
        queries,
        sources,
        devices,
        funnel: {
          ...totals,
          leads: contactLeads + bookingLeads,
          assessments: conversions.assessments,
          customers: conversions.customers,
        },
      };
    },
  };
};
