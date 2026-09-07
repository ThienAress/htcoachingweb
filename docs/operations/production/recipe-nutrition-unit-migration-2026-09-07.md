# Recipe nutrition unit migration — Production — 2026-09-07

## Outcome

Production Recipe nutrition normalization completed successfully. All legacy
`nutrition.additional[].unit: mg` entries in the approved target were converted to
canonical `g`, their numeric values were divided by 1,000, and independent postflight
verification found no remaining legacy item.

## Approval and safety boundary

- Owner explicitly approved the production migration on 2026-09-07.
- Target was the production Recipe collection only.
- Recovery gate used verified logical backup
  `production-logical-backup-20260907T045540Z`.
- `verify:backup-release` passed with backup age 8.18 hours and
  `verify:disaster-recovery` passed before apply.
- Atlas Free does not provide continuous recovery; this known limitation did not
  bypass the required fresh logical-backup gate.
- The retained backup is recovery evidence. Any restore remains a separate incident
  operation requiring explicit target and approval.

## Preflight

- Recipe documents containing legacy items: 747.
- Legacy `mg` items: 5,229.
- Invalid or non-convertible items: 0.
- The first apply attempt intentionally used the backup read-only credential and was
  rejected by the database at `update`. It produced zero writes; repeated preflight
  remained 747 documents / 5,229 items.

## Approved apply and verification

- Official guarded apply matched 747 documents and modified 747 documents.
- Immediate verification found 0 documents / 0 items with legacy `mg`.
- Postflight with the apply credential found 0 documents / 0 items.
- Independent postflight with the backup read-only credential also found
  0 documents / 0 items.
- Focused migration suite passed 1 file / 9 tests.
- Read-only production smoke passed 11/11 at `2026-09-07T13:31:57.212Z`.

## Blast-radius confirmation

The operation changed only `nutrition.additional[].unit` from `mg` to `g` and the
corresponding `value` by the exact `/ 1000` conversion. It did not change core
nutrition fields, schema, indexes, environment configuration, application deploys,
customer records, trainer records, or unrelated Recipe fields.
