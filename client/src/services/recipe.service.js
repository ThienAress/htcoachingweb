import api from "../utils/api";

// Public
export const getRecipes = (params = {}) =>
  api.get("/recipes", { params }).then((r) => r.data);

export const getRecipeBySlug = (slug) =>
  api.get(`/recipes/detail/${slug}`).then((r) => r.data);

export const getRecipeCategories = () =>
  api.get("/recipes/categories").then((r) => r.data);

export const getRecipeAreas = () =>
  api.get("/recipes/areas").then((r) => r.data);

// User (cần đăng nhập)
export const getBookmarkedRecipes = () =>
  api.get("/recipes/bookmarks").then((r) => r.data);

export const toggleBookmark = (recipeId) =>
  api.post(`/recipes/bookmarks/${recipeId}`).then((r) => r.data);

// Admin
export const getAdminRecipes = (params = {}) =>
  api.get("/recipes/admin/list", { params }).then((r) => r.data);

export const updateRecipe = (id, data) =>
  api.put(`/recipes/${id}`, data).then((r) => r.data);

export const uploadRecipeThumbnail = (id, formData) =>
  api
    .post(`/recipes/${id}/thumbnail`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);

export const deleteRecipe = (id) =>
  api.delete(`/recipes/${id}`).then((r) => r.data);
