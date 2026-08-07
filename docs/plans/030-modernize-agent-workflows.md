# Plan 030: Modernize agent workflows with composable, enforced skills

> **Hướng dẫn thực thi**: Giữ policy canonical hiện có, tạo skill bằng generator, patch file dirty tối thiểu
> và chạy verification sau từng vertical slice. Không commit, push hoặc thay runtime product.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 017
- **Category**: dx
- **Planned at**: 2026-08-06
- **State**: COMPLETE / VERIFIED

## Why This Matters

HTCOACHINGWEB đã có security/QA/governance mạnh nhưng 22 skill thiếu router chung, invocation contract và
domain glossary. Kết hợp enforcement hiện có với composability/context hygiene từ Matt Pocock sẽ giảm
cognitive load, prompt drift và sửa sai do agent chọn nhầm workflow.

## Current State

- `AGENTS.md` định nghĩa source priority, Git/data safety và task orchestration.
- `.agents/skills/` có 22 skill; chỉ `impact-check` có `agents/openai.yaml`.
- `.agents/scripts/validate-agent-system.mjs` kiểm tra frontmatter, link, stale snapshot, npm command và CI hook.
- `debugging` có `REPRODUCE → LOCALIZE → REDUCE → FIX → GUARD` nhưng chưa khóa red-capable loop/hypothesis.
- `feature-spec` giới hạn task khoảng 5 file thay vì ưu tiên behavior slice.
- Chưa có root `CONTEXT.md`, ADR discipline, router, code-review hoặc handoff skill.
- Spec canonical: `docs/specs/agent-workflow-modernization.md`.

## Scope

**In scope**:

- `AGENTS.md`, `CONTEXT.md`
- `.agents/skills/{ask-ht,domain-modeling,code-review,handoff}/**`
- `.agents/skills/{debugging,feature-spec,tdd-guide,plan-template}/**`
- Metadata `agents/openai.yaml` của toàn bộ skill catalog
- `.agents/reference/agent-workflow-map.md`
- `.agents/scripts/validate-agent-system.mjs`
- `docs/architecture/adr/**`
- `docs/specs/agent-workflow-modernization.md`
- `docs/plans/030-modernize-agent-workflows.md`, `docs/README.md`, `docs/plans/README.md`

**Out of scope**:

- `client/`, `server/`, `e2e/`, production data và environment/secrets.
- Cài upstream plugin, issue tracker automation, commit/push/deploy.
- Refactor skill không trực tiếp liên quan chỉ để giảm line count.

## Steps

### Step 1: Materialize workflow contract

- Tạo spec, plan, workflow map và glossary/ADR source locations.
- Patch index hiện có tối thiểu; giữ nguyên thay đổi dirty của user.

**Verify**: relative links resolve; artifact nêu rõ canonical source và boundaries.

### Step 2: Add user-facing router and context skills

- Khởi tạo `ask-ht`, `domain-modeling`, `handoff` bằng `init_skill.py`.
- Router chỉ chọn next move; domain skill quản lý glossary/ADR; handoff reference artifact và redact.

**Verify**: `quick_validate.py` pass từng skill; forward-test bằng scenario không lộ expected answer.

### Step 3: Strengthen delivery primitives

- Nâng Deep Investigation với red-capable loop, ranked falsifiable hypotheses và cleanup.
- Đổi task slicing sang behavior end-to-end; giữ TDD red-green-refactor với micro-refactor an toàn.
- Tạo `code-review` ba axis, root aggregate và risk-based security/operations axis.

**Verify**: skill validation pass; scenario review/debug trả đúng artifact/gate.

### Step 4: Enforce invocation and catalog integrity

- Đặt `allow_implicit_invocation: false` cho user-invoked workflows có chủ ý/side effect lớn.
- Giữ primitives model-invoked; bổ sung UI metadata nhất quán khi tạo/cập nhật.
- Mở rộng validator kiểm metadata shape, router coverage và dangling skill references.

**Verify**: mutation checks chứng minh validator fail trên fixture/temporary copy sai và pass trên repo thật.

### Step 5: Progressive disclosure, integration and cleanup

- Chuyển chi tiết dài khỏi hotspot được sửa sang reference khi giúp giảm context mà không tạo duplicate.
- Review toàn diff theo Standards + Spec/Contract + Security/Operations.
- Chạy agent validation, quick validation tất cả skill mới, secret scan và diff hygiene.

**Verify**: mọi gate pass; không có placeholder, debug artifact, broken link hoặc file ngoài scope do task tạo.

## Done Criteria

- [x] Bảy nâng cấp trong spec có artifact/workflow và validator tương ứng.
- [x] Skill mới có `SKILL.md` + `agents/openai.yaml`, không có placeholder.
- [x] Router không vượt quyền Git/data/external-write của `AGENTS.md`.
- [x] `CONTEXT.md` không chứa implementation detail; ADR chỉ có discipline/template.
- [x] `npm run agents:validate`, quick validation, secret scan và `git diff --check` pass.
- [x] Plan/index ghi evidence thật và trạng thái cuối chính xác.

## Verification Evidence — 2026-08-06

- Khởi tạo `ask-ht`, `domain-modeling`, `code-review`, `handoff` bằng `init_skill.py` chính thức.
- Sinh `agents/openai.yaml` cho toàn bộ 26 skill bằng `generate_openai_yaml.py --name ...`; bốn workflow
  user-controlled là `ask-ht`, `goad`, `handoff`, `pre-deploy`.
- `quick_validate.py` pass cho bốn skill mới và bốn skill được sửa (`debugging`, `feature-spec`,
  `plan-template`, `tdd-guide`). Runtime thiếu PyYAML nên dùng adapter tạm gọi `client/node_modules/js-yaml`;
  adapter đã xóa và không thêm dependency/file repo.
- `npm run agents:validate`: PASS `26 skills`, router coverage `26/26`, `26 relative links`, `0 warnings`.
- Mutation test: tạm đổi `ask-ht` sang implicit `true`; validator fail đúng một lỗi map/metadata mismatch.
  Khôi phục `false` và validator pass lại.
- `node --check .agents/scripts/validate-agent-system.mjs`: PASS.
- `npm run security:secrets`: PASS.
- `npm run security:data-boundaries`: PASS, `0 violations`.
- `git diff --check` trên toàn scope agent/docs: PASS; chỉ có warning LF/CRLF của Git trên Windows.
- Forward-test context sạch:
  - `ask-ht` chọn đúng `$schema-change → $impact-check → $tdd-guide → $code-review` cho schema change xuyên lớp.
  - `domain-modeling` phân biệt đúng `User`, `Customer User`, `Coaching Customer` và giúp sửa glossary ambiguity.
  - `code-review` bounded review router/map/spec: `PASS`, không có finding.
  - Full-catalog review đầu tiên bị time-box vì surface quá rộng; chuyển sang bounded review theo đúng scope discipline.

## Out-of-scope Finding From Forward Test

Forward-test domain modeling phát hiện contract quyền Trainer có khả năng drift: `getTrainerClients()` và
resolver chuẩn yêu cầu `status: "approved"` cùng `sessions > 0`, nhưng `getClientTimeline()`,
`upsertCoachingDay()` và `deleteCoachingDay()` trong `server/src/controllers/coaching.controller.js`
chỉ kiểm `status: "approved"`. Điều này có thể cho phép đọc/sửa sau khi hết buổi, trái spec Today Dashboard.
Không sửa trong Plan 030 vì `server/` ngoài scope và file đang có thay đổi của user; cần một task
`$impact-check`/authorization riêng với regression tests.

## STOP Conditions

- Cần sửa product/runtime file hoặc policy security ngoài phạm vi đã duyệt.
- Validator mới chỉ có thể pass bằng cách bỏ kiểm tra hiện có.
- Phát hiện file `.agents/` in-scope có thay đổi đồng thời không thuộc task.
- Cùng verification fail ba vòng sau các sửa có căn cứ.

## Maintenance Notes

- Router là map, không phải executor; cập nhật khi thêm/đổi/xóa user-reachable skill.
- Invocation metadata là contract có CI enforcement, không chỉ UI decoration.
- Glossary/spec/ADR/plan phải giữ vai trò tách biệt để tránh một quyết định có nhiều nguồn canonical.
