# Plan 087 — Bàn giao nhận diện và kết quả đo thành phần cơ thể

Ngày: 2026-09-09. Kết quả: hoàn tất implementation và LOCAL FULL verification;
không deploy. HEAD nền `196198a7c661e3c32fac6149a13475b5d30b93b4`; worktree
đã có nhiều thay đổi 086 trước task và được giữ nguyên. Không nhận toàn diff là087.

## Kết quả

- Logo designer theo surface: wordmark desktop, mark mobile/login/loading,
  footer lockup theo minimum size; corrected alt và reduced-motion visibility.
- Sáu SVG runtime nguyên bản đối chiếu SHA256 với nguồn; giữ source/license.
  Icon namespace ht-v2: SVG,ICO16/32/48,PNG96,Apple180,PWA192/512 any/maskable.
- Organization/publisher logo riêng tại Home/BlogDetail/CustomerStoryDetail.
- Báo cáo tuần thêm hipCm/abdomenCm optional/null, nhóm form, tỷ lệ eo/hông
  cùng record; đồng bộ schema/patch/DTO/notification missing fields/progress/export.
- BodyAssessment độc lập: draft,publish,revision,receipt; CAS/transaction,
  replay authorization, correction reason, no draft leakage và notification
  cùng transaction. Client đã xóa bị từ chối dù Order còn giữ.
- Form HLV trong Mục tiêu sức khỏe, mục đọc chung dưới Sức khỏe trung bình;
  hai diagram, mode bảng, mobile tab, so sánh cặp ngày thật/delta/history vùng.
- Privacy export/delete đủ families; account deletion cascade và rollback
  test; retention deadline theo registry hiện có, không mới TTL hoặc auto sweep.

## Files/contract chính

| Contract | Producer | Consumers đã kiểm |
|---|---|---|
| Artwork | public/branding/ht-v2 + generate-brand-icons.js | BrandLogo,Header,Footer,Login,Loading,JSON-LD,index.html |
| Số đo vòng | WeeklyCheckin + weeklyCheckinPatch/Dto | WeeklyCheckinFields,TrainerWeeklyReview,progressSources/ReadModel,BodyProgressReport,privacy,notification labels |
| Kết quả đo | BodyAssessment/Revision/Command + bodyAssessment services/routes | TrainerBodyAssessment,BodyAssessmentReport/History,notification,account deletion,retention registry |
| Phân quyền | protect/requireTrainerActor + current User/Order | list/read/save/publish/replay/privacy + Query actor/client prefix |

Endpoint `/api/body-assessments`: self published list, trainer list/read/save/
publish, self privacy export/delete. Không thêm public page/route SEO.
Đây là dữ liệu sức khỏe; không dùng ảnh thật hoặc tài khoản production trong tests.

## Validation thực tế

| Command | Kết quả |
|---|---|
| npm run test:unit:client | PASS753 tests /163 files; focused cuối86 PASS |
| npm run test:unit:server | PASS1421 tests /236 files trên Node22.23.1 |
| focused progress HTTP/read-model | PASS18 tests sau thêm case circumference-only |
| npm run test:e2e -- --workers=2 | PASS112 tests (7.7 phút), exit0 |
| npm run build --prefix client | PASS exit0, đầy đủ prebuild/build/postbuild |
| npm run lint --prefix client | PASS exit0; warning cũ TrainerTransferPanel watch |
| npm run ui:audit -- --baseline scripts/ui-audit/baseline.json --fail-on-new-high | PASS0 new blocking, không đổi baseline |
| npm run security:secrets | PASS |
| npm run security:data-boundaries | PASS0 violations |
| npm run agents:validate | PASS29 skills, traceability đủ |
| git diff --check | PASS |

Lần server đầu bị Node24 gate chặn; dùng runtime22.23.1 có sẵn và chạy lại
canonical runner. Một số batch báo memory Mongo child teardown timeout nhưng
runner ghi JSON đầy đủ và từng batch exit0; không sửa runner hoặc bỏ test.

E2E lần đầu109/112: mock thiếu fields quyền coaching từ086; mock cũng chạy qua
nửa đêm nên route ngày cũ không match. Chỉ bổ sung mock eligibility đúng contract,
restart fixture ngày mới;15 Dashboard tests PASS rồi full112 PASS. Lượt cuối
Windows kẹt teardown; root xác minh PID đúng Vite4174/mockAPI5100 do lượt test tạo,
dừng đúng hai helper và runner kết thúc exit0. Không kill process ngoài scope.
Browser E2E dùng mock API, bảo vệ hành vi frontend; backend mutation/security được
chứng minh riêng bằng Supertest + MongoDB in-memory replica set.

Release build dùng Node chuẩn và VITE_API_URL công khai, chỉ GET nội dung.
Prefetch public content có timeout, generator fallback cohort hiện hữu. Final
prerender có HTML, bundle budget pass và search index10 Recipe+10 Exercise pass.
Kiểm file HTML Home/blog/story xác nhận favicon ht-v2 và organization-logo mới.
Không suy ra production index/GSC/CWV hoặc nội dung live đều đã verified.
Chỉ phục hồi date-only sitemap source do build tạo; không sửa cấu hình sitemap.

## Review độc lập và UI

Ba agents: brand artwork+icon, weekly fields/report/E2E, assessment backend+
form regression; root tích hợp shared files, đọc review và chịu trách nhiệm kết quả.

Findings đã sửa và xác nhận:

- HIGH: retained Order cho phép tái tạo dữ liệu khách đã xóa → thêm User existence
  guard cả transaction/replay và regression HTTP.
- P2: reconnect/refetch làm mất bản nhập → tắt reconnect cho editor, reload explicit.
- P2: date prop đổi kỳ bỏ qua guard → cố định selected period khởi tạo.
- Render: trunk input62px ở320 che số28.5 → chuyển hàng đủ rộng, nền field riêng.
  Confirmation320: trunk128.85px, arm/leg95.73px, input44px,28.5/118.1 đọc đủ.
- Render: history font/ticks nhỏ → explicit heading và responsive SVG viewBox.

UI scoped scorecard (không phải audit toàn website): slop4/5, contrast4/5,
typography4/5, layout4/5, motion4/5, interaction4/5, accessibility4/5,
responsive4/5. No new blocking finding; màu không phải tín hiệu duy nhất,
bảng lịch sử là alternative accessible; bảng so sánh mobile scroll trong khối.

Evidence local ignored: `.local-data/brand-087/` (logo/form1440,1024,390,320 và
favicon16/32/48), `test-results/` (E2E screenshot/report/weekly).
Evidence máy `.local-data/qa-evidence/087-final.json` được tạo sau final docs;
self-attested, không là quyền release và không thay nguồn log thực thi.

## Boundaries / phần chưa chạy

- Chưa deploy staging/production, chưa nhập kết quả đo thật, chưa chạy migration/backfill.
- Review release phát hiện production tắt `autoIndex`; đã bổ sung migration
  tạo/verify bảy index, preflight duplicate/conflict, và flag
  `BODY_ASSESSMENT_WRITES_ENABLED=false` fail-closed. Migration chưa chạy;
  làm theo `docs/operations/runbooks/body-assessment-indexes.md`.
- Không OCR/upload phiếu InBody, không tự sinh % tham chiếu hoặc chẩn đoán tốt/xấu.
- Favicon cache thực trên máy người dùng/Google chưa thể xác nhận trước rollout.
- Kiểm browser local Chromium; chưa kiểm trực tiếp iPhone/Safari hoặc thiết bị đo.
- EPS/PDF nguồn designer không render lại; runtime dùng SVG đã kiểm và nguồn PNG.
- Admin vẫn cần assignment cho kết quả đo; không có blanket access mới.
- No clinical default interpretation; % khác thiết bị/basis không tự tính delta.
- BodyAssessment retention chỉ tham gia deadline+candidate lifecycle, không thêm
  endpoint tự động thực thi xóa. Privacy explicit/account deletion đã kiểm đầy đủ.
