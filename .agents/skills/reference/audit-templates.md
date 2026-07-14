# Audit Templates & Output Format

> Tài liệu tham khảo cho `/audit`. Chứa finding format, output table, và prioritization rules.
> Đọc khi cần viết audit report. KHÔNG đọc khi chỉ cần biết audit scope.

---

## Finding Format

Mỗi finding PHẢI theo format này:

### [CATEGORY-NN] Short imperative title

- **Evidence**: `path/file.js:123` — mô tả 1 dòng. (2–5 locations, ghi "và ~N chỗ tương tự" nếu phổ biến)
- **Impact**: Hậu quả cụ thể. KHÔNG dùng "suboptimal".
- **Effort**: S (giờ) / M (~1 ngày) / L (nhiều ngày) — cho *fix*, bao gồm tests.
- **Risk**: Fix có thể phá gì; LOW/MED/HIGH + 1 dòng lý do.
- **Confidence**: HIGH (đọc code, chắc chắn) / MED (signal mạnh, cần verify) / LOW (smell, cần investigate).
- **Fix sketch**: 1–3 câu. Đủ để đánh giá effort.

---

## Output Table

Sau khi vet (loại false positives, sửa mis-attributions, bỏ duplicates):

| # | Finding | Category | Impact | Effort | Risk | Evidence |
|---|---------|----------|--------|--------|------|----------|
| 1 | ...     | security | HIGH   | S      | LOW  | file:line |
| 2 | ...     | perf     | MED    | M      | MED  | file:line |

Sau table, hỏi user chọn findings nào muốn tạo plan (default: top 3-5 theo leverage).
Ghi rõ dependency ordering nếu có.

---

## Prioritization

Xếp findings theo **leverage = impact ÷ effort, discount bởi confidence và fix-risk**.

Tiebreakers:
1. Findings unblock các findings khác → đẩy lên trên
2. Security findings HIGH confidence → trên equivalent-leverage non-security
3. Prefer findings có clean verification story
4. "Không đáng làm" = valid verdict — ghi lý do 1 dòng để không re-audit
