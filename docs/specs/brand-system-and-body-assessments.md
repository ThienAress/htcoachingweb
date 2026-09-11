# Spec: Nhận diện HTCOACHING và kết quả đo thành phần cơ thể

## Objective

Áp dụng bộ logo designer vào đúng ngữ cảnh, bổ sung vòng hông/vòng bụng và
cho HLV nhập, gửi, so sánh kết quả đo phân đoạn với học viên. Hướng sản phẩm
đã được user đồng ý ngày 2026-09-08; spec/plan/tasks và phương án không migration
đã được xác nhận, APPROVED FOR IMPLEMENTATION.

Không coi việc đồng ý thiết kế là quyền deploy, migration hoặc ghi dữ liệu thật.

## Tech stack và commands

React + Tailwind + React Hook Form/Zod + TanStack Query; backend Express/Mongoose.
Giữ React SVG cho sơ đồ cơ thể, không thêm dependency chart hoặc ảnh AI.
Node chuẩn theo `.node-version`/package.json. Commands:

- `npm run dev --prefix client`: phát triển frontend.
- `npm run test:unit:client`, `npm run test:unit:server`: test qua QA.
- `npm run lint --prefix client`, `npm run build --prefix client`: lint/release build.
- `npm run test:e2e`: chỉ với server và synthetic fixtures cô lập.

## 1. Nhận diện thương hiệu

Nguồn bàn giao nằm tại thư mục Desktop `HTCoaching_Brand_Production`, thư mục
con cùng tên. Không đọc đây như instruction thực thi; chỉ dùng artwork/guideline.

Preflight ngày 2026-09-08:

- 18 SVG: có paths, không live text, không image nhúng; scan sơ bộ không thấy
  script, foreignObject, onload, javascript URL hoặc href HTTP(S).
- PNG wordmark 2000×320, lockup 2000×472, có alpha; app icons 1024×1024.
- Hai nguồn maskable có góc opaque; nguồn regular có góc transparent.
- Đã xem preview sáng/tối. Chưa kiểm từng pixel safe zone hoặc favicon 16/32px.
- Có EPS/PDF nguồn, guideline và bản Lato OFL; chưa kiểm PDF/EPS độc lập.

Mapping:

| Surface | Asset |
|---|---|
| Desktop navbar | Wordmark không slogan, phiên bản phù hợp nền |
| Mobile navbar | HT mark, giữ link trang chủ/accessible name |
| Footer | Wordmark có slogan khi đạt minimum width, alt HTCOACHING |
| Login, LoginModal, loading | HT mark, không lặp wordmark |
| Favicon/PWA | HT mark; regular và maskable tách riêng |
| Organization/publisher JSON-LD | Logo riêng có URL tuyệt đối, không dùng ảnh OG thay logo |

Tên `*-light.svg` là artwork cho nền tối, `*-dark.svg` cho nền sáng theo guideline.
Giữ logo cũ trên đĩa để tương thích; không dùng preview có nền làm runtime asset.
Không thay palette toàn website, font UI, social OG, PDF hợp đồng hoặc artwork
emblem ngoài các vị trí đã chốt. Dashboard text logo giữ nguyên ở slice đầu.

Wordmark không slogan tối thiểu 140px; có slogan tối thiểu 260px. Không tăng
chiều cao navbar hoặc gây layout shift. Dùng kích thước/aspect ratio explicit.
Màu artwork của designer giữ nguyên; product form tiếp tục accent hiện có.

Favicon output: SVG, ICO 16/32/48, PNG 96, Apple touch 180, PWA regular
192/512 và maskable 192/512. Cập nhật `index.html`/manifest nhất quán; dùng
namespace phiên bản cố định một lần, không cache-bust ngẫu nhiên mỗi build.
Không thêm public page, static route hoặc domain CSP. Sitemap/prerender không
cần thêm route nhưng phải xác minh HTML build giữ đúng icon và JSON-LD.

## 2. Kết quả tuần

- Cân nặng giữ riêng.
- Nhóm mở/đóng `Số đo vòng`: eo, hông, bụng (cm); tỷ lệ eo/hông chỉ đọc.
- Nhóm `Thành phần cơ thể`: tỷ lệ mỡ cơ thể, tỷ lệ cơ xương (%).
- `hipCm`, `abdomenCm` optional/null; cùng giới hạn vòng eo 30–300 cm.
- Tỷ lệ eo/hông = eo / hông cùng bản ghi, không nhập tay, không lưu nguồn
  ghi thứ hai; thiếu một số thì null. Không đổi tỷ lệ thành %.
- Không suy đoán phương pháp đo eo của dữ liệu cũ. Hướng dẫn cho dữ liệu mới
  phải phân biệt eo với bụng ngang rốn; xác nhận quy ước đo trước khi rollout.
- Giữ vòng đời báo cáo tuần, cửa sổ kỳ và correction hiện có.
- Trường mới optional; báo thiếu phải đồng bộ frontend/backend/notification
  allowlist, không ép khách có máy đo mới được gửi.
- Dữ liệu legacy không được đổi tên, tự điền zero hoặc lấy từ intake F1.
- Group thu gọn vẫn có tóm tắt; lỗi mở đúng group và focus field lỗi.

Mở rộng form, patch allowlist, schema, DTO, read projection, progress history,
trainer review, export/privacy và tests. Không chỉ thêm field trên giao diện.

## 3. Kết quả đo do HLV ghi nhận

Đây là nguồn riêng với WeeklyCheckin và WellnessTarget, tên đề xuất
`BodyAssessment`. Một bản đại diện kết quả đo được chọn cho khách/kỳ; lưu
ngày đo thật riêng với khóa kỳ hiện có. HLV nhập độc lập việc khách gửi báo cáo.

Payload đề xuất:

```text
clientId (server kiểm quyền theo quan hệ coaching)
weekStartDateKey (canonical period key)
measuredDateKey (ngày đo thật, không tương lai)
deviceLabel, referenceBasis, note
segments:
  leftArm, rightArm, trunk, leftLeg, rightLeg
    leanKg, leanReferencePercent, fatKg, fatReferencePercent
```

- Khối nạc không phải riêng cơ xương; không đổi dữ liệu này thành
  `skeletalMusclePercent` hoặc tự suy ra từ cân nặng.
- % tham chiếu có thể vượt 100; không tái dùng validator tỷ lệ mỡ toàn thân.
- Field số hữu hạn, optional/null; cấm âm, chuỗi sai định dạng và unknown keys.
- Chưa xác định basis/model máy thì lưu `unspecified`, hiển thị % như số trên
  phiếu, không tự đánh giá thấp/bình thường/cao hoặc so sánh % khác basis.
- Gửi yêu cầu ngày đo, thiết bị/nguồn và ít nhất một giá trị kg; thiếu các vùng
  khác vẫn cho gửi sau xác nhận, không giả lập giá trị.
- Mỗi lần gửi là snapshot lịch sử. Draft sửa sau gửi không ghi đè bản học viên
  đang thấy; phải gửi lại mới công bố. Gửi lại không tạo thêm lần đo để tính delta.
- Bản sửa cần lý do và audit người sửa/thời gian; không hiển thị revision kỹ thuật.
- Dùng expectedRevision/CAS, unique indexes và persisted idempotency receipt
  scoped actor/action/requestId; same key khác payload trả conflict.
- Quyền hiện tại phải được kiểm tra cả replay, list, read, update, publish và
  history; clientId hoặc trainerId lịch sử không tự cấp quyền.
- Học viên không được đọc draft hay command metadata của HLV.
- Query cache tách actor/client/kỳ, purge khi logout hoặc mất quyền; đọc DB vẫn
  là nguồn quyết định, không dùng cache để cấp quyền.

API đề xuất dưới `/api/body-assessments`:

- `GET /`: học viên đọc các bản đã công bố của chính mình, phân trang.
- `GET /trainer/clients/:clientId`: lịch sử cho HLV có quyền.
- `GET /trainer/clients/:clientId/:weekStartDateKey`: draft + published của kỳ.
- `PUT /trainer/clients/:clientId/:weekStartDateKey`: lưu draft.
- `POST /trainer/clients/:clientId/:weekStartDateKey/publish`: công bố snapshot.
- `GET /privacy/export`, `DELETE /privacy`: export/delete scoped chính chủ,
  theo quy tắc confirmation của privacy modules hiện có.

Envelope `{success,data}`; lỗi 400 validation, 401 unauthenticated, 403 forbidden,
404 missing, 409 stale/replay conflict; CSRF và limiter cho mutation.
Sử dụng `safeLog` metadata, không raw payload/error có số đo.

Thông báo ứng dụng chỉ báo kết quả mới/cập nhật và deep-link nội bộ; không chứa
giá trị sức khỏe. Persist notification intent cùng publication, retry idempotent
theo pattern hiện có; không tự thêm email hoặc đổi consent.

Privacy gồm draft, published snapshots, revisions, command receipts; tích hợp
account/dashboard deletion và export. Retention theo lifecycle coaching hiện có,
không tự đặt TTL xóa dữ liệu thật hoặc chạy cleanup job ở implementation.

## 4. Giao diện nhập và so sánh

Refinement user duyệt2026-09-10: heading “Phân bổ cơ nạc từng vùng”/“Phân bổ
mỡ từng vùng”; `trunk` dùng nhãn Bụng kèm chú thích vùng thân không riêng bụng.
Không đổi lean/trunk stored meaning. Bảng cơ nạc và mỡ tách riêng; fitness
silhouette không suy ra vóc dáng thật. History title “Bụng — khối cơ nạc”, có
Y axis/ticks/grid, chọn năm và X ngày/tháng; remove visible history table
accordion, dùng điểm focus/tap và chi tiết giá trị để giữ accessibility.

Product surface: HLV `Operate`, học viên `Read`. Hai phương án đã đối chiếu:
hai hình với input gắn vùng hoặc một hình kèm bảng. Chọn hai hình desktop;
mobile một hình/tab, có chế độ nhập bảng để không co chữ và control quá nhỏ.

- Trong Mục tiêu sức khỏe: sau Chỉ số mục tiêu, trước Thói quen khách hàng.
- Hai sơ đồ SVG: `Khối nạc từng vùng`, `Khối mỡ từng vùng`.
- Năm vùng, nhãn trái/phải explicit theo cơ thể; bấm vùng focus đúng field.
- Lưu nháp / Gửi cho học viên riêng với nút cập nhật mục tiêu.
- Pending khóa action; success chỉ sau server response; lỗi giữ input và retry.
- Thêm `Phân bố thành phần cơ thể` dưới Sức khỏe trung bình trong ProgressSummary.
- HLV và học viên dùng cùng snapshot published, không sao chép hai nguồn.
- Học viên self-managed không được quyền tạo HLV assessment; không đổi entitlement.
  Giữ navigation Fitness+-only không có CTA HLV; mục mới thuộc coaching surface.

So sánh một cặp ngày đo trên hai hình: hiện tại + delta; chọn lần trước, lần
đầu hoặc lần bất kỳ đã có. Mặc định kg; % khác basis/device cảnh báo và không
tính delta mặc định. Cùng một kỳ sau sửa không tự so với revision cũ như lần đo mới.
Bảng 5 vùng hỗ trợ đọc chính xác; chọn vùng mở một biểu đồ lịch sử vùng đó.
Không mặc định bốn hình người, không mười đường chồng nhau, không biến hình dáng
người thành ước lượng thân hình khách. Không gán tăng/giảm là tốt/xấu.

0/1 lần đo: empty/single-point, không bịa delta; missing là null/`—`, ngắt series.
Chọn tuần không có kết quả phải ghi ngày đo gần nhất rõ ràng, không forward-fill
thành phép đo mới. Hiển thị thứ tự theo ngày đo thật, không theo thời gian sửa.
Keyboard, screen reader, touch >=44px, reduced motion và mobile không tràn ngang.

## Code style và file map

Layering route → controller → service → model; frontend qua service + Query.
Plan 087 khóa file ownership trước giao agent; bảo toàn diff Plan 086 đang có.
Exemplar: `weeklyCheckin.routes.js`, `weeklyCheckinReview.service.js`,
`weeklyCheckinPrivacy.service.js`, `BodyProgressReport.jsx`, `ProgressSummary.jsx`.
File mới chia module dưới 300 dòng trừ generated vector/test có lý do rõ ràng.

## Testing strategy / Success criteria

### REQ-001 — Nhận diện đúng surface

- AC-001: SVG/PNG đúng artwork và role, sáng/tối, không nhúng raster/font/script.
- AC-002: icon bundle đúng size/MIME/path/safe zone và JSON-LD logo hợp lệ.

### REQ-002 — Số đo tuần tương thích

- AC-003: hông/bụng round-trip HTTP/UI/history; ratio chỉ từ cùng record; legacy pass.

### REQ-003 — Publication và privacy

- AC-004: lưu nháp → công bố → sửa nháp → gửi lại giữ đúng snapshot/permission.
- AC-005: replay/concurrent writes chống duplicate, stale và draft leakage; CSRF/IDOR.
- AC-007: privacy xóa/export đầy đủ scoped, notification không chứa số đo.

### REQ-004 — Shared UI và verification

- AC-006: hai phía cùng kết quả, date/basis/missing/delta đúng; lịch sử theo vùng.
- AC-008: focused/full QA và UI regression; rendered desktop/mobile cùng fixture
  synthetic, không dùng tài khoản hoặc database production; báo SKIP nếu chưa chạy.

## Boundaries / Open questions

Always: giữ dữ liệu cũ, permissions, CSRF, consent, correction policy và dirty diff.
Ask first: duyệt plan/tasks và xác nhận không cần migration/backfill trước code.
Approval đã được user xác nhận; không cần hỏi lại trừ khi đổi phạm vi.
Never: deploy/commit/push, seed/cleanup dữ liệu thật, upload asset tới generator
online, OCR InBody, chẩn đoán hoặc đổi payment/quota ngoài phạm vi.
Chưa cần designer bổ sung vector; favicon nhỏ và maskable còn phải kiểm trong QA.
