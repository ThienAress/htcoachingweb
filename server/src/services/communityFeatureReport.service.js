import {
  COMMUNITY_FEATURE_CATALOG,
  COMMUNITY_FEATURE_CATALOG_VERSION,
  COMMUNITY_FEATURE_AUDIENCE_OPTIONS,
  COMMUNITY_FEATURE_DELIVERY_STATUSES,
  getCommunityFeatureAudienceKeys,
} from "../constants/communityFeatureCatalog.js";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DELIVERY_STATUSES = Object.values(COMMUNITY_FEATURE_DELIVERY_STATUSES);
const DELIVERY_STATUS_CODES = new Set(
  DELIVERY_STATUSES.map((status) => status.code),
);
const DELIVERY_STATUS_BY_CODE = new Map(
  DELIVERY_STATUSES.map((status) => [status.code, status]),
);

const reportError = (code, message) =>
  Object.assign(new Error(message), { code, statusCode: 400 });

const catalogError = (message) =>
  Object.assign(new Error(message), {
    code: "COMMUNITY_FEATURE_REPORT_CATALOG_INVALID",
    statusCode: 500,
  });

const parseDateOnly = (value, field) => {
  if (value == null || value === "") return null;
  const normalized = String(value);
  const match = DATE_ONLY_PATTERN.exec(normalized);
  if (!match) {
    throw reportError(
      "COMMUNITY_FEATURE_REPORT_DATE_INVALID",
      `Ngày ${field} không hợp lệ`,
    );
  }
  const [, year, month, day] = match;
  const candidate = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );
  if (candidate.toISOString().slice(0, 10) !== normalized) {
    throw reportError(
      "COMMUNITY_FEATURE_REPORT_DATE_INVALID",
      `Ngày ${field} không hợp lệ`,
    );
  }
  return normalized;
};

const assertSnapshot = (feature, record) => {
  const snapshot = record?.snapshot;
  if (
    !record?.improvementKey ||
    !record?.opportunity ||
    !record?.result ||
    !snapshot?.catalogVersion ||
    !snapshot?.featureLabel ||
    !snapshot?.group?.key ||
    !snapshot?.group?.label ||
    !snapshot?.priority?.code ||
    !Number.isInteger(snapshot?.priority?.rank) ||
    !snapshot?.priority?.label ||
    !snapshot?.primaryValue ||
    !Array.isArray(snapshot?.audiences) ||
    snapshot.audiences.length === 0 ||
    !Array.isArray(record?.milestones) ||
    record.milestones.length === 0
  ) {
    throw catalogError(`Invalid improvement history: ${feature.featureKey}`);
  }
  return snapshot;
};

const parseHistoryDate = (value, featureKey) => {
  try {
    return parseDateOnly(value, "trạng thái");
  } catch {
    throw catalogError(`Invalid history date: ${featureKey}`);
  }
};

const flattenHistory = (catalog) =>
  catalog.flatMap((feature) => {
    if (!Array.isArray(feature.improvementHistory)) {
      throw catalogError(`Invalid feature history: ${feature.featureKey}`);
    }
    return feature.improvementHistory.flatMap((record) => {
      const snapshot = assertSnapshot(feature, record);
      let previousRank = -1;
      let previousDate = null;
      return record.milestones.map((milestone) => {
        const statusCode = milestone?.status?.code;
        if (!DELIVERY_STATUS_CODES.has(statusCode)) {
          throw catalogError(`Invalid delivery status: ${statusCode || "missing"}`);
        }
        const canonicalStatus = DELIVERY_STATUS_BY_CODE.get(statusCode);
        const statusDate = parseHistoryDate(
          milestone.statusDate,
          feature.featureKey,
        );
        if (
          canonicalStatus.rank < previousRank ||
          (previousDate && statusDate < previousDate)
        ) {
          throw catalogError(`Invalid milestone order: ${feature.featureKey}`);
        }
        previousRank = canonicalStatus.rank;
        previousDate = statusDate;
        return {
          eventKey: `${feature.featureKey}:${record.improvementKey}:${statusCode}:${statusDate}`,
          featureKey: feature.featureKey,
          improvementKey: record.improvementKey,
          statusDate,
          status: canonicalStatus,
          snapshotVersion: snapshot.catalogVersion,
          featureLabel: snapshot.featureLabel,
          group: snapshot.group,
          priority: snapshot.priority,
          primaryValue: snapshot.primaryValue,
          audiences: snapshot.audiences,
          opportunity: record.opportunity,
          result: record.result,
        };
      });
    });
  });

const sortEvents = (left, right) =>
  left.statusDate.localeCompare(right.statusDate) ||
  left.featureLabel.localeCompare(right.featureLabel, "vi") ||
  left.improvementKey.localeCompare(right.improvementKey) ||
  left.status.rank - right.status.rank;

const getAvailableRange = (events) => {
  if (events.length === 0) return { from: null, to: null };
  const dates = events.map((event) => event.statusDate).sort();
  return { from: dates[0], to: dates.at(-1) };
};

const getGroupKeys = (catalog, events) =>
  new Set([
    ...catalog.map((feature) => feature.group?.key).filter(Boolean),
    ...events.map((event) => event.group.key),
  ]);

const getAudienceKeys = (catalog, events) =>
  new Set([
    ...catalog.flatMap((feature) =>
      getCommunityFeatureAudienceKeys(feature.audiences),
    ),
    ...events.flatMap((event) =>
      getCommunityFeatureAudienceKeys(event.audiences),
    ),
  ]);

const buildTimeline = (rows) => {
  const days = new Map();
  rows.forEach((event) => {
    if (!days.has(event.statusDate)) {
      days.set(event.statusDate, new Map());
    }
    const features = days.get(event.statusDate);
    if (!features.has(event.featureKey)) {
      features.set(event.featureKey, {
        featureKey: event.featureKey,
        featureLabel: event.featureLabel,
        improvementCount: 0,
        improvements: [],
      });
    }
    const feature = features.get(event.featureKey);
    if (
      !feature.improvements.some(
        (item) => item.improvementKey === event.improvementKey,
      )
    ) {
      feature.improvementCount += 1;
    }
    feature.improvements.push({
      eventKey: event.eventKey,
      improvementKey: event.improvementKey,
      opportunity: event.opportunity,
      result: event.result,
      status: event.status,
    });
  });
  return [...days.entries()].map(([date, features]) => ({
    date,
    features: [...features.values()],
  }));
};

export const getCommunityFeatureReportOptions = (
  catalog = COMMUNITY_FEATURE_CATALOG,
) => {
  const events = flattenHistory(catalog);
  return {
    statuses: DELIVERY_STATUSES,
    audiences: COMMUNITY_FEATURE_AUDIENCE_OPTIONS,
    dateRange: getAvailableRange(events),
  };
};

export const buildCommunityFeatureReport = (
  query = {},
  {
    catalog = COMMUNITY_FEATURE_CATALOG,
    catalogVersion = COMMUNITY_FEATURE_CATALOG_VERSION,
    now = new Date(),
  } = {},
) => {
  const allEvents = flattenHistory(catalog).sort(sortEvents);
  const availableDateRange = getAvailableRange(allEvents);
  const from = parseDateOnly(query.from, "bắt đầu") || availableDateRange.from;
  const to = parseDateOnly(query.to, "kết thúc") || availableDateRange.to;
  const group = String(query.group || "all");
  const audience = String(query.audience || "all");
  const status = String(query.status || "all");

  if (from && to && from > to) {
    throw reportError(
      "COMMUNITY_FEATURE_REPORT_DATE_RANGE_INVALID",
      "Khoảng ngày báo cáo không hợp lệ",
    );
  }
  if (group !== "all" && !getGroupKeys(catalog, allEvents).has(group)) {
    throw reportError(
      "COMMUNITY_FEATURE_REPORT_GROUP_INVALID",
      "Nhóm tính năng không hợp lệ",
    );
  }
  if (status !== "all" && !DELIVERY_STATUS_CODES.has(status)) {
    throw reportError(
      "COMMUNITY_FEATURE_REPORT_STATUS_INVALID",
      "Trạng thái xử lý không hợp lệ",
    );
  }
  if (audience !== "all" && !getAudienceKeys(catalog, allEvents).has(audience)) {
    throw reportError(
      "COMMUNITY_FEATURE_REPORT_AUDIENCE_INVALID",
      "Đối tượng tính năng không hợp lệ",
    );
  }

  const rows = allEvents.filter(
    (event) =>
      (!from || event.statusDate >= from) &&
      (!to || event.statusDate <= to) &&
      (group === "all" || event.group.key === group) &&
      (audience === "all" ||
        getCommunityFeatureAudienceKeys(event.audiences).includes(audience)) &&
      (status === "all" || event.status.code === status),
  );
  const improvementKeys = new Set(
    rows.map((event) => `${event.featureKey}:${event.improvementKey}`),
  );
  const featureKeys = new Set(rows.map((event) => event.featureKey));
  const statusCounts = Object.fromEntries(
    DELIVERY_STATUSES.map((item) => [item.code, 0]),
  );
  rows.forEach((event) => {
    statusCounts[event.status.code] += 1;
  });
  const openF0Count = catalog.filter(
    (feature) =>
      feature.currentImprovement &&
      feature.priority?.code === "F0" &&
      (group === "all" || feature.group?.key === group) &&
      (audience === "all" ||
        getCommunityFeatureAudienceKeys(feature.audiences).includes(audience)),
  ).length;
  const selectedGroupLabel =
    catalog.find((feature) => feature.group?.key === group)?.group?.label ||
    allEvents.find((event) => event.group.key === group)?.group?.label;
  const selectedStatus = DELIVERY_STATUSES.find((item) => item.code === status);
  const selectedAudience = COMMUNITY_FEATURE_AUDIENCE_OPTIONS.find(
    (item) => item.key === audience,
  );

  return {
    catalogVersion,
    generatedAt: now.toISOString(),
    availableDateRange,
    filters: { from, to, group, audience, status },
    filterLabels: {
      group: group === "all" ? "Tất cả nhóm" : selectedGroupLabel || group,
      audience:
        audience === "all"
          ? "Tất cả đối tượng"
          : selectedAudience?.label || audience,
      status:
        status === "all" ? "Tất cả trạng thái" : selectedStatus?.label,
    },
    summary: {
      eventCount: rows.length,
      improvementCount: improvementKeys.size,
      featureCount: featureKeys.size,
      productionVerifiedCount: statusCounts.production_verified,
      openF0Count,
      latestDate: rows.at(-1)?.statusDate || null,
      statusCounts,
    },
    timeline: buildTimeline(rows),
    rows,
  };
};
