# Assistant production candidate — 2026-10-05

## Kết luận hiện tại

Backup mới đã xác minh recovery độc lập. Bản sửa identity scope đủ điều kiện đưa
qua CI/staging để kiểm chứng live. **Production vẫn NO-GO**: chưa có certified
acceptance cho bản vá và dữ liệu production chưa đáp ứng retrieval/catalog gates.
Chưa có production deployment hoặc production data write trong đợt này.

## Câu 15 và bản sửa tối thiểu

Trace lần abort trước phù hợp local tool deadline15s, không chứng minh HTTP503.
Một probe Playwright Chromium thật trên staging SHA
`9a9b1ae0fda22ce3e34ecaab62aa36a9cfe67541` đã hoàn thành: một grounding request,
598tokens, ba nguồn click-verified, có rendered/persisted answer và SSEdone;
cleanup verified/residue0. Tuy nhiên scope FAIL: tự thêm club hiện tại,
awards và số bàn thắng. Probe thành công không được đổi thành semanticPASS.

Sửa `knowledgeAnswerScope.js` và `searchKnowledge.tool.js`, kèm hai testfiles:
generic identity giữ tối đa ba câu grounded verbatim; loại chi tiết chưa hỏi
trước global source budget; nguồn chỉ gắn với retained claim. Source validity
được kiểm trước sentencebudget; dedupe không làm mất budget. Tên có số/keyword
như50Cent/CaptainAmerica/ClubAmérica không bị coi là yêu cầu statistics.
Explicit detail query giữ phạm vi chi tiết. Không đổi timeout/retry/model/quota,
không đổi corpus/grader/oracle và không mở rộng LOW UI polish.

RED regression đã quan sát; final focused suite107tests/3filesPASS và AIevalPASS.
Independent reviewer không có actionableBLOCK/HIGH/MED trong scope. Bản vá chưa
có live proof tại checkpoint này. UI15round2 lịch sử vẫn manual14/15,
automatic12/15 trên9a9; diagnostic không thay AC009/Plan092 certification.

## Candidate và QA

Nhánh `codex/assistant-production-release-20261005` ở checkout cô lập;
base7485f35 đã hợp nhất mainfe9ab8e, giữ main-only KB workflows và securityfixes.
Root checkout nhiều dirtyfiles ngoài scope được giữ nguyên.

| Evidence | Kết quả |
|---|---|
| Reconcile workflow/dependency | 20testsPASS |
| Reconcile KB scripts | 31testsPASS |
| Grounding/scope/toolengine | 107testsPASS |
| AI integration | 12testsPASS |
| AIeval sau final scope patch | PASS |
| Strict staging release build | PASS; staging API/sitemap/prerender origins |
| Secret/data-boundary scans, tool validator | PASS ở local checkpoint |
| Trusted CI của bản mới | PENDING |
| Exact SHA deployed staging của bản mới | PENDING |
| AC009 và hai Plan092rounds11/11 | PENDING |
| Production promotion/observation | NOT RUN |

Build production trước đó không đạt dynamiccohort gate; không gọi đó làPASS.
Staging releasebuild không chứng minh production data readiness. Local evidence
không thay trusted CI/artifact hoặc protected approval.

## Recovery

Backup `production-logical-backup-20261005T030928Z-d59b34e648e1424e`:
83collections/4360documents; encryptedintegrity, BSON/index/GridFS và isolated
restorePASS. Recoverypoint03:11:21.938Z; rootfinalize03:36:06.442Z.
Owner xác nhận archive-only transfer đến canonicalDrive; browser automation
không quan sát được transfer. Downloaded size/checksum được helper kiểm chứng,
khóa được lấy lại từ Bitwarden; không dùng localDPAPI trong offdevice drill.
Cleanup0, productionwrites0, offDeviceRecoveryVerifiedtrue; PITRfalse.
Xem [backup record](../operations/production/production-backup-record-2026-10-05.md).

## Production data blocker

Read-only audit exact `gym-app`:67KBtotal/39published/eligible0,
legacy-symmetric-v1, embeddingready67 nhưng chưa review đủ và không searchindex.
39legacy thiếu review/evidence;28source-backed vẫn needs_review.
All28 stableIDs tồn tại đúng một lần; answer của28 khác staging editorial.
Staging26published/2hold không tự được đưa sang production khi deploycode.

Catalog có385foods/1374exercises, beginnerchest22; reviewed safefoods0 và
freshpriced safefoods0. Bốn foodIDs staging khác nativeproductionIDs, nên không
copy theo stagingID. Cần kiểm nutrition/source/price correspondence rồi chuẩn bị
proposal bounded cho26KB, haihold giữ nguyên, metadata bốn nativefoods và
ba priceobservations. Chưa có quyền productiondata mutation; chưa apply.

## Bước còn lại và ranh giới

Push/PR vào staging theo quyền đã có; trusted CI5/5 rồi deploy cùng exactSHA.
Chạy identityUI probe, AC009 và hai Plan092rounds11/11 với cleanup0 và artifact
cùng SHA. Productiondata proposal phải được owner duyệt trước mutation.
Main protected cần approvingreview; không bypass. Merge main tạoSHA mới phải
stage/CI/acceptance lại SHA đó trước deployproduction. Sau promotion, chỉ GET/HEAD
observation ít nhất30phút và postdeploygatePASS mới kết luậnKEEP.

Runtime/deploy identity, recipe/APIalias connectivity và currentrecovery tuổi24h
cần reverify trước promotion. Không biến unknown/stale/mismatch thànhPASS.
