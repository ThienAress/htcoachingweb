# Plan 094C: Chốt reliability và promotion production tối thiểu

## Status

- Priority P1; complexity COMPLEX; risk HIGH; effort M; depends on 094B.
- Lifecycle IN PROGRESS; verification FOCUSED; rollout PENDING.
- Owner root / 01a0ffb5-31c7-7360-93e3-3de14e9289dc; updated 2026-10-05.

## Mục tiêu và quyền

User yêu cầu rút ra vấn đề cốt lõi, sửa tối thiểu rồi promotion production.
Đã có quyền Git/PR/merge/staging fixture; production code deployment được yêu
cầu ngày05/10. Không mặc định quyền migration, re-embed/publish hoặc catalog write
production. Main protected yêu cầu một approving review; không bypass protection.
Backup off-device mới cần xác minh destination và independent custody như runbook.

## Current state và phạm vi

- Staging9a9b1ae0fda22ce3e34ecaab62aa36a9cfe67541, UI15manual14/15,
  frozenautomatic12/15; diagnostic không thay certified gate.
- Case15 một grounding request aborted/0tokens; chưa chứng minh provider503
  hoặc codebug. Search tool→engine linked signal→controller deadline cần trace.
- Mainfe9ab8e4882c5f9476daf168b2022e263eb00854 diverged:15 main-only commits,
  gồm security dependency fix và workflow KB source/reembed. Phải giữ khi hợp nhất.
- Candidate isolated `.local-data/ai-progress-staging-20261003` chỉ dirty4docs;
  root checkout có nhiều thay đổi ngoài scope, giữ nguyên.
- Current backup20261004T034034Z có custody/restore PASS, gần hết hạn24h.
  Manifest tracked trên candidate vẫn trỏ20260926, phải cập nhật evidence đã verified.
- Canonical release workflow yêu cầu AC009 authenticated AI acceptance và hai
  Plan092 live semantic rounds11/11 cùng exactSHA, cleanupverified/residue0.

In scope: trace/probe identity request, tối đa patch nhỏ ở search/tool cancellation
seam nếu RED chứng minh bug; preserve main vào release candidate; backup evidence;
CI/staging/candidate/production gate và read-only postdeploy observation.
Out of scope: LOW meal label/citationarticle dedup/screenshot polish, rubric/corpus
relaxation, timeout/retry/quota/model increases, schema/auth/payment changes mới,
production data migration hoặc copy staging data.

## Steps và verification

### Step 1: Xác minh identity

Independent Sol/high investigation identity abort; root owns bounded liveUI
   probe cùng prompt và exactreleaseSHA. Hypotheses: engine deadline, callerabort,
   providererror, networkslow. Không patch nếu chưa có red-capable feedback.
   Verify renderedidentity/groundedsource/one search/cleanupzero; lưu mỗi attempt.
### Step 2: Hợp nhất release

Independent Astra/xhigh release audit; root đọc main diff và integration.
   Tạo branch codex từ isolatedcheckout, preserve main commit history/security;
   conflicts resolve theo contract và QA impactedlayers. Không reset root hoặc
   bỏ main-onlycommit. Update candidate manifest bằng recovery evidence thật.
### Step 3: Backup hiện hành

Backup read-only exact gym-app qua existing approved backup account, encrypted
   archive, isolatedrestore/fingerprints/GridFS/cleanup. Offdevicearchiveonly vào
   canonicalDrive; Bitwarden keyretrieval và downloadedcopyrestore phải verified
   trước đặtoffDeviceRecoveryVerified. Không backdate timestamp hoặc nới24h.
### Step 4: Kiểm chứng môi trường

CI exactsnapshotPASS→staging NetlifyREADY/RenderLIVE→served/runtimeSHA match.
   Refresh KB/catalog/index read-only; production dữ liệu chỉ auditmetadata trước
   codepromotion. Nếu cần đổi data, chuẩn bị exactreviewedproposal rồi xin quyền.
### Step 5: Certified acceptance

Dispatch canonical staging-acceptance với CI URL và bothproductionrollbackIDs.
   AC009 và hai Plan092round11/11 trong cùng trustedartifact; cleanupzero.
   `node scripts/verify-staging-ai-reliability.mjs --round-1=<artifact1> --round-2=<artifact2> --expected-sha=<SHA>` phải exit0.
   `node scripts/release-gate.mjs --mode=candidate --manifest=<candidate> --backup-manifest=<current> --expected-sha=<SHA>` phải readytrue/exit0.
### Step 6: Production promotion

Production Promotion Gate protectedenvironment. Chuẩn bị PR/review concrete,
   giữ exactSHA: nếu PR tạo mergeSHA mới phải pauseauto deploy trước merge,
   stage/CI/acceptance lại đúngmergeSHA trước production. Không bypassmainreview.
   Deploy exactcertifiedSHA; verify providers/served/APIhealth. Production
   observationGET/HEAD≥30min, retainmanifest và compatiblePlan082rollbackIDs.
   Chỉ KEEP khi postdeploygatePASS; lỗi theo rollbackrunbook đã đọc.

## Done và STOP

- Identity live có successproof hoặc remainingrisk định lượng được review rõ;
  chưa certified khi canonicallivegatefail.
- Preserve main fixes; exactCI/staging/candidate/productionSHA bằng nhau.
- Recoverycurrentready; rollbackIDs verified; productionKBprofile/eligibleindex
  khôngunknown; cleanupzero.
- Production protectedapproval, deployment và ≥30minobservation PASS.
- Không nâng caps/cherry-pick điểm/chạy vòng vô hạn. Sau3probes không tăngevidence
  dừng patchguessing. Không deploy nếu gatefail, recoveryexpired hoặc humanreview
  chưađạt. Reportremainingblocker với evidence và việc đã chuẩn bị để userreview.

## Traceability và tiến độ thực tế

Manifest `traceability/094c.json` map toàn bộ 39 AC kế thừa; hơn300 dòng vì schema bắt buộc map từng AC. Không đổi spec/oracle.

- Điều tra độc lập: local tool deadline15s, caller disconnect/HTTP503 không phù hợp evidence;80 focused tests PASS; chưa sửa product code.
