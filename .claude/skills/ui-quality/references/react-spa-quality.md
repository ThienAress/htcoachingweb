# React 19 + Vite SPA quality

Chỉ dùng reference này cho `client/` hiện tại. Không áp rule Next.js/RSC/server actions/SWR hoặc API package không có
trong `client/package.json`.

## Performance có leverage

- Chạy independent async work bằng `Promise.all`; với partial dependency, start promise sớm và await tại branch cần.
- Lazy-load page route và module nặng; defer analytics/third-party đến khi critical UI đã sẵn sàng.
- Global listener phải deduplicate, cleanup và dùng passive option cho scroll/touch khi handler không `preventDefault`.
- Derive value/boolean trong render thay vì đồng bộ lại bằng effect; dùng functional state update khi state mới phụ thuộc state cũ.
- Không định nghĩa component bên trong component; identity mới mỗi render làm mất state và tăng work.
- Long list cần pagination, virtualization hoặc `content-visibility: auto` sau khi có evidence về size/performance.
- Không thêm `memo`/`useMemo` cho expression rẻ; đo hoặc chứng minh rerender cost trước.

## Composition

- Khi một component có nhiều boolean props tạo tổ hợp khó hiểu, ưu tiên explicit variants hoặc compound components.
- Provider chỉ đáng dùng khi nhiều sibling cần state/actions/meta và consumer không nên biết implementation state.
- Dùng `children` cho composition tự nhiên; không tạo render prop chỉ để bọc JSX đơn giản.
- Không ép Context cho state cục bộ hoặc tạo abstraction khi chỉ có một consumer thật.

## Review evidence

Mỗi finding cần component/file, behavior bị ảnh hưởng, input/listener/render path và cách đo hoặc test. Rule upstream chỉ
là heuristic; project contract, TanStack Query/service layer và observed profile luôn thắng.
