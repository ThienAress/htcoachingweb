# Báo cáo kiểm thử Vibi trên staging — 2026-10-07

## Phạm vi

Đây là lượt tiếp tục từ task `01a11421-694e-7c01-9bcd-404538082ba2`.
Các ca 1–4 được tái sử dụng từ evidence đã có; không gửi lại. Ca 5–15 được kiểm tra
trên UI staging bằng tài khoản admin đã đăng nhập. Bộ corpus thực tế là 14 câu gốc
và câu 5 thay thế, theo rubric cũ; không gọi đây là một lượt certification exact-15.

Tài khoản dùng Vibi thật với model `deepseek-v4.1-flash`. Ngưỡng dừng là số dư USD3.
Không chuyển sang Gemini khi có lỗi.

## Kết quả tổng hợp

Grade cuối: **12 PASS, 3 FAIL**. Ba ca FAIL đều có lý do đã được lưu evidence:

| Ca | Kết quả | Ghi nhận |
|---:|:---:|---|
| 1–4 | PASS (tái sử dụng) | Evidence cũ, không chạy lại paid request |
| 5 | PASS | Thay tofu bằng cá trong chuỗi ca 4; giữ món khác và macro hợp lệ |
| 6 | PASS | 2.500,2 kcal; 170,1 g protein; 4 bữa; 127.347đ/ngày |
| 7 | PASS | Không có cơm/dầu trong baseline nên giữ nguyên thực đơn theo nhánh canonical |
| 8 | PASS | 4 buổi; 45–55 phút; hiệp/lần/RPE/nghỉ; tiến độ và deload khoảng 30% |
| 9 | FAIL | Có 5 bài, nhưng kỹ thuật Modified Hindu Push-up bị mô tả như push-up thường; review không cho phép PASS |
| 10 | FAIL | `web_required` nhưng live route không có web grounding; trả lời từ chối xác minh |
| 11 | PASS | Hỏi đúng 5 nhóm dữ liệu, không đoán calo/lịch tập |
| 12 | PASS | Đủ 7 ngày, khẩu phần và trạng thái cân, lịch tập/hồi phục, không bịa calo cá nhân |
| 13 | PASS | Dừng khi đau, không chẩn đoán, triage rõ; link AAOS mở tab mới |
| 14 | PASS | Giữ prefill ngồi nhiều, 8.000–11.999 bước, trên 60 phút; chưa tính khi thiếu số đo |
| 15 | FAIL | `web_required` nhưng không có nguồn công khai cập nhật; trả lời từ chối xác minh |

Evidence machine-readable nằm trong [grade-final-user-stop.json](../../.local-data/vibi-paid-resume-20261007/grade-final-user-stop.json).
Mỗi ca có DOM, screenshot và record riêng trong thư mục [vibi-paid-resume-20261007](../../.local-data/vibi-paid-resume-20261007/).

## Lỗi đã sửa

Ca hội thoại tự do TALK01 trước đó gặp `DEEPSEEK_HISTORY_INVALID` sau các lượt tool
đã hoàn tất. Nguyên nhân đã chứng minh trong code: controller tạo lại ID tool theo bộ
đếm từng request, nên các nhóm tool hoàn tất ở hai request có thể dùng cùng ID; provider
kiểm tra uniqueness toàn lịch sử và từ chối.

Bản sửa chuẩn hóa các cặp call/result đã hoàn tất thành ID duy nhất trong request hiện tại,
giữ nguyên nội dung, thứ tự, arguments và không sửa dữ liệu lưu trong DB. Orphan, sai tên,
ID chồng lấn hoặc nhóm chưa hoàn tất vẫn bị từ chối trước network.

- PR: [#204](https://github.com/ThienAress/htcoachingweb/pull/204)
- Merge SHA: `f52db97714ca1916a5d5bf7c711cd007c4602627`
- Files: `deepseek.protocol.js`, `deepseek.provider.js`, regression test, plan và inventory
- Review độc lập: [history-fix-review.md](../../.local-data/vibi-paid-resume-20261007/history-fix-review.md)

CI của merge SHA đạt 5/5: client, server, E2E, secrets và docker. Log xác nhận 939 client
tests, 186 test files, 129 E2E và AI eval 73/73.

## Runtime và chi phí

Sau deploy, Render live deploy `dep-db2tict9fdbs739848l0` và Netlify ready deploy
`6ac5d1dc5051fa000885abd5`; cả hai cùng SHA `f52db977`. Health staging trả HTTP 200.
Cấu hình cuối vẫn là `deepseek/deepseek`, `llm_selection`, endpoint profile `vibi`,
model `deepseek-v4.1-flash`. Không rollback Gemini.

Ví Vibi cuối phiên: **$9.78**, tổng sử dụng **$0.2236**, **19 requests**. Ngưỡng dừng
$3 chưa chạm. 19 requests gồm các lượt lịch sử, probe giới hạn, retry case 5/6 và ca UI;
không có request nào sau khi người dùng yêu cầu dừng ở câu 15.

Probe selector 15 giây có một lần timeout `DEEPSEEK_TIMEOUT`; probe quan sát mở rộng sau đó
trả HTTP 200 nhanh. Đây là bằng chứng độ trễ không ổn định, chưa đủ để kết luận sửa timeout.

## Giới hạn còn lại

- Câu 9 cần sửa nội dung catalog Modified Hindu Push-up và review lại kỹ thuật trước khi
  có thể nâng từ FAIL lên PASS.
- Câu 10 và 15 cần web grounding thật trên route staging; không nên gắn citation thủ công
  để làm xanh grade.
- TALK01 lỗi lịch sử đã được sửa và deploy, nhưng theo yêu cầu không gửi lại paid prompt sau
  khi chốt câu 15. Vì vậy báo cáo không tuyên bố một lượt regression paid mới cho TALK01.
- Case 6 attempt đầu đi nhầm vào hội thoại lịch sử; đã loại khỏi grade. Case 6 attempt 3
  là lượt độc lập hợp lệ. Case 5 attempt lỗi cũ được giữ nguyên evidence.

## Kiểm tra đã chạy

- Focused provider/history/gateway: 45/45 PASS
- Tool validator: 11/11 PASS
- Secret scan, data-boundary scan, docs privacy, agent validator: PASS
- CI merge SHA: 5/5 jobs PASS
- UI staging: đã lưu DOM/screenshot/DB binding cho ca 5–15
- Deploy exact SHA và health: PASS

Không có thay đổi frontend trong bản sửa. Các hội thoại test vẫn được giữ lại trên staging
để người dùng xem lại.
