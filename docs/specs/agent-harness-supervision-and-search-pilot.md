# Agent Harness Supervision and Search Pilot

## Objective

Triển khai P2 đã được duyệt từ phân tích Search/SDD/Hermes dưới dạng các contract
deterministic, có giám sát và không thay đổi product runtime. Kết quả cần giúp agent
tạo context đúng trước khi code, tái sử dụng QA evidence máy đọc, tránh hai agent
đụng cùng file, checkpoint/resume an toàn và đo một Search candidate tốt hơn baseline.

## Assumptions

- Plan 077 là nền P1; P2 chỉ mở rộng contract, không hạ hoặc bypass gate P1.
- `context:build`, lease và run-state chỉ đọc/đánh giá; không tự sửa file, chạy lệnh
  tùy ý, commit, push, deploy hoặc gọi production.
- Search pilot dùng fixture synthetic hiện có và không được import vào `client/` hay
  `server/` trong plan này.
- QA evidence JSON xác minh schema/fingerprint của evidence đã có; nó không tự chạy
  build/test, không biến `SKIP`/`BLOCKED` thành `PASS` và không tự chứng minh execution
  provenance hay cấp quyền release.

## Requirements

### REQ-001 — Build context manifest trước khi code

- CLI nhận một plan ID sau legacy cutoff, đọc machine plan state, trace manifest,
  spec/plan và Git metadata cần thiết rồi xuất JSON bounded.
- Output chỉ chứa repository-relative path, hash/count/metadata và ordered read set;
  không dump raw source, diff, secret, PII hay absolute local path.
- Cùng repository state và input phải sinh cùng stable projection.

**Acceptance criteria**

- `AC-001`: Plan hợp lệ sinh context JSON có spec, plan, tasks, requirements, verification paths và fingerprint theo thứ tự ổn định.
- `AC-002`: ID/path traversal, artifact thiếu hoặc path ngoài repository làm command fail closed mà không in raw content.

### REQ-002 — Chuẩn hóa QA evidence JSON có expiry

- Contract dùng schema đóng, status/exit code nhất quán, command ID không trùng và
  fingerprint đủ phát hiện thay đổi liên quan trong working tree.
- Chỉ mode `full` với release build, client/server tests đạt yêu cầu và E2E
  `PASS` hoặc `SKIP` có reason/risk mới được ghi `releaseEligible: true`.
- Khi E2E là `SKIP`, top-level result phải là `PASS_WITH_RISK`, không được đổi
  thành `PASS`; `releaseEligible` vẫn giữ residual risk để release gate quyết định.
- Evidence stale, unknown field, raw secret/PII/absolute path hoặc nâng
  `quick/client/server` thành release-eligible evidence phải fail.
- Validator phải gọi artifact là `SELF_ATTESTED` và trả `releaseAuthorized: false`;
  chỉ trusted CI/runner artifact có provenance riêng mới có thể làm attestation.

**Acceptance criteria**

- `AC-003`: Validator nhận evidence hợp lệ cho đúng fingerprint và reject fingerprint stale hoặc schema/status/exit không nhất quán.
- `AC-004`: Release eligibility chỉ đúng cho mode full và đủ command bắt buộc; `SKIP` phải có reason cùng residual risk, còn validator không cấp release authorization.
- `AC-005`: Skill `qa` trỏ tới machine contract, nêu rõ provenance self-attested và vẫn là workflow duy nhất sở hữu việc chạy build/test.

### REQ-003 — Phát hiện worktree lease conflict trước khi giao agent

- Lease registry dùng exact repository-relative path hoặc directory scope, owner,
  lifecycle và expiry; path ancestor/descendant hoặc khác casing được coi là overlap.
- Evaluator chỉ đọc registry và in quyết định; không tự acquire/release hoặc ghi file.
- Decision chứa fingerprint path-hidden của registry; current decision phải được đánh
  giá đúng thời điểm supervisor validate, không được replay decision cũ.
- Lease hết hạn bị bỏ qua, nhưng malformed/traversal/drive-relative/duplicate lease
  fail closed; ancestor overlap vẫn conflict nếu caller gắn nhãn `kind` sai.

**Acceptance criteria**

- `AC-006`: Hai lease active overlap hoặc proposal đụng lease active bị reject với owner/lease ID, không lộ absolute path.
- `AC-007`: Scope không overlap và lease hết hạn cho kết quả deterministic `available`; registry/input không bị mutate.

### REQ-004 — Khóa supervised autonomy ở read-only state machine

- Run manifest có state/transition log, context fingerprint, lease decision và
  allowlisted action gắn state `running`. Resume chỉ hợp lệ trên cùng fingerprint.
- Pilot chỉ cho `read`, `search`, `test`, `report`; mọi Git write, external write,
  deploy, production read/write hoặc command executor tùy ý đều bị cấm.
- State machine là validator/checkpoint contract, không phải autonomous executor.
- Current lease được recompute từ registry/proposal. Lease evidence lịch sử trong
  checkpoint/resume chỉ là record tự khai, không phải distributed lock hay trusted
  historical attestation.

**Acceptance criteria**

- `AC-008`: Transition sai thứ tự, action ngoài allowlist hoặc checkpoint thiếu context/lease evidence phải fail.
- `AC-009`: Resume với fingerprint drift hoặc lease conflict phải fail; valid read-only run pass không ghi file.
- `AC-010`: Public API của module không có seam thực thi shell, Git write, deploy hoặc production mutation.

### REQ-005 — Đo Search candidate offline trước mọi rollout

- Candidate dùng pure JavaScript, fixture synthetic và baseline metrics hiện có;
  không thêm dependency hoặc sửa production filter.
- Report so sánh baseline/pilot cho Recall@5, Retrieved Precision@≤5, MRR,
  relevant-query no-result, expected no-result accuracy và false-positive rate;
  kết quả deterministic, latency vẫn report-only.
- Pilot phải xử lý ít nhất `đ → d`, token rời, typo nhỏ và synonym đã nêu trong corpus.

**Acceptance criteria**

- `AC-011`: Pilot đạt Recall@5, Retrieved Precision@≤5 và MRR tối thiểu `0.90`,
  relevant-query no-result không quá `0.10`, expected no-result accuracy bằng
  `1.00` và false-positive rate bằng `0.00` trên fixture v2 có hard-negative cùng
  truy vấn cross-field.
- `AC-012`: CLI xuất JSON baseline-vs-pilot ổn định và test chứng minh không import/sửa product runtime.

## Boundaries

- Không sửa `client/`, `server/`, `e2e/`, schema, dependency hoặc dữ liệu thật.
- Không chạy build/test product ngoài QA phù hợp; P2 chỉ chạy focused harness tests.
- Không tạo daemon, scheduler, background agent, auto-commit hoặc auto-deploy.
- Không persist raw prompt/source/diff trong context hoặc evidence artifact.
- Không sửa năm file observability/production-monitoring thuộc hotfix đã khóa.

## Success Criteria

- `AC-001` đến `AC-012` có trace tới task và focused verification.
- Mọi CLI mặc định read-only, bounded, deterministic và fail closed.
- Search pilot có improvement report nhưng production behavior không đổi.
- Agent validation, P2 focused tests, security scans và diff hygiene pass; blocker
  do Git index/landing được báo trung thực, không tự sửa Git state.

## Out of Scope

- Tự động chọn task, tự viết code không giám sát hoặc tự retry vô hạn.
- Vector database, hosted search, Fuse.js hoặc rollout Search UI/API.
- Tạo release QA evidence thật cho dirty worktree hiện tại.
- Multi-host/distributed lease service và persistence production.
