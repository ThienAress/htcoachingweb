# Spec: Curated source-backed retrieval and citation

## Objective

Khi một câu hỏi cần nguồn, HT Assistant ưu tiên tri thức đã được đội ngũ review
trong Knowledge Base trước khi gọi web search. Cách này làm citation ổn định hơn,
giảm phụ thuộc vào kết quả web biến động và vẫn giữ fail-closed khi không có bằng
chứng đủ điều kiện.

## Boundaries

- Chỉ dùng entry đã `published`, embedding đúng version, `reviewStatus=reviewed`
  và chưa quá `reviewDueAt`.
- Chỉ source-backed entry có nguồn ngoài HTTPS hợp lệ mới được nâng thành evidence
  cho câu hỏi cần nguồn; legacy/stale/thiếu review chỉ là context không citable.
- Curated miss không được biến thành claim có nguồn: authenticated request tiếp tục
  web search hiện có, guest tiếp tục policy không có web search.
- Query đi vào retrieval phải qua privacy gate hiện có; không log raw question,
  answer hoặc source payload.
- Slice này chỉ thay server; không đổi schema, migration, corpus, index, provider,
  model, auth, quota hoặc client UI.

## Requirements

### REQ-093 — Curated source-backed retrieval precedes web search

- AC-030: Câu hỏi cần nguồn có curated hit đủ điều kiện không gọi Google Search,
  không expose `search_knowledge`, câu trả lời giữ source HTTPS và trace ghi
  `internal_kb`.
- AC-031: Hit stale, legacy, chưa review hoặc không có source phù hợp không được
  nâng thành evidence; no-hit giữ nguyên authenticated web hoặc guest fail-closed.
- AC-032: Curated retrieval dùng query đã qua privacy boundary và không log raw
  question/answer/source payload.
- AC-033: Retrieval filter/embedding version và citation sanitizer không bị nới
  lỏng; route có curated hit không được expose tool ngoài route.
- AC-034: Slice backend-only không thay đổi `client/`, nên không yêu cầu Netlify
  build.
