import {
  mongoose,
  F1Customer,
  F1_STATUSES,
  safeRegex,
  assertCustomerAccess,
  generateF1Code,
  buildLifecycleSummary,
} from "./shared.js";
import { requestF1CustomerDeletion } from "../../services/f1PrivacyLifecycle.service.js";

export const createF1Customer = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    let customer;
    await session.withTransaction(async () => {
      const code = await generateF1Code(session);
      const created = await F1Customer.create([{
        code,
        fullName: req.body.fullName,
        age: req.body.age,
        gender: req.body.gender,
        occupation: req.body.occupation || "",
        phone: req.body.phone || "",
        email: (req.body.email || "").toLowerCase().trim(),
        assignedTrainerId:
          req.body.assignedTrainerId ||
          (!req.isAdmin ? req.user.id : null),
        source: req.body.source || "manual",
        createdBy: req.user.id,
        notesInternal: req.body.notesInternal || "",
      }], { session });
      customer = created[0];
    });

    return res.status(201).json({
      success: true,
      data: customer,
      message: "Tạo khách hàng F1 thành công",
    });
  } catch (error) {
    return next(error);
  } finally {
    await session.endSession();
  }
};

export const getF1Customers = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const skip = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const status = (req.query.status || "").trim();
    const trainerId = (req.query.trainerId || "").trim();

    const filter = {};

    if (!req.isAdmin) {
      filter.assignedTrainerId = req.user.id;
    } else if (trainerId && mongoose.Types.ObjectId.isValid(trainerId)) {
      filter.assignedTrainerId = trainerId;
    }

    if (status && F1_STATUSES.has(status)) {
      filter.status = status;
    }

    if (search) {
      const regex = new RegExp(safeRegex(search), "i");
      filter.$or = [
        { fullName: regex },
        { phone: regex },
        { email: regex },
        { code: regex },
      ];
    }

    const [total, customers] = await Promise.all([
      F1Customer.countDocuments(filter),
      F1Customer.find(filter)
        .populate("assignedTrainerId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    return res.json({
      success: true,
      data: customers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getF1CustomerById = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id)
      .populate("assignedTrainerId", "name email")
      .populate("lastIntakeId")
      .populate("lastAssessmentId")
      .populate("lastAiReportId");

    assertCustomerAccess(customer, req);

    const lifecycle = await buildLifecycleSummary(customer._id);

    return res.json({
      success: true,
      data: {
        customer,
        lifecycle,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const updateF1Customer = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);

    const updates = {
      ...(req.body.fullName !== undefined && { fullName: req.body.fullName }),
      ...(req.body.age !== undefined && { age: req.body.age }),
      ...(req.body.gender !== undefined && { gender: req.body.gender }),
      ...(req.body.occupation !== undefined && {
        occupation: req.body.occupation,
      }),
      ...(req.body.phone !== undefined && { phone: req.body.phone }),
      ...(req.body.email !== undefined && {
        email: req.body.email.toLowerCase().trim(),
      }),
      ...(req.body.notesInternal !== undefined && {
        notesInternal: req.body.notesInternal,
      }),
    };

    if (req.body.assignedTrainerId !== undefined) {
      updates.assignedTrainerId = req.body.assignedTrainerId || null;
    }

    Object.assign(customer, updates);
    await customer.save();

    return res.json({
      success: true,
      data: customer,
      message: "Cập nhật khách hàng F1 thành công",
    });
  } catch (error) {
    return next(error);
  }
};

export const updateF1CustomerStatus = async (req, res, next) => {
  try {
    const status = req.body.status;

    if (!F1_STATUSES.has(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Trạng thái không hợp lệ" });
    }

    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);

    customer.status = status;
    await customer.save();

    return res.json({
      success: true,
      data: customer,
      message: "Cập nhật trạng thái thành công",
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteF1Customer = async (req, res, next) => {
  try {
    const customer = await F1Customer.findById(req.params.id);
    assertCustomerAccess(customer, req);
    const job = await requestF1CustomerDeletion({
      customer,
      actorId: req.user.id,
      actorRole: req.user.role,
      reason: req.body?.reason || "admin_request",
      requestContext: {
        requestId: req.id || "",
        ipAddress: req.ip || "",
        userAgent: req.get("user-agent") || "",
      },
    });
    return res.status(202).json({
      success: true,
      data: { deletionJobId: job._id, status: job.status },
      message: "Yêu cầu xóa dữ liệu F1 đã được đưa vào hàng đợi an toàn",
    });
  } catch (error) {
    return next(error);
  }
};
