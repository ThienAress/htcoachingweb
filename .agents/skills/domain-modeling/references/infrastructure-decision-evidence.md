# Infrastructure decision evidence

Đọc reference này khi cân nhắc cache dùng chung, queue/event bus, read replica, partition/sharding,
provider/platform boundary hoặc topology khó đảo ngược. Đây là evidence gate cho ADR, không phải
tutorial System Design và không mặc định yêu cầu thêm hạ tầng.

## Evidence envelope

Trước khi chọn phương án, ghi bằng measurement hoặc assumption được gắn nhãn:

- Baseline hiện tại và cửa sổ đo: average/peak RPS hoặc jobs/s, concurrency, payload/data size,
  growth/retention, read/write ratio và dependency latency/error rate có liên quan.
- User-facing SLO/SLA cần bảo vệ: latency percentile, availability, freshness/durability hoặc
  recovery objective; tránh dùng “scale tốt hơn” không định lượng.
- Bottleneck đã quan sát: trace/profile/query plan/queue depth/resource saturation hoặc failure
  evidence. Phân biệt limit hiện tại với forecast và nêu confidence.
- Ít nhất hai phương án thật, gồm giữ nguyên/optimize đơn giản khi hợp lệ; so sánh complexity,
  consistency, failure modes, cost, operations, privacy/security và reversibility.
- Trigger threshold để rollout: metric + ngưỡng + thời gian duy trì. Nếu chưa đạt, defer thay vì
  áp cache/queue/shard chỉ vì đó là pattern phổ biến.
- Plan đo sau rollout, observability/alert, staged exposure, rollback signal/procedure và data
  compatibility. Với migration topology, nêu expand-contract/dual-read-write reconciliation.

## Quyết định và vị trí artifact

- Nếu chưa đủ ba điều kiện ADR trong `$domain-modeling`, giữ benchmark/evidence trong plan hoặc
  report và ghi decision deferred; không tạo ADR để hợp thức hóa một ý tưởng.
- ADR chỉ ghi decision/trade-off/threshold bền; raw benchmark lớn và runbook rollout ở artifact
  chuyên biệt rồi link tới.
- Diagram upstream chỉ giúp học khái niệm. Không copy diagram/text/assets; vẽ mô hình project-specific
  chỉ khi quan hệ thật của HTCOACHINGWEB cần nó.

## Review questions

- Workload và SLO có đến từ surface đang quyết định hay từ ví dụ chung?
- Chọn pattern có giải bottleneck đo được, hay chỉ chuyển bottleneck/consistency risk sang nơi khác?
- Failure/degraded mode có giữ correctness, authorization và reconciliation không?
- Metric nào chứng minh rollout tốt hơn, khi nào rollback và ai có authority thực hiện?
