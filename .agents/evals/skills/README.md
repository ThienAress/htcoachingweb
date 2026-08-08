# Skill evaluation corpora

Các file JSON trong thư mục này là scenario synthetic để kiểm tra routing và output contract của project skills.
Chúng không chứa hội thoại thật, dữ liệu production, secret hoặc absolute local path.

Mỗi corpus dùng `schemaVersion: 1`, có trường **skill** khớp tên file và tối thiểu hai case `should_trigger` cùng hai case
`should_not_trigger`. `expectedEvidence` mô tả bằng chứng quan sát được; validator không gọi model hoặc API trả phí.

Khi sửa một skill có corpus, chạy `npm run test:agents:eval` và đánh giá old/new output theo `$goad`. Kết quả model
không được tự động coi là PASS; phải ghi prompt, expected evidence, actual evidence đã sanitize và reviewer decision.
