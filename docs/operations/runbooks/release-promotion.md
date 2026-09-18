# Release promotion và live staging acceptance

Scope: CI → staging deploy identity → live acceptance → production approval →
post-deploy observation. Canonical safety policy:
`.agents/rules/workflow/release-promotion.md`.

## 1. Required protected configuration

GitHub environments:

- `staging-live-acceptance`: chỉ chứa staging write credentials.
- `production-approval`: bật required reviewer; gate không có production secret
  hay mutation.
- `production-observation`: chỉ chứa read-only provider API credentials dùng để
  xác minh deploy identity.

Required secrets/IDs:

- Staging: `STAGING_MONGO_URI`, `STAGING_JWT_SECRET`, `STAGING_ADMIN_EMAIL`,
  `NETLIFY_STAGING_SITE_ID`, `RENDER_STAGING_SERVICE_ID`.
- Provider read APIs: `NETLIFY_AUTH_TOKEN`, `RENDER_API_KEY`.
- Production observation: `NETLIFY_PRODUCTION_SITE_ID`,
  `RENDER_PRODUCTION_SERVICE_ID`.

Không in secret trong log/artifact. Provider token chỉ gọi API read-only. Luồng
deploy identity gọi GET deploy/service detail; current-instances chỉ được gọi khi
một global-topology gate riêng yêu cầu rõ.
Theo API chính thức, Netlify deploy detail trả deploy state/commit reference và
Render retrieve-deploy trả deploy detail; verifier yêu cầu exact ID, SHA và
ready/live. Helper topology chỉ fail-closed khi một global-topology gate riêng yêu
cầu output; không được suy topology từ CPU metrics, plan limit hoặc `null`. Riêng
AC-009 không dùng instance inventory: nó reverify deploy identity trước/sau và dùng
request-cohort proof. Trong certified metrics window, bảy chat attempts cùng hai
admin Knowledge Base searches tạo metrics phải có receipt
`issued → admitted → settled` của runner/backend, tất cả cùng boot UUID/exact SHA với hai metrics
snapshots. Proof này chỉ quy thuộc counters của AC-009; không chứng nhận topology
toàn service hoặc traffic khác.

Sau khi tạo fixture nhưng trước certified window, runner chạy `pre-cohort readiness`
như một non-certifying barrier có hard deadline. Mỗi attempt gồm exact root và
variant search không capability/receipt; cả hai phải thấy đúng fixture, có zero
fallback delta và cùng boot UUID/exact SHA. Snapshot `after` của attempt thành công
được reuse nguyên trạng làm `metrics-before`; exact-nine cohort chỉ bắt đầu sau
baseline đó. Timeout, restart, runtime/SHA drift hoặc snapshot inconclusive đều
fail closed. Readiness không tạo release claim và không thuộc request inventory.

## 2. Staging live acceptance

Trigger `.github/workflows/staging-acceptance.yml` sau khi cả Netlify và Render
staging đã deploy xong. Workflow hỗ trợ:

- manual `workflow_dispatch`; hoặc
- `repository_dispatch` type `staging-deployed` từ deploy completion hook.

Payload/inputs bắt buộc: exact release SHA, successful CI run URL, hai staging
deploy IDs và hai production known-good rollback deploy IDs. Workflow sẽ:

1. checkout exact SHA và xác minh CI run cùng SHA đã success;
2. dùng provider GET API xác minh deploy IDs/SHA/status;
3. chạy `acceptance:staging` với exact database lock;
4. chạy `acceptance:staging:ai` bằng browser live và capability request-scoped chỉ
   hoạt động trên staging; positive KB/provider lane không mock response;
5. luôn cleanup cả hai acceptance lane và yêu cầu từng report có residue `0`;
6. xác minh lại exact deploy IDs/SHA sau live AI smoke;
7. chạy current backup + off-device recovery gates;
8. tạo artifact `release-candidate-<run_id>`.

AC-009 raw evidence schema v3 và release-candidate schema v3 phải giữ inventory
request/receipt đóng, outcome terminal, boot UUID fingerprint và exact SHA đủ để
validator tự recompute correspondence/delta. Mỗi provider-failure receipt phải
`settledAt <= admittedAt` của Retry/Edit recovery tương ứng. Artifact v1/v2 lịch sử không được tự
nâng cấp thành request-bound proof. Missing receipt, restart, runtime mismatch,
auth/CSRF retry ngoài inventory hoặc cleanup khi mutation còn chưa settled đều FAIL.
Raw evidence v3 còn giữ snapshot `catalogReadiness` allowlisted; validator chỉ chấp
nhận khi Exercise/Food/allergen/fresh-price coverage đạt gate. Candidate schema v3
không đổi; `pre-cohort readiness` không thêm field/JTI/receipt. Counter tuyệt đối tại
`metrics-before` có thể gồm fallback từ attempt readiness trước đó, nhưng delta
trong exact-nine window bắt buộc bằng `0`.

Trước KB fixture POST, runner ghi durable `fixture_create` journal v2 ở trạng thái
`pending`, bind exact run/SHA/synthetic admin/request ID và canonical payload digest.
Chỉ response `201` đã validate published/reviewed/embedding-ready mới được CAS sang
`terminal/created`; exact `400 / KNOWLEDGE_QUERY_SENSITIVE` có matching request ID
mới được CAS sang `terminal/rejected`. Timeout, 5xx, malformed response,
request-ID mismatch và mọi rejection khác vẫn là unknown. Journal này không phải
request receipt thứ mười và không làm tăng counter cohort. Cleanup giữ journal cùng
run tombstone cho tới sau khi xóa và verify toàn bộ synthetic data; nếu journal nói
`rejected` nhưng exact KB entry tồn tại/xuất hiện muộn thì giữ nguyên evidence và fail
closed. Capability receipt chỉ được xóa atomically khi còn `issued` hoặc `settled`,
không bao giờ xóa `admitted`. Journal v1 legacy `pending` chỉ dùng ngoại lệ manual
được giới hạn tại đoạn recovery bên dưới; không được tự đổi thành `settled/created`.

AC-009 không mở `answerTrace` qua public API. Runner đọc projection tối thiểu của
đúng synthetic actor/conversation trực tiếp từ staging MongoDB rồi xóa theo exact
IDs. Các lane Stop, A→B và provider-boundary failure dùng capability ký ngắn hạn,
bind exact SHA/run/actor/request/payload và one-time claim; không đổi Gemini key,
provider/model, auth, CSRF hoặc quota. Artifact phải ghi rõ failure được inject ở
provider boundary, không gọi đó là Gemini outage thật, và không chứa raw prompt,
assistant output, token, cookie, URI database hoặc provider response.

Render staging phải bật `STAGING_AI_ACCEPTANCE_ENABLED=true` cho đúng deploy được
nghiệm thu. Biến này mặc định fail-closed khi thiếu; production luôn phải thiếu hoặc
`false`. Nếu flag, database/origin/SHA/actor binding không đúng, workflow dừng trước
provider và không được bỏ qua lane AI.

Nếu workflow bị kill cứng trước `finally`, không chạy lại mù. Dùng cùng run ID
trong `staging-ai-recovery-intent.json` được ghi trước khi connect/mutation (và log
toàn bộ closed schema không chứa secret) để kiểm tra residue, rồi dọn theo IDs/marker đã đăng ký; không
dùng query rộng. Chỉ rerun sau khi cleanup verifier trả 0. Chạy thủ công, trong
đúng môi trường staging và chỉ khi SHA của deploy vẫn khớp intent:

Nếu runner mất file trước bước upload artifact, mở log của step AI acceptance và
copy nguyên một dòng JSON bắt đầu bằng
`{"schemaVersion":1,"kind":"staging-ai-chat-recovery-intent"` vào
`staging-ai-recovery-intent.json`. Dòng phải có đúng sáu field
`schemaVersion`, `kind`, `releaseSha`, `runId`, `marker`, `createdAt`; không thêm,
đổi hoặc suy giá trị từ run khác. Recovery CLI sẽ kiểm closed schema và exact SHA
trước mọi mutation.

```powershell
$env:CONFIRM_STAGING_AI_ACCEPTANCE_RECOVERY = "yes"
$env:STAGING_AI_ACCEPTANCE_RECOVERY_INTENT = "../artifacts/staging-ai-recovery-intent.json"
$env:STAGING_AI_ACCEPTANCE_RECOVERY_REPORT_OUTPUT = "../artifacts/staging-ai-recovery-report.json"
npm run recover:acceptance:staging:ai --prefix server
```

CLI fail-closed nếu `APP_ENV`, database `htcoaching_staging`, hai origin được phê
duyệt, SHA/commit hoặc intent schema v1 không khớp. Nó tạo tombstone revoke trước,
chờ conservative unknown-outcome window, inventory exact run, cleanup trong khi
vẫn giữ tombstone, rồi chờ ngắn và inventory/verify lại trước khi gỡ tombstone.
Receipt chỉ được xóa sau expiry exact; report path có thể tái dùng duy nhất khi
artifact hiện có là closed, verified report của đúng SHA/run.
Nếu hết thời gian chờ, code `STAGING_AI_RECOVERY_ADMITTED_UNKNOWN` là manual blocker:
giữ nguyên tombstone và toàn bộ fixture, không rerun acceptance và không tự xóa hay
đánh dấu settled. Điều tra deploy/backend settlement, rồi chạy lại chính recovery
intent; chỉ tiếp tục workflow sau report `verified: true`, `residue: 0`.
Tương tự, `STAGING_AI_RECOVERY_FIXTURE_UNKNOWN` nghĩa là fixture journal thiếu,
`pending`, malformed hoặc terminal CAS không được acknowledge. Giữ tombstone và
fixtures; không đánh dấu journal settled, không ad-hoc delete và không rerun acceptance.
Journal v2 chỉ coi `terminal/created` hoặc exact `terminal/rejected` với request-ID/payload
binding là proof. Với journal v1 legacy pending, ngoại lệ duy nhất là workflow manual
`.github/workflows/staging-ai-recovery.yml`: workflow phải tải artifact của exact failed
`Staging Live Acceptance` run, verify SHA/deploy identity, tìm đúng một Render application
`http.request` finish record cho `POST /api/knowledge-base/` status `400` trong cửa sổ journal,
và lưu closed operator-attested evidence trước khi chạy recovery CLI. Workflow dùng chung
concurrency/environment `staging-live-acceptance`; request khác, log phân trang/malformed,
KB entry xuất hiện hoặc identity mismatch đều giữ tombstone và fail closed. Không dùng workflow
này cho 5xx/timeout/malformed response hoặc production.
Ngoại lệ v1 hiện chỉ được code chấp nhận cho incident tuple đã ghi trong spec rollout; đây là
operator attestation có provenance, không phải chứng nhận tự động về toàn historical serving interval.
Verifier GET exact Render deploy để bind service/deploy/SHA/chronology và reject toàn response log
malformed, duplicate hoặc conflicting. Journal v2 pending không bao giờ dùng nhánh operator này.

Với failed run có journal v2 đã `terminal/created` hoặc exact
`terminal/rejected`, recovery workflow không nhận `fixture_request_id` và không tạo
operator-attested Render proof. Recovery CLI phải tự đọc exact journal trong
`htcoaching_staging`, kiểm run/SHA/marker/request/payload binding trước mọi delete,
rồi mới quiescence/inventory/cleanup. Nếu journal v2 còn `pending`, thiếu hoặc
malformed thì vẫn giữ tombstone/fixtures và fail
`STAGING_AI_RECOVERY_FIXTURE_UNKNOWN`; không được thêm request ID legacy để lách
contract này.

Khi retry một recovery đã success, truyền cả `prior_recovery_run_id` và exact
`prior_recovery_run_attempt`. Workflow chỉ tải report từ successful `workflow_dispatch` của
`.github/workflows/staging-ai-recovery.yml` hoặc registered bridge
`.github/workflows/staging-security.yml` trên trusted `staging` ref; artifact name và report vẫn
phải khớp exact run/attempt. Report được validate closed schema và exact intent trước
connect/revoke, rồi recovery vẫn quiescence/inventory/cleanup lại.
Recovery report v2 giữ `operator_attested_render_application_log` cùng digest canonical evidence;
v1 prior report vẫn đọc được nhưng không tự có operator proof. Nếu process chết sau xóa journal nhưng
trước ghi verified report thì vẫn là manual blocker, không dùng empty inventory để manufacture proof.

`workflow_dispatch` chỉ đăng ký file có mặt trên default branch. Khi recovery workflow chưa có
trên default branch, dispatch qua `staging-security.yml`; bridge chỉ nhận manual operation
`recover-ai-residue`, gọi reusable recovery workflow từ cùng commit `staging` và dùng chung
`staging-live-acceptance` concurrency/environment của recovery. Push, schedule và manual
operation `monitor` vẫn chỉ chạy monitor read-only.

Ví dụ dispatch qua registered bridge sau khi reviewer đã đối chiếu exact request ID trong
provider log:

```powershell
gh workflow run staging-security.yml --ref staging `
  -f operation=recover-ai-residue `
  -f recovery_acceptance_run_id=<FAILED_WORKFLOW_RUN_ID> `
  -f recovery_release_sha=<INCIDENT_SHA> `
  -f recovery_fixture_request_id=<EXACT_RENDER_REQUEST_ID> `
  -f "recovery_confirmation=RECOVER EXACT AC009 STAGING RESIDUE"
```

Với journal v2 terminal, bỏ hẳn input legacy `recovery_fixture_request_id`:

```powershell
gh workflow run staging-security.yml --ref staging `
  -f operation=recover-ai-residue `
  -f recovery_acceptance_run_id=<FAILED_WORKFLOW_RUN_ID> `
  -f recovery_release_sha=<INCIDENT_SHA> `
  -f "recovery_confirmation=RECOVER EXACT AC009 STAGING RESIDUE"
```

Sau khi `.github/workflows/staging-ai-recovery.yml` đã có trên default branch, có thể dispatch
trực tiếp với `acceptance_run_id`, `release_sha` và `confirmation`; chỉ truyền
`fixture_request_id` cho ngoại lệ journal v1 legacy. Hai entrypoint phải thực thi
cùng recovery contract, không dùng bridge để nới verification.

Chỉ rerun live acceptance sau khi artifact recovery có
`staging-ai-recovery-report.json` với `verified: true`, `residue: 0`.
Chỉ trường hợp chính recovery đã ghi một closed verified report của đúng SHA/run mới
được phép tái dùng report đó khi journal terminal đã được xóa. Nếu process chết sau
xóa journal nhưng trước khi report verified được ghi, trạng thái vẫn là manual blocker
dù inventory có vẻ sạch; điều tra bằng database/provider logs thay vì suy `residue=0`.

## 3. Production promotion approval

Trigger `.github/workflows/release-promotion-gate.yml` với candidate workflow run
ID và exact SHA. Environment `production-approval` phải có reviewer. Gate tải
đúng artifact và chạy:

```powershell
node scripts/release-gate.mjs --mode=candidate `
  --manifest=artifacts/release-candidate.json `
  --backup-manifest=docs/operations/production/backup-readiness.json `
  --expected-sha=<EXACT_40_CHARACTER_CANDIDATE_SHA>
```

Gate fail nếu backup hiện tại stale/khác ID, off-device recovery chưa ready,
cleanup không sạch, CI/deploy SHA drift hoặc rollback ID thiếu. Gate không deploy;
owner dùng kết quả PASS để phê duyệt thao tác deploy riêng.

## 4. Production observation

Production monitor chỉ gọi GET/HEAD. Sau deploy, ghi UTC start và chạy monitor
liên tục/scheduled trong ít nhất 30 phút. Khi cửa sổ kết thúc và monitor pass,
trigger `.github/workflows/post-deploy-observation.yml` với exact production
deploy IDs, start timestamp và monitor run URL.

Gate GET provider APIs để xác minh production deploy IDs cùng candidate SHA,
kiểm observation window và giữ artifact `production-observation-<run_id>`.
Theo dõi rolling 5 phút cho 5xx, HTTP/DB/provider P95, provider failures và heap;
đồng thời kiểm DB readiness, SePay status, RUM và integrity alerts.

## 5. Rollback

Nếu promotion/post-deploy gate fail, dừng rollout. Nếu production đã deploy và
monitor fail, dùng exact rollback IDs trong candidate rồi theo
`production-rollback-runbook.md`. Database restore chỉ dùng khi xác nhận corruption
và có approval riêng; không dùng restore để chữa application regression.

Security-format cutover có thể đánh dấu rollback ID cũ là không tương thích. Với
Plan 082, bắt buộc theo `refresh-session-cutover.md`; trạng thái provider `live`
không tự chứng minh old Auth instance đã drain và không được rollback server về
build pre-082 chỉ vì ID đó có trong release candidate.

## 6. Deferred infrastructure

Atlas PITR/continuous recovery, paid monitoring, canary, Kubernetes và container
registry promotion chưa thuộc workflow này. `continuousRecoveryAvailable=false`
phải tiếp tục được báo là warning trung thực.
