# Spec: Containerized backend runtime

Status: LOCALLY VERIFIED — Render Docker staging pilot remains blocked on remote candidate
and owner-approved service creation.

## Objective

Chuẩn hóa runtime backend HTCOACHING bằng Docker mà không thay đổi API, dữ liệu hay
topology production hiện tại. Kết quả cần hỗ trợ local API + MongoDB bằng Compose,
kiểm chứng image trong CI và pilot một Render Docker staging độc lập trước khi có bất
kỳ quyết định chuyển production nào.

## Assumptions đã được duyệt

1. Frontend tiếp tục chạy Vite trên host khi development và deploy bằng Netlify; không
   tạo frontend Dockerfile trong rollout này.
2. MongoDB Atlas và Cloudinary vẫn là managed services ở staging/production. MongoDB
   trong Compose chỉ dành cho local/CI và dùng named volume.
3. Backend image dùng Node `22.23.1` như contract hiện tại, Debian Bookworm slim,
   production dependencies, non-root user và không chứa secret/profile `.env`.
   Build context là repository root để giữ đúng runtime dependency của Skill Radar,
   nhưng `.dockerignore` chỉ cho phép backend cùng hai JSON upstream-skill canonical.
4. Render pilot phải là service staging mới hoặc target staging được chứng minh rõ;
   không thay runtime hay environment của production.
5. Git commit/push, thay đổi branch và thao tác dữ liệu staging/production không được
   suy diễn từ implementation local. Remote pilot chỉ deploy được khi candidate đã có
   trên remote branch và target/authority được xác minh.

## Tech stack liên quan

- Node.js `22.23.1`, Express 5, Mongoose 9 và MongoDB 8.2.
- Dockerfile syntax 1.x, Docker Compose v2.
- GitHub Actions, Hadolint và Trivy.
- Render Docker runtime cho staging pilot; Netlify frontend giữ nguyên.

## Runtime contract

### Phase 1 — Backend image

- Build context là repository root, Dockerfile là `server/Dockerfile`; root
  `.dockerignore` dùng allowlist để client, docs, Git metadata, secret và local artifacts
  không đi vào build context.
- Base image là Docker Official Image `node:22.23.1-bookworm-slim`, pin bằng
  multi-platform digest đã xác minh.
- Install bằng `npm ci --omit=dev`; final image không chứa test, migration, operational
  script artifacts, local data, `.env`, upload hoặc package-manager cache.
- Copy `.agents/upstream-skills/watchlist.json` và `snapshot.json` vào đúng repository-root
  layout trong image để Admin Skill Radar không đổi hành vi.
- Process chạy bằng user `node`, nhận `PORT`, khởi động bằng `node server.js` và nhận
  `SIGTERM` trực tiếp.
- Container liveness dùng `/api/ops/health/live`; readiness `/api/ops/health/ready`
  vẫn kiểm tra database và draining state.

### Phase 2 — Local Compose

- `api` và `mongo` nằm trên private default network; chỉ API bind
  `127.0.0.1:5000` ra host.
- MongoDB local pin patch version `8.2.12` cùng immutable image digest; `/data/db` và image-declared
  `/data/configdb` đều dùng named volume để không rò rỉ anonymous volume qua các vòng
  `down`/`up`.
- Local runtime dùng `APP_ENV=development`, mock/disabled providers, email disabled và
  `BACKGROUND_JOBS_ENABLED=false` để không tạo side effect bên ngoài.
- Local-only signing/OAuth placeholders phải được ghi rõ không phải production secret
  và có thể override qua host environment.
- Frontend host gọi `http://localhost:5000/api` và không bị đưa vào Compose.

### Phase 3 — Docker CI

- Docker job bổ sung cho CI hiện có; không thay client/server/E2E/security jobs.
- Hadolint chạy từ official image pin digest, không qua wrapper Action có transitive
  image tag.
- Validate Compose, build `linux/amd64`, start API + Mongo, chờ health, kiểm tra live và
  ready, rồi teardown kể cả khi job fail.
- Trivy chạy từ image pin digest, không dùng mutable Action tag và không mount Docker
  socket; scan image tar được export từ local build.
- V1 fail trên fixable `CRITICAL`; `HIGH` vẫn xuất report để tạo baseline có chủ đích,
  không thêm allowlist chỉ để làm CI xanh.
- Pull request không push image và không cần Docker Hub/registry credential.

### Phase 4 — Render Docker staging pilot

- Pilot dùng branch `staging`, build context repository root, Dockerfile `server/Dockerfile`,
  readiness path `/api/ops/health/ready` và shutdown delay tối thiểu 20 giây.
- Reuse đúng staging secrets/config qua Render secret storage hoặc scoped environment
  group; không commit giá trị và không copy production credentials.
- Bắt buộc `APP_ENV=staging`, database `htcoaching_staging`, staging client/API origins,
  `BACKGROUND_JOBS_ENABLED=false`, `EMAIL_DELIVERY_MODE=disabled` và retention
  enforcement tắt.
- Pilot chỉ được đánh dấu complete sau khi deploy đúng candidate SHA, live/ready pass,
  remote security smoke pass và rollback target được ghi nhận.

## Files ảnh hưởng dự kiến

- `server/Dockerfile`, root `.dockerignore`.
- `compose.yaml`.
- `.github/workflows/ci.yml`.
- `scripts/docker-contract.test.mjs`, `package.json`.
- `docs/operations/runbooks/docker-runtime.md`.
- Tài liệu spec/plan và các index tương ứng.

Không đổi `server/server.js`, route/controller/service/model, schema, sitemap, prerender
hoặc frontend runtime.

## Testing strategy

- Static contract test cho base pin, non-root/CMD/healthcheck, local safety flags,
  CI immutable references và staging boundaries.
- `docker compose config`.
- Hadolint.
- Docker build `linux/amd64`.
- Compose smoke: Mongo healthy, API live + ready HTTP 200, graceful teardown.
- Trivy configuration/image scan theo policy ở trên.
- Existing server unit suite và repository security gates để chứng minh không làm drift
  runtime/application contract.

## Boundaries

### Always

- Không bake secret hoặc `.env` vào image.
- Không chạy process root, không mount Docker socket trong scanner và không expose
  local MongoDB port.
- Không chạy migration/seed/cleanup trong build, startup, CI smoke hoặc staging pilot.
- Preserve graceful shutdown và background-job isolation hiện có.

### Ask/stop first

- Docker Desktop installation hoặc thay đổi máy host.
- Commit/push Git, tạo dịch vụ Render có chi phí, thay production service/runtime,
  copy credentials ngoài staging scope hoặc ghi staging data.

### Never

- Dùng production MongoDB cho Compose/CI.
- Bật background jobs, email live, retention enforcement hoặc payment provider live
  trong Docker staging pilot.
- Dùng mutable `latest`, unpinned scanner image hoặc unpinned third-party GitHub Action
  trong Docker job mới.

## Success criteria

- Backend image contract có thể build và chạy non-root khi Docker sẵn sàng.
- `docker compose up --wait` tạo local API + Mongo với persistent named volume và cả
  live/ready đều HTTP 200.
- Docker CI có Hadolint, build, smoke và Trivy; không push image hay cần secret.
- Staging pilot được cấu hình tách biệt, hoặc được ghi rõ `BLOCKED` bằng blocker thật
  nếu chưa có remote candidate/Render authority; production không thay đổi.
- Mọi verification thực tế và phần chưa chạy được ghi vào Plan 055/runbook.

## Open questions

Không còn product question. Hai operational gate phải được phát hiện tại thời điểm chạy:
Docker Engine có sẵn hay không, và Render staging candidate/authority có đủ để deploy
mà không cần commit/push hoặc tác động production hay không.
