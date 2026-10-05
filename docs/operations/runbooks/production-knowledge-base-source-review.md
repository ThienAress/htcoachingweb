# Production Knowledge Base Source Review

## Purpose

Workflow `Production Knowledge Base Source Review` đọc production bằng
credential read-only và tạo private review packet để biên tập viên tìm nguồn
cho từng entry. Workflow này không ghi production, không đọc users,
conversations, catalog hoặc embeddings, và không bind credential maintenance.

## Run

1. Vào GitHub Actions và chọn workflow `Production Knowledge Base Source Review`.
2. Chạy `workflow_dispatch` từ `main`.
3. Approve environment `production-kb-source-maintenance` khi GitHub yêu cầu.
4. Tải artifact `production-kb-source-review-packet-<run-id>`.
5. Chỉ dùng packet trong workspace riêng; không commit packet vì nó chứa nội
   dung câu hỏi/câu trả lời production.

Packet chỉ có `sourceId`, question, answer, category, trạng thái review và
metadata source hiện có. Artifact packet tự hết hạn sau 3 ngày; summary không
chứa question, answer hoặc vector.

## Source curation

Nguồn phải hỗ trợ đúng claim, dùng HTTPS không chứa credential, ưu tiên nguồn
chính thức/chuyên môn/nghiên cứu, và không dùng source loại `conversation`.
Không sửa question/answer trong quá trình curation. Lưu danh sách source đã
kiểm tra ở file local để owner nhập thủ công vào production admin.

## Boundary

- `PRODUCTION_ACCOUNT_SYNC_READONLY_URI` là credential duy nhất workflow này
  sử dụng.
- Không thêm `PRODUCTION_KB_MAINTENANCE_URI` vào workflow review.
- Không chạy migration, apply, publish hoặc ghi database từ workflow này.
- Sau khi owner nhập nguồn thủ công, chạy lại staging KB preflight để kiểm tra
  source/evidence/review gate trước khi import staging.
