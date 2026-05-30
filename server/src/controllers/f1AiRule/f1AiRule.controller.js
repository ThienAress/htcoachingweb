import F1AiRule from "../../models/F1AiRule.js";

// @desc    Get all AI rules
// @route   GET /api/f1-ai-rules
// @access  Private/Admin
export const getAiRules = async (req, res) => {
  try {
    const rules = await F1AiRule.find().sort({ category: 1, priority: -1, createdAt: -1 });
    res.json({ success: true, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách rule", error: error.message });
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
    res.status(500).json({ success: false, message: "Lỗi khi lấy rule", error: error.message });
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
      ...req.body,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    
    const createdRule = await rule.save();
    res.status(201).json({ success: true, data: createdRule });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi tạo rule", error: error.message });
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

    // Merge updates
    Object.assign(rule, req.body);
    rule.updatedBy = req.user._id;

    const updatedRule = await rule.save();
    res.json({ success: true, data: updatedRule });
  } catch (error) {
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật rule", error: error.message });
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
    res.status(500).json({ success: false, message: "Lỗi khi xoá rule", error: error.message });
  }
};
