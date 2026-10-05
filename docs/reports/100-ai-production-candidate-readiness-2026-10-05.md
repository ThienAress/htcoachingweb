# Assistant production candidate — 2026-10-05

## Kết luận

**Production NO-GO tại checkpoint này.** PR194 đã merge/deploy staging đúng
`4f2e9b6c3ba5506775ed207b8155eac34c46d8ed`, trusted CI 5/5 PASS. Certified AC009
chưa đạt; hai Plan092 rounds chưa chạy. Recovery đã xác minh residue 0.
Chưa có production deployment hoặc production data write trong đợt này.

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
