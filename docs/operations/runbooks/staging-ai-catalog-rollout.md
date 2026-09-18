# Runbook: staging AI catalog rollout

## Phạm vi

Runbook này chỉ áp dụng cho cohort Plan 092 trên database
`htcoaching_staging`: 5 Exercise exact-ID, 3 Food exact-label và 3
FoodPriceObservation exact identity. Không dùng các lệnh này cho production.

Mọi maintenance phải chạy từ workflow `Staging Live Acceptance` với:

- SHA 40 ký tự đã có CI thành công trên nhánh `staging` của chính repository;
- exact Netlify deploy ID và Render deploy ID cùng trỏ tới SHA đó;
- preflight artifact được review trước khi apply;
- exact SHA-256 plan digest từ preflight cho apply.

Không đặt URI, token hoặc credential vào artifact hay nội dung review.

## Trình tự rollout

1. Deploy exact candidate lên Netlify staging và Render staging.
2. Chạy operation `search-cohort-rollback-preflight`.
3. Review bounded writes và digest; sau đó chạy
   `search-cohort-rollback-apply` với đúng digest.
4. Chạy operation `ai-catalog-preflight`.
5. Review đúng 5 exercise inserts, 3 food updates và 3 price inserts cùng
   evidence; sau đó chạy `ai-catalog-apply` với đúng digest.
6. Chỉ tiếp tục acceptance khi post-verification trả readiness `ready=true`.
7. Giữ artifacts `staging-maintenance.json`, `staging-deploy-identity.json` và
   `staging-deploy-identity-post-maintenance.json` theo run evidence; hai identity
   artifacts phải cùng xác minh exact deploy IDs/SHA trước và sau maintenance.

Nếu source, target, marker hoặc deploy identity thay đổi giữa preflight và apply,
không sửa digest bằng tay; chạy lại preflight và review từ đầu.

Mỗi `update_food` trong bounded writes phải hiện đúng allowlist provenance:
`sourceType`, `sourceUrl`, `taxonomySourceUrl`, `reviewedAt`, `reviewedScopes`,
`scope` và `crossContactStatus`. Artifact không được chứa marker snapshot,
credential hoặc raw provider payload.

## Allergen semantics

Nguồn USDA FoodData Central trong rollout xác minh danh tính/thành phần thực phẩm
nguyên bản. FDA/USDA-FSIS chỉ cung cấp taxonomy dị ứng. Chúng không chứng minh
không nhiễm chéo cho một SKU cụ thể.

- Output có ràng buộc dị ứng được gắn `ingredient_verified` và phải hiển thị cảnh
  báo kiểm tra nhãn/nhà sản xuất.
- Yêu cầu xác minh ở cấp nhãn sản phẩm hoặc “không nhiễm chéo” phải fail closed
  nếu không có nguồn `package_label` hoặc `manufacturer` hợp lệ.
- Không đổi `crossContactStatus` thành trạng thái đã xác minh chỉ để readiness xanh.

## Vòng đời dữ liệu giá

Ba quan sát giá hiện tại có `observedAt=2026-08-11T00:00:00.000Z`. Với cửa sổ
90 ngày, chúng còn hợp lệ tại đúng `2026-11-09T00:00:00.000Z` và stale ngay sau
thời điểm đó. Lên lịch refresh trước ngày 2026-11-09.

Refresh bắt buộc theo thứ tự:

1. Dùng release đang quản lý cohort hiện tại để chạy rollback preflight/apply.
2. Xác minh lại URL, pack size, regular/promotional price và ngày quan sát cho đúng
   ba Food; cập nhật manifest và bump
   `STAGING_AI_CATALOG_ROLLOUT_VERSION`.
3. Deploy exact SHA mới, chạy lại preflight/apply theo trình tự rollout ở trên.

Không ghi đè observation cũ tại chỗ, không để marker version cũ tồn tại rồi chạy
binary version mới, và không kéo dài freshness bằng cách chỉ sửa ngày quan sát.

## Rollback

1. Chạy `ai-catalog-rollback-preflight` trên chính release/version đang sở hữu
   marker.
2. Review exact 5 deletes, 3 Food restores và 3 price deletes cùng digest.
3. Chạy `ai-catalog-rollback-apply` với đúng digest.
4. Xác nhận `residue=0`. Nếu có review, content drift, marker drift hoặc snapshot
   mismatch, dừng; không xóa tay để vượt guard.

Rollback là transaction: mọi lỗi giữa chuỗi thao tác phải để lại zero committed
writes. Exercise do rollout quản lý không nhận review nên rollback không được tạo
orphan review.
