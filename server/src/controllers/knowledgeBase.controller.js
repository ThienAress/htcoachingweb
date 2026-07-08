// Knowledge Base Controller — CRUD + Search + Stats
import KnowledgeEntry from "../models/KnowledgeEntry.js";
import ChatConversation from "../models/ChatConversation.js";
import { generateEmbedding, searchKnowledgeBase } from "../services/ai/embedding.service.js";

const CATEGORY_LABELS = {
  service: "Dịch vụ",
  nutrition: "Dinh dưỡng",
  training: "Tập luyện",
  athlete: "VĐV / Influencer",
  equipment: "Dụng cụ",
  supplement: "Thực phẩm bổ sung",
  health: "Sức khỏe",
  hlv: "Huấn luyện viên",
  platform: "Nền tảng",
  general: "Chung",
};

// GET /api/knowledge-base — Danh sách entries (paginated)
export const getEntries = async (req, res) => {
  try {
    const { page = 1, limit = 20, category, status, search } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { question: { $regex: search, $options: "i" } },
        { answer: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [entries, total] = await Promise.all([
      KnowledgeEntry.find(filter)
        .select("+variants")
        .sort({ usageCount: -1, updatedAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("createdBy", "name")
        .lean(),
      KnowledgeEntry.countDocuments(filter),
    ]);

    const enrichedEntries = entries.map((e) => {
      const variantCount = e.variants?.length || 0;
      delete e.variants; // Tránh gửi vector embedding nặng về client
      return {
        ...e,
        variantCount,
      };
    });

    res.json({
      success: true,
      data: enrichedEntries,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/knowledge-base — Tạo entry mới (có detect duplicate)
export const createEntry = async (req, res) => {
  try {
    const { question, answer, category, tags, status, skipDuplicateCheck, variants } = req.body;

    if (!question?.trim() || !answer?.trim()) {
      return res.status(400).json({ success: false, message: "Câu hỏi và câu trả lời không được để trống" });
    }

    // Tạo embedding từ câu hỏi
    let embedding = [];
    try {
      embedding = await generateEmbedding(question);
    } catch (err) {
      console.error("Embedding generation failed:", err.message);
    }

    // Tạo variants với embedding
    let parsedVariants = [];
    if (variants && Array.isArray(variants)) {
      for (const vText of variants) {
        if (vText && vText.trim()) {
          let vEmbedding = [];
          try {
            vEmbedding = await generateEmbedding(vText.trim());
          } catch (err) {
            console.error(`Embedding variant failed: ${vText}`, err.message);
          }
          parsedVariants.push({ text: vText.trim(), embedding: vEmbedding });
        }
      }
    }

    // Detect duplicate — check similarity với entries hiện có (threshold 0.80)
    if (!skipDuplicateCheck && embedding.length > 0) {
      const similar = await searchKnowledgeBase(question, { limit: 3, threshold: 0.80 });
      if (similar.length > 0) {
        return res.status(200).json({
          success: true,
          duplicate: true,
          message: `Tìm thấy ${similar.length} entry tương tự`,
          similar: similar.map((s) => ({
            _id: s._id,
            question: s.question,
            answer: s.answer?.slice(0, 200) + (s.answer?.length > 200 ? "..." : ""),
            category: s.category,
            similarity: Math.round(s.similarity * 100),
            variantCount: s.variantCount || 0,
          })),
          pendingData: { question: question.trim(), answer: answer.trim(), category, tags, embedding, variants },
        });
      }
    }

    const entry = await KnowledgeEntry.create({
      question: question.trim(),
      answer: answer.trim(),
      category: category || "general",
      tags: tags || [],
      embedding,
      variants: parsedVariants,
      status: status || "published",
      createdBy: req.user.id,
    });

    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/knowledge-base/:id — Sửa entry
export const updateEntry = async (req, res) => {
  try {
    const { question, answer, category, tags, status, variants } = req.body;
    const entry = await KnowledgeEntry.findById(req.params.id).select("+variants");

    if (!entry) {
      return res.status(404).json({ success: false, message: "Không tìm thấy knowledge entry" });
    }

    // Nếu question thay đổi → regenerate embedding
    const questionChanged = question && question.trim() !== entry.question;

    if (question) entry.question = question.trim();
    if (answer) entry.answer = answer.trim();
    if (category) entry.category = category;
    if (tags !== undefined) entry.tags = tags;
    if (status) entry.status = status;

    if (questionChanged) {
      try {
        entry.embedding = await generateEmbedding(entry.question);
      } catch (err) {
        console.error("Re-embedding failed:", err.message);
      }
    }

    // Cập nhật variants
    if (variants !== undefined && Array.isArray(variants)) {
      const existingVariants = entry.variants || [];
      let newVariants = [];
      for (const vText of variants) {
        const trimmedText = vText?.trim();
        if (!trimmedText) continue;

        const matched = existingVariants.find((ev) => ev.text === trimmedText);
        if (matched) {
          newVariants.push({ text: trimmedText, embedding: matched.embedding });
        } else {
          let vEmbedding = [];
          try {
            vEmbedding = await generateEmbedding(trimmedText);
          } catch (err) {
            console.error(`Re-embedding variant failed: ${trimmedText}`, err.message);
          }
          newVariants.push({ text: trimmedText, embedding: vEmbedding });
        }
      }
      entry.variants = newVariants;
    }

    await entry.save();
    res.json({ success: true, data: entry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/knowledge-base/:id — Xóa entry
export const deleteEntry = async (req, res) => {
  try {
    const result = await KnowledgeEntry.deleteOne({ _id: req.params.id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy knowledge entry" });
    }
    res.json({ success: true, message: "Đã xóa knowledge entry" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/knowledge-base/from-conversation — Tạo entry từ conversation Q&A
export const createFromConversation = async (req, res) => {
  try {
    const { conversationId, questionIndex, answerIndex, question, answer, category, tags } = req.body;

    if (!question?.trim() || !answer?.trim()) {
      return res.status(400).json({ success: false, message: "Câu hỏi và câu trả lời không được để trống" });
    }

    let embedding = [];
    try {
      embedding = await generateEmbedding(question);
    } catch (err) {
      console.error("Embedding generation failed:", err.message);
    }

    const entry = await KnowledgeEntry.create({
      question: question.trim(),
      answer: answer.trim(),
      category: category || "general",
      tags: tags || [],
      embedding,
      source: {
        conversationId: conversationId || null,
        messageIndex: questionIndex ?? null,
      },
      status: "published",
      createdBy: req.user.id,
    });

    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/knowledge-base/search — Test search (admin debug)
export const searchEntries = async (req, res) => {
  try {
    const { q, limit = 5, threshold = 0.7 } = req.query;

    if (!q?.trim()) {
      return res.status(400).json({ success: false, message: "Query không được để trống" });
    }

    const results = await searchKnowledgeBase(q, {
      limit: Number(limit),
      threshold: Number(threshold),
    });

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/knowledge-base/stats — Thống kê
export const getStats = async (req, res) => {
  try {
    const [total, byCategory, byStatus, topUsed] = await Promise.all([
      KnowledgeEntry.countDocuments(),
      KnowledgeEntry.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      KnowledgeEntry.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      KnowledgeEntry.find({ usageCount: { $gt: 0 } })
        .sort({ usageCount: -1 })
        .limit(10)
        .select("question category usageCount lastUsedAt")
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        total,
        byCategory: byCategory.map((c) => ({
          category: c._id,
          label: CATEGORY_LABELS[c._id] || c._id,
          count: c.count,
        })),
        byStatus,
        topUsed,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/knowledge-base/:id/regenerate-embedding — Regenerate embedding
export const regenerateEmbedding = async (req, res) => {
  try {
    const entry = await KnowledgeEntry.findById(req.params.id).select("+embedding");
    if (!entry) {
      return res.status(404).json({ success: false, message: "Không tìm thấy knowledge entry" });
    }

    entry.embedding = await generateEmbedding(entry.question);
    await entry.save();

    res.json({ success: true, message: "Đã tạo lại embedding" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/knowledge-base/:id/merge — Merge câu hỏi mới làm variant của entry gốc
export const mergeVariant = async (req, res) => {
  try {
    const { question, embedding } = req.body;
    if (!question?.trim()) {
      return res.status(400).json({ success: false, message: "Câu hỏi variant không được để trống" });
    }

    const entry = await KnowledgeEntry.findById(req.params.id).select("+variants");
    if (!entry) {
      return res.status(404).json({ success: false, message: "Không tìm thấy entry gốc" });
    }

    // Tạo embedding cho variant nếu chưa có
    let variantEmbedding = embedding || [];
    if (variantEmbedding.length === 0) {
      try {
        variantEmbedding = await generateEmbedding(question);
      } catch (err) {
        console.error("Variant embedding failed:", err.message);
      }
    }

    entry.variants.push({ text: question.trim(), embedding: variantEmbedding });
    await entry.save();

    res.json({
      success: true,
      message: `Đã merge "${question.trim().slice(0, 50)}..." vào entry gốc`,
      variantCount: entry.variants.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/knowledge-base/:id/variants — Xem variants của 1 entry
export const getVariants = async (req, res) => {
  try {
    const entry = await KnowledgeEntry.findById(req.params.id)
      .select("+variants question category")
      .lean();

    if (!entry) {
      return res.status(404).json({ success: false, message: "Không tìm thấy entry" });
    }

    res.json({
      success: true,
      data: {
        _id: entry._id,
        question: entry.question,
        category: entry.category,
        variants: (entry.variants || []).map((v) => ({
          _id: v._id,
          text: v.text,
          hasEmbedding: v.embedding?.length > 0,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/knowledge-base/:id/variants/:variantId — Xóa 1 variant
export const deleteVariant = async (req, res) => {
  try {
    const entry = await KnowledgeEntry.findById(req.params.id).select("+variants");
    if (!entry) {
      return res.status(404).json({ success: false, message: "Không tìm thấy entry" });
    }

    entry.variants = entry.variants.filter((v) => v._id.toString() !== req.params.variantId);
    await entry.save();

    res.json({ success: true, message: "Đã xóa variant" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/ai/conversations/all — Admin xem TẤT CẢ conversations
export const getAllConversations = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { "messages.content": { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [conversations, total] = await Promise.all([
      ChatConversation.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("userId", "name email")
        .select("_id title userId updatedAt messages tokenUsage")
        .lean(),
      ChatConversation.countDocuments(filter),
    ]);

    // Trả summary thay vì full messages
    const list = conversations.map((c) => {
      const userMessages = c.messages.filter((m) => m.role === "user");
      const assistantMessages = c.messages.filter((m) => m.role === "assistant");
      return {
        _id: c._id,
        title: c.title || "Cuộc trò chuyện",
        user: c.userId,
        updatedAt: c.updatedAt,
        messageCount: userMessages.length + assistantMessages.length,
        preview: userMessages[0]?.content?.slice(0, 100) || "",
        tokenUsage: c.tokenUsage,
      };
    });

    res.json({
      success: true,
      data: list,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/ai/conversations/:id/full — Admin xem full conversation
export const getFullConversation = async (req, res) => {
  try {
    const conversation = await ChatConversation.findById(req.params.id)
      .populate("userId", "name email")
      .lean();

    if (!conversation) {
      return res.status(404).json({ success: false, message: "Không tìm thấy cuộc trò chuyện" });
    }

    // Nhóm messages thành Q&A pairs
    const qaPairs = [];
    const msgs = conversation.messages;
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i].role === "user") {
        // Tìm assistant response kế tiếp (bỏ qua tool messages)
        let answerMsg = null;
        for (let j = i + 1; j < msgs.length; j++) {
          if (msgs[j].role === "assistant" && msgs[j].content) {
            answerMsg = msgs[j];
            break;
          }
          if (msgs[j].role === "user") break; // User mới hỏi tiếp
        }

        qaPairs.push({
          questionIndex: i,
          question: msgs[i].content,
          answerIndex: answerMsg ? msgs.indexOf(answerMsg) : null,
          answer: answerMsg?.content || null,
          timestamp: msgs[i].timestamp,
        });
      }
    }

    res.json({
      success: true,
      data: {
        ...conversation,
        qaPairs,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/knowledge-base/categories — Danh sách categories
export const getCategories = async (req, res) => {
  res.json({
    success: true,
    data: Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
  });
};

// POST /api/knowledge-base/ai-suggest — AI tự lọc Q&A hay từ conversations
export const suggestFromConversations = async (req, res) => {
  try {
    const { days = 7 } = req.body;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Lấy conversations gần đây
    const conversations = await ChatConversation.find({ updatedAt: { $gte: since } })
      .select("messages title")
      .lean();

    if (conversations.length === 0) {
      return res.json({ success: true, data: [], message: `Không có cuộc trò chuyện nào trong ${days} ngày qua` });
    }

    // Trích xuất tất cả Q&A pairs
    const allPairs = [];
    for (const conv of conversations) {
      const msgs = conv.messages;
      for (let i = 0; i < msgs.length; i++) {
        if (msgs[i].role !== "user" || !msgs[i].content?.trim()) continue;
        // Tìm answer
        let answer = null;
        for (let j = i + 1; j < msgs.length; j++) {
          if (msgs[j].role === "assistant" && msgs[j].content?.trim()) {
            answer = msgs[j].content;
            break;
          }
          if (msgs[j].role === "user") break;
        }
        if (answer && msgs[i].content.length > 10 && answer.length > 30) {
          allPairs.push({ question: msgs[i].content, answer, convTitle: conv.title });
        }
      }
    }

    if (allPairs.length === 0) {
      return res.json({ success: true, data: [], message: "Không tìm thấy Q&A phù hợp" });
    }

    // Lọc bỏ những câu đã có trong KB (duplicate check bằng text)
    const existingQuestions = await KnowledgeEntry.find({}).select("question").lean();
    const existingSet = new Set(existingQuestions.map((e) => e.question.toLowerCase().trim()));
    const newPairs = allPairs.filter((p) => !existingSet.has(p.question.toLowerCase().trim()));

    if (newPairs.length === 0) {
      return res.json({ success: true, data: [], message: "Tất cả Q&A đã có trong KB" });
    }

    // Gọi LLM chấm điểm (lấy tối đa 30 pairs để tránh prompt quá dài)
    const sample = newPairs.slice(0, 30);
    const prompt = `Bạn là chuyên gia đánh giá chất lượng Q&A cho hệ thống Knowledge Base của HTCOACHING (nền tảng huấn luyện thể hình).

Dưới đây là ${sample.length} cặp Q&A từ các cuộc trò chuyện gần đây. Hãy chọn ra TỐI ĐA 10 cặp Q&A CHẤT LƯỢNG NHẤT — là những câu hỏi mà khách hàng khác cũng sẽ hỏi lại, và câu trả lời chính xác, hữu ích.

TIÊU CHÍ CHỌN:
- Câu hỏi phổ biến, nhiều người quan tâm
- Câu trả lời chính xác, đầy đủ, hữu ích
- Liên quan đến: dịch vụ, dinh dưỡng, tập luyện, sức khỏe, HLV
- KHÔNG chọn: câu chào hỏi, câu quá cá nhân, câu test hệ thống

DANH SÁCH Q&A:
${sample.map((p, i) => `[${i}] Q: ${p.question.slice(0, 200)}\nA: ${p.answer.slice(0, 300)}`).join("\n\n")}

TRẢ LỜI BẰNG JSON ARRAY, mỗi item gồm:
- index: số thứ tự [0-${sample.length - 1}]
- score: điểm 1-10
- category: một trong [service, nutrition, training, athlete, equipment, supplement, health, hlv, platform, general]
- reason: lý do ngắn gọn (tiếng Việt)

CHỈ TRẢ JSON, KHÔNG giải thích thêm. VD: [{"index":0,"score":9,"category":"nutrition","reason":"Câu hỏi phổ biến về protein"}]`;

    const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const llmRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
      }),
    });

    if (!llmRes.ok) {
      return res.status(500).json({ success: false, message: "Lỗi gọi AI để đánh giá" });
    }

    const llmData = await llmRes.json();
    const rawText = llmData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON từ response (LLM có thể wrap trong markdown code block)
    let suggestions = [];
    try {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) suggestions = JSON.parse(jsonMatch[0]);
    } catch {
      return res.status(500).json({ success: false, message: "AI trả kết quả không hợp lệ" });
    }

    // Map lại với Q&A gốc, sắp xếp theo score
    const results = suggestions
      .filter((s) => s.index >= 0 && s.index < sample.length && s.score >= 6)
      .sort((a, b) => b.score - a.score)
      .map((s) => ({
        question: sample[s.index].question,
        answer: sample[s.index].answer,
        category: s.category || "general",
        score: s.score,
        reason: s.reason,
        convTitle: sample[s.index].convTitle,
      }));

    res.json({ success: true, data: results, totalScanned: allPairs.length });
  } catch (err) {
    console.error("AI suggest error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
