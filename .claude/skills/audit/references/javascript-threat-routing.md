# JavaScript and workflow threat routing

Dùng sau khi đã map untrusted input tới sink; đây là routing checklist, không phải danh sách finding tự động.

| Surface/sink | Checks ưu tiên | Evidence tối thiểu |
|---|---|---|
| URL fetch, webhook, image/import URL | SSRF, redirect/DNS bypass, scheme/host allowlist, timeout/size cap | Attacker controls URL and request reaches protected/network asset |
| Filesystem path, archive, upload name | Path traversal, canonical path containment, extension/MIME/size | Crafted path escapes intended root or overwrites/reads asset |
| Object merge/query/update | Prototype pollution, unsafe keys, operator injection | Attacker-controlled key changes prototype/query semantics |
| Regex built from input | ReDoS/catastrophic backtracking, length cap | Bounded payload produces repeatable CPU/latency impact |
| HTML/URL/markdown output | Stored/reflected XSS, unsafe protocol, raw HTML | Payload reaches browser sink without framework/allowlist protection |
| Shell/process invocation | Command/argument injection | Untrusted value reaches shell parsing instead of typed API/args |
| GitHub Actions expressions/scripts | Workflow/script injection, unpinned third-party action, excessive permissions | PR-controlled value reaches shell or action trust boundary |

Defense-in-depth thiếu nhưng attack đã bị layer khác chặn phải ghi hardening note, không nâng thành vulnerability.
Với parser/runtime assumption, chạy minimal harness hoặc cite spec; không report “potential” khi chưa có repeatable path.
