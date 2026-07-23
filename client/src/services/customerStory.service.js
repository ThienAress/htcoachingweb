import api from "../utils/api";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:5000/api" : "");

const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

const isExternalOrBundledAsset = (url) =>
  !url ||
  url.startsWith("http://") ||
  url.startsWith("https://") ||
  url.startsWith("data:") ||
  url.startsWith("blob:") ||
  url.startsWith("/assets/") ||
  url.startsWith("/src/");

const resolveImageUrl = (url) => {
  if (isExternalOrBundledAsset(url)) return url;
  if (url.startsWith("/")) return `${API_ORIGIN}${url}`;
  return `${API_ORIGIN}/${url}`;
};

const resolveImageArray = (value) => {
  if (!value) return [];
  if (typeof value === "string") return value.trim() ? [resolveImageUrl(value)] : [];
  if (Array.isArray(value)) return value.filter(Boolean).map(resolveImageUrl);
  return [];
};

const normalizeMilestone = (milestone = {}) => ({
  ...milestone,
  beforeImg: resolveImageArray(milestone.beforeImg),
  afterImg: resolveImageArray(milestone.afterImg),
  bullets: Array.isArray(milestone.bullets) ? milestone.bullets : [],
});

const normalizeStory = (story = {}) => ({
  ...story,
  beforeImg: resolveImageArray(story.beforeImg),
  afterImg: resolveImageArray(story.afterImg),
  heroImage: resolveImageUrl(story.heroImage || ""),
  highlights: Array.isArray(story.highlights) ? story.highlights : [],
  milestones: Array.isArray(story.milestones)
    ? story.milestones.map(normalizeMilestone)
    : [],
});

export const getPublicCustomerStories = async ({
  featured = false,
  limit = 12,
  trainerId,
  lang,
} = {}) => {
  const params = new URLSearchParams({
    limit: String(limit),
  });

  if (featured) {
    params.set("featured", "true");
  }
  
  if (trainerId) {
    params.set("trainerId", trainerId);
  }

  if (lang) {
    params.set("lang", lang);
  }

  const res = await api.get(`/customer-stories?${params.toString()}`);
  return {
    ...res.data,
    data: Array.isArray(res.data?.data)
      ? res.data.data.map(normalizeStory)
      : [],
  };
};

export const getPublicCustomerStoryBySlug = async (slug, { lang } = {}) => {
  const params = new URLSearchParams();
  if (lang) params.set("lang", lang);
  const qs = params.toString();
  const res = await api.get(`/customer-stories/${slug}${qs ? `?${qs}` : ""}`);
  return {
    ...res.data,
    data: normalizeStory(res.data?.data),
  };
};

export const getAdminCustomerStories = async ({
  page = 1,
  limit = 10,
  status = "",
  search = "",
} = {}) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (status) params.set("status", status);
  if (search.trim()) params.set("search", search.trim());

  const res = await api.get(`/customer-stories/admin?${params.toString()}`);
  return {
    ...res.data,
    data: Array.isArray(res.data?.data)
      ? res.data.data.map(normalizeStory)
      : [],
  };
};

export const getAdminCustomerStoryById = async (id) => {
  const res = await api.get(`/customer-stories/admin/${id}`);
  return {
    ...res.data,
    data: normalizeStory(res.data?.data),
  };
};

export const createCustomerStory = (payload) =>
  api.post("/customer-stories/admin", payload);

export const updateCustomerStory = (id, payload) =>
  api.patch(`/customer-stories/admin/${id}`, payload);

export const updateCustomerStoryStatus = (id, payload) =>
  api.patch(`/customer-stories/admin/${id}/status`, payload);

export const deleteCustomerStory = (id) =>
  api.delete(`/customer-stories/admin/${id}`);

export const uploadCustomerStoryImage = (formData) =>
  api.post("/customer-stories/admin/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
