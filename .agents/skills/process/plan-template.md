---
name: plan-template
description: Template viết implementation plan chi tiết, tự chứa. Use khi cần viết plan cho task phức tạp (refactor file lớn, thay đổi architecture, multi-file feature). Bổ sung cho feature-spec skill — feature-spec cho SPECIFY, plan-template cho EXECUTE.
---

# Plan Template — HTCoachingWeb

> Mỗi plan được viết để **AI (hoặc dev) chưa biết gì về context trước đó** có thể thực thi thành công.
> 3 thuộc tính key: **Self-contained** (mọi info inline), **Verification gates** (mỗi bước có verify command), **Hard boundaries** (STOP conditions thay vì improvise).

---

## Khi Nào Dùng

- Refactor file lớn (>300 dòng, nhiều dependencies)
- Thay đổi architecture (auth flow, payment system, data model)
- Multi-file feature chạm >5 files
- Task cần phối hợp FE + BE + DB changes

## Khi Nào KHÔNG Dùng (feature-spec đủ)

- Feature nhỏ-vừa, 1-3 files
- Fix bug rõ ràng
- UI tweaks, styling changes

---

## Template

```markdown
# Plan NNN: <Imperative title — cái gì sẽ đúng sau khi plan này xong>

> **Hướng dẫn thực thi**: Follow plan step by step. Chạy mọi verification command
> và confirm expected result trước khi chuyển step. Nếu gặp STOP condition → dừng
> và báo cáo, KHÔNG improvise.
>
> **Drift check (chạy đầu tiên)**: Kiểm tra các file in-scope có thay đổi kể từ
> khi plan được viết không. Nếu code không khớp "Current state" excerpts → STOP.

## Status

- **Priority**: P1 | P2 | P3
- **Effort**: S (giờ) | M (~1 ngày) | L (nhiều ngày)
- **Risk**: LOW | MED | HIGH
- **Depends on**: plan khác hoặc "none"
- **Category**: bug | security | perf | tests | tech-debt | migration | dx
- **Planned at**: <ngày viết plan>

## Why This Matters

2–5 câu. Vấn đề là gì, chi phí cụ thể, cải thiện gì khi xong.
Viết để người đọc (hoặc AI) hiểu **intent** — intent cho phép
judgment call đúng khi chi tiết bị lệch.

## Current State

Facts cần thiết, inline — KHÔNG "as discussed" hay "see audit":

- Các file liên quan, mỗi file 1 dòng mô tả vai trò:
  - `server/src/routes/order.routes.js` — order endpoints; chứa N+1 (dòng 130–160)
- Excerpts code hiện tại (ngắn, có `file:line` markers) — đủ để confirm đang nhìn đúng chỗ
- Conventions phải follow, với pointer đến exemplar file:
  "Error handling dùng try/catch + `res.status(500).json({ message })` — xem `user.controller.js:40-60`. Match nó."

## Commands You Will Need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Install   | `cd client && npm install`       | exit 0              |
| Build     | `cd client && npm run build`     | exit 0, no errors   |
| Dev FE    | `cd client && npm run dev`       | Vite dev server up  |
| Dev BE    | `cd server && npm run dev`       | Express server up   |

(Commands chính xác từ repo — verified, không đoán.)

## Scope

**In scope** (CHỈ sửa những file này):
- `server/src/routes/order.routes.js`
- `server/src/controllers/order.controller.js`
- `client/src/services/order.service.js`

**Out of scope** (KHÔNG chạm, dù trông liên quan):
- `server/server.js` — route registration đã đúng, không cần sửa
- Bất kỳ file nào trong `client/src/pages/admin/` — không liên quan

## Steps

### Step 1: <imperative title>

Mô tả chính xác. Reference exact files/symbols. Include target code
shape khi nó load-bearing (pattern cần produce, không cần mọi dòng).

**Verify**: `cd client && npm run build` → exit 0, no errors

### Step 2: ...

(Mỗi step đủ nhỏ để verify độc lập. Thứ tự sao cho codebase
không bao giờ broken giữa các steps — VD: thêm path mới → chuyển callers → xóa path cũ.)

## Test Plan

- Tests mới cần viết, trong file nào, cover cases nào (liệt kê: happy path, edge case cụ thể)
- Dùng test nào làm structural pattern: "model after `__tests__/auth.controller.test.js`"
- Verify: `npm test` → all pass, including N new tests

> ⚠️ Nếu project chưa có tests (hiện tại), ghi:
> "Project chưa có test infrastructure. Verify bằng: `cd client && npm run build` + manual check."

## Done Criteria

Machine-checkable. TẤT CẢ phải đạt:

- [ ] `cd client && npm run build` exits 0
- [ ] Feature hoạt động đúng (mô tả cụ thể scenario verify)
- [ ] Không có file ngoài in-scope list bị modified
- [ ] Không có `console.log()` debug tạm thời còn sót
- [ ] `plans/README.md` status row updated (nếu có)

## STOP Conditions

Dừng và báo cáo (KHÔNG improvise) nếu:

- Code tại locations trong "Current state" không khớp excerpts (codebase đã thay đổi)
- Verification fail 2 lần sau khi đã cố fix
- Fix yêu cầu chạm file ngoài in-scope list
- Phát hiện assumption "<key assumption>" là sai

## Maintenance Notes

Cho người/AI maintain code sau khi change lands:

- Thay đổi nào trong tương lai sẽ interact với code này
- Reviewer nên scrutinize gì trong PR
- Follow-up nào explicitly deferred khỏi plan này (và tại sao)
```

---

## Index File: `plans/README.md`

Viết 1 lần sau khi tạo plans, update khi execute:

```markdown
# Implementation Plans — HTCoachingWeb

Generated on <ngày>. Execute theo thứ tự dưới đây.

## Execution Order & Status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 001  | ...   | P1       | S      | —          | TODO   |
| 002  | ...   | P1       | M      | 001        | TODO   |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (+ lý do 1 dòng) | REJECTED (+ lý do)

## Dependency Notes

- 002 requires 001 because <reason>.

## Findings Considered and Rejected

- <finding>: không đáng làm vì <1 dòng>. (Để không re-audit.)
```

---

## Quality Bar — Check Trước Khi Hoàn Thành Plan

- [ ] AI/dev chưa biết gì có thể execute plan chỉ với file plan + repo? Nếu step nào cần knowledge từ conversation → inline knowledge đó.
- [ ] Mọi verification là command + expected result, KHÔNG phải judgment ("make sure it works")?
- [ ] Mọi step nêu exact files và symbols, KHÔNG "the relevant module"?
- [ ] STOP conditions cụ thể cho plan này, KHÔNG boilerplate?
- [ ] Đọc chỉ "Why this matters" + "Done criteria" hiểu được đang approve gì?
- [ ] Không có secret values — chỉ locations và credential types?
