// searchKnowledge.tool.js — Google Search Grounding sub-agent
// Tách riêng khỏi function calling để tránh conflict Gemini API
// Dùng generateContent (non-streaming) vì kết quả được inject vào conversation

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
// Ưu tiên GEMINI_SEARCH_MODEL từ Doppler, fallback gemini-2.5-flash (hỗ trợ Google Search grounding)
const SEARCH_MODEL = process.env.GEMINI_SEARCH_MODEL || "gemini-2.5-flash";
import { safeLog } from "../../../utils/safeLogger.js";

/**
 * Tra cứu thông tin thực tế bằng Google Search Grounding
 * @param {{ query: string }} params
 * @returns {{ text: string, uiCard: null }}
 */
export async function searchKnowledge({ query }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { text: "Không thể tìm kiếm: chưa cấu hình GEMINI_API_KEY.", uiCard: null };
  }

  const body = {
    contents: [{ role: "user", parts: [{ text: query }] }],
    tools: [{ googleSearch: {} }],
    systemInstruction: {
      parts: [{
        text: "Bạn là trợ lý tra cứu thông tin fitness. Trả lời ngắn gọn, chính xác bằng Tiếng Việt. Tập trung đúng vào thông tin được hỏi, không lan man.",
      }],
    },
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 600,
    },
  };

  const url = `${GEMINI_BASE_URL}/models/${SEARCH_MODEL}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      await response.json().catch(() => ({}));
      // Nếu model không hỗ trợ grounding → fallback message
      if (response.status === 400) {
        return { text: "Tìm kiếm không khả dụng với model hiện tại. Mình trả lời dựa trên kiến thức có sẵn.", uiCard: null };
      }
      // Quota exceeded / rate limit
      if (response.status === 429) {
        safeLog.warn("ai.search_rate_limited", "Search provider rate limited");
        return { text: "Chức năng tìm kiếm đang tạm giới hạn. Bạn cứ hỏi trực tiếp — mình sẽ trả lời dựa trên kiến thức có sẵn nhé!", uiCard: null };
      }
      safeLog.warn("ai.search_provider_error", "Search provider returned error", {
        status: response.status,
      });
      return { text: "Không thể tìm kiếm lúc này. Bạn hỏi trực tiếp, mình trả lời dựa trên kiến thức có sẵn nhé!", uiCard: null };
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];

    // Lấy text từ response parts
    const text = candidate?.content?.parts
      ?.filter((p) => p.text)
      ?.map((p) => p.text)
      ?.join("") || "Không tìm thấy thông tin phù hợp.";

    // Lấy nguồn (URLs) từ grounding metadata — tối đa 3 nguồn
    const sources = candidate?.groundingMetadata?.groundingChunks
      ?.map((c) => c.web)
      ?.filter(Boolean)
      ?.slice(0, 3) || [];

    let result = text;
    if (sources.length === 0) {
      result = "Xin lỗi, hiện tại mình chưa tìm thấy thông tin chính xác về vấn đề này. Bạn có câu hỏi nào khác về tập luyện hay dinh dưỡng không?";
    } else {
      const sourceLinks = sources
        .map((s) => `[${s.title || s.uri}](${s.uri})`)
        .join(" · ");
      result += `\n\n📎 *Nguồn: ${sourceLinks}*`;
    }

    return { text: result, uiCard: null };
  } catch (err) {
    return { text: "Lỗi kết nối khi tìm kiếm. Vui lòng thử lại.", uiCard: null };
  }
}
