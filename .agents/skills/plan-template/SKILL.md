---
name: plan-template
description: Viết và lưu implementation plan tự chứa vào đúng taxonomy trong docs/. Dùng khi user yêu cầu plan/kế hoạch mới, kế hoạch chỉnh sửa code, refactor, thay đổi kiến trúc, feature nhiều file hoặc khi Codex cần lập kế hoạch thực thi; bổ sung cho feature-spec ở giai đoạn thực thi.
---

# Plan Template — HTCoachingWeb

> Mỗi plan được viết để **AI (hoặc dev) chưa biết gì về context trước đó** có thể thực thi thành công.
> 3 thuộc tính key: **Self-contained** (mọi info inline), **Verification gates** (mỗi bước có verify command), **Hard boundaries** (STOP conditions thay vì improvise).

---

## Khi Nào Dùng

- Refactor file lớn (>300 dòng, nhiều dependencies)
- Thay đổi architecture (auth flow, payment system, data model)
- Feature cần nhiều behavior slice hoặc verification gate phụ thuộc nhau
- Task cần phối hợp FE + BE + DB changes

## Khi Nào KHÔNG Dùng (feature-spec đủ)

- Feature nhỏ-vừa, 1-3 files
- Fix bug rõ ràng
- UI tweaks, styling changes

Các task trên có thể thực hiện trực tiếp mà không cần tạo plan. Tuy nhiên, **một khi user yêu cầu
plan/kế hoạch hoặc Codex đã quyết định lập plan nhiều bước**, vẫn phải lưu plan theo quy tắc bên
dưới; có thể rút gọn nội dung cho tương xứng với độ phức tạp, nhưng không được chỉ giữ plan trong
conversation hoặc tool state.

---

## Bắt Buộc Lưu Plan Vào `docs/`

Trước khi viết hoặc đặt file plan:

1. Đọc `docs/README.md` để dùng taxonomy hiện tại; không suy đoán cấu trúc từ memory.
2. Tìm tài liệu cùng phạm vi. Cập nhật nguồn canonical hiện có thay vì tạo bản trùng lặp.
3. Chọn thư mục theo **mục đích của tài liệu**, không theo file code hoặc phase đang tiện làm:

| Loại tài liệu | Thư mục bắt buộc |
|---|---|
| Implementation, refactor, migration hoặc code-change plan | `docs/plans/` |
| Product/business behavior và acceptance criteria | `docs/specs/` |
| Phase report, phase inventory hoặc phase-specific runbook | `docs/phases/phase-XX/` |
| Audit findings hoặc cross-layer audit | `docs/audits/` |
| Release/deploy/rollback/incident runbook | `docs/operations/` |
| Quyết định kiến trúc dùng lâu dài | `docs/architecture/` |
| Báo cáo kỹ thuật không thuộc riêng một phase | `docs/reports/` |
| Bàn giao context giữa các đợt làm việc | `docs/handoffs/` |

4. Không tạo file mới trực tiếp trong root `docs/`; ngoại lệ duy nhất là `docs/README.md`.
5. Implementation plan dùng số kế tiếp và slug kebab-case:
   `docs/plans/NNN-<imperative-kebab-case-title>.md`. Nếu là release con của một plan đã có,
   dùng suffix `NNNa`, `NNNb`, ... theo convention hiện tại.
6. Tạo/cập nhật row tương ứng trong `docs/plans/README.md` cùng lúc với file plan. Với thư mục
   khác, cập nhật index gần nhất nếu index đó tồn tại.
7. Với plan mới sau `legacyCutoff` trong `docs/plans/plan-state.json`, thêm machine state gồm
   `complexity`, `lifecycle`, `verification`, `rollout`, `owner`, `updatedAt`; prose status không phải source cho automation.
8. Task `MODERATE/COMPLEX` tạo `docs/plans/traceability/<plan-id>.json` để map requirement/AC
   tới task và verification. Mọi must-have AC phải có ít nhất một task và một test/command.
9. Tạo file plan **trước khi bắt đầu implementation**. Trong lúc thực thi, cập nhật status,
   quyết định lệch plan và verification thực tế để file vẫn là nguồn bàn giao đúng.

Nếu taxonomy hiện tại chưa có chỗ phù hợp, cập nhật `docs/README.md` với category có ranh giới rõ
rồi mới tạo thư mục. Không tự tạo thư mục mơ hồ như `docs/misc/`, `docs/new/` hoặc `docs/temp/`.

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
- **Complexity**: SIMPLE | MODERATE | COMPLEX
- **Effort**: S (giờ) | M (~1 ngày) | L (nhiều ngày)
- **Risk**: LOW | MED | HIGH
- **Depends on**: plan khác hoặc "none"
- **Category**: bug | security | perf | tests | tech-debt | migration | dx
- **Planned at**: <ngày viết plan>
- **Lifecycle**: PLANNED | IN PROGRESS | DONE | BLOCKED | REJECTED
- **Verification**: NONE | FOCUSED | LOCAL FULL | STAGING | PRODUCTION
- **Rollout**: NOT APPLICABLE | NOT STARTED | PENDING | LIVE
- **Owner**: <stable owner/task id>
- **Updated at**: <YYYY-MM-DD>

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

### Step 1: <imperative title — behavior observable hoàn chỉnh>

Mô tả chính xác. Reference exact files/symbols. Include target code
shape khi nó load-bearing (pattern cần produce, không cần mọi dòng).

**Behavior**: <scenario end-to-end có thể demo/verify sau step này>

**Blast radius**: <files/layers cần chạm và lý do>

**Depends on**: <step/blocker trước đó, hoặc "none">

**Verify**: `cd client && npm run build` → exit 0, no errors

### Step 2: ...

(Mặc định mỗi step là một vertical tracer bullet: hoàn tất một behavior qua các layer cần thiết,
vừa một session tập trung và verify độc lập. Không chia ngang thành "schema", "API", "UI" nếu
từng step chưa tạo ra behavior kiểm chứng được. Số file là tín hiệu blast radius, không phải quota;
step chạm nhiều file phải nêu impact và verification. Thứ tự theo dependency và giữ codebase chạy
được sau mỗi step.)

**Task right-sizing:** Một step là đơn vị nhỏ nhất có test/verification cycle riêng và đủ độc lập để reviewer có thể
reject step đó nhưng vẫn approve step bên cạnh. Gộp scaffolding/config/docs vào behavior cần chúng; không tách task chỉ
để tạo file hoặc commit nhỏ.

Với wide mechanical refactor không thể tạo vertical behavior slice tự nhiên, dùng **expand-contract**:
thêm shape/path mới tương thích → chuyển consumers theo batch có verify → xóa shape/path cũ chỉ khi
mọi consumer đã migrate. Ghi rõ compatibility window và rollback point cho từng batch.

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
- [ ] `docs/plans/README.md` status row updated (nếu có)

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

## Index File: `docs/plans/README.md`

Viết 1 lần sau khi tạo plans, update khi execute:

```markdown
# Implementation Plans — HTCoachingWeb

Generated on <ngày>. Execute theo thứ tự dưới đây.

## Execution Order & Status

| Plan | Title | Priority | Effort | Depends on | Lifecycle | Verification | Rollout |
|------|-------|----------|--------|------------|-----------|--------------|---------|
| 001  | ...   | P1       | S      | —          | PLANNED   | NONE         | NOT STARTED |
| 002  | ...   | P1       | M      | 001        | PLANNED   | NONE         | NOT STARTED |

Machine state canonical nằm trong `docs/plans/plan-state.json`:

- `complexity`: simple | moderate | complex
- `lifecycle`: planned | in_progress | done | blocked | rejected
- `verification`: none | focused | local_full | staging | production
- `rollout`: not_applicable | not_started | pending | live

Các row historical trước `legacyCutoff` có thể giữ status prose để tương thích, nhưng automation
không được suy luận state từ chuỗi prose đó.

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
- [ ] Mỗi step tạo một behavior end-to-end có thể demo/verify, hoặc ghi rõ vì sao phải dùng expand-contract?
- [ ] Số file được dùng để đánh giá blast radius, không làm lý do chia task thành các horizontal layer?
- [ ] STOP conditions cụ thể cho plan này, KHÔNG boilerplate?
- [ ] Đọc chỉ "Why this matters" + "Done criteria" hiểu được đang approve gì?
- [ ] Không có secret values — chỉ locations và credential types?
- [ ] Đã đọc lại spec/request và map từng requirement vào ít nhất một step hoặc ghi rõ out-of-scope?
- [ ] Đã quét placeholder `TBD`, `TODO marker`, `implement later`, `similar to` và chỉ dẫn mơ hồ như “handle edge cases”?
- [ ] Tên symbol, payload, route và command có nhất quán giữa các step?
- [ ] Mỗi task boundary có deliverable/verification riêng thay vì chỉ chia theo technical layer?
- [ ] Machine state đã cập nhật và dùng đúng enum? Với task `MODERATE/COMPLEX`, mọi must-have AC đã có task + verification trong traceability manifest?
