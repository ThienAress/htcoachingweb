import {
  archiveSavedMealPlan,
  createSavedMealPlan,
  getOwnedSavedMealPlan,
  listOwnedSavedMealPlans,
  renameSavedMealPlan,
  reviseSavedMealPlan,
} from "../services/savedMealPlan.service.js";
import {
  deleteSavedMealPlanData,
  exportSavedMealPlanData,
} from "../services/savedMealPlanPrivacy.service.js";
import { safeLog } from "../utils/safeLogger.js";

const actor = (req) => ({ id: req.user.id, role: req.user.role });
const privateResponse = (res) =>
  res.setHeader("Cache-Control", "private, no-store");
const pagination = (req, fallback = 20) => ({
  page: Number(req.query.page || 1),
  limit: Number(req.query.limit || fallback),
});

const sendError = (res, error, event) => {
  const status = error.statusCode || 500;
  if (status >= 500) safeLog.error(event, error);
  return res.status(status).json({
    success: false,
    code:
      error.codeName || error.code || "SAVED_MEAL_PLAN_FAILED",
    message:
      status >= 500
        ? "Không thể xử lý meal plan lúc này"
        : error.message,
  });
};

export const createMySavedMealPlan = async (req, res) => {
  privateResponse(res);
  try {
    const result = await createSavedMealPlan({
      actor: actor(req),
      input: req.body,
    });
    return res
      .status(result.idempotentReplay ? 200 : 201)
      .json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "saved_meal_plan.create_failed");
  }
};

export const reviseMySavedMealPlan = async (req, res) => {
  privateResponse(res);
  try {
    const result = await reviseSavedMealPlan({
      actor: actor(req),
      planId: req.params.id,
      input: req.body,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "saved_meal_plan.revise_failed");
  }
};

export const renameMySavedMealPlan = async (req, res) => {
  privateResponse(res);
  try {
    const result = await renameSavedMealPlan({
      actor: actor(req),
      planId: req.params.id,
      input: req.body,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "saved_meal_plan.rename_failed");
  }
};

export const archiveMySavedMealPlan = async (req, res) => {
  privateResponse(res);
  try {
    const result = await archiveSavedMealPlan({
      actor: actor(req),
      planId: req.params.id,
      input: req.body,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, "saved_meal_plan.archive_failed");
  }
};

export const getMySavedMealPlan = async (req, res) => {
  privateResponse(res);
  try {
    const data = await getOwnedSavedMealPlan({
      ownerId: req.user.id,
      planId: req.params.id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "saved_meal_plan.read_failed");
  }
};

export const listMySavedMealPlans = async (req, res) => {
  privateResponse(res);
  try {
    const data = await listOwnedSavedMealPlans({
      ownerId: req.user.id,
      status: req.query.status || "active",
      ...pagination(req),
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "saved_meal_plan.list_failed");
  }
};

export const exportMySavedMealPlans = async (req, res) => {
  privateResponse(res);
  try {
    const data = await exportSavedMealPlanData({
      ownerId: req.user.id,
      ...pagination(req, 50),
    });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "saved_meal_plan.export_failed");
  }
};

export const deleteMySavedMealPlans = async (req, res) => {
  privateResponse(res);
  try {
    const data = await deleteSavedMealPlanData({ actor: actor(req) });
    return res.json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "saved_meal_plan.delete_failed");
  }
};
