# Release promotion và live staging acceptance

Scope: CI → staging deploy identity → live acceptance → production approval →
post-deploy observation. Canonical safety policy:
`.agents/rules/workflow/release-promotion.md`.

## 1. Required protected configuration

GitHub environments:

- `staging-live-acceptance`: chỉ chứa staging write credentials.
- `production-approval`: bật required reviewer; gate không có production secret
  hay mutation.
- `production-observation`: chỉ chứa read-only provider API credentials dùng để
  xác minh deploy identity.

Required secrets/IDs:

- Staging: `STAGING_MONGO_URI`, `STAGING_JWT_SECRET`, `STAGING_ADMIN_EMAIL`,
  `NETLIFY_STAGING_SITE_ID`, `RENDER_STAGING_SERVICE_ID`.
- Provider read APIs: `NETLIFY_AUTH_TOKEN`, `RENDER_API_KEY`.
- Production observation: `NETLIFY_PRODUCTION_SITE_ID`,
  `RENDER_PRODUCTION_SERVICE_ID`.

Không in secret trong log/artifact. Provider token chỉ gọi GET deploy detail.
Theo API chính thức, Netlify deploy detail trả deploy state/commit reference và
Render retrieve-deploy trả deploy detail; verifier yêu cầu exact ID, SHA và
ready/live.

## 2. Staging live acceptance

Trigger `.github/workflows/staging-acceptance.yml` sau khi cả Netlify và Render
staging đã deploy xong. Workflow hỗ trợ:

- manual `workflow_dispatch`; hoặc
- `repository_dispatch` type `staging-deployed` từ deploy completion hook.

Payload/inputs bắt buộc: exact release SHA, successful CI run URL, hai staging
deploy IDs và hai production known-good rollback deploy IDs. Workflow sẽ:

1. checkout exact SHA và xác minh CI run cùng SHA đã success;
2. dùng provider GET API xác minh deploy IDs/SHA/status;
3. chạy `acceptance:staging` với exact database lock;
4. luôn cleanup và yêu cầu residue `0`;
5. chạy current backup + off-device recovery gates;
6. tạo artifact `release-candidate-<run_id>`.

Nếu workflow bị kill cứng trước `finally`, không chạy lại mù. Dùng cùng run ID
trong artifact/log để kiểm tra residue và dọn theo IDs/marker đã đăng ký; không
dùng query rộng. Chỉ rerun sau khi cleanup verifier trả 0.

## 3. Production promotion approval

Trigger `.github/workflows/release-promotion-gate.yml` với candidate workflow run
ID và exact SHA. Environment `production-approval` phải có reviewer. Gate tải
đúng artifact và chạy:

```powershell
node scripts/release-gate.mjs --mode=candidate `
  --manifest=artifacts/release-candidate.json `
  --backup-manifest=docs/operations/production/backup-readiness.json
```

Gate fail nếu backup hiện tại stale/khác ID, off-device recovery chưa ready,
cleanup không sạch, CI/deploy SHA drift hoặc rollback ID thiếu. Gate không deploy;
owner dùng kết quả PASS để phê duyệt thao tác deploy riêng.

## 4. Production observation

Production monitor chỉ gọi GET/HEAD. Sau deploy, ghi UTC start và chạy monitor
liên tục/scheduled trong ít nhất 30 phút. Khi cửa sổ kết thúc và monitor pass,
trigger `.github/workflows/post-deploy-observation.yml` với exact production
deploy IDs, start timestamp và monitor run URL.

Gate GET provider APIs để xác minh production deploy IDs cùng candidate SHA,
kiểm observation window và giữ artifact `production-observation-<run_id>`.
Theo dõi rolling 5 phút cho 5xx, HTTP/DB/provider P95, provider failures và heap;
đồng thời kiểm DB readiness, SePay status, RUM và integrity alerts.

## 5. Rollback

Nếu promotion/post-deploy gate fail, dừng rollout. Nếu production đã deploy và
monitor fail, dùng exact rollback IDs trong candidate rồi theo
`production-rollback-runbook.md`. Database restore chỉ dùng khi xác nhận corruption
và có approval riêng; không dùng restore để chữa application regression.

## 6. Deferred infrastructure

Atlas PITR/continuous recovery, paid monitoring, canary, Kubernetes và container
registry promotion chưa thuộc workflow này. `continuousRecoveryAvailable=false`
phải tiếp tục được báo là warning trung thực.
