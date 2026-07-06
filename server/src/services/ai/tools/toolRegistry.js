// Tool Registry — Định nghĩa tất cả tools cho AI Agent
// Mỗi tool có: name, description (cho LLM), parameters (JSON Schema), execute fn

import { calculateTdee } from "./calculateTdee.tool.js";
import { searchExercises } from "./searchExercises.tool.js";
import { suggestMeal } from "./suggestMeal.tool.js";
import { getTrainerInfo } from "./getTrainerInfo.tool.js";
import { searchKnowledge } from "./searchKnowledge.tool.js";

export const toolRegistry = {
  calculate_tdee: {
    name: "calculate_tdee",
    description:
      "Tính TDEE (Total Daily Energy Expenditure) và phân bổ macro dinh dưỡng (protein, carb, fat). " +
      "GỌI KHI: user muốn biết lượng calo, muốn lên thực đơn, hỏi ăn bao nhiêu, hoặc nói về giảm mỡ/tăng cơ VÀ đã cung cấp đủ thông tin. " +
      "CŨNG GỌI KHI: user muốn thay đổi mức thâm hụt/thặng dư calo (VD: 'giảm 500 calo' thay vì mặc định) — dùng calorieAdjustment. " +
      "KHÔNG GỌI KHI: chưa có đủ thông tin cơ bản — hỏi tất cả trong 1 lần.",
    parameters: {
      type: "object",
      properties: {
        gender: { type: "string", enum: ["male", "female"], description: "Giới tính" },
        age: { type: "number", description: "Tuổi" },
        heightCm: { type: "number", description: "Chiều cao tính bằng cm" },
        weightKg: { type: "number", description: "Cân nặng tính bằng kg" },
        activityLevel: {
          type: "string",
          enum: ["sedentary", "light", "moderate", "active", "very_active"],
          description:
            "Mức vận động: sedentary=ít vận động/ngồi văn phòng, light=tập nhẹ 1-3 ngày/tuần, moderate=tập 3-5 ngày/tuần, active=tập 6-7 ngày/tuần, very_active=tập rất nặng hoặc lao động chân tay",
        },
        goal: {
          type: "string",
          enum: ["fat_loss", "maintenance", "muscle_gain"],
          description: "Mục tiêu: fat_loss=giảm mỡ, maintenance=duy trì cân nặng, muscle_gain=tăng cơ",
        },
        calorieAdjustment: {
          type: "number",
          description: "Mức điều chỉnh calo tùy chỉnh (VD: -500 để giảm 500 calo, +300 để tăng 300 calo). Nếu không có, dùng mặc định theo goal.",
        },
      },
      required: ["gender", "age", "heightCm", "weightKg", "activityLevel", "goal"],
    },
    execute: calculateTdee,
    requiresAuth: false,
    requiresConfirmation: false,
  },

  search_exercises: {
    name: "search_exercises",
    description:
      "Tìm bài tập trong thư viện theo nhóm cơ hoặc tên bài tập. " +
      "GỌI KHI: user hỏi về bài tập, muốn tìm bài tập cho nhóm cơ cụ thể, hoặc hỏi cách tập. " +
      "Các nhóm cơ có: Ngực, Lưng, Chân, Vai, Tay, Bụng.",
    parameters: {
      type: "object",
      properties: {
        muscleGroup: { type: "string", description: "Nhóm cơ muốn tìm. VD: Ngực, Lưng, Chân, Vai, Tay, Bụng" },
        searchQuery: { type: "string", description: "Tên bài tập muốn tìm. VD: plank, squat, bench press" },
        limit: { type: "number", description: "Số lượng kết quả tối đa (mặc định 5)" },
      },
    },
    execute: searchExercises,
    requiresAuth: false,
    requiresConfirmation: false,
  },

  suggest_meal: {
    name: "suggest_meal",
    description:
      "Gợi ý thực đơn từ database thực phẩm dựa trên lượng calo và macro mục tiêu. " +
      "GỌI KHI: user muốn gợi ý thực đơn/lịch ăn VÀ đã biết lượng calo mục tiêu (thường sau khi đã tính TDEE). " +
      "KHÔNG GỌI KHI: chưa tính TDEE — hãy tính TDEE trước bằng tool calculate_tdee.",
    parameters: {
      type: "object",
      properties: {
        targetCalories: { type: "number", description: "Tổng calo mục tiêu mỗi ngày" },
        proteinGrams: { type: "number", description: "Gram protein mục tiêu" },
        carbGrams: { type: "number", description: "Gram carb mục tiêu" },
        fatGrams: { type: "number", description: "Gram fat mục tiêu" },
        mealsPerDay: { type: "number", description: "Số bữa ăn mỗi ngày (3-6, mặc định 3)" },
      },
      required: ["targetCalories", "proteinGrams", "carbGrams", "fatGrams"],
    },
    execute: suggestMeal,
    requiresAuth: false,
    requiresConfirmation: false,
  },

  get_trainer_info: {
    name: "get_trainer_info",
    description:
      "Lấy thông tin huấn luyện viên (HLV) tại HTCOACHING. " +
      "GỌI KHI: user hỏi về HLV, muốn tìm PT, hỏi ai kèm tập, hoặc muốn biết đội ngũ HTCOACHING.",
    parameters: {
      type: "object",
      properties: {
        specialty: { type: "string", description: "Chuyên môn tìm kiếm. VD: giảm mỡ, tăng cơ" },
      },
    },
    execute: getTrainerInfo,
    requiresAuth: false,
    requiresConfirmation: false,
  },

  search_knowledge: {
    name: "search_knowledge",
    description:
      "Tra cứu thông tin thực tế từ internet bằng Google Search. " +
      "GỌI KHI: user hỏi về VĐV, influencer fitness (Việt Nam hoặc quốc tế), kết quả thi đấu, " +
      "thành tích cụ thể, tin tức mới nhất trong ngành gym/thể hình, " +
      "hoặc bất kỳ thông tin cần tính chính xác cao mà mình không chắc chắn. " +
      "VÍ DỤ: 'Đăng béo là ai', 'CBum có bao nhiêu danh hiệu', 'Mr. Olympia 2024 ai thắng', " +
      "'Nguyễn Hải Đăng thành tích', 'bài nghiên cứu mới về creatine'. " +
      "KHÔNG GỌI KHI: user hỏi kiến thức gym phổ thông (tập ngực, TDEE, protein...) — dùng kiến thức sẵn có.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Câu truy vấn tìm kiếm. Viết rõ ràng, đầy đủ ngữ cảnh. VD: 'Chris Bumstead Mr Olympia thành tích các năm', 'Đăng béo influencer fitness Việt Nam là ai'",
        },
      },
      required: ["query"],
    },
    execute: searchKnowledge,
    requiresAuth: false,
    requiresConfirmation: false,
  },
};

// Lấy danh sách tool schemas cho LLM API (OpenAI/Gemini format)
export function getToolSchemas() {
  return Object.values(toolRegistry).map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
