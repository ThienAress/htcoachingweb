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
Owner đã duyệt riêng proposal dữ liệu `gym-app` digest
`d1c0ede94b5e0b4a807eccce98de496d858eb2cffccf3686d51fbb9249ce5750`, chỉ sau
certified staging PASS: 26 KB/root embeddings, bỏ 110 variants có rollback,
4 native food allergen profiles, 3 price observations giữ ngày gốc và root index/profile.
Giữ 39 legacy KB và 2 holds. Owner chọn gỡ global Sculpture wrapper để links mở
Exercises/TDEE bình thường, giữ component/assets.

## Current state và phạm vi

- Historical staging9a9b1ae0fda22ce3e34ecaab62aa36a9cfe67541: UI15manual14/15,
  frozenautomatic12/15; diagnostic không thay certified gate. PR194 merged,
  exact staging4f2e9b6c3ba5506775ed207b8155eac34c46d8ed, trusted CI5/5 PASS,
  Netlify ready6ac322770dcab6000899862b và Render live dep-db1i936gekts73dv8u90.
- Case15 round2 aborted/0tokens do local tool deadline15s theo trace; không có
  bằng chứng HTTP503. Probe live mới trên9a9 thành công grounding nhưng trả chi tiết
  ngoài identity scope; bản vá bounded selector local107testsPASS, đã deploy4f2.
  Hai probes4f2 chưa semantic PASS: một no_supported_source/621tokens, một
  aborted/0tokens. Không quy cả hai lỗi cho selector hoặc provider outage.
- Mainfe9ab8e4882c5f9476daf168b2022e263eb00854 diverged:15 main-only commits,
  gồm security dependency fix và workflow KB source/reembed. Phải giữ khi hợp nhất.
- Candidate isolated branch `codex/assistant-production-release-20261005` đã merge
  main tại7485f35, preserve main-only workflows/security; root dirty giữ nguyên.
- Backup20261005T030928Z đã độc lập custody/restore PASS,83collections/4360documents,
  productionwrites0; trackedmanifest cập nhật evidence05/10, PITRfalse.
- Production data read-only:67KB/39published/eligible0, legacy-symmetric-v1,
  không searchindex; reviewed safefoods0. Code-only promotion là NO-GO. Cần proposal
  chính xác và quyền riêng cho datawrite trước khi thực hiện; proposal bounded
  đã được owner duyệt, chưa execute.
- Canonical release workflow yêu cầu AC009 authenticated AI acceptance và hai
  Plan092 live semantic rounds11/11 cùng exactSHA, cleanupverified/residue0.

In scope: trace/probe identity request, patch nhỏ ở grounded identity selector
nếu RED chứng minh bug; preserve main vào release candidate; backup evidence;
CI/staging/candidate/production gate và read-only postdeploy observation.
Out of scope: LOW meal label/citationarticle dedup/screenshot polish, rubric/corpus
relaxation, timeout/retry/quota/model increases, schema/auth/payment changes mới,
production data ngoài approved proposal hoặc copy staging data rộng.

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

Follow-up 1edd07b9: aligned diagnostic ghép đúng assistant/request recovery_retry
với DOM: completed answer 818 ký tự, source/card 0; capability settled/completed,
không proof provider outage. Source-selector RED độc lập: root chọn 1, cùng query
cộng recovery suffix chọn 0. Recovery cuối verified=true/residue=0. Không dùng
diagnostic làm certification. Fix scope: giữ exact-question selector; thêm delivery
fallback chỉ cho trọn mệnh đề factual trùng reviewed answer, bỏ duy nhất formatting
và attribution dẫn đầu đã nhận diện. Giữ nguyên số/đơn vị/đối tượng/phủ định;
gắn link ngay mệnh đề được hỗ trợ, không footer bảo chứng toàn answer. Files:
knowledgeClaimCitation.js + focused test, ai.controller.js, systemPrompt.js và
aiSourcePolicy.integration.test.js. Verify RED route/SSE/persisted/owned GET,
GREEN với negatives stale/unrelated/intake/changed fact và limits, independent
review rồi trusted CI/exact staging/canonical acceptance. Không đổi frozen
fixture/oracle/provider/caps hoặc production data. Paraphrase không trùng phải
fail closed; không cam kết gate PASS trước khi có kết quả thực thi.
Review phát hiện hai MED đã tái hiện riêng: token số bị thay marker Markdown vẫn
được bind; optional tool đã execute vẫn nhận fallback citation. Fix chỉ unwrap
cặp formatting cân bằng ở token boundary, giữ marker trong số; claim fallback
mặc định tắt, chỉ normal model-final bật khi actual toolCallCount=0. Exact-source
path cũ giữ nguyên. Local static CI-config build PASS (không production artifact);
lượt build đầu thiếu VITE_API_URL đã dừng, không tính PASS. Final source tests và
re-review phải hoàn tất trước merge staging.
Final focused 5 files 153/153 PASS trên Node22.23.1; scientific-source negatives
gồm số/đơn vị/dân số/cường độ/phủ định, stale/unreviewed/private bounds, tool route
và truncation. Map clause-key chỉ trong một response, tối đa3 entries/128 clauses,
first reviewed proof wins; không persistent cache, ownership hoặc cross-user key.

Checkpoint a4b7: PR198/staging merge CI5/5PASS; Netlify ready
6ac390942ce723000855d8f7 và Render live dep-db1p1qpsrm7s73cmu2i0 exact
`a4b7ca0307b915da314117c1754af5f3700e7f1f`. Canonical37306960913 FAIL trước
browser lane đầu; recovery37308002526 verifiedtrue/residue0. Hai diagnostic
UI thật trên cùng SHA có completed persisted answer, exact fixture trong trace,
eligibleSource1 nhưng citationpredicatefalse/sourceanchor0. Grammar-only probe
cho thấy attribution WHO/khuyến nghị trong declarative clause; không có raw
output trong artifact. Local recovery cả hai verifiedtrue/residue0. H2 delivery
predicate supported; không coi completed chat là provider outage. Bản vá tiếp
giới hạn modifiers của guideline attribution, giữ risk/tool/fallback/exact-source
guards và negative clarifications. Frozen fixture/oracle/caps vẫn giữ nguyên.
Final selective attribution patch local5files429/429PASS; independent19pureprobes
PASS, không confirmedBLOCK/HIGH/MED. Review negatives giữ intake/chưa xác minh
uncited; wrappedclaims/heading/intro giữ nguồn. AIeval73/73, tool/secrets/boundaries
và agents scansPASS. TrustedCI/exactdeploy/canonicalacceptance mới còn pending.

Publication fence counter regression RED2FAIL/11PASS; hydrate cùng raw projection
fix, integrated4files71/71PASS và independent counter reviewPASS. Fence chưa live
và chưa cấp production execution authority. Partialpublicationrollback isolated
54/54PASS cũ không đủ raw BSON proof: independent review phát hiện Date/ISO và
numeric subtype bị canonical digest collapse; root actualMongo price Int32/Double
drift RED chứng minh rollback vẫn delete owned price. Phải bổ sung fresh typed
snapshot/strictEJSON binding và raw CAS/readback/restoration; không suy subtype
từ approved JSON snapshot. Chưa production writes/deploys.

Checkpoint389e: PR195 final CI37266234606 và canonical staging CI37266900816
5/5PASS; Netlify6ac3323de9aece0009662e0b/Renderdep-db1j5d5g1s2s73aej4p0 exactSHA.
Certified37267543038 FAIL trước browser lane đầu; hai Plan092 rounds NOT RUN.
Recovery37268212744 verifiedtrue/residue0. Local diagnostic canonical browser
giữ real response/gates, tái hiện source-anchor timeout trong khi exact request
settled/completed và persisted answer thiếu WHO URL; cleanup/recovery0.
Probe2 đã phân biệt citation-need predicate và source-selection qua safe metadata;
bản vá selective guideline citation đang qua local verification. DraftPR196 vào
main chưa review/merge; production untouched.

Probe2 đã khoanh lỗi delivery: exact fixture trong answerTrace, source selection
eligible1, response nhắc WHO/khuyến nghị nhưng answerNeedsKnowledgeCitation=false;
persisted source/DOM anchor0. Fix được giới hạn vào `answerSourcePolicy.js`, focused
tests cùng HTTP integration consumer: nhận diện attribution guideline của
WHO/AAOS và formatting, giữ exact reviewed-source selection, risk/tool/fallback
guards. Không đổi fixture/oracle, router, model, timeout, retry hoặc quota.
Verify RED→GREEN public citation-policy test, actual SSE/source persistence
integration, independent review, trustedCI/deploy và canonical acceptance exactSHA
mới. Probe2 phải recoveryverified0 trước mọi live rerun.

Local review phát hiện attribution v1 có thể gắn nguồn vào clarification/fallback.
Final predicate normalize emphasis trước fallback, bỏ bare authority nounphrase
và loại question-only clauses khỏi guideline attribution; claim trước follow-up
vẫn giữ citation. RED9FAIL/29PASS qua exported policy và actual HTTP/SSE/history;
focused5files GREEN381/381, AIevalPASS, tool/secrets/boundaries/agents scansPASS.
Không dùng GREEN370 cũ cho snapshot mới. Independent final review PASS, thêm16
read-only assertionsPASS; không còn confirmedBLOCK/HIGH/MED trong3AI files.
Trusted CI/deploy/certified exactSHA mới còn phải hoàn tất; chưa production execution.

Checkpoint8ace: PR197 mergeSHA `8ace88be3bc3dc6dd8db2cb032b080ab471a722e`.
PR CI37271576780 và canonical mergeCI37272453782 đều5/5PASS. Netlify ready
6ac3432711be63000834e360/Render live dep-db1k8ce0tbcc73b86ba0 cùng exact8ace;
served index/assets match immutable deployment, staging APIhealthready.
Certified37273273915 general9/9PASS, AC009FAIL trước lane đầu, Plan092NOT RUN.
Bounded Render log window ghi chat_error/GEMINI_HTTP_ERROR/status503 nhưng chỉ
time-window correlation, không per-request proof. Recovery37273889945 verified0.
Một local canonical-browser diagnostic8ace không mock response: live capability
settled/failed, không persisted answer/markdown, UIalert1; recoveryverified0.
Final bounded canonical rerun37275066284 FAIL trước lane đầu; Plan092 NOT RUN.
Bounded logs ghi chat_end/11602ms/iterations1/toolCalls0/kbHits3, không có proof
HTTP503 cho run này. Root cause chưa xác định. Recovery37275732914 verifiedtrue,
residue0/alreadyCleantrue. Không đổi caps/oracle hoặc biến failed run thành PASS.

Follow-up deterministic: unchanged canonical buildKnowledgeFixturePayload có
attribution "Theo nguồn chính thức" nhưng8ace needsCitation=false, strip WHO URL
dù exact source eligible. Regression actual builder RED4FAIL/43PASS, review
negatives RED4FAIL/48PASS; wrapped WHO/AAOS regression RED3FAIL/52PASS. Fix chỉ
nhận official attribution ở đầu non-question clause, giữ WHO/AAOS joined clauses
và fallback/risk/tool/exact-source guards. Final focused5files GREEN398/398,
AIeval73/73, independent review không confirmedBLOCK/HIGH/MED. Bug này được tái
hiện độc lập, chưa chứng minh gây canonical37275066284. CI/deploy/certify SHA mới
vẫn bắt buộc trước production.

Production prep independent architectural review chốt ba gaps: trusted artifact
launcher, encrypted durable snapshot/receipts, conditional publish và rollback sau
partial publication. Launcher chỉ đọc đã implement4files + offline integration;
root verified90/90PASS (46launcher+36certification+8actualNode22subprocess).
Scoped independent securityPASS; chưa live certification; giữ
productionExecutionAuthorized=false. Node permission không phải network sandbox;
canonical validators/support được kiểm exacttrackedblobs và không network/DB.

Publish completion slice tối thiểu còn PLANNED: optional If-Match strong digest
của raw canonical KB projection, chỉ body status=published; raw projection read
và server-built atomic exact-value/type/presence predicate qua Mongoose save.
Giữ auth/CSRF/server reviewer;412 trước provider khi stale, CASmiss cũng412.
Không dùng chỉ__v vì raw writer và updatedAt drift không luôn tăng version.
Verification bắt buộc: raw drift trước/sau read, missing/null và scalar/array,
concurrent publish chỉ1success, wrongrole/CSRF, stale token sau successful publish,
unknown outcome reconcile và exact partial-publish poststate rollback.
Không execute publish trước authenticated request journal/durable encrypted
poststate receipt; existing rollback hiện chỉ hỗ trợ draft prepublish và không
được gọi như đã chứng minh partial-publication recovery.

Publication fence implementation slice IN PROGRESS: ownership chỉ
`server/src/controllers/knowledgeBase.controller.js`, một helper pure ở
`server/src/services/knowledgePublicationFence.js` và unit/HTTP regression files
riêng cho fence. Optional header strong `"kb-publish-v1-<64hex>"`; chỉ chấp nhận
raw body `{status:"published"}`. Server đọc raw canonical projection/hydrate cùng
document, so digest trước mutation/provider, gắn exact value/type/presence CAS
vào document save; stale/CAS miss trả412. Không thay normal API clients hoặc schema.
Node22/MongoMemory verification qua actual admin HTTP, auth/CSRF negatives,
before/after-read drift, missing/null/scalar-array, concurrent publish và replay.
Không DB/live/Git mutation bởi worker; root review/QA/certify trước production.

Manifest `traceability/094c.json` map toàn bộ 39 AC kế thừa; hơn300 dòng vì schema bắt buộc map từng AC. Không đổi spec/oracle.

- Điều tra độc lập: local tool deadline15s; không đổi caps/provider/retry/quota.
- Một liveUI probe trên9a9: grounding1success/598tokens,3clickverifiedsources,
  persisted/SSEdone/DOM và cleanup0; scopeFAIL vì unsolicitedstats/currentclub.
- Sửa4AI files: tối đa3câu grounded verbatim, lọc trước3sourcecap, sourcevalidity
  trước sentencebudget, dedupe và tên50Cent/CaptainAmerica/ClubAmérica.
  RED đã quan sát; focused107tests/3filesPASS, AIevalPASS; independentreview
  không có actionableBLOCK/HIGH/MED. Live trên bản vá chưa semantic PASS.
- Reconcile main:20workflow/dependency +31KBtestsPASS; strict staging releasebuild
  PASS,12AIintegrationtestsPASS. PR194 và merge4f2 CI đều5/5PASS; strict production
  releasebuild cũng PASS sau xác minh đúng public API/cohort.
- Backup05/10 rootfinalizePASS lúc03:36:06Z, downloadedcopyrestorePASS vàcleanup0;
  Drive/account owner-attested vì browser automation lỗi.
- Production nativefoodIDs khácstaging;28KB stableIDs match nhưng28answers khác.
  Chưa copy stagingdata, chưa production mutation/deploy.
- Canonical acceptance37263652031 trên4f2: general business9/9PASS, AC009FAIL,
  Plan092rounds NOT RUN. Fixture semantic readiness PASS; browser lane đầu lỗi
  chưa có safe operation code. Cleanup fail-closed vì mutation outcomeUnknown.
  Recovery37264185169 verifiedtrue/residue0/alreadyCleantrue; run cũ vẫnFAIL.
- Follow-up tối thiểu: gỡ App Sculpture wrapper/import và E2E normal navigation;
  thêm sanitized operationCode/cleanupCode vào failed acceptance evidence.
  Không đổi cleanup/oracle/caps/schemaVersion. Focused evidence tests68PASS;
  navigation6PASS/exit0, UI regression0newhigh, strict production releasebuildPASS;
  lintPASS/0errors/1existingwarning. Rendered desktop/mobile navigation reviewPASS.
- Production transaction helper: independent security review không còn finding,
  isolated28testsPASS. Chưa có trusted launcher, durable encrypted rollback,
  live root index/config/Admin publication hoặc protected human approval.
