---
name: new-tool
description: Tạo AI tool mới cho HT Assistant ở mode text-only hoặc Generative UI; bảo đảm contract, registry, quyền truy cập và phần frontend tùy chọn được đăng ký đúng.
---

# $new-tool — Tạo AI Tool Mới

> **Trigger:** User yêu cầu thêm tính năng mới cho AI chat (ví dụ: "cho AI kiểm tra lịch tập")
> **Output:** Tool backend đã đăng ký; chỉ thêm UI Card frontend khi dữ liệu cần presentation có cấu trúc.

---

## Checklist Nhanh

```
□ Backend:  server/src/services/ai/tools/{name}.tool.js
□ Registry: server/src/services/ai/tools/toolRegistry.js (import + entry)
□ Contract: tool luôn trả { text, uiCard? }
□ Mode B:   client/src/components/ChatWidget/cards/{Name}Card.jsx
□ Mode B:   client/src/components/ChatWidget/ChatBubble.jsx (import + CARD_COMPONENTS)
□ Skill:    .agents/skills/ai-chat-system/SKILL.md (cập nhật File Map + Test checklist)
```

---

## Bước 1: Chọn Response Mode và Tool Type

Chọn đúng một response mode trước khi tạo file:

| Mode | Dùng khi | Kết quả |
|------|----------|---------|
| **A — Text-only** | Câu trả lời ngắn, markdown đã đủ rõ, không cần tương tác hoặc layout riêng | `{ text }` |
| **B — Generative UI** | Kết quả có cấu trúc, nhiều trường, danh sách hoặc hành động cần card để đọc nhanh | `{ text, uiCard }` |

Không tạo UI Card chỉ để bọc lại một đoạn text. `uiCard` là optional; Tool Engine và Chat UI vẫn phải hoạt động khi tool chỉ trả `{ text }`.

Sau đó xác định quyền truy cập:

| Type | Ví dụ | `requiresAuth` | `requiresConfirmation` |
|------|-------|:--------------:|:---------------------:|
| **Read-only, public** | searchExercises, getTrainerInfo | `false` | `false` |
| **Read-only, cần auth** | checkWallet, getWorkoutPlan | `true` | `false` |
| **Write, cần xác nhận** | bookSchedule, sendEmail | `true` | `true` |

**Verify:** Tool này đọc hay ghi dữ liệu? Cần đăng nhập không?

---

## Bước 2: Tạo Tool File (Backend)

Tạo file `server/src/services/ai/tools/{toolName}.tool.js`:

```javascript
// {Tool Description} — {Query/Action} {Model} model

import {Model} from "../../../models/{Model}.js";

export async function {toolFunction}(params, context) {
  // 1. Auth check (nếu requiresAuth)
  if (!context.userId) {
    return {
      text: "Bạn cần đăng nhập để sử dụng tính năng này.",
    };
  }

  // 2. Query database
  const data = await {Model}.find({ ... }).lean();

  // 3. Handle empty result
  if (!data || data.length === 0) {
    return { text: "Không tìm thấy dữ liệu." };
  }

  // 4. Build text cho LLM (markdown format, có links)
  const text = `...`;

  // Mode A — text-only:
  return { text };
}
```

Với Mode B, thay `return { text };` cuối function bằng:

```javascript
return {
  text,
  uiCard: {
    cardType: "{cardType}", // phải match CARD_COMPONENTS key
    data: { ... },
  },
};
```

Không thêm JSDoc mặc định. Chỉ thêm khi type/contract không thể hiểu rõ từ code hoặc user yêu cầu. Dù chọn mode nào, `text` vẫn bắt buộc để LLM có ngữ cảnh và để UI có fallback.

**Pattern mẫu:** Xem `getTrainerInfo.tool.js` hoặc `checkWallet.tool.js`

**Verify:** File export async function đúng tên

---

## Bước 3: Đăng Ký Tool (Registry)

Sửa `server/src/services/ai/tools/toolRegistry.js`:

1. **Import** tool function ở đầu file
2. **Thêm entry** vào object `toolRegistry` với:
   - `name`: snake_case (ví dụ: `check_wallet`)
   - `description`: Mô tả RÕ khi nào GỌI, khi nào KHÔNG GỌI
   - `parameters`: JSON Schema cho parameters
   - `execute`: function reference
   - `requiresAuth`: true/false
   - `requiresConfirmation`: true/false

**Verify:** Server restart không lỗi

---

## Bước 4: Tạo UI Card (Chỉ Mode B)

Nếu chọn Mode A, bỏ qua Bước 4 và Bước 5.

Tạo file `client/src/components/ChatWidget/cards/{Name}Card.jsx`:

```jsx
import { IconName } from "lucide-react";

export default function {Name}Card({ data }) {
  if (!data) return null;

  return (
    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-2 w-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <IconName size={16} className="text-emerald-400" />
        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
          {Title}
        </span>
      </div>

      {/* Content */}
      <div className="space-y-2">
        {/* ... render data ... */}
      </div>
    </div>
  );
}
```

**Design rules:**
- Background: `bg-emerald-500/10 border border-emerald-500/20`
- Items: `bg-black/20 rounded-lg`
- Text: `text-white` (primary), `text-gray-400` (secondary)
- Icons: Lucide React only
- Không dùng inline styles

**Verify:** `cd client && npm run build` → exit 0

---

## Bước 5: Register Card trong ChatBubble (Chỉ Mode B)

Sửa `client/src/components/ChatWidget/ChatBubble.jsx`:

1. Import card component
2. Thêm vào `CARD_COMPONENTS` object:
   ```jsx
   const CARD_COMPONENTS = {
     // ... existing
     {cardType}: {Name}Card,  // cardType phải match tool's uiCard.cardType
   };
   ```

**Verify:** `cd client && npm run build` → exit 0

---

## Bước 6: Cập Nhật Skill Doc

Sửa `.agents/skills/ai-chat-system/SKILL.md`:

1. Thêm tool vào **File Map** (Backend table)
2. Nếu chọn Mode B, thêm card vào **File Map** (Frontend table)
3. Thêm test case vào **Test checklist**

---

## Bước 7: Verify End-to-End

```
□ Server khởi động không lỗi
□ node .agents/scripts/validate-tools.mjs → exit 0
□ npm run test:unit:server → tool/registry tests pass
□ Chat AI → hỏi câu trigger tool → nhận streaming response
□ Mode A → text hiển thị đúng khi không có uiCard
□ Mode B → npm run build --prefix client → exit 0 và UI Card hiển thị đúng data
□ Tool không gọi khi chưa đủ điều kiện
□ Tool write yêu cầu confirmation trước khi thực thi
```

---

## Anti-patterns

| ❌ SAI | ✅ ĐÚNG |
|--------|--------|
| Tool trả text dài không format | Dùng markdown (bold, list, links) |
| Tạo card cho mọi tool | Chỉ dùng Mode B khi structured UI tạo giá trị rõ ràng |
| Text-only vẫn trả `uiCard: null` theo thói quen | Trả `{ text }`; giữ `uiCard` là optional |
| cardType không match giữa BE và FE | Kiểm tra string match chính xác |
| Tool write không có confirmation | Set `requiresConfirmation: true` |
| Query `.find({})` không limit | Luôn có `.limit()` |
| Không handle null result | Luôn check empty trước khi process |
