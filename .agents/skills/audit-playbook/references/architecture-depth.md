# Architecture depth review

Đọc reference này khi `$audit` hoặc `$impact-check` đánh giá kiến trúc, coupling hoặc refactor boundary.

## Vocabulary

- **Module**: đơn vị che giấu implementation sau một interface có trách nhiệm rõ.
- **Interface**: bề mặt consumer dùng và là seam chính để test behavior.
- **Depth**: lượng complexity module che giấu so với complexity interface phơi ra.
- **Seam**: boundary có thể quan sát/thay thế mà không xuyên thủng internals.
- **Adapter**: implementation nối một external/provider contract vào seam local.
- **Locality**: code và knowledge thay đổi cùng nhau nằm gần nhau.
- **Leverage**: một thay đổi nhỏ ở module tạo lợi ích cho nhiều consumer hoặc nhiều lần thay đổi sau.

## Review loop

1. Chốt scope bằng user direction; nếu không có, dùng Git churn/hotspots và critical paths. Không scan rộng chỉ vì có thể.
2. Đọc `CONTEXT.md`, spec/ADR liên quan và known issues trước khi gọi một boundary là sai.
3. Ghi friction quan sát được: phải nhảy qua nhiều file để hiểu một concept, interface phơi gần hết complexity,
   test chỉ chạm helper nhưng bỏ lọt integration, hoặc một thay đổi hợp lệ gây shotgun surgery.
4. Chạy **deletion test**: nếu xóa module, complexity có được tập trung ở một nơi tốt hơn hay chỉ bị dời sang callers?
   Chỉ đề xuất deepening khi việc xóa làm mất một abstraction có leverage thật.
5. Với mỗi candidate, ghi before/after bằng dependency list hoặc diagram nhỏ: files, interface hiện tại, coupling,
   seam sau thay đổi, tests sống sót sau refactor và compatibility/rollback.
6. Xếp `Strong`, `Worth exploring` hoặc `Speculative`; chỉ report candidate có evidence `file:line` và local target.

## Guardrails

- Không coi file lớn, nhiều module nhỏ hoặc ít abstraction là lỗi nếu chưa có friction thật.
- Một adapter chỉ là seam giả định; chỉ tạo abstraction/provider interface khi có ít nhất hai consumer/implementation
  hoặc một boundary external cần cô lập vì test/security/operations.
- Không tái tranh luận ADR nếu không có evidence mới đủ mạnh; đánh dấu conflict và trade-off.
- Audit chỉ đề xuất. Refactor chỉ bắt đầu khi user yêu cầu và có plan/verification tương xứng.
