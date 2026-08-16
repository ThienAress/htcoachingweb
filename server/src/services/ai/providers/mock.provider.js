// Mock LLM Provider — Trả response giả cho dev/test ($0)
// Giả lập Function Calling behavior để test toàn bộ pipeline

const GREETING = "Chào bạn! Tôi là HT Assistant 🏋️ — trợ lý AI của HTCOACHING. Bạn cần tư vấn về dinh dưỡng, bài tập hay tìm huấn luyện viên phù hợp?";

const SLOT_FILLING_RESPONSES = {
  tdee: "Để ước tính lượng calo, em cần biết trong một lần: giới tính, tuổi, chiều cao, cân nặng, mục tiêu; công việc/di chuyển ngoài buổi tập, số bước trung bình; số buổi, thời lượng và cường độ tập.",
  exercise: "Bạn muốn tìm bài tập cho nhóm cơ nào? Ví dụ: Ngực, Lưng, Chân, Vai, Tay...",
};

// Pattern matching đơn giản để giả lập AI hiểu intent
function detectIntent(message) {
  const lower = message.toLowerCase();

  if (/thực đơn|meal|menu|món ăn/i.test(lower)) {
    return "meal";
  }
  if (/tdee|calo|calories|kcal|dinh dưỡng|thực đơn|ăn|giảm mỡ|tăng cơ|giảm cân|tăng cân/i.test(lower)) {
    return "tdee";
  }
  if (/bài tập|exercise|tập ngực|tập lưng|tập chân|tập vai|tập tay|workout|nhóm cơ/i.test(lower)) {
    return "exercise";
  }
  if (/huấn luyện|hlv|trainer|pt|coach/i.test(lower)) {
    return "trainer";
  }
  return "general";
}

function extractTdeeMemory(messages) {
  const systemText = messages.find((message) => message.role === "system")?.content || "";
  const calories = systemText.match(
    /Calo mục tiêu đã xác nhận:\s*(\d+)\s*kcal\/ngày/i,
  );
  const macro = systemText.match(
    /Moderate-carb:\s*Protein\s*(\d+)g,\s*Carb\s*(\d+)g,\s*Fat\s*(\d+)g/i,
  );
  if (!calories || !macro) return null;
  return {
    targetCalories: Number(calories[1]),
    proteinGrams: Number(macro[1]),
    carbGrams: Number(macro[2]),
    fatGrams: Number(macro[3]),
  };
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
  const isFemale = /nữ|female|chị|em gái/i.test(message);
  const isMale = /\bnam\b|male|anh|em trai/i.test(message);
  if (!isFemale && !isMale) return null;
  const gender = isFemale ? "female" : "male";

  const hasDailyMovement = /văn phòng|chủ yếu ngồi|ngồi nhiều|đi lại|đứng nhiều|lao động|physical/i.test(message);
  const hasSteps = /\d{3,5}\s*(?:bước|steps?)/i.test(message);
  const hasFrequency = /\d+\s*(?:buổi|ngày)\s*\/?\s*(?:tuần|week)/i.test(message);
  const hasDuration = /\d+\s*(?:phút|minutes?)/i.test(message);
  const intensityMatch = message.match(
    /(?:cường độ|tập)\s*(?:rất\s*)?(không áp dụng|nhẹ|vừa|nặng|cao|easy|moderate|vigorous)/i,
  );
  const hasIntensity = Boolean(intensityMatch);
  const hasGoal = /giảm mỡ|giảm cân|tăng cơ|duy trì|fat loss|muscle|maintain/i.test(message);
  if (!hasDailyMovement || !hasSteps || !hasFrequency || !hasDuration || !hasIntensity || !hasGoal) {
    return null;
  }

  const dailyMovement = /lao động|physical/i.test(message)
    ? "physical_work"
    : /đứng nhiều|đi lại nhiều/i.test(message)
      ? "mostly_moving"
      : /văn phòng|chủ yếu ngồi|ngồi nhiều/i.test(message)
        ? "mostly_seated"
        : "mixed";
  const stepsCount = Number(message.match(/(\d{3,5})\s*(?:bước|steps?)/i)?.[1]);
  const steps = stepsCount >= 12000
    ? "at_least_12000"
    : stepsCount >= 8000
      ? "between_8000_11999"
      : stepsCount >= 5000
        ? "between_5000_7999"
        : "under_5000";
  const frequency = Number(message.match(/(\d+)\s*(?:buổi|ngày)\s*\/?\s*(?:tuần|week)/i)?.[1]);
  const trainingFrequency = frequency === 0
    ? "none"
    : frequency >= 5
      ? "five_plus"
      : frequency >= 3
        ? "three_four"
        : "one_two";
  const duration = Number(message.match(/(\d+)\s*(?:phút|minutes?)/i)?.[1]);
  const intensityText = intensityMatch?.[1] || "";
  const hasNoApplicableIntensity = /không áp dụng|not applicable/i.test(intensityText);
  if (
    (frequency === 0 && (duration !== 0 || !hasNoApplicableIntensity)) ||
    (frequency > 0 && (duration === 0 || hasNoApplicableIntensity))
  ) {
    return null;
  }
  const trainingDuration = duration === 0
    ? "none"
    : duration > 60
      ? "over_60"
      : duration >= 45
        ? "between_45_60"
        : duration >= 30
          ? "between_30_45"
          : "under_30";
  const trainingIntensity = hasNoApplicableIntensity
    ? "none"
    : /nặng|cao|vigorous/i.test(intensityText)
      ? "vigorous"
      : /vừa|moderate/i.test(intensityText)
        ? "moderate"
        : "easy";

  const score = ({ mostly_seated: 0, mixed: 2, mostly_moving: 4, physical_work: 6 })[dailyMovement]
    + ({ under_5000: 0, between_5000_7999: 1, between_8000_11999: 3, at_least_12000: 5 })[steps]
    + ({ none: 0, one_two: 1, three_four: 2, five_plus: 3 })[trainingFrequency]
    + ({ none: 0, under_30: 0, between_30_45: 1, between_45_60: 2, over_60: 3 })[trainingDuration]
    + ({ none: 0, easy: 0, moderate: 1, vigorous: 2 })[trainingIntensity];
  const activityLevel = score <= 2 ? "sedentary" : score <= 5 ? "light" : score <= 8 ? "moderate" : score <= 12 ? "active" : "very_active";

  // Detect goal
  let goal = "fat_loss";
  if (/tăng cơ|muscle|bulk/i.test(message)) goal = "muscle_gain";
  else if (/duy trì|maintain/i.test(message)) goal = "maintenance";

  return {
    gender, age, heightCm: height, weightKg: weight, activityLevel,
    dailyMovement, steps, trainingFrequency, trainingDuration,
    trainingIntensity, goal,
  };
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
      const memory = extractTdeeMemory(messages);
      if (!memory) {
        yield {
          type: "text",
          content: "Để gợi ý thực đơn, em cần tính TDEE trước. Bạn cho em biết giới tính, tuổi, chiều cao, cân nặng và mức vận động nhé!",
        };
        break;
      }
      const mealsMatch = userText.match(/([1-6])\s*(?:meal|bữa)/i);
      yield {
        type: "tool_call",
        toolCalls: [{
          id: "mock_4",
          name: "suggest_meal",
          args: {
            ...memory,
            mealsPerDay: mealsMatch ? Number(mealsMatch[1]) : 3,
          },
        }],
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
