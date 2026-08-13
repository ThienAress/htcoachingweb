const driftMeta = {
  clean: { label: "Đã đồng bộ", className: "bg-emerald-50 text-emerald-800" },
  changed: { label: "Có thay đổi", className: "bg-amber-50 text-amber-900" },
  review_due: { label: "Đến hạn review", className: "bg-cyan-50 text-cyan-900" },
  rate_limited: { label: "Giới hạn GitHub API", className: "bg-amber-50 text-amber-900" },
  unreachable: { label: "Không truy cập được", className: "bg-rose-50 text-rose-900" },
  audit_warning: { label: "Cảnh báo audit", className: "bg-rose-50 text-rose-900" },
  unknown: { label: "Chưa xác định", className: "bg-zinc-100 text-zinc-700" },
};

export const lifecycleMeta = {
  active: { label: "Đang theo dõi", className: "bg-emerald-50 text-emerald-800" },
  candidate: { label: "Ứng viên", className: "bg-cyan-50 text-cyan-900" },
  watch: { label: "Theo dõi chậm", className: "bg-blue-50 text-blue-900" },
  dormant: { label: "Ngủ đông", className: "bg-zinc-100 text-zinc-700" },
  archived: { label: "Đã lưu trữ", className: "bg-zinc-100 text-zinc-700" },
  rejected: { label: "Đã loại", className: "bg-rose-50 text-rose-900" },
};

export const getDriftMeta = (drift) => driftMeta[drift] || driftMeta.unknown;

export const getLifecycleMeta = (lifecycle) =>
  lifecycleMeta[lifecycle] || { label: "Chưa xác định", className: "bg-zinc-100 text-zinc-700" };

export const formatRadarDate = (value) => {
  if (!value) return "Chưa có";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có";
  return date.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatLicense = (license) =>
  ["UNVERIFIED", "NOASSERTION", null, undefined].includes(license)
    ? "Chưa xác minh"
    : license;

export const formatRadarRunDate = (value) => {
  if (!value) return "Chưa có lịch";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có lịch";
  return date.toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const getRadarRateLimitRetryAt = (item) =>
  item?.rateLimitRetryAt || item?.nextCheckAt || null;

export const filterSkillRadarItems = (
  items,
  { search = "", domain = "all", lifecycle = "all", drift = "all" },
) => {
  const normalizedSearch = search.trim().toLocaleLowerCase("vi");
  return (items || []).filter((item) => {
    const haystack = [
      item.name,
      item.sourceRepo,
      item.domain,
      item.summary,
      ...(item.localTargets || []),
    ]
      .join(" ")
      .toLocaleLowerCase("vi");
    return (
      (!normalizedSearch || haystack.includes(normalizedSearch)) &&
      (domain === "all" || item.domain === domain) &&
      (lifecycle === "all" || item.lifecycle === lifecycle) &&
      (drift === "all" || item.drift === drift)
    );
  });
};
