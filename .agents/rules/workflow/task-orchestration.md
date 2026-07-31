---
name: task-orchestration
description: Quy tắc phân loại độ phức tạp của task và quyết định khi nào root agent tự làm, khi nào giao workstreams độc lập cho subagents.
---

# Task Orchestration — HTCOACHINGWEB

## Kết luận bắt buộc

Root agent phải đánh giá mọi task là `SIMPLE`, `MODERATE` hoặc `COMPLEX` trước khi
hành động. Task dễ do root agent tự xử lý. Task phức tạp được chia cho subagents chỉ
khi có các workstream độc lập; root agent luôn chịu trách nhiệm plan, tích hợp, review
chéo, verification và báo cáo cuối.

Quy tắc của system/developer, giới hạn công cụ và yêu cầu trực tiếp của user luôn ưu
tiên cao hơn file này. Không spawn subagent nếu môi trường hiện tại không cho phép.

## Rubric phân loại

Đánh giá đồng thời năm yếu tố:

1. **Change surface**: số file và số subsystem bị chạm.
2. **Dependency depth**: một layer hay xuyên FE/API/service/model/CI/docs.
3. **Risk**: auth, security, payment, wallet, dữ liệu, production hoặc migration.
4. **Uncertainty**: root cause/contract đã rõ hay cần nhiều hướng điều tra.
5. **Parallelism**: có ít nhất hai nhóm file độc lập, không cần sửa cùng hotspot hay không.

| Mức | Dấu hiệu điển hình | Cách thực hiện mặc định |
|---|---|---|
| `SIMPLE` | 1–3 file, một layer, hành vi rõ, rủi ro thấp | Root agent tự cover, verification nhỏ nhất đủ chứng minh |
| `MODERATE` | 4–7 file, hai layer hoặc có một contract cần trace | Root agent lập plan và tự làm; chỉ delegate một investigation độc lập nếu thật sự có lợi |
| `COMPLEX` | Trên 7 file, từ ba workstream độc lập, cross-layer/risk cao hoặc nhiều verification gate | Root agent khóa plan và file ownership, giao các workstream độc lập cho subagents, rồi tích hợp |

Không phân loại chỉ theo số file. Một thay đổi 2 file liên quan JWT/payment có thể là
`COMPLEX`; một rename cơ học 10 file có thể là `MODERATE` nếu contract và verification rõ.

## Khi phải giữ ở root agent

- Task nhỏ hơn chi phí phối hợp.
- Các bước phụ thuộc tuần tự và không thể kiểm chứng độc lập.
- Nhiều người sẽ phải sửa cùng một file hoặc cùng một symbol trung tâm.
- Cần một quyết định sản phẩm/bảo mật duy nhất trước khi có thể chia việc.
- Subtask chỉ là đọc một file hoặc chạy một lệnh ngắn.

Không spawn subagents để tạo cảm giác đang song song hóa.

## Cách giao task phức tạp

Trước khi spawn:

1. Root agent đọc Git status, AGENTS/rules/skills liên quan và tạo plan có done criteria.
2. Chia theo **workstream có output kiểm chứng được**, không chia tùy tiện theo số file.
3. Mỗi subagent nhận file ownership không chồng lấn, phạm vi cấm sửa và verification riêng.
4. Giữ lại phần kiến trúc, file canonical và integration cho root agent.

Trong khi chạy:

- Subagents được phép đọc toàn repo nhưng chỉ sửa file đã được giao.
- Nếu phát hiện cần chạm file ngoài scope hoặc file đang bị sửa đồng thời, subagent dừng
  phần ghi và báo root agent.
- Không để hai subagents chỉnh cùng file. Investigations read-only có thể chạy song song.

Sau khi nhận kết quả:

1. Root agent đọc toàn bộ diff; không ghép kết quả một cách mù quáng.
2. Reconcile contract, naming, path, duplicated rules và side effects giữa các workstream.
3. Chạy verification tích hợp tương xứng với rủi ro, kể cả khi từng subagent đã test riêng.
4. Root agent là người duy nhất kết luận task hoàn thành và viết báo cáo cuối.

## Cách giao tiếp

- Với `SIMPLE`: làm trực tiếp, không cần thông báo về việc không dùng subagents.
- Với `MODERATE`: nêu plan khi task nhiều bước; nói rõ nếu có delegation đặc biệt.
- Với `COMPLEX`: thông báo ngắn rằng task đã được chia thành những workstream nào và
  root agent sẽ tổng hợp/review cuối.
- Báo cáo cuối phải nêu phần nào do subagents thực hiện, verification tích hợp và phần
  chưa chạy; không chuyển trách nhiệm kết quả cho subagents.
