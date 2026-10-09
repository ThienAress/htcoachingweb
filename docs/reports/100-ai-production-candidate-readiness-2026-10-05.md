# Assistant production candidate — 2026-10-05

## Kết luận

**Production NO-GO tại checkpoint này.** PR197 đã merge/deploy staging đúng
`8ace88be3bc3dc6dd8db2cb032b080ab471a722e`, trusted CI 5/5 PASS. Certified AC009
chưa đạt; hai Plan092 rounds chưa chạy. Các failed run/probe đã recovery residue0;
final bounded canonical rerun37275066284 FAIL và recovery37275732914 verified0.
Chưa có production deployment hoặc production data write trong đợt này.

## Checkpoint PR197 trên bản mới

PR197 merge8ace; PR CI37271576780 và merge CI37272453782 đều5/5PASS. Netlify
ready6ac3432711be63000834e360 và Render live dep-db1k8ce0tbcc73b86ba0 đúng8ace.
Index/assets phục vụ khớp immutable deployment; APIstaging đúng, healthready,
không thấy quotaerror trong Netlify deployment này.

Canonical [37273273915](https://github.com/ThienAress/htcoachingweb/actions/runs/37273273915)
general9/9PASS, KBfixture/catalogPASS nhưng AC009FAIL trước lane đầu; không tạo
candidate và Plan092NOT RUN. Safe artifact chưa phân biệt browser timeout/provider.
Bounded Render log window06:38:05–06:40:45Z có chat_error/GEMINI_HTTP_ERROR,
status503; correlation theo thời gian, không attribution từng request.
Recovery [37273889945](https://github.com/ThienAress/htcoachingweb/actions/runs/37273889945)
verifiedtrue/residue0/alreadyCleantrue.

Local live browser diagnostic8ace giữ canonical runner/gates và realresponse:
live_kb_provider capability settled/failed, không assistant answer được lưu,
UI markdown0/alert1, exactKBeligible1. Vì không có answer nên không thể kiểm
hiệu quả guideline-source patch từ probe này. Canonical local recoveryverified0.
Final rerun37275066284 chỉ sau cả hai recovery0; không đổi model/caps/oracle.
Run này FAIL trước lane đầu, Plan092 NOT RUN. Bounded runtime logs ghi chat_end,
11602ms/iterations1/toolCalls0/kbHits3; không có HTTP status chứng minh503 và
root cause vẫn chưa xác định. Recovery37275732914 verifiedtrue/residue0,
alreadyCleantrue. Các failed artifact giữ nguyên FAIL.

## Official-source follow-up

Unchanged canonical fixture builder trả "Theo nguồn chính thức…". Predicate8ace
trả needsCitation=false và strip WHO URL dù exact source eligible. Đây là bug
delivery được tái hiện độc lập; chưa chứng minh là nguyên nhân final canonical
run failure. Fix giữ official attribution ở đầu non-question clause, normalize
emphasis và giữ WHO/AAOS matching trên joined clauses để không mất soft linebreak.
Risk/tool/fallback/exact-source guards, model/caps và frozen fixture/oracle không đổi.

Regression actual builder RED4FAIL/43PASS; overcitation negatives RED4FAIL/48PASS;
wrapped WHO/AAOS RED3FAIL/52PASS. Final focused5files GREEN398/398 (exit0),
AIeval73/73 và independent3file review PASS, không confirmedBLOCK/HIGH/MED.
HTTP tests kiểm SSE/persisted answer/owned history/card cho positives và negatives.
Đây là local readiness; trusted CI/deploy/certify exactSHA mới vẫn chưa chạy.

Read-only production certification launcher đã thêm authenticated GitHub GET,
freshness/header/pagination và exactZIPdigest/extraction binding; validator chạy
từ snapshot exacttrackedblobs và currentbackup, kiểm state/input lại sau chạy.
Root verified90/90PASS, gồm8offlineintegration với subprocessNode22 thật;
independent security review scopedPASS, không confirmedBLOCK/HIGH/MED.
Không chạy live certification; productionExecutionAuthorizedfalse. Nodepermission
không chặn network; canonical support được kiểm không network/provider/DB.

Remaining data boundary: durable encrypted snapshot/receipt storage và conditional
publish/partial-publication rollback chưa hoàn thiện. Current rollback helper chỉ
hỗ trợ draft prepublish, không được dùng như proof sau publish một phần. Cần
raw canonical projection digest + atomic exactvalue/type/presence fence ở existing
authenticated Admin publish path, không chỉ__v; giữ server reviewer/auth/CSRF.
Required mainreview=1 và production-approval reviewerThienAress được GitHub API
xác minh; chưa approve/bypass. Backup release/disaster gatesready, age3.14h lúc
06:19Z, cần tính lại trước execution.

## Checkpoint sau PR195

Owner chọn phương án1; global Sculpture interception đã được gỡ. PR195 final CI
37266234606 và staging merge CI37266900816 đều5/5PASS; E2E129/129PASS.
Netlify ready `6ac3323de9aece0009662e0b` và Render live `dep-db1j5d5g1s2s73aej4p0`
cùng exact389e. Served assets/API/health đã đối chiếu. Live public desktop TDEE
và mobile Exercises điều hướng đúng; mobile capture vẫn loading catalog nên chỉ
chứng minh route/heading/no-preview, không phải toàn bộ catalog workflow.

Certified run [37267543038](https://github.com/ThienAress/htcoachingweb/actions/runs/37267543038)
FAIL trước browser lane đầu. Fixture semantic readiness và catalog PASS;
general acceptance PASS; reliability rounds NOT RUN. Safe error fields mới vẫn
fallback vì Playwright timeout và cleanup AggregateError lồng nhau chưa có code.
Recovery [37268212744](https://github.com/ThienAress/htcoachingweb/actions/runs/37268212744)
PASS: verifiedtrue/residue0/alreadyCleantrue. Không biến failed run thành PASS.

Local live diagnostic trên389e tái hiện timeout tại source-anchor wait, response
không mock. Exact synthetic request đã settled/completed; Mongo activeStreams0,
UI một markdown body, không alert. Persisted answer thiếu expectedWHO URL;
Probe2 khoanh root cause: exact fixture có trong answerTrace, eligibleSources1,
response nhắc WHO/khuyến nghị nhưng citation-need predicate=false. Đây là lỗi
delivery source policy; không có evidence provider abort hoặc render failure
trong probe này. Cả hai diagnostic recovery verifiedtrue/residue0. Không đổi
source oracle/caps; diagnostic không thay certified gate.

## Guideline citation patch đang chuẩn bị deploy

Diff runtime chỉ ở `answerSourcePolicy.js`: nhận diện full WHO name, emphasis
và authority-recommends attribution. Normalize emphasis trước fallback; loại
question-only clauses khỏi attribution và không nhận bare authority nounphrase.
Claim có follow-up vẫn giữ source. Exact-question/reviewed-source selection,
risk/tool/model_prior guards và existing research/reasonCode paths giữ nguyên.
Không đổi provider, timeout, retry, quota, frozen fixtures/corpus/grader/oracle.

Regression qua exported policy và actual HTTP route chứng minh source trong
SSE/final persisted answer/owned history cho guideline claim; clarification và
formatted fallback không có link/card dù exact KB đủ eligibility. Final RED
9FAIL/29PASS; focused5files GREEN381/381 (exit0), AIeval/tool validator/secrets/
boundaries/agents scansPASS. Reviewer v1 phát hiện một MED over-citation, đã sửa;
final independent review PASS và 16 read-only assertions PASS, không còn confirmed
BLOCK/HIGH/MED trong 3 AI files. Trusted CI/live/UI trên SHA mới vẫn NOT RUN tại checkpoint này.
Build/client/E2E sẽ lấy trusted CI mới, không gán evidence389e cho patch dirty.

Draft [PR196](https://github.com/ThienAress/htcoachingweb/pull/196) đã chuẩn bị vào
main; chưa approving review, chưa merge. Main/environment protections được giữ.

## Live evidence và giới hạn

UI15 round2 lịch sử trên SHA9a9: manual14/15, automatic12/15, diagnostic.
Không gán kết quả này cho SHA4f2 hoặc production certification.

Generic identity selector đã deploy: giữ tối đa ba câu grounded verbatim, bỏ
unrequested details trước source budget; source phải hỗ trợ retained claim.
Focused107tests/3files và AIevalPASS. Hai live probes4f2 chưa semantic PASS:
probe1 grounding621tokens nhưng no_supported_source; probe2 aborted/0tokens.
Không có bằng chứng mới cho HTTP503 hay quy toàn bộ lỗi cho selector.

Netlify ready `6ac322770dcab6000899862b`, Render live
`dep-db1i936gekts73dv8u90`: exact4f2, served assets/immutable deploy match,
API staging đúng, health ready. Không thấy quota Netlify trong deployment này.

Canonical acceptance [37263652031](https://github.com/ThienAress/htcoachingweb/actions/runs/37263652031):
general business9/9PASS; AC009FAIL trước khi ghi browser lane đầu; reliability
rounds NOT RUN. Ba capability JTIs chứng minh fixture đã qua root/variant semantic
readiness. Artifact cũ thiếu safe operation code nên chưa phân biệt Playwright,
HTTP hay registration failure. Cleanup fail-closed khi browser mutation chưa
settled là behavior có chủ đích, không phải fixture-journal filter bug.

Recovery [37264185169](https://github.com/ThienAress/htcoachingweb/actions/runs/37264185169)
PASS: verifiedtrue/residue0, alreadyCleantrue, recoveredReceiptCount0. Recovery
xác minh rồi gỡ journal/tombstone còn lại. Run acceptance cũ vẫn FAIL; không ghép
kết quả hai runs để gọi certified PASS.

## Follow-up tối thiểu đã được duyệt

Owner chọn phương án1: gỡ `SculptNavigationBoundary` import/wrapper khỏi App;
links Exercises/TDEE điều hướng bình thường, giữ assets/component preview.
E2E kiểm page đích và không có preview: desktop/mobile, keyboard, reduced motion,
Save-Data. Không đổi public routes, SEO metadata, API hoặc Assistant behavior.

Failed AC009 evidence giờ giữ sanitized operationCode và cleanupCode, kể cả
fallback cho uncoded browser error; không lưu message/stack/raw payload. Không
đổi schemaVersion, cleanup, timeout, retries, provider, quota hoặc frozen oracle.
Focused acceptance-evidence68testsPASS; navigation6testsPASS; UI regression gate
0new high-confidence blockers. Strict production releasebuildPASS, lintPASS
(0errors/1existingwarning), rendered desktop/mobile navigation reviewPASS.

## QA đã có của4f2

| Evidence | Kết quả |
|---|---|
| Reconcile workflow/dependency + KB | 20 +31testsPASS |
| Grounding/scope/toolengine | 107testsPASS |
| AI integration | 12testsPASS |
| AIeval | PASS |
| Strict staging và production releasebuild | PASS trước follow-up |
| Secret/boundary/docs privacy/agents/tool scans | PASS trước follow-up |
| PR194 CI và merge CI37262141315 | 5/5PASS mỗi run |
| AC009 / hai Plan092rounds | FAIL / NOT RUN |
| Production promotion/observation | NOT RUN |

Follow-up thay code/test làm relevant QA và candidate evidence cũ hết hiệu lực;
phải CI/deploy/certify lại exactSHA mới. Local evidence không thay trusted artifact.

## Recovery và dữ liệu production

Backup `production-logical-backup-20261005T030928Z-d59b34e648e1424e`:
83collections/4360documents, recoverypoint03:11:21.938Z. Independent Bitwarden
retrieval + downloaded archive checksum/AES/BSON/index/GridFS/isolated restore
PASS, cleanup0, productionwrites0, offDeviceRecoveryVerifiedtrue; PITRfalse.
Drive/account destination owner-attested vì browser automation không quan sát
được transfer. Xem [backup record](../operations/production/production-backup-record-2026-10-05.md).
Backup24h cần kiểm lại trước mutation/promotion.

Production readonly baseline:67KB/39published/eligible0, legacy-symmetric-v1,
không searchindex;385foods/1374exercises, beginnerchest22, reviewed safefoods0.
Owner đã duyệt bounded proposal digest
`d1c0ede94b5e0b4a807eccce98de496d858eb2cffccf3686d51fbb9249ce5750`, **chỉ sau
certified staging PASS**:26reviewed KB/rootvectors,110variants->[ ] có rollback,
allergenProfile của4nativefoods,3priceobservations giữ ngày gốc, rootindex/profile.
Giữ39legacy và2holds. Không ghi macros/calories hay claim cross-contact chưa có
bằng chứng. Target sau publish:67total/65published/26eligible/2draft holds.

Transaction helper local qua independent security review, isolated28testsPASS:
CAS exactvalue/type/presence; KB __v tăng khi apply và rollback; foreignwrite chặn
rollback; unknowncommit phải reconcile, không blind retry. Chưa có trusted
launcher/encrypted durable artifacts/liveindex/config/Adminpublish; helper PASS
không cấp production GO hoặc thay protected human approval.

## Bước còn lại

CI/deploy follow-up exactSHA, canonical AC009 và hai Plan09211/11 cùng artifact,
cleanup0. Chuẩn bị protected main PR; một approving review bắt buộc. Main merge
SHA mới phải được CI/stage/certify trước production. Hoàn thiện reviewed data
launcher/rollback/provenance/index/Admin publication trong approved scope rồi
protected production gate, exactSHA deploy và GET/HEAD observation ít nhất30phút.
Không bypass protections, nới oracle/caps hoặc mở rộng LOW polish để lấy PASS.
