---
name: staging-verify
description: Kiểm một PR đã merge trên staging (Netlify + Render) có bằng chứng — đợi deploy đúng bản, smoke các route và tính năng vừa đổi, chỉ đọc, báo bảng PASS/FAIL/NOT RUN. Dùng khi user nói đã merge PR và nhờ kiểm tra deploy hoặc test lại.
---

# staging-verify

Mục tiêu: sau khi user merge PR vào `staging`, kết luận được "bản mới chạy đúng" hay "chưa đủ bằng chứng", không phải nhắc lại từng lần.
Chỉ dùng cho staging (`staging--htcoachingweb.netlify.app`, `htcoachingweb-staging.onrender.com`). Production chỉ đọc khi user yêu cầu rõ.
Quy trình release/promotion lên production nằm ở `.claude/rules/release-promotion.md`, không thuộc skill này.

## Quy trình

1. **Biết cái gì đổi.** `gh pr view <N> --json title,mergeCommit,files`; liệt kê route, tính năng, API field cần thấy ở staging.
2. **Đợi đúng bản.** Chọn một tín hiệu riêng của PR rồi thăm dò tối đa khoảng 9 phút, mỗi lần cách ~20 giây:
   route mới trả 200 thay vì 404, hash `assets/index-*.js` ở trang chủ đã đổi, hoặc API trả field mới.
   404 trên route mới nghĩa là chưa deploy xong, không phải lỗi. Backend ngủ: ping `/api/health`. Hết thời gian mà chưa thấy bản mới thì báo `BLOCKED`, không kiểm trên bản cũ.
3. **Smoke chỉ đọc**, mỗi hạng mục một dòng bằng chứng:
   - mở trang, đọc text/DOM (ưu tiên `get_page_text`, `read_page`, đo bằng JS), không chỉ chụp ảnh;
   - tràn ngang `scrollWidth - clientWidth = 0` ở 1440×900 và 390×844 (viewport cố định, không resize khung app);
   - console: phân biệt 401 của khách chưa đăng nhập với lỗi thật;
   - chữ hiển thị là tiếng Việt, không lộ enum hay lỗi kỹ thuật.
4. **Cần đăng nhập.** Phiên hết hạn (bị chuyển về `/login` hoặc màn chọn tài khoản Google): dừng, nói rõ, nhờ user đăng nhập ở cửa sổ Playwright. Không tự đăng nhập, không nhập mật khẩu.
5. **Thao tác ghi trên staging** chỉ khi user đồng ý. Ghi lại giá trị cũ, đổi tối thiểu, kiểm, khôi phục, kiểm lại, và nói tác động còn lại (ví dụ `policyVersion` tăng, dòng nhật ký kiểm toán). Không tạo hay duyệt giao dịch tiền.
6. **Báo cáo ngắn:** bảng `PASS | FAIL | NOT RUN` kèm bằng chứng, phần chưa kiểm và lý do, side effect, việc cần user làm.

## Không làm

- Không tuyên bố PASS khi chưa thấy bản mới, khi chưa đăng nhập được hoặc khi chỉ có test local.
- Không sửa code trong lúc kiểm; lỗi tìm thấy thì báo rồi đề xuất PR riêng.
