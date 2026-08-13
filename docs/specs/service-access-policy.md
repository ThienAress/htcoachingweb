# Spec: Quyền truy cập và hạn mức dịch vụ

## Objective

Tập trung chính sách dùng thử, quota và quyền sử dụng các dịch vụ cốt lõi vào một registry backend canonical.
Runtime enforcement, response metadata và trang Admin phải đọc từ cùng registry để tránh số liệu tài liệu, UI và
middleware bị lệch nhau.

## Audience tiers

Backend giữ bốn tier độc lập:

| Tier | Điều kiện |
|---|---|
| `guest` | Không có user đã xác thực |
| `user` | User đã xác thực nhưng không có entitlement đang hoạt động |
| `coaching_customer` | Có Order `approved` và còn `sessions > 0` |
| `trainer` | Role `admin`/`trainer` hoặc có TrainerSubscription đang hoạt động và chưa hết hạn |

Trang Admin được phép gộp `coaching_customer` và `trainer` thành cột “User có gói / HLV” khi policy giống nhau,
nhưng API vẫn phải giữ hai tier để có thể tách chính sách sau này.

## Canonical policy

| Dịch vụ | Guest | User thường | User có gói / HLV |
|---|---|---|---|
| Meal Scan | 2 lượt / 24 giờ / IP | 3 lượt / 24 giờ / user | 10 lượt / 24 giờ / user |
| AI Chat | 5 tin / giờ / IP | 15 tin / giờ / user | 30 tin / giờ / user |
| Meal Plan | 1 preview / session | 1 lượt / lifetime | Không giới hạn |
| TDEE | Không giới hạn | Không giới hạn | Không giới hạn |

Không thêm daily cap phụ cho AI Chat trong phiên bản này. Các giá trị trên là product policy, không được hardcode
lặp lại trong middleware hoặc trang Admin.

## API and UI contract

- `GET /api/admin/service-access-policies` chỉ cho role `admin`, trả `version`, `columns` và danh sách service cùng
  policy theo bốn tier, quyền lợi gói HLV và catalog tính năng cộng đồng/khách hàng. Endpoint chỉ đọc và không cần CSRF.
- Trang `/admin/service-access-policies` tên “Quyền & hạn mức”, nằm trong nhóm “Hoạt động”, lazy-loaded và dùng
  TanStack Query qua service frontend.
- Trang có loading, retry/error, empty state, bảng responsive và giải thích nguồn chính sách là registry code.
- Bốn section mặc định mở và sắp xếp cố định: `Tính năng cộng đồng & khách hàng`, `Quyền lợi gói HLV`,
  `Hạn mức công cụ`, `Phụ thuộc & phiên bản hệ thống`; mỗi section có nút thu gọn bằng
  `aria-expanded`/`aria-controls`.
- `Phụ thuộc & phiên bản hệ thống` tổng hợp read-only `dependencies`/`devDependencies` từ `package.json`,
  `client/package.json` và `server/package.json` ngay tại build time. UI hỗ trợ tìm package, lọc Workspace/Frontend/Backend
  và không gọi npm Registry từ trình duyệt hoặc tự tuyên bố phiên bản mới nhất.
- Meal Scan response thành công và lỗi 429 trả quota metadata gồm `serviceKey`, `tier`, `limit`, `remaining`,
  `resetAt`.
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
- HT Assistant và Meal Plan đã được chủ sản phẩm xác minh production ngày `2026-08-12`; hai cơ hội tiếp theo chuyển sang `F1`. Meal Scan giữ `F1` vì journal integration và ground-truth thực tế được tách thành phase riêng.

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

- Guest quota tiếp tục dùng khóa IP đã HMAC; không lưu hoặc log raw IP.
- Authenticated quota dùng user ID; tier chỉ được resolver backend xác định từ role/Order/TrainerSubscription.
- Không tin tier do client gửi, không hạ CSRF, auth, ownership hoặc rate limit hiện có.
- Không tạo migration/schema trong thay đổi này.
- Endpoint Admin không trả dữ liệu user, usage history hoặc identifier; chỉ trả policy cấu hình.

## Testing strategy

- Unit/integration test registry và tier resolver cho guest, user, coaching customer và trainer.
- Integration test Admin API fail closed với non-admin.
- Integration test Meal Scan 2/3/10 và quota metadata.
- Middleware test AI Chat 5/15/30 từ registry, cộng với client test mapping/format metadata.
- Chạy AI check, UI check phạm vi trang mới, client/server tests, build và security gates trước bàn giao.

## Success criteria

- Không còn quota AI Chat/Meal Scan hardcode tách khỏi registry.
- User thường thực tế bị giới hạn Meal Scan 3 lượt/24 giờ và AI Chat 15 tin/giờ.
- User có gói/HLV nhận đúng hạn mức cao hơn mà không cần client truyền tier.
- Admin thấy bảng canonical từ API; thêm service/tier policy vào registry sẽ xuất hiện thành hàng/cell tương ứng.
- Admin thấy bốn gói HLV và quyền lợi khớp Pricing từ cùng catalog canonical; hai bảng có thể đóng/mở độc lập.
- Admin thấy bảng tính năng cộng đồng/khách hàng đúng 7 cột, có priority `F0`–`F3`, lịch sử xử lý có ngày và có thể lọc theo
  `Nhóm`, `Đối tượng` hoặc kết hợp cả hai.
- Admin xem được timeline ngày → tính năng → hạng mục, thống kê cùng filter và tải PDF sáu cột từ cùng report read model.
- Admin xem được ba manifest package và danh sách phụ thuộc theo đúng phiên bản khai báo của lần build hiện tại; quyết định
  nâng cấp vẫn phải dựa trên `npm outdated`, security audit, changelog và regression test.
- Response operational có `limit`, `remaining`, `resetAt` để UI giải thích quota minh bạch.
