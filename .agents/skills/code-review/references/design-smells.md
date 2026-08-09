# Design smell baseline

Đây là heuristic bổ sung cho axis Standards, không phải hard rule. Project policy/convention luôn thắng; bỏ qua style
đã được lint/compiler enforce. Chỉ report khi smell xuất hiện trong review surface và có impact cụ thể.

| Smell | Evidence cần thấy | Hướng xử lý thường dùng |
|---|---|---|
| Mysterious Name | Tên không mô tả được business meaning hoặc side effect | Đặt lại tên; nếu không thể đặt tên trung thực, làm rõ design |
| Duplicated Code | Cùng logic shape ở nhiều hunk/file | Gom một source of truth có consumer thật |
| Feature Envy | Module đọc internals của module khác nhiều hơn dữ liệu của chính nó | Đưa behavior gần data/owner phù hợp |
| Data Clumps | Cùng nhóm field/param luôn đi cùng nhau | Tạo contract/domain object khi giúp validation và naming |
| Primitive Obsession | String/number đại diện domain concept có invariant | Tạo validator/type/value object ở boundary phù hợp |
| Repeated Switches | Cùng enum/status cascade lặp ở nhiều nơi | Dùng shared transition/map; không ép polymorphism khi map đủ rõ |
| Shotgun Surgery | Một business change buộc sửa rải rác nhiều producer/consumer | Tập trung contract hoặc module ownership |
| Divergent Change | Một file đổi vì nhiều lý do nghiệp vụ không liên quan | Tách theo responsibility khi change history chứng minh |
| Speculative Generality | Abstraction/hook/option chưa có use case trong spec | Xóa hoặc defer đến nhu cầu thật |
| Message Chains | Caller phụ thuộc chuỗi internals dài | Che navigation sau interface của owner đầu tiên |
| Middle Man | Layer chỉ chuyển tiếp mà không thêm policy/translation | Gọi owner trực tiếp, trừ khi layer là security/compatibility seam |

Không report smell chỉ từ tên pattern. Mỗi finding phải có `file:line`, behavior/maintenance impact và confidence.
