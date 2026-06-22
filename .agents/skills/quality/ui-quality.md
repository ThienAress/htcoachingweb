---
name: ui-quality
description: Checklist chất lượng UI/UX khi tạo hoặc sửa giao diện. Use khi code component mới, tạo trang mới, hoặc refactor UI. Đảm bảo design không bị generic/AI-slop và copy rõ ràng, nhất quán.
---

# UI Quality — HTCoachingWeb

> **Nguồn gốc:** Cherry-pick từ frontend-design (Anthropic) + taste-skill (Leonxlnx), đã adapt cho stack htcoachingweb (Tailwind v4, GSAP, Lucide React).

---

## 1. Respect Existing Design Language

htcoachingweb đã có design cố định. AI **KHÔNG** tự ý sáng tạo aesthetic mới.

**Trước khi code UI:**
- Xem các trang hiện có để hiểu tone, palette, spacing đang dùng
- Match font sizes, colors, spacing với các pages cùng loại
- Nếu cần thay đổi design direction → **hỏi user trước**

**Quy tắc:**
- Trang public mới phải trông như **cùng một website** với trang chủ
- Trang admin/trainer mới phải match với layout admin/trainer hiện có
- Không tự ý thêm gradient, animation, hay decorative elements mà các trang khác không có

---

## 2. Copy & Writing Rules

> *"Words are design material, not decoration."* — Anthropic frontend-design

### Button Labels
```
✅ ĐÚNG — Active voice, nói rõ action:
"Lưu thay đổi", "Đăng ký", "Gửi yêu cầu", "Xóa gói tập"

❌ SAI — Mơ hồ, passive:
"Submit", "Gửi", "Xác nhận", "OK"
```

### Naming Consistency
```
✅ ĐÚNG — Cùng hành động, cùng tên xuyên suốt flow:
Button: "Đăng ký" → Toast: "Đăng ký thành công" → Email subject: "Xác nhận đăng ký"

❌ SAI — Mỗi nơi gọi khác:
Button: "Đăng ký" → Toast: "Tạo tài khoản thành công" → Email: "Welcome"
```

### Error Messages
```
✅ ĐÚNG — Nói rõ lỗi gì, làm gì tiếp:
"Email đã được sử dụng. Vui lòng dùng email khác hoặc đăng nhập."
"Ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn."

❌ SAI — Mơ hồ, xin lỗi:
"Oops! Đã có lỗi xảy ra."
"Something went wrong. Please try again."
"Có lỗi rồi!"
```

### Empty States
```
✅ ĐÚNG — Hướng dẫn hành động tiếp theo:
"Chưa có lịch sử check-in. Bắt đầu check-in đầu tiên của bạn."
"Chưa có gói tập nào. Tạo gói tập mới để bắt đầu."

❌ SAI — Chỉ nói trống:
"Không có dữ liệu"
"No data found"
```

### Ngôn ngữ
- Giao diện public → **tiếng Việt**, giọng thân thiện nhưng chuyên nghiệp
- Giao diện admin/trainer → tiếng Việt, giọng ngắn gọn, functional
- Không dùng tiếng Anh trộn lẫn trừ thuật ngữ kỹ thuật (TDEE, BMI, PT)
- Không dùng: "Seamless", "Next-Gen", "Elevate", "Game-changer" — AI-slop copy

---

## 3. Color Consistency Lock

> *Một khi accent color đã được chọn cho page → dùng nó XUYÊN SUỐT page.*

**Quy tắc:**
- Không đột ngột đổi accent color giữa các section
- Warm-grey site không bỗng có blue CTA ở section cuối
- Button primary color phải nhất quán: nếu hero dùng emerald → footer CTA cũng emerald
- Khi tạo component mới → check accent color của trang chứa nó trước

**Kiểm tra:** Cuộn từ trên xuống dưới page — accent color có nhất quán không?

---

## 4. Hero Fits Viewport

> *Hero là first impression. Nếu user phải scroll để thấy CTA → hero đã fail.*

**Quy tắc cho trang public có hero section:**
- Headline: tối đa **2 dòng** trên desktop
- Subtext: tối đa **20 từ** hoặc **3-4 dòng**
- CTA button: **phải visible** không cần scroll
- Dùng `min-h-[100dvh]` thay vì `h-screen` (tránh iOS Safari viewport jump)

**Không áp dụng cho:** trang admin, trainer dashboard, form pages — chỉ cho landing/marketing pages.

---

## 5. Anti-Slop Patterns

> *AI hay tạo ra UI trông giống nhau. Nhận biết và tránh các patterns sau.*

### ❌ Patterns cần tránh

| Pattern | Vấn đề | Thay thế |
|---------|--------|---------|
| **3 cards bằng nhau** hàng ngang | Generic nhất AI hay tạo | 2-column zig-zag, asymmetric grid, hoặc highlight card chính |
| **Pure-black shadow** (`shadow-md` với rgba(0,0,0,...)) | Trông flat, không tự nhiên | Tint shadow theo background hue |
| **Centered everything** | Mọi thứ đều căn giữa → nhàm chán | Left-aligned content, split layout khi phù hợp |
| **3 cột pricing bằng nhau** | Template look | Highlight gói recommended bằng scale, color, border |
| **Circular spinner loading** | Generic | Skeleton loader match layout shape |
| **"01 / 02 / 03" numbering** | Chỉ dùng khi content thực sự có thứ tự | Bỏ numbering nếu không phải sequence |
| **Gradient tím/xanh AI** | "AI smell" rõ nhất | Dùng palette hiện tại của htcoachingweb |

### ✅ Thay thế tốt hơn

- **Feature section:** Highlight 1-2 features chính lớn hơn, còn lại nhỏ hơn → tạo hierarchy
- **Testimonial:** Không dùng 3-card carousel với dots → dùng 1 quote lớn hoặc masonry wall
- **Pricing:** Gói khuyến nghị to hơn, màu khác, có badge "Phổ biến nhất"
- **Stats:** Không dùng "big number + gradient" mặc định → chỉ dùng khi số liệu thật sự ấn tượng

---

## 6. Accessibility Basics

> *Không cần full WCAG audit, nhưng những điều sau là bắt buộc.*

### Contrast Check (bắt buộc)
- Button text phải đọc được trên button background (WCAG AA: 4.5:1 ratio)
- **Cấm:** white text trên white button, transparent button không có border trên nền sáng
- Form input placeholder phải đủ contrast để đọc được
- Error text (thường đỏ) phải đủ contrast trên nền section

### Reduced Motion (bắt buộc khi dùng GSAP)
```jsx
// ✅ ĐÚNG — GSAP animation có fallback
useEffect(() => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return; // skip animation
  
  // GSAP animation code...
  return () => ctx.revert();
}, []);
```

### Keyboard Navigation
- Mọi interactive element phải có visible focus state
- Tab order phải hợp lý (trên → dưới, trái → phải)
- Modal mở → focus trap bên trong modal

### Dark Mode
- htcoachingweb hiện **chưa có dark mode** — không bắt buộc implement
- Nếu thêm dark mode trong tương lai → dùng Tailwind `dark:` variant, set 1 lần ở root

---

## 7. Output Enforcement

> *AI không được cắt code, bỏ dở, hoặc dùng placeholder.*

### Cấm hoàn toàn trong code output

```
❌ // ...
❌ // rest of code
❌ // implement here
❌ // TODO
❌ /* ... */
❌ // similar to above
❌ // continue pattern
❌ // add more as needed
```

### Cấm trong giao tiếp

```
❌ "Let me know if you want me to continue"
❌ "for brevity, I'll skip..."
❌ "the rest follows the same pattern"
❌ "and so on"
❌ "I'll leave that as an exercise"
```

### Khi output dài

Nếu response quá dài → dừng ở **clean breakpoint** (cuối function, cuối file):
```
[PAUSED — 3/5 files hoàn thành. Gõ "continue" để tiếp tục từ: file tiếp theo]
```

Tiếp tục từ đúng chỗ dừng. Không recap, không lặp lại.

---

## Quick Check — Trước Khi Ship UI

Chạy nhanh trước khi coi task UI là xong:

- [ ] UI mới match design language hiện tại?
- [ ] Copy rõ ràng, active voice, không AI-slop words?
- [ ] Error messages nói rõ lỗi gì + cách fix?
- [ ] Empty states có hướng dẫn hành động?
- [ ] Accent color nhất quán xuyên suốt page?
- [ ] Hero (nếu có) fit viewport, CTA visible?
- [ ] Không có 3-equal-cards hoặc centered-everything?
- [ ] Button contrast đủ đọc được?
- [ ] GSAP animation có reduced-motion fallback?
- [ ] Code output đầy đủ, không có `// ...` placeholder?
