# Spec: Release staging chỉ AI

## REQ-001 — Giữ phạm vi user đã chọn

- AC-001: Backend ngoài AI giữ bản fba17e6; frontend giữ ae125288 trừ tám file
  thuộc hợp đồng phải tương thích backend cũ. Ngoại lệ đã được user chấp thuận:
  hotfix Progress đầu tháng từ closure đã có fingerprint QA Plan 091; giữ raw key
  làm identity, thêm periodStartDateKey cho lọc/sắp xếp/hiển thị và fallback legacy.
  Không lấy các thay đổi khác trong dirty tree làm nguồn.
  Ngoại lệ package/lock chỉ gồm bản vá dependency mức high đang chặn release;
  không thay business logic hợp đồng/ví hoặc hạ ngưỡng audit.

## REQ-002 — Phục hồi phiên trước khi dùng AI

- AC-002: Request AI chỉ có refresh cookie trả401 trước mọi xử lý guest, quota,
  provider hoặc thay đổi hội thoại. Refresh cookie không được dùng để cấp quyền.
  Câu hỏi time_sensitive vẫn phải xác minh nguồn hiện tại khi KB có citation cũ.
  requiredFoods phải được giữ qua canonicalization ở cả nhánh direct và model;
  follow-up thay một món phải bỏ món cũ khỏi yêu cầu, giữ các món bắt buộc khác.

## REQ-003 — Kiểm chứng trước rollout

- AC-003: Ghi kết quả QA đúng candidate, review bảo mật và attestation cùng SHA
  frontend/backend. Chỉ publish Git/deploy trong phạm vi user cho phép.
  Test loading của provider recovery dùng response gate deterministic, không dựa
  vào việc Playwright kịp quan sát một cửa sổ mock cố định 350 ms.

## REQ-004 — KB và bộ câu hỏi có bằng chứng mới

- AC-004: Re-embed/publish cần backup, custody, review hợp lệ. Bộ kiểm thử gồm
  14 câu gốc và một câu5 thay thế có nhãn; acceptance11 câu là gate riêng.
  Không công nhận ca chưa chạy hoặc thiếu baseline là pass.
