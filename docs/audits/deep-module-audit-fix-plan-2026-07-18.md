# HT Coaching Web - Deep Module Audit & Fix Plan

**Ngay audit:** 2026-07-18
**Pham vi:** AI/Chat, Knowledge Base, Blog, Recipe, Check-in, Coaching Content, toan bo Mongoose model indexes va toan bo Playwright E2E.
**Trang thai code:** Bao cao nay dua tren noi dung moi nhat tren disk trong luc audit. Worktree dang co cac thay doi cua chu du an; audit khong revert hay sua source code.

> Muc tieu cua tai lieu nay khong chi la liet ke bug. Moi nhom van de deu co muc do uu tien, tac dong, huong sua va tieu chi nghiem thu de co the tach thanh ticket trien khai.

## 1. Ket luan dieu hanh

Codebase da co nen tang kha tot: route nhay cam phan lon da co authentication/CSRF, ownership duoc kiem tra o nhieu flow, transaction da duoc dung cho check-in, React Query da xuat hien o mot so module, du lieu AI co TTL, upload co gioi han loai file, va unit test hien tai dang xanh.

Tuy nhien, co 4 nhom rui ro can xu ly truoc khi mo rong traffic:

1. **Ro ri secret va public hoa du lieu draft:** API check-in tra ve full `User`; recipe draft co the doc qua slug.
2. **Mat du lieu do concurrent write:** coaching client co the ghi de noi dung trainer; trainer co the xoa progress cua client; check-in chua idempotent va refund session co lost-update risk.
3. **AI chua co bien an toan runtime:** tool arguments chi duoc mo ta cho model, khong validate tai server; message/image/conversation document khong co gioi han phu hop; retry Gemini 400 co loi control flow.
4. **E2E chua bao ve business flow:** 22 test hien tai chi la public smoke; 2 test fail vi locale khong deterministic; chua co auth, role, CSRF, IDOR, check-in, coaching, AI/KB, blog/recipe hay transaction flow.

### Thu tu can sua ngay

| Thu tu | ID | Muc do | Van de | Ly do |
|---:|---|---|---|---|
| 1 | CHECKIN-01 | P0 | API `getMyCheckins` tra full `User` | Co the lo `password` va `refreshToken` hash ra client |
| 2 | RECIPE-01 | P0 | Recipe draft doc duoc qua public slug | Pha vo publish boundary |
| 3 | COACH-01 | P0 | Client feedback thay the full `exercises` | Client co the sua/xoa trainer content |
| 4 | COACH-02 | P0 | Trainer upsert thay full array progress | Concurrent write co the lam mat feedback/progress |
| 5 | INDEX-01 | P0 | Partial unique index cua Contract dung `$nin` | Dieu kien index khong nam trong cac operator partial index duoc MongoDB document; invariant active-contract co the khong ton tai |
| 6 | CHECKIN-02 | P1 | Create check-in khong idempotent | Retry/double-click tru session 2 lan |
| 7 | AI-01 | P1 | Tool arguments khong runtime validate | LLM co the tao input qua lon/sai type/gia tri am |
| 8 | AI-02 | P1 | Conversation va image khong co bound | Cost, RAM, DB document 16 MB va request abuse |
| 9 | AI-03 | P1 | Gemini 400 retry thanh cong van bi return error | AI bao loi gia va mat response hop le |
| 10 | UPLOAD-01 | P1 | Coaching upload 100 MB trong RAM va authorization yeu | OOM, chi phi Cloudinary, orphan file va privacy risk |

## 2. Cach audit va ket qua verification

Da doc truc tiep:

- Tat ca route/controller/model/service/client component cua AI, Knowledge Base, Blog, Recipe, Check-in va Coaching.
- Tool registry, tool engine, Gemini provider, embedding, moderation, context enrichment va chat streaming.
- Tat ca khai bao `schema.index(...)` trong server va doi chieu voi query controller/service/cron.
- Toan bo `playwright.config.js`, `e2e/homepage.spec.js`, `e2e/public-pages.spec.js`.

Da chay:

- Unit tests: **132/132 passed** trong vong audit tong quan.
- `npm audit` root/client/server: **0 vulnerability duoc npm report** tai thoi diem audit.
- Client build: **passed**; van co chunk lon can toi uu.
- Targeted ESLint cho cac module trong pham vi: **0 error, 10 warnings**.
- Playwright E2E: **20 passed, 2 failed**, tong thoi gian khoang **2.1 phut**.

Hai E2E fail khong phai vi trang blank. App tu detect English trong browser test, trong khi assertion hard-code tieng Viet:

- Expected `TANG CO - GIAM MO`, actual heading English `Transform in 90 Days No Excuses.`
- Expected `Dang nhap`, actual `Login`.

Day la dau hieu test environment chua deterministic, khong nen chi sua chuoi assertion.

## 3. AI va Chat

### 3.1 Diem da lam tot

- AI routes deu yeu cau dang nhap; mutation chat co CSRF va user-keyed rate limit.
- Conversation query loc theo `userId`, khong chi tin vao conversation id.
- Tool hien tai chi doc du lieu, giam blast radius neu model bi prompt injection.
- Agent loop co gioi han 5 vong va model output co cap.
- System prompt da co medical guardrail: khong chan doan va co huong khuyen nghi gap chuyen gia.
- Chat document co TTL 30 ngay, la nen tang tot cho retention.
- Client dung POST SSE, credentials, CSRF va `AbortController`; parser bo qua event malformed thay vi crash ca stream.

### 3.2 Van de server

#### AI-01 - P1 - Tool schema khong phai runtime validation

**Bang chung:** JSON Schema trong tool registry duoc gui cho model, nhung `toolEngine.executeTool()` goi thang `tool.execute(parameters, context)`. Model output khong duoc validate lai.

**Tac dong:**

- `suggestMeal` co the nhan `mealsPerDay` rat lon, bang 0 hoac am; gay loop lon, output lon, phep chia sai.
- `calculateTdee` co the nhan tuoi/chieu cao/can nang/adjustment phi thuc te.
- Cac `limit` co noi chi clamp upper bound, khong chac type/lower bound.
- Prompt injection co the bien thanh CPU/cost amplification du tool chi read-only.

**Fix:**

1. Chon mot validator chung, uu tien `Ajv` vi tool da co JSON Schema; compile schema luc khoi dong.
2. Them `minimum`, `maximum`, `maxLength`, `maxItems`, `additionalProperties: false` vao tung schema.
3. Reject tool call sai voi mot ket qua an toan, khong throw raw error vao stream.
4. Them hard cap trong implementation; khong chi dua vao schema.

**Acceptance:** unit test cho sai type, missing required, negative, upper bound, extra field va payload qua lon; tool implementation khong chay khi validation fail.

#### AI-02 - P1 - Message, image va conversation khong co bound

**Bang chung:** controller chi kiem tra message non-empty; JSON global limit dang rat lon; image base64 co the duoc luu vao message; conversation append vo han. Chi 20 message cuoi duoc gui den model nhung toan bo message van ton tai trong mot Mongo document.

**Tac dong:** request memory spike, token/cost tang, document dat gioi han MongoDB 16 MB, save fail sau mot thoi gian su dung.

**Fix:**

- Message text: 4,000-8,000 ky tu tuy product decision.
- Image: upload rieng/stream, magic-byte validation, 2-5 MB, resize, khong luu raw base64 trong conversation.
- Conversation: tach `ChatMessage` collection hoac archive/summarize sau N message; denormalize `messageCount`, `lastMessagePreview`, `lastMessageAt`.
- Gioi han so conversation/user va them retention job co audit.

**Acceptance:** payload qua cap tra `413`/`422`; conversation lon khong cham 16 MB; listing khong load full message arrays.

#### AI-03 - P1 - Gemini retry 400 co control-flow sai

**Bang chung:** trong `gemini.provider.js`, response 400 tao retry. Du retry thanh cong va `response` duoc gan lai, execution van nam trong block `if (!response.ok)` cua response ban dau va di den error yield/return.

**Tac dong:** request da thanh cong nhung user nhan AI error, co the hien status 200 trong error text; provider cost van phat sinh.

**Fix:** tach `sendRequest()` va `retryWithSanitizedPayload()` thanh cac ham tra response; sau retry chi xu ly error neu response moi van `!ok`. Khong dua provider technical error vao assistant message.

**Acceptance:** provider mock: first=400, second=200 stream phai duoc stream day du; first=400, second=4xx tra normalized error; timeout va abort co test.

#### AI-04 - P1 - Disconnect khong abort upstream va co the mat conversation write

`req.on("close")` dung loop/controller, nhung provider fetch chua nhan `AbortSignal`. Controller co the return truoc `conversation.save()`.

**Fix:** tao mot `AbortController` cho moi request, pass signal va timeout xuong Gemini/Google fetch. Quy dinh persistence: user message phai save truoc provider call; assistant message save theo chunk checkpoint hoac final status `completed/aborted/failed`.

#### AI-05 - P1 - Concurrent send cung conversation

Hai tab/nhieu click co the cung doc mot document, append va save; ket qua co the VersionError hoac last-write-wins.

**Fix:** message collection voi atomic insert la huong ben vung. Neu chua migrate, dung optimistic concurrency, conversation revision va client request id; return `409` khi revision cu.

#### AI-06 - P1 - Rate limit/moderation state chi nam trong memory

Rate limiter dung store memory; moderation warning/lock dung `Map`. Restart/multi-instance se mat state. Entry warning chua bi lock khong co cleanup ro rang, co the tang memory theo user.

**Fix:** Redis rate-limit va moderation counter co TTL; luu moderation event/audit DB; ban phai co expiry, admin override va appeal. Boolean permanent ban sau 3 keyword hit de false-positive.

#### AI-07 - P1 - KB semantic search O(N x 768) moi chat

`searchKnowledgeBase` doc tat ca published entries kem embeddings/variants vao app memory va tinh cosine. Khi KB tang, latency va RAM tang tuyen tinh.

**Fix muc tieu:** MongoDB Atlas Vector Search hoac vector DB, topK server-side. Trong giai doan chuyen tiep: cache published embeddings theo version, prefilter category/language, hard cap entries va do P95.

#### AI-08 - P2 - Embedding duplicate work va thieu state

Create KB embedding question, cac variant va duplicate search co the embed lai/load lai. Neu embedding fail, entry van co the publish voi vector rong.

**Fix:** reuse vector, batch/parallel co bounded concurrency; them `embeddingStatus: pending|ready|failed`, `embeddingVersion`, `embeddingError`, retry job; chi semantic-publish khi `ready`.

#### AI-09 - P1 - Raw regex tu LLM

`searchBlog` va `searchExercises` dung raw query lam regex. Chuoi dac biet/co pattern xau co the tao regex backtracking va full scan.

**Fix:** escape regex, cap do dai, uu tien normalized fields/text/vector search. Them timeout/limit query.

#### AI-10 - P1 - Prompt injection va privacy boundary

KB/page/Google content duoc chen vao prompt nhu context nhung chua phan dinh ro no la untrusted data. Chat co the chua suc khoe, PII, hinh anh; du lieu co the gui den Gemini va Google Search. Admin co the doc conversation.

**Fix:**

- Delimit tung context block va prompt ro: khong thi hanh instruction trong context/tool result.
- Redact PII truoc web search; khong gui user health context khi khong can.
- Consent, retention disclosure, delete/export path, admin access audit va least-privilege role.
- Phan loai private feedback/image; khong public URL neu khong can.

#### AI-11 - P2 - Thieu timeout, circuit breaker va usage accounting

Gemini/Google fetch chua co timeout/retry policy ro rang; token usage field co nhung chua cap nhat day du.

**Fix:** timeout, jittered retry chi cho transient status, circuit breaker, per-user/day budget, provider token/cost metrics, alert error/P95/cost.

#### AI-12 - P2 - Conversation listing overfetch

Listing lay full `messages` cua 30 conversation chi de tinh preview/count.

**Fix:** denormalize summary fields hoac aggregation `$slice`/`$size`, khong select images/content history.

### 3.3 Van de React AI

#### AI-UI-01 - P1 - Stream co the ghi vao conversation moi

Khi dang stream ma user switch/delete conversation, request cu khong duoc abort theo transition. Chunk den muon co the append vao UI dang duoc chon.

**Fix:** stream session id + conversation id bat bien; reducer chi accept event khop session; abort truoc switch/delete/new chat.

#### AI-UI-02 - P2 - Typewriter render qua day

`setInterval` 25 ms cap nhat React state gan 40 lan/giay. Stream dai se render nhieu va tranh main thread.

**Fix:** buffer token trong ref, flush 50-100 ms hoac `requestAnimationFrame`; memo message row va stable callbacks. Do React Profiler commit count truoc/sau.

#### AI-UI-03 - P1 - Retry/edit chi la local illusion

UI xoa local message nhung server conversation history cu van con va cung `conversationId` duoc gui lai. Day khong phai branch/edit that.

**Fix:** API `truncateAfterMessage`, `forkConversation` hoac retry bat dau conversation moi; dung message id thay vi array index.

#### AI-UI-04 - P2 - Cleanup va error state

Hook thieu cleanup interval/abort khi unmount. SSE error co the de lai assistant bubble rong. ESLint canh bao dependency cua typewriter.

**Acceptance chung AI UI:** khong state update sau unmount; switch chat trong stream khong cross-write; retry/edit co server semantics; Profiler giam ro commit count.

## 4. Knowledge Base

### 4.1 Diem da lam tot

- Toan bo KB route la admin-only; mutation co CSRF.
- Model co maxlength/enums va embedding field `select: false` theo mac dinh.
- Co source metadata, variant concept, usage tracking va semantic duplicate intent.

### 4.2 Van de va huong sua

#### KB-01 - P1 - Input/query khong co DTO day du

`page`, `limit`, `threshold`, `days`, id va search chua duoc bound/validate dong nhat. Admin search/conversation search dung raw regex.

**Fix:** schema validation cho tung route; page >=1, limit <=100, days <=90, threshold 0..1; validate ObjectId; escape regex.

#### KB-02 - P1 - Publish duoc entry khong co embedding

Embedding fail van co the tao/publish entry vector rong, sau do entry im lang bien mat khoi semantic result.

**Fix:** embedding state machine + retry queue; publish gate; dashboard hien failed/pending.

#### KB-03 - P1 - Duplicate prevention khong atomic

Semantic duplicate la app-level check va co race. Khong co normalized exact-question unique constraint.

**Fix:** `normalizedQuestion`; unique index phu hop voi business rule; bat duplicate-key; semantic duplicate chi la suggestion, khong thay the invariant DB.

#### KB-04 - P1 - Client duoc phep gui embedding khi merge

`mergeVariant` co the nhan embedding array tu client. Client khong nen la authority cho vector.

**Fix:** client gui text/source; server normalize, dedupe variant va generate vector. Cap variant count/length.

#### KB-05 - P2 - Listing tai full variant vectors

Server select `+variants`, sau do xoa variant de chi lay count. Day la bandwidth/RAM khong can thiet.

**Fix:** aggregation `$size` hoac `variantCount` denormalized; detail endpoint moi load variant text, vector van an.

#### KB-06 - P2 - Create response lo vector khong can thiet

Duplicate response gui 768-d embedding ve client trong `pendingData`, roi client gui nguoc lai. Xoa flow nay cung luc voi KB-04.

#### KB-07 - P1 - Conversation suggestion load va prompt qua rong

Flow suggestion load message cua tat ca conversation trong khoang `days` vao memory; days chua cap. Raw user/assistant text chen vao prompt va JSON output parse long leo.

**Fix:** aggregate/sample trong DB, hard cap messages/tokens, delimiting untrusted transcript, schema-validate LLM JSON, luu provenance va moderation state.

#### KB-08 - P1 - Admin chat access can audit rieng

Generic admin doc duoc conversation. Day la du lieu nhay cam.

**Fix:** permission `conversation:read`, reason field, audit log, masked preview va retention policy.

#### KB-09 - P2 - Source tracking chua noi vao UI

Client import `createKBFromConversation` nhung flow thuc te mo form thuong; conversation/message source khong duoc gan.

**Fix:** tao tu message phai gui immutable source reference va snippet hash; UI hien source.

### 4.3 React KB

- Search doi callback va effect fire theo moi phim; Enter co the tao request thu hai.
- Response cu co the overwrite response moi; chua cancel/debounce.
- Stats/categories bi reload theo moi filter du khong phu thuoc filter.
- Mot `loading` dung cho nhieu tab; conversation pagination state co nhung UI chua dung.
- CRUD khong co saving lock ro, co the double-submit; merge xong khong refresh variant count.

**Fix:** TanStack Query voi query key chuan, debounced search 300 ms, AbortSignal, `keepPreviousData`, tach static metadata query, mutation disable + invalidate dung key. Pagination phai render hoac bo state dead.

## 5. Blog

### 5.1 Diem da lam tot

- Public query co `published` boundary.
- Slug unique; pagination da clamp 1..50.
- Server sanitize HTML va client DOMPurify, la defense-in-depth tot.
- Admin mutation co auth/CSRF; upload co size/format/Cloudinary transformation.
- Client public pages da dung TanStack Query.

### 5.2 Van de va huong sua

#### BLOG-01 - P1 - `PATCH` co semantics full replacement

Payload helper default missing fields ve empty/draft. Caller gui partial PATCH co the xoa title/content va unpublish. UI hien gui full payload, nhung API contract van nguy hiem.

**Fix:** doi endpoint thanh `PUT` neu full replacement, hoac PATCH chi set field xuat hien trong body. Validation phan biet create/update.

#### BLOG-02 - P1 - HTML sanitizer allowlist rong

Allow `style` tren moi tag va `data:` scheme global tang CSS/UI-redress/tracking surface.

**Fix:** allow attribute theo tag; bo `style` neu khong can; scheme theo `img/src`, `a/href`; cap HTML size; test malicious fixtures.

#### BLOG-03 - P2 - Raw regex va index khong phuc vu sort

Admin/AI search raw regex. Public category filter + sort `publishedAt` chua co compound index day du.

**Fix:** escape/cap search; them `{status, category, publishedAt:-1}` va neu query nhieu `{status, subCategory, publishedAt:-1}` sau khi verify `explain`.

#### BLOG-04 - P2 - Asset lifecycle tao orphan

Upload anh doc lap; bo form, thay cover/content hoac xoa post chua chac cleanup old Cloudinary asset.

**Fix:** luu `publicId`, attachment table/status, confirm on save, async cleanup job/outbox.

#### BLOG-05 - P2 - Build hook va analytics

Moi update co the trigger Netlify build ke ca draft, khong debounce/idempotency. View count tang moi fetch/bot/refresh. `readTime` dem raw HTML.

**Fix:** trigger chi khi published representation thay doi, enqueue/debounce; analytics co dedupe/bot policy; strip HTML truoc dem tu.

### 5.3 React Blog

- Query “popular posts” dang goi cung endpoint/sort voi latest, nen UI popular thuc chat la newest.
- `relatedPostsRaw || []` tao reference moi moi render va bi hook warning.

**Fix:** server support `sort=popular` hoac doi label; stable empty constant/useMemo dung dependency.

## 6. Recipe

### 6.1 Diem da lam tot

- Admin mutation co auth/CSRF va allowed-field whitelist.
- Slug unique; Cloudinary storage; detail page gioi han YouTube embed bang URL pattern.
- Model co text index va schema kha day du ve domain.

### 6.2 Van de va huong sua

#### RECIPE-01 - P0 - Draft recipe public qua slug

`getRecipeBySlug` khong them `isPublished: true`. Bat ky ai biet/doan slug co the doc recipe draft.

**Fix ngay:** public controller query `{slug, isPublished:true}`; admin detail co endpoint rieng. Them integration test published=200, draft=404, anonymous va authenticated-normal-user deu 404.

#### RECIPE-02 - P1 - Public taxonomy/bookmark leak draft

Public `distinct` category/area tinh ca unpublished. Bookmarked list khong loc published, nen recipe da an van xuat hien.

**Fix:** them publish predicate cho public taxonomy va bookmark population/query; neu product can owner preview, route rieng co role.

#### RECIPE-03 - P1 - Pagination/search khong bound

Page/limit public/admin co the am/qua lon; search raw regex. Text index hien co khong duoc controller su dung.

**Fix:** clamp 1..50/100; escape regex hoac dung `$text`/normalized search; validate filters.

#### RECIPE-04 - P1 - Bookmark toggle khong atomic

Read-modify-save co the lost update khi concurrent. Toggle cung khong idempotent: retry co the dao nguoc ket qua.

**Fix:** `PUT /bookmarks/:recipeId` dung `$addToSet`, `DELETE` dung `$pull`; validate ObjectId. Response tra final `bookmarked`.

#### RECIPE-05 - P1 - Upload va DB khong nhat quan

Upload middleware chay truoc khi controller xac nhan recipe; id sai tao orphan. Replace khong xoa old asset; DB delete thanh cong nhung Cloudinary fail bi nuot.

**Fix:** verify entity/authorization truoc upload; luu `publicId`; replacement theo outbox/saga; cleanup retry co metric.

#### RECIPE-06 - P2 - DTO/model normalization

Thieu cap array/string/URL dong nhat; duplicate slug update thanh 500. Slug khong normalize lowercase. File format dua nhieu vao provider; can magic-byte validation.

**Fix:** create/update DTO, normalized slug, duplicate-key 409, magic-byte. Index unique tren normalized slug.

#### RECIPE-07 - P1 - Admin create recipe chua hoan chinh

Admin UI co icon Plus nhung khong co create handler/service. Day la feature gap, khong chi UX polish.

#### RECIPE-08 - P2 - Client bookmark va update flow sai lech

Detail khong biet initial saved state, nut co the am tham remove bookmark. Update text xong upload anh fail tao partial success nhung UI bao ca operation fail.

**Fix:** API tra bookmark state; mutation UI co success/error; tach status “content saved, image failed” hoac gom server orchestration.

## 7. Check-in

### 7.1 Diem da lam tot

- Create check-in kiem tra order approved, sessions > 0 va trainer ownership.
- Decrement session va create check-in nam trong transaction.
- Update kiem tra trainer ownership cua order.
- Search da escape regex va cap 50 ky tu.
- Mutation co CSRF va mot phan route validation.

### 7.2 Van de va huong sua

#### CHECKIN-01 - P0 - Full User document di ra API

`getMyCheckins` tra `user: req.user`/full user document. `User` schema co `password` va `refreshToken`; cac field nay khong `select:false` theo mac dinh.

**Fix ngay:**

1. Response DTO chi gom field can hien thi: `_id`, `name`, `email`, `avatar`, role neu can.
2. Dat `password` va `refreshToken` thanh `select:false` trong schema.
3. Moi auth flow can secret phai explicit `.select('+password +refreshToken')`.
4. Audit cac response khac de tim full user serialization.

**Acceptance:** API snapshot khong chua `password`, `refreshToken` hay internal flags; regression test quet nested response keys.

#### CHECKIN-02 - P1 - Create khong idempotent

Transaction bao dam moi request atomic, nhung hai request hop le van tao hai check-in va tru hai session.

**Fix:** client tao `clientRequestId` UUID; unique index `{orderId, clientRequestId}`; duplicate request tra lai ket qua cu. UI disable submit chi la lop UX, khong thay idempotency.

#### CHECKIN-03 - P1 - Refund session co lost update

Delete load order, `sessions += 1`, save. Hai transaction concurrent co the cung doc mot gia tri va mat mot increment.

**Fix:** `$inc: {sessions:1}` atomic trong transaction, kem invariant/cap theo purchased sessions neu co. Delete check-in phai idempotent.

#### CHECKIN-04 - P1 - Schema/body bounds yeu

`orderId`, name/time/muscle/note chua co required/maxLength/format day du. Global request body lon lam note abuse co the rat lon.

**Fix:** DTO + schema defense-in-depth; enum/date format; note cap hop ly; ObjectId validate.

#### CHECKIN-05 - P2 - Pagination/sort/overfetch

Admin query page/limit/month/year chua bound. Sort `createdAt` trong khi domain hien thi co the la `time`; backdated check-in xep sai. `getMyCheckins` khong paginate va tra nhieu order/check-in/user data.

**Fix:** chot mot canonical occurrence timestamp; paginate; response summary/detail tach rieng.

### 7.3 React Check-in

- Query key `['orders']`, `['checkins', page]` khong co user/role/filter; cache co the hien stale data sau account/role switch neu QueryClient khong clear.
- Admin fetch toi 1,000 order de lam customer dropdown; can async search endpoint.
- Trainer search chi filter current page, de user hieu nham la search toan bo history.
- Admin/trainer history lap logic lon, de drift.

**Fix:** query key factory gom actor/scope/filter; clear auth-scoped cache khi logout; server-side search/pagination; dung shared presentation component va role-specific action layer.

## 8. Coaching Content

### 8.1 Diem da lam tot

- Client own-plan query loc theo authenticated user.
- Trainer timeline/upsert/delete da kiem tra approved trainer-client relationship trong code hien tai.
- `CoachingDay` co unique `{userId, dateString}`.
- Mutation co CSRF; Cloudinary tra secure URL.

### 8.2 Van de va huong sua

#### COACH-01 - P0 - Client co the thay trainer-owned exercise content

`submitFeedback` nhan va thay toan bo `exercises` array tu client. Client co the sua `name`, sets, reps, weight, demo URL, them/xoa bai hoac gan URL tuy y.

**Fix ngay:** payload feedback chi cho `{exerciseId, completed, feedbackNote, feedbackVideoId}`. Server update dung positional/arrayFilters, khong nhan trainer-owned field. Kiem tra exercise id thuoc dung CoachingDay/user.

#### COACH-02 - P0 - Trainer va client ghi de nhau

Trainer upsert replace full exercises array; client feedback cung replace array. Concurrent autosave co the xoa progress/feedback hoac xoa thay doi trainer.

**Fix ben vung:** tach du lieu:

- `CoachingExerciseAssignment`: trainer-owned prescription/version.
- `CoachingExerciseProgress`: user-owned completion/note/media, unique assignment + user.

**Fix chuyen tiep:** subdocument `_id` on dinh, patch theo field ownership, Mongoose optimistic concurrency/version, `If-Match`/revision va 409 conflict UI.

#### COACH-03 - P1 - Upsert validation yeu

`findOneAndUpdate` trainer upsert thieu `runValidators:true`; date/title/note/exercise fields chua bound day du.

**Fix:** DTO strict, `runValidators`, max exercise count, numeric/string/URL bounds, canonical date timezone.

#### COACH-04 - P1 - Admin upsert co the doi ownership

Admin action gan `trainerId` thanh admin id, co the “cuop” plan thay vi bao toan trainer assigned.

**Fix:** admin phai explicit `assignedTrainerId` co validation/audit, hoac preserve current trainer. Khong suy trainer tu actor neu actor la admin.

#### COACH-05 - P2 - Timeline overfetch

My plans va trainer timeline tra full plans/exercises khong paginate; sidebar chi can summary.

**Fix:** endpoint summary theo date range + detail by id/date; paginate/cursor; select fields.

#### UPLOAD-01 - P1 - Upload authorization, RAM va quota

- Feedback upload cho authenticated user nhung chua gan plan/exercise ownership truoc upload.
- Demo upload dung `requireTrainerAccess`; can xac dinh ro subscriber co thuc su duoc phep tao trainer asset hay khong.
- 100 MB `memoryStorage` moi request co OOM risk khi concurrent.
- File filter dung MIME **hoac** extension; de spoof.
- Duration 15-20 giay chi check client.
- Upload xong save fail, replace/delete video khong cleanup asset.

**Fix:** signed direct-to-Cloudinary hoac streaming; lower size; MIME **va** extension + magic bytes/ffprobe/provider metadata; endpoint tao upload ticket gan entity/owner; per-user quota/rate-limit; attachment state + cleanup job.

#### COACH-06 - P1 - Feedback video privacy

Form review/health-related video dang la public Cloudinary URL. Can private/authenticated delivery hoac signed expiring URL, consent, retention/delete policy va access audit.

#### COACH-UI-01 - P1 - Absolute media URL bi prefix sai

Hai coaching page noi `getServerBaseUrl()` vao URL feedback ke ca khi URL da la `https://...`, tao URL hong.

**Fix:** shared `resolveMediaUrl`: absolute URL giu nguyen, chi prefix relative path.

#### COACH-UI-02 - P1 - Nested mutation va timer stale

Client shallow-clone array nhung mutate nested exercise object. Autosave timer chua cleanup day du khi unmount/switch plan; co the save note vao plan cu.

**Fix:** immutable reducer/Immer, timer map theo plan+exercise id, cleanup khi unmount/switch, mutation cancellation/revision.

#### COACH-UI-03 - P2 - Hai page qua lon va manual state

Online/Trainer coaching gan 900-1,000 dong, fetch/cache/mutation lap. Tach summary timeline, day editor, exercise row, media upload; chuyen sang TanStack Query va query-key factory.

## 9. Training Schedule correctness lien quan Coaching

Code moi nhat da them trainer-client ownership cho training schedule, day la cai thien quan trong. Con hai loi cron:

1. `reminderSent` la boolean vinh vien cho recurring weekly schedule. Sau lan gui dau, cac tuan sau khong duoc gui lai cho toi khi document TTL mat.
2. Khoang reminder gan nua dem co the wrap tu `23:xx` sang `00:xx`, nhung query van cung `dayOfWeek` va so sanh string range khong the dung.

**Fix:** luu `nextOccurrenceAt` va `lastReminderOccurrenceKey`, query timestamp range thuc; atomic claim occurrence de cron multi-instance khong gui trung. Test timezone `Asia/Ho_Chi_Minh`, midnight, DST-neutral behavior va restart.

## 10. Audit toan bo Model Indexes

### 10.1 Nguyen tac rollout

Khong nen copy tat ca index de xuat vao production ngay. Quy trinh:

1. Lay index thuc te bang `getIndexes()` va query metrics/slow log.
2. Chay `explain('executionStats')` voi du lieu gan production.
3. Don duplicate data truoc moi unique index migration.
4. Tao index bang migration co version va rollout co quan sat.
5. Sau mot observation window moi drop index trung/khong dung.
6. Dat `autoIndex:false` o production; khong goi `syncIndexes()` tuy tien vi co the drop index ngoai y muon.

### 10.2 Matrix theo tung model

| Model | Danh gia | Hanh dong de xuat |
|---|---|---|
| `AuditLog` | Tot | Giu actor/target/action indexes; them TTL chi khi retention duoc product/compliance chap nhan. |
| `BlogPost` | Thieu sort compound | Giu unique slug; them `{status,category,publishedAt:-1}` va co the subCategory; verify roi bo compound khong phuc vu sort. |
| `Booking` | Single indexes chua bam list query | Can nhac `{status,createdAt:-1}`, `{userId,createdAt:-1}`. |
| `ChatConversation` | User list + TTL tot | Giu `{userId,updatedAt:-1}` va TTL; sua unbounded document truoc; global admin sort chi them neu metric can. |
| `Checkin` | Redundant/misaligned | Chot sort domain; uu tien `{orderId,time:-1}` hoac `{orderId,createdAt:-1}`; normal index `name` khong giup unanchored regex. |
| `CoachingDay` | Unique day tot | Them `{userId,date:-1}` va `{trainerId,userId,date:-1}` cho timeline. |
| `ContactMessage` | Thieu status+sort | Them `{status,createdAt:-1}`; regex name van can search strategy khac. |
| `Contract` | **P0 invalid invariant** | Partial unique dang dung `$nin`; migrate sang explicit `isActive:true` + partial equality, va atomic status transition. |
| `CustomerStory` | Tot | Compound hien tai phu hop public/admin sort; verify usage dinh ky. |
| `DepositRequest` | Tot | Unique code, user/status, status/expiry va pending-user partial index phu hop invariant. |
| `Exercise` | Search mismatch | Normalize unique name; controller regex khong dung text index. Dung `$text`, prefix normalized hoac search service. |
| `ExerciseSuggestion` | Thieu queue/list sort | Them `{status,createdAt:-1}`. |
| `F1AiReport` | Latest customer tot | Boolean standalone low selectivity; them source/engine idempotency key neu mot source chi sinh mot report. |
| `F1AiRule` | Thieu runtime sort | Them `{isActive:1,priority:-1}`; giu category/isActive cho admin filter neu explain dung. |
| `F1Assessment` | Latest tot | Quyet dinh `intakeId` co phai unique; level standalone chi giu neu analytics dung. |
| `F1Customer` | Trainer list thieu sort | Them `{assignedTrainerId,status,createdAt:-1}`; text/exact indexes con lai hop ly. |
| `F1Intake` | Race latest/version | `{customerId,version:-1}` tot nhung `isLatest` khong unique. Them partial unique latest/customer + transaction/counter/retry. |
| `F1Media` | Tot | Customer/type/latest va intake indexes phu hop query. |
| `F1OutcomeForecast` | Latest tot | Them source/engine uniqueness/idempotency neu repeated generation khong duoc duplicate. |
| `F1ResultPrediction` | Latest tot | Tuong tu outcome forecast. |
| `Food` | Nutrient scan | Label unique/text tot; AI dang scan theo nhieu nutrient. Collection nho nen cache/1 query truoc khi them 3 index. |
| `Gym` | Thieu public sort | Them `{status,sortOrder:1,name:1}`. |
| `KnowledgeEntry` | B-tree khong giai semantic | Can vector index; list compound `{status,category,usageCount:-1,updatedAt:-1}` chi them theo query/explain. |
| `Order` | Thieu actor+sort | Them `{trainerId,createdAt:-1}`, `{userId,createdAt:-1}`; status+createdAt hien tai tot; xem `{trainerId,email}` cho distinct clients. |
| `Recipe` | Thieu publish compounds | Them `{isPublished,createdAt:-1}`, `{isPublished,category,createdAt:-1}`, `{isPublished,area,createdAt:-1}` theo metrics; bo singles khong dung sau rollout. |
| `SiteSetting` | Tot | Singleton unique phu hop. |
| `Trainer` | Public listing chua toi uu | Them `{status,featured,sortOrder,publishedAt:-1}`; admin co the can `{status,createdAt:-1}`. |
| `TrainerSubscription` | Thu tu field chua hop query | Auth lookup can `{userId,status,endDate}`; expiry cron can `{status,endDate}` thay vi `{endDate,status}`. |
| `TrainingSchedule` | Thieu time trong compound | Them `{clientId,dayOfWeek,startTime}`, `{trainerId,dayOfWeek,startTime}`; redesign reminder truoc khi them cron index. |
| `User` | Secret/case invariant | Dat secret `select:false`; normalize email lowercase/trim va unique theo normalized/case-insensitive strategy. |
| `Wallet` | Tot | Unique user va balance invariant can giu; audit atomic update. |
| `WalletTransaction` | Tot | User+createdAt phu hop history; chi them `{userId,status,createdAt:-1}` neu volume/explain can. |
| `WorkoutPlan` | Tot | Trainer/client + planDate phu hop; chi them status vao compound khi query metrics chung minh. |

### 10.3 INDEX-01 - Contract partial unique migration

Partial filter cua Contract hien dung `$nin` de loai cancelled. Tai lieu MongoDB ve [partial indexes](https://www.mongodb.com/docs/manual/core/index-partial/) liet ke equality, `$exists`, range, `$type`, `$and`/`$or`, `$in` va geo; `$nin` khong nam trong tap operator duoc ho tro. Khong nen dua invariant “mot active contract/order” vao index nay.

**Migration an toan:**

1. Kiem tra index co thuc su ton tai trong tung environment hay da fail khi create.
2. Tim order co hon mot non-cancelled contract; export va resolve thu cong/qua rule.
3. Them `isActive` boolean duoc derive va cap nhat trong cung transaction voi status.
4. Backfill `isActive` va verify count/invariant.
5. Tao unique partial `{orderId:1}` voi `{isActive:true}`.
6. Deploy write path dual-write/verify, sau do bo index cu neu co.
7. Integration test hai concurrent creates: chi mot thanh cong, mot tra `409`.

## 11. E2E Audit

### 11.1 Hien trang

- 22 tests, chi Chromium desktop va public smoke/SEO.
- 20 passed, 2 fail vi locale.
- Config khong co `webServer`, nen `npm run test:e2e` khong self-contained.
- Chua co backend/test DB fixture, auth storage states, mock AI hay mock upload.
- Dung `networkidle` gan moi test va sleep co dinh 1-2 giay; suite nho van mat 2.1 phut.
- Local `retries:1` co the che flake.
- Console-error test bo qua CORS, connection refused, failed resources/net errors, dung nhung loi can phat hien.
- Nhieu assertion chi la body length/status 200. Vite SPA tra 200 khong chung minh route dung; 404 test chi check content length >100.
- Chua co mobile, Firefox/WebKit, accessibility hay visual regression co chon loc.

### 11.2 Nen test muc tieu

#### Lop 1 - Unit

- Pure validation, permissions, sanitizer, media URL, AI tool schemas.
- Model/service state transitions va idempotency helpers.

#### Lop 2 - API integration

- Supertest + Mongo replica set/test DB cho transaction/concurrency.
- Role matrix, CSRF, IDOR, unpublished boundaries, duplicate-key va rollback.
- Day la noi test check-in concurrent, contract uniqueness, coaching revision; khong ep browser test lam het.

#### Lop 3 - Browser E2E

- Mot so business journey quan trong, deterministic fixtures.
- AI provider mock voi deterministic SSE; khong goi Gemini trong CI.
- Cloudinary adapter/mock va media fixture nho.

### 11.3 Harness can lam truoc

1. Them `webServer` cho client va server trong Playwright config; reuse local server tuy env.
2. Tao `.env.test`, database rieng, seed/reset theo worker hoac test suite.
3. Co fixture users: admin, trainer approved, trainer unapproved, client active, client no-session.
4. Login qua API/setup, luu `storageState` theo role.
5. Khoa locale: `locale: 'vi-VN'` va set dung app cookie/localStorage; co mot project English rieng neu can.
6. Thay `networkidle`/sleep bang locator va response/state cu the.
7. `trace: 'on-first-retry'`, screenshot/video on failure; `retries:0` local, CI theo policy.
8. CI install/cache browser, upload HTML report/trace.

### 11.4 Danh sach spec can bo sung

| File | Luong toi thieu |
|---|---|
| `auth.spec.js` | login/logout/refresh, expired session, cache cleared, CSRF failure |
| `authorization.spec.js` | admin/trainer/user route matrix, IDOR IDs, unapproved trainer |
| `checkin.spec.js` | create, session decrement, duplicate request id, no sessions, ownership, delete refund |
| `coaching.spec.js` | trainer assign, client progress-only update, version conflict, upload ownership |
| `recipe-blog.spec.js` | draft 404, publish visibility, sanitizer, bookmark idempotency, admin create/update |
| `ai-chat.spec.js` | mocked SSE, abort/switch, retry success, tool validation, rate limit UI |
| `knowledge-base.spec.js` | admin CRUD, pending embedding, merge server-side, source provenance |
| `contract.spec.js` | concurrent active contract invariant, cancel/reactivate transition |
| `deposit-wallet.spec.js` | idempotency, balance invariant, role authorization |

### 11.5 Sua 22 test hien tai

- Dung accessible role/name hoac `data-testid` o diem khong co semantic target; khong assert text phu thuoc locale tru khi test i18n.
- Login test xac nhan form control/route, khong dung body length.
- 404 test xac nhan Not Found UI/route behavior.
- Console error allowlist rat nho va explicit; khong ignore toan bo network/CORS category.
- Public route test phai cho API mock/fixture on dinh; status assertion khong dung lam tin hieu duy nhat.

## 12. Ke hoach trien khai cu the

Uoc luong duoi day la ngay cong ky su, chua tinh review/product decision va migration production window.

### Phase 0 - Containment, 1-2 ngay

- [ ] **CHECKIN-01:** response DTO + `select:false` secrets + regression scan.
- [ ] **RECIPE-01/02:** publish filter cho slug, taxonomy, bookmarks.
- [ ] **COACH-01:** whitelist feedback fields; reject trainer-owned fields.
- [ ] **COACH-UI-01:** sua absolute media URL resolver.
- [ ] **AI-03:** sua Gemini 400 retry va test provider mock.
- [ ] Tam khoa/ha limit coaching feedback upload neu chua kip lam upload ticket an toan.

**Exit criteria:** khong lo secret; draft khong public; client khong sua trainer prescription; retry Gemini test xanh.

### Phase 1 - Data integrity va authorization, 3-5 ngay

- [ ] **COACH-02/03/04:** field ownership, revision/optimistic concurrency, DTO, admin ownership.
- [ ] **CHECKIN-02/03/04:** idempotency key, atomic refund, schema bounds.
- [ ] **RECIPE-04/05/06:** idempotent bookmark, upload lifecycle, normalized slug/DTO.
- [ ] **INDEX-01:** audit data + migrate Contract active unique index.
- [ ] F1 Intake partial unique latest + transaction/version allocator.
- [ ] Training reminder occurrence redesign va atomic claim.

**Exit criteria:** concurrency integration tests xanh; duplicate request khong tao duplicate effect; unique invariant ton tai trong DB.

### Phase 2 - AI/KB safety va scalability, 4-7 ngay

- [ ] **AI-01:** Ajv runtime schemas va hard caps.
- [ ] **AI-02:** message/image limits, summary fields; chot ChatMessage migration.
- [ ] **AI-04/05:** abort/timeout, persistence state va concurrent send revision.
- [ ] **AI-06/11:** Redis limiter/moderation, token/cost telemetry/circuit breaker.
- [ ] **AI-07/08/09/10:** vector search, embedding state, regex safety, privacy/prompt boundary.
- [ ] **KB-01..09:** DTO, publish gate, normalized unique, server-side merge, bounded suggestion va access audit.

**Exit criteria:** malformed tool calls khong chay; P95 search duoc do; embedding failure quan sat/retry duoc; khong gui raw PII ra web search.

### Phase 3 - React render va client-state integrity, 3-5 ngay

- [ ] AI stream session reducer, abort on switch, true retry/edit semantics.
- [ ] Buffer typewriter; Profiler baseline va compare.
- [ ] Knowledge Base chuyen query/mutation sang TanStack Query, debounce/cancel.
- [ ] Check-in query keys co actor/scope; server-side customer/history search.
- [ ] Coaching immutable update, cleanup timer, tach component/query layer.
- [ ] Blog popular endpoint/dependency warning; Recipe bookmark state va create flow.

**Exit criteria:** khong stale cross-account data; khong stream cross-conversation; targeted lint khong con warning trong module sua; profiler co so lieu truoc/sau.

### Phase 4 - Index rollout va performance, 2-4 ngay + observation

- [ ] Thu slow queries va `explain` cho tung pattern trong matrix.
- [ ] Migration them index theo batch; quan sat CPU/write latency/index size.
- [ ] Drop index redundant sau observation window.
- [ ] `autoIndex:false` production va versioned migration command.
- [ ] Blog/recipe/check-in/coaching listing projection/pagination; AI conversation summary.

### Phase 5 - E2E va release gate, 4-7 ngay

- [ ] Harness deterministic: webServer, DB reset, locale, role storage states.
- [ ] Sua 22 public smoke tests; bo sleep/networkidle khong can.
- [ ] Them 9 spec theo bang, uu tien auth/check-in/coaching/recipe/AI.
- [ ] API integration suite cho transaction/concurrency.
- [ ] CI gate: unit + integration + Chromium critical E2E moi PR; full browser matrix nightly.

**Exit criteria:** `npm run test:e2e` tu khoi dong day du stack va lap lai xanh; test khong goi dich vu AI/Cloudinary that; artifact day du khi fail.

## 13. Thu tu ticket de tranh xung dot

1. Secret DTO va recipe publish boundary co the merge doc lap.
2. Chot Coaching field-ownership/data model truoc khi refactor React coaching.
3. Chot Check-in idempotency contract truoc khi sua UI submit.
4. Audit production Contract data/index truoc migration schema.
5. AI tool validation va provider retry co the lam song song voi ChatMessage design.
6. Xay E2E harness som, sau do moi module fix phai them regression test vao harness.
7. Index chi rollout sau khi query shape sau refactor da on dinh.

## 14. Observability va release checklist

### Metrics can co

- AI: request count, TTFT, total latency, abort, tool validation fail, token/cost/user/day, provider status.
- KB: embedding pending/failed, search P50/P95, result hit/no-hit, vector index latency.
- Check-in: duplicate idempotency hit, transaction abort, session invariant violation.
- Coaching: revision conflict, upload bytes/user, orphan cleanup backlog, unauthorized upload attempt.
- Blog/Recipe: public draft access regression count, upload cleanup failure, build hook queue.
- DB: slow query, docs examined/returned, index size/usage, duplicate-key by invariant.

### Definition of Done cho ticket security/data integrity

- Co validation tai API boundary va invariant tai DB khi co the.
- Co positive, negative va authorization test.
- Co concurrent/idempotency test neu ticket lien quan counter/array/state transition.
- Error response khong lo stack/provider/secret.
- Co migration/rollback note neu doi schema/index.
- Co metric/log audit nhung khong log PII/secret/raw health conversation.

## 15. Ket luan

Nen tang hien tai khong can viet lai. Huong hop ly la bao ve boundary va invariant truoc, sau do tach cac document/array co concurrent ownership, tiep theo moi toi uu render, semantic search va index. P0/P1 o tren co the duoc xu ly theo tung PR nho, nhung Coaching data ownership, Contract index va Check-in idempotency can duoc xem la thay doi contract du lieu, phai co integration test va migration discipline.
