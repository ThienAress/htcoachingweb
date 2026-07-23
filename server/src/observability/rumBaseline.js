import WebVitalSample from "../models/WebVitalSample.js";

const round = (value, digits = 2) =>
  Number(Number(value || 0).toFixed(digits));

export const getRumBaseline = async ({ days = 7, now = new Date() } = {}) => {
  const boundedDays = Math.min(Math.max(Number(days) || 7, 1), 30);
  const to = new Date(now);
  const from = new Date(to.getTime() - boundedDays * 24 * 60 * 60 * 1000);

  const [groups, oldest, latest, samples] = await Promise.all([
    WebVitalSample.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { route: "$route", device: "$device", name: "$name" },
          samples: { $sum: 1 },
          average: { $avg: "$value" },
          maximum: { $max: "$value" },
          p75: {
            $percentile: {
              input: "$value",
              method: "approximate",
              p: [0.75],
            },
          },
          good: {
            $sum: { $cond: [{ $eq: ["$rating", "good"] }, 1, 0] },
          },
          needsImprovement: {
            $sum: {
              $cond: [
                { $eq: ["$rating", "needs-improvement"] },
                1,
                0,
              ],
            },
          },
          poor: {
            $sum: { $cond: [{ $eq: ["$rating", "poor"] }, 1, 0] },
          },
        },
      },
      { $sort: { "_id.route": 1, "_id.device": 1, "_id.name": 1 } },
      { $limit: 1000 },
    ]),
    WebVitalSample.findOne({ createdAt: { $gte: from, $lte: to } })
      .sort({ createdAt: 1 })
      .select({ createdAt: 1, _id: 0 })
      .lean(),
    WebVitalSample.findOne({ createdAt: { $gte: from, $lte: to } })
      .sort({ createdAt: -1 })
      .select({ createdAt: 1, _id: 0 })
      .lean(),
    WebVitalSample.countDocuments({ createdAt: { $gte: from, $lte: to } }),
  ]);

  const coverageHours = oldest
    ? round((to.getTime() - oldest.createdAt.getTime()) / (60 * 60 * 1000))
    : 0;
  const latestAgeHours = latest
    ? round((to.getTime() - latest.createdAt.getTime()) / (60 * 60 * 1000))
    : 0;

  return {
    windowDays: boundedDays,
    from: from.toISOString(),
    to: to.toISOString(),
    samples,
    coverageHours,
    latestAgeHours,
    baselineReady:
      samples > 0 &&
      coverageHours >= boundedDays * 24 - 1 &&
      latestAgeHours <= 24,
    firstSampleAt: oldest?.createdAt?.toISOString() || null,
    lastSampleAt: latest?.createdAt?.toISOString() || null,
    groups: groups.map((group) => ({
      route: group._id.route,
      device: group._id.device,
      name: group._id.name,
      samples: group.samples,
      average: round(group.average),
      p75: round(group.p75?.[0]),
      maximum: round(group.maximum),
      ratings: {
        good: group.good,
        needsImprovement: group.needsImprovement,
        poor: group.poor,
      },
    })),
  };
};
