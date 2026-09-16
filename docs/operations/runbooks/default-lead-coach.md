# HLV chính mặc định — rollout Plan089

## Authority và phạm vi

Local implementation không bật production hoặc backfill. Database user read-only
đã dùng chỉ để xác minh diagnostic trước đó; không dùng credential đó cho apply.
Không lưu ObjectId/email cá nhân trong source; dùng ID đã user xác nhận ngoài repo.

## Cấu hình khi được duyệt rollout

Backend `DEFAULT_ADMIN_TRAINER_ID=<ObjectId tài khoản admin/HLV chính đã xác minh>`.
Giữ role admin. ID explicit có precedence; ADMIN_EMAIL fallback cũ giữ tương thích
nhưng không dùng làm kế hoạch định danh lâu dài. Không chọn admin đầu tiên trong DB.
Không đổi ID này tùy tiện khi còn legacy null: đó là thay đổi ownership thực tế,
cần kiểm tra cohort và duyệt chuyển giao, không chỉ coi là đổi env vô hại.

Luồng server mới nhận legacy null qua effective resolver; không cần backfill để
khách đủ điều kiện nhận reminder. Đơn mới/đơn pending duyệt sẽ ghi lead rõ ràng.
Đơn đã phân công HLV khác và hợp đồng lịch sử không bị thay đổi tự động.

## Trước production

1. Review diff riêng089 cùng changes086–088 hiện chưa commit; không coi working
   tree hoặc local tests là SHA đã deploy. Chốt artifact/SHA riêng.
2. QA full/CI sạch; fix hoặc giải quyết fail ngoài scope trước release gate.
3. Staging synthetic: lead + admin khác + trainer khác + clients/order null và
   explicit. Verify personal scope, chuyển lead↔trainer, consent, idempotency,
   conflict multi-active-order, deleted account và privacy.
4. Chỉ sau explicit deploy approval mới cấu hình ID production và deploy exact SHA.
5. Giữ MORNING_HEALTH_REMINDER_ENABLED và Today prerequisites theo runtime contract;
   EMAIL_DELIVERY_MODE không disabled nếu chủ động cho phép gửi thật.
6. Log cron tick tổng hợp cho biết eligible,excluded,claim,sent,failed và skip reasons;
   không đưa payload khách vào report. Provider accepted không chứng minh inbox delivered.

## Backfill optional

Không cần chạy ngay. Nếu yêu cầu, tạo dry-run riêng có đúng database, fixed cohort,
counts và fingerprint. Chỉ áp dụng null/missing theo danh sách đã duyệt bằng CAS;
không overwrite explicit assigned orders. Backup/rollback và lịch sử audit đầy đủ.
Không dùng email string trong trainerId. Không sửa contract/checkin lịch sử để
giả như trước đây đã có assignment.

## Theo dõi email sau rollout

Khung07:00–08:59 Asia/Ho_Chi_Minh; initial tick20s rồi10phút. Khách phải opt-in,
role user, active coaching/effective coach hợp lệ và chưa submitted journal.
Không tự gửi bù ngày cũ. Nếu server free sleep, cần giải pháp scheduler/uptime
riêng có phê duyệt; resolver không chữa được thời gian server dừng.

## Rollback

Không đổi lại trainerId đã ghi trên đơn mới bằng rollback code. Old code có thể
không hỗ trợ admin assigned ở vài consumer: rollback mixed-version phải đánh giá
riêng. Không restore whole database để sửa lỗi deployment. Tạm dừng reminder
bằng flag chỉ khi có authority nếu phát hiện gửi sai/duplicate; giữ ledger điều tra.
