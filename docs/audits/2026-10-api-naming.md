# Rà soát đặt tên API — 10/2026

Quy tắc: `.claude/rules/api-design.md`. Quyết định: `docs/architecture/adr/0002-api-naming-and-versioning.md`.
Danh sách nợ máy đọc được: `server/src/routes/__tests__/apiNamingDebt.json` (do `apiNamingScan.js` sinh từ mã nguồn).

## Kết quả quét

- 389 endpoint trong 50 file route (bộ quét đọc `router.<method>("...")` và tiền tố mount trong `server/server.js`; `f1AiRule.routes.js` dùng `router.route()` nên chưa được quét).
- **128 vi phạm** theo bộ quy tắc của cổng:

| Quy tắc | Số vi phạm | Ví dụ |
|---|---|---|
| `plural-resource` (tiền tố không ở dạng số nhiều) | 78 | `/api/user`, `/api/checkin`, `/api/coaching`, `/api/blog`, `/api/contact` |
| `verb-in-path` (động từ trong đường dẫn) | 34 | `POST /api/training-booking/book`, `POST /api/trainer-subscriptions/purchase`, `POST /api/meal-scans/analyze`, `POST /api/mealplan-access/record`, `DELETE /api/site-settings/remove`, `POST /api/site-settings/upload/*` |
| `deep-nesting` (hơn 3 đoạn tên) | 13 | `POST /api/f1-customers/:id/result-predictions/:predictionId/visual-stages/:phaseKey/generate-images` |
| `action-should-be-post` | 3 | `PUT /api/orders/:id/approve`, `PUT /api/contracts/:id/cancel` |

Chưa có cổng cho: kiểu "của tôi" (`/me`, `/my`, `/my-plans`, `/my-booking`), tên tham số lệch (`:userId`/`:clientId`), tiền tố admin lẫn lộn (`/blog/admin` so với `/admin/...`),
`search/sort` không thống nhất. Các điểm này ghi trong quy tắc và xử lý khi sửa từng nhóm.

## Quan sát ngoài bộ quét

- Không có versioning (`/api`). Envelope `{ success, data | message }` được tuân thủ gần như toàn bộ; `page`/`limit` thống nhất.
- Bốn kiểu "của tôi" cho một khái niệm ở khoảng 12 endpoint (`/user/me`, `/checkin/me`, `/coaching/my-plans`, `/workout-plans/my`, `/contracts/my`, `/wellness-targets/me`, `/training-booking/my-booking`...).
- `GET /api/auth/dev-login` có tác dụng phụ (đặt phiên) nhưng chỉ bật ngoài production và chỉ nhận loopback; ghi nhận, không đổi.
- Chồng chéo: `/progress`, `/trainer-overview`, `/trainer-client-overview`.

## Không đổi

`/api/webhooks/sepay`, `/api/auth/google` và `/callback`, `/api/ops/*` (watchdog, smoke test, Render), `/api/blog`, `/api/recipes`, `/api/exercises` (script production),
`/api/ops/csp-report`, `/api/ops/web-vitals`; tiền tố có rate limiter (`/api/auth`, `/orders`, `/checkin`, `/contact`) và 12 tiền tố cổng tính năng trong `server/src/config/todayPlatform.js`.

## Kế hoạch dọn (từng PR nhỏ, route cũ giữ làm bí danh)

| Nhóm | Nội dung | Rủi ro |
|---|---|---|
| B2 (không tiền) — **đã làm** | `training-bookings` (thay `/book`, `/my-booking`, `/my-trainer`), `meal-plan-access` (thay `/check`, `/record`), `practice-center/messages` (thay `/send`), `DELETE site-settings/images` (thay `/remove`). Route cũ giữ làm bí danh (header `Deprecation`, đếm `api.deprecated_route_hits`). Không làm: `coaching-habits/:id/status` và `gyms/all` (không vi phạm bộ quy tắc), `meal-scans/analyze` (chuỗi middleware phụ thuộc đường dẫn), `site-settings/upload/*` | Thấp |
| B3 (tiền, hợp đồng) — **đã làm** | `POST /orders/:id/approve` (thay PUT), `POST /contracts/:id/cancel` (thay PUT), `POST /trainer-subscriptions` và `POST /fitness-plus-subscriptions` (thay `/purchase`). Đường cũ giữ làm bí danh cùng chuỗi middleware, `deprecatedRoute` đặt sau CSRF và kiểm quyền nên chỉ đếm lượt gọi hợp lệ. Đã có `impact-check` và review bảo mật (không có finding mức BLOCK, HIGH, MED) | Cao, đã giảm bằng bí danh và test |
| Sau | Tiền tố số ít, kiểu `/me`, lồng sâu của `f1-customers`, tiền tố admin | Cần kiểm rate limiter, cổng tính năng và script |

Mỗi nhóm: thêm đường mới cùng handler, giữ đường cũ, chuyển client/test sang đường mới, đếm lượt gọi đường cũ, gỡ đường cũ ở PR riêng, xóa dòng khỏi danh sách nợ.
