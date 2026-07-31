# Backup And Restore Runbook

## Backup

1. Confirm the target cluster, database name, retention policy, encryption, and backup owner.
2. Prefer an Atlas on-demand snapshot. Record snapshot ID, cluster, timestamp, and application SHA.
3. If using mongodump, run it from an approved secure host with a least-privilege account.
4. Store output in encrypted storage; never commit archives or connection strings.
5. Verify backup completion and collection/document counts.

## Restore drill

1. Restore into a new isolated staging cluster, never over an existing production database.
2. Use separate credentials and deny application traffic until verification completes.
3. Run schema/index verification, including npm run verify:phase4-indexes.
4. Compare critical counts and invariants: users, orders, check-ins, coaching days,
   contracts, deposits, wallet transactions, recipes, and Knowledge Base entries.
5. Run server integration tests and critical E2E against the restored environment.
6. Record restore duration, data recovery point, failed checks, and cleanup owner.

## Production recovery

- Require incident lead and database owner approval.
- Stop writes or place the app in maintenance mode before a point-in-time restore.
- Preserve the damaged database for forensics.
- Rotate credentials used during recovery.
- Re-enable traffic gradually and observe integrity counters and critical workflows.

No backup or restore drill was executed as part of the local code changes. This
document defines the required controlled procedure.
