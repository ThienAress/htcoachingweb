---
name: feature-spec
description: Workflow viết spec trước khi code. Use trước khi implement bất kỳ feature mới hoặc thay đổi lớn nào — đặc biệt khi liên quan đến Auth, Payment/Wallet, Mongoose schema, hoặc SEO routes.
---

# Feature Spec — HTCoachingWeb

> **"Code without a spec is guessing."** — Viết spec trước, code sau. Spec 2 dòng còn hơn không có spec.

---

## Khi nào DÙNG

- Feature mới chạm nhiều file hoặc nhiều module
- Thay đổi liên quan đến **Auth / CSRF / JWT / Payment / Wallet**
- Thay đổi **Mongoose schema** (ảnh hưởng controllers/services/routes)
- Thêm **route public mới** (ảnh hưởng SEO, sitemap)
- Task ước tính > 30 phút implement

## Khi nào KHÔNG dùng

- Fix bug đơn giản, 1-2 dòng
- Sửa typo, UI tweaks nhỏ
- Yêu cầu rõ ràng, self-contained, không có side effects

---

## Workflow — 4 Bước Có Gate

```
SPECIFY ──▶ PLAN ──▶ TASKS ──▶ IMPLEMENT
   │           │        │           │
   ▼           ▼        ▼           ▼
 User        User     User        User
 review      review   review      review
```

**Không chuyển bước tiếp khi bước hiện tại chưa được user xác nhận.**

---

## Bước 1: SPECIFY

Trước khi viết bất cứ gì, nêu rõ giả định:

```
ASSUMPTIONS I'M MAKING:
1. [giả định về yêu cầu]
2. [giả định về architecture]
3. [giả định về scope]
→ Confirm ngay hoặc tôi sẽ tiếp tục với những giả định này.
```

Sau đó viết **Spec Document** gồm 6 phần:

```markdown
# Spec: [Tên Feature]

## Objective
[Xây dựng gì, tại sao, user là ai, success trông như thế nào]

## Tech Stack liên quan
[Framework, key dependencies, versions nếu cần]

## Commands
[Build: `cd client && npm run build`]
[Dev: `npm run dev` tại root]

## Cấu trúc File bị ảnh hưởng
[Liệt kê files sẽ tạo mới hoặc sửa đổi]

## Code Style
[Pattern hiện tại cần follow — lazy loading, service layer, MVC]

## Testing Strategy
[Test gì, verify như thế nào sau khi xong]

## Boundaries
- Always: [run build, follow naming convention, validate input]
- Ask first: [schema changes, new dependencies, new public routes]
- Never: [expose credentials, disable CSRF/rate-limit, hardcode values]

## Success Criteria
[Điều kiện cụ thể, testable — biết task XONG khi nào]

## Open Questions
[Những gì chưa rõ, cần hỏi user trước khi code]
```

### Guard Rails đặc thù HTCoachingWeb

| Nếu feature liên quan đến... | Phải làm gì trước khi code |
|------------------------------|---------------------------|
| **Auth / CSRF / JWT** | Nêu rõ impact đến security flow, httpOnly cookies |
| **Payment / Wallet** | Nêu rõ impact đến transaction logic, idempotency |
| **Mongoose schema** | Liệt kê controllers/services/routes bị ảnh hưởng |
| **Route public mới** | Kiểm tra cần update `generate-sitemap.js` và `prerender.js` không |
| **Lazy-loaded page mới** | Đảm bảo route được thêm vào `App.jsx` đúng cách |

---

## Bước 2: PLAN

Với spec đã được approve, lập technical plan:

1. Xác định các component chính và dependency
2. Xác định thứ tự implement (cái gì phải làm trước)
3. Nêu risks và cách giảm thiểu
4. Xác định các bước verify checkpoint

---

## Bước 3: TASKS

Chia plan thành tasks nhỏ, mỗi task theo format:

```markdown
- [ ] Task: [Mô tả cụ thể]
  - Acceptance: [Điều kiện để coi task này là XONG]
  - Verify: [Cách confirm — build, test, manual check]
  - Files: [Những file sẽ bị chạm vào]
```

**Nguyên tắc:**
- Mỗi task hoàn thành được trong 1 session tập trung
- Mỗi task không chạm quá ~5 files
- Thứ tự theo dependency, không phải theo perceived importance

---

## Bước 4: IMPLEMENT

Thực thi từng task theo thứ tự. Sau mỗi task:
- Verify theo điều kiện đã định trong task
- Chạy `cd client && npm run build` nếu có thay đổi FE
- Báo cáo kết quả trước khi chuyển task tiếp

---

## Common Rationalizations

| AI nghĩ... | Thực tế... |
|------------|-----------|
| "Cái này đơn giản, không cần spec" | Spec đơn giản vẫn cần success criteria. 2 dòng spec cũng OK |
| "Tôi sẽ viết spec sau khi code" | Đó là documentation, không phải spec. Spec phải đến trước code |
| "Yêu cầu rõ ràng rồi, không cần spec" | Yêu cầu rõ vẫn có implicit assumptions. Spec surface những assumptions đó |
| "Spec làm mất thời gian" | 15 phút viết spec phòng được nhiều giờ rework |
