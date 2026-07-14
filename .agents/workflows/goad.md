---
name: goad
trigger: /goad
description: Meta-prompting workflow (Self-Healing). Ép AI tự đánh giá, quét codebase, và cập nhật (refactor) một file Skill để chống lại hiện tượng Skill Rot.
---

# /goad — Tự động cập nhật kỹ năng (Skill Self-Healing)

> Chạy workflow này khi nghi ngờ một file trong `.agents/skills/` hoặc `.agents/rules/` bị lỗi thời so với codebase hiện tại.
> Sử dụng: `/goad <đường_dẫn_file>` (Ví dụ: `/goad .agents/skills/quality/ui-quality.md`)

---

## 🛑 TRƯỚC KHI BẮT ĐẦU

### Đây là META-PROMPTING
Bắt đầu từ thời điểm này, bạn (AI) phải đóng vai trò là một **System Architect khắt khe**. Kẻ thù của bạn là "Skill Rot" (Sự mục nát kỹ năng). Bạn sẽ thực hiện quy trình ADLC (Agentic Development Lifecycle) để audit chính bản thân mình.

### Blacklist — KHÔNG ĐƯỢC tự sửa
Các file sau **TUYỆT ĐỐI KHÔNG** được /goad auto-overwrite. Nếu user chỉ định file trong danh sách này → **TỪ CHỐI** và giải thích lý do:

| File | Lý do |
|------|-------|
| `GEMINI.md` | Project rules gốc — chỉ user sửa thủ công |
| `AGENTS.md` | Global rules — chỉ user sửa thủ công |
| Bất kỳ file trong `.agents/workflows/` | Workflows là quy trình — không phải skill data |
| File chứa keyword `security`, `auth`, `csrf` trong tên | An ninh — phải manual review |

---

## Bước 1: Khám nghiệm hiện trường (Scan Context)
Sử dụng các tool có sẵn (`view_file`, `grep_search`) để đọc:
1. Đọc nội dung hiện tại của file skill được user chỉ định.
2. Đọc `client/package.json` và `server/package.json` để xác định chính xác phiên bản thư viện hiện hành (Tech Stack).
3. Quét nhanh codebase thực tế (Ví dụ: các controllers, services, hoặc UI components liên quan đến skill đó) để xem code đang viết theo pattern nào.

## Bước 2: Phản biện (The Goading)
Tự hỏi và trả lời nhanh (Internal Monologue):
- Những hướng dẫn trong file skill hiện tại có còn đúng với Tech Stack hiện hành không? (VD: Đang dùng Vite 8 + Tailwind 4 nhưng file skill lại nói Webpack/Tailwind 3?)
- Có pattern nào trong codebase thực tế mà file skill chưa đề cập không? (VD: Luồng SSE, cơ chế CSRF mới...)
- File skill có bị dài dòng, "dạy đời" kiểu lý thuyết thay vì hành động (Action-oriented) không?

## Bước 3a: Dự thảo (Draft — KHÔNG GHI ĐÈ)

> **QUAN TRỌNG: KHÔNG ĐƯỢC ghi đè file skill trực tiếp ở bước này.**

1. Viết bản skill mới vào **artifact `implementation_plan.md`**.
2. Trình bày rõ ràng:
   - **GIỮA**: Những phần giữ nguyên (và tại sao).
   - **XÓA**: Những phần bị xóa (và tại sao — lỗi thời / sai / thừa).
   - **THÊM**: Những phần mới (và source: codebase thực tế / package.json / pattern quan sát được).
3. Đánh tag confidence cho từng thay đổi:
   - 🟢 **Verified** — Đã xác nhận từ codebase thực tế
   - 🟡 **Assumed** — Dự đoán hợp lý nhưng chưa verify 100%

**TUYỆT ĐỐI TUÂN THỦ TIÊU CHUẨN SAU:**
1. **Practitioner Voice:** Lời văn phải sắc bén, hành động (VD: "Luôn dùng X", "Không dùng Y"). Không dùng từ ngữ ước lệ, khuyên nhủ.
2. **Bottom Line First:** Câu trả lời hoặc rules phải có kết luận ngay từ đầu.
3. **Reference Separation:** File skill chính phải ≤ 10KB. Nếu có code mẫu dài hoặc framework docs, hãy tạo thêm file trong `.agents/skills/reference/` và link sang.
4. **Multi-Mode Workflows:** Ghi rõ kỹ năng này chạy ở Mode nào (VD: *Xây mới* hay *Bảo trì*).
5. **Proactive Triggers:** Thêm một mục "Proactive Triggers", quy định những trường hợp AI phải tự động "báo động" mà không cần user hỏi.
6. **Disambiguation:** Ghi rõ "Khi nào KHÔNG dùng skill này".

4. **DỪNG LẠI** — Set `RequestFeedback: true` trên artifact và chờ user review.

## Bước 3b: Áp dụng (Apply — CHỈ sau khi user APPROVE)

> Chỉ thực hiện bước này **SAU KHI user đã approve** artifact ở bước 3a.

1. Ghi file skill mới bằng `write_to_file` với `Overwrite: true`.
2. Nếu có file reference mới → tạo trong `.agents/skills/reference/`.
3. Verify: đọc lại file vừa ghi để đảm bảo nội dung đúng.

## Bước 4: Báo cáo
In ra một Changelog ngắn gọn về những gì đã được Audit và Update.
Gắn thẻ độ tự tin cho việc cập nhật: 🟢 Verified (Codebase thực tế đúng như vậy) hoặc 🟡 Assumed (Dự đoán một số phần).

---
> Kết thúc quy trình tự phục hồi.
