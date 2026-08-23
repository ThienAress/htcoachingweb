import Recipe from "../models/Recipe.js";
import RecipeReview from "../models/RecipeReview.js";
import mongoose from "mongoose";
import { moderateGuestContent } from "./ai/contentModeration.js";

const publicName = (name) =>
  String(name || "Thành viên HTCOACHING").trim().slice(0, 80) || "Thành viên HTCOACHING";

const toPublicReview = (review, viewerId) => ({
  id: review._id,
  rating: review.rating,
  comment: review.comment,
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
  displayName: publicName(review.userId?.name),
  isOwner: Boolean(viewerId && String(review.userId?._id || review.userId) === String(viewerId)),
});

export const findPublishedRecipe = (recipeId) =>
  Recipe.findOne({ _id: recipeId, isPublished: true }).select("_id").lean();

export const getRecipeReviews = async (
  recipeId,
  viewerId = null,
  { page = 1, limit = 10 } = {},
) => {
  const skip = (page - 1) * limit;
  const [reviews, summaryRows, myReview] = await Promise.all([
    RecipeReview.find({ recipeId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate({ path: "userId", select: "name" })
    .lean(),
    RecipeReview.aggregate([
      { $match: { recipeId: new mongoose.Types.ObjectId(recipeId) } },
      { $group: { _id: null, total: { $sum: 1 }, averageRating: { $avg: "$rating" } } },
    ]),
    viewerId
      ? RecipeReview.findOne({ recipeId, userId: viewerId })
          .populate({ path: "userId", select: "name" })
          .lean()
      : null,
  ]);
  const total = summaryRows[0]?.total || 0;
  const averageRating = summaryRows[0]?.averageRating
    ? Math.round(summaryRows[0].averageRating * 10) / 10
    : 0;
  return {
    items: reviews.map((review) => toPublicReview(review, viewerId)),
    summary: { total, averageRating },
    myReview: myReview ? toPublicReview(myReview, viewerId) : null,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const upsertRecipeReview = async ({ recipeId, userId, rating, comment = "" }) => {
  const normalizedComment = String(comment || "").trim();
  const moderation = moderateGuestContent(normalizedComment);
  if (!moderation.safe) {
    const error = new Error("Bình luận chứa nội dung không phù hợp.");
    error.statusCode = 400;
    throw error;
  }
  const review = await RecipeReview.findOneAndUpdate(
    { recipeId, userId },
    { $set: { rating, comment: normalizedComment } },
    { returnDocument: "after", upsert: true, runValidators: true, setDefaultsOnInsert: true },
  )
    .populate({ path: "userId", select: "name" })
    .lean();
  return toPublicReview(review, userId);
};

export const deleteRecipeReview = async (recipeId, userId) => {
  const result = await RecipeReview.deleteOne({ recipeId, userId });
  return result.deletedCount > 0;
};
