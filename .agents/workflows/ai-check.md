---
name: ai-check
trigger: /ai-check
description: Kiểm tra hệ thống AI Chat (HT Assistant) — system prompt, content moderation, tool schemas, UI cards, build. Chạy sau khi sửa bất kỳ file AI nào hoặc trước deploy.
---

# /ai-check — Kiểm tra hệ thống AI Chat

> Chạy workflow này để kiểm tra toàn bộ hệ thống HT Assistant.
> Sử dụng: `/ai-check`

// turbo-all

---

## Bước 1: Kiểm tra cấu trúc files

Verify tất cả files cần thiết tồn tại:

```
server/src/controllers/ai.controller.js
server/src/services/ai/providers/index.js
server/src/services/ai/providers/gemini.provider.js
server/src/services/ai/providers/mock.provider.js
server/src/services/ai/systemPrompt.js
server/src/services/ai/contentModeration.js
server/src/services/ai/tools/toolRegistry.js
server/src/services/ai/tools/toolEngine.js
server/src/services/ai/tools/calculateTdee.tool.js
server/src/services/ai/tools/searchExercises.tool.js
server/src/services/ai/tools/suggestMeal.tool.js
server/src/services/ai/tools/getTrainerInfo.tool.js
server/src/models/ChatConversation.js
server/src/routes/ai.routes.js
client/src/components/ChatWidget/ChatWidget.jsx
client/src/components/ChatWidget/ChatBubble.jsx
client/src/components/ChatWidget/cards/TdeeResultCard.jsx
client/src/components/ChatWidget/cards/TdeeFormCard.jsx
client/src/components/ChatWidget/cards/ExerciseListCard.jsx
client/src/components/ChatWidget/cards/MealSuggestionCard.jsx
client/src/components/ChatWidget/cards/TrainerInfoCard.jsx
client/src/hooks/useAiChat.js
client/src/services/ai.service.js
```

→ Verify: Tất cả files tồn tại

---

## Bước 2: Kiểm tra System Prompt

Đọc `server/src/services/ai/systemPrompt.js` và verify:
- [ ] Có đầy đủ 2 dịch vụ chính (PT 1-1, Online Coaching)
- [ ] Có các bộ môn cụ thể (Gym, Boxing, Cardio HIIT, Stretching/Yoga)
- [ ] Có markdown links cho mỗi dịch vụ/trang (`[text](/path)`)
- [ ] KHÔNG có link `/online-coaching` trong gợi ý (trang đó chỉ cho người đã mua gói)
- [ ] `/club` được mô tả đúng là "tìm phòng tập", KHÔNG PHẢI "bảng giá"
- [ ] Bảng giá link đúng tới `/#pricing` (section trên trang chủ)
- [ ] Có thông tin liên hệ: SĐT, email, link form `/#contact`
- [ ] Có quy tắc trả lời theo chủ đề (dịch vụ, chương trình, giá, liên hệ, phòng tập)
- [ ] Xưng "tôi", gọi "bạn"
- [ ] Có quy tắc page context
- [ ] Có quy tắc TDEE (hỏi tất cả 1 lần)
- [ ] Có quy tắc follow-up (thay đổi calo)

→ Verify: System prompt đầy đủ và chính xác

---

## Bước 3: Kiểm tra Content Moderation

Đọc `server/src/services/ai/contentModeration.js` và verify:
- [ ] Có danh sách URL patterns cấm
- [ ] Có danh sách từ thô tục (VN + EN)
- [ ] Cảnh báo lần 1 → Khóa 1h lần 2
- [ ] Có auto-cleanup state hết hạn

→ Verify: Moderation hoạt động đúng

---

## Bước 4: Kiểm tra Tool Registry

Đọc `server/src/services/ai/tools/toolRegistry.js` và verify:
- [ ] Tất cả tools có description rõ ràng cho LLM
- [ ] Parameters có JSON Schema đúng
- [ ] `calculate_tdee` có `calorieAdjustment` param
- [ ] Required fields chính xác

→ Verify: Tool schemas chính xác

---

## Bước 5: Build Check

```bash
cd client && npm run build
```

→ Verify: Build thành công, không lỗi

---

## Bước 6: Kiểm tra ChatWidget UI

Đọc `client/src/components/ChatWidget/ChatWidget.jsx` và verify:
- [ ] Có floating/sidebar mode toggle
- [ ] Animation slide-right (mở) + slide-out (đóng)
- [ ] Custom scrollbar class `chat-scrollbar`
- [ ] TdeeFormCard integration
- [ ] Hooks TRƯỚC early return (no Rules of Hooks violation)
- [ ] Auto-expand textarea

→ Verify: UI component đầy đủ

---

## Bước 7: Report

Tổng hợp kết quả tất cả bước → report.

Format:
```
AI Chat System Check — [DATE]
========================
Files:       ✅/❌
Prompt:      ✅/❌
Moderation:  ✅/❌
Tools:       ✅/❌
Build:       ✅/❌
UI:          ✅/❌
========================
Overall:     PASS/FAIL
```
