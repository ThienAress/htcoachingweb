# Spec: Promotion release và acceptance staging có ghi dữ liệu an toàn

## Objective

Thiết lập một đường phát hành có bằng chứng cho HTCOACHINGWEB: đúng một Git SHA
được kiểm tra trên staging, mọi ghi thử chỉ diễn ra trong database
`htcoaching_staging`, dữ liệu tổng hợp luôn được dọn sạch, và production chỉ bị
truy cập bằng các phép đọc. Một release chỉ đủ điều kiện promotion khi có CI,
deploy identity, staging acceptance, recovery evidence, rollback target và cửa
sổ quan sát tương ứng với chính release đó.

## Release contract

### Staging acceptance

- Mọi script có mutation phải fail-closed nếu `APP_ENV` khác `staging`, database
  từ `MONGO_URI` khác chính xác `htcoaching_staging`, API target khác staging,
  hoặc thiếu confirmation variable riêng.
- Mỗi lần chạy sinh một `runId` ngẫu nhiên và marker canonical
  `htcoaching-acceptance:<runId>`. Chỉ document/side effect được đăng ký dưới
  marker hoặc ID do run hiện tại tạo mới được phép cleanup.
- Cleanup chạy trong `finally`, kể cả acceptance pass, API fail, timeout hoặc
  assertion fail. Sau cleanup phải đếm lại toàn bộ collection/side effect thuộc
  run và chỉ báo PASS khi residue bằng `0`.
- Không xóa theo query rộng, không cleanup dữ liệu seed/customer và không sửa
  schema. State tạm thời trên fixture (wallet/session/bookmark) phải được khôi
  phục đúng baseline đã chụp trước run.
- Workflow giữ một artifact JSON không chứa secret gồm SHA, deploy IDs, run ID,
  flow results, cleanup result và timestamps.

### Production boundary

- Tất cả production monitor/smoke/promotion verifier chỉ dùng `GET`/`HEAD`.
- Không workflow hoặc script acceptance nào được nhận production origin,
  production database hay biến xác nhận production mutation.
- Production promotion là một gate có approval; gate không tự deploy. Push,
  deploy, migration, seed hoặc production write cần yêu cầu riêng của owner.

### Release manifest và promotion

- Candidate manifest schema đóng (reject field lạ) và phải ghi exact 40-char Git
  SHA, branch, CI run URL, Netlify staging deploy ID, Render staging deploy ID,
  acceptance run URL/artifact, cleanup `verified=true`, recovery backup ID và
  rollback deploy IDs cho client/server.
- Candidate chỉ PASS khi CI và staging acceptance đều PASS, SHA của hai deploy
  trùng candidate SHA, cleanup residue bằng `0`, và backup/off-device recovery
  gate hiện tại PASS.
- Post-deploy evidence ghi exact production deploy IDs/SHA, thời gian bắt đầu và
  kết thúc quan sát, production monitor run URL và quyết định giữ release hoặc
  rollback. Evidence cũ của release khác không được tái sử dụng.
- PITR/continuous recovery không được tuyên bố khi manifest recovery ghi
  `continuousRecoveryAvailable=false`.

### Monitoring

- HTTP 5xx rate và P95 HTTP/DB/provider được tính trên cửa sổ trượt 5 phút có
  giới hạn bộ nhớ; counter lifetime vẫn giữ để tương thích Prometheus cũ.
- Snapshot/Prometheus có rolling request count, rolling 5xx count/rate, P95
  HTTP, DB và AI/provider, RSS, heap used/total và heap utilization.
- Production monitor tiếp tục read-only, kiểm tra readiness DB cùng trạng thái
  provider đã có và lưu snapshot theo từng run.
- Cảnh báo HTTP dùng rolling rate/sample threshold, không dùng điều kiện
  `http.errors > 0` tích lũy. Heap/latency/provider signals có threshold và số
  mẫu tối thiểu rõ ràng để tránh báo động do một sample đơn lẻ.

## Testing strategy

- Unit contract cho exact database/origin/confirmation và production denial.
- Unit/integration seam cho registry cleanup: cleanup chạy cả success/failure,
  chỉ xóa IDs/marker của run, và verification fail nếu còn residue.
- Node tests cho release-manifest schema, SHA/deploy consistency, current backup
  evidence, observation window và rollback identity.
- Server tests dùng clock tiêm vào để chứng minh event cũ hết hạn khỏi rolling
  window và alert không còn bị lifetime counter giữ active.
- Workflow/source checks cùng `npm run agents:validate` khóa drift giữa rule,
  `pre-deploy`, `ship` và release runbook.

## Boundaries

- **Always**: synthetic marker, exact `htcoaching_staging`, cleanup trong
  `finally`, residue `0`, secret-free artifact và production read-only.
- **Ask first**: deploy/push/merge, production config mutation, migration,
  restore production, tạo dịch vụ trả phí hoặc bật PITR.
- **Never**: dùng customer data cho fixture, xóa query rộng, in URI/token,
  hardcode credential, coi preflight/manifest thiếu ID là PASS.

## Success criteria

- [ ] Acceptance success và forced failure đều cleanup, verifier trả residue `0`.
- [ ] Production URI/database/origin bị từ chối trước mutation.
- [ ] Staging workflow tạo artifact gắn exact SHA/deploy IDs và không chứa secret.
- [ ] Promotion gate fail khi CI/acceptance/cleanup/recovery/SHA/rollback thiếu
      hoặc không khớp.
- [ ] Metrics và alerts dùng rolling 5 phút; production monitor thu DB/provider,
      latency và memory signals chỉ bằng read request.
- [ ] Post-deploy evidence bắt buộc thuộc cùng SHA và có observation window.
- [ ] `pre-deploy`, `ship`, rule canonical và workflow map cùng trỏ một contract.
- [ ] Focused tests, operations tests, security scans và agent validator pass.

## Deferred

- Paid Atlas/PITR/continuous recovery, container registry promotion, canary,
  Kubernetes và tự động deploy lên production.
