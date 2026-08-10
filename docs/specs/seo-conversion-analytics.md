# Feature Spec: SEO & Conversion Analytics

Status: IMPLEMENTING — RELEASES 028A–028C LOCAL VERIFIED
Ngày soạn: 2026-08-05
Quyết định sản phẩm: chủ dự án duyệt hướng làm dashboard Admin và không lưu raw IP ngày 2026-08-05
Plan 028 và checklist 028A–028D được chủ dự án duyệt ngày 2026-08-05. Release 028A–028C đã local
verified; live GA4/GSC, target index apply và Release 028D chưa được deploy hoặc kết nối dữ liệu thật.

## 1. Tóm tắt

HTCOACHINGWEB cần một nguồn số liệu đủ tin cậy để trả lời bài blog, từ khóa và kênh nào tạo ra
khách đăng ký đánh giá miễn phí rồi trở thành khách hàng. Số `BlogPost.views` hiện chỉ là lượt gọi
API detail và không được dùng làm chỉ số người đọc duy nhất hoặc conversion.

Feature này kết hợp ba nguồn độc lập:

- Google Search Console (GSC): impressions, clicks, CTR, position và search query.
- Google Analytics 4 (GA4): users, new/returning, engagement, source/medium và device ở mức tổng hợp.
- MongoDB nghiệp vụ: contact, booking, assessment, order và program status.

Trang `/admin/seo-analytics` chỉ dành cho admin, đọc dữ liệu tổng hợp và không làm public site phụ
thuộc vào Google/OpenSEO. OpenSEO và MCP là lớp phân tích nội bộ triển khai sau khi funnel đã ổn định.

## 2. Mục tiêu

- Phân biệt request view cũ với người đọc thực sự, khách mới/quay lại và nguồn traffic.
- Xem hiệu quả theo bài blog, ngày, chủ đề, keyword, source/medium và device.
- Theo dõi funnel: search click → engaged read → CTA → lead → contacted → assessment → customer.
- Gắn attribution tối thiểu vào `ContactMessage` và `Booking` mà không lưu raw IP hoặc PII trong GA4.
- Chỉ nối F1/Order với lead bằng reference explicit; không suy đoán bằng email hoặc số điện thoại.
- Dùng cache/read model để Google API lỗi không ảnh hưởng blog, contact, booking hoặc public runtime.
- Chuẩn bị dữ liệu SEO read-only cho OpenSEO/MCP dành riêng cho owner/Codex.

## 3. Ngoài phạm vi

- Không thay `BlogPost.views` bằng một khái niệm mới hoặc backfill unique visitors từ số cũ.
- Không lưu/hiển thị raw IP, full user-agent, raw referrer URL hoặc fingerprint bền vững.
- Không gửi name, email, phone, social handle, health/F1 fields, Mongo ID hoặc note lên GA4/OpenSEO.
- Không tự ghép Contact/Booking/F1/Order bằng PII.
- Không đưa SEO MCP vào HT Assistant public và không cho MCP sửa/publish blog hoặc metadata.
- Không deploy OpenSEO Internet-facing trong release đầu; Docker local vẫn phải có boundary riêng.
- Không chạy migration, seed, backfill hoặc sync production nếu chưa xác nhận target/credential.

## 4. Nguồn sự thật và định nghĩa chỉ số

| Chỉ số | Nguồn canonical | Định nghĩa |
|---|---|---|
| Legacy views | `BlogPost.views` | Số request detail; chỉ hiển thị nhãn “Lượt xem cũ” |
| Search impressions/clicks/CTR/position | GSC | Kết quả Search Analytics theo page/query/date |
| Users/new/returning/source/device | GA4 | Aggregate report; không có raw IP |
| Engaged blog reader | GA4 custom event | Active ≥ 30 giây **và** scroll ≥ 50%, một lần/page load |
| CTA click | GA4 custom event | Click CTA tư vấn có placement + content slug allowlist |
| Lead generated | DB + GA4 `generate_lead` | API Contact/Booking trả thành công; GA4 không nhận lead ID |
| Contacted/completed | DB | Transition canonical hiện có của Booking/Contact |
| Assessment completed | F1 | `F1Customer.status=assessment_completed` và origin lead explicit |
| Customer/program started | Order/F1 | Order approved hoặc F1 program started với origin explicit |

GSC có thể không trả toàn bộ long-tail rows; dashboard phải ghi rõ đây là top rows/provider aggregate,
không trình bày như raw log đầy đủ.

GA4 production contract:

- Client chỉ khởi tạo Measurement ID từ biến môi trường production khi runtime hostname đúng canonical production;
  localhost, deploy preview và staging phải no-op.
- Backend GA4 provider chỉ cấu hình trong `APP_ENV=production` và mọi report filter exact production `hostName`.
- `activeUsers` tổng quan phải lấy từ report không có dimension `date` cho đúng distinct user của toàn khoảng ngày;
  không cộng daily distinct users.
- Returning dùng dimension `newVsReturning`; không suy ra bằng `activeUsers - newUsers`.
- Cache mới có production scope key. Row legacy/mixed không được dùng làm KPI production và không tự bị xóa.
- UI dùng nhãn `Khách truy cập GA4`, không đồng nhất với tài khoản đăng nhập hoặc khẳng định con người duy nhất.

## 5. Attribution contract

Release đầu dùng attribution theo browser session, không tạo long-lived cross-site fingerprint:

```js
{
  source: "google",
  medium: "organic",
  campaign: "",
  referrerHost: "google.com",
  landingPath: "/blog/cach-tinh-macro/",
  contentType: "blog",
  contentSlug: "cach-tinh-macro",
  capturedAt: "2026-08-05T10:00:00.000Z"
}
```

Quy tắc:

- Client chỉ gửi field allowlist, string đã giới hạn độ dài; server normalize/validate lại.
- `referrerHost` chỉ là hostname; bỏ path/query/hash.
- `landingPath` chỉ nhận same-origin path canonical; bỏ query/hash.
- Không có raw IP, raw user-agent, Google client ID, user ID hoặc arbitrary event properties.
- Attribution là optional/default `null`; document cũ vẫn valid và hiển thị “Chưa có attribution”.
- F1/Order chỉ nhận `originBookingId` hoặc `originContactMessageId` sau authorization và existence check.

## 6. Admin experience

### 6.1. Trang tổng quan

- Date range preset 7/28/90 ngày và custom range có giới hạn.
- KPI: impressions, clicks, CTR, average position, users, returning users, engaged reads, CTA, leads.
- KPI GA4 hiển thị data-scope/cutover quality; thiếu exact-window aggregate phải báo unavailable thay vì fallback sang tổng daily.
- Funnel tổng hợp và cảnh báo bước chưa có canonical linkage.
- Hiển thị `lastSyncedAt`, provider status và nhãn stale/partial/error rõ ràng.

### 6.2. Bảng Blog

- Cột: bài viết, publish date, GSC clicks/impressions, GA users/engaged reads, CTA, leads, conversion.
- Sort/filter/pagination server-authoritative; không tải toàn bộ dataset về client.
- Detail drawer: trend, top queries, source/medium, device và funnel của đúng slug.
- Legacy views có tooltip giải thích, không trộn với users/engaged reads.

### 6.3. Bảng Keyword

- Query, clicks, impressions, CTR, position, ranking page và delta kỳ trước.
- Nhãn opportunity/declining/cannibalization chỉ khi rule deterministic đủ dữ liệu.
- Không dùng AI-generated recommendation làm ground truth hoặc auto-publish.

### 6.4. UI states

- Loading skeleton, empty, provider-not-configured, partial, stale, error + retry và disabled states.
- Product UI restrained, responsive, WCAG AA; không gradient text, glassmorphism hoặc nested-card spam.
- Không tạo public route mới; route admin vẫn lazy-loaded và `noindex` theo shell hiện có.

## 7. Google integration và cache

- Backend dùng service account read-only, credential chỉ từ environment/Doppler.
- GA4 scope/read API và GSC `webmasters.readonly`; client không nhận provider token/credential.
- External request có timeout, bounded rows, pagination guard, retry hữu hạn và safe logging.
- Sync ghi aggregate upsert idempotent theo provider/date/dimension/content key.
- Dashboard đọc cache trước; provider lỗi trả stale cache cùng status, không trả 500 nếu cache hợp lệ.
- Manual sync là mutating admin endpoint, phải có JWT role admin, CSRF, rate limit và concurrency guard.
- Không tự bật cron production trong local implementation; scheduling là deploy gate riêng.

## 8. Data model và compatibility

- Tạo `SeoDailyMetric`: aggregate metrics, dimension allowlist, unique compound index.
- Tạo `AnalyticsSyncState`: provider, status, cursor/window, last success/error metadata đã sanitize.
- Thêm optional `attribution` vào `ContactMessage` và `Booking`.
- Thêm optional explicit origin fields vào `F1Customer` và `Order` ở release riêng.
- Không required field, rename hoặc type change; dữ liệu cũ không cần backfill để tiếp tục hoạt động.
- Có migration/index script idempotent + dry-run; không chạy trên staging/production khi chưa được phép.
- Aggregate không chứa PII có retention dài hạn theo policy; sync-state error không giữ raw provider payload.

## 9. OpenSEO và MCP

- OpenSEO chạy ngoài core HTCOACHINGWEB với database/secret riêng.
- Pilot local trước; không expose Docker `local_noauth` ra Internet.
- OpenSEO phục vụ keyword/rank/SERP/audit; không thay GA4/GSC conversion dashboard.
- MCP chỉ cho owner/Codex. Tool đọc cache được phép; live refresh/crawl/paid query phải xin xác nhận.
- Nếu native MCP không hỗ trợ scope đủ chặt, dùng UI hoặc allowlist proxy; không dựa vào prompt để bảo vệ.
- MCP không có credential Google/DataForSEO read tool, không có HT mutation và không có health/lead data.

## 10. Acceptance criteria

- [x] Blog engaged event chỉ fire một lần khi đủ cả active time và scroll threshold.
- [x] CTA/generate-lead events không chứa PII hoặc arbitrary user input.
- [x] Contact/Booking vẫn thành công khi GA4 unavailable hoặc Web Storage bị chặn.
- [x] Document cũ thiếu attribution vẫn đọc/ghi được; không backfill suy đoán.
- [x] Endpoint analytics trả 401/403 đúng role và không expose provider credential/raw payload.
- [x] Dashboard hiển thị đúng loading/empty/partial/stale/error và responsive mobile.
- [x] GSC/GA4 sync idempotent; timeout giữ stale cache và không ảnh hưởng public API.
- [x] Legacy views được phân biệt rõ với users/engaged reads.
- [x] F1/Order conversion chỉ được tính khi có origin reference explicit.
- [ ] OpenSEO local không có dữ liệu khách hàng; MCP paid/mutating tool bị chặn hoặc cần approval.
- [x] Focused tests, full unit, client lint/build, security scans, agent validation và relevant E2E pass cho Releases 028A–028C.

## 11. Deploy gates

- Code có thể hoàn tất khi Google/OpenSEO credential chưa có bằng provider-disabled state và mocks.
- Live GA4/GSC verification cần owner cấp service-account access ngoài repo; không gửi secret qua chat.
- Schema/index migration chỉ chạy sau dry-run và xác nhận target riêng.
- OpenSEO cần Docker Desktop + DataForSEO credential; đây là operational gate, không phải lý do hạ guard.
