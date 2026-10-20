# ADR 0002: API naming rules without URL versioning

- **Status**: ACCEPTED
- **Date**: 2026-10-18
- **Owners**: backend / platform
- **Supersedes**: none
- **Amended**: 2026-10-19 — trước khi có người dùng thật thì đổi tên thẳng, không giữ bí danh

## Context

Backend hiện có khoảng 390 endpoint dưới `/api` do nhiều đợt phát triển khác nhau, chưa có quy tắc đặt tên. Rà soát ngày 2026-10-18 thấy: tiền tố số ít
(`/user`, `/checkin`, `/coaching`), đường dẫn kiểu RPC (`/training-booking/book`, `/trainer-subscriptions/purchase`, `/meal-scans/analyze`), bốn cách gọi "của tôi"
(`/me`, `/my`, `/my-booking`...), `PUT` dùng cho hành động (`PUT /orders/:id/approve`), lồng sâu hơn 3 cấp, và tên tham số lệch (`:userId` so với `:clientId`).
Không có versioning, và `docs/audits/backend-foundations-and-advanced-concepts-2026-08-13.md` đã chọn không big-bang versioning.

Một số đường dẫn là hợp đồng bên ngoài hoặc do script vận hành gọi (webhook SePay, OAuth Google, `/api/ops/*`, smoke test production, rate limiter và cổng tính năng theo tiền tố),
nên đổi hàng loạt có rủi ro cao ở ví, hợp đồng và đăng nhập. Client (Netlify) và server (Render) triển khai lệch thời điểm nhau.

## Decision

1. Đặt tên theo `.claude/rules/api-design.md`: danh từ số nhiều dạng kebab-case, HTTP method mang hành động, ID để truy cập bản ghi, URL lồng nhau thể hiện quan hệ
   (5 nguyên tắc RESTful của video chủ dự án chia sẻ), cộng phần bổ sung của dự án (hành động qua `POST /:id/<hành động>`, một kiểu `/me`, lồng tối đa 3 đoạn tên).
2. Không đưa `/v1` vào URL. Khi production chưa có người dùng thật (hiện tại) thì đổi tên thẳng, không bí danh. Khi đã có người dùng thật, đổi tên bằng route mới + route cũ làm bí danh có thời hạn và đếm lượt gọi để biết khi nào gỡ.
3. Endpoint mới phải đúng quy tắc. Endpoint cũ vi phạm ghi trong `server/src/routes/__tests__/apiNamingDebt.json`; test hợp đồng
   `apiNaming.contract.test.js` chặn vi phạm mới và chặn để danh sách nợ chứa dòng đã sửa. Danh sách chỉ được giảm.
4. Sửa endpoint cũ theo từng nhóm nhỏ, ưu tiên lỗi rõ ràng không chạm tiền; nhóm tiền, hợp đồng, đăng nhập cần `impact-check` và review bảo mật.
5. Không đổi webhook, OAuth, `/api/ops/*` và đường dẫn script production gọi. Tiền tố có rate limiter hoặc cổng tính năng chỉ đổi khi cập nhật đồng thời mọi chỗ bám vào nó; `prefixCoverage.contract.test.js` đỏ nếu quên một chỗ.

## Alternatives Considered

- **Đổi tên toàn bộ một lần (big-bang)**: sạch nhất nhưng chạm hàng trăm endpoint, client, e2e, worker và webhook cùng lúc; deploy lệch giữa Netlify và Render làm hỏng người dùng đang mở bản cũ. Không chọn.
- **Thêm `/api/v1` ngay**: giải quyết phá vỡ tương thích về lâu dài nhưng phải nhân đôi mọi route, thêm lớp cấu hình ở client, và chưa có khách bên ngoài cần ổn định hợp đồng. Chưa chọn; xem lại khi có client bên thứ ba.
- **Chỉ viết rule, không có cổng**: rule không tự thực thi, các lần trước vi phạm lặp lại. Không chọn.

## Consequences

- Positive: endpoint mới nhất quán, dễ đoán; không phá vỡ client đang chạy; tiến độ dọn nợ đo được bằng số dòng của danh sách.
- Negative/trade-off: tồn tại song song tên cũ và mới trong thời gian bí danh; cổng chỉ bắt được các mẫu mà bộ quét hiểu (không kiểm ngữ nghĩa như `/me` hay tên tham số).
- Follow-up: xem lại ADR khi có client bên thứ ba, khi danh sách nợ dưới 20 dòng, hoặc khi cần thay đổi phá vỡ tương thích mà bí danh không xử lý được.

## Evidence

- `docs/audits/2026-10-api-naming.md` (số liệu rà soát và kế hoạch dọn).
- `server/src/routes/__tests__/apiNaming.contract.test.js` và `apiNamingScan.js`.
