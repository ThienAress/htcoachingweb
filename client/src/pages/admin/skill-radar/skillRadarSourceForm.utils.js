const GITHUB_HOST = "github.com";
const ALLOWED_LIFECYCLES = new Set(["candidate", "active", "watch"]);

export const validateGitHubRepoUrl = (value) => {
  try {
    const url = new URL(value.trim());
    const segments = url.pathname.split("/").filter(Boolean);
    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !== GITHUB_HOST ||
      segments.length !== 2
    ) {
      return "Dán URL repository dạng https://github.com/owner/repository.";
    }
    return "";
  } catch {
    return "Dán URL repository GitHub hợp lệ để phân tích.";
  }
};

export const previewToForm = (preview) => ({
  sourceType: preview.sourceType || "repository",
  name: preview.name || preview.sourceRepo?.split("/").at(-1) || "",
  domain: preview.domain || "Công nghệ khác",
  summary: preview.summary || "",
  localTargets: (preview.localTargets || []).join(", "),
  lifecycle: preview.lifecycle || "candidate",
});

export const formToCreatePayload = (form, preview) => ({
  sourceUrl: preview.repoUrl,
  sourceType: form.sourceType,
  name: form.name.trim(),
  domain: form.domain.trim(),
  summary: form.summary.trim(),
  localTargets: form.localTargets
    .split(",")
    .map((target) => target.trim())
    .filter(Boolean),
  lifecycle: form.lifecycle,
});

export const validateSkillRadarSourceForm = (form) => {
  if (!form) return "Hãy phân tích repository trước khi lưu.";
  if (!["skill", "repository"].includes(form.sourceType)) {
    return "Loại nguồn chưa hợp lệ.";
  }
  if (!form.name.trim() || form.name.trim().length > 120) {
    return "Tên nguồn cần từ 1 đến 120 ký tự.";
  }
  if (!form.domain.trim() || form.domain.trim().length > 80) {
    return "Lĩnh vực cần từ 1 đến 80 ký tự.";
  }
  if (!form.summary.trim() || form.summary.trim().length > 500) {
    return "Tóm tắt cần từ 1 đến 500 ký tự.";
  }
  const localTargets = form.localTargets
    .split(",")
    .map((target) => target.trim())
    .filter(Boolean);
  if (
    localTargets.length < 1 ||
    localTargets.length > 12 ||
    localTargets.some((target) => target.length > 120)
  ) {
    return "Ảnh hưởng local cần 1–12 mục, mỗi mục tối đa 120 ký tự.";
  }
  if (!ALLOWED_LIFECYCLES.has(form.lifecycle)) {
    return "Lifecycle chưa hợp lệ.";
  }
  return "";
};

export const buildCreatedRadarItem = (result, preview, form) => {
  const payload = formToCreatePayload(form, preview);
  const saved = result?.item || result?.source || result || {};
  return {
    ...preview,
    ...payload,
    ...saved,
    id: saved.id || preview.id || preview.sourceRepo?.toLowerCase(),
    sourceRepo: preview.sourceRepo,
    repoUrl: saved.repoUrl || preview.repoUrl,
    drift: "review_due",
    lastReviewedAt: null,
    decision: "pending",
    auditSummary: Array.isArray(preview.auditSummary) ? preview.auditSummary : [],
  };
};

export const getSkillRadarMutationError = (error, fallback) => {
  const status = error?.response?.status;
  const data = error?.response?.data || {};
  const retryAt = data.retryAt || data.details?.retryAt || data.data?.retryAt;

  if (status === 409) {
    return { message: "Nguồn này đã có trong Radar. Không cần thêm lại." };
  }
  if (
    status === 429 ||
    data.code === "GITHUB_RATE_LIMITED" ||
    data.code === "SKILL_RADAR_GITHUB_RATE_LIMITED"
  ) {
    return {
      message: "GitHub đang giới hạn lượt đọc metadata. Dữ liệu Radar hiện có vẫn được giữ nguyên.",
      retryAt,
    };
  }
  if (status === 400 || status === 422) {
    return { message: data.message || "Thông tin nguồn chưa hợp lệ. Kiểm tra và thử lại." };
  }
  return { message: data.message || fallback };
};
