// Mock LLM Provider — Trả response giả cho dev/test ($0)
// Giả lập Function Calling behavior để test toàn bộ pipeline

const GREETING = "Chào bạn! Tôi là HT Assistant 🏋️ — trợ lý AI của HTCOACHING. Bạn cần tư vấn về dinh dưỡng, bài tập hay tìm huấn luyện viên phù hợp?";

const SLOT_FILLING_RESPONSES = {
  tdee: "Để tính lượng calo cho bạn, em cần biết thêm:\n- Giới tính?\n- Tuổi?\n- Chiều cao (cm)?\n- Cân nặng (kg)?\n- Mức vận động hàng ngày?",
  exercise: "Bạn muốn tìm bài tập cho nhóm cơ nào? Ví dụ: Ngực, Lưng, Chân, Vai, Tay...",
};

// Pattern matching đơn giản để giả lập AI hiểu intent
function detectIntent(message) {
  const lower = message.toLowerCase();

  if (/tdee|calo|calories|kcal|dinh dưỡng|thực đơn|ăn|giảm mỡ|tăng cơ|giảm cân|tăng cân/i.test(lower)) {
    return "tdee";
  }
  if (/bài tập|exercise|tập ngực|tập lưng|tập chân|tập vai|tập tay|workout|nhóm cơ/i.test(lower)) {
    return "exercise";
  }
  if (/huấn luyện|hlv|trainer|pt|coach/i.test(lower)) {
    return "trainer";
  }
  if (/thực đơn|meal|menu|món ăn/i.test(lower)) {
    return "meal";
  }
  return "general";
}

// Kiểm tra xem message có đủ data để gọi tool không
function extractTdeeParams(message) {
  const heightMatch = message.match(/(\d{2,3})\s*cm|cao\s*(\d{2,3})|(\d\.\d+)\s*m/i);
  const weightMatch = message.match(/(\d{2,3})\s*kg|nặng\s*(\d{2,3})/i);
  const ageMatch = message.match(/(\d{1,2})\s*tuổi|tuổi\s*(\d{1,2})/i);

  const height = heightMatch ? parseInt(heightMatch[1] || heightMatch[2]) || Math.round(parseFloat(heightMatch[3] || "0") * 100) : null;
  const weight = weightMatch ? parseInt(weightMatch[1] || weightMatch[2]) : null;
  const age = ageMatch ? parseInt(ageMatch[1] || ageMatch[2]) : null;

  if (!height || !weight || !age) return null;

  // Detect gender
  let gender = "male";
  if (/nữ|female|chị|em gái/i.test(message)) gender = "female";

  // Detect activity level
  let activityLevel = "moderate";
  if (/văn phòng|ngồi nhiều|ít vận động|sedentary/i.test(message)) activityLevel = "sedentary";
  else if (/tập nhẹ|light/i.test(message)) activityLevel = "light";
  else if (/tập nặng|active|chăm tập/i.test(message)) activityLevel = "active";

  // Detect goal
  let goal = "fat_loss";
  if (/tăng cơ|muscle|bulk/i.test(message)) goal = "muscle_gain";
  else if (/duy trì|maintain/i.test(message)) goal = "maintenance";

  return { gender, age, heightCm: height, weightKg: weight, activityLevel, goal };
}

function extractExerciseParams(message) {
  const groups = {
    "ngực": "Ngực", "chest": "Ngực",
    "lưng": "Lưng", "back": "Lưng",
    "chân": "Chân", "leg": "Chân",
    "vai": "Vai", "shoulder": "Vai",
    "tay": "Tay", "arm": "Tay", "bicep": "Tay", "tricep": "Tay",
    "bụng": "Bụng", "core": "Bụng", "abs": "Bụng",
  };

  const lower = message.toLowerCase();
  for (const [keyword, group] of Object.entries(groups)) {
    if (lower.includes(keyword)) {
      return { muscleGroup: group, limit: 5 };
    }
  }
  return null;
}

/**
 * Mock LLM stream — giả lập behavior của real LLM
 * @param {Array} messages - Conversation history
 * @param {Array} tools - Available tool schemas
 * @returns {AsyncGenerator} Stream of response chunks
 */
export async function* mockLLMStream(messages, tools, options = {}) {
  if (options.signal?.aborted) return;
  // Lấy message cuối cùng của user
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) {
    yield { type: "text", content: GREETING };
    return;
  }

  const userText = lastUserMsg.content;
  const intent = detectIntent(userText);

  // Nếu message trước là tool result → sinh response tổng hợp
  const lastMsg = messages[messages.length - 1];
  if (lastMsg.role === "tool") {
    yield {
      type: "text",
      content: "Dựa trên kết quả tính toán, đây là thông tin chi tiết cho bạn! Bạn có muốn tôi lên thực đơn hoặc gợi ý bài tập không?",
    };
    return;
  }

  switch (intent) {
    case "tdee": {
      const params = extractTdeeParams(userText);
      if (params) {
        yield { type: "tool_call", toolCalls: [{ id: "mock_1", name: "calculate_tdee", args: params }] };
      } else {
        yield { type: "text", content: SLOT_FILLING_RESPONSES.tdee };
      }
      break;
    }
    case "exercise": {
      const params = extractExerciseParams(userText);
      if (params) {
        yield { type: "tool_call", toolCalls: [{ id: "mock_2", name: "search_exercises", args: params }] };
      } else {
        yield { type: "text", content: SLOT_FILLING_RESPONSES.exercise };
      }
      break;
    }
    case "trainer": {
      yield { type: "tool_call", toolCalls: [{ id: "mock_3", name: "get_trainer_info", args: {} }] };
      break;
    }
    case "meal": {
      yield {
        type: "text",
        content: "Để gợi ý thực đơn, em cần tính TDEE trước. Bạn cho em biết giới tính, tuổi, chiều cao, cân nặng và mức vận động nhé!",
      };
      break;
    }
    default: {
      yield { type: "text", content: GREETING };
    }
  }
}

/**
 * Lấy tool schemas ở format chuẩn cho mock provider
 * Mock provider không cần format đặc biệt — chỉ dùng tên tool
 */
export function formatToolsForProvider(tools) {
  return tools;
}
