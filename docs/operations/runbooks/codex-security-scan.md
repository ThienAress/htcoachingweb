# Codex Security scan runbook

## Mục tiêu

Chạy Codex Security theo phạm vi nhỏ, có threat-model context và guard chi phí. Workflow này bổ sung cho
local audit/CI; không thay thế secret scan, dependency audit, tests, ownership review hoặc human vetting.

## Trigger matrix

| Change | Local/CI gates | Codex Security |
|---|---|---|
| Routine UI/docs/refactor | Bắt buộc | Không chạy mặc định |
| Backend/API thông thường | Bắt buộc | Chỉ khi có trust boundary/input mới |
| Auth, payment, wallet, sensitive ownership | Bắt buộc | Bounded diff/working-tree/path trước |
| Release lớn hoặc kiến trúc mới | Bắt buộc | Bounded scan; full/deep chỉ khi evidence yêu cầu |

Không cấu hình paid scan trong GitHub Actions. Full/deep scan luôn cần explicit scope, cost acknowledgement
và user authority.

## Wrapper policy

Root command:

```text
npm run security:codex -- <options>
```

- Mặc định: working tree so với `HEAD`, `--dry-run`, `--max-cost 2`.
- Policy ceiling: `$5`; wrapper reject giá trị lớn hơn.
- `--execute`: bắt đầu scan thay vì dry-run; có thể phát sinh usage/cost.
- `--full` hoặc `--deep`: cần thêm `--ack-full-scan`; deep map sang CLI `--mode deep`.
- `--path`: target phải nằm trong repository và tồn tại.
- `--max-cost` là estimate guard, không phải hard billing cap. Request đang chạy có thể hoàn tất vượt limit.
- Wrapper không nhận hoặc log API key, cookie, token hay raw finding payload.

## Safe preflight

Không phát sinh scan:

```text
npm run security:codex -- --working-tree
npm run security:codex -- --diff origin/main
npm run security:codex -- --path server/src/routes
```

Wrapper tự thêm `--dry-run` khi thiếu `--execute`.

## Bounded execution

Chỉ chạy sau khi đã xác nhận account/access và chấp nhận cost estimate:

```text
npm run security:codex -- --working-tree --max-cost 2 --execute
npm run security:codex -- --diff origin/main --max-cost 2 --execute
npm run security:codex -- --path server/src/routes --max-cost 2 --execute
```

## Full/deep execution

Chỉ dùng cho release lớn hoặc khi bounded scan/threat model chỉ ra coverage gap rộng:

```text
npm run security:codex -- --full --ack-full-scan --max-cost 5 --execute
npm run security:codex -- --deep --ack-full-scan --max-cost 5 --execute
```

## Review result

1. Xác nhận target, revision, mode và phạm vi thực tế.
2. Đọc coverage, deferred areas và proof gaps trước findings.
3. Với mỗi candidate, kiểm tra attacker-controlled input, root control/sink, reachability và impact.
4. Reject false positive hoặc finding không đủ proof; không sửa hàng loạt theo raw output.
5. Fix từng accepted finding bằng patch nhỏ + focused regression test.
6. Re-run focused validation và ghi residual risk.

Trạng thái phải dùng đúng:

- `PREFLIGHT ONLY`: CLI chỉ dry-run/preflight; không có scan findings.
- `COMPLETE`: scan hoàn tất và artifacts/coverage có thể review.
- `PARTIAL/BLOCKED`: scan dừng vì cost/access/runtime; giữ evidence có sẵn nhưng không báo PASS.
- `SKIP`: policy không yêu cầu hoặc chưa có explicit cost authority.

## Local gates luôn chạy

```text
npm run security:secrets
npm run security:data-boundaries
npm run security:audit --prefix client
npm run security:audit --prefix server
npm run test:unit:server
```

Lưu scan artifacts ngoài repository hoặc trong Codex Security state mặc định. Không commit raw scan output,
credentials, production payload hoặc private data.
