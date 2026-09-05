# Refresh-session cutover (Plan 082)

Scope: deploy the Plan 082 refresh-token verifier/family format without allowing
old and new Auth code to serve concurrently. This runbook does not authorize a
database migration, bulk session revocation, secret rotation or production write
from a local task.

## Why this release needs a special cutover

Pre-082 builds store a bcrypt verifier and do not understand `refreshSession`.
Plan 082 stores a full-token HMAC digest plus family/JTI metadata and deliberately
rejects legacy refresh tokens. Mixed instances can therefore reject each other's
new sessions or overwrite the verifier with incompatible state. Rolling the server
back to a pre-082 build can also make an unexpired legacy token usable again.

## Required preflight evidence

Before staging or production promotion, record only secret-free evidence:

1. Exact candidate SHA and Render deploy ID.
2. Current instance count/topology and the owner-approved platform action that
   stops routing Auth traffic to every old revision before the new revision serves.
3. A Plan-082-compatible recovery deploy or an owner-approved forward-fix path.
   A pre-082 deploy ID is not an eligible server rollback target.
4. UTC cutover start, operator and incident/rollback owner. Never record cookies,
   JWTs, verifier values, JTI/family IDs or provider credentials.

Stop if Render cannot prove the old revision is drained, if traffic can reach both
revisions, or if the only proposed recovery action is a pre-082 server rollback.
Provider status `live` alone is not drain evidence.

## Staging rehearsal

1. Put the staging API behind the owner-selected maintenance/drain boundary and
   wait for all pre-082 instances and in-flight Auth requests to finish.
2. Deploy the exact candidate, prove only that revision is serving, then reopen
   staging traffic.
3. With an isolated staging test account, verify through public HTTP behavior:
   legacy refresh returns the generic 403 and clears the cookie; a fresh login can
   rotate its successor; replay revokes that family; logout works with an expired
   access token and valid CSRF.
4. Confirm no raw token/session identifiers appear in response bodies or logs and
   observe Auth 401/403/5xx signals. Clean up only the isolated fixture through the
   existing approved staging-acceptance process.

Do not promote if the rehearsal used overlapping revisions or if its recovery
target/path was not exercised or independently reviewed.

## Production cutover

1. Announce a bounded maintenance window; stop new Auth traffic using the exact
   drain/suspend action proven in staging.
2. Confirm every pre-082 instance is terminated or unable to receive traffic.
3. Deploy the exact reviewed SHA and confirm only the Plan 082 revision is ready.
4. Reopen traffic. Login/refresh/logout smoke mutates the designated account's Auth
   state and is **not** read-only: run it only when the owner has separately approved
   that exact production test account and bounded write. Without that approval, run
   only health/readiness checks and keep production Auth acceptance blocked. Existing
   users may need one re-login after the 15-minute access token expires; do not treat
   that expected cutover as a reason to restore old Auth.
5. Monitor refresh/logout 403 and 5xx rates plus `auth.refresh_reuse_detected`
   counts without logging credential values. Follow the normal observation window.

## Recovery and rollback

- Client-only rollback remains allowed when the newer server is compatible.
- Server recovery must use a build that retains Plan 082 verifier/family semantics,
  or a forward-fix produced from the candidate.
- Never roll back to pre-082 Auth with the same session population and secret. If
  emergency recovery truly requires it, stop the rollout and obtain explicit
  incident/security approval for a separate global-session revocation or secret
  rotation procedure. Those actions are outside this runbook and require their own
  backup, blast-radius and user re-authentication plan.
- Database restore is not a remedy for an application cutover failure.

Attach the drain proof, exact revision IDs, smoke result, observation timestamps and
chosen recovery action to the release evidence. Keep rollout `NOT STARTED` or
`BLOCKED`; never mark it complete from local tests alone.
