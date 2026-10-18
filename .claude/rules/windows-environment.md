# Môi trường Windows — HTCOACHINGWEB

Máy phát triển là Windows (Git Bash, PowerShell 5.1, `fnm`). Các lỗi dưới đây đã lặp lại ở nhiều phiên làm việc.

- Script nhiều dòng, có dấu `\`, dấu nháy hoặc tiếng Việt: ghi ra file (Write) rồi chạy. Không nhúng vào `node -e` hoặc `sed` inline: dấu `\` bị nuốt
  hoặc sinh byte NUL làm hỏng file. Cần ký tự `\` trong code sinh ra thì dùng `String.fromCharCode(92)`.
- Sửa file nguồn UTF-8 bằng công cụ Edit/Write. Không dùng `Set-Content`/`Out-File` của PowerShell (hỏng tiếng Việt). Repo có file CRLF: script sửa
  file phải đọc EOL của file và giữ nguyên.
- Commit message, PR body có tiếng Việt: ghi ra file rồi `git commit -F <file>`, `gh pr create --body-file <file>`; here-string qua stdin (`-F -`)
  làm mất nội dung.
- Chạy Node theo `.node-version`: `fnm exec --using=22.23.1 cmd /c "npm run ..."` (PowerShell). Không chạy hai lượt e2e chồng nhau.
- Trong worktree mỗi lệnh git một lần gọi, dùng `git -C <worktree>`, không pipe hay `&&`; hook chặn lệnh git ghép. Không xóa thư mục worktree bằng
  `Remove-Item`, dùng `git worktree remove`.
- `security:secrets` báo lỗi mà không in chi tiết: kiểm file vừa tạo có byte NUL hoặc chuỗi giống secret trước khi nghi ngờ công cụ.
