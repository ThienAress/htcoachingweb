import api from "../utils/api";

// Public
export const getRecipes = (params = {}, signal) =>
  api.get("/recipes", { params, signal }).then((r) => r.data);

export const getRecipeBySlug = (slug, signal) =>
  api.get(`/recipes/detail/${slug}`, { signal }).then((r) => r.data);

export const getRecipeCategories = (signal) =>
  api.get("/recipes/categories", { signal }).then((r) => r.data);

export const getRecipeAreas = (signal) =>
  api.get("/recipes/areas", { signal }).then((r) => r.data);

// User (cần đăng nhập)
export const getBookmarkedRecipes = (signal) =>
  api.get("/recipes/bookmarks", { signal }).then((r) => r.data);

export const toggleBookmark = (recipeId) =>
  api.post(`/recipes/bookmarks/${recipeId}`).then((r) => r.data);

export const addBookmark = (recipeId) =>
  api.put(`/recipes/bookmarks/${recipeId}`).then((r) => r.data);

export const removeBookmark = (recipeId) =>
  api.delete(`/recipes/bookmarks/${recipeId}`).then((r) => r.data);

export const getRecipeReviews = (recipeId, signal) =>
  api.get(`/recipes/${recipeId}/reviews`, { signal }).then((r) => r.data);

export const saveRecipeReview = (recipeId, data) =>
  api.put(`/recipes/${recipeId}/reviews`, data).then((r) => r.data);

export const deleteRecipeReview = (recipeId) =>
  api.delete(`/recipes/${recipeId}/reviews`).then((r) => r.data);

// Admin
export const getAdminRecipes = (params = {}, signal) =>
  api.get("/recipes/admin/list", { params, signal }).then((r) => r.data);

export const createRecipe = (data) =>
  api.post("/recipes", data).then((r) => r.data);

export const updateRecipe = (id, data) =>
  api.put(`/recipes/${id}`, data).then((r) => r.data);

const importRecipeNutrition = (file, dryRun, previewToken) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("dryRun", String(dryRun));
  if (previewToken) formData.append("previewToken", previewToken);
  return api.post("/recipes/nutrition/import", formData).then((r) => r.data);
};

export const previewRecipeNutritionImport = (file) =>
  importRecipeNutrition(file, true);

export const commitRecipeNutritionImport = (file, previewToken) =>
  importRecipeNutrition(file, false, previewToken);

export const uploadRecipeThumbnail = (id, formData) =>
  api
    .post(`/recipes/${id}/thumbnail`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);

export const deleteRecipe = (id) =>
  api.delete(`/recipes/${id}`).then((r) => r.data);
