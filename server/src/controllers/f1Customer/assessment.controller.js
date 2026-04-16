import F1Intake from "../../models/F1Intake.js";
import F1Assessment from "../../models/F1Assessment.js";
import { F1Customer, assertCustomerAccess } from "./shared.js";
import { computeOverallPhysicalLevel } from "./assessment.helpers.js";

export const createAssessment = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);

    const intake = await F1Intake.findOne({
      customerId: customer._id,
      isLatest: true,
    });

    if (!intake || intake.isDraft) {
      return res
        .status(400)
        .json({ success: false, message: "Khách hàng chưa hoàn tất intake" });
    }

    if (intake.systemFlags?.testPermission === "hold_test") {
      return res.status(400).json({
        success: false,
        message: "Khách hàng đang bị hold test, cần review trước",
      });
    }

    const restingHeartRate =
      intake?.bodyMetrics?.restingHeartRate !== null &&
      intake?.bodyMetrics?.restingHeartRate !== undefined
        ? Number(intake.bodyMetrics.restingHeartRate)
        : null;

    const draftAssessment = {
      postureAssessment: {
        feetAnkles: req.body?.postureAssessment?.feetAnkles || "",
        knees: req.body?.postureAssessment?.knees || "",
        lphc: req.body?.postureAssessment?.lphc || "",
        shouldersThoracic: req.body?.postureAssessment?.shouldersThoracic || "",
        headNeck: req.body?.postureAssessment?.headNeck || "",
      },
      movementAssessment: {
        overheadSquat: {
          anterior: req.body?.movementAssessment?.overheadSquat?.anterior || [],
          lateral: req.body?.movementAssessment?.overheadSquat?.lateral || [],
          posterior:
            req.body?.movementAssessment?.overheadSquat?.posterior || [],
        },
      },
      strengthAssessment: req.body?.strengthAssessment || {
        upperBodyPush: {},
        upperBodyPull: {},
        lowerBody: {},
        coreStrength: {},
      },
      enduranceAssessment: req.body?.enduranceAssessment || {
        muscularEndurance: {},
        coreEndurance: {},
      },
      cardioAssessment: {
        restingHeartRate,
        cardioCapacity: req.body?.cardioAssessment?.cardioCapacity || {},
        recoveryHeartRate: req.body?.cardioAssessment?.recoveryHeartRate || {},
      },
    };

    const overallLevel = computeOverallPhysicalLevel(draftAssessment);

    const assessment = await F1Assessment.create({
      customerId: customer._id,
      intakeId: intake._id,
      ...draftAssessment,
      overallPhysicalLevel: overallLevel,
      assessorNotes: req.body?.assessorNotes || "",
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    customer.status = "assessment_completed";
    customer.lastAssessmentId = assessment._id;
    await customer.save();

    return res.status(201).json({
      success: true,
      data: assessment,
      message: "Lưu đánh giá thể chất thành công",
    });
  } catch (error) {
    return next(error);
  }
};

export const getLatestAssessment = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);

    const assessment = await F1Assessment.findOne({
      customerId: customer._id,
    }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: assessment || null,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateAssessment = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);

    const assessment = await F1Assessment.findOne({
      _id: req.params.assessmentId,
      customerId: customer._id,
    });

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đánh giá thể chất",
      });
    }

    const intake = await F1Intake.findById(assessment.intakeId);

    const restingHeartRate =
      intake?.bodyMetrics?.restingHeartRate !== null &&
      intake?.bodyMetrics?.restingHeartRate !== undefined
        ? Number(intake.bodyMetrics.restingHeartRate)
        : null;

    assessment.postureAssessment = {
      feetAnkles: req.body?.postureAssessment?.feetAnkles || "",
      knees: req.body?.postureAssessment?.knees || "",
      lphc: req.body?.postureAssessment?.lphc || "",
      shouldersThoracic: req.body?.postureAssessment?.shouldersThoracic || "",
      headNeck: req.body?.postureAssessment?.headNeck || "",
    };

    assessment.movementAssessment = {
      overheadSquat: {
        anterior: req.body?.movementAssessment?.overheadSquat?.anterior || [],
        lateral: req.body?.movementAssessment?.overheadSquat?.lateral || [],
        posterior: req.body?.movementAssessment?.overheadSquat?.posterior || [],
      },
    };

    assessment.strengthAssessment = req.body?.strengthAssessment || {
      upperBodyPush: {},
      upperBodyPull: {},
      lowerBody: {},
      coreStrength: {},
    };

    assessment.enduranceAssessment = req.body?.enduranceAssessment || {
      muscularEndurance: {},
      coreEndurance: {},
    };

    assessment.cardioAssessment = {
      restingHeartRate,
      cardioCapacity: req.body?.cardioAssessment?.cardioCapacity || {},
      recoveryHeartRate: req.body?.cardioAssessment?.recoveryHeartRate || {},
    };

    const overallLevel = computeOverallPhysicalLevel({
      postureAssessment: assessment.postureAssessment,
      movementAssessment: assessment.movementAssessment,
      strengthAssessment: assessment.strengthAssessment,
      enduranceAssessment: assessment.enduranceAssessment,
      cardioAssessment: assessment.cardioAssessment,
    });

    assessment.overallPhysicalLevel = overallLevel;
    assessment.assessorNotes = req.body?.assessorNotes || "";
    assessment.updatedBy = req.user.id;

    await assessment.save();

    return res.json({
      success: true,
      data: assessment,
      message: "Cập nhật đánh giá thể chất thành công",
    });
  } catch (error) {
    return next(error);
  }
};
