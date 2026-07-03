---
name: cleanup-delivery
description: Checklist dọn dẹp và bàn giao code. Use before marking any task as DONE — sau khi implement xong, trước khi báo cáo với user.
---

# Cleanup & Delivery — HTCoachingWeb

> Checklist trước khi coi task là XONG. Áp dụng trước mỗi lần deliver code.

---

## ✅ Checklist

### 🧹 Code Cleanup

- [ ] Xóa toàn bộ `console.log()` debug tạm thời
- [ ] Không để lại commented-out code mới
- [ ] Không có unused imports
- [ ] Không có hardcoded values (dùng env hoặc constants)

### 🏗️ Cấu Trúc

- [ ] Code FE mới nằm đúng folder: `pages/`, `components/`, `hooks/`, `services/`
- [ ] Code BE mới theo đúng MVC: `routes → controllers → services → models`
- [ ] File mới ≤300 dòng (trừ trường hợp đặc biệt có lý do)
- [ ] Naming theo convention (xem `rules/tech_patterns.md`)

### ✔️ Chất Lượng

- [ ] Build thành công: `cd client && npm run build` không lỗi
- [ ] Không tạo breaking changes cho routes/API hiện tại
- [ ] SEO: Page public mới có `<SEO>` component (xem `rules/seo.md`)
- [ ] Security: Không expose credentials, không disable CSRF/rate-limit

### 📋 Báo Cáo

- [ ] Tóm tắt những gì đã thay đổi (files, logic)
- [ ] Nêu rõ nếu có **side effects** hoặc cần thay đổi thêm
- [ ] Nếu thêm route/model mới → liệt kê rõ
- [ ] Nếu thay đổi SEO → kiểm tra sitemap/prerender cần update không
