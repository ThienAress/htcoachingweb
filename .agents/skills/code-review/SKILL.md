---
name: code-review
description: Review code hoặc working-tree diff của HTCOACHINGWEB theo ba axis Standards, Spec/Contract và Security/Operations. Dùng khi user yêu cầu review, trước bàn giao thay đổi phức tạp, hoặc khi implementation cần kiểm tra độc lập với QA.
---

# Code Review — HTCOACHINGWEB

Review là read-only trừ khi user yêu cầu sửa. Mọi finding phải có evidence `file:line`, impact cụ thể và mức độ ưu tiên.

## 1. Khóa review surface

- Đọc `AGENTS.md`, Git status và instruction gần file thay đổi.
- Nếu user cho fixed point, xác minh bằng `git rev-parse` và dùng three-dot diff từ merge base.
- Nếu review working tree, đọc tracked diff, staged diff và untracked in-scope; không giả định `HEAD` chứa thay đổi.
- Ghi rõ files/commits/spec nằm trong và ngoài scope trước khi dispatch reviewer.

## 2. Xác định sources

- **Standards**: `AGENTS.md`, `.agents/rules/`, skill domain bắt buộc và exemplar trong code.
- **Spec/Contract**: request, `docs/specs/`, plan/issue, API/schema contracts và test expectations.
- **Security/Operations**: bật khi diff chạm auth, CSRF, JWT, payment, wallet, PII/health data, upload,
  ownership, external provider, migration, logging, production/release hoặc trust boundary mới.

Nếu thiếu spec, vẫn review Standards; ghi `Spec/Contract: NOT ASSESSABLE` thay vì tự phát minh requirement.

## 3. Review ba axis

### Standards

Tìm violation documented, regression, bug, error-handling gap, performance issue và design smell gây
shotgun surgery/low locality. Không report style mà tooling đã enforce trừ khi tool đang fail.

### Spec/Contract

Đối chiếu acceptance criteria: missing/partial behavior, scope creep, backward compatibility,
loading/error/empty/disabled state, response/error contract và test gap có thể làm bug lọt.

### Security/Operations

Trace `entry point → validation → authorization/ownership → side effect/sink`. Kiểm secret/PII logging,
CSRF/rate limit, provider outage, observability, migration/backfill/rollback và release evidence.

Với task `COMPLEX` và môi trường cho phép, dùng reviewer độc lập theo task-orchestration rule;
root reviewer vẫn đọc diff và chịu trách nhiệm kết luận.

## 4. Vet và tổng hợp

- Xác minh reachability; loại false positive và finding chỉ dựa trên suy đoán.
- Deduplicate giữa các axis nhưng giữ tag nguồn.
- Xếp `BLOCK/HIGH/MED/LOW`; nêu confidence khi evidence chưa đầy đủ.
- Không hạ severity chỉ vì test pass nếu test không cover failure mode.

## Output

```markdown
## Findings
| Severity | Axis | Evidence | Impact | Recommended action |
|---|---|---|---|---|

## Coverage
- Reviewed: ...
- Not assessed: ...
- Verification evidence: ...

## Verdict
PASS | PASS WITH WARNINGS | CHANGES REQUIRED | NOT ASSESSABLE
```

Nếu không có finding, nói rõ không phát hiện vấn đề và nêu residual test/coverage gap; không tạo finding giả.
