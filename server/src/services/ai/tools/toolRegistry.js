// Tool Registry — Định nghĩa tất cả tools cho AI Agent
// Mỗi tool có: name, description (cho LLM), parameters (JSON Schema), execute fn

import { calculateTdee } from "./calculateTdee.tool.js";
import { searchExercises } from "./searchExercises.tool.js";
import { suggestMeal } from "./suggestMeal.tool.js";
import { getTrainerInfo } from "./getTrainerInfo.tool.js";
import { searchKnowledge } from "./searchKnowledge.tool.js";
import { checkWallet } from "./checkWallet.tool.js";
import { getWorkoutPlan } from "./getWorkoutPlan.tool.js";
import { searchBlog } from "./searchBlog.tool.js";
import { getCheckinHistory } from "./getCheckinHistory.tool.js";
import { getTrainingSchedule } from "./getTrainingSchedule.tool.js";
import { getGymInfo } from "./getGymInfo.tool.js";

const validateTdeeTrainingEvidence = (parameters) => {
  const noTraining = parameters.trainingFrequency === "none";
  const noDuration = parameters.trainingDuration === "none";
  const noIntensity = parameters.trainingIntensity === "none";
  return (
    (noTraining && (!noDuration || !noIntensity)) ||
    (!noTraining && (noDuration || noIntensity))
  )
    ? ["trainingFrequency", "trainingDuration", "trainingIntensity"]
    : [];
};

export const toolRegistry = {
  calculate_tdee: {
    name: "calculate_tdee",
    description:
      "Ước tính TDEE và phân bổ macro dinh dưỡng từ bằng chứng vận động cả ngày. " +
      "GỌI KHI: user muốn biết lượng calo, muốn lên thực đơn, hỏi ăn bao nhiêu, hoặc nói về giảm mỡ/tăng cơ VÀ đã cung cấp đủ thông tin. " +
      "CŨNG GỌI KHI: user muốn thay đổi mức thâm hụt/thặng dư calo (VD: 'giảm 500 calo' thay vì mặc định) — dùng calorieAdjustment. " +
      "KHÔNG GỌI KHI: thiếu công việc/di chuyển, bước chân hoặc thời lượng/cường độ/tần suất tập — hỏi tất cả trong 1 lần. " +
      "Không suy activityLevel chỉ từ số buổi; chọn đúng band theo toàn bộ evidence.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        gender: { type: "string", enum: ["male", "female"], description: "Giới tính" },
        age: { type: "integer", minimum: 13, maximum: 100, description: "Tuổi" },
        heightCm: { type: "number", minimum: 100, maximum: 250, description: "Chiều cao tính bằng cm" },
        weightKg: { type: "number", minimum: 20, maximum: 350, description: "Cân nặng tính bằng kg" },
        activityLevel: {
          type: "string",
          enum: ["sedentary", "light", "moderate", "active", "very_active"],
          description:
            "Band đề xuất từ toàn bộ evidence: sedentary=1.2, light=1.4, moderate=1.55, active=1.7, very_active=1.85",
        },
        dailyMovement: {
          type: "string",
          enum: ["mostly_seated", "mixed", "mostly_moving", "physical_work"],
          description: "Vận động ngoài buổi tập: chủ yếu ngồi, xen kẽ, đi lại nhiều hoặc lao động thể chất",
        },
        steps: {
          type: "string",
          enum: ["under_5000", "between_5000_7999", "between_8000_11999", "at_least_12000"],
          description: "Band số bước trung bình mỗi ngày",
        },
        trainingFrequency: {
          type: "string",
          enum: ["none", "one_two", "three_four", "five_plus"],
          description: "Số buổi tập mỗi tuần",
        },
        trainingDuration: {
          type: "string",
          enum: ["none", "under_30", "between_30_45", "between_45_60", "over_60"],
          description: "Thời lượng trung bình mỗi buổi",
        },
        trainingIntensity: {
          type: "string",
          enum: ["none", "easy", "moderate", "vigorous"],
          description: "Cường độ trung bình của buổi tập",
        },
        goal: {
          type: "string",
          enum: ["fat_loss", "maintenance", "muscle_gain"],
          description: "Mục tiêu: fat_loss=giảm mỡ, maintenance=duy trì cân nặng, muscle_gain=tăng cơ",
        },
        calorieAdjustment: {
          type: "number",
          minimum: -1500,
          maximum: 1500,
          description: "Mức điều chỉnh calo tùy chỉnh (VD: -500 để giảm 500 calo, +300 để tăng 300 calo). Nếu không có, dùng mặc định theo goal.",
        },
      },
      required: [
        "gender", "age", "heightCm", "weightKg", "goal",
        "dailyMovement", "steps", "trainingFrequency", "trainingDuration",
        "trainingIntensity",
      ],
    },
    execute: calculateTdee,
    validateParameters: validateTdeeTrainingEvidence,
    readOnly: true,
    parallelSafe: true,
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
      additionalProperties: false,
      properties: {
        muscleGroup: { type: "string", minLength: 1, maxLength: 50, description: "Nhóm cơ muốn tìm. VD: Ngực, Lưng, Chân, Vai, Tay, Bụng" },
        searchQuery: { type: "string", minLength: 1, maxLength: 100, description: "Tên bài tập muốn tìm. VD: plank, squat, bench press" },
        limit: { type: "integer", minimum: 1, maximum: 10, description: "Số lượng kết quả tối đa (mặc định 5)" },
      },
    },
    execute: searchExercises,
    readOnly: true,
    parallelSafe: true,
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
      additionalProperties: false,
      properties: {
        targetCalories: { type: "number", minimum: 800, maximum: 6000, description: "Tổng calo mục tiêu mỗi ngày" },
        proteinGrams: { type: "number", minimum: 0, maximum: 500, description: "Gram protein mục tiêu" },
        carbGrams: { type: "number", minimum: 0, maximum: 1000, description: "Gram carb mục tiêu" },
        fatGrams: { type: "number", minimum: 0, maximum: 300, description: "Gram fat mục tiêu" },
        mealsPerDay: { type: "integer", minimum: 1, maximum: 6, description: "Số bữa ăn mỗi ngày (1-6, mặc định 3)" },
      },
      required: ["targetCalories", "proteinGrams", "carbGrams", "fatGrams"],
    },
    execute: suggestMeal,
    readOnly: true,
    parallelSafe: true,
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
      additionalProperties: false,
      properties: {
        specialty: { type: "string", minLength: 1, maxLength: 100, description: "Chuyên môn tìm kiếm. VD: giảm mỡ, tăng cơ" },
      },
    },
    execute: getTrainerInfo,
    readOnly: true,
    parallelSafe: true,
    requiresAuth: false,
    requiresConfirmation: false,
  },

  search_knowledge: {
    name: "search_knowledge",
    description:
      "Tra cứu thông tin thực tế từ internet bằng Google Search. " +
      "⚠️ CHỈ GỌI KHI: thông tin KHÔNG có trong phần 'Kiến thức đã verified' ở system prompt. " +
      "Nếu system prompt đã có câu trả lời → DÙNG NGAY, KHÔNG gọi tool này. " +
      "GỌI KHI: user hỏi dữ liệu mới/có thể thay đổi, yêu cầu nguồn, hoặc thông tin cụ thể " +
      "mà model không đủ chắc chắn và không tìm thấy trong kiến thức verified. " +
      "VÍ DỤ nên gọi: 'Mr. Olympia 2024 ai thắng', 'bài nghiên cứu mới về creatine'. " +
      "KHÔNG GỌI KHI: câu hỏi đã được trả lời bởi KB, kiến thức gym phổ thông, " +
      "hoặc tiểu sử ổn định mà model biết chắc.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: {
          type: "string",
          minLength: 2,
          maxLength: 300,
          description: "Câu truy vấn tìm kiếm. Viết rõ ràng, đầy đủ ngữ cảnh. VD: 'Chris Bumstead Mr Olympia thành tích các năm', 'Đăng béo influencer fitness Việt Nam là ai'",
        },
      },
      required: ["query"],
    },
    execute: searchKnowledge,
    readOnly: true,
    parallelSafe: false,
    requiresAuth: false,
    guestEnabled: false,
    requiresConfirmation: false,
  },

  check_wallet: {
    name: "check_wallet",
    description:
      "Kiểm tra số dư ví và lịch sử giao dịch gần nhất của user. " +
      "GỌI KHI: user hỏi về ví tiền, số dư, lịch sử nạp tiền, hoặc hỏi 'ví tôi còn bao nhiêu'. " +
      "KHÔNG GỌI KHI: user chưa đăng nhập.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 10,
          description: "Số giao dịch gần nhất muốn xem (mặc định 5, tối đa 10)",
        },
      },
    },
    execute: checkWallet,
    readOnly: true,
    parallelSafe: true,
    requiresAuth: true,
    requiresConfirmation: false,
  },

  get_workout_plan: {
    name: "get_workout_plan",
    description:
      "Lấy giáo án tập luyện (workout plan) của user. " +
      "GỌI KHI: user hỏi về lịch tập, giáo án, bài tập hôm nay, hoặc muốn xem chương trình tập. " +
      "Có thể lọc theo ngày cụ thể hoặc lấy giáo án gần nhất. " +
      "KHÔNG GỌI KHI: user chưa đăng nhập.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        date: {
          type: "string",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          description: "Ngày cụ thể muốn xem giáo án (ISO format: YYYY-MM-DD). Nếu không có, lấy giáo án gần nhất.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 5,
          description: "Số giáo án muốn xem (mặc định 3, tối đa 5)",
        },
      },
    },
    execute: getWorkoutPlan,
    readOnly: true,
    parallelSafe: true,
    requiresAuth: true,
    requiresConfirmation: false,
  },

  search_blog: {
    name: "search_blog",
    description:
      "Tìm bài viết blog trên trang HTCOACHING theo từ khóa hoặc danh mục. " +
      "GỌI KHI: user hỏi về kiến thức tập luyện, dinh dưỡng, lối sống, hoặc muốn đọc bài viết. " +
      "VÍ dụ: 'có bài nào về giảm mỡ bụng không?', 'bài viết về protein'. " +
      "Danh mục: Tập luyện, Dinh dưỡng, Hiểu cơ thể, Tư duy & Lối sống.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: {
          type: "string",
          minLength: 1,
          maxLength: 100,
          description: "Từ khóa tìm kiếm. VD: 'giảm mỡ', 'protein', 'cardio'",
        },
        category: {
          type: "string",
          maxLength: 50,
          description: "Danh mục lọc: tap-luyen, dinh-duong, hieu-co-the, tu-duy-loi-song",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 10,
          description: "Số bài viết tối đa (mặc định 5, tối đa 10)",
        },
      },
    },
    execute: searchBlog,
    readOnly: true,
    parallelSafe: true,
    requiresAuth: false,
    requiresConfirmation: false,
  },

  get_checkin_history: {
    name: "get_checkin_history",
    description:
      "Xem lịch sử check-in và thông tin gói tập của user. " +
      "GỌI KHI: user hỏi về lịch sử tập, số buổi đã tập, gói tập còn bao nhiêu buổi, " +
      "hoặc hỏi 'tôi tập được mấy buổi rồi', 'gói tập còn bao nhiêu'. " +
      "KHÔNG GỌI KHI: user chưa đăng nhập.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 20,
          description: "Số buổi check-in gần nhất muốn xem (mặc định 10, tối đa 20)",
        },
      },
    },
    execute: getCheckinHistory,
    readOnly: true,
    parallelSafe: true,
    requiresAuth: true,
    requiresConfirmation: false,
  },

  get_training_schedule: {
    name: "get_training_schedule",
    description:
      "Lấy lịch tập + giáo án coaching hôm nay và cả tuần. " +
      "GỌI KHI: user hỏi 'hôm nay tập mấy giờ', 'lịch tập tuần này', 'hôm nay tập gì', " +
      "'giáo án hôm nay', hoặc hỏi về lịch trình tập luyện cá nhân. " +
      "Tự động kèm giáo án chi tiết (bài tập, sets, reps) nếu có. " +
      "KHÔNG GỌI KHI: user chưa đăng nhập.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        includeWorkout: {
          type: "boolean",
          description: "Có lấy giáo án coaching chi tiết hôm nay không (mặc định true)",
        },
      },
    },
    execute: getTrainingSchedule,
    readOnly: true,
    parallelSafe: true,
    requiresAuth: true,
    requiresConfirmation: false,
  },

  get_gym_info: {
    name: "get_gym_info",
    description:
      "Lấy thông tin các phòng tập mà HLV HTCOACHING đang dạy (địa chỉ, giờ mở cửa, Google Maps). " +
      "Đây là phòng tập hợp tác, KHÔNG phải phòng tập của HTCOACHING. " +
      "GỌI KHI: user hỏi về phòng tập, địa chỉ, giờ mở cửa, hoặc muốn tìm phòng tập gần. " +
      "VD: 'phòng tập ở đâu', 'tập ở quận 7 chỗ nào', 'giờ mở cửa'. " +
      "KHÔNG cần đăng nhập.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        district: {
          type: "string",
          minLength: 1,
          maxLength: 100,
          description: "Lọc theo quận/huyện. VD: Quận 7, Bình Thạnh, Thủ Đức",
        },
      },
    },
    execute: getGymInfo,
    readOnly: true,
    parallelSafe: true,
    requiresAuth: false,
    requiresConfirmation: false,
  },
};

// Lấy danh sách tool schemas cho LLM API (OpenAI/Gemini format)
export function getToolSchemas({ isAuthenticated = true } = {}) {
  return Object.values(toolRegistry)
    .filter(
      (tool) =>
        isAuthenticated || (!tool.requiresAuth && tool.guestEnabled !== false),
    )
    .map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
}
