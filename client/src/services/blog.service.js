import api from "../utils/api";

// ==================== PUBLIC ====================

export const getPublicBlogPosts = async (params = {}) => {
  const res = await api.get("/blog", { params });
  return res.data;
};

export const getPublicBlogPostBySlug = async (slug) => {
  const res = await api.get(`/blog/${slug}`);
  return res.data;
};

// ==================== ADMIN ====================

export const getAdminBlogPosts = async (params = {}) => {
  const res = await api.get("/blog/admin", { params });
  return res.data;
};

export const getAdminBlogPostById = async (id) => {
  const res = await api.get(`/blog/admin/${id}`);
  return res.data;
};

export const createBlogPost = async (data) => {
  const res = await api.post("/blog/admin", data);
  return res.data;
};

export const updateBlogPost = async (id, data) => {
  const res = await api.patch(`/blog/admin/${id}`, data);
  return res.data;
};

export const deleteBlogPost = async (id) => {
  const res = await api.delete(`/blog/admin/${id}`);
  return res.data;
};

export const uploadBlogImage = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post("/blog/admin/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};
