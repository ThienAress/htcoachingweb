import SeoDailyMetric from "../models/SeoDailyMetric.js";

const escapedRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const keywordPipeline = ({ startDate, endDate, search = "" }) => {
  const match = {
    provider: "gsc",
    dimension: "query",
    dateKey: { $gte: startDate, $lte: endDate },
  };
  if (search) match.dimensionKey = { $regex: escapedRegex(search), $options: "i" };
  return [
    { $match: match },
    { $sort: { "metrics.clicks": -1, contentPath: 1 } },
    {
      $group: {
        _id: "$dimensionKey",
        rankingPage: { $first: "$contentPath" },
        pages: { $addToSet: "$contentPath" },
        clicks: { $sum: "$metrics.clicks" },
        impressions: { $sum: "$metrics.impressions" },
        weightedPosition: {
          $sum: { $multiply: ["$metrics.position", "$metrics.impressions"] },
        },
      },
    },
    {
      $addFields: {
        query: "$_id",
        pageCount: { $size: "$pages" },
        ctr: {
          $cond: [
            { $gt: ["$impressions", 0] },
            { $divide: ["$clicks", "$impressions"] },
            0,
          ],
        },
        position: {
          $cond: [
            { $gt: ["$impressions", 0] },
            { $divide: ["$weightedPosition", "$impressions"] },
            0,
          ],
        },
      },
    },
  ];
};

export const aggregateKeywordPerformance = async ({
  startDate,
  endDate,
  previousStartDate,
  previousEndDate,
  page,
  limit,
  search,
  sort,
  direction,
}) => {
  const sortFields = new Set(["clicks", "impressions", "ctr", "position", "query"]);
  const sortField = sortFields.has(sort) ? sort : "clicks";
  const sortDirection = direction === "asc" ? 1 : -1;
  const [current, previous] = await Promise.all([
    SeoDailyMetric.aggregate([
      ...keywordPipeline({ startDate, endDate, search }),
      { $sort: { [sortField]: sortDirection, query: 1 } },
      {
        $facet: {
          items: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $project: { _id: 0, pages: 0, weightedPosition: 0 } },
          ],
          total: [{ $count: "count" }],
        },
      },
    ]),
    SeoDailyMetric.aggregate([
      ...keywordPipeline({
        startDate: previousStartDate,
        endDate: previousEndDate,
        search,
      }),
      { $project: { _id: 0, query: 1, position: 1 } },
    ]),
  ]);
  const previousMap = new Map(previous.map((item) => [item.query, item.position]));
  const items = (current[0]?.items || []).map((item) => {
    const previousPosition = previousMap.get(item.query);
    const positionDelta =
      previousPosition === undefined ? null : item.position - previousPosition;
    const label =
      item.pageCount > 1
        ? "cannibalization"
        : positionDelta !== null && positionDelta > 2
          ? "declining"
          : item.impressions >= 50 && item.position >= 4 && item.position <= 20 && item.ctr < 0.05
            ? "opportunity"
            : null;
    return { ...item, previousPosition: previousPosition ?? null, positionDelta, label };
  });
  const total = current[0]?.total?.[0]?.count || 0;
  return {
    items,
    pagination: { total, page, limit, totalPages: Math.max(Math.ceil(total / limit), 1) },
  };
};
