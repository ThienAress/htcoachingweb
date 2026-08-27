# Quy định JSON hướng dẫn và độ phức tạp kỹ thuật bài tập

## File cần bàn giao

Mỗi lần bàn giao trả về một file JSON duy nhất, mã hóa UTF-8, theo
`schemaVersion: 1`. File chỉ
chứa những bài đã nghiên cứu xong. Không thêm bài chưa hoàn tất với
`"instructions": []` vì thao tác import sẽ thay dữ liệu hiện có.

Hệ thống ghép bài tập bằng `name` chính xác sau khi bỏ khoảng trắng đầu/cuối và
vẫn phân biệt chữ hoa/chữ thường. Vì vậy, phải sao chép nguyên tên từ file danh
sách production, không dịch, viết lại hoặc sửa dấu câu.

## Cấu trúc bắt buộc

```json
{
  "schemaVersion": 1,
  "exercises": [
    {
      "name": "Barbell Back Squat",
      "instructions": [
        {
          "title": "Chuẩn bị giá đỡ",
          "description": "Đặt thanh đòn trên giá ở độ cao ngang phần trên ngực và lắp chốt an toàn phù hợp."
        },
        {
          "title": "Vào vị trí gánh tạ",
          "description": "Bước dưới thanh đòn, đặt thanh ổn định trên cơ cầu vai, giữ cổ tay trung lập và siết chắc thân người."
        }
      ],
      "technicalDifficulty": {
        "coordination": 1,
        "stability": 2,
        "mobility": 1,
        "setup": 2,
        "errorConsequence": 2,
        "rationale": "Bài đa khớp, cần giá đỡ và chốt an toàn; lỗi kỹ thuật dưới tải có hậu quả cao."
      }
    }
  ]
}
```

Không thêm `exerciseId`, `description`, `imageUrl`, `videoUrl`, `muscleGroup`,
điểm đánh giá cộng đồng hoặc field nào khác. Importer chỉ cập nhật
`instructions` và `technicalDifficulty`; mọi dữ liệu còn lại được giữ nguyên.

## Quy định cho từng bước setup

- Mỗi bài phải có từ 1 đến 30 bước; khuyến nghị 3–8 bước có thứ tự thực hiện.
- Mỗi bước phải có đủ `title` và `description`.
- `title`: ngắn gọn, mô tả đúng hành động, tối đa 160 ký tự.
- `description`: hướng dẫn cụ thể, có thể thực hiện được, từ 1 đến 2.000 ký tự.
- Bao quát khi phù hợp: chuẩn bị thiết bị, chỉnh máy/ghế, vị trí chân/tay, gồng
  thân người, thực hiện, nhịp thở, trở về vị trí và cách kết thúc an toàn.
- Không đưa sets, reps, mức tạ cá nhân, RPE/RIR, chẩn đoán hoặc nội dung quảng cáo.

## Độ phức tạp kỹ thuật

Chấm đủ năm tiêu chí dưới đây. Mỗi tiêu chí bắt buộc là số nguyên `0`, `1` hoặc
`2`. Đây là độ phức tạp khi thực hiện đúng kỹ thuật, không phải mức nặng, độ mệt
hoặc độ phù hợp với một người cụ thể.

### 1. `coordination` — Phối hợp kỹ thuật

- `0`: động tác đơn giản, ít khớp hoặc trình tự gần như tự nhiên.
- `1`: cần phối hợp nhiều khớp hoặc ghi nhớ một số điểm kỹ thuật theo thứ tự.
- `2`: phối hợp toàn thân/phức tạp, timing hoặc đường đi đòi hỏi kỹ năng cao.

### 2. `stability` — Thăng bằng và ổn định

- `0`: cơ thể hoặc thiết bị được hỗ trợ ổn định, yêu cầu thăng bằng thấp.
- `1`: cần chủ động giữ core, trục khớp hoặc thăng bằng ở mức vừa.
- `2`: yêu cầu ổn định cao, ít điểm tựa, tải tự do hoặc mất thăng bằng dễ làm sai bài.

### 3. `mobility` — Mobility và biên độ vận động

- `0`: biên độ thông thường, ít đòi hỏi mobility đặc biệt.
- `1`: cần mobility tốt ở một vùng hoặc kiểm soát biên độ tương đối lớn.
- `2`: cần mobility cao ở nhiều khớp/vùng để vào đúng vị trí và giữ kỹ thuật.

### 4. `setup` — Setup và thiết bị

- `0`: không cần thiết bị hoặc chuẩn bị rất đơn giản.
- `1`: cần chỉnh một số vị trí, mức hỗ trợ hoặc dụng cụ trước khi tập.
- `2`: setup nhiều bước/thiết bị, cần chốt an toàn, spotter hoặc kiểm tra kỹ trước khi thực hiện.

### 5. `errorConsequence` — Hậu quả khi sai

- `0`: dễ tự dừng, lỗi nhỏ thường có hậu quả thấp.
- `1`: lỗi có thể gây mất kiểm soát hoặc tăng nguy cơ khó chịu/chấn thương ở mức vừa.
- `2`: lỗi kỹ thuật dưới tải/vị trí bất lợi có hậu quả cao hoặc khó tự thoát an toàn.

`rationale` là giải thích ngắn, không bắt buộc, tối đa 1.000 ký tự. Nên nêu lý do
cho các tiêu chí chấm `2` hoặc trường hợp dễ gây tranh luận.

Hệ thống tự quy đổi tổng điểm thành sao:

| Tổng năm tiêu chí | Độ phức tạp kỹ thuật |
|---:|---:|
| 0–1 | 1 sao |
| 2–3 | 2 sao |
| 4–5 | 3 sao |
| 6–7 | 4 sao |
| 8–10 | 5 sao |

## Quy tắc JSON và kiểm tra trước khi gửi

- JSON phải hợp lệ: dùng dấu ngoặc kép, không comment, không dấu phẩy thừa.
- Không để tên bài trùng nhau trong cùng file.
- Không thêm field ngoài schema; typo trong tên field sẽ làm toàn file bị từ chối.
- File tối đa 8MB và tối đa 2.000 bài tập.
- Có thể chia tiến độ thành nhiều file; mỗi file chỉ chứa các bài đã hoàn tất.
- Mở file bằng JSON validator trước khi gửi.
- Sau khi upload, Admin phải bấm `Xem trước`. Chỉ khi tất cả tên khớp mới có thể
  bấm `Xác nhận cập nhật`.
