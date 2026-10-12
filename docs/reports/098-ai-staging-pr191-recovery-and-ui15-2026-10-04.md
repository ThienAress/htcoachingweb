# Staging PR191 — recovery và UI15

Ngày: 2026-10-04 (Asia/Saigon). Trạng thái: backup mới đạt independent recovery;
UI15 đã chạy trên đúng PR191: **11 PASS / 2 PARTIAL / 2 FAIL (73,3%)**.
Mục tiêu ≥14/15 PASS chưa đạt; UI nguồn vẫn HOLD. Không có production promotion.

## Bản đang phục vụ

- [PR #191](https://github.com/ThienAress/htcoachingweb/pull/191) đã merge.
- Merge SHA: `ff7ff4408a1b8b1aae6e660f3586296019dd86d6`.
- Candidate SHA: `e54c65baa6e2270476abecc48b6e196a6a707288`; cùng Git tree
  `e6057c47223da2c6a982ac611e1b86c12f3cc7e8` với merge.
- [CI candidate](https://github.com/ThienAress/htcoachingweb/actions/runs/37153936222)
  và [CI merge](https://github.com/ThienAress/htcoachingweb/actions/runs/37154448406): 5/5 jobs PASS mỗi run.
- Netlify READY: `6ac1705c2df2c60008875c4a`; Render LIVE: `dep-db0n1h8u01pc73b36a0g`.
- Kiểm lại lúc `2026-10-04T03:59:32.354Z`: hai provider cùng merge SHA;
  HTML và 29 assets của staging alias khớp immutable deploy; bundle có API staging;
  backend readiness đạt. Lần kiểm ngay trước đó timeout mạng, retry thành công.
- Kiểm lại sau owner follow-up lúc `2026-10-04T07:57:35.096Z`: cùng SHA,
  HTML/29 assets khớp và backend ready; lần đầu timeout mạng, retry PASS.
- Kiểm lại trước UI15 lúc `2026-10-04T10:10:45.634Z`: cùng merge SHA,
  HTML/29 assets khớp immutable deploy, staging API trong bundle và backend ready.
  Lần kiểm đầu timeout mạng; lần kiểm lại PASS, không tăng timeout.
- Health 7/7 PASS lúc `2026-10-04T03:37:35.151Z`, sau hai liveness retries;
  security smoke 7/7 PASS sau một lần timeout. Không bỏ các failure khỏi evidence.

## Code và QA

Publisher của citation lấy từ hostname được validate; title nguồn chỉ dùng tooltip.
Lane intake bổ sung yêu cầu rõ lịch tập/giáo án dành cho cá nhân cùng calorie intent.
Metrics acceptance kiểm đủ 24 counters và fail closed khi thiếu/sai/regression.
Không tăng timeout, retry, quota hoặc nới rubric để nâng điểm.

QA cuối bổ sung cho snapshot đang pending ở báo cáo 097:

| Kiểm chứng | Kết quả |
|---|---|
| Client full | 186 files / 928 tests PASS |
| Server full | 296 files / 3347 tests PASS; 10/10 batches, exit 0 |
| Final affected suite | 4 files / 153 tests PASS sau refinement cuối |
| Citation focused | 24 tests PASS |
| Release build | PASS với API/sitemap/prerender staging; bundle budget PASS |
| Local E2E | 12 PASS, mock API; không phải live staging |
| AI eval | 73/73 PASS |
| UI regression/lint/secrets/data boundaries/docs privacy/agents | PASS |
| Bounded independent diff review | PASS; không còn HIGH/MED |

Full server bắt đầu trước refinement cuối; suite 153 tests sau refinement thay
evidence cũ cho các file bị ảnh hưởng. Không chạy lại build/tests ứng dụng trong
thao tác backup này. Candidate checkout vẫn sạch tại lần kiểm lại.

## KB và catalog

Read-only KB gần nhất lúc `2026-10-04T10:09:34.570Z`: 26 published / 2 hold,
metadata/content/source/review/embedding/indexes verified; database writes 0.
Refresh receipt nếu vượt 1 giờ trước runner.

Hai catalog updates đã được owner duyệt riêng và apply thành công lúc
`2026-10-04T10:50:32.859Z`–`10:50:34.288Z` trên `htcoaching_staging`:
Cá ngừ chỉ `allergenProfile`; Kneeling Push-up chỉ `description`/`instructions`
(cùng `updatedAt`). Transaction kiểm exact preimages và post-state trong session;
result ghi `appliedOperationCount=2`, `transactional_post_state_verified`, exit 0.
Digest `2a86db84ce1b54394323934cd721c7d8e80f08110ac9ace8abe6a9413630e54d`;
intent/result receipts lưu riêng trong local evidence directory, không chạy lại apply.
Quyền upload backup không cấp quyền mutation catalog. Plan cũ bind SHA PR190. Preview/plan mới PR191
đã sinh từ snapshot read-only `2026-10-04T04:09:35.510Z`: offline case1/5 complete,
locked foods được giữ. Chi tiết và digest mới ở
[proposal PR191](../operations/runbooks/ai-staging-catalog-followup-pr191-2026-10-04.md).
Approval/apply đã hoàn tất; chưa có lượt UI15 sau mutation, không suy preview thành live PASS.

## Backup mới

Trước khi có backup mới, backup cũ vượt policy 24 giờ; gate trả BACKUP_STALE,
UI15 bị chặn trước khi tạo fixture.
Không sửa timestamp hoặc nới policy để vượt gate.

Backup mới `production-logical-backup-20261004T034034Z-29a11f694327901d`:
LOCAL_VERIFIED lúc `2026-10-04T03:41:38.092Z`, 83 collections / 4547 documents;
encryption, integrity, decrypted dump, isolated BSON/index fingerprint và GridFS
đạt. Production writes 0; recovery residue 0.

Owner đã duyệt upload đúng archive vào destination canonical. Account chip
được kiểm trước upload; chỉ `.7z` đã upload, Drive hiển thị hoàn tất. Tải lại
qua Drive UI và preflight khớp byte size/SHA-256 với private manifest; không đọc
password hay kết nối production trong preflight. Archive/key/manifest/checksum
không nằm trong báo cáo hoặc Git.

Trước 17:04 Asia/Saigon, owner đã lưu item trong Bitwarden nhưng chưa tới PASS;
download preflight và handoff-key integrity đã kiểm lại PASS. Các trạng thái
pending bên dưới mô tả giai đoạn trước khi receipt thành công xuất hiện.

Trong giai đoạn chờ owner, independent custody/restore được giữ PENDING. Helper yêu cầu
owner lưu item Bitwarden đúng backup ID, bật master-password re-prompt, mở lại
và lấy password mới vào prompt ẩn. DPAPI chỉ dùng bàn giao ban đầu; không thay
cho independent drill. Receipt được bind exact backup và parent-generated session;
missing/wrong type/integrity/cleanup flags đều reject. Review bảo mật delta PASS;
Focused helper regression: 52/52 PASS trên fixtures synthetic, gồm từng attestation
failure, session binding, pointer overwrite, các receipt flags thiếu/sai kiểu/sai
giá trị; không tạo custody receipt khi fail. Parser PowerShell và Node syntax PASS.
Clipboard cleanup bổ sung null guard sau pure reproduction của null.TrimEnd;
không đọc hoặc in clipboard thật trong tests. Tests synthetic không thay owner execution.
Chế độ `complete-custody.ps1 -VerifySavedOnly` bỏ riêng bàn giao/copy khóa ban đầu;
ba attestations, password prompt và mọi receipt restore/cleanup gate được giữ.
Focused regression sau thêm chế độ này: 58/58 PASS, exit 0; 52 cases default
vẫn PASS, success verify-only xác minh handoff không được gọi, các attestations,
child failure và malformed restore vẫn reject. Không thay bằng chứng owner thật.
Owner báo đã nhập Password kèm yes vào câu attestation; helper từ chối trước
restore, không phải bằng chứng khóa sai. Hướng dẫn được tách thành hai bước,
luôn hiển thị exact backup ID trong verify-only. Các câu attestation dùng
Read-Host AsSecureString để tránh hiện Password khi dán nhầm; chỉ exact yes được
chấp nhận. Focused regression cuối 60/60 PASS, exit 0, gồm Password+yes/yes+Password
rejection. Receipt gates và đường restore giữ nguyên. Trong test harness, lần
đầu chuyển sang SecureString bị lỗi autoload Microsoft.PowerShell.Security;
fixture chuyển sang tạo SecureString qua .NET, không sửa môi trường/global policy.
Parser PowerShell PASS; không chạy clipboard/secret/DB thật trong regression.

Owner đã hoàn tất helper lúc `2026-10-04T10:04:46.6386057Z` (17:04:46
Asia/Saigon). Receipt custody khớp exact backup và session
`5d8f2978-bbea-4db5-a730-a7cc46f7371b`; downloaded-copy restore PASS:
83 collections / 4547 documents, AES/dump/fingerprints/GridFS/cleanup PASS,
localRecoveryDpapiUsed=false, productionConnected=false và productionWrites=0.
Root đối chiếu private manifest/transfer/receipt lúc `2026-10-04T10:07:53.062Z`;
run-owned restore directories và MongoDB processes đều 0. Query process trong
sandbox bị denied; chỉ query permitted tiếp theo được tính là verification.
Nguồn khóa là owner-attested Bitwarden, không phải direct vault inspection.
Backup-readiness pointer đã cập nhật sang backup mới với offDeviceRecoveryVerified=true;
PITR giữ false. Chi tiết ở
[backup record](../operations/production/production-backup-record-2026-10-04.md).

## UI15 live trên PR191

Hai lệnh backup release/disaster-recovery PASS trước khi tạo fixture; backup mới
6,46 giờ tuổi, không có blocker. PITR vẫn unavailable theo policy.

Lệnh: `ui15-launch-191.mjs --confirm-staging-ui15 --round=round1`, Node 22.23.1,
exit 0. Thời gian từ `2026-10-04T10:11:33.549Z` đến `2026-10-04T10:14:44.600Z`
(17:11–17:14 Asia/Saigon), run `98e04ee3-262e-4e8c-9e63-3e25e317001d`.

Playwright Chromium nhập câu hỏi vào composer và bấm Gửi trên UI staging thật,
không mock API. Request/terminal/persisted assistant/DOM được bind theo exact turn.
Backend SHA giữ nguyên `ff7ff4408a1b8b1aae6e660f3586296019dd86d6` và boot UUID
`183c7b0e-8566-4eca-8ddd-25eccf3431e2` suốt lượt. Netlify/Render/assets được
đối chiếu trước và sau lượt. Mỗi câu được gửi một lần qua UI; không sửa prompt,
rubric, quota, timeout hoặc rerun chọn điểm. Corpus là 14 câu gốc + replacement
câu 5, không gọi exact original15.

| Câu | Kết quả chấm nội dung | Bằng chứng chính |
|---|---|---|
| 1 | FAIL | safety_metadata_missing; chưa có bữa ăn hoàn chỉnh |
| 2 | PASS | 501,1 kcal / 30 g protein, không trứng |
| 3 | PASS | 501,1 kcal / 30 g protein, không sữa/whey |
| 4 | PASS | 2.196 kcal / 140,2 g protein, đủ nhóm món yêu cầu |
| 5 | FAIL | replacement_safety_metadata_missing; cá chưa được review |
| 6 | PASS | 4 bữa, 2.500,2 kcal / 170,1 g protein; giá verified 127.347đ |
| 7 | PASS | Canonical unavailable: baseline không có cơm/dầu, giữ exact plan |
| 8 | PASS | 4 buổi khác nhau, 45–55 phút, progression/deload khoảng 30% |
| 9 | PARTIAL | Card/text có 5 bài, nhưng kỹ thuật chống đẩy quỳ sai điểm tựa |
| 10 | PASS | WHO ranges và sức mạnh ≥2 ngày được primary paper hỗ trợ |
| 11 | PASS | Đủ 5 nhóm intake, không tự đoán calo/lịch tập |
| 12 | PASS | 7 ngày cụ thể, portions/cách cân, tập/nghỉ và safety wording |
| 13 | PASS | Canonical knee response, AAOS pain-stop scoped, không gửi query riêng ra web |
| 14 | PASS | TDEE form giữ các prefill; chưa tính khi thiếu dữ kiện cơ thể |
| 15 | PARTIAL | Grounded identity có nguồn, nhưng vài số liệu hiện tại đã lỗi thời |

Tổng: **11 PASS / 2 PARTIAL / 2 FAIL = 73,33%**; target ≥14/15 chưa đạt.
Baseline PR190 giữ nguyên 10 PASS / 2 PARTIAL / 3 FAIL = 66,7%.

Automated grade giữ nguyên 10 PASS / 5 FAIL; manual adjudication có sidecar riêng,
không sửa grader. Câu 8 bị text oracle đòi literal60 dù 45–55 thỏa ≤60. Câu10/15
bị host oracle nhìn redirect thay vì nguồn đích; câu10 còn dùng “cơ bắp” thay
“sức mạnh”. Các flag này được đối chiếu thủ công với frozen rubric. Câu9 dù
automated PASS vẫn hạ PARTIAL do sai kỹ thuật; câu15 không nâng PASS vì statistics
lỗi thời. PARTIAL không tính vào điểm đạt.

Câu10 được hỗ trợ trực tiếp bởi [WHO2020 authors primary paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC7719906/)
và [bản BMJ](https://bjsm.bmj.com/content/54/24/1451).
Câu15 ghi 143 bàn/226 trận quốc tế, trong khi
[UEFA current international record](https://www.uefa.com/uefanationsleague/news/0257-0e001aafb4e9-7c6ad3889ce0-1000/)
hiện ghi 146/234. Output còn ghi 34 danh hiệu/7 league titles, không cập nhật sau
[Saudi Pro League 2025–26 title](https://www.spl.com.sa/en/news/cristiano-ronaldo-double-fires-al-nassr-to-2025-26-rsl-title-glory).
Hai trang Wikipedia nguồn đích và trang tag VietNamNet không thay việc kiểm các
claim hiện tại; có citation không bảo đảm mọi số liệu đều đúng.

Nguồn chỉ hiện ở câu10/13/15, tối đa 3 nguồn unique; actual click mở exact href,
HTTPS/_blank/noopener/noreferrer PASS. **Global source UI HOLD**: chip/avatar10/15
hiện hostname redirect `vertexaisearch.cloud.google.com` và chữ V, che publisher
thật; cùng nguồn còn lặp sau nhiều đoạn. Không dùng title chưa được xác minh để
giả publisher. Cần provenance của URL đích đã xác minh và hiển thị nguồn gọn hơn.

Provider metrics quan sát grounding real success đúng một lần ở câu10 và15.
Câu11 có 4 chat requests nội bộ: 2 succeeded / 2 failed-unavailable; giữ nguyên
evidence này, không gọi toàn bộ provider attempts sạch lỗi. Các lane deterministic
khác không cần Gemini chat generation.

Cleanup PASS: verified=true, residue=0 cho users, chatconversations, usage,
memory/preferences, tool confirmations/moderation/claims và KB fixture. Không sửa
customer/catalog/2 hold entries. Những screenshot row dài có clipping do viewport
scroll; full DOM/turn/card text được giữ riêng. Literal domContainsResponse có
false negatives từ Markdown/list/source-chip rendering, không dùng làm semantic
oracle. Đây là live UI diagnostic, không phải AC009 certified release evidence.

Artifacts synthetic/private nằm trong local run directory, không commit raw
payload hoặc auth state. Backup record/pointer và report đã qua docs privacy
sau cập nhật recovery và UI15.

## Bước tiếp theo

Hai catalog records/fields trong proposal đã được owner duyệt và apply; chưa retest.
Helper đã qua 12/12 focused tests và independent security review PASS WITH WARNINGS,
không còn HIGH/MED. Root live preflight PASS: exact database/digest/SHA/preimages,
2 proposed updates và databaseWrites=0. Lần đầu timeout provider; lần tiếp gặp
ECONNREFUSED từ DNS resolver máy; lần cuối dùng resolver như UI15 runner và PASS.
Không tăng timeout, không bỏ failure khỏi evidence. Launcher chỉ được bổ sung
sanitized error stage/type và DNS resolver sau snapshot reviewer; root review/syntax
PASS cho delta này, core helper/tests giữ exact hash đã được review.

Review đã sửa các lỗi bắt được trước live mutation: post-read thiếu session,
provider proof contract mismatch, Date casting tại raw Mongo sink/rollback và
intent receipt persistence. Intent được ghi wx/write/sync/close trước transaction;
post-state kiểm trong cùng session; scope/rollback bind frozen plan. Transaction
tests là synthetic fixtures, chưa phải replica-set integration. Rollback có guarded
recipe, chưa có executable consumer. Nếu commit/receipt/disconnect không rõ kết
quả, phải đọc lại đúng hai records theo intent trước retry/rollback; exit lỗi không
chứng minh zero committed writes. Không claim filesystem power-loss test đã chạy.

Không suy quyền promotion/upload thành quyền sửa catalog. Approval riêng và
transaction/post-state đã hoàn tất; chạy lượt UI mới giữ nguyên lịch sử lượt này.
Đồng thời cần sửa provenance/chip nguồn và hạn chế những
statistics biến động không cần thiết trong câu hỏi nhận diện người nổi tiếng.

Root tích hợp evidence và quyết định; worker Sol/high kiểm helper custody,
reviewer Astra/xhigh kiểm trust boundary. Model worker là requested; execution
metadata chưa đủ để chứng nhận routing backend.
