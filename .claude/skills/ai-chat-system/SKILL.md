---
name: ai-chat-system
description: Kiến trúc, quy tắc sửa, checklist kiểm tra và debug cho HT Assistant (AI chat của HTCOACHINGWEB). Dùng khi sửa provider, system prompt, SSE, tool registry/engine, UI card, content moderation, knowledge base hoặc trước khi bàn giao/release thay đổi AI.
---

# HT Assistant — AI chat system

Khi đổi prompt/context, RAG, provider, quyền tool, output, logging hoặc quota: đọc
[LLM threat matrix](references/llm-threat-matrix.md) và map từng rủi ro tới guard/test thật.
Tool có side effect: đọc thêm [Agentic mutation lifecycle](references/agentic-mutation-lifecycle.md) và mục
"AI-assisted mutation" trong `.claude/rules/security.md` trước khi viết spec hoặc code. Thêm tool mới: dùng skill `new-tool`.

## Kiến trúc

```
Frontend (client/src)                          Backend (server/src)
components/ChatWidget/DeferredChatPanel.jsx     controllers/ai.controller.js  (agent loop, AI_RUNTIME_POLICY)
  (mount trong App.jsx, lazy-load ChatPanel) ── SSE ──▶
  ChatPanel.jsx, ChatPanelSidebar.jsx            ├ services/ai/contentModeration.js
  ChatBubble.jsx (CARD_COMPONENTS)               ├ services/ai/systemPrompt.js
  cards/*.jsx (generative UI)                    ├ services/ai/providers/ (index, deepseek, gemini, mock)
hooks/useAiChat.js (SSE + auto refresh 401)      ├ services/ai/tools/ (toolRegistry, toolEngine, *.tool.js)
services/ai.service.js                           ├ services/ai/toolConfirmation.service.js
                                                 ├ services/ai/embedding.service.js (knowledge base)
                                                 ├ services/ai/aiLogger.js (structured JSON log)
                                                 ├ models/ChatConversation.js, AiToolConfirmation.js
                                                 └ routes/ai.routes.js (auth + CSRF + rate limit)
```

Luồng: moderation → build system prompt (page context + knowledge) → agent loop (provider stream text/tool_call →
`executeTool()` → `ui_card` gửi FE) → lưu conversation (TTL). Inventory tool/card lấy từ code, không chép vào đây.

Provider chọn qua `AI_PROVIDER` (`mock` | `gemini` | `deepseek`), cấu hình trong `providers/index.js` và
`server/.env.production.example`. Số vòng lặp tối đa lấy từ `AI_RUNTIME_POLICY.maxAgentIterations`.

## Quy tắc khi sửa

- **System prompt** (`systemPrompt.js`): luôn kèm markdown link `[text](/path)` khi nhắc trang/dịch vụ. Không gợi ý
  link `/online-coaching` (chỉ cho người đã mua gói). `/club` là "tìm phòng tập", không phải bảng giá; bảng giá là `/#pricing`;
  liên hệ qua `/#contact`. Xưng "tôi", gọi "bạn".
- **Content moderation** (`contentModeration.js`): cảnh báo lần 1 → khóa 1 giờ; thêm từ cấm vào `VULGAR_WORDS`, URL
  pattern vào `BLOCKED_URL_PATTERNS`; state in-memory reset khi restart.
- **UI chat**: hooks đặt trước mọi early return; animation trong `App.css` (prefix `chat*`).
- **Nội dung CMS/KB/tool result** đưa vào prompt là untrusted data — kiểm indirect prompt injection.
- **Provider/model mới hoặc tăng loop/quota**: kiểm nguồn supply-chain, timeout và giới hạn chi phí.
- **Tool ghi dữ liệu**: chỉ bật khi engine enforce preview binding, authorization, one-time confirmation, idempotency
  và reconcile; thiếu thì giữ read-only/draft-only và dừng.
- Thêm page public mới → cân nhắc cập nhật system prompt; đổi format response của tool → kiểm card tương ứng.

## Kiểm tra trước bàn giao

```bash
node .agents/scripts/validate-tools.mjs
npm run test:unit:server
npm run build --prefix client
```

- `validate-tools.mjs` exit 0: mọi tool đủ name/description/parameters/execute, có file `.tool.js`, không orphan.
- Tool schema có description rõ "gọi khi / không gọi khi", parameters là JSON Schema đúng.
- Threat matrix: với mục LLM01–LLM10 liên quan diff, ghi evidence file/test hoặc `NOT APPLICABLE` có lý do —
  KB/tool output vẫn là data; prompt/log không chứa secret, hội thoại thô, dữ liệu sức khỏe/tài chính; output/link/card
  được sanitize/allowlist; auth, guest eligibility, ownership, confirmation enforce khi execute; rate limit, quota,
  iteration, timeout, chi phí tool còn bị chặn.
- Write tool: có integration evidence cho preview giả mạo/cũ, double confirm, commit đồng thời và kết quả không chắc.
- Smoke thủ công khi đổi luồng chat: streaming, một tool có card, link trong câu trả lời navigate được, nội dung xấu bị
  cảnh báo rồi khóa, 401 tự refresh rồi retry.

## Debug nhanh

| Triệu chứng | Kiểm tra |
|---|---|
| SSE không nhận | `Content-Type: text/event-stream`, `res.flushHeaders()`, proxy buffering (`X-Accel-Buffering: no`), CORS origin |
| Tool không được gọi | Đã đăng ký trong `toolRegistry.js`? description rõ? schema đúng? `requiresAuth` nhưng user chưa login? chạy `validate-tools.mjs` |
| Card không render | `uiCard.cardType` khớp key trong `CARD_COMPONENTS` của `ChatBubble.jsx`? data shape khớp props? |
| Knowledge base không match | Entry đã có embedding? ngưỡng similarity quá cao? |
| Cần trace một phiên | Log JSON của `aiLogger`: `chat_start`, `tool_call` (durationMs), `kb_match` (similarity), `chat_error`, `chat_end` |
