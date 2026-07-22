# Phase 10 Production Readiness Runbook

Date: 2026-07-21
Scope: deployment configuration, read-only security validation, runtime lifecycle and repository data boundaries

## 1. Safety boundary

The Phase 10 code changes do not run migrations, provider writes, retention,
restore, load tests or production deployment.

The following actions require explicit owner approval:

- any command that connects to a real database;
- untracking or deleting runtime/customer files;
- Git history rewrite or force push;
- credential revocation/rotation;
- Cloudinary upload/delete drill;
- backup/restore;
- enabling retention or CSP enforcement;
- staging or production deployment.

## 2. Current release blockers

Two P0 findings were detected locally:

1. Git tracks 51 files under `server/uploads`, including F1 media and other
   runtime uploads.
2. `current_kb_entries.txt` contains a value matching the Google App Password
   format.

The credential must be treated as compromised and revoked in Google Account even
if the repository is private. Do not paste its value into tickets, logs or chat.

No files were opened as media, removed, untracked or rewritten by Phase 10.

## 3. Production environment contract

Use `server/.env.production.example` as the variable-name contract only.
Store real values in the hosting secret manager.

Run from `server` in the target deployment environment:

```powershell
npm run check:production-readiness
```

The checker prints only finding codes/messages and safe booleans/counts. It never
prints secret values or connection strings.

Fatal configuration includes:

- non-production `NODE_ENV__;
- missing/weak/equal JWT and refresh secrets;
- missing/localhost/non-TLS MongoDB target;
- HTTP, wildcard or mismatched client/CORS origins;
- incomplete Google OAuth configuration;
- non-private F1 storage or missing Cloudinary configuration;
- mock/missing production AI providers;
- missing explicit F1 consent/admin configuration.

Conditional warnings include:

- missing dedicated log-hash/ops/email integration;
- implicit proxy hop or background-job mode;
- CSP still report-only.

Production startup enforces fatal checks. The stricter CLI additionally requires
the operational integrations.

## 4. Proxy and network

Set `TRUST_PROXY_HOPS` to match the exact reverse-proxy path. The compatibility
default is one hop, but release approval requires an explicit value.

The last trusted proxy must overwrite forwarding headers. Verify:

- `X-Forwarded-For`;
- `X-Forwarded-Host`;
- `X-Forwarded-Proto`.

Never set Express trust proxy to unrestricted `true` without proving the
front proxy sanitizes these headers.

## 5. Web and worker topology

Set `BACKGROUND_JOBS_ENABLED` explicitly:

- `true` on the single designated worker instance;
- `false` on web-only replicas.

The current jobs still use in-process scheduling. Until a dedicated queue exists,
do not enable jobs on every horizontally scaled web replica.

This flag does not run or stop existing production jobs until a deployment is
approved.

## 6. Health probes and shutdown

Configure the platform:

- liveness: `GET /api/ops/health/live`;
- readiness: `GET /api/ops/health/ready`.

The compatibility `/api/ops/health` remains a readiness alias.

Readiness returns 503 while MongoDB is unavailable or the process is draining.
Liveness stays 200 during drain so the platform can distinguish replacement from
a crashed process.

HTTP bounds:

- headers: 15 seconds;
- complete request receive: 120 seconds;
- keep-alive: 65 seconds;
- graceful shutdown: 15 seconds;
- maximum request headers: 100.

Override only after measuring provider and upload behavior.

## 7. Read-only staging security smoke

Configure GitHub Environment `staging`:

- secret `STAGING_API_URL`;
- variable `STAGING_CLIENT_ORIGIN`;
- required reviewer.

Manually run workflow `Staging Security Smoke`. It performs only anonymous
GET requests and checks:

- liveness/readiness;
- Helmet, HSTS and CSP headers;
- request/trace IDs;
- exact allowed CORS origin;
- rejection of an attacker origin;
- anonymous metrics rejection;
- legacy F1 upload path 404;
- JSON 404 for unknown API paths.

The script sends no cookies, credentials or mutation requests.

## 8. Bank transfer configuration

Bank name, code, account number and account holder are now environment-only:

- `BANK_NAME`;
- `BANK_CODE`;
- `BANK_ACCOUNT`;
- `BANK_HOLDER`.

If any field is missing, deposit creation returns 503 before creating a wallet or
deposit request. Verify these values with the financial owner through the secret
manager, not source control.

## 9. Repository data incident procedure

Do not run these commands until the owner approves and confirms local files have
an approved storage/backup location.

Immediate containment:

1. Revoke the suspected Google App Password.
2. Identify which account/integration used it and issue a replacement through
   the secret manager.
3. Determine repository visibility, collaborators, forks, Actions artifacts and
   access history.
4. Classify each tracked upload as public marketing material or customer/private
   data.

Proposed untracking while retaining local files:

```powershell
git rm --cached -- current_kb_entries.txt
git rm -r --cached -- server/uploads
npm run security:secrets
npm run security:data-boundaries
```

These commands alter the Git index. They do not delete local files, but still
require approval and verification.

History cleanup is a separate change:

1. Freeze pushes and notify collaborators.
2. Create a recoverable repository backup in restricted storage.
3. Use `git filter-repo` or GitHub-supported sensitive-data removal.
4. Force-push all rewritten branches/tags under owner approval.
5. Require every collaborator and deployment checkout to re-clone.
6. Re-run secret/data-boundary scans.
7. Record incident timeline and notification decision.

History rewrite cannot guarantee deletion from forks, clones, caches or prior
downloads. Credential rotation is mandatory regardless of rewrite.

### Execution record - 2026-07-22

Completed with explicit owner approval:

1. Deleted `current_kb_entries.txt` locally and rewrote it out of `main` and
   `staging`.
2. Classified all 51 files under `server/uploads` as unused test data, deleted
   530.19 MB locally and rewrote the directory out of both branch histories.
3. Force-pushed with remote-head verification/leases and preserved newer staging
   commits discovered during cleanup.
4. Repointed local branches to clean equivalents without resetting the Phase
   1-10 working tree.
5. Expired affected reflogs/checkpoints, purged old credential/media blobs and
   removed tainted temporary mirrors.
6. Verified zero reachable credential/upload paths, `git fsck`, secret scan and
   repository data-boundary scan.
7. Confirmed the public repository has zero forks.

Final remote heads:

- `main`: `cef64e95b4b1cf1ac5ecb80f8701373d16c28046`
- `staging`: `269c6d6689b75705557482461a11569222bd58fd`

Pending external closure:

1. Google Account owner revokes the suspected App Password and confirms whether
   a replacement is needed.
2. GitHub Support purges cached views and all 18 affected PR refs (`#1` through
   `#18`). First changed commits:
   - credential file: `1a008d2013a2ae671afbdaf6e34f9b80c186f46f`;
   - runtime uploads: `a0da54a9f12660b403725f08c49621a068e5b918`.
3. Collaborators with an old clone must re-clone or rebase carefully and must
   not merge or push pre-rewrite history.

## 10. Rollout sequence

1. Resolve the repository data/credential incident.
2. Configure staging secrets and run production-readiness checker.
3. Deploy a staging web instance with background jobs disabled.
4. Configure one staging worker, then run only approved job smoke.
5. Run read-only staging security workflow and full browser matrix.
6. Run approved migrations/verifiers and Cloudinary tests.
7. Run backup/restore drill and record measured RPO/RTO.
8. Deploy production canary with CSP and retention enforcement disabled.
9. Observe health, 5xx, auth failures, financial conflicts and F1 cleanup.
10. Enable one policy at a time under separate approval.

## 11. Rollback

- Mark the instance out of readiness and roll back application version.
- Keep new Phase 8-10 fields/indexes.
- Keep background jobs disabled during uncertain rollback state.
- Do not restore hard-coded bank details, mock AI providers or public F1 media.
- Restore a database only for confirmed corruption with incident/database-owner
  approval.
