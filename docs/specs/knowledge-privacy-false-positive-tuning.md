# Spec: Giảm nhận diện nhầm của bộ lọc quyền riêng tư Knowledge Base

Trạng thái: **đã được owner đồng ý chính sách ba bậc (2026-10-22), chờ đo baseline**; chưa có code. Liên quan:
[Fitness-first AI và Knowledge quality](./fitness-first-ai-and-knowledge-quality.md),
[Sửa bản nháp Knowledge Entry](./knowledge-draft-publication-repair.md), Plan 096C.

## Assumptions

1. Bộ lọc là `validateKnowledgeEntryPrivacy` (`server/src/services/ai/knowledgePrivacy.js`), dùng cho tạo/sửa/xuất bản mục kiến thức,
   mục sinh từ cuộc trò chuyện và gợi ý AI; cùng module còn lọc truy vấn tìm kiếm (nội bộ và gửi ra ngoài).
2. Thông báo lỗi hiện chỉ nói chung ("không được chứa dữ liệu sức khỏe hoặc định danh cá nhân"); lý do cụ thể
   (`sensitive_personal_health`, `direct_identifier`, `ambiguous_person_identity`) không hiện cho admin.
3. Không bỏ qua bộ lọc theo vai trò admin: admin có thể dán nhầm nội dung thật của khách, và cùng bộ lọc bảo vệ mục sinh từ trò chuyện.
4. Chính sách chốt với owner: khách tự mô tả tình trạng thông thường mà không có định danh không phải dữ liệu cần chặn.

## Objective

Admin sửa và xuất bản được nội dung giáo dục hợp lệ (thuật ngữ thể hình, dẫn nguồn, DOI/PMID trong tiêu đề nguồn, câu hỏi xưng "tôi/em/mình"
về tình trạng thông thường), trong khi mọi định danh và dữ liệu y tế cụ thể gắn với một người vẫn bị chặn. Thành công khi 28 bản nháp production
bị nhận diện nhầm (Plan 096C) qua được bộ lọc mà không phải xóa nguồn hay viết lại câu, và không có mục đã xuất bản nào bị chặn thêm.

## Chính sách ba bậc

1. **Chặn cứng:** số điện thoại, email, ngày sinh, số định danh, địa chỉ, họ tên đi kèm thông tin cá nhân, kết quả xét nghiệm hoặc số đo gắn với
   một người cụ thể, chẩn đoán/thuốc kèm liều của bản thân, URL bản ghi riêng tư.
2. **Cho qua** (mục kiến thức và tìm kiếm nội bộ): tự mô tả tình trạng thông thường không kèm định danh ("Tôi bị skinny fat", "em bị béo bụng",
   "mình thừa cân", "đau lưng", cả bệnh lý phổ biến như tiểu đường, huyết áp cao). Câu trả lời cho bệnh lý nặng kèm lưu ý tham khảo bác sĩ.
3. **Chặt hơn cho truy vấn gửi ra ngoài (tìm web):** không gửi mô tả bệnh cá nhân; chặn hoặc cắt phần mô tả trước khi gửi.

## Cấu trúc file bị ảnh hưởng (dự kiến)

`server/src/services/ai/knowledgePrivacy.js`, `server/src/services/ai/personalHealthData.js`, test
`server/src/services/ai/__tests__/knowledgePrivacy*.test.js` và `personalHealthData.test.js`; có thể một module hằng số thuật ngữ mới trong
`server/src/services/ai/`. Không đổi schema, route, auth, quota hay client.

## Boundaries

- Always: giữ test chặn hiện có; mỗi lần nới có test "vẫn phải chặn" đi kèm; báo cáo đo chỉ chứa số đếm và mã lý do, không lưu hay in nội dung.
- Ask first: thêm thuật ngữ vào danh sách cho qua ngoài nhóm thể hình/dinh dưỡng; đổi hành vi truy vấn gửi ra ngoài; sửa prompt trợ lý.
- Never: bỏ bộ lọc theo vai trò; cho qua theo "đã xuất bản"; commit nội dung Knowledge Base production; chạy cập nhật/xuất bản trên production.

## Requirements và Acceptance Criteria

### REQ-001 — Nội dung giáo dục không bị nhận diện nhầm
- AC-001: Thuật ngữ thể hình/dinh dưỡng viết hoa (ví dụ Body Recomposition, Progressive Overload, Pre-workout, Fat Burner, Anabolic Window, Whey Protein, L-Carnitine) không bị coi là tên người.
- AC-002: Dòng dẫn nguồn và tên tổ chức nổi tiếng (NASM, ACSM, NIH, ISSN, "National Academy of Sports Medicine") không bị coi là dữ liệu sức khỏe cá nhân.
- AC-003: Từ y khoa trong ngữ cảnh hướng dẫn chung, không xưng ngôi thứ nhất, không bị chặn (ví dụ "hỗ trợ tim mạch", "chấn thương thoát vị" trong tiểu sử công khai).

### REQ-002 — Danh pháp thư mục
- AC-004: `DOI: 10.xxxx/…` và `PMID: số` đúng mẫu được chấp nhận chỉ trong tiêu đề nguồn; ở câu hỏi, biến thể, câu trả lời, tag và URL tiêu chí chặn mã định danh vẫn áp dụng.

### REQ-003 — Tự mô tả tình trạng thông thường
- AC-005: Câu hỏi và biến thể xưng ngôi thứ nhất mô tả tình trạng thông thường, không định danh, được chấp nhận ở mục kiến thức và tìm kiếm nội bộ.
- AC-006: Cùng câu khi kèm tên, số điện thoại, email, ngày sinh, địa chỉ hoặc số định danh vẫn bị chặn.
- AC-007: Dữ liệu y tế cụ thể gắn với một người (kết quả xét nghiệm, số đo, thuốc kèm liều, chẩn đoán dành cho bản thân) vẫn bị chặn.

### REQ-004 — Truy vấn gửi ra ngoài giữ chặt
- AC-008: Truy vấn tìm web không mang mô tả bệnh cá nhân hay định danh ra ngoài; hành vi chặn định danh hiện có không đổi.

### REQ-005 — An toàn khi trả lời
- AC-009: Khi khách nói về bệnh lý nặng, câu trả lời của trợ lý có lưu ý tham khảo bác sĩ và không đưa lời khuyên điều trị; nếu hiện chưa có thì thêm một quy tắc nhỏ, có test hành vi.

### REQ-006 — Bằng chứng và rollout
- AC-010: Đo trước/sau trên 28 bản nháp và 39 mục đã xuất bản production (chỉ đọc): số mục bị chặn theo lý do giảm, không mục nào hợp lệ trước đó bị chặn thêm; báo cáo chỉ có số đếm.
- AC-011: Toàn bộ test `knowledgePrivacy*` và `personalHealthData` hiện có pass; mỗi kỳ vọng đổi có lý do ghi trong plan.
- AC-012: `security-reviewer` độc lập không có finding chặn; rollout lên production chỉ qua quy trình release thông thường, không áp dụng tự động.

## Open Questions

- Danh sách thuật ngữ cho qua đầy đủ (chốt sau khi đo 67 mục).
- Cách xử lý tiểu sử VĐV công khai có năm sinh và chuyện gia đình (Plan 096C đã tách thành nhóm cần quyết định riêng); không thuộc phạm vi spec này.
