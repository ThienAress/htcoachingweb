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

const normalizeTrainer = (trainer = {}) => ({
  ...trainer,
  image: resolveImageUrl(trainer.image || ""),
  specialties: Array.isArray(trainer.specialties) ? trainer.specialties : [],
});

export const getPublicTrainers = async ({
  featured = false,
  limit = 12,
} = {}) => {
  const params = new URLSearchParams({
    limit: String(limit),
  });

  if (featured) {
    params.set("featured", "true");
  }

  const res = await api.get(`/trainers?${params.toString()}`);
  return {
    ...res.data,
    data: Array.isArray(res.data?.data)
      ? res.data.data.map(normalizeTrainer)
      : [],
  };
};

export const getPublicTrainerBySlug = async (slug) => {
  const res = await api.get(`/trainers/${slug}`);
  return {
    ...res.data,
    data: normalizeTrainer(res.data?.data),
  };
};

export const getAdminTrainers = async ({
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

  const res = await api.get(`/trainers/admin?${params.toString()}`);
  return {
    ...res.data,
    data: Array.isArray(res.data?.data)
      ? res.data.data.map(normalizeTrainer)
      : [],
  };
};

export const getAdminTrainerById = async (id) => {
  const res = await api.get(`/trainers/admin/${id}`);
  return {
    ...res.data,
    data: normalizeTrainer(res.data?.data),
  };
};

export const createTrainer = (payload) =>
  api.post("/trainers/admin", payload);

export const updateTrainer = (id, payload) =>
  api.patch(`/trainers/admin/${id}`, payload);

export const updateTrainerStatus = (id, payload) =>
  api.patch(`/trainers/admin/${id}/status`, payload);

export const deleteTrainer = (id) =>
  api.delete(`/trainers/admin/${id}`);

export const uploadTrainerImage = (formData) =>
  api.post("/trainers/admin/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
