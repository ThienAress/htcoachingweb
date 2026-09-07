---
name: ai-check
description: Kiểm tra hệ thống AI Chat (HT Assistant) — system prompt, content moderation, tool schemas, UI cards, build. Chạy sau khi sửa bất kỳ file AI nào hoặc trước deploy.
---

# $ai-check — Kiểm tra hệ thống AI Chat

> Chạy workflow này để kiểm tra toàn bộ hệ thống HT Assistant.
> Sử dụng: `$ai-check`

// turbo-all

---

## Bước 1: Kiểm tra cấu trúc files

Lấy inventory từ repo thay vì duy trì danh sách từng tool/card trong skill:

```bash
rg --files server/src/services/ai client/src/components/ChatWidget
rg --files server/src/services/ai/tools | rg "\.tool\.js$"
rg --files client/src/components/ChatWidget/cards | rg "\.jsx$"
```

Verify các entry point kiến trúc bắt buộc tồn tại; tool/card cụ thể được đối chiếu từ inventory
và `validate-tools.mjs` ở Bước 4.5:

```text
server/src/controllers/ai.controller.js
server/src/services/ai/providers/index.js
server/src/services/ai/systemPrompt.js
server/src/services/ai/contentModeration.js
server/src/services/ai/aiLogger.js
server/src/services/ai/tools/toolRegistry.js
server/src/services/ai/tools/toolEngine.js
server/src/services/ai/toolConfirmation.service.js
server/src/models/ChatConversation.js
server/src/models/AiToolConfirmation.js
server/src/routes/ai.routes.js
client/src/components/ChatWidget/ChatWidget.jsx
client/src/components/ChatWidget/ChatPanel.jsx
client/src/components/ChatWidget/ChatBubble.jsx
client/src/hooks/useAiChat.js
client/src/services/ai.service.js
```

→ Verify: Entry points tồn tại; không có registered tool thiếu file hoặc orphan tool file

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

## Bước 3.5: Kiểm tra LLM threat matrix

Đọc `../ai-chat-system/references/llm-threat-matrix.md`, chọn các LLM01–LLM10 liên quan tới diff và ghi evidence:

- [ ] CMS/KB/tool result vẫn là untrusted data, không thể đổi system policy hoặc quyền tool
- [ ] Prompt/provider/log không chứa secret, raw conversation, health hoặc financial payload
- [ ] Assistant output/link/card được sanitize/allowlist trước browser/action sink
- [ ] Tool auth, guest eligibility, ownership, schema và confirmation được enforce khi execute
- [ ] Vector/KB write/query provenance và access path đã trace hoặc ghi `proof_gap`
- [ ] Rate limit, quota, iteration, context, timeout và tool-call cost vẫn bounded

Nếu diff thêm/bật tool có side effect, đọc
`../ai-chat-system/references/agentic-mutation-lifecycle.md` và ghi integration evidence cho từng stage.
Nếu engine chưa enforce canonical preview binding, server revalidation, one-time confirmation,
idempotency và reconcile, kết quả là `FAIL`; cờ registry hoặc UI confirmation riêng lẻ không đủ.

Không đánh dấu PASS từ checklist đơn thuần; mỗi mục cần file/test evidence hoặc `NOT APPLICABLE` có lý do.

---

## Bước 4: Kiểm tra Tool Registry

Đọc `server/src/services/ai/tools/toolRegistry.js` và verify:
- [ ] Tất cả tools có description rõ ràng cho LLM
- [ ] Parameters có JSON Schema đúng
- [ ] `calculate_tdee` có `calorieAdjustment` param
- [ ] Required fields chính xác

→ Verify: Tool schemas chính xác

---

## Bước 4.5: Validate Tools Script 🛠️

Chạy script tự động kiểm tra tất cả tools:

```bash
node .agents/scripts/validate-tools.mjs
```

Script kiểm tra:
- [ ] Mỗi tool có đủ required fields (name, description, parameters, execute)
- [ ] File `.tool.js` tương ứng tồn tại
- [ ] Không có orphan files (file tồn tại nhưng chưa registered)
- [ ] `getToolSchemas()` trả về đủ số lượng

→ Verify: Script exit 0 (ALL PASS)

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
Files:          ✅/❌
Prompt:         ✅/❌
Moderation:     ✅/❌
Threat matrix:  PASS/FAIL/NOT APPLICABLE
Mutation flow:  PASS/FAIL/NOT APPLICABLE
Tools:          ✅/❌
Tool Validate:  ✅/❌
Build:          ✅/❌
UI:             ✅/❌
========================
Overall:        PASS/FAIL
```
