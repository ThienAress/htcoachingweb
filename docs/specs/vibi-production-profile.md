# Vibi + Brave production profile

Owner approved production release and selected Vibi + Brave on 2026-10-08.
This extends [Vibi evidence and certification](./vibi-evidence-and-certification.md).
Implementation: [Plan096A](../plans/096a-enable-vibi-production-profile.md).

## REQ-001 — Enable the chosen production provider safely

- AC-001: Explicit `AI_PRODUCTION_PROVIDER_PROFILE=vibi` authorizes Vibi only with
  APP_ENV/NODE_ENV=production, exact gym-app database, production HTTPS origins,
  fixed Vibi endpoint/model, Brave credentials and no staging trial flag.
  Startup, chat, KB selection and web grounding use this validated profile;
  malformed settings fail before provider egress. Existing staging guards remain unchanged.
- AC-002: An explicit calorie target below the current tool bound returns a clear
  deterministic explanation before model or meal execution. Preserve minimum 500 kcal
  per meal / 800 per day, strict schema validation, allergy and nutrient guards.
- AC-003: Release requires candidate-matched trusted CI/staging acceptance, cleanup
  residue zero, current off-device recovery evidence and production rollback IDs.
  Owner accepts existing fifteen cases PASS_WITH_NOTE and staging UI; preserve raw
  machine failures and TALK01 fork/validation notes. Do not repeat those fifteen prompts.
- AC-004: Production activation retains unrelated settings and Gemini credentials for
  other consumers, verifies paired exact-SHA deployment and >=30 minute observation.
  No production catalog writes or migration are included. Record rollback config privately.

## Cost and privacy

Owner-attested wallet after TALK01: 9.06 USD. Stop before another paid request if balance
is unverifiable or <=3 USD. Provider logs remain allowlisted metadata without raw payload.
No new write tools, auth, quota, CSRF, schema or customer-data changes are permitted.
