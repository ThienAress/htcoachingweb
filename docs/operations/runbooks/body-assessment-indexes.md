# Body Assessment index rollout

Scope: provision and verify the MongoDB indexes required by the private Body
Assessment draft/publish workflow. This runbook does not authorize a migration,
deployment, database write, or production feature enablement by itself.

## Safety contract

- Production runs with Mongoose `autoIndex=false`; schema declarations alone do
  not create these indexes.
- `BODY_ASSESSMENT_WRITES_ENABLED=false` is the safe default. Read endpoints
  stay available; save/publish returns
  `503 BODY_ASSESSMENT_WRITES_DISABLED`.
- Even when the flag is enabled, each mutation verifies the three unique index
  contracts and fails with `503 BODY_ASSESSMENT_INDEXES_NOT_READY` if any
  required name/key/unique option is missing or mismatched.
- The migration only creates/verifies seven indexes across
  `BodyAssessment`, `BodyAssessmentCommand`, and `BodyAssessmentRevision`.
  It modifies zero documents and performs no backfill or deletion.
- Preflight fails on duplicate groups or an index-name/contract conflict. Never
  delete or rewrite data automatically to make the migration pass.

## Staging

1. Deploy the exact candidate SHA with
   `BODY_ASSESSMENT_WRITES_ENABLED=false`.
2. Configure only the approved staging target and run:

```powershell
npm run preflight:body-assessment-indexes:staging --prefix server
```

3. Review the target database, every index status, and duplicate count. After
   explicit staging migration approval, set
   `CONFIRM_BODY_ASSESSMENT_INDEX_MIGRATION=yes` and run:

```powershell
npm run migrate:body-assessment-indexes:staging --prefix server
```

4. Require all seven indexes to report `present`; then enable
   `BODY_ASSESSMENT_WRITES_ENABLED=true`, redeploy the same SHA, and run
   focused synthetic save/publish/read/replay/ownership acceptance. Do not use
   customer health data.

## Production

1. Keep writes disabled until the same SHA passes live staging acceptance and
   the release candidate, backup, off-device recovery, and rollback gates.
2. Run the production preflight first:

```powershell
npm run preflight:body-assessment-indexes --prefix server
```

3. After explicit production migration approval, a fresh matching backup ID,
   and the `migrationSafety` variables are set, run:

```powershell
npm run migrate:body-assessment-indexes --prefix server
```

4. Verify all indexes are `present` before enabling writes. Enable the flag
   on the already-approved production SHA, then observe HTTP conflicts/errors
   and database readiness. Never use a pre-Plan-082 server as rollback.

## Rollback

Set `BODY_ASSESSMENT_WRITES_ENABLED=false` and redeploy the same compatible
server generation. Do not drop indexes or restore the database merely because
the feature is disabled. Preserve receipts, revisions, and published snapshots.
