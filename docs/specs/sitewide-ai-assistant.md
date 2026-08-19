# Spec: HT Assistant theo ngữ cảnh toàn website và guest access

## Objective

HT Assistant phải xuất hiện trên các trang public cho cả khách chưa đăng nhập, hiểu đúng trang và nội dung
canonical mà người dùng đang xem. HT Assistant chỉ mở khi người dùng chủ động bấm launcher. Thành công
khi guest có thể hỏi/tóm tắt nội dung public trong quota an toàn; người đã đăng nhập giữ nguyên lịch sử và
các tool cá nhân; dữ liệu draft, dữ liệu riêng và instruction nằm trong nội dung CMS không thể vượt trust boundary.

## Assumptions

1. Guest mode là bản giới hạn: không upload ảnh, không history/sidebar/feedback và không dùng tool cần auth
   hoặc web-search tốn chi phí.
2. Guest conversation được lưu tối đa 24 giờ để giữ mạch hội thoại trong phiên; không merge vào tài khoản
   sau khi đăng nhập và không xuất hiện trong màn hình Knowledge Base admin.
3. Quota guest là 5 tin/24 giờ theo IP đã HMAC; user thường 15 tin/24 giờ + 60 tin/30 ngày;
   coaching customer 30 tin/giờ + 600 tin/30 ngày; HLV 30 tin/giờ + 1.200 tin/30 ngày.
   Ba tier HT Fitness+ lần lượt là 20/120, 40/300 và 60/600 theo cửa sổ giờ/30 ngày.
4. Không hiển thị proactive assistance theo thời gian/scroll; launcher và suggestion trong panel là điểm vào duy nhất.
5. Không thêm dependency và không sửa `client/src/utils/api.js`, JWT cookie hay CSRF middleware hiện có.

## Tech Stack liên quan

- Client: React 19, React Router 7, Tailwind CSS 4, Vitest.
- Server: Express 5, Mongoose 9, JWT httpOnly cookie, CSRF, express-rate-limit, SSE.
- AI: provider abstraction hiện có, canonical page context, tool registry và Knowledge Base.

## Commands

- Focused client tests: `npm run test:unit:client -- --run <test-file>`
- Focused server tests: `npm run test:unit:server -- --run <test-file>`
- Agent validation: `npm run agents:validate`
- AI tool validation: `node .agents/scripts/validate-tools.mjs`
- Release build: `npm run build --prefix client`

## Cấu trúc file bị ảnh hưởng

- `client/src/config/aiPageContext.js`: registry UI/suggestion theo route.
- `client/src/components/ChatWidget/{DeferredChatPanel,ChatPanel}.jsx`: guest UI và action mở chat.
- `server/src/middlewares/{optionalAiAuth,aiGuestSession}.js`: trust boundary guest/auth.
- `server/src/middlewares/aiRateLimit.js`: quota riêng guest/auth.
- `server/src/routes/ai.routes.js`: chat dùng optional auth; history vẫn protected.
- `server/src/controllers/ai.controller.js`: owner filter user/guest và tool capability.
- `server/src/services/ai/{contextEnricher,systemPrompt,contentModeration}.js`: canonical context,
  untrusted-data boundary và moderation guest.
- `server/src/services/ai/tools/toolRegistry.js`: chỉ expose tool guest-safe.
- `server/src/models/ChatConversation.js`: owner XOR `userId`/`guestKey`, TTL theo actor.
- `server/src/controllers/knowledgeBase.controller.js`: giữ guest conversation khỏi admin mining.

## Code Style

- Frontend chỉ gọi API qua `ai.service.js`/`useAiChat`; component không tự fetch.
- Backend giữ route → middleware → controller → service/model.
- Page type và resource slug do server suy ra từ pathname allowlist; không trust type do client gửi.
- Query content detail phải có public-status filter và projection tối thiểu.
- Nội dung CMS được đóng gói là untrusted data, không phải system instruction.

## Testing Strategy

- Unit test route resolution, spoofed page type, public-status filters và expanded summary content.
- Integration/unit test guest owner isolation, authenticated backward compatibility, quota key và moderation.
- Unit test tool schema guest không chứa tool private/web-search.
- Client unit test page registry và suggestion theo route.
- Chạy AI check, client/server unit suites và release build sau implementation.

## Boundaries

- Always: CSRF cho POST chat; ownership ở mọi query conversation; public projection; fail closed.
- Ask first: migration/backfill production, đổi quota thương mại hoặc lưu guest lâu hơn 24 giờ.
- Never: raw IP trong DB/log, guest truy cập dữ liệu user, tự gọi model trước click, đưa raw DOM vào prompt.

## Success Criteria

- Guest thấy launcher trên public pages và gửi được chat qua cùng endpoint với CSRF + quota.
- Token hết hạn vẫn trả 401 để client refresh; chỉ request không có token mới trở thành guest.
- Guest không thấy history/sidebar/upload/feedback và không gọi được tool private hoặc web search.
- AI tự nhận diện mọi route customer/public chính; detail adapter chỉ đọc content published.
- Blog summary dùng nội dung canonical mở rộng có giới hạn; recipe dùng đủ các bước trong giới hạn.
- Không có nudge tự xuất hiện; launcher và suggestion chỉ hoạt động sau thao tác chủ động.
- Authenticated chat/history/tool behavior hiện tại không bị breaking change.

## Open Questions

Không có blocker cho local implementation. Mọi thay đổi quota phải cập nhật registry canonical và spec, không
được override bằng env theo cách làm Admin matrix khác runtime.
