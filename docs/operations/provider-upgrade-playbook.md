# Cập nhật tính năng khi upgrade dịch vụ

> Trạng thái: **ACTIVE / canonical operational playbook**
>
> Audit codebase và nguồn provider gần nhất: **2026-09-06**
>
> Phạm vi: Render, MongoDB Atlas, Netlify và các SaaS/runtime phụ thuộc của HTCOACHINGWEB.

## Mục đích và cách gọi

Tài liệu này trả lời hai câu hỏi: việc nào nên làm ngay dù chưa trả phí, và sau khi một dịch vụ được nâng cấp thì capability nào phải cấu hình, kiểm chứng hoặc vẫn chưa được phép bật.

Các câu như “Tôi đã nâng MongoDB lên rồi, kiểm tra những việc cần làm” hoặc “Kiểm tra checklist sau khi nâng Render” chỉ cho phép **audit read-only**. Chúng không tự cho phép mua gói, đổi dashboard, deploy, migration, restore, rotate secret hay ghi production. Nếu người dùng yêu cầu thực thi, agent vẫn phải xác nhận đúng target và tuân thủ approval boundary của runbook liên quan.

Agent xử lý trigger theo thứ tự:

1. Đọc file này, `AGENTS.md`, Git status và skill phù hợp; không chạm thay đổi đang có ngoài scope.
2. Xác minh bằng dashboard/billing thật: provider, account/project/service/cluster đã che ID, plan/tier, region, quota, capability đang bật và ngày kiểm tra. Không suy plan từ code hoặc lời quảng cáo cũ.
3. Mở lại nguồn chính thức ở cuối file vì giá, tên gói, quota và entitlement có thể đổi. Billing screen hiện tại thắng mọi con số trong tài liệu.
4. Phân loại từng mục là `LÀM NGAY`, `ĐÃ MỞ KHÓA`, `CHƯA CẦN`, `BLOCKED` hoặc `VERIFIED`; nêu evidence và blast radius.
5. Với thay đổi được duyệt, chạy preflight → execution → verification → rollback/STOP của provider; lưu evidence secret-free dưới `docs/operations/production/` hoặc release record phù hợp.
6. Chỉ cập nhật trạng thái hoàn thành khi capability thật sự đã được drill. “Paid”, “active” hoặc “live” không đồng nghĩa “verified”.

Evidence tối thiểu cho một lần nâng cấp:

| Trường | Nội dung được phép lưu |
|---|---|
| Identity | Provider, account/project/service đã mask, môi trường, region |
| Entitlement | Tên plan/tier trên dashboard, billing active, capability cần dùng |
| Change | SHA/deploy ID hoặc setting đã đổi; không ghi secret/value nhạy cảm |
| Recovery | Backup/recovery target, rollback owner, STOP conditions |
| Verification | Thời gian UTC, lệnh/drill, kết quả, RPO/RTO nếu liên quan |

## Snapshot và thứ tự ưu tiên hiện tại

Trạng thái provider production chưa được dashboard xác minh trong audit này. Repo/runbook cho thấy Render và Atlas từng ở Free (`docs/operations/production/production-release-plan-2026-07-23.md:36-40`, `docs/operations/runbooks/backup-restore-runbook.md:49-54`), nhưng agent tương lai phải coi đó là **proof gap**, không phải sự thật vĩnh viễn.

| Ưu tiên | Việc | Vì sao / evidence code tại audit 2026-09-06 |
|---|---|---|
| P0 | Tạo logical backup production mới, mã hóa, off-device và restore-test cô lập | `npm run audit:backup-readiness` tính backup `2026-08-27T11:54:31Z` đã `234.33h` khi kiểm tra cuối ngày 2026-09-06, vượt policy 24h; `releaseReady=false`, `disasterRecoveryReady=false`, blocker `BACKUP_STALE` (`docs/operations/production/backup-readiness.json:3-16`, `scripts/lib/backup-readiness.mjs:115-164`) |
| DONE LOCAL / rollout pending | Consent Meal Scan explicit, mặc định từ chối | Dialog yêu cầu checkbox per-request; client service và server đều fail closed. Copy cover Google Gemini Free/Unpaid secondary use + human review (`client/src/pages/MealScan/MealScanAnalyzeDialog.jsx`, `client/src/services/mealScan.service.js`) |
| P0 | Chứng minh Gemini project/key đang Paid hoặc chặn/disclose dữ liệu nhạy cảm khi Free | AI Chat gửi hội thoại và ảnh tới Gemini (`server/src/services/ai/providers/gemini.provider.js:60-88,225-242`), còn paid/unpaid readiness hiện ràng buộc rõ nhất cho Meal Scan (`server/src/config/productionReadiness.js:376-413`) |
| DONE LOCAL | Pin `fast-uri` ở nhánh vá `3.1.7` | `npm ls fast-uri ajv --prefix server --omit=dev` resolve `ajv@8.20.0 → fast-uri@3.1.7`; vẫn phải chạy dependency audit định kỳ |
| DONE LOCAL / cần fresh backup thật | Bind migration guard với backup ID hiện hành và freshness | Shared guard đọc manifest canonical, bắt `releaseReady` và exact backup ID; production migration vẫn bị block khi backup thật stale (`server/src/config/migrationSafety.js`) |
| DONE LOCAL / drill pending | GridFS restore verifier và Cloudinary privacy lifecycle gate | CLI read-only kiểm PDF/chunks/hash; upload avatar/F1/coaching private ép `backup:false`; global backup fail closed cho tới khi upload inventory + avatar deletion lifecycle hoàn tất |
| P1 | Cấu hình Render health check `/api/ops/health/ready` và lưu dashboard snapshot secret-free | App đã có readiness/draining (`server/src/routes/ops.routes.js:62-85`), nhưng release checklist vẫn chưa chứng minh platform config (`docs/operations/release-checklist.md:111-112`) |
| P1 | Nâng Render paid compute **một instance** khi chuẩn bị Auth cutover hoặc cần bỏ cold start | Plan 082 code đã xong nhưng rollout `NOT STARTED`; mixed old/new Auth revision bị cấm (`docs/plans/082-harden-refresh-session-rotation-and-logout.md:181-200`) |
| P1 | Chọn Atlas Flex hoặc M10+ theo RPO; cấu hình và drill backup sau khi nâng | Free không có Atlas backup; boolean PITR chỉ được bật sau isolated restore drill (`docs/operations/runbooks/backup-restore-runbook.md:49-54`) |
| P2 | Nâng Netlify, Resend, Cloudinary, Cloudflare hoặc GitHub chỉ khi trigger đo được xuất hiện | Chưa có code evidence cho một blocker cần trả phí ngay; checklist bên dưới giữ quyết định theo usage/control thay vì cảm tính |

Không release hoặc chạy production migration khi `npm run verify:backup-release` còn fail. Plan 085 đã
hardening code local; chưa deploy, chưa tạo fresh production backup, chưa bật provider backup và chưa
chạy restore/canary live.

## Render: compute, Auth cutover và scale

**Trigger nhận diện:** “đã nâng Render”, “làm Auth cutover rehearsal”, “bỏ cold start”, “scale Render”. Xác định rõ người dùng nâng **web-service compute** hay **workspace plan**; hai thứ khác nhau. Không hardcode `$7/tháng`: audit xác nhận plan ID `0.5c-512mb` (legacy `Starter`), còn giá phải đọc từ billing hiện tại.

### Sau khi nâng paid compute

Preflight:

- Xác minh đúng staging/production web service, paid compute active, Maintenance Mode xuất hiện; ghi region, runtime, branch, auto-deploy, health path và instance count. Giữ **một instance**.
- Đặt Health Check Path là `/api/ops/health/ready`; chứng minh `200` khi ready và `503` khi draining. Không tạo/sync `render.yaml` khi chưa đối chiếu dashboard đang chạy.
- Trước production cutover, yêu cầu fresh backup gate, exact reviewed SHA, incident/recovery owner và một build giữ semantics Plan 082.

Execution cho Plan 082 phải dùng nguyên [refresh-session cutover runbook](./runbooks/refresh-session-cutover.md):

1. Rehearse trên staging: tạm guard auto-deploy, bật Maintenance Mode, xác nhận public API trả `503`, chờ Auth request cũ drain.
2. Deploy exact SHA; ghi deploy ID và chứng minh revision cũ đã terminate trước khi mở traffic.
3. Tắt Maintenance Mode rồi kiểm legacy refresh trả generic `403` và clear cookie; login/rotation mới thành công; replay revoke family; logout vẫn chạy với expired access token và CSRF hợp lệ.
4. Exercise recovery bằng build tương thích Plan 082 hoặc forward-fix. Chỉ promote production khi rehearsal và recovery evidence đều pass.
5. Khi production được duyệt, lặp lại đúng drain boundary; theo dõi refresh/logout `403`, `5xx` và reuse signal không chứa token/JTI/family/user ID.

Verification và rollback:

- Expected side effect: session cũ có thể phải đăng nhập lại sau khi access token tối đa 15 phút hết hạn.
- Client-only rollback được phép nếu server còn tương thích. Server chỉ về build giữ Plan 082 semantics; không dùng database restore để chữa application cutover.
- **STOP** nếu chỉ có status `live`, old/new có thể cùng nhận traffic, revision cũ chưa drain, recovery duy nhất là pre-082, hoặc cần global revoke/secret rotation chưa được phê duyệt.

### Trước khi scale hơn một instance

- `express-rate-limit` và AI abuse limiter đang process-local (`server/src/middlewares/rateLimit.js:1-304`, `server/src/middlewares/aiRateLimit.js:11-75`); chuyển limiter Auth/financial/webhook/AI-cost sang shared store và xác định fail-open/fail-closed khi store lỗi.
- Cron khởi chạy trong web process (`server/server.js:368-400`). Giữ `BACKGROUND_JOBS_ENABLED=false` trên web replicas; chuyển job sang singleton worker hoặc distributed lock có test failover/duplicate.
- Metrics rolling đang nằm trong `Map`/array của process (`server/src/observability/metrics.js:119-124`); externalize metrics/log retention trước khi coi multi-instance observability là đầy đủ.
- Load-test staging và chuẩn bị rollback về một instance. **STOP scale** nếu limiter shared, singleton ownership hoặc duplicate-job proof chưa pass.

Paid Render ưu tiên đầu tiên là always-on + Maintenance Mode/Auth cutover, không phải autoscaling. Không gắn persistent disk chỉ để lưu DB/private media; filesystem vẫn không thay thế Atlas/Cloudinary và disk làm thay đổi deploy semantics.

## MongoDB Atlas: backup, PITR và phục hồi

**Trigger nhận diện:** “đã nâng MongoDB/Atlas”, “đã lên Flex/M10/Dedicated”, “đã bật Cloud Backup/PITR”. Luôn hỏi/đọc đúng tier; “paid” chưa cho biết recovery capability.

| Tier/capability tại nguồn 2026-09-06 | Dùng khi | Không được tuyên bố |
|---|---|---|
| Free M0 | Học/thử nghiệm, 512 MB; vẫn phải tự làm logical backup | Không có Atlas backup |
| Flex | Cần chi phí thấp và daily snapshot; Atlas giữ 8 snapshot gần nhất | Không custom policy, on-demand snapshot hay PITR |
| M10+ Dedicated + Cloud Backup | Production cần schedule/retention/on-demand restore tốt hơn | Chưa phải continuous recovery nếu PITR chưa bật và drill |
| M10+ + Continuous Cloud Backup | Cần restore theo thời điểm/RPO thấp | Không set `continuousRecoveryAvailable=true` chỉ vì dashboard nói active |

### Việc làm ngay khi còn Free

1. Chạy [backup/restore runbook](./runbooks/backup-restore-runbook.md): fresh `mongodump`, archive mã hóa, copy off-device, checksum/fingerprint và restore vào MongoDB cô lập; chỉ sau đó cập nhật `backup-readiness.json`.
2. Xác minh shared migration guard vẫn bắt snapshot ID khớp manifest hiện hành và cửa sổ 24h; không
   sửa/bỏ gate chỉ để migration chạy.
3. Dùng verifier đã có: chạy `npm run verify:restore-gridfs --prefix server` trên target cô lập để kiểm
   `contracts.files`, `contracts.chunks`, mọi `signedPdfFileId`, PDF signature và `fileHash`; tiếp tục
   kiểm invariants users/orders/check-ins/contracts/deposits/wallet/recipes/KB.
4. Ghi owner/scheduler backup thật. Workflow `.github/workflows/recovery-readiness.yml` chỉ kiểm freshness/mở issue, không tạo recovery point.
5. Atlas backup không chứa byte media Cloudinary. Recovery media phải xử lý riêng, nhưng chỉ drill bằng asset synthetic không thuộc customer: một canary public và một canary authenticated/private trong namespace cô lập. Backup F1/coaching nhạy cảm bị **BLOCKED** cho tới khi retention, account deletion và purge-version contract được duyệt. Giữ logical encrypted off-device backup kể cả sau khi có Atlas backup.

### Checklist sau upgrade

Preflight chung:

- Xác minh organization/project/cluster/database/tier/region, billing owner và số tiền đã duyệt; chụp secret-free state. Dừng nếu identity mơ hồ.
- Tạo fresh verified logical backup trước cutover. Restore target bắt buộc là cluster mới cô lập, không có application traffic.

Flex:

1. Chờ snapshot đầu tiên `completed`, restore sang cluster cô lập.
2. So count, BSON/index fingerprint, GridFS/PDF và business invariants; đo RTO.
3. Ghi evidence nhưng giữ `continuousRecoveryAvailable=false`; tiếp tục logical off-device backup vì retention ngắn và RPO có thể gần 24 giờ.

M10+/Dedicated:

1. Xác minh/bật termination protection và Cloud Backup; ghi schedule, retention, cost alert và RPO mục tiêu. Nếu cần PITR, xác minh/bật Continuous Cloud Backup và ghi oplog/restore window; không giả định trạng thái mặc định, copy region chỉ sau duyệt chi phí.
2. Tạo on-demand snapshot trước cutover; restore snapshot vào target cô lập, chạy index verifier, server integration và critical E2E.
3. Với PITR, restore tới timestamp đã chọn và đo RPO/RTO thật. Chỉ sau khi counts/hash/index/GridFS pass mới đặt `continuousRecoveryAvailable=true`.
4. Rotate credential dùng trong drill/cutover, kiểm `/ready`, transaction behavior và DB latency; mở traffic theo giai đoạn. Bật alert, MFA và least-privilege. Private endpoint, database auditing hoặc CMK chỉ thêm khi threat/compliance cần và đã có anti-lockout runbook.

Rollback/STOP:

- Nếu upgrade gây lỗi, rollback application traffic trước; giữ schema/index additive và cluster nguồn. Drill fail thì bỏ target cô lập, production không đổi, PITR flag vẫn false.
- Không tắt PITR tùy tiện vì có thể mất oplog history; không restore đè production; preserve DB hỏng khi có incident.
- **STOP** nếu backup/snapshot chưa completed, target không cô lập, PITR timestamp/window không rõ, counts/hash/index/GridFS/media mismatch, app có thể ghi vào drill, cần lộ URI/key/manifest, hoặc private networking/KMS có nguy cơ lockout.

RPO/RTO đề xuất để owner duyệt, không phải cam kết hiện tại: Free/logical `RPO ≤24h`, `RTO ≤4h`; Flex RPO phụ thuộc daily snapshot; M10+ PITR hướng tới `RPO ≤5 phút`, DB restore `≤60 phút`, full cutover `≤2h`. Phải đo bằng drill hàng quý và sau mỗi thay đổi policy.

## Netlify

**Trigger:** “đã nâng Netlify”, credits thường xuyên đạt khoảng 75–90%, site có nguy cơ pause, cần smart secret detection, retention analytics/RUM dài hơn hoặc team/audit control.

- Hiện chưa có blocker buộc nâng: `netlify.toml:1-17` đã tách build context; Free có CDN, SSL và deploy preview. Nếu account thuộc legacy pricing, chỉ dùng dashboard của account đó.
- Preflight: plan/credits/usage, site ID đã mask, production branch, domain/TLS, env scopes, deploy retention và role access. Không đổi context/secret trong cùng bước nâng gói.
- Sau upgrade: đặt alert/auto-recharge theo ngân sách được duyệt; bật secret detection/retention/control đúng entitlement; deploy preview rồi production canary; exercise deploy rollback và kiểm frontend gọi đúng API origin.
- Rollback về deploy đã biết tốt; tắt add-on/auto-recharge nếu chi phí sai. **STOP** nếu wrong site/team, credits không bounded, env production lộ vào preview hoặc rollback artifact không tồn tại.

## Gemini và OpenAI

**Trigger:** “đã nâng Gemini”, “đã bật billing”, “đã nâng AI”. Billing linked chưa đủ; phải chứng minh đúng project/key đã ở Paid Tier. Theo nguồn hiện tại, Gemini Free có thể dùng content để cải thiện sản phẩm còn Paid không dùng cho mục đích đó.

- Trước paid: xác minh consent Meal Scan đã deploy vẫn explicit opt-in/default false và disclosure
  Free/Unpaid còn khớp data terms. AI Chat cần gate/disclosure riêng cho hội thoại, ảnh và dữ liệu sức
  khỏe; không suy consent Meal Scan sang Chat.
- Sau paid: xác minh key-project/billing tier, model/rate limit/data terms/cost cap; set `GEMINI_PAID_SERVICE_CONFIRMED=true` và `GEMINI_UNPAID_MEAL_SCAN_DATA_USE_ACCEPTED=false` chỉ khi evidence khớp, tránh mode ambiguous; canary staging, moderation/privacy check, quota/error/latency/token-cost metrics rồi mới production.
- Paid không xóa nghĩa vụ minimization, consent, retention và no-raw-payload logging. **STOP** nếu tier/key mơ hồ, hai flags xung đột, thiếu spend cap hoặc data terms chưa được owner chấp nhận. Meal Scan có thể rollback về `MEAL_SCAN_PROVIDER=disabled`; không dùng mock trong production.
- OpenAI hiện chỉ phục vụ image generation có điều kiện (`server/src/services/aiImageGenerator.service.js:22-40`). Trước tăng usage, thêm deadline/cancel, response-byte cap và cost/latency metrics; chỉ cân nhắc enterprise control khi có yêu cầu ZDR/data residency/throughput thật.

## Resend, Cloudinary và SePay

Trước khi quyết định nâng gói, dùng [provider usage monitoring](./runbooks/provider-usage-monitoring.md)
để đo token/email/byte/API-page/build-hook velocity và reconcile với dashboard provider. Counter local
không thay hóa đơn hoặc quota remaining.

| Provider / trigger | Làm ngay không cần nâng | Sau nâng cấp | Verify, rollback và STOP |
|---|---|---|---|
| Resend: gần 70–80 mail/ngày, dự báo ≥2.400/tháng, backlog/drop mail critical | Xác minh SPF/DKIM/DMARC; metric sent/fail/deferred/quota theo template; suppression bounce/complaint; outbox/idempotency cho mail critical | Xác minh quota/overage/budget, gửi canary từng critical template, theo dõi deliverability; dedicated IP chưa hợp lý ở volume nhỏ | Rollback `EMAIL_DELIVERY_MODE=disabled`; STOP nếu domain auth fail, bounce spike, thiếu suppression hoặc volume không bounded (`server/src/utils/sendMail.js:1-21`) |
| Cloudinary: credits 70–80%, cần own-S3 backup, RBAC/access list/support | Free có automatic backup nhưng mặc định tắt và backup giữ version/deleted asset. Code ép `backup: false` cho avatar/F1/coaching private và readiness luôn chặn global backup bằng `CLOUDINARY_BACKUP_GLOBAL_SCOPE_UNVERIFIED` | Trước khi bật: inventory mọi upload seam/class, mặc định class chưa phân loại `backup:false`, thêm active-delete cho avatar cũ/mới, explicit opt-in cho public, privacy approval và ledger storage/bandwidth/transforms | Tạo public + authenticated/private canary: public anonymous allow, private anonymous deny; upload/read/delete/restore/purge cả hai. Chỉ gỡ blocker bằng code review sau khi canary pass. STOP nếu còn class chưa phân loại, scope chứa dữ liệu nhạy cảm, private asset public, purge/restore fail hoặc burn rate tăng. [Residual-data contract](../specs/account-deletion-residual-data-retention.md) tách active delete khỏi backup-version purge |
| SePay: dự báo >40 giao dịch/tháng hoặc cần quota/chi phí dễ dự báo hơn | Cảnh báo volume 70–80%, webhook silence/delay, duplicate/manual-review/cursor metrics; chứng minh đúng một reconciliation owner | Xác minh quyền lợi thật vì các gói hiện chủ yếu khác quota/giá/ngân hàng; kiểm live identity/cutover, quota/overage, signed canary có kiểm soát và không double-credit | Rollback `SEPAY_ENABLED=false` và reconciliation off rồi manual review; STOP nếu HMAC/index/identity sai, hơn một job owner hoặc double-credit mơ hồ |

## Cloudflare Worker, GitHub Actions và các provider không cần mua sớm

- Production monitor GitHub chạy 15 phút/lần (`.github/workflows/production-monitor.yml:13-56`). Cloudflare Worker Free hiện dư xa cho watchdog tần suất thấp; rollout của Plan 080 vẫn `NOT STARTED`. Chỉ tắt schedule GitHub sau khi Worker live, failure **và** recovery notification đã pass observation theo [serverless incident runbook](./runbooks/serverless-incident-response.md).
- Trước khi scale monitoring, externalize log/metric retention và thêm SLI cho Auth/email/media/SePay/quota. Nâng Workers khi chạm request/CPU limit hoặc cần retention/queue capability; rollback bằng GitHub monitor overlap. STOP nếu chưa có end-to-end alert proof.
- GitHub paid chỉ cân nhắc khi private-repo minutes/storage hoặc environment governance là bottleneck. Dù plan nào, pin third-party Actions bằng full SHA (nhiều workflow còn dùng tag như `.github/workflows/ci.yml:23-24`), least-privilege `permissions`, kiểm `production-approval` có required reviewer/prevent self-review/branch restriction và tách staging-write khỏi production-read secrets. YAML không chứng minh dashboard protection.
- GA4/GSC: ưu tiên quota/freshness/partial-result telemetry và PII audit; chưa cần GA360 cho traffic nhỏ. USDA FoodData Central/Open Food Facts là quota/cache/backoff/attribution problem, không phải paid-upgrade mặc định. Google OAuth cần redirect/origin/consent-screen/credential review, không có upgrade task mặc định.

## Ma trận phụ thuộc và definition of done

| Muốn bật | Phải hoàn tất trước |
|---|---|
| Plan 082 Auth production | Render paid compute + Maintenance Mode, staging drain/recovery rehearsal, fresh backup/release gates |
| Render instance thứ hai | Shared critical rate limiter, singleton/distributed jobs, external metrics, multi-instance test |
| `continuousRecoveryAvailable=true` | M10+ PITR active + retention/window evidence + isolated point-in-time restore pass |
| Dừng logical off-device backup | **Không có đường mặc định**; Atlas snapshot không bảo vệ khỏi mọi account/provider failure |
| Dừng GitHub scheduled monitor | Cloudflare watchdog live + failure/recovery observation pass |
| Gửi health/ảnh/hội thoại sang Gemini | Tier/data-use evidence, consent/disclosure đúng surface, minimization, spend cap |
| Coi media có recovery | Cloudinary backup active + privacy lifecycle/purge được duyệt + synthetic restore/integrity drill; Mongo restore riêng |

Một provider upgrade chỉ `VERIFIED` khi: dashboard entitlement đã chứng minh; code/config đúng exact target; security/backup gates pass; staging/canary và recovery/rollback drill pass; monitoring/cost alerts hoạt động; evidence không chứa secret; side effect được ghi nhận. Nếu cùng blocker lặp lại ba vòng sau sửa có căn cứ, dừng và báo owner.

## Nguồn chính thức cần kiểm tra lại

Tất cả nguồn dưới đây được truy cập ngày **2026-09-06**; không dùng giá/quota trong bản cache làm quyết định mua:

- Render: [Free limitations](https://render.com/docs/free), [Maintenance Mode](https://render.com/docs/maintenance-mode), [deploy lifecycle](https://render.com/docs/deploys), [compute plans](https://render.com/docs/compute-plans).
- MongoDB Atlas: [pricing](https://www.mongodb.com/pricing), [Free limitations](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/), [Flex backups](https://www.mongodb.com/docs/atlas/backup/cloud-backup/flex-cluster-backup/), [Dedicated backup](https://www.mongodb.com/docs/atlas/backup/cloud-backup/dedicated-cluster-backup/), [backup policy/PITR](https://www.mongodb.com/docs/atlas/backup/cloud-backup/configure-backup-policy/), [DR guidance](https://www.mongodb.com/docs/atlas/architecture/current/disaster-recovery/).
- Netlify: [plans](https://www.netlify.com/pricing/), [Free vs Personal](https://www.netlify.com/pricing/personal-vs-free/), [deploy management](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/).
- Gemini: [billing](https://ai.google.dev/gemini-api/docs/billing), [pricing/data use](https://ai.google.dev/gemini-api/docs/pricing), [terms](https://ai.google.dev/gemini-api/terms).
- Resend: [quota](https://resend.com/docs/knowledge-base/account-quotas-and-limits), [pricing](https://resend.com/pricing). Cloudinary: [backup](https://cloudinary.com/documentation/backups_and_version_management), [plans](https://cloudinary.com/pricing). SePay: [pricing](https://sepay.vn/bang-gia.html).
- Cloudflare: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [limits](https://developers.cloudflare.com/workers/platform/limits/). GitHub: [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [environment protection](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments), [workflow hardening](https://docs.github.com/en/code-security/tutorials/secure-your-organization/protect-against-threats).
- Dependency advisory: [`fast-uri` GHSA-qw65-cvwx-89v3](https://github.com/fastify/fast-uri/security/advisories/GHSA-qw65-cvwx-89v3) yêu cầu nhánh 3.x tối thiểu `3.1.7`; agent vẫn phải kiểm advisory mới hơn trước khi patch.
