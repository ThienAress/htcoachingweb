# Review policy

## Scoring

Chấm mỗi candidate/change từ 0–2 cho từng tiêu chí:

| Tiêu chí | 0 | 1 | 2 |
|---|---|---|---|
| Relevance | Không liên quan | Có thể dùng | Map trực tiếp local target |
| Evidence | Chỉ là ý kiến | Có example | Có test/eval/source mạnh |
| Novelty | Trùng local | Cải tiến nhỏ | Bổ sung capability thật |
| Compatibility | Xung đột | Cần adapt | Khớp stack/contract |
| Security/license | Không đạt | Cần review | Đã xác minh |
| Maintenance cost | Cao | Trung bình | Thấp, concise |

- `adopt/adapt`: tổng từ 9, không tiêu chí security/license bằng 0.
- `defer`: tổng 6–8 hoặc chưa có use case để forward-test.
- `reject`: tổng dưới 6, duplicate, malicious, license conflict hoặc phá canonical boundary.

Score hỗ trợ quyết định, không thay manual judgment.

## Lifecycle

- **Candidate**: mới discovery, chưa scan chính thức.
- **Active**: map trực tiếp local target, review hàng tháng.
- **Watch**: ưu tiên thấp, review hàng quý.
- **Dormant**: ít nhất 12 tháng không có thay đổi có ý nghĩa và không còn local usage; review 6 tháng/lần.
- **Archived**: repo/skill bị archive, xóa hoặc superseded; giữ tombstone.
- **Rejected**: security/license/compatibility không đạt; giữ lý do để tránh rediscovery.

Không auto-transition chỉ dựa vào ngày commit. Xét đồng thời relevance, local usage, maintainer response,
security, license và nguồn thay thế.
