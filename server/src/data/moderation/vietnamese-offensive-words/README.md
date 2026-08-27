# Vietnamese offensive words snapshot

Nguồn: <https://github.com/blue-eyes-vn/vietnamese-offensive-words>

- File upstream: `vn_offensive_words.txt`
- Commit đã ghim: `684b568e4d54ce47b743d7c564447e29a02cc260`
- License: MIT, xem `LICENSE.md` trong cùng thư mục.
- Mục đích hiện tại: validation tên Saved Meal Plan ở backend.

Snapshot được lưu trong repository để runtime không phụ thuộc GitHub hoặc package
bên thứ ba. Không tự đồng bộ theo nhánh `main`. Khi nâng phiên bản, phải review
diff từ ngữ, cập nhật commit ở đây và chạy lại test false-positive trước khi phát hành.

File dữ liệu giữ nguyên định dạng upstream. Loader bỏ dòng trống, dòng bắt đầu
bằng `#` và normalize Unicode/whitespace trước khi tạo matcher.
