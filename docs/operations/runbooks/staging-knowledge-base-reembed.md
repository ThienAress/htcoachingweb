# Staging Knowledge Base Re-embed And Rollback

## Boundary

Runbook này chỉ áp dụng cho database `htcoaching_staging`. Script không có đường
production và phải từ chối trước connection nếu `--target`, `APP_ENV`, database
trong `MONGO_URI` hoặc `MIGRATION_TARGET_DATABASE` không khớp chính xác.

Không ghi secret, URI, raw vector, nội dung snapshot hoặc đường dẫn private vào
Git, CI artifact hay chat. Chạy từ approved workstation; truyền secret qua process
environment tạm thời và xóa khỏi session sau khi hoàn tất.

## Required custody

- `MONGO_URI`: staging-only credential, URI chứa database `htcoaching_staging`.
- `GEMINI_API_KEY`: key đã phê duyệt cho embedding provider.
- `KB_REEMBED_SNAPSHOT_DIR`: absolute directory ngoài repository và ngoài thư mục cloud public.
- `KB_REEMBED_SNAPSHOT_KEY`: secret ngẫu nhiên tối thiểu 32 ký tự, lưu riêng trong Bitwarden.
- `KB_REEMBED_MAX_PROVIDER_CALLS`: hard cap 1–5.000; mặc định 500 và chỉ tăng sau khi review estimate/cost.
- `APP_ENV=staging` và `MIGRATION_TARGET_DATABASE=htcoaching_staging`.

Snapshot dùng AES-256-GCM với encrypted payload và scrypt-derived key. File chứa
vector rollback nên vẫn phải được xem là private backup artifact; không upload lên
GitHub hoặc Google Drive production-backup destination.

## Preflight — zero writes

1. Bảo đảm code đang ở exact staging deploy SHA đã pass CI.
   Tạm dừng admin KB writes trong maintenance window; nếu có concurrent insert sau
   transaction snapshot, post-check sẽ fail nhưng các write trước đó có thể đã commit.
2. Nạp `MONGO_URI`, đặt `APP_ENV` và `MIGRATION_TARGET_DATABASE`; chưa cần snapshot key.
3. Chạy:

   `npm run preflight:kb-reembed:staging --prefix server`

4. Review JSON chỉ gồm `planDigest`, profile/version và counts. Không tiếp tục nếu
   provider-call estimate, document/variant count hoặc target khác dự kiến.
5. Ghi lại exact 64-character `planDigest`; apply phải dùng lại giá trị đó.

Preflight chỉ đọc `knowledgeentries`, không gọi Gemini, không tạo snapshot và không
ghi database.

## Apply — staging only

1. Tạo snapshot secret mới, lưu trong Bitwarden với plan digest/snapshot purpose,
   rồi đặt `KB_REEMBED_SNAPSHOT_KEY` trong process environment tạm thời.
2. Đặt absolute `KB_REEMBED_SNAPSHOT_DIR` ngoài repository.
3. Đặt `CONFIRM_KB_REEMBED_STAGING=yes`.
4. Chạy:

   `npm run migrate:kb-reembed:staging --prefix server -- --plan-digest=<reviewed-digest>`

5. Script phải thực hiện theo thứ tự: recompute digest → generate toàn bộ target
   vectors → ghi và decrypt-readback snapshot → transactional CAS update → post-verify.
6. Lưu `snapshotId`, snapshot filename và key custody record. Output không được chứa
   file path, raw vector hoặc câu hỏi Knowledge Base.

Nếu provider fail, không có snapshot/database write. Nếu source state drift trước
transaction, transaction abort. Snapshot được giữ lại nếu database transaction fail;
CLI chỉ báo `snapshotId` an toàn, operator đối chiếu encrypted file trong private dir.
Nếu post-check fail sau commit, giữ runtime profile cũ, điều tra corpus drift và
rollback theo snapshot; không đổi Render env.

## Atlas and Render staging cutover

1. Tạo root index `kb_embedding_v2` và nested index
   `kb_variant_embedding_v1` theo exact definitions trong
   `docs/architecture/atlas-vector-index.md`.
2. Chờ Atlas báo ready và đối chiếu dimension, similarity, filter fields cùng
   `nestedRoot` trước khi đổi Render.
3. Đặt Render staging theo thứ tự:
   - `KB_EMBEDDING_PROFILE=question-answering-v1`
   - `KB_VECTOR_INDEX=kb_embedding_v2`
   - Chỉ sau live root query PASS, đặt
     `KB_VARIANT_VECTOR_INDEX=kb_variant_embedding_v1`.
4. Verify exact deploy SHA, root query, variant query, category/freshness/version
   filters và fallback metrics. Nếu nested compatibility fail, unset riêng variant
   variable; bounded variant fallback phải còn hoạt động.

## Rollback

Preflight rollback cần snapshot path và key, nhưng không ghi database:

`npm run preflight:rollback-kb-reembed:staging --prefix server -- --snapshot=<absolute-snapshot-file>`

Review returned original `planDigest`. Apply rollback chỉ khi live question/variant
content và target vector-state hash vẫn khớp snapshot:

`npm run rollback:kb-reembed:staging --prefix server -- --snapshot=<absolute-snapshot-file> --plan-digest=<original-reviewed-digest>`

với `CONFIRM_KB_REEMBED_ROLLBACK_STAGING=yes`. Sau post-verify, unset ba Render vars
`KB_VARIANT_VECTOR_INDEX`, `KB_VECTOR_INDEX`, `KB_EMBEDDING_PROFILE` để runtime trở
về legacy bounded fallback. Không xóa Atlas indexes trong incident window.
Rollback chỉ bảo vệ vector lifecycle và question/variant text; `updatedAt` do
usage/metadata thông thường đổi độc lập không bị restore hoặc coi là vector drift.

## STOP conditions

- Database name không đúng `htcoaching_staging` ở URI, target hoặc connected server.
- Plan digest, content hash, vector-state hash hoặc snapshot authenticated digest lệch.
- Snapshot key chưa được lưu riêng hoặc encrypted snapshot readback fail.
- Fresh production backup gate chưa PASS trước staging data migration.
- Atlas index chưa ready hoặc definition khác tài liệu canonical.
- Provider quota/cost không đủ cho toàn bộ preflight estimate.
- Bất kỳ thao tác nào yêu cầu production write.

## Evidence and cleanup

Ghi secret-free evidence: staging merge/deploy SHA, plan digest, counts, snapshot ID,
post-verify result, Atlas index status, live smoke và rollback readiness. Sau cửa sổ
quan sát, giữ encrypted snapshot theo private retention policy; xóa process environment
secret và mọi plaintext/transient file. Không đánh dấu Plan 090 done nếu authenticated
live smoke hoặc final staging acceptance chưa PASS.
