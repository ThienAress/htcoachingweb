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
- AC-005: On 2026-10-09 the owner authorized increasing KB selection from 15 to
  30 seconds. Admin KB search, selector and provider share this cap; shorter caller
  deadlines and cancellation still apply. Chat keeps its 75-second overall deadline,
  45-second provider cap and generic tools keep 15 seconds. No additional retries,
  token/context limits or model changes. Certify this change on the new exact SHA.

- AC-006: On 2026-10-11 the owner chose the official DeepSeek endpoint for production because
  the Vibi channel returned first tokens after 21-27 seconds (Vibi average 17.6 s) while the
  official endpoint answered KB selection in about 0.7 s. `AI_PRODUCTION_PROVIDER_PROFILE=official`
  is accepted only with `DEEPSEEK_ENDPOINT_PROFILE=official`, `DEEPSEEK_MODEL=deepseek-flash`, the
  same production guards as AC-001 (Brave search, exact gym-app database, production HTTPS
  origins, no staging trial flag) and a key for that endpoint. The profile name must equal the
  resolved endpoint profile; mixed Vibi/official values are rejected. Exact-15 certification
  evidence accepts the pair (`vibi`, `deepseek-v4.1-flash`) or (`official`, `deepseek-flash`).
  Activation still needs the protected promotion and observation of AC-004; this change alone
  activates nothing without those environment values.

## Cost and privacy

Owner-attested wallet after TALK01: 9.06 USD. Stop before another paid request if balance
is unverifiable or <=3 USD. Provider logs remain allowlisted metadata without raw payload.
No new write tools, auth, quota, CSRF, schema or customer-data changes are permitted.
