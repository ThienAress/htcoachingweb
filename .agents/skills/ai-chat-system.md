---
name: ai-chat-system
description: Kiến trúc hệ thống AI Chat (HT Assistant). Use khi sửa bất kỳ file nào liên quan đến AI assistant — tools, providers, SSE, UI cards, system prompt, content moderation.
---

# HT Assistant — AI Chat Skill Guide

> Skill này dành cho AI agent khi làm việc với hệ thống AI Chat của htcoachingweb.
> Đọc file này trước khi sửa bất kỳ file nào liên quan đến AI assistant.

---

## 🛠️ MODES

### Mode 1: Build New Tool
Khi thêm tool/card mới cho AI assistant:
1. Tạo tool file → register trong toolRegistry → tạo card (nếu có) → test

### Mode 2: Maintain Existing
Khi sửa bug hoặc update system prompt/content moderation:
1. Đọc luồng xử lý bên dưới → xác định layer bị ảnh hưởng → sửa surgical

---

## 🚨 PROACTIVE TRIGGERS

- **Thêm page public mới** → Cập nhật `systemPrompt.js` nếu AI cần biết về page đó
- **Thêm model/service mới** → Cân nhắc có cần AI tool không (VD: thêm Booking → có tool getBookingInfo?)
- **Sửa tool response format** → Kiểm tra card component có match data shape mới không

---

## Kiến trúc tổng quan

```
Frontend (React)                         Backend (Express)
┌─────────────────┐                     ┌──────────────────────┐
│ ChatWidget.jsx  │──── SSE fetch ────→ │ ai.controller.js     │
│ ChatPanel.jsx   │                     │   ├ contentModeration │
│ ChatPanelSidebar│                     │   ├ systemPrompt.js   │
│ useAiChat.js    │                     │   ├ providers/        │
│ ChatBubble.jsx  │                     │   │  ├ gemini.provider│
│ cards/          │                     │   │  └ mock.provider  │
│   TdeeFormCard  │                     │   ├ tools/ (11 tools) │
│   TdeeResult    │                     │   │  ├ toolRegistry   │
│   ExerciseList  │                     │   │  ├ toolEngine     │
│   MealSuggest   │                     │   │  └ ... (see below)│
│   TrainerInfo   │                     │   ├ embedding.service │
│   WalletSummary │                     │   └ ChatConversation  │
│   WorkoutPlan   │                     └──────────────────────┘
│   BlogList      │
└─────────────────┘
```

## File Map

### Frontend — `client/src/`
| File | Vai trò |
|------|---------|
| `components/ChatWidget/ChatWidget.jsx` | Widget chính — floating button, toggle panel |
| `components/ChatWidget/ChatPanel.jsx` | Panel chat chính — messages, input, header |
| `components/ChatWidget/ChatPanelSidebar.jsx` | Sidebar mode layout |
| `components/ChatWidget/ChatBubble.jsx` | Render message + markdown links + UI cards |
| `components/ChatWidget/cards/*.jsx` | Generative UI cards (8 cards) |
| `hooks/useAiChat.js` | SSE streaming hook + auto token refresh |
| `services/ai.service.js` | API URL helpers |
| `App.css` | Chat animations (slideRight, slideIn, cardEnter, scrollbar) |

### Backend — `server/src/`
| File | Vai trò |
|------|---------|
| `controllers/ai.controller.js` | SSE endpoint + Agent Loop (max 5 iterations) |
| `services/ai/providers/index.js` | Provider factory (mock/gemini) |
| `services/ai/providers/gemini.provider.js` | Gemini API streaming + function calling |
| `services/ai/providers/mock.provider.js` | Mock provider cho testing offline |
| `services/ai/systemPrompt.js` | System prompt builder (page context + knowledge) |
| `services/ai/contentModeration.js` | Validate nội dung, warn + khóa 1h |
| `services/ai/aiLogger.js` | Structured JSON logging cho AI system |
| `services/ai/embedding.service.js` | Vector embeddings cho Knowledge Base search |
| `services/ai/tools/toolRegistry.js` | Tool schemas (OpenAI format) |
| `services/ai/tools/toolEngine.js` | Tool executor |
| `services/ai/tools/calculateTdee.tool.js` | Tính TDEE + macros |
| `services/ai/tools/searchExercises.tool.js` | Tìm bài tập trong DB |
| `services/ai/tools/suggestMeal.tool.js` | Gợi ý thực đơn |
| `services/ai/tools/getTrainerInfo.tool.js` | Lấy thông tin HLV |
| `services/ai/tools/checkWallet.tool.js` | Kiểm tra số dư ví (requiresAuth) |
| `services/ai/tools/getWorkoutPlan.tool.js` | Lấy giáo án tập luyện (requiresAuth) |
| `services/ai/tools/searchKnowledge.tool.js` | Tra cứu thông tin từ Knowledge Base |
| `services/ai/tools/searchBlog.tool.js` | Tìm bài viết blog |
| `services/ai/tools/getCheckinHistory.tool.js` | Lấy lịch sử checkin (requiresAuth) |
| `services/ai/tools/getGymInfo.tool.js` | Lấy thông tin phòng gym |
| `services/ai/tools/getTrainingSchedule.tool.js` | Lấy lịch tập luyện (requiresAuth) |
| `models/ChatConversation.js` | Mongoose model (TTL 30 ngày) |
| `routes/ai.routes.js` | Routes + auth + CSRF + rate limit |

## Luồng xử lý tin nhắn

```
User gửi message
  ↓
[contentModeration] → Check URL đen, ngôn ngữ thô tục
  ↓ (safe)
[buildSystemPrompt] → Inject page context + HTCOACHING knowledge
  ↓
[Agent Loop] ← max 5 vòng
  ├→ [Gemini API] → streaming text/tool_call
  ├→ [Tool Call?] → executeTool() → gửi ui_card cho FE
  └→ [Text?] → stream trực tiếp qua SSE
  ↓
[Save conversation] → MongoDB (TTL 30 ngày)
```

## Quy tắc khi sửa code

### Thêm Tool mới
1. Tạo file `server/src/services/ai/tools/{name}.tool.js`
2. Export async function nhận `(params, context)`, trả `{ text, uiCard? }`
3. Đăng ký trong `toolRegistry.js` với JSON Schema parameters
4. (Nếu có UI card) Tạo card component trong `client/src/components/ChatWidget/cards/`
5. Import card vào `ChatBubble.jsx` → thêm vào `CARD_COMPONENTS`

### Sửa System Prompt
- File: `server/src/services/ai/systemPrompt.js`
- LUÔN kèm markdown link `[text](/path)` khi đề cập trang/dịch vụ
- Test bằng cách hỏi AI câu tương tự sau khi sửa

### Sửa UI Chat
- Widget: `ChatWidget.jsx` — floating button + panel toggle
- Panel: `ChatPanel.jsx` — messages + input
- Sidebar: `ChatPanelSidebar.jsx` — sidebar layout
- Animation: `App.css` (prefix `chat*`)
- KHÔNG break Rules of Hooks (all hooks TRƯỚC early return)

### Content Moderation
- File: `contentModeration.js`
- Warn 1 → Lock 1h
- Thêm từ cấm: array `VULGAR_WORDS`
- Thêm URL pattern: array `BLOCKED_URL_PATTERNS`
- State in-memory → reset khi restart server

## Environment Variables

| Biến | Mặc định | Mô tả |
|------|---------|-------|
| `AI_PROVIDER` | `mock` | `mock` hoặc `gemini` |
| `GEMINI_API_KEY` | — | API key từ aistudio.google.com |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` | Model ID |

## Test checklist

- [ ] Chat mở/đóng mượt
- [ ] Floating + Sidebar mode toggle
- [ ] Gửi message → nhận streaming response
- [ ] Tool call (TDEE) → TdeeFormCard + TdeeResultCard
- [ ] Tool call (Wallet) → WalletSummaryCard
- [ ] Tool call (WorkoutPlan) → WorkoutPlanCard
- [ ] Tool call (Blog) → BlogListCard
- [ ] Tool call (CheckinHistory) → response text
- [ ] Tool call (GymInfo) → response text
- [ ] Tool call (TrainingSchedule) → response text
- [ ] Follow-up (đổi -300 → -500)
- [ ] AI trả link → click được → navigate
- [ ] Nội dung xấu → cảnh báo → khóa 1h
- [ ] 401 → auto refresh token → retry
