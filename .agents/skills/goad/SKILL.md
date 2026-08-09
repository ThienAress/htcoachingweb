---
name: goad
description: Audit instruction drift và cập nhật một Codex skill theo codebase thực tế. Dùng khi file trong `.agents/skills/` có dấu hiệu lỗi thời; luôn tạo draft repo-native và chờ user phê duyệt rõ ràng trước khi sửa.
---

# $goad — Tự động cập nhật kỹ năng (Skill Self-Healing)

> Chạy workflow này khi nghi ngờ một file trong `.agents/skills/` hoặc `.agents/rules/` bị lỗi thời so với codebase hiện tại.
> Sử dụng: `$goad <đường_dẫn_file>` (ví dụ: `$goad .agents/skills/ui-quality/SKILL.md`)

---

## 🛑 TRƯỚC KHI BẮT ĐẦU

### Đây là META-PROMPTING
Bắt đầu từ thời điểm này, bạn (AI) phải đóng vai trò là một **System Architect khắt khe**. Kẻ thù của bạn là "Skill Rot" (Sự mục nát kỹ năng). Bạn sẽ thực hiện quy trình ADLC (Agentic Development Lifecycle) để audit chính bản thân mình.

### Blacklist — KHÔNG ĐƯỢC tự sửa
Các file sau **TUYỆT ĐỐI KHÔNG** được `$goad` auto-overwrite. Nếu user chỉ định file trong danh sách này → **TỪ CHỐI** và giải thích lý do:

| File | Lý do |
|------|-------|
| `AGENTS.md` | Project rules gốc — chỉ sửa khi user yêu cầu trực tiếp |
| `.agents/reference/project-guide.md` | Project reference gốc — chỉ sửa khi user yêu cầu trực tiếp |
| Bất kỳ file trong `.agents/rules/` | Luật cứng — cần manual review |
| File chứa keyword `security`, `auth`, `csrf` trong tên | An ninh — phải manual review |

---

## Bước 1: Khám nghiệm hiện trường (Scan Context)
Sử dụng công cụ đọc file và `rg` để:
1. Đọc nội dung hiện tại của file skill được user chỉ định.
2. Đọc `client/package.json` và `server/package.json` để xác định chính xác phiên bản thư viện hiện hành (Tech Stack).
3. Quét nhanh codebase thực tế (Ví dụ: các controllers, services, hoặc UI components liên quan đến skill đó) để xem code đang viết theo pattern nào.

## Bước 2: Phản biện (The Goading)
Đánh giá nội bộ và chỉ ghi kết luận có bằng chứng vào bản audit:
- Những hướng dẫn trong file skill hiện tại có còn đúng với Tech Stack hiện hành không? (VD: Đang dùng Vite 8 + Tailwind 4 nhưng file skill lại nói Webpack/Tailwind 3?)
- Có pattern nào trong codebase thực tế mà file skill chưa đề cập không? (VD: Luồng SSE, cơ chế CSRF mới...)
- File skill có bị dài dòng, "dạy đời" kiểu lý thuyết thay vì hành động (Action-oriented) không?

## Bước 3a: Dự thảo (Draft — KHÔNG GHI ĐÈ)

> **QUAN TRỌNG: KHÔNG ĐƯỢC ghi đè file skill trực tiếp ở bước này.**

1. Tạo bản audit repo-native tại `docs/audits/YYYY-MM-DD-<skill-name>-skill-drift.md`. Không ghi đè audit có sẵn; nếu tên đã tồn tại, thêm suffix ngắn mô tả phạm vi.
2. Trình bày rõ ràng:
   - **GIỮ**: Những phần giữ nguyên (và tại sao).
   - **XÓA**: Những phần bị xóa (và tại sao — lỗi thời / sai / thừa).
   - **THÊM**: Những phần mới (và source: codebase thực tế / package.json / pattern quan sát được).
   - **VERIFY**: Lệnh hoặc kiểm tra chứng minh bản skill mới khớp codebase.
3. Đánh tag confidence cho từng thay đổi:
   - 🟢 **Verified** — Đã xác nhận từ codebase thực tế
   - 🟡 **Assumed** — Dự đoán hợp lý nhưng chưa verify 100%

**TUYỆT ĐỐI TUÂN THỦ TIÊU CHUẨN SAU:**
1. **Practitioner Voice:** Lời văn phải sắc bén, hành động (VD: "Luôn dùng X", "Không dùng Y"). Không dùng từ ngữ ước lệ, khuyên nhủ.
2. **Bottom Line First:** Câu trả lời hoặc rules phải có kết luận ngay từ đầu.
3. **Reference Separation:** File skill chính nên gọn và dưới 500 dòng. Nếu có code mẫu dài hoặc framework docs, tạo `references/` trong chính thư mục skill và link trực tiếp từ `SKILL.md`.
4. **Multi-Mode Workflows:** Ghi rõ kỹ năng này chạy ở Mode nào (VD: *Xây mới* hay *Bảo trì*).
5. **Proactive Triggers:** Thêm một mục "Proactive Triggers", quy định những trường hợp AI phải tự động "báo động" mà không cần user hỏi.
6. **Disambiguation:** Ghi rõ "Khi nào KHÔNG dùng skill này".

4. Gửi user đường dẫn bản audit, tóm tắt thay đổi dự kiến và yêu cầu **phê duyệt rõ ràng**.
5. **DỪNG LẠI** — Không coi im lặng, yêu cầu audit ban đầu hoặc việc tạo draft là quyền sửa skill. Chờ user approve trong một message tiếp theo.

## Bước 3b: Áp dụng (Apply — CHỈ sau khi user APPROVE)

> Chỉ thực hiện bước này **SAU KHI user đã approve rõ ràng** bản audit ở bước 3a.

1. Đọc lại target và `git diff` vì codebase có thể đã thay đổi trong lúc chờ approval. Nếu evidence hoặc phạm vi đã đổi đáng kể, cập nhật draft và xin duyệt lại.
2. Cập nhật `SKILL.md` bằng `apply_patch` có phạm vi nhỏ khi công cụ này khả dụng; nếu runtime không cung cấp `apply_patch`, dùng cơ chế patch tương đương của runtime và tuyệt đối không ghi đè toàn file bằng shell write trick.
3. Nếu có reference mới → tạo trong `<skill>/references/`.
4. Verify: đọc lại file vừa ghi, chạy các kiểm tra nêu trong draft và xem `git diff -- <target> <references>` để bảo đảm không sửa ngoài phạm vi đã duyệt.

## Bước 4: Báo cáo
In ra một Changelog ngắn gọn về những gì đã được audit và update, kèm file đã sửa, validation đã chạy và phần chưa thể kiểm chứng.
Gắn thẻ độ tự tin cho việc cập nhật: 🟢 Verified (Codebase thực tế đúng như vậy) hoặc 🟡 Assumed (Dự đoán một số phần).

---
> Kết thúc quy trình tự phục hồi.
