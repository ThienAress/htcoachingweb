---
paths:
  - "client/src/**"
---

# Frontend conventions — HTCOACHINGWEB

## Kiến trúc

- Mọi page route lazy-load trong `client/src/App.jsx`: `const X = lazy(() => import("./pages/X"))` trong `<Suspense>`;
  không import page trực tiếp vào router.
- API call nằm trong `client/src/services/<module>.service.js` dùng axios instance `client/src/utils/api.js`;
  component/page chỉ gọi service, không hardcode API URL (`import.meta.env.VITE_API_URL`).
- Server state dùng TanStack Query (`useQuery`/`useMutation`), không `useState + useEffect` để fetch.
  Context chỉ dùng cho auth trừ khi có yêu cầu kiến trúc mới.
- Route cần quyền dùng guard sẵn có trong `client/src/routes/` (`AdminRoute`, `AuthenticatedRoute`, `F1Route`,
  `TodayPlatformRoute`); guard frontend chỉ là UX, quyền thật kiểm ở backend.
- Form dùng React Hook Form + Zod; validation client không thay validation server.
- Styling bằng Tailwind classes; tránh inline style và thao tác DOM trực tiếp khi state/ref giải quyết được.
- Icon mới chỉ dùng `lucide-react`. Không tạo custom hook cho logic dùng một lần.
- Naming: component/page `PascalCase.jsx`, service `camelCase.service.js`, hook `useCamelCase.js`,
  URL public kebab-case tiếng Việt không dấu (`/ket-qua-khach-hang`).
- Page public: theo `.claude/rules/seo.md`. Sửa UI: dùng skill `ui-quality`.

## Overflow và scrollbar

- Vùng `overflow-auto|scroll|x-auto|y-auto` dùng shared scrollbar tokens trong `client/src/index.css`;
  không tạo màu/kích thước scrollbar cục bộ. Style chung phủ cả hai trục, Firefox và WebKit.
- Modal/drawer/portal khóa document scroll bằng hook sẵn có (`useModalScrollLock`), dùng `overscroll-contain`
  khi phù hợp và đặt `color-scheme` đúng surface.
- Scrollbar không che nội dung hoặc chặn keyboard/wheel/trackpad/touch; chỉ ẩn khi có affordance thay thế
  đã kiểm accessibility.

## Ngôn ngữ UI ưu tiên tiếng Việt

- Copy user-visible trong giao diện tiếng Việt (heading, label, loading/empty/error/disabled, toast, dialog,
  notification, CTA) dùng tiếng Việt tự nhiên. Locale nằm ở `client/src/i18n/locales/{vi,en}`.
- Chỉ giữ tiếng Anh cho thuật ngữ chuyên ngành phổ biến (`sets`, `reps`, `tempo`, `RPE`, `RIR`).
  Dùng `Báo cáo tuần`, `nhận xét`, `thông báo trong ứng dụng` thay `Weekly Check-in`, `review`, `in-app`.
- Copy giải thích chỉ mô tả điều người dùng quan sát được (ví dụ `Đường nét đứt thể hiện mức trung bình.`);
  không đưa reasoning thiết kế, chi tiết triển khai hay version kỹ thuật lên UI.
- Giao diện khách hàng và HLV không hiển thị `version`, `revision`, `V1/V2`, `phiên bản N`, trừ khi pháp lý/audit
  bắt buộc phân biệt hai bản ghi.
- Không đổi identifier, API field, enum, route, log key, test fixture hay locale tiếng Anh để Việt hóa.

## Phản hồi submit và mutation

- Mutation do người dùng xác nhận có đủ: action bị khóa/loading khi đang chạy, toast thành công sau khi
  server xác nhận, toast lỗi khi server/network lỗi. Không toast thành công trước `await mutateAsync`/`onSuccess`.
- Lỗi validation hiển thị inline và focus đúng field; không toast khi request chưa gửi.
- Không toast cho autosave, polling, background refresh, read-on-navigation hoặc optimistic toggle đã phản ánh
  trên UI. Chuỗi request chỉ toast một lần cho kết quả cuối.
- Chỉ có một `ToastContainer` global (trong `App.jsx`); không mount container thứ hai.

## Hiển thị số thập phân

- Giữ nguyên độ chính xác ở dữ liệu, API, phép tính; chỉ làm tròn ở presentation. Đổi đơn vị trước, format sau.
- Số đo/ước tính không tài chính: `|x| ≥ 0,1` tối đa 1 chữ số thập phân; `0,01–0,1` tối đa 2; `0,001–0,01` tối đa 3;
  bỏ số 0 thừa (`0,422 → 0,4`, `0,0068 → 0,007`, `3,006 → 3`). Dương nhỏ hơn `0,001` hiển thị `<0,001`;
  zero thật hiển thị `0`; giá trị không hữu hạn dùng placeholder an toàn.
- Dùng `Intl.NumberFormat` theo locale; không rải `toFixed()` trong JSX. Formatter mới phải có test điểm biên.
- Không áp cho tiền, payment/wallet, phần trăm hợp đồng, số liệu y khoa/lab, pháp lý; các domain đó có contract riêng.

## Form cấu hình: Lưu → read-only → Cập nhật

- Áp dụng cho preference/profile/cấu hình user sở hữu có nút lưu rõ ràng. Trước khi lưu: edit mode, CTA `Lưu`.
  Chỉ sau response thành công mới chuyển read-only và CTA `Cập nhật`.
- `Cập nhật` mở lại edit mode, kèm `Lưu` và `Hủy`; `Hủy` khôi phục snapshot server gần nhất. Pending khóa thao tác,
  lỗi giữ edit mode, conflict tải lại snapshot canonical.
- Không áp cho autosave, search/filter, optimistic toggle hoặc transaction (thanh toán, ký hợp đồng, gửi báo cáo).
