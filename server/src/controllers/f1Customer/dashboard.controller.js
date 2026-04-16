import mongoose from "mongoose";
import F1Customer from "../../models/F1Customer.js";

export const getF1DashboardSummary = async (req, res, next) => {
  try {
    const baseMatch =
      req.user.role === "trainer"
        ? { assignedTrainerId: new mongoose.Types.ObjectId(req.user.id) }
        : {};

    const [summary] = await F1Customer.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          new: { $sum: { $cond: [{ $eq: ["$status", "new"] }, 1, 0] } },
          intakeInProgress: {
            $sum: { $cond: [{ $eq: ["$status", "intake_in_progress"] }, 1, 0] },
          },
          intakeCompleted: {
            $sum: { $cond: [{ $eq: ["$status", "intake_completed"] }, 1, 0] },
          },
          assessmentCompleted: {
            $sum: {
              $cond: [{ $eq: ["$status", "assessment_completed"] }, 1, 0],
            },
          },
          aiReportGenerated: {
            $sum: {
              $cond: [{ $eq: ["$status", "ai_report_generated"] }, 1, 0],
            },
          },
          programStarted: {
            $sum: { $cond: [{ $eq: ["$status", "program_started"] }, 1, 0] },
          },
          archived: {
            $sum: { $cond: [{ $eq: ["$status", "archived"] }, 1, 0] },
          },
        },
      },
    ]);

    return res.json({
      success: true,
      data: summary || {
        total: 0,
        new: 0,
        intakeInProgress: 0,
        intakeCompleted: 0,
        assessmentCompleted: 0,
        aiReportGenerated: 0,
        programStarted: 0,
        archived: 0,
      },
    });
  } catch (error) {
    return next(error);
  }
};
