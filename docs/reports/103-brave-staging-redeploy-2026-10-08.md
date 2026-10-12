# Brave staging — rebuild và redeploy ngày 2026-10-08

## Phạm vi

User xác nhận Brave key đã được lưu bằng Save only trên staging và yêu cầu build,
redeploy. Phiên tiếp tục chỉ trigger lại bản staging đã có; không thay đổi source,
commit, push, production hoặc giá trị secret.

## Deploy đã xác minh

Hai dashboard cùng xác nhận SHA `f52db97714ca1916a5d5bf7c711cd007c4602627`.
QA/CI của SHA này đã được ghi trong report 102; các test local của worktree cũ không
được dùng làm evidence cho source được host rebuild.

| Target | Hành động | Kết quả |
|---|---|---|
| Netlify branch staging | Retry without cache with latest branch commit | Deploy successful |
| Render htcoachingweb-staging | Deploy a specific commit: f52db97 | Deploy succeeded / Live |

Netlify deploy ID: `6ac67b3ae2089c4f45ad54a2`.

[Netlify dashboard](https://app.netlify.com/projects/htcoachingweb/deploys/6ac67b3ae2089c4f45ad54a2).

Build bắt đầu 00:03:11 và kết thúc 00:04:07 ngày 2026-10-08, giờ Asia/Saigon.
Log ghi prerender 44/44 routes, build command và Netlify Build hoàn tất.
Search index check ghi 10 Recipe + 0 Exercise details; không diễn giải là 10 Exercise.

Render service ID: `srv-d9g8em61a83c73b4l61g`.
Render deploy ID: `dep-db37njcs728c73bkc0h0`.

[Render dashboard](https://dashboard.render.com/web/srv-d9g8em61a83c73b4l61g/deploys/dep-db37njcs728c73bkc0h0).

Dashboard ghi thời điểm deploy 00:05:17 ngày 2026-10-08, thời lượng 1m27s.
Log ghi Build successful, database.connected, server.started và health/live HTTP 200.

## Cấu hình và giới hạn kiểm chứng

- Environment UI có tên `AI_WEB_SEARCH_PROVIDER` và `BRAVE_SEARCH_API_KEY`.
- Không reveal, sao chép hoặc in giá trị key; không thay đổi environment variables.
- Redeploy áp dụng cấu hình đã được lưu theo xác nhận của user.
- Chưa xác nhận giá trị provider hay key hợp lệ bằng request Brave thật.
- Không gửi thêm paid AI prompt trong lượt redeploy này.
- Smoke script terminal không hoàn tất: `fetch failed`; trạng thái BLOCKED, không PASS.
- Readiness URL trực tiếp bị browser chặn (`ERR_BLOCKED_BY_CLIENT`); không bypass.
- Dashboard deploy và log liveness không thay thế một bài test web grounding thật.

## Evidence

Ảnh Netlify: [netlify-deploy.png](../../.local-data/brave-redeploy-20261008/netlify-deploy.png).
Ảnh Render: [render-deploy.png](../../.local-data/brave-redeploy-20261008/render-deploy.png).

Kết quả: rebuild/redeploy staging hoàn tất. Khả năng Brave grounding live chưa được
chứng nhận; grade câu 10/15 trong report 102 vẫn giữ nguyên cho tới kiểm thử mới.
