# Architecture Decision Records

ADR ghi lại quyết định kiến trúc bền, không thay thế spec hoặc implementation plan.

Chỉ tạo ADR khi quyết định đồng thời:

1. Khó hoặc tốn kém để đảo ngược.
2. Sẽ gây bất ngờ nếu maintainer tương lai không biết lý do.
3. Có trade-off thật giữa các phương án.

## Convention

- Filename: `NNNN-<kebab-case-decision>.md`, bắt đầu từ `0001`.
- Dùng [template](./0000-template.md).
- Status: `PROPOSED`, `ACCEPTED`, `SUPERSEDED` hoặc `REJECTED`.
- ADR mới supersede ADR cũ bằng link hai chiều; không sửa lịch sử để giả như quyết định cũ chưa từng tồn tại.
- Không chứa secret, PII, production payload hoặc task progress.
