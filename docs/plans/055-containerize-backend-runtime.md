# Plan 055: Containerize backend runtime and pilot Docker staging

> **Hướng dẫn thực thi**: Follow từng step, ghi kết quả thật và dừng tại STOP condition.
> Không biến static validation thành Docker evidence và không deploy production.
>
> **Drift check**: `git status --short`, `git rev-parse HEAD`, kiểm tra Node pin,
> `server/package.json` start command, ops health routes, graceful shutdown và current
> Render staging URL trước khi sửa.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED/HIGH (infrastructure + staging)
- **Depends on**: 020, 053
- **Category**: dx / infrastructure / operations
- **Planned at**: 2026-08-18
- **Status**: LOCAL DOCKER + FULL QA VERIFIED — RENDER PILOT PENDING

## Why This Matters

HTCOACHING đã pin Node, có liveness/readiness và graceful shutdown nhưng chưa có
container contract. Rollout này tạo runtime tái lập cho backend, local Mongo cô lập và
CI security gate, đồng thời kiểm chứng Docker trên staging trước khi cân nhắc production.

## Baseline Before Implementation

- `.node-version:1`, `.nvmrc:1`, root/client/server engines pin `22.23.1`.
- `server/package.json:78` chạy `node server.js`; không có compile step.
- `server/server.js:109` đọc `PORT`; `:390-443` drain và xử lý `SIGTERM`/`SIGINT`.
- `server/src/routes/ops.routes.js:75-85` cung cấp live/ready endpoints.
- `.github/workflows/ci.yml` có client, server, secrets và E2E; chưa có Docker job.
- Staging API hiện tại là `https://htcoachingweb-staging.onrender.com`, database khóa
  `htcoaching_staging`, email/jobs/retention bị tắt.
- Không có Dockerfile, Compose hay `.dockerignore`.
- Initial environment check: Docker CLI và Render CLI không có trong Windows `PATH`;
  WSL access bị hệ thống từ chối. Đây là verification/deploy gate, không phải lý do hạ
  contract.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Static contract | `npm run test:docker-contract` | all tests pass |
| Compose config | `docker compose config` | exit 0, no interpolation errors |
| Build | `docker build --platform linux/amd64 -f server/Dockerfile -t htcoaching-api:local .` | exit 0 |
| Local smoke | `docker compose up -d --wait` | api + mongo healthy |
| Live | `Invoke-WebRequest http://127.0.0.1:5000/api/ops/health/live` | HTTP 200 |
| Ready | `Invoke-WebRequest http://127.0.0.1:5000/api/ops/health/ready` | HTTP 200 |
| Server regression | `npm run test:unit:server` | all pass |
| Security | `npm run security:secrets` and `npm run security:data-boundaries` | exit 0 |
| Diff | `git diff --check` | exit 0 |

## Scope

**In scope**

- `server/Dockerfile`, root `.dockerignore`, `compose.yaml`.
- `.github/workflows/ci.yml` Docker job only.
- Static Docker contract test and root npm script.
- Container spec/plan, Docker runbook and indexes.
- A separate Render Docker staging pilot/configuration when target and candidate are
  provable without touching production.

**Out of scope**

- Frontend Dockerfile, production Mongo container, Docker registry publishing.
- API/schema/business logic changes, migration/seed/cleanup.
- Production Render/Netlify changes, Git commit/push and paid service creation.
- Docker Desktop installation without separate owner approval.

## Steps

### Step 1: Build a minimal backend runtime image

**Behavior**: Docker build produces an immutable Node 22.23.1 runtime with production
dependencies, direct signal delivery, non-root execution and application liveness.

**Blast radius**: `server/Dockerfile`, root `.dockerignore`, Docker contract test.

**Depends on**: none.

**Verify**: static contract, Hadolint, Docker build, image user/CMD inspection và Skill
Radar static-data presence.

### Step 2: Run local API and Mongo safely with Compose

**Behavior**: One Compose command starts a local-only API and MongoDB 8.2.12; Mongo data
survives container recreation while jobs, email and external AI/media writes stay off.

**Blast radius**: `compose.yaml`, contract test and Docker runbook.

**Depends on**: Step 1.

**Verify**: `docker compose config`, `up --wait`, live/ready checks, volume inspection,
`down` without `-v`, then restart and health check.

### Step 3: Enforce the image contract in CI

**Behavior**: Existing CI gains one isolated Docker job that lints, builds, smokes and
scans the image without registry credentials or Docker socket exposure to Trivy.

**Blast radius**: `.github/workflows/ci.yml`, contract test/package script.

**Depends on**: Steps 1-2.

**Verify**: static workflow contract, YAML/agent validation, then GitHub job on a remote
candidate. Local Docker commands are not claimed if Docker is unavailable.

### Step 4: Pilot Docker on an isolated Render staging service

**Behavior**: A Docker runtime built from the exact staging candidate serves live/ready,
passes remote security smoke and can be rolled back without changing production.

**Blast radius**: Render staging service/config and Docker runbook/evidence only.

**Depends on**: Steps 1-3, remote staging candidate, authenticated Render owner session
and a no-cost/owner-approved plan.

**Verify**: runtime=`docker`, branch/SHA match, ready HTTP 200, security smoke 7/7,
background jobs/email disabled, logs clean and rollback target recorded.

### Step 5: Re-trace, QA and clean delivery

**Behavior**: Runtime/deployment contracts remain compatible; existing application tests
and repository safety gates pass, with explicit evidence for unavailable Docker/remote
checks.

**Blast radius**: all files in scope and plan/runbook status.

**Depends on**: Steps 1-4 or a truthful operational blocker for Step 4.

**Verify**: server QA, ops/contract tests, security scans, agent validation,
`git diff --check`, final diff review.

## Test Plan

- Dockerfile pin/non-root/CMD/health and secret-exclusion assertions.
- Compose local-only binding, private Mongo, named volume, safe provider/job/email flags.
- CI scanner references immutable; build/smoke/scan commands present and image is
  exported to tar before Trivy scan.
- Existing server tests cover live/ready/draining/graceful runtime behavior.
- Remote staging checks are read-only after deploy; no acceptance seed or mutation.

## Done Criteria

- [x] Backend Dockerfile and `.dockerignore` meet the approved spec.
- [x] Compose defines healthy API + Mongo with persistent local data and safe defaults.
- [x] Docker CI job includes Hadolint, build/smoke and pinned Trivy scan.
- [x] Static Docker contract and existing server/security tests pass.
- [x] Local Docker build/smoke pass, or status records Docker Engine as `BLOCKED`.
- [x] Separate Render Docker staging pilot passes exact-SHA health/security verification,
      or status records missing candidate/authority/cost approval as `BLOCKED`.
- [x] Production, migrations, seed/cleanup, commit and push remain unchanged.
- [x] `docs/plans/README.md` and this plan contain truthful final status/evidence.

## Implementation and QA evidence — 2026-08-18

### Implemented

- Phase 1: multi-stage Node `22.23.1` backend image, immutable base digest, production
  dependencies, non-root runtime, direct `SIGTERM`, liveness and allowlisted context.
- Impact review found Skill Radar's repository-root JSON dependency. The image now keeps
  `/app/server` as the application directory and copies only canonical `watchlist.json`
  plus `snapshot.json` into `/app/.agents/upstream-skills`; tests, migrations and runtime-
  unnecessary operational scripts remain excluded.
- Phase 2: local API + Mongo Compose stack, localhost-only API binding, private Mongo,
  patch + digest-pinned Mongo image, persistent named volumes and disabled
  external/background side effects.
- Phase 3: isolated Docker CI job with static contract, digest-pinned Hadolint, Compose
  validation, `linux/amd64` build/smoke, exported-image Trivy scan and unconditional
  teardown. Pull requests do not log in or push an image.
- Phase 4: isolated Render Docker staging settings, safety gates, read-only acceptance and
  rollback procedure are documented in the runbook. No remote service was mutated.

### Passed locally

- `npm run test:docker-contract`: 3/3 pass.
- `docker compose --project-name htcoaching-qa config --quiet`: pass with Docker Compose
  `v5.4.0`.
- Digest-pinned Hadolint: pass at `warning` threshold.
- `docker build --platform linux/amd64 -f server/Dockerfile ...`: pass. Final local image
  `sha256:87860166959d1a9048d95caae85f770f12ff7e22dd05f066c98ee27940142682`,
  size `139,782,542` bytes, retained as `htcoaching-api:local`.
- Runtime inspection: Node `v22.23.1`, UID/GID `1000`, user `node`, CMD
  `node server.js`; npm/Yarn, `.env`, tests, migrations and operational scripts absent;
  Skill Radar JSON assets present.
- Compose smoke on isolated project `htcoaching-qa` and host port `127.0.0.1:55055`:
  Mongo and API healthy; live/ready return HTTP 200; Mongo has no published host port;
  background jobs are explicitly disabled.
- Graceful restart: API received `SIGTERM`, logged HTTP/database close, restarted healthy
  and readiness returned to HTTP 200.
- Named-volume persistence: sentinel in `htcoaching_local` survived Mongo container
  recreation. Both `/data/db` and `/data/configdb` use named volumes; the original
  anonymous config volume was verified unused and removed.
- Trivy `0.72.0` digest-pinned scan of exported final image: Node packages have 0
  findings; Debian report has 22 unfixed upstream findings (5 CRITICAL, 17 HIGH), 0 with
  a fixed version. The `--ignore-unfixed --severity CRITICAL --exit-code 1` gate passed.
- Email-disabled regression found by Compose startup was fixed with lazy Resend client
  creation: focused RED→GREEN test 1/1 and email/staging/production group 27/27 pass.
- `npm run test:ops`: 35/35 pass.
- `npm run security:secrets`: pass; `npm run security:data-boundaries`: pass with 0
  violations.
- `npm run agents:validate`: pass, 28 skills, 0 warnings.
- `npm run check:runtime-logging --prefix server`: pass.
- `git diff --check`: exit 0; only existing LF/CRLF conversion warnings.
- QA stack, QA volumes, Trivy cache, anonymous Mongo config volume and exported image tar
  were removed. Production/staging and Git history were not mutated.

### Remote pending / not claimed

- Final release QA now passes: client `469/469`, server `898/898`, E2E `98/98`, release
  prerender `38/38`, security/dependency/ops gates and Docker contract `3/3`.
- Docker Desktop stopped once after BuildKit hit a recursive `chown -R /app` I/O failure.
  The redundant recursive ownership step was narrowed to the two writable runtime
  directories; Docker Desktop restarted and the final rebuild/smoke/scan all passed.
- GitHub Docker CI job has not run remotely because the candidate is not pushed.
- Render Docker pilot still requires the remote candidate, authenticated staging target and
  confirmed no-cost service availability. Production and the existing native staging service
  remain unchanged.

## STOP Conditions

- Docker installation requires admin/host mutation not separately approved.
- Build would require copying `.env`, credential or private data into image/context.
- Render target cannot be proven as staging, asks for payment, or requires changing the
  existing production service.
- Remote deploy requires commit/push not explicitly authorized.
- Same verification fails three times after evidence-based fixes.

## Maintenance Notes

- Exact image digests intentionally freeze bytes; update tag + digest together after
  scheduled scan/review, never refresh digest silently.
- Do not enable `BACKGROUND_JOBS_ENABLED=true` on multiple web replicas. Use a singleton
  worker or distributed lock before scaling.
- Do not add Docker Scout/DockSec until Hadolint + Trivy evidence shows a concrete gap.
