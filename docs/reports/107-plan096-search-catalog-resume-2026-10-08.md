# Plan 096 resume — search, provenance và catalog

## Kết quả hiện tại

Đã sửa candidate và áp dụng tám patch kỹ thuật vào staging catalog. Chưa deploy
code mới; chưa chạy certification 15 câu/TALK01 trên SHA mới. Plan 096 vẫn
IN PROGRESS, chưa đủ evidence cho GO toàn kế hoạch.

Candidate: `.local-data/vibi-staging-20261006`, baseline HEAD
`f27065e763865f740e1087c6a092ac7dbc8f1333`. Live code staging vẫn là merge SHA
`17dcb5ad47a2729c382c6c61c60365b3bff5f587` của PR207 trước bản sửa này.
Root checkout có thay đổi khác: không sửa hoặc deploy root application source.

User đã duyệt chạy corpus canonical 15 câu mới đúng một lần, thay giới hạn cũ
chỉ retest hai câu. Corpus là 14 câu gốc và replacement case5 đã được duyệt;
không gọi là exact original-15. Không reuse, không retry hoặc chọn best-of.

## Root causes và thay đổi

WHO: Brave trả nguồn ngoài `who.int`, selector đúng policy nên không chọn được
nguồn. Adapter thêm `site:who.int` sau privacy preparation; vẫn dùng câu hỏi
ban đầu cho synthesis và UI. Live local probe sau sửa có evidence grounded;
đây là probe, không thay rendered/staging acceptance.

Ronaldo: retrieval có nguồn, nhưng synthesis ghép profession/nationality với
chi tiết biến động, khiến identity guard loại toàn câu; một số quote không exact.
Prompt yêu cầu quote liên tục nguyên văn và từng dữ kiện riêng. Không nới quote,
numeric hoặc identity guards. Live local adapter probe grounded sau sửa;
nghiệm thu semantic/source UI vẫn cần chạy trên bản deploy mới.

Safe diagnostics thêm `failureStage` cho `no_supported_source` ở retrieval/synthesis.
Không log query, evidence, response, credential hay nội dung hội thoại.

Fresh SSE `done.meta` thêm capabilities và provenance: deterministic_server,
internal_kb, model_prior, web_grounded, capability_unavailable. Giữ schema lưu
trữ, trace cũ và client. Early safety/TDEE intake cũng có metadata; duplicate
acknowledgement giữ contract cũ vì không tạo answer mới.

Review độc lập phát hiện nhánh claim-bound KB có citation nhưng vẫn báo
model_prior. Đã tái hiện RED qua route thật, sửa để đếm nguồn thực sự được giao,
và regression GREEN. Metadata không dùng số nguồn retrieve nhưng chưa cite.

## Catalog và side effects

Đúng database `htcoaching_staging`, collection `exercises`, tám exact ID/name:
Dumbbell Romanian Deadlift, Inverted Row, Modified Hindu Push-up (male),
Pike-to-cobra Push-up, Exercise Ball Pike Push Up, Barbell Pendlay Row,
Inverted Row Bent Knees, Suspended Row.

Hai patch đầu theo primary ACE đã audit; sáu patch sau theo GIF gắn trực tiếp với
record. Modified Hindu demo có low push-up → pike → high plank, không cobra.
Chỉ đổi description/instructions/updatedAt; giữ name/muscleGroup/media/schema.
Audit chi tiết trong candidate `docs/audits/096-vibi-exercise-variants.md`.

Apply `2026-10-08T03:38:58.171Z`, transaction/CAS, snapshot fresh và preimage full.
Intent/completion receipts ở candidate `.local-data/plan096-catalog/`.
Post-read `03:39:45.002Z` PASS: tám postimages đúng, field khác giữ nguyên và
114 records không thuộc patch giữ nguyên. Không seed/cleanup hoặc ghi production.

Plan digest `62c3c60c9e0e5543864cb1a12b7ed616cf63ed001ba7befbd3eec2fa2824a421`.
Receipt digest `5f1e5814ddb606564f904110364f5cdee14254962e6a8536cfb65311bf0d5504`.
Rollback bind exact plan/receipt và chỉ restore khi current postimage còn khớp;
không rollback mù hoặc xóa dữ liệu khác. Các variants ngoài mẫu vẫn REVIEW,
không tuyên bố certified toàn bộ 102 row hoặc đưa ra contraindication lâm sàng.

## QA evidence

- Node chuẩn 22.23.1. Focused server: năm files, 25 tests PASS, gồm owned SSE.
- TDD: WHO query regression RED trên logic cũ; KB provenance regression RED
  trước sửa; cả hai GREEN. Prompt quality vẫn cần live acceptance.
- Client full: 188 files / 945 tests PASS. Hai lượt sandbox có test timing fail;
  chạy riêng 27 PASS, sau đó full ngoài sandbox 945 PASS, không sửa test.
- Release build PASS: Vite, prerender 44/44 routes, bundle budget và search-index
  build. Lượt đầu thiếu VITE_API_URL/bị network sandbox được ghi BLOCKED;
  lượt cuối dùng staging API origin đúng và đã PASS.
- Local E2E: 128 PASS / một browser-context teardown timeout; file bị ảnh hưởng
  chạy lại sáu tests PASS. Giữ cả failure và retry evidence, không gọi lượt đầu xanh.
- Lint, dependency audits client/server, secrets, data boundaries, docs privacy,
  agents/tool validation, runtime logging, UI regression gate PASS.
- Certification contract: bốn tests PASS. Full server inventory PASS:
  319 files / 3.682 tests, completion `2026-10-08T04:15:47.150Z`.
  Hai lần launcher ban đầu bị kẹt/interrupted; batch diagnostic 32 files/394 tests
  PASS, rồi chạy đúng các files còn lại. Inventory/JSON reports chứng minh coverage
  đủ và không trùng. Giữ command thực tế; không tự khai alias canonical đã exit0.
  Kết quả này là QA local, chưa thay trusted exact-SHA CI trước merge/deploy.
- QA artifacts: root `.local-data/brave-release-20261008/resume-*`.
  Không commit raw conversations, DOM, screenshots, credentials hoặc data snapshots.

## Trạng thái bảy bước

| Bước | Đã có | Còn cần để nghiệm thu |
|---|---|---|
| 1 | Policy cũ + provenance additive và regression | Deploy metadata mới |
| 2 | Root cause, fix, guards/tests, local live probes | WHO/Ronaldo fresh rendered acceptance |
| 3 | Audit bounded variants, tám patches applied/reconciled | Fresh case9 và kỹ thuật card render |
| 4 | Presentation code/tests ở PR207 giữ nguyên | Desktop/mobile rendered workout và meal |
| 5 | History repair PR204 giữ nguyên | TALK01 fresh paid ≥3 completed tool groups |
| 6 | User duyệt fresh canonical15, capture pipeline prepared | Chạy một lượt, bind prompt/parent/SHA/model/time |
| 7 | Telemetry/gate giữ nguyên, gate tests PASS | CI5 cùng SHA, health/deploy identity và final GO/NO-GO |

## Release permission và phần tiếp theo

AGENTS.md quy định Git read-only trừ user yêu cầu rõ thao tác khác. User đã trả
lời “ok bro”, duyệt commit/push/tạo PR/merge/deploy staging cho candidate này.
Quyền này chỉ áp dụng staging và các files thuộc release.

Sau approval và QA: PR vào staging → CI5 → merge → exact SHA CI5 → paired
Netlify/Render identity/health → fresh canonical15/TALK01/rendered acceptance →
gate/report. Chỉ staging, không production và không Gemini. Dừng paid requests
khi balance không kiểm chứng được hoặc còn tối đa ngưỡng đã duyệt.

## Snapshot cuối lượt

## Release tiếp nối sau approval

- PR208: `https://github.com/ThienAress/htcoachingweb/pull/208`, đã merge staging.
- Candidate head `52f905ff0e7db5efe386d65478bd0d2ad2d889e3`.
- Merge SHA `a0a4f2555fde0fef162307cc3a02c87ee380cd39`.
- PR CI run `37730595535`: client/server/secrets/e2e/docker 5/5 PASS.
- CI đầu phát hiện inventory stale sau khi hai test mới được stage. Đã cập nhật
  server test inventory 317→319, validator local và CI mới PASS; không bypass gate.
- CI merge SHA, paired staging deploy và fresh certification đang thực hiện.
- Ví Vibi reload trước lượt mới: $9.64, 29 requests, usage $0.3629.
- Chưa gửi câu certification mới tại checkpoint release này.

Code, focused/regression, full local inventory và targeted catalog đã hoàn tất.
Review MED duy nhất đã sửa và GREEN; chưa phát hiện BLOCK/HIGH trong diff đã review.
Không có deploy code mới hoặc paid certification mới. Ví đã reload xác minh vẫn
trên ngưỡng dừng; screenshot/usage metadata chỉ giữ local, không publish.
Chưa có CI/deploy identity cho bản sửa; exact15/TALK01/rendered acceptance còn
pending nên verdict toàn Plan 096 là NO-GO, không phải lỗi mất code qua thread.

## Checkpoint tiếp nối — owner acceptance và production preflight

Phần này thay thế các snapshot trước về permission, deploy và việc chưa gửi test.
User đã duyệt nghiệm thu **15/15 PASS_WITH_NOTE**, xác nhận rendered staging UI
**PASS**, và yêu cầu hoàn tất các gate còn lại rồi push production. Không cần xin
lại quyền release; production vẫn phải đạt evidence gate trước khi deploy.

- PR208 merge SHA: `a0a4f2555fde0fef162307cc3a02c87ee380cd39`.
- Merge CI `37731217529`: client/server/secrets/e2e/docker 5/5 PASS.
- Staging deploy đã xác minh trước fresh run: Netlify `6ac7263eacd20600079f89eb`
  ready, Render `dep-db3igjfavr4c739unvsg` live; cùng exact SHA, health HTTP 200.
- Corpus là 14 câu gốc + replacement case5 đã duyệt, không gọi original exact-15.
- Câu1–7: automation UI + owned DB captures, một lượt mỗi câu; chain4→5 và6→7.
- Câu8–15: user gửi thủ công một lượt và relay text/screenshots. Read-only DB recovery
  lúc `2026-10-08T08:01:24.458Z` tìm đúng một owned exact-prompt turn cho từng câu,
  mỗi turn bắt đầu hội thoại mới, có một final answer và không còn active stream.
  Evidence giữ local trong `.local-data/release-resume-20261008/`.
- Câu10/15: persisted trace `deepseek-v4.1-flash`, `web_required`,
  `webSearchUsed=true`, `webSearchOutcome=grounded`. Không suy search chỉ từ link.
- Câu13: `server_joint_safety_v1`, web không gọi; AAOS citation có phạm vi rõ.
- Câu8/12 là server/static lanes; câu9/14 là catalog/intake. Không gọi mọi câu
  là paid model response hay tự chứng nhận SHA từ field không tồn tại trên answer.

Owner acceptance 15/15 là quyết định nghiệm thu nội dung với ghi chú; không thay
raw grader hoặc chứng nhận máy. Câu10 trả đúng khoảng150–300 phút aerobic trung
bình, nhưng chưa nêu phương án75–150 phút cường độ mạnh và tập sức mạnh2ngày.
Raw semantic rubric cũ giữ FAIL cho mức bao phủ này; owner chấp nhận
PASS_WITH_NOTE vì câu hỏi hỏi số phút và có nguồn WHO. UI PASS là owner-observed,
không tự nhận agent đã kiểm tra lại click/avatar/mobile khi browser đang lỗi.

TALK01 fresh có≥3 completed tool groups qua≥3 requests và paid continuation vẫn
chưa chạy. Không gửi lại corpus15. Chưa biết số dư Vibi sau lượt thủ công nên dừng
paid requests cho tới khi đọc/nhận được balance hiện tại lớn hơn$3.

Production preflight GET lúc `2026-10-08T08:01:24.458Z`: server
`dep-dal4ojjm8hqs73etisn0` live và client `6aaa4bfd61cc19000835e129` ready,
cùng SHA `89ac30fc31aa49628b89b308ae4b53ad9c4c8c55`; đây là rollback baseline
production, khác các rollback IDs staging. Không có production write/deploy.
Backup pointer hiện tại ngày06/10 đã quá24giờ. Backup mới đang được tạo bằng
read-only role, exact `gym-app`, encrypted7z và isolated restore; chưa được coi
là off-device verified cho tới download/custody/drill đầy đủ.

Runtime: normal exec/CUA thất bại do Windows sandbox runtime ACL refresh gặp
sharing violation `os error32`. Đã reset scoped runtime helpers, nhưng khóa DLL
VCRUNTIME140_1 vẫn còn. Không disable sandbox hay sửa ACL/security policy.
Npm cache7.237.930.020bytes đã copy sang `D:/codex-cache/npm-cache`,
164.889files khớp count/size và npm global cache config đã trỏ D. Việc bỏ source
C cần dry-run so sánh cuối; giữ source nếu còn khác biệt, không xóa dữ liệu Codex.

Verdict hiện tại: **NO-GO FOR PRODUCTION** vì TALK01, balance và current off-device
backup/candidate acceptance còn thiếu. Không chạy lại QA/build đã có nếu code
không đổi; không deploy dirty root checkout.

## Checkpoint thực thi cuối — 08/10/2026

- Cache migration COMPLETE: npm global cache `D:/codex-cache/npm-cache`;
  copy164.889files/7.237.930.020bytes, source/target count+size matched;
  final robocopy dry-run allowed only destination extras. Old C npm cache removed
  only after exact path/config verification. C free17.002.041.344bytes afterward.
- Root grading raw diagnostics: cases1–7 PASS, cases8–15 absent from original
  automation capture directory. Manual DB captures live in a separate directory;
  do not pretend DOM files exist or rewrite rawFAIL as machinePASS.
- Exact owned manual DB turns8–15 were uniquely recovered with persisted traces.
  Owner decision remains15/15PASS_WITH_NOTE, UI PASS. Case10 coverage note retained.
- Fresh CI GET still5/5success at exact staging merge SHA. Provider inspect at
  `2026-10-08T08:06:40.607Z` confirmed same Netlify/Render IDs still ready/live.
  A combined verify helper failed with opaque numericcode23; direct GitHub/provider
  checks passed. The helper failure is retained, not called fresh full gatePASS.
- New production backup local verified at `2026-10-08T08:03:52.778Z`:
  `production-logical-backup-20261008T080231Z-131f9f0f9e1040c4`,83collections,
  4.347documents, encrypted integrity/isolated fingerprints/GridFSPASS,
  productionWrites0,recoveryResidue0. Local key retestPASS; offdevice stillfalse.
- Owner handoff instructions and scripts prepared under
  `.local-data/release-resume-20261008/owner-recovery-steps.md`.
  New secret-free backup record exists; readiness pointer deliberately unchanged.
- Sandbox reset uncovered a respawned Swift helper retaining runtime DLL lock.
  Browser and normal shell remain unavailable. Elevated approved shell works.
  Do not keep stopping app-managed helpers or change security boundaries;
  application must release the locked runtime before a new UI automation attempt.
- Pending user balance question: current Vibi wallet must be verified>$3 before
  any paid TALK01. No new paid requests, no corpus resubmission, no history cleanup.
- Steps1–4: implementation/deployed proof and ownerUI acceptance completed.
  Step5TALK01 pending; step6owner acceptancePASS_WITH_NOTE with manual binding
  limits explicit; step7production recovery/trustedcandidate/gate pending.
- Production remains unchanged, NO-GO until required runtime/balance/recovery/
  candidate gates pass. Existing release authorization persists; do not reask.

## Backup recovery closure — 08/10/2026

Owner confirmed all Drive/Bitwarden requirements. Same-backup independent restore
`1bd8408e-e344-4942-8737-2b311529cac2` RESTORE_PASS at08:20:14.794Z;
root binding/checksum/counts/cleanup verification PASS at08:22:23.752Z.
Readiness pointer updated to08/10 backup, offdeviceRecoveryVerified=true.
Drive/account/custody are owner-attested. No production writes/deploys.
Current Vibi wallet owner screenshot:$9.28,totalusage$0.7208,46requests.
TALK01 and trusted release candidate/promotion still remain;15/15 owner acceptance
and UI PASS unchanged. Do not resend the corpus or reapply catalog patches.
