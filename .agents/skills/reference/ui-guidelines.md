# UI Guidelines & Anti-Slop Reference (HTCOACHING)

> Tài liệu tham khảo sâu về UI/UX cho HTCOACHING. Dùng khi cần tra cứu chi tiết về quy tắc màu sắc, typography, hoặc motion. KHÔNG đọc file này nếu không có yêu cầu cụ thể.

## 1. Register: Brand vs Product

| Khía cạnh | Brand surfaces (Landing, Pricing, Heroes) | Product surfaces (Dashboard, Forms, Tables) |
|-----------|-------------------------------------------|---------------------------------------------|
| **Typography** | Display font lớn, fluid `clamp()` | Fixed rem scale, tighter ratio |
| **Motion** | Orchestrated entrance, staggered GSAP reveals | 150-250ms chỉ cho state changes |
| **Color** | Cho phép bold, committed palette | Restrained — accent chỉ cho primary actions |
| **Layout** | Asymmetric, art direction per section | Structural responsive, consistent |

## 2. Color Rules (WCAG AA)
- **Contrast Body Text:** Tỷ lệ tối thiểu 4.5:1. 
- **Không dùng Gray text trên nền màu:** Dùng shade đậm/nhạt hơn của cùng hue (VD: nền `emerald-600` thì text `emerald-100` hoặc `white/70`).
- **Color Consistency:** Accent color phải đồng nhất từ trên xuống dưới một page.
- **Không Pure Black/White:** Dùng `zinc-900`, `zinc-50` thay vì `#000` và `#fff`.

## 3. Typography Rules
- **Line Length:** Giới hạn 65-75 ký tự (`max-w-prose` hoặc `max-w-2xl`).
- **Hierarchy:** Không skip level (h1 -> h2 -> h3).
- **Text Wrap:** `text-wrap: balance` cho headings, `text-wrap: pretty` cho body text.

## 4. Layout & Cards
- **Không lạm dụng Cards:** Không dùng nested cards. Data grid là ok, nhưng nếu có 3 cards giống hệt nhau, hãy làm asymmetric (nhấn mạnh 1 card).
- **Z-index Scale Semantic:** dropdown `z-10`, sticky `z-20`, modal-backdrop `z-40`, modal `z-50`, toast `z-[60]`. TUYỆT ĐỐI KHÔNG `z-[9999]`.

## 5. AI Slop — Tuyệt đối cấm (MATCH-AND-REFUSE)
1. **Side-stripe borders:** (`border-l-4 border-blue-500`)
2. **Gradient text:** (`bg-clip-text text-transparent`)
3. **Glassmorphism mặc định:** (`backdrop-blur bg-white/10` cho cards)
4. **Purple-to-blue gradient:** Phải dùng palette emerald/cyan của HTCOACHING.
5. **Eyebrow spam:** Section nào cũng có text nhỏ in hoa ở trên (VỀ CHÚNG TÔI, DỊCH VỤ).
6. **Bounce/Elastic animation:** (`ease-bounce`). Chỉ dùng exponential.

## 6. Motion (GSAP)
- **Chỉ Exponential Easing:** `power3.out`, `power4.out`, `expo.out`.
- **Reduced Motion:** Bắt buộc có check `prefers-reduced-motion` trong React `useEffect`.
- **Reveal Safety:** Không dùng class `opacity-0` tĩnh ở HTML. Dùng JS để animate từ 0 lên 1, đảm bảo nếu JS lỗi user vẫn thấy content.

## 7. Giao tiếp (Copywriting)
- **Active Voice:** "Lưu thay đổi", "Đăng ký". Cấm: "Submit", "OK".
- **Error Messages:** Phải nói rõ lỗi gì và cách sửa. Cấm: "Oops, something went wrong".
- **Tiếng Việt:** Public page dùng tiếng Việt thân thiện, admin dùng tiếng Việt ngắn gọn functional.
