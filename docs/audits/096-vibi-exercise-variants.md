# Plan096 — audit kỹ thuật biến thể bài tập

## Kết quả và phạm vi

Snapshot **fresh staging**: `2026-10-07T06:50:58.040Z`, database
`htcoaching_staging`, 122 Exercise, database writes **0**. Query chỉ tên Hindu,
split squat, Romanian, hip hinge, row nguyên từ, pike, wide hand và kneeling push.
Projection chỉ ID/name/muscleGroup/description/instructions/updatedAt.

Snapshot manifest `.local-data/plan096-catalog/fresh-exercise-catalog-20261007.json`
tham chiếu 25 JSON chunks, mỗi chunk có SHA-256 canonical và count. Đây là dữ liệu
fresh, thay thế baseline 03–04/10 trong audit này. DNS mặc định ban đầu trả
ECONNREFUSED; retry dùng DNS public giống helper staging có sẵn đã thành công.
Không thay đổi config hệ thống và không gọi paid inference.

Subtask MODERATE: audit catalog và chuẩn bị patch, không apply. Đã dùng checklist
impact-check/cleanup-delivery theo phạm vi dữ liệu public, không sửa server/client.
PASS dưới đây nghĩa là không phát hiện mâu thuẫn kỹ thuật trong record đã xem;
không phải chứng nhận lâm sàng, không phải live UI15 PASS.

## Audit theo exact record

### Push-up và pike

- **PASS** `6a4b4c41a5de82055378b184`, `Kneeling Push-up (male)`:
  fresh record đã đổi từ 04/10, updatedAt `2026-10-04T10:50:32.859Z`.
  Bắt đầu trên tay/gối; trục đầu–vai–hông–gối; gập/duỗi khuỷu có kiểm soát;
  tránh võng lưng/nâng hông; có “dừng nếu đau”. Phù hợp [S1/S2]. Không patch lại.
- **REVIEW** `6aba249677525bdd97fb1b57`, `Modified Hindu Push-up (male)`:
  description chỉ plank và hạ thân, instructions là generic push-up; không có
  chuyển tiếp pike/cobra hay định nghĩa phần “modified”. Chưa có nguồn primary
  đủ định nghĩa exact biến thể này; cần đối chiếu media/provenance gốc trước sửa.
  Không suy `Modified Hindu` = Hindu cổ điển = kneeling push-up.
- **REVIEW** `6aba249677525bdd97fb1b76`, `Pike-to-cobra Push-up`:
  description có V ngược nhưng instructions yêu cầu thân thành một khối kiểu
  push-up thường, thiếu chuyển tiếp cobra. Muscle group hiện là đùi; cần review
  riêng, không patch muscle group khi scope chỉ technique. Không gọi đây là
  Pike Push-up tiêu chuẩn.
- **REVIEW** `6aba249677525bdd97fb1a51`, `Exercise Ball Pike Push Up`:
  description có cẳng chân trên bóng và cuộn bóng nâng hông; generic instructions
  không diễn tả trình tự pike. Không thay bằng TRX pike [S8] vì khác điểm tựa.
- **REVIEW** `6aba249677525bdd97fb1c8d`, `Wide Hand Push Up`:
  setup tay rộng đúng tên, nhưng “khuỷu tay sát thân người” là cue đáng review
  trong tư thế tay rộng; chưa đủ nguồn để áp một góc khuỷu cố định. Nghiên cứu
  [S3] xác nhận có hand-width variants, không chứng minh wide hơn luôn tốt hơn.
- **ABSENT**: không có exact `Hindu Push-up`, `Pike Push-up` hoặc `Hip Hinge`
  trong query. Không tạo thêm record hay đổi tên biến thể sẵn có.

### Split squat và hip hinge

- **PASS / cần biên tập thêm** `6aba249677525bdd97fb184f`, `Bulgarian Split Squat`:
  description có chân sau trên ghế; instructions hạ qua gập gối/hông và đạp chân
  trụ, giữ pelvis/core ổn định; phù hợp pattern rear-foot-elevated của [S4].
  ROM không được lượng hóa và câu “cực kỳ hiệu quả” chưa có benchmark; không
  coi thiếu chi tiết là lỗi variant để tự sửa. Setup ghế vững vẫn cần kiểm tra.
- **PASS** `6aba249677525bdd97fb17ff`, `Barbell Romanian Deadlift`:
  instructions có hông ra sau, gối chùng, tải sát thân và tránh ngả lưng;
  description ngắn, không mâu thuẫn hip hinge [S5/S6]. Không bắt buộc stance
  ngang hông thay ngang vai vì không có một khoảng cách duy nhất cho mọi người.
- **NEEDS_CHANGE** `6aba249677525bdd97fb19db`, `Dumbbell Romanian Deadlift`:
  description yêu cầu “hạ tạ xuống đất” và dùng “xoay hông”, dễ hiểu thành mục
  tiêu chạm sàn/rotation. [S5/S6] mô tả hinge ra sau, gối hơi chùng, spine ổn định,
  ROM theo căng mặt sau đùi. Patch chỉ description: gập tại hông, tạ sát chân,
  hạ đến biên độ kiểm soát được, không bắt buộc chạm sàn. Instructions giữ nguyên.
- Các split-squat khác có trong snapshot để đối chiếu, không được auto-coerce
  thành Bulgarian: band/side/barbell/smith/suspended có thể là biến thể khác.

### Row variants

Có 102 tên chứa whole-word `row`. Audit kỹ thuật có chủ đích chọn 13 record dưới
đây, không tuyên bố toàn bộ 102 đã certified. Các record ngoài mẫu giữ REVIEW.

| Exact name | ID | Status và căn cứ |
|---|---|---|
| Barbell Bent Over Row | `6aba249677525bdd97fb17ae` | PASS: hinge, spine trung lập, khuỷu ra sau, hạ tải chậm; [S7/S9] |
| Dumbbell Bent Over Row | `6aba249677525bdd97fb1926` | PASS: hinge/core, kéo/hạ có kiểm soát; [S7] |
| Dumbbell One Arm Bent-over Row | `6aba249677525bdd97fb1993` | PASS: gối chùng, hinge và chống xoay ở instructions; [S7] |
| Dumbbell Row (1 tay) | `6aba249677525bdd97fb19dd` | PASS: tay tựa ghế; elbow-driven pull, kiểm soát thân; [S7], không bắt buộc hai gối trên sàn |
| Dumbbell Row 2 tay | `6aba249677525bdd97fb19de` | PASS: hai tạ, hinge; cue ổn định/hạ chậm; [S7] |
| Cable Seated Row | `6aba249677525bdd97fb18bf` | PASS: seated/foot support, kéo tải về thân, chống giật; [S9] |
| Inverted Row | `6aba249677525bdd97fb1ab1` | NEEDS_CHANGE: bắt đầu đứng đối diện thanh/dây thay vì treo dưới thanh; patch theo [S9/S10] |
| Inverted Row Bent Knees | `6aba249677525bdd97fb1ab2` | REVIEW: setup dưới thanh đúng; thiếu gối gập trong instructions, cần exact demo |
| Barbell Pendlay Row | `6aba249677525bdd97fb17e7` | REVIEW: chưa mô tả reset trên sàn; không tự biến thành bent-over row |
| Pendlay Row | `6aba249677525bdd97fb1b74` | REVIEW: có kéo từ sàn nhưng instructions generic; cần nguồn variant |
| Chest-Supported Row | `6aba249677525bdd97fb18fb` | REVIEW: có tựa ngực/ghế; “cô lập” quá mạnh, thiếu demo ghế/ROM |
| Seal Row (nằm đẩy tạ) | `6aba249677525bdd97fb1bbe` | REVIEW: tên Việt “đẩy” trái description “kéo”; không đổi identity trong patch technique |
| Suspended Row | `6aba249677525bdd97fb1c48` | REVIEW: điểm neo có, generic instructions kéo tải chưa mô tả kéo thân; cần demo hệ treo |

Không có field contraindications riêng trong Exercise schema. Safety thực nằm
trong prose; đa số record thiếu cue dừng khi đau. Đây là completeness gap, không
phải bằng chứng mỗi bài chống chỉ định với một bệnh cụ thể. Không thêm medical
contraindication/chẩn đoán hay lời hứa hết đau. Không suy nghiên cứu EMG thành
khuyến nghị phù hợp cá nhân hoặc cơ nào được “cô lập” hoàn toàn.

## Nguồn primary được đọc ngày 07/10/2026

- S1: [ACE Bent Knee Push-up](https://www.acefitness.org/resources/everyone/exercise-library/13/bent-knee-push-up/).
- S2: [Mayo Modified Pushup](https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/modified-pushup/vid-20084674).
- S3: [Cogley et al., hand positions / PMID 16095413](https://pubmed.ncbi.nlm.nih.gov/16095413/).
- S4: [ACE Bulgarian Split Squat](https://www.acefitness.org/resources/everyone/exercise-library/366/bulgarian-split-squat/).
- S5: [ACE Romanian Deadlift](https://www.acefitness.org/resources/everyone/exercise-library/317/romanian-deadlift/).
- S6: [ACE Hip Hinge](https://www.acefitness.org/resources/everyone/exercise-library/33/hip-hinge/).
- S7: [Mayo Bent-over Row](https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/bent-over-row/vid-20084680).
- S8: [ACE TRX Suspended Pike](https://www.acefitness.org/resources/everyone/exercise-library/88/trx-reg-suspended-pike/).
- S9: [ACE-sponsored back research: technique protocols](https://www.acefitness.org/continuing-education/certified/april-2018/6959/ace-sponsored-research-what-is-the-best-back-exercise/).
- S10: [ACE Inverted Row demonstration](https://www.acefitness.org/resources/everyone/blog/5342/obstacle-course-inspired-workout/).

Các primary sources trên hỗ trợ kỹ thuật ở phạm vi ghi rõ, không được viện dẫn
cho Modified Hindu chưa xác minh. Tìm kiếm chưa tìm nguồn official đủ định nghĩa
exact Modified Hindu; không dùng forum/Wikipedia để bịa một chuẩn bắt buộc.

## Patch, impact và rollback

`catalog-patches.json`: đúng 2 patches, exact ID/name/preimage từ snapshot fresh.
Dumbbell RDL thay description; Inverted Row thay description/instructions.
Không đổi name, muscleGroup, media, technicalDifficulty, schema hoặc registry.
Cả hai update `updatedAt`; mọi field khác giữ nguyên.

Consumers đã trace: `server/src/models/Exercise.js` (prose + instruction schema),
`server/src/controllers/exercise.controller.js` (public serialization/admin update),
`server/src/routes/exercise.routes.js` (public GET), AI search dùng catalog Exercise.
Không dùng admin endpoint vì endpoint có side effect schedule build. Runner là
exact-ID Mongo update trong transaction, không seed/cleanup và không trigger deploy.
Không sửa marker rollout cũ. Root cần chạy case9 mới; 2 patches không đủ biến
mọi REVIEW thành PASS và không chứng minh 15/15.

Guard: target exact staging/collection, confirmation env, reviewed plan SHA-256,
read-only snapshot ≤15 phút, exact ID/name/full edited preimage + updatedAt;
read/check/update/post-check cùng transaction, compare-and-set đầy đủ. Intent
receipt ghi **trước** DB write, gồm before và planned after timestamp; completion
receipt ghi sau transaction. Nếu completion file lỗi sau commit, dùng intent và
read-only reconcile; không rerun mù. Rollback kiểm receipt bound plan digest,
exact current postimage, rồi restore edited fields + timestamp trong transaction.

Lệnh dành cho root sau khi review payload, lấy digest bằng verify; `<digest>` và
file paths là tham số cụ thể cần điền, không phải quyền apply của catalog worker:

```powershell
node .local-data/plan096-catalog/verify.mjs
node .local-data/plan096-catalog/read-staging-exercise-catalog.mjs <fresh-snapshot.json>
$env:CONFIRM_PLAN096_CATALOG_APPLY='yes'
node .local-data/plan096-catalog/apply.mjs --apply --snapshot=<fresh-snapshot.json> --receipt=<intent.json> --expected-digest=<digest>
$env:CONFIRM_PLAN096_CATALOG_ROLLBACK='yes'
node .local-data/plan096-catalog/rollback.mjs --rollback --receipt=<intent.json> --expected-digest=<digest>
```

## Verification và giới hạn

`node .local-data/plan096-catalog/verify.mjs`: PASS (offline), validates 122 snapshot
records/chunk hashes, 2 exact preimages, stale/target/name/content drift rejection,
plan digest, receipt tampering và confirmation guards. `node --check` mọi script
PASS. Không chạy apply/rollback network; transaction behavior chưa integration-test
với Mongo thật. Không chạy build/lint client vì không thay app source.

Chưa làm: nguồn/demo exact Modified Hindu/Pike và các row REVIEW; apply 2 patches;
live case9 trên SHA mới. Không coi audit này là gate certification hoàn tất.
