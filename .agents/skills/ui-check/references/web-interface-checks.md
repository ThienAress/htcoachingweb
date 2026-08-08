# Curated web interface checks

Áp dụng cùng `ui-quality`; dùng `rg` để discovery và đọc context trước khi report. Không auto-fail từ text match đơn lẻ.

## Accessibility and forms

- Action dùng `<button>`; navigation dùng `<a>`/`<Link>`; icon-only control có accessible name.
- Async toast/validation/status có `aria-live` phù hợp; ưu tiên semantic HTML trước ARIA.
- Input có label, `name`, đúng `type`/`inputMode`, `autoComplete`; không chặn paste.
- Focus first invalid field khi submit; warn/guard nếu user rời form có thay đổi chưa lưu.

## Content, motion and images

- Flex text child có `min-w-0`; long/user content có `break-words`, truncate hoặc line clamp có chủ đích.
- Không dùng `transition: all`; animate `transform`/`opacity`, hỗ trợ reduced motion và animation interruptible.
- Ảnh có `width`/`height` hoặc aspect ratio chống CLS; below-fold lazy, above-fold critical có priority phù hợp.
- Large list trên 50 item phải có pagination/virtualization/content-visibility hoặc evidence rằng rendering vẫn bounded.

## Navigation, locale and mobile

- Filter/tab/pagination cần deep-link thì đưa vào URL; không ép URL cho transient UI như hover/modal tạm.
- Date/number/currency dùng `Intl.*`; không tự format bằng nối chuỗi.
- Drawer/modal cân nhắc `overscroll-behavior`; full-bleed mobile cân nhắc safe-area inset.
- Native select khai báo foreground/background phù hợp dark mode Windows; touch target tối thiểu 44px.

## Discovery commands

```powershell
rg -n -g "*.jsx" -g "*.js" "onClick|aria-live|autoComplete|inputMode|onPaste" client/src
rg -n -g "*.jsx" -g "*.css" "transition-all|transition: all|prefers-reduced-motion" client/src
rg -n -g "*.jsx" "<img|loading=|fetchPriority=|width=|height=" client/src
rg -n -g "*.jsx" -g "*.js" "toLocale|Intl\.|new Date" client/src
rg -n -g "*.jsx" "\.map\(" client/src
```

Mỗi finding phải có `file:line`, observed impact và confidence. Nếu cần DOM/rendered evidence, dùng browser và ghi viewport.
