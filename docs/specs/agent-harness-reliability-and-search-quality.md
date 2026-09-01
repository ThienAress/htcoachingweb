# Agent Harness Reliability and Search Quality

## Objective

Biến các finding P1 từ audit Search/SDD/Hermes thành gate deterministic cho
HTCOACHINGWEB mà không thay đổi hành vi runtime frontend/backend. Sau thay đổi,
tài liệu bàn giao được quét PII, trạng thái plan và inventory có contract máy đọc,
requirement quan trọng có trace tới task/test, agent eval phủ các workflow critical
và Search có benchmark tiếng Việt trước khi chọn thư viện hoặc thuật toán mới.

## Requirements

### REQ-001 — Chặn PII trong tài liệu bàn giao

- Scanner chỉ đọc file tracked hoặc candidate tracked trong các vùng tài liệu đã
  cấu hình, gồm cả artifact machine-readable `.json`; không in lại giá trị PII
  trong output.
- Bắt tối thiểu email cá nhân, số điện thoại Việt Nam và absolute home/workspace
  path Windows/Linux/macOS, UNC, WSL, local `file://` và temp/workspace roots.
- Cho phép fixture/documentation placeholder được allowlist rõ ràng, không dùng
  baseline để che violation thật.

**Acceptance criteria**

- `AC-001`: Fixture có email, số điện thoại cá nhân hoặc absolute user path làm scanner exit khác 0.
- `AC-002`: Output chỉ nêu file, dòng và loại finding; không echo raw match.
- `AC-003`: Handoff tracked hiện hữu trong phạm vi được redact nhưng vẫn giữ ý nghĩa bàn giao.

### REQ-002 — Loại bỏ inventory và plan state dễ stale

- Inventory mutable được đếm từ repository bằng command deterministic thay vì
  hardcode trong reference guide.
- Trạng thái plan mới có lifecycle/verification/rollout enum machine-readable;
  historical free-form rows được giữ tương thích trong giai đoạn chuyển tiếp.
- Plan-state, traceability và mọi nested object dùng closed schema; validator fail
  khi có unknown field, ngày calendar không tồn tại, path alias không canonical,
  duplicate ID, plan không tồn tại hoặc generated inventory không còn khớp repository.

**Acceptance criteria**

- `AC-004`: Cùng một working tree sinh cùng inventory theo thứ tự ổn định.
- `AC-005`: Mutation status/plan ID/path không hợp lệ bị contract test chặn.
- `AC-006`: `project-guide` không còn khẳng định số test mutable như nguồn canonical.

### REQ-003 — Trace requirement tới task và test

- Task `MODERATE/COMPLEX` mới có manifest traceability riêng với requirement,
  acceptance criteria, task và verification/test liên quan.
- Gate kiểm mọi must-have acceptance criterion có ít nhất một task và một
  verification; path test được khai báo phải tồn tại hoặc được đánh dấu command-only.

**Acceptance criteria**

- `AC-007`: Manifest thiếu task hoặc verification cho một AC bắt buộc phải fail.
- `AC-008`: Manifest hợp lệ của Plan 077 pass và có thể đọc độc lập với conversation.

### REQ-004 — Đo chất lượng Search trước khi đổi production

- Benchmark đầu tiên tập trung Exercise Library với query tiếng Việt có/không dấu,
  typo, token thiếu, synonym/no-hit và filter nghiệp vụ.
- Baseline dùng implementation hiện tại; report Recall@5, Retrieved Precision@≤5, MRR,
  no-result/false-positive rate và latency mà không sửa ranking production.
- Dataset không chứa dữ liệu khách hàng hoặc nội dung production nhạy cảm.

**Acceptance criteria**

- `AC-009`: Benchmark chạy offline, deterministic và xuất JSON machine-readable.
- `AC-010`: Test chứng minh metric đúng trên fixture biết trước.
- `AC-011`: Baseline yếu vẫn được báo trung thực; không hạ threshold chỉ để gate xanh.

### REQ-005 — Mở rộng agent eval theo rủi ro

- Bổ sung positive/negative/adversarial scenarios cho các workflow critical chưa có
  corpus, ưu tiên spec, plan, impact, schema, review và QA.
- Corpus không chứa secret, PII hoặc absolute local path.

**Acceptance criteria**

- `AC-012`: Mỗi corpus mới pass contract hiện có và có ít nhất hai case trigger,
  hai case không trigger.
- `AC-013`: `agents:validate` báo inventory eval mới và không giảm coverage hiện hữu.

## Workflow Decisions

- PII scanner là gate riêng nhưng được nối vào CI security; không trộn khái niệm PII
  với credential secret.
- Machine-readable manifest là source cho automation; prose trong plan/index vẫn dành
  cho con người và được giữ backward compatible.
- Search benchmark là measurement harness, không phải lý do tự động thay Fuse.js,
  regex hoặc vector search.
- Không cho model tự sửa skill/memory, commit, push, deploy hoặc ghi production trong
  phạm vi này.
- Forward scanner bảo vệ snapshot/candidate mới; nó không xóa PII đã tồn tại trong
  Git history. History rewrite/force-push cần privacy incident, release freeze và
  authorization riêng.

## Boundaries

- Không sửa `client/` hoặc `server/` runtime behavior.
- Không cài dependency mới.
- Không scan nội dung `.env`, database dump hoặc external service.
- Không rewrite Git history hoặc force-push remote refs.
- Không chạy migration, seed, deploy, email hoặc mutation dữ liệu thật.
- Không sửa năm file observability/production-monitoring đang thuộc release hotfix.

## Success Criteria

- Tất cả `AC-001` đến `AC-013` có task và verification trong manifest Plan 077.
- Focused contract tests, Search benchmark tests, agent eval tests,
  `agents:validate`, security scans và `git diff --check` pass.
- Không có thay đổi product/runtime hoặc file ngoài scope do task tạo ra.

## Out of Scope

- Thay thuật toán Search production hoặc thêm Fuse.js/search service.
- Full historical rewrite toàn bộ plan prose.
- Autonomous coding state machine, worktree lease, checkpoint/resume và QA evidence
  JSON; các hạng mục P2 này chỉ bắt đầu sau khi P1 gate ổn định.
