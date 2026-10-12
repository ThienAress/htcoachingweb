# Publication journal: offline verification — 2026-10-06

## Kết luận và phạm vi

Tiếp tục production-launcher slice của Plan 094C. Journal bridge local đã qua
regression và independent review; đây **không phải** staging certification hoặc
production execution authority. Không đổi product source, provider/model/caps,
acceptance oracle, Git history, deploy hoặc dữ liệu production.

Release checkout `.local-data/ai-progress-staging-20261003` vẫn sạch tại
`1d08c9f568a178de2215606767fb62016c60a2e4`. Checkout gốc dirty có sẵn được giữ nguyên.
Helpers dưới `.local-data/production-assistant-data-20261005` bị Git ignore; hashes
bên dưới là fingerprint của source đã kiểm, không phải trusted release artifact.

## Root cause và patch

Feedback ban đầu: Node 22 chạy `publication-journal.test.mjs` exit 1,
1 PASS / 4 FAIL. Các hypothesis đã phân biệt bằng closed-schema fixture,
metadata-only native ACK và public exported bridge tests:

- Fixture poststate spread intent-only fields; closed POSTSTATE schema từ chối
  đúng. Sửa fixture theo producer thật, không nới schema.
- Bridge từ chối mọi existing stage, kể cả intent trước poststate hợp lệ. Chỉ
  cho phép đúng một poststate của intent đã durable, bind common fields/publisher
  và SHA-256 của canonical intent. Duplicate/mismatch vẫn freeze, không retry.
- Native ACK chỉ có metadata; bridge lại đòi payload trong ACK. Đọc payload qua
  `readRecord`, kiểm sequence/digest/head và semantic JSON equality bằng
  `journalJson`. Strict EJSON string giữ nguyên byte và BSON subtype distinction.
- Native `JOURNAL_ACK_UNKNOWN` được map thành UNACKNOWLEDGED; bridge freeze và
  yêu cầu reconcile, không dispatch từ acknowledgement không chắc chắn.
- Bridge không sở hữu cohort authorization. Lookup valid absent action trả
  undefined; executor vẫn kiểm entryIds thuộc plan. Sửa test kỳ vọng foreign
  lookup không có scope, giữ negative action/entry mismatch và malformed ID.

Independent review phát hiện race HIGH: call đang chờ có thể trả positive ACK
sau khi call khác đã freeze bridge. Public regression RED xác nhận lỗi; thêm
single-flight guard và kiểm frozen sau mỗi await, kể cả await-tail của wrapper.
Native regression kiểm cả scan đang chờ và append đã durable: không positive ACK
hay dispatch; durable intent còn lại phải reconcile, không tự xóa/retry.

Certification integration fixture cũ còn pin `8ace88...`. Cập nhật exact fixture
SHA tới checkout hiện tại và `safe.directory` theo từng Git invocation. Giữ
assert clean checkout, exact tree/blob bytes và pinned Node 22; không đổi Git config.

## Verification

Runtime: `.local-data/runtimes/node-v22.23.1/bin/node.exe`, `v22.23.1`.
Các lệnh dưới chạy từ repository root với `node --test <paths>`:

| Scope | Kết quả | Giới hạn |
|---|---|---|
| `publication-journal.test.mjs`, `publication-executor.test.mjs`, `journal-store.test.mjs` | Final 25/25 PASS, exit 0 | Synthetic capabilities; gồm hai race regressions |
| `publication-journal-windows.test.mjs` | Final 4/4 PASS, exit 0 | Actual encrypted native store; temp synthetic ACL/fixtures, không HTTP/DB |
| `journal-windows.test.mjs` | 13/13 PASS, exit 0 | Independent scoped run ngoài sandbox; fixture residue 0 |
| `certification-integration.test.mjs` | 8/8 PASS, exit 0 | Actual pinned Node/Git CLI với synthetic positive/negative artifacts; không live certification |
| Tất cả helper `*.test.mjs` trừ hai Windows suites | 207/207 PASS, exit 0 | Chạy trước final wrapper-tail patch; 25 tests liên quan đã rerun trên final snapshot, không gọi 207 là final full-run |

13 lỗi Windows trước đó là sandbox `SetAccessControl` permission failure, không
phải lý do nới ACL. Scoped native suite ngoài sandbox giữ nguyên codec/ACL guards.
Source hashes, line counts đều đã kiểm; không trailing whitespace, file mới dưới
300 dòng. Build/client/E2E/Docker không chạy lại vì không đổi product source;
CI exact release đã PASS được giữ, không dùng local helper tests thay CI.

| Helper | SHA-256 final |
|---|---|
| `publication-journal.mjs` | `40453a86b016e94acea01684fb00a77657189a4cd116c1b8a84c8b9d18ffbb0b` |
| `publication-journal.test.mjs` | `fd3b5bcd9a05e4a444f8ba209f76d00eef58f529745b4a91b79fa295395d4a0f` |
| `publication-journal-windows.test.mjs` | `9651b3756120e0550ed04210f286b5d3252c37ecb2d684f6dce6ed695abeec7e` |
| `certification-integration.test.mjs` | `c5d85980c053d5da38a12c46022c4bcb63b8b64fde540bff11163c81335e6b07` |

Independent ht-security review cuối: PASS, không còn reachable finding trong
bridge snapshot trên; 25/25 independent synthetic tests PASS. Requested role
Astra/xhigh; model ghi nhận trong worker footer là gpt-6-astra/xhigh, không có
backend execution receipt để chứng nhận routing. Root chịu trách nhiệm tích hợp.

## Provider và live gate

Render GET-only rolling window `2026-10-05T17:51:58.707Z`–`18:21:58.707Z`:
exact live SHA, complete=true, matched=0. Zero traffic không chứng minh recovery.

Direct synthetic Gemini probe mới `18:32:18.865Z`–`18:33:30.569Z`: ba mẫu đều
success, mỗi mẫu đúng một HTTP 200, không retry; durations 1568/2759/3688ms.
Không lưu prompt/output/key hoặc ghi DB. Evidence:
`.local-data/staging-ai-resume-20261003/provider-availability-1791225210569.json`.
Chỉ đủ để cho phép **một bounded canonical acceptance attempt**, không chứng minh
deployed application acceptance hoặc provider stability dài hạn.

Đã xác minh CI `37330225656` success cùng exact SHA; recovery `37347902445`
success, verified=true/residue=0/alreadyClean=true. Backup recovery point
`2026-10-05T03:11:21.938Z`, off-device/isolated restore verified, còn trong 24h
tại dispatch; vẫn phải kiểm lại trước mọi promotion/mutation sau này.

Dispatch duy nhất:
[canonical acceptance 37356999066](https://github.com/ThienAress/htcoachingweb/actions/runs/37356999066).
Exact SHA `1d08c9f...`, staging client `6ac3bd35512baf0008833d20`, server
`dep-db1rr9p42hec73e176q0`, CI URL trên; operation=acceptance. Workflow chỉ được ghi
synthetic `htcoaching_staging` và bắt buộc cleanup.

Run **FAIL** ở general acceptance, trước AC009/Plan092. Immutable artifact
`release-candidate-37356999066/staging-acceptance.json` ghi timeout code 23,
`startedAt=2026-10-05T18:35:11.544Z`, `completedAt=18:36:19.586Z` và automatic
cleanup `verified=true/residue=0`, tất cả collection/state mismatch counts bằng 0.
Stack đã khoanh boundary `stagingAcceptance.js:111` (fetch timeout 60s), gọi từ
`stagingAuthAcceptance.js:58`: POST `/api/auth/refresh` cho legacy synthetic actor.
Đây là first auth-cutover lane, không phải Gemini request. Không kết luận root
cause server/network cụ thể chỉ từ timeout; không tăng timeout hoặc sửa auth.

AC009 và hai Plan092 rounds NOT RUN; không có AI recovery intent vì AI lane chưa
bắt đầu. Không dispatch nhầm AC009 recovery workflow cho general failure; automatic
general cleanup đã có verified-zero proof. Acceptance vẫn FAIL, không candidate
mới; không dispatch retry thêm trong lượt này.

## Remaining gates

Reconciliation trong bridge vẫn là caller attestation. Production launcher,
Admin+CSRF thực, majority raw reads, real owned-key config CAS, protected approval
và hardware power-loss durability chưa được chứng minh bởi report này.
PR196 human review/merge, exact main SHA certification, current recovery gate,
production promotion/data apply và observation GET/HEAD >=30 phút vẫn chưa hoàn tất.
Không bypass protection hoặc dùng helper PASS để cấp production GO.

## Bounded auth-timeout follow-up — 2026-10-06

User yêu cầu không mắc mãi ở một bug; nếu cần staging login/dashboard/human review
phải báo thao tác cụ thể, không yêu cầu credential trong chat. Slice này chỉ đọc
runtime và bổ sung readiness gate, không sửa auth hay production data.

Independent investigation xác nhận Render staging plan=free, exact1d08/live.
Window của canonical37356999066 có environment.loaded18:35:48.911Z,
database.connected18:36:15.240Z, server.started18:36:15.336Z, client abort18:36:19.593Z.
Cold start là hypothesis được hỗ trợ mạnh nhất, không phải proven per-request
attribution: telemetry chỉ ghi khi response finish, thiếu ingress correlation.
[Render Free docs](https://render.com/docs/free) xác nhận idle spin-down và spin-up
khoảng một phút. Không tăng timeout auth60s hoặc thay refresh-session semantics.

Root GET-only probe01:45:20Z: readiness200/846ms, correct live deploy
dep-db1rr9p42hec73e176q0/not_suspended; historical app log page complete20rows,
8 allowlisted entries (DB connected và health), request log page0rows. Không coi
absence của request log là proof chưa vào server. Evidence local metadata-only:
`.local-data/staging-ai-resume-20261003/auth-cutover-readonly-1791251120679.json`.
Lần curl timeout trước đó không chứng minh outage kéo dài.

Patch local trong release checkout: workflow thêm existing `staging-health.mjs`
GET-only sau recovery gate, trước synthetic general acceptance, acceptance guard,
step timeout6phút, exact origins, fail-closed. Reuse existing health retry3; không
thêm business/provider retry. Test mới RED1/1 trước patch, final focused
`release-workflows.test.mjs` + `production-monitoring.test.mjs` GREEN32/32/exit0.
Actual unchanged health runner01:49:06.983Z:7/7 HTTP200, readiness760.52ms.
Secret/data-boundary/agent/docs-privacy scans PASS, diff-check PASS.
Hai lần gọi nhầm tên boundary/agent scanner bị MODULE_NOT_FOUND; đã xác minh
package.json và chạy lại đúng canonical scripts, không tính lần lỗi là PASS.

Independent scoped security review cuối: PASS WITH WARNINGS/no reachable finding;
static regression chưa execute YAML failure path/timeout/repository payload.
User đã xác nhận commit/push + PR staging. Đúng5files trên được commit thành
`a020d94968e4e8b80f26d03f318dee299536cf7e`, nhánh
`codex/staging-acceptance-readiness-20261006`; isolated checkout sạch sau commit.
[PR201](https://github.com/ThienAress/htcoachingweb/pull/201) chỉ target staging,
đã attach vào task. [CI37401461224](https://github.com/ThienAress/htcoachingweb/actions/runs/37401461224)
5jobs đang chạy tại01:54Z, không báo PASS trước completion.
Đây không phải certified snapshot mới. Canonical acceptance cho patch NOT RUN.
Đã hỏi quyền riêng merge/deploy/write acceptance đúng htcoaching_staging sau CI;
PR196 vẫn thiếu protected human review, main certification và production approval.
Chưa deploy, dispatch retry hay ghi DB/config.

CI37401461224 final:3/5PASS (secrets/docker/e2e), client/server FAIL tại dependency
audit, trước build/unit. Advisory source-map-js HIGH GHSA-68fv-2mgg-jv7q;
proxy-addr CRITICAL GHSA-jqcg-44mw-7w3h. Owner xác nhận mở rộng PR201 để sửa
đúng2dependencies, và cho phép protected merge/deploy/test staging sau freshCI.
Pin patch2.0.8/1.2.2 trong cả manifests; locks chỉ đổi2package nodes + metadata.
Không đổi trust proxy numeric, auth, quota, audit policy hoặc waiver. npm local
install thay node_modules shared links bằng dependency directories isolated;
không thay dependency directory hoặc product code của checkout root.
Pin regression REDexit1 → focused37/37PASS; actual proxy/source-map API10assertions
PASS; observability/auth helper6/6PASS; canonical auditsclient/serverPASS/waived[].
Secrets/boundaries/diff-checkPASS; independent security review PASS WITH WARNINGS,
no reachable finding. Chưa dùng localPASS thay fresh trusted CI/certification.

## PR201 protected staging merge checkpoint

Fresh PR CI37402411183 exact `c488118852988804362ff40ab9ad442d94fa3136`
completed success: client/server/secrets/docker/e2e **5/5 PASS**. Bao gồm canonical
dependency audits, release client build, AI eval, full unit/integration và E2E;
UI regression cùng agent/security gates PASS. Không chạy trùng QA local hoặc gọi
static regression là rendered UI/SEO certification. PR diff không thay UI/routes,
AI prompt/tools hay product API; các audit chuyên biệt này SKIP theo release scope.

User đã duyệt riêng merge/deploy/test staging. Root kiểm current head, base staging,
CLEAN/MERGEABLE và đủ 5jobs trước protected merge, không `--admin`.
PR201 MERGED `2026-10-06T02:14:37Z`, staging merge SHA
`0a25bba1bcc79bfb2a057c2dc40703eb9d8851aa`. Canonical staging push CI37403176060
đang chạy; Netlify branch deployment `6ac4599068ee9e000859e7ec` đang build cùng SHA.
Render vẫn live old `1d08c9f...` tại02:15Z; chưa trigger deploy hoặc acceptance mới.
Không dùng PR CI để dispatch canonical acceptance. Backup gate vẫn hết hạn tại
`2026-10-06T03:11:21.938Z`; kiểm lại trước mọi acceptance/mutation.

Staging merge tree `fc0c7a73e45acccb8c91274238f20c2dff492f45` bằng reviewed
PR head tree; isolated checkout vẫn sạch và root dirty giữ nguyên. Canonical
staging push CI37403176060 final **5/5 PASS**, trusted repository/ci.yml/push/staging
provenance đã xác minh. Netlify `6ac4599068ee9e000859e7ec` ready trên exact merge SHA.
Root tạo đúng một Render staging POST sau CI/current branch identity gate tại
02:23:51Z; durable intent được ghi trước request. Response201/202 xác nhận deploy
`dep-db25ndu7bikc73chu2r0`, exact merge SHA, build_in_progress. Không retry POST.
Chưa dispatch acceptance trước provider live/served/health gate. Main PR196 vẫn
DRAFT/REVIEW_REQUIRED/BLOCKED, không thay đổi main/production.

Render deploy đã live cùng exact SHA tại02:25:25Z. Local served verifier lần đầu
FAIL `STAGING_ASSET_INVENTORY_REJECTED`: GET HTML200 có29unique assets, helper
diagnostic dùng ceiling16. Không phải failed application acceptance và chưa có
DB writes. Pure inventory regression RED1FAIL/4PASS; sửa riêng ceiling diagnostic
tới64, giữ empty/oversize/path guard, dedup/order và hash verification từng asset.
Final6/6PASS; release source/tree không đổi, không đổi canonical oracle/caps.
Served recheck02:28:08Z: index hash match immutable Netlify deployment,29/29assets
hash match, correct staging API origin và readiness PASS. Actual health runner
02:28:15.825Z:7/7 HTTP200.

Fresh Gemini metadata-only probe02:28:15.905Z–02:29:24.657Z trên staging config:
3samples success, mỗi sample1HTTP200, durations5789/1191/1233ms, databaseWrites0.
Đủ cho một bounded acceptance attempt, không chứng minh live acceptance hay
provider stability dài hạn. No credential/prompt/output/provider response raw
được lưu vào report/artifact.

Backup validators trước dispatch: age23.31h, releaseReady/disasterRecoveryReady
true; PITRfalse tiếp tục là warning. Không có concurrent acceptance; current
staging branch và canonical CI SHA được kiểm lại. Root ghi local dispatch intent
trước đúng một workflow dispatch. New canonical run
[37404475141](https://github.com/ThienAress/htcoachingweb/actions/runs/37404475141)
created02:30:36Z, exact0a25bba1, operation=acceptance; target chỉ synthetic
htcoaching_staging, mandatory cleanup. Run queued tại checkpoint này;
AC009/Plan092/cleanup/candidate chưa có kết quả. Không dispatch retry mù.

Đã hỏi owner quyền backup mới trước hạn10:11ICT: exact production gym-app
read-only, encrypted archive-only ở canonical Drive, separate Bitwarden custody,
isolated downloaded-copy restore. Chưa nhận approval mới, chưa tạo/upload backup
hoặc ghi/restore production. Staging attempt vẫn dùng current verified backup.

## Canonical result và mandatory recovery

Run37404475141 final **FAIL**, không tạo release candidate. Immutable general
report success=true,02:30:57.772Z–02:31:46.842Z; auth/business stepPASS và cleanup
verified=true/residue0, toàn bộ collection/state mismatch counts0. Không còn
timeout auth-cutover ở attempt này; kết quả hỗ trợ readiness fix nhưng không
chứng minh tuyệt đối cold-start attribution của run cũ.

AC009 schema3 statusfailed,02:32:05.997Z–02:35:10.756Z. Exact staging identity
và reviewed/published/embedding fixture assertionsPASS. Ba browser lanesPASS:
live-kb-provider, paced-conversation-isolation, stop-recovery. Tiếp theo code là
provider-failure Retry rồi Edit; không có PASS cho hai lane này. Error metadata:
STAGING_ACCEPTANCE_CLEANUP_FAILED, operationCode/cleanupCode đều generic
STAGING_AI_ACCEPTANCE_FAILED; không đủ để phân biệt timeout/DOM/provider/provenance.
Initial AI cleanup verifiedfalse/residueunknown/outcomeUnknown. Plan092 cả hai
rounds NOT RUN. Không diễn giải direct Gemini probe hoặc ba lanesPASS thành AC009PASS.

Đúng một canonical recovery được dispatch qua registered staging-security bridge
[37405096638](https://github.com/ThienAress/htcoachingweb/actions/runs/37405096638),
created02:38:17Z, source run37404475141, exactSHA/runUUID trong immutable intent,
targethtcoaching_staging. Không truyền legacy fixture request ID hoặc operator
override, không ad-hoc delete. Recovery finalsuccess; artifact
staging-ai-recovery-37405096638-1/staging-ai-recovery-report.json schema2:
verifiedtrue/residue0/alreadyCleantrue/recoveredReceiptCount0,
fixtureRejectionProofnull. Đây là independent cleanup/quiescence proof; failed
acceptance vẫnFAIL. Root đối chiếu exactSHA/run và canonical existing-report
validation seam; artifact bytes phải giữ nguyên.

Một metadata-only staging forensic read bịECONNREFUSED ở local environment,
không có usable snapshot; không dùng nó kết luận về provider hoặc cleanup.
Helper tạm mới tạo đã xóa bằng apply_patch. Sau recovery đã verifiedzero, không
retry read trên fixtures đã được dọn hoặc chạy thêm acceptance/diagnostic LLM.
Lần local verifier đầu import nhầm private validator đãFAIL; không tínhPASS.
Public existing-report seam mới được dùng cho final check, không sửa validator
export hoặc product source.

Remaining: bounded Retry/Edit investigation cần thêm discriminating evidence;
không patchguessing hoặc nới source/oracle/caps. Backup mới vẫn chờ ownerapproval,
current backup hết hạn03:11:21.938Z. Main PR196 DRAFT/REVIEW_REQUIRED và chưa cập
nhật mọi follow-up; exact-main certification, protected promotion, production
data launcher/adapters và production observation>=30min chưa hoàn tất. No main
merge/deploy, production DB/configwrites, restore hoặc paid infrastructure upgrade.
