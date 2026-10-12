# Catalog follow-up trên PR191

APPLIED / TRANSACTIONAL POST-STATE VERIFIED; owner đã duyệt đúng hai updates.
Target `htcoaching_staging`,
SHA `ff7ff4408a1b8b1aae6e660f3586296019dd86d6`.
Snapshot read-only `2026-10-04T04:09:35.510Z`: 386 foods, exact Exercise identity,
database writes 0. Giữ nguyên plan PR190 làm evidence lịch sử.

| Record | Fields đề xuất |
|---|---|
| Cá ngừ `6a7ae5a3828bd6ac69ce62e9` | Chỉ allergenProfile: reviewed; contains fish; mayContain/reviewedScopes/specificContains rỗng; sourceType official_database; sourceUrl USDA FDC inventory; reviewedAt thực tế |
| Kneeling Push-up (male) `6a4b4c41a5de82055378b184` | Chỉ description/instructions: gối làm điểm tựa, thân từ đầu đến gối ổn định, hạ/đẩy có kiểm soát, dừng nếu đau |

Không thay nutrition, prices, media, difficulty, schema, quota hoặc runtime limits.
updatedAt đổi khi apply; giữ exact preimages để rollback và abort khi drift.

[USDA FDC inventory](https://fdc.nal.usda.gov/log/) có tuna;
[USDA SR Legacy table](https://www.nal.usda.gov/sites/default/files/page-files/EPA.pdf)
phân loại tuna là fish. Chỉ review identity/taxonomy của ingredient chung, không
gán species/SKU hoặc xác minh macros. [FDA](https://www.fda.gov/food/buy-store-serve-safe-food/food-allergies-what-you-need-know)
liệt kê fish là major allergen và yêu cầu đọc nhãn. mayContain rỗng có nghĩa chưa
ghi nhận dữ liệu cross-contact, không phải bảo đảm an toàn. Package-label,
manufacturer hoặc no-cross-contact requests vẫn fail closed.

[ACE](https://www.acefitness.org/resources/everyone/exercise-library/13/bent-knee-push-up/)
và [Mayo Clinic](https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/modified-pushup/vid-20084674)
hỗ trợ kỹ thuật dùng gối làm điểm tựa, thân ổn định, chuyển động có kiểm soát.
Nội dung là paraphrase, không hứa điều trị/hết đau. Đã kiểm lại nguồn ngày 2026-10-04.

Offline preview dùng code candidate PR191 và meal case4 đã thu từ UI PR190:

- Case1: safety_metadata_missing → complete, 600,2 kcal / 45,2 g protein.
- Case5: replacement_safety_metadata_missing → complete,
  2.196,4 kcal / 152,6 g protein; thay hai vị trí đậu phụ, giữ mọi món khác.
- Chưa phải live PASS hoặc bảo đảm ≥90%.

Preview đầu dùng sourceUrl PDF USDA bị runtime host allowlist reject; giữ failure
artifact. Preview sau dùng FDC inventory có evidence tuna và đã nằm trong allowlist.
Không mở rộng allowlist hoặc đổi safety guard.

Plan mới sinh từ snapshot, không sửa digest cũ bằng tay:
`.local-data/staging-ai-resume-20261003/catalog-followup-plan-191.json`.
Digest `2a86db84ce1b54394323934cd721c7d8e80f08110ac9ace8abe6a9413630e54d`.

Trước apply cần approval cụ thể hai records/fields, backup/off-device recovery PASS,
exact SHA/database/digest/preimage preflight, transaction, post-state verification
và rollback receipt. Quyền upload backup/promotion Git không cấp quyền catalog.
Nếu drift, tạo lại preview/plan và review. Rollback sửa exercise này trước khi
rollback cohort cũ; không sửa marker để bỏ guard.

## Execution evidence

Owner duyệt ngày 2026-10-04; apply từ `2026-10-04T10:50:32.859Z` đến
`10:50:34.288Z`, exit 0. Result: `appliedOperationCount=2`,
`verification=transactional_post_state_verified`. Exact database/SHA/digest và
preimages đã kiểm lại trước transaction; post-state reads cùng session PASS.
Intent/result receipts nằm trong `.local-data/staging-ai-resume-20261003/`:
`catalog-apply-191-intent-2026-10-04T10-50-32-859Z.json` và
`catalog-apply-191-result-2026-10-04T10-50-34-288Z.json`.
Chưa retest UI15 sau apply; không chạy lại apply hoặc thay đổi thêm fields.

## Prepared execution — lịch sử trước apply

`catalog-apply-191.mjs` và launcher local đã được chuẩn bị. Mặc định launcher
chỉ preflight read-only; 12/12 focused tests PASS, independent security review
PASS WITH WARNINGS. Live preflight đã khớp preimages/digest/SHA, database writes 0.
Không có quyền apply từ kết quả này. Root đã sửa resolver sau một lỗi mạng/DNS;
không tăng timeout hoặc lược bỏ failure khỏi evidence.

Apply yêu cầu explicit owner approval đúng hai records/fields, cờ `--apply`,
`--confirm-catalog-followup-191`, exact `--expected-plan-digest`, cùng confirmation
environment của operator. Provider proof được lấy lại ngay trước chạy, không dùng
RELEASE_SHA tự khai làm bằng chứng runtime. Backup cần cả release/recovery ready.

Intent receipt lưu exact preimages/intended postimages với wx/write/sync/close
trước mutation; hai updates và post-state reads dùng chung transaction session.
Date fields được cast thành BSON Date trước sink; JSON receipt dùng ISO. Rollback
recipe yêu cầu frozen plan hash, exact current postimages, hai ID/field allowlist
và chuyển Date từ JSON trở lại BSON. Chưa có executable rollback consumer.

Unit fixtures chưa chứng minh replica-set atomicity hoặc power-loss durability.
Nếu gặp unknown commit, lỗi result receipt hoặc disconnect sau transaction, đọc
lại hai records theo durable intent để reconcile trước retry/rollback. Không suy
exit code lỗi thành “chưa ghi”. Không tự retry khi trạng thái commit còn unknown.
