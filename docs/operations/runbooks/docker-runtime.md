# Docker backend runtime runbook

Runbook này áp dụng cho backend HTCOACHING. Frontend vẫn chạy bằng Vite trên host và
deploy qua Netlify; production MongoDB/Cloudinary không được containerize.

## 1. Prerequisites

- Docker Desktop/Engine có Docker Compose v2.
- Port `5000` trên host còn trống, hoặc đặt `HTCOACHING_API_PORT` sang port khác.
- Không export production credential vào terminal profile dùng cho local Compose.

Kiểm tra:

```powershell
docker version
docker compose version
docker compose config --quiet
```

Nếu Docker chưa được cài, dừng tại đây. Việc cài Docker Desktop là thay đổi máy host và
cần owner phê duyệt riêng.

## 2. Build backend image

```powershell
docker build --platform linux/amd64 --file server/Dockerfile --tag htcoaching-api:local .
```

Image phải có:

- user `node`;
- command `node server.js`;
- liveness `/api/ops/health/live`;
- có `.agents/upstream-skills/watchlist.json` và `snapshot.json` cho Admin Skill Radar;
- không có `.env`, `uploads`, `.private`, test/migration/operational scripts hoặc
  development dependencies.

Kiểm tra metadata không làm lộ environment runtime:

```powershell
docker image inspect htcoaching-api:local --format '{{json .Config.User}} {{json .Config.Cmd}}'
```

Expected: user `node`, command `["node","server.js"]`.

## 3. Start local API + Mongo

```powershell
docker compose up --detach --build --wait
```

Compose mặc định:

- bind API vào `127.0.0.1:5000`;
- không publish MongoDB port;
- dùng database `htcoaching_local`;
- giữ Mongo data/config, private media và local upload trong named volumes;
- tắt background jobs, email live, retention enforcement và external AI/media writes.

Kiểm tra:

```powershell
Invoke-WebRequest http://127.0.0.1:5000/api/ops/health/live
Invoke-WebRequest http://127.0.0.1:5000/api/ops/health/ready
docker compose ps
```

Frontend chạy ngoài Docker và dùng:

```text
VITE_API_URL=http://localhost:5000/api
```

Không commit local environment hoặc thay các placeholder trong `compose.yaml` bằng
credential thật. Khi cần test Google/provider thật, truyền biến từ terminal/Doppler ở
runtime và xác minh target là development.

## 4. Stop, restart và reset local data

Stop nhưng giữ dữ liệu:

```powershell
docker compose down
```

Start lại và xác minh Mongo volume vẫn tồn tại:

```powershell
docker compose up --detach --wait
docker volume ls --filter name=htcoaching-local
```

Chỉ reset local Docker data khi owner chủ động yêu cầu:

```powershell
docker compose down --volumes
```

Lệnh có `--volumes` xóa database/media/upload local của stack; không dùng như thao tác
stop thông thường.

## 5. CI contract

Docker job trong `.github/workflows/ci.yml` thực hiện:

1. static Docker contract;
2. Hadolint;
3. `docker compose config`;
4. build `linux/amd64`;
5. API + Mongo smoke và live/ready;
6. export image tar;
7. Trivy report `HIGH/CRITICAL` và fail với fixable `CRITICAL`;
8. teardown volumes trên ephemeral runner.

CI không login/push registry và Trivy không được mount Docker socket. Hadolint/Trivy
images đều dùng immutable digest, không qua scanner wrapper Action. Khi cập nhật version,
reviewer phải xác minh release/advisory rồi thay version + digest cùng lúc.

## 6. Render Docker staging pilot

Pilot phải dùng một service mới, ví dụ `htcoachingweb-docker-staging`; không thay runtime
của production hoặc service staging đang làm rollback baseline.

### Service settings

- Repository: `ThienAress/htcoachingweb`.
- Branch: `staging`.
- Runtime: `Docker`.
- Root directory: để trống (repository root).
- Dockerfile path: `./server/Dockerfile`.
- Docker context: `.`.
- Auto-deploy: `Off` trong lần pilot đầu; deploy exact candidate SHA thủ công.
- Region/plan: giữ giống staging hiện tại; dừng nếu UI yêu cầu phát sinh chi phí chưa
  được owner duyệt.
- Health check: `/api/ops/health/ready`.
- Maximum shutdown delay: ít nhất `20` giây.

### Environment safety

Copy cấu hình từ staging secret storage/environment group mà không in hoặc đưa value
vào Git/chat. Trước deploy phải chứng minh:

```text
NODE_ENV=production
APP_ENV=staging
MONGO_URI database name = htcoaching_staging
CLIENT_URL=https://staging--htcoachingweb.netlify.app
PUBLIC_API_ORIGIN=https://htcoachingweb-docker-staging.onrender.com
ALLOWED_ORIGINS includes the exact staging client
BACKGROUND_JOBS_ENABLED=false
EMAIL_DELIVERY_MODE=disabled
F1_RETENTION_ENFORCE=false
NETLIFY_BUILD_HOOK_URL is empty
```

Không chạy migration, seed, acceptance write flows hoặc cleanup trong pilot này.

### Post-deploy read-only verification

1. Ghi exact `RENDER_GIT_COMMIT`, deploy ID và UTC time mà không ghi secret.
2. Xác minh live/ready HTTP 200.
3. Chạy security smoke read-only với Docker staging URL và staging client origin.
4. Kiểm tra log `server.started`, background jobs disabled, không có email/retention job.
5. Ghi image build/deploy time, cold start, memory và rollback target.
6. Giữ service staging native hiện tại làm baseline cho tới khi pilot được chấp nhận.

Ví dụ kiểm tra read-only:

```powershell
$env:ALLOW_REMOTE_SECURITY_SMOKE = "true"
$env:SECURITY_SMOKE_BASE_URL = "https://htcoachingweb-docker-staging.onrender.com"
$env:SECURITY_SMOKE_ALLOWED_ORIGIN = "https://staging--htcoachingweb.netlify.app"
npm run security:smoke --prefix server
```

## 7. Rollback

- Nếu Docker staging fail health, rollback/redeploy service pilot về build artifact/SHA
  đã ghi; không đổi production.
- Nếu không có retained artifact, disable pilot service và tiếp tục dùng staging native.
- Không restore database vì pilot không thực hiện migration/write.
- Sau rollback, xác minh staging native live/ready và monitor hiện tại vẫn pass.

## 8. Scaling warning

Không bật `BACKGROUND_JOBS_ENABLED=true` trên nhiều web replicas. Trước khi scale phải
tách singleton worker hoặc thêm distributed lock. Metrics và một số limiter hiện còn
process-local, nên Docker-ready không đồng nghĩa multi-replica-ready.
