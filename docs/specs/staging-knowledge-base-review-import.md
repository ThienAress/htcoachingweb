# Staging Knowledge Base Review Import

## Mục tiêu

Đưa 28 bản nội dung đã được rà soát riêng vào database staging để người dùng
kiểm tra trong giao diện trước khi publish. Luồng này không thay thế luồng đồng
bộ production đã reviewed/published.

## Ranh giới dữ liệu

- Manifest được commit chỉ chứa `sourceId`, hash câu hỏi production, câu hỏi và
  câu trả lời đã làm sạch, cùng nguồn tham khảo đã chọn.
- Không đưa `originalQuestion`, `originalAnswer`, conversation reference, hash
  câu trả lời production, token hoặc dữ liệu khách hàng vào manifest.
- Production MongoDB chỉ được kết nối bằng role `read` trên database `gym-app`.
- Target bắt buộc là `htcoaching_staging`; luồng chỉ insert/update các entry
  trong manifest, không delete và không publish.

## Trạng thái sau import

Mỗi entry được ghi với `status=draft`, `reviewStatus=needs_review`,
`embeddingStatus=pending`, `embedding=[]`, `reviewedBy=null` và `reviewedAt=null`.
Reviewer staging chỉ được dùng làm `createdBy`; việc publish vẫn phải đi qua
quy trình review hiện hành.

## Quy trình vận hành

1. `preflight:kb-review-import:staging` kiểm tra manifest, privacy, nguồn
   production, target conflict và tạo `planDigest`.
2. Người vận hành kiểm tra artifact secret-free.
3. `npm run sync:kb-review-import:staging -- --expected-plan-digest=<digest>` chỉ apply khi
   digest khớp preflight; transaction kiểm tra target drift trước và sau ghi.

Workflow GitHub Actions dùng các operation `review-preflight` và `review-apply`;
không dùng operation `apply` của production sync.

## Tiêu chí đạt

- 28/28 manifest entries hợp lệ và qua `validateKnowledgeEntryPrivacy`.
- Mỗi `sourceId` tồn tại ở production và hash câu hỏi khớp.
- Không có conversation-derived source hoặc target normalized-question conflict.
- Preflight/apply artifact không chứa nội dung câu hỏi/câu trả lời.
- Apply chỉ tạo/cập nhật các entry draft ở staging và post-verify thành công.
