# Spec: Quyền truy cập và hạn mức dịch vụ

## Objective

Tập trung chính sách dùng thử, quota và quyền sử dụng các dịch vụ cốt lõi vào một registry backend canonical.
Runtime enforcement, response metadata và trang Admin phải đọc từ cùng registry để tránh số liệu tài liệu, UI và
middleware bị lệch nhau.

## Audience tiers

Backend giữ tám tier độc lập:

| Tier | Điều kiện |
|---|---|
| `guest` | Không có user đã xác thực |
| `user` | User đã xác thực nhưng không có entitlement đang hoạt động |
| `coaching_customer` | Có Order `approved` và còn `sessions > 0` |
| `trainer` | Role `admin`/`trainer` hoặc có TrainerSubscription đang hoạt động và chưa hết hạn |
| `admin` | Role `admin`; policy tách khỏi HLV khi dịch vụ vận hành có hạn mức riêng |
| `fitness_plus_essential` | Có HT Fitness+ Nền tảng đang hoạt động và chưa hết hạn |
| `fitness_plus_smart` | Có HT Fitness+ Tăng tốc đang hoạt động và chưa hết hạn |
| `fitness_plus_max` | Có HT Fitness+ Toàn diện đang hoạt động và chưa hết hạn |

Trang Admin giữ `coaching_customer`, `trainer` và `admin` thành các nhãn riêng trong cùng nhóm trình bày; API và runtime
không được gộp policy vì hai tier có quota khác nhau. Khi một user có nhiều entitlement active, backend chọn policy
mạnh nhất theo từng service; mua thêm entitlement không được làm quota hiện có thấp đi.

## Canonical policy

| Dịch vụ | Guest | User thường | Khách coaching | HLV | Admin | HT Fitness+ Nền tảng | HT Fitness+ Tăng tốc | HT Fitness+ Toàn diện |
|---|---|---|---|---|---|---|---|---|
| Meal Scan | 1 lượt / lifetime / trình duyệt | 1 lượt / lifetime / tài khoản | 10 lượt/ngày + 300 lượt/30 ngày | 20 lượt/ngày + 600 lượt/30 ngày | 20 lượt/ngày + 600 lượt/30 ngày | 5 lượt/ngày + 120 lượt/30 ngày | 10 lượt/ngày + 210 lượt/30 ngày | 15 lượt/ngày + 300 lượt/30 ngày |
| AI Chat | 5 tin/24 giờ / IP | 15 tin/24 giờ + 60 tin/30 ngày | 30 tin/giờ + 600 tin/30 ngày | 30 tin/giờ + 1.200 tin/30 ngày | 30 tin/giờ + 1.200 tin/30 ngày | 20 tin/giờ + 120 tin/30 ngày | 40 tin/giờ + 300 tin/30 ngày | 60 tin/giờ + 600 tin/30 ngày |
| Meal Plan | 1 preview / session | 1 lượt / lifetime | Không giới hạn | Không giới hạn | Không giới hạn | Không giới hạn | Không giới hạn | Không giới hạn |
| TDEE | Không giới hạn | Không giới hạn | Không giới hạn | Không giới hạn | Không giới hạn | Không giới hạn | Không giới hạn | Không giới hạn |
| Trung tâm thực hành | Không truy cập | Không truy cập | Không truy cập | 2 email/24 giờ | 10 email/24 giờ | Không truy cập | Không truy cập | Không truy cập |

Burst/daily window là lớp kiểm soát tốc độ sử dụng; cửa sổ 30 ngày là quyền lợi thương mại. Guest Meal Scan được nhận
diện bằng opaque httpOnly browser cookie và vẫn nằm sau flood limiter theo IP; xóa cookie/đổi trình duyệt không phải
security boundary tuyệt đối. Các giá trị trên là product policy, không được hardcode lặp lại trong middleware hoặc UI.

Order/subscription mới phải lưu policy version và snapshot allowlisted tại thời điểm entitlement bắt đầu. Runtime dùng
giá trị lớn hơn giữa snapshot và registry hiện tại để khách cũ chỉ được giữ nguyên hoặc tăng quyền lợi, không bị giảm.
Document cũ chưa có snapshot fallback về registry hiện tại; rollout này không backfill dữ liệu production.

## API and UI contract

- `GET /api/admin/service-access-policies` chỉ cho role `admin`, trả `version`, `columns` và danh sách service cùng
  policy theo bảy tier, quyền lợi gói HLV, catalog tính năng cộng đồng/khách hàng và inventory email tự động.
  Endpoint chỉ đọc và không cần CSRF.
- Trang `/admin/service-access-policies` tên “Quyền & hạn mức”, nằm trong nhóm “Hoạt động”, lazy-loaded và dùng
  TanStack Query qua service frontend.
- Trang có loading, retry/error, empty state, bảng responsive và giải thích nguồn chính sách là registry code.
- Năm section mặc định mở và sắp xếp cố định: `Tính năng cộng đồng & khách hàng`, `Quyền lợi gói HLV`,
  `Hạn mức công cụ`, `Thông báo email tự động`, `Phụ thuộc & phiên bản hệ thống`; mỗi section có nút thu gọn bằng
  `aria-expanded`/`aria-controls`.
- `Thông báo email tự động` lấy catalog read-only từ backend và liệt kê tính năng, sự kiện kích hoạt, người nhận,
  điều kiện gửi, cơ chế delivery cùng template/sender. Catalog chỉ mô tả capability hệ thống, không chứa địa chỉ email,
  lịch sử gửi hoặc dữ liệu người dùng.
- Email nhắc `Mục tiêu sức khỏe` là opt-in tại `Tài khoản`, chỉ gửi cho khách coaching còn buổi và có HLV trong
  khung 07:00–08:59 giờ Việt Nam. Hệ thống bỏ qua ngày khách đã submit nhật ký, chống gửi trùng theo người/ngày,
  retry lỗi provider và giữ feature flag production ở trạng thái tắt mặc định.
- `Phụ thuộc & phiên bản hệ thống` tổng hợp read-only `dependencies`/`devDependencies` từ `package.json`,
  `client/package.json` và `server/package.json` ngay tại build time. UI hỗ trợ tìm package, lọc Workspace/Frontend/Backend
  và không gọi npm Registry từ trình duyệt hoặc tự tuyên bố phiên bản mới nhất.
- Meal Scan response thành công và lỗi 429 trả quota metadata gồm các field tương thích `serviceKey`, `tier`, `limit`,
  `remaining`, `resetAt` và mảng `windows[]` (`key`, `limit`, `remaining`, `resetAt`, `periodLabel`). Lifetime window có
  `resetAt: null`.
- AI Chat gửi cùng quota metadata bằng SSE event; lỗi 429 trả metadata trong JSON để client vẫn cập nhật được.
- Client chỉ hiển thị quota sau khi đã nhận metadata server-authoritative; không tự suy đoán số lượt còn lại. Badge quota nằm cạnh tên `HT Assistant`, chuyển trạng thái cảnh báo khi còn 1-2 lượt hoặc đã hết; thời điểm làm mới vẫn hiển thị dưới ô nhập.
- HT Assistant chỉ hỗ trợ fitness, tập luyện, dinh dưỡng, phục hồi, sức khỏe mang tính giáo dục và dịch vụ HTCOACHING. Tên/chủ thể mơ hồ được hỏi lại một câu; yêu cầu rõ ràng ngoài phạm vi bị từ chối ngắn, được nhắc là vẫn tính hạn mức và chuyển hướng tới câu hỏi phù hợp. Model không tự nêu số quota AI Chat chính xác.
- Saved Meal Plan là dữ liệu cá nhân của tài khoản đã đăng nhập: create/revise/archive phụ thuộc auth, CSRF, ownership, feature flag, canonical Food, idempotency và version conflict; không phụ thuộc Order còn buổi hoặc đã có HLV. `trainerIdAtCreation` chỉ là metadata nullable khi có phân công hiện tại.

### Danh mục tính năng cộng đồng và khách hàng

- Cùng endpoint Admin trả `communityFeatures` từ catalog backend read-only riêng; không trộn roadmap tính năng vào registry quota.
- Bảng hiển thị đúng 7 cột: `Tính năng`, `Nhóm`, `Ưu tiên`, `Giá trị chính`, `Đối tượng`, `Cơ hội cải thiện hiện tại`, `Kết quả gần nhất`.
- `Ưu tiên` là mức ưu tiên xử lý cơ hội cải thiện: `F0` cần ưu tiên ngay, sau đó lần lượt là `F1`, `F2`, `F3`. Mức ưu tiên nằm trong catalog backend canonical và UI không tự suy luận.
- Bảng có hai bộ lọc độc lập `Nhóm` và `Đối tượng`. Chọn đồng thời áp dụng phép giao; không thêm tìm kiếm tự do cho cột khác.
- Bộ lọc có lựa chọn `Tất cả nhóm`/`Tất cả đối tượng`, dùng audience key ổn định thay vì label hiển thị, có trạng thái không kết quả,
  label accessible và bảng responsive bằng cuộn ngang trên màn hình hẹp.
- Catalog chỉ chứa mô tả sản phẩm, không chứa dữ liệu người dùng, usage history hoặc identifier.
- Mỗi feature có đúng một `currentImprovement` gồm key ổn định, mô tả và ngày mở. Record theo dõi được append vào
  `improvementHistory` từ milestone đầu tiên; khi đạt `production_verified`, record được giữ nguyên, catalog chọn cơ hội
  tiếp theo và đánh giá lại priority.
- `improvementHistory` là append-only theo từng hạng mục đang làm hoặc đã hoàn tất. Mỗi record lưu opportunity, result, snapshot tại thời điểm xử lý
  (`Tính năng`, `Nhóm`, `Ưu tiên`, `Giá trị chính`, `Đối tượng`) và các milestone
  `in_progress`/`implemented`/`verified`/`production_verified` có `statusDate` date-only `YYYY-MM-DD`.
- `Kết quả gần nhất` hiển thị milestone cuối của từng record. API tạm thời được phép phát các alias
  `initialImprovement`/`deliveryUpdates` suy ra từ contract mới để giữ tương thích một release; catalog không lưu hai nguồn.
- Chỉ gắn `production_verified` sau khi behavior đã được xác minh trên production. Priority vẫn phản ánh hạng mục chưa
  hoàn thành ở production, vì vậy một tính năng đã code local vẫn có thể giữ `F0`.
- HT Assistant và luồng lưu Meal Plan nền đã được chủ sản phẩm xác minh production ngày `2026-08-12`.
  Snapshot `2026-08-29.2` bổ sung các kết quả local-verified của TDEE, Meal Scan, Recipe, thư viện bài tập,
  Today Dashboard, email nhắc sức khỏe buổi sáng, tiến trình và Trung tâm thực hành; không nâng chúng thành
  `production_verified` khi chưa có live evidence.
- Today Dashboard giữ `F0` cho cơ hội tổng hợp mức bám mục tiêu sức khỏe và next action; Trung tâm thực hành
  giữ `F2` vì luồng mô phỏng cốt lõi đã hoàn tất và phần tiếp theo là preview/diagnostics.

#### Báo cáo lịch sử cải tiến

- `GET /api/admin/service-access-policies/community-features/report` và endpoint `.pdf` tương ứng đều admin-only,
  read-only, `Cache-Control: private, no-store`; không cần CSRF vì không mutation.
- Hai endpoint dùng chung một report read model và cùng hỗ trợ `from`, `to`, `group`, `audience`, `status`. Date dùng
  `YYYY-MM-DD`, `from <= to`; group/audience/status ngoài catalog phải trả `400` bằng stable error code.
- Report flatten từng milestone thành một event, sắp xếp theo ngày và trả summary gồm số event, số hạng mục, số tính năng,
  số production-verified, số F0 còn mở và ngày cập nhật gần nhất.
- UI hiển thị thống kê theo bộ lọc, loading/error/retry, khoảng ngày và trạng thái; bộ lọc `Nhóm` và `Đối tượng` được tái sử dụng.
- PDF được sinh trên server bằng `pdf-lib`, A4 ngang, embed Be Vietnam Pro, không lưu public/GridFS và không chứa dữ liệu user.
  Bảng PDF có sáu cột: `Ngày xác nhận`, `Tính năng`, `Nhóm`, `Ưu tiên lúc xử lý`, `Cơ hội đã cải thiện`, `Kết quả xác nhận`.

### Ma trận quyền lợi gói huấn luyện viên

- Cùng endpoint Admin trả thêm ma trận chỉ-đọc gồm đúng bốn cột `free`, `standard`, `professional`, `premium`.
- Tên gói, giá, thời hạn, số học viên tối đa và quyền lợi phải được suy ra từ catalog HLV canonical; trang Admin và
  khu vực Pricing không được duy trì hai danh sách quyền lợi độc lập.
- Ma trận hiển thị đầy đủ các nhóm đang công bố tại Pricing: Quản lý học viên, Coaching & Lịch tập, F1 CRM & AI
  và Đặc quyền. Mỗi ô thể hiện giá trị số hoặc trạng thái có/không.
- Phiên bản này không thêm mutation chỉnh gói trong Admin. Điều chỉnh tương lai thực hiện tại catalog canonical;
  cả Pricing và bảng Admin phải tự phản ánh thay đổi sau khi deploy.

## Security and privacy boundaries

- Guest AI Chat tiếp tục dùng khóa IP đã HMAC; Guest Meal Scan dùng khóa browser cookie đã HMAC. Không lưu hoặc log raw IP/cookie.
- Authenticated quota dùng user ID; tier chỉ được resolver backend xác định từ role/Order/TrainerSubscription/FitnessSubscription.
  Admin có tier riêng; các dịch vụ cũ giữ policy tương đương HLV, còn `practice_email` dùng hạn mức 10 thay vì 2.
- AI Chat và Meal Scan của mọi tier consume atomically từ MongoDB shared ledger đa cửa sổ để nhất quán khi chạy nhiều replica. Các limiter abuse chỉ là lớp chống flood.
- Lỗi provider 5xx hoặc timeout hoàn reservation quota tương ứng một cách idempotent; validation/moderation bị từ chối trước provider không được tạo thêm provider cost.
- `practice_email` ghi một ledger event cho từng email thực sự cần gửi; journey vì vậy tiêu thụ hai
  unit nhưng retry phần còn thiếu chỉ consume unit còn thiếu. Provider idempotency key gắn với
  `requestId` + delivery key; trạng thái refund không xác nhận phải fail closed và không báo đã hoàn lượt.
- Không tin tier do client gửi, không hạ CSRF, auth, ownership hoặc rate limit hiện có.
- Registry và field snapshot additive không cần migration bắt buộc; document cũ fallback an toàn. Không chạy backfill/index production trong implementation này.
- Endpoint Admin không trả dữ liệu user, usage history hoặc identifier; chỉ trả policy cấu hình.

## Testing strategy

- Unit/integration test registry và tier resolver cho guest, user, coaching customer, trainer và ba plan HT Fitness+.
- Integration test Admin API fail closed với non-admin.
- Integration test Meal Scan trial 1/1 cùng daily/monthly 10/300, 20/600, 5/120, 10/210, 15/300 và quota metadata.
- Middleware test AI Chat 5/24h, 15/24h+60/30d, 30/h+600/30d, 30/h+1.200/30d, 20/h+120/30d, 40/h+300/30d, 60/h+600/30d; ledger test concurrency, rolling trim, refund và growth bound.
- Chạy AI check, UI check phạm vi trang mới, client/server tests, build và security gates trước bàn giao.

## Success criteria

- Không còn quota AI Chat/Meal Scan hardcode tách khỏi registry.
- Guest thực tế chỉ dùng được 1 Meal Scan trước CTA đăng nhập; User thường chỉ có thêm 1 lượt lifetime theo tài khoản.
- User thường, khách coaching, HLV và ba plan HT Fitness+ nhận đúng dual-window quota mà không cần client truyền tier.
- Admin thấy bảng canonical từ API; thêm service/tier policy vào registry sẽ xuất hiện thành hàng/cell tương ứng.
- Admin thấy inventory email tự động khớp toàn bộ sender export hiện tại mà không lộ địa chỉ nhận hoặc lịch sử gửi.
- Admin thấy bốn gói HLV và quyền lợi khớp Pricing từ cùng catalog canonical; hai bảng có thể đóng/mở độc lập.
- Admin thấy bảng tính năng cộng đồng/khách hàng đúng 7 cột, có priority `F0`–`F3`, lịch sử xử lý có ngày và có thể lọc theo
  `Nhóm`, `Đối tượng` hoặc kết hợp cả hai.
- Admin xem được timeline ngày → tính năng → hạng mục, thống kê cùng filter và tải PDF sáu cột từ cùng report read model.
- Admin xem được ba manifest package và danh sách phụ thuộc theo đúng phiên bản khai báo của lần build hiện tại; quyết định
  nâng cấp vẫn phải dựa trên `npm outdated`, security audit, changelog và regression test.
- Response operational có field tương thích cùng `windows[]` để UI giải thích quota minh bạch.
