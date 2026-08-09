---
name: skill-radar
description: Theo dõi thay đổi từ upstream Agent Skill, kiểm tra provenance và tạo báo cáo adopt/adapt/reject/defer. Dùng khi user gọi $skill-radar, đến kỳ review watchlist hoặc cần đánh giá nguồn skill mới từ skills.sh trước khi cập nhật skill/rule HTCOACHINGWEB.
---

# Skill Radar

Theo dõi external upstream drift. Không thay thế `$goad`: radar tìm và triage thay đổi bên ngoài; `$goad`
đối chiếu local skill với codebase sau khi user duyệt một finding.

## Workflow

1. Đọc `.agents/upstream-skills/watchlist.json`, `snapshot.json` và
   `docs/specs/upstream-skill-radar.md`.
2. Chạy `npm run agents:radar` để cập nhật metadata/hash. Nếu network không khả dụng,
   giữ snapshot cũ và ghi rõ blocker; không đoán trạng thái.
3. Duyệt skills.sh `Trending`, `Hot`, `Official` và `Audits`. Chỉ đề xuất candidate gốc, loại fork/copy
   khi có bằng chứng duplicate.
4. Với entry mới chưa có `lastReviewedAt`, luôn đọc nội dung upstream và local target để tạo baseline gap review;
   hash `clean` chỉ nói upstream không đổi, không chứng minh local đã tương đương. Với entry đổi hash, đọc diff
   upstream và local target. Đánh giá theo
   [scoring và lifecycle](references/review-policy.md).
5. Tạo `docs/audits/YYYY-MM-skill-radar.md`, mỗi finding có source URL, upstream commit/hash,
   local target, decision và lý do.
6. Cập nhật snapshot quan sát được. Không thêm candidate vào watchlist hoặc sửa local canonical source
   nếu user chưa phê duyệt.
7. Khi user duyệt `adapt/adopt`, chuyển sang `$goad` hoặc skill domain tương ứng, chạy corpus tại
   `.agents/evals/skills/` nếu target có corpus và giữ security/manual gates.

## Output contract

Mỗi upstream change dùng đúng một decision:

- `adopt`: pattern phù hợp, có evidence và không phá project policy.
- `adapt`: ý tưởng tốt nhưng cần chuyển sang stack/contract HTCOACHINGWEB.
- `reject`: security, license, compatibility, duplication hoặc cost không đạt.
- `defer`: có tiềm năng nhưng chưa có use case/eval đủ mạnh.

Báo cáo phải nêu phần nào mới, giá trị cụ thể, local target, rủi ro, verification đề xuất và confidence.
Popularity/install count chỉ là discovery signal.

## Hard boundaries

- Không tự cài upstream skill, copy nguyên file, commit, push, merge hoặc deploy.
- Không tự sửa `AGENTS.md`, `.agents/rules/` hoặc file security/auth/CSRF.
- Không đưa raw upstream content, token, cookie, secret hoặc absolute local path vào dashboard snapshot.
- Không coi repo ít commit là lỗi thời; chỉ đề xuất lifecycle change bằng nhiều evidence.
- Không gọi GitHub/skills.sh từ request runtime của Admin dashboard.
- GitHub API `403/429` là fetch/rate-limit failure, không phải bằng chứng repository unreachable; giữ last-known-good
  provenance và report trạng thái transient riêng.

## Verification

- `npm run test:agents:radar`
- `npm run test:agents:eval`
- `npm run agents:validate`
- `npm run security:secrets`
- `git diff --check`
