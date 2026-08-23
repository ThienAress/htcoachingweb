# Spec: Đồng bộ một chiều tài khoản kiểm thử giữa môi trường

## Objective

Graph dữ liệu nghiệp vụ đã allowlist của đúng tài khoản kiểm thử do owner chọn được
kéo từ production xuống staging và local theo chiều duy nhất
`production → staging/local`. Email thật chỉ được cấp qua secret runtime và phải khớp
SHA-256 digest đã pin trong contract. Production tuyệt đối không nhận mutation từ công
cụ này; staging và local không trở thành nguồn dữ liệu cho bất kỳ môi trường nào.

## Assumptions

- Đây là tài khoản kiểm thử do owner chỉ định; exact email phải match đúng một `User`
  ở production trước khi đọc graph.
- Production là nguồn canonical. Khi một record cùng `_id` đã tồn tại ở target, bản
  production thay thế bản target; record target ngoài graph account không bị đụng tới.
- Không đồng bộ `password`, `refreshToken`, token reset/OAuth, session, API key hoặc
  bất kỳ credential nào. Tài khoản target tiếp tục dùng cơ chế đăng nhập riêng của
  từng môi trường.
- Không xóa record ở target trong phiên bản đầu. Vì vậy thao tác xóa ở production
  chưa được phản chiếu xuống target; bổ sung delete/tombstone cần một spec riêng.
- Đây không phải full-account mirror: ví/giao dịch tài chính, hợp đồng, dữ liệu AI và
  hội thoại không nằm trong allowlist để tránh đưa dữ liệu nhạy cảm xuống môi trường thấp.
- Local chỉ tự cập nhật khi PC, MongoDB local và scheduled task đang chạy. Staging
  dùng lịch cloud độc lập để không phụ thuộc PC cá nhân.

## Data boundary

- Source bắt buộc là database production `gym-app` và chỉ dùng read operations.
- Target chỉ được là `htcoaching_staging` hoặc localhost database
  `htcoaching_local`.
- Identity cố định trong code là exact normalized email đã nêu ở trên; CLI không
  nhận email tùy ý.
- Collection được đồng bộ phải nằm trong allowlist có ownership selector rõ ràng.
  Không scan/copy toàn database và không tự đi theo reference sang User khác.
- `users` chỉ giữ cùng `_id` và các field profile/nghiệp vụ an toàn. Các trường xác
  thực bị strip trước fingerprint và trước write.
- Không đưa raw document, URI, email, dữ liệu sức khỏe/tài chính hoặc nội dung hội
  thoại vào log/artifact. Output chỉ gồm target, collection counts, ID rút gọn và
  fingerprint tổng hợp.

## Sync contract

- Mặc định là dry-run. Ghi thật cần đồng thời `--apply`, confirmation riêng cho
  target và URI target vượt qua database/host guard.
- Source preflight dừng nếu exact email không match đúng một User, database name
  không phải production, runtime role không đúng duy nhất `read@gym-app`, role có
  write privilege hoặc source URI trùng target URI/database.
- Mỗi document được upsert bằng `_id`; BSON types và foreign keys được giữ nguyên.
- Toàn bộ graph target được upsert và fingerprint-verify trong một transaction; bất
  kỳ write/conflict/mismatch nào phải rollback cả lượt, không để partial state.
- Auth target được đọc lại trong cùng transaction ở mỗi callback retry rồi mới bảo
  toàn; refresh/login/logout đồng thời không thể bị snapshot preflight cũ ghi đè.
- Đồng bộ idempotent: chạy lại với source không đổi cho cùng fingerprint và không
  làm thay đổi dữ liệu target.
- Verify sau write đọc lại đúng `_id` ở target và so fingerprint đã sanitize; mismatch
  làm command thất bại.
- Công cụ không chứa code path delete, source write hay target-to-source export.

## Scheduling

- Staging: workflow định kỳ dùng production read-only credential và staging write
  credential tách biệt, đồng thời hỗ trợ `workflow_dispatch` để chạy thủ công.
- Local: Windows scheduled task gọi cùng CLI ở target local; credential production
  phải được giải mã từ DPAPI CurrentUser tại runtime, không ghi vào command line hoặc
  repo và không thể dùng từ Windows user/máy khác.
- Hai scheduler dùng concurrency lock để không có hai lượt sync chồng nhau.
- Thiếu credential hoặc guard không đạt phải fail closed; không fallback sang URI
  production có quyền ghi nếu read-only credential chưa được cấu hình.
- Email exact chỉ được truyền bằng `ACCOUNT_SYNC_EMAIL` ở secret runtime và phải khớp
  digest pin; workflow/task command line không chứa email hoặc URI.

## SEO runtime recovery companion fix

- Fatal UI không render raw JavaScript/chunk error vào nội dung có thể dùng làm
  Google snippet.
- Lỗi stale dynamic import được reload tự động tối đa một lần mỗi session; guard
  ngăn reload loop. Lỗi khác hiển thị copy thân thiện và thao tác tải lại thủ công.
- Fatal fallback đặt `noindex,nofollow` trong phiên lỗi và đánh dấu phần copy
  `data-nosnippet`; prerender phải từ chối snapshot chứa fallback.
- Sau deploy, URL sitelink lỗi cần được yêu cầu crawl lại trong Search Console;
  sitelinks do Google tự chọn và không phải một lỗi ranking.

## Testing strategy

- Unit contract: identity/source/target guards, sanitizer auth fields, selector
  allowlist, dry-run, idempotent fingerprint và verify mismatch.
- Integration bằng MongoMemoryReplSet: source role được verify, upsert target đúng
  graph, rollback khi lỗi giữa graph, không kéo User khác và không xóa record ngoài scope.
- Client regression: raw chunk message không xuất hiện, stale chunk chỉ reload một
  lần, fatal fallback có robots/no-snippet recovery.
- Security secret scan, repository data-boundary scan, client lint/build và focused
  server/client tests trước khi deploy.

## Success criteria

- Dry-run và apply cho staging/local chỉ báo đúng account/collection counts và toàn
  bộ fingerprint sau write khớp source đã sanitize.
- Không có production write, credential trong Git/console hoặc record của user khác.
- Staging có lịch pull độc lập; local có command/scheduled task rõ trạng thái.
- Google không còn có thể lấy raw `Failed to fetch dynamically imported module`
  từ runtime fallback sau release mới và recrawl.
