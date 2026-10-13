import F1AiRule from "../../models/F1AiRule.js";
import { errorHandler } from "../../middlewares/errorHandler.js";

// Chỉ nhận field nghiệp vụ; createdBy/updatedBy/_id/timestamps do server quản lý.
const RULE_WRITABLE_FIELDS = [
  "code",
  "name",
  "category",
  "description",
  "priority",
  "isActive",
  "conditions",
  "recommendation",
];

const pickRuleFields = (body = {}) =>
  Object.fromEntries(
    RULE_WRITABLE_FIELDS.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]),
  );

// @desc    Get all AI rules
// @route   GET /api/f1-ai-rules
// @access  Private/Admin
export const getAiRules = async (req, res) => {
  try {
    const rules = await F1AiRule.find().sort({ category: 1, priority: -1, createdAt: -1 });
    res.json({ success: true, data: rules });
  } catch (error) {
    return errorHandler(error, req, res);
  }
};

// @desc    Get rule by ID
// @route   GET /api/f1-ai-rules/:id
// @access  Private/Admin
export const getAiRuleById = async (req, res) => {
  try {
    const rule = await F1AiRule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, message: "Không tìm thấy rule" });
    }
    res.json({ success: true, data: rule });
  } catch (error) {
    return errorHandler(error, req, res);
  }
};

// @desc    Create new AI rule
// @route   POST /api/f1-ai-rules
// @access  Private/Admin
export const createAiRule = async (req, res) => {
  try {
    const existingRule = await F1AiRule.findOne({ code: req.body.code });
    if (existingRule) {
      return res.status(400).json({ success: false, message: "Mã rule (code) đã tồn tại" });
    }

    const rule = new F1AiRule({
      ...pickRuleFields(req.body),
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });
    
    const createdRule = await rule.save();
    res.status(201).json({ success: true, data: createdRule });
  } catch (error) {
    return errorHandler(error, req, res);
  }
};

// @desc    Update AI rule
// @route   PUT /api/f1-ai-rules/:id
// @access  Private/Admin
export const updateAiRule = async (req, res) => {
  try {
    const rule = await F1AiRule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, message: "Không tìm thấy rule" });
    }

    if (req.body.code && req.body.code !== rule.code) {
      const existingRule = await F1AiRule.findOne({ code: req.body.code });
      if (existingRule) {
        return res.status(400).json({ success: false, message: "Mã rule (code) đã tồn tại" });
      }
    }

    Object.assign(rule, pickRuleFields(req.body));
    rule.updatedBy = req.user.id;

    const updatedRule = await rule.save();
    res.json({ success: true, data: updatedRule });
  } catch (error) {
    return errorHandler(error, req, res);
  }
};

// @desc    Delete AI rule
// @route   DELETE /api/f1-ai-rules/:id
// @access  Private/Admin
export const deleteAiRule = async (req, res) => {
  try {
    const rule = await F1AiRule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, message: "Không tìm thấy rule" });
    }

    await F1AiRule.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: "Đã xoá rule" });
  } catch (error) {
    return errorHandler(error, req, res);
  }
};
