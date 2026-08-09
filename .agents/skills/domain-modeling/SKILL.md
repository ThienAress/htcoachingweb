---
name: domain-modeling
description: Xây và giữ vocabulary nghiệp vụ cùng ADR của HTCOACHINGWEB. Dùng khi làm rõ thuật ngữ domain, phát hiện code/spec dùng cùng khái niệm với nhiều tên, hoặc chốt quyết định kiến trúc khó đảo ngược có trade-off thật.
---

# Domain Modeling — HTCOACHINGWEB

Giữ ba artifact có vai trò tách biệt:

- `CONTEXT.md`: glossary nghiệp vụ, không chứa implementation.
- `docs/specs/`: behavior và acceptance criteria của feature.
- `docs/architecture/adr/`: quyết định kiến trúc bền và lý do chọn.

## Quy trình

1. Đọc `CONTEXT.md`, spec liên quan và code thật trước khi đề xuất thuật ngữ.
2. Tách fact khỏi decision: fact tự xác minh từ code; product/trade-off decision phải nêu impact để user quyết định.
3. Khi một thuật ngữ mơ hồ hoặc overloaded, đưa ra scenario cụ thể để phân biệt nghĩa.
4. Khi terminology đã chốt, patch `CONTEXT.md` ngay trong task đang thay đổi domain.
5. Cross-check tên trong API/model/UI. Báo contradiction; không tự rename rộng ngoài scope.
6. Chỉ tạo ADR khi đạt đủ ba điều kiện bên dưới.

## Glossary contract

- Mỗi term có một tên canonical, định nghĩa ngắn và alias cần tránh.
- Mô tả business meaning, ownership hoặc lifecycle quan trọng; không liệt kê file path, function hay code snippet.
- Không biến glossary thành spec, plan, changelog hoặc nơi ghi note tạm.
- Nếu term chỉ đúng trong bounded context, ghi context ngay trong tên/định nghĩa.

## ADR gate

Chỉ tạo ADR khi quyết định đồng thời:

1. Khó hoặc tốn kém để đảo ngược.
2. Sẽ gây bất ngờ cho maintainer tương lai nếu thiếu lý do.
3. Là kết quả của trade-off giữa ít nhất hai phương án thật.

Dùng [ADR template](../../../docs/architecture/adr/0000-template.md). Không tạo ADR cho convention hiển nhiên,
implementation detail tạm thời hoặc quyết định đã nằm đúng chỗ trong spec.

## Verification

- Tìm cùng concept trong `client/`, `server/` và `docs/` để phát hiện tên xung đột.
- Kiểm glossary không chứa secret/PII hoặc chi tiết production.
- Chạy `npm run agents:validate` nếu đã sửa instruction artifact.
