// searchKnowledge.tool.js — Google Search Grounding sub-agent
// Tách riêng khỏi function calling để tránh conflict Gemini API
// Dùng generateContent (non-streaming) vì kết quả được inject vào conversation

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
// Dùng model hỗ trợ grounding — ưu tiên gemini-2.0-flash, fallback theo env
const SEARCH_MODEL = process.env.GEMINI_SEARCH_MODEL || process.env.GEMINI_MODEL || "gemini-2.0-flash";

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
      const err = await response.json().catch(() => ({}));
      const errMsg = err?.error?.message || `HTTP ${response.status}`;
      // Nếu model không hỗ trợ grounding → fallback message
      if (response.status === 400) {
        return { text: "Tìm kiếm không khả dụng với model hiện tại. Mình trả lời dựa trên kiến thức có sẵn.", uiCard: null };
      }
      return { text: `Không thể tìm kiếm lúc này (${errMsg}). Vui lòng thử lại.`, uiCard: null };
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
      result = "HT_SYSTEM_ERROR: Không tìm thấy nguồn thông tin đáng tin cậy. BẮT BUỘC trả lời ngắn gọn: 'Xin lỗi, mình chưa có thông tin chính xác về người/vấn đề này' và bẻ lái sang chủ đề tập luyện/dinh dưỡng. KHÔNG ĐƯỢC BỊA ĐẶT THÔNG TIN.";
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
