# Motion debt baseline — 2026-08-11

## Kết luận

ChatWidget pilot không còn `transition-all`/`transition: all`. Phần còn lại của client có **226 production matches**
trên **68 files**. Đây là inventory để review theo interaction, không phải yêu cầu bulk replace và không đồng nghĩa mọi
match đều là bug.

## Phân bố

| Khu vực | Số file |
| --- | ---: |
| `pages/` | 44 |
| `sections/` | 12 |
| `components/` | 8 |
| `layouts/` | 3 |
| `index.css` | 1 |

Các file có mật độ cao nhất tại thời điểm đo:

- `pages/trainer/TrainerCoaching.jsx`: 22
- `pages/Blog.jsx`: 14
- `pages/account/components/ProfileTab.jsx`: 14
- `sections/Header/Header.jsx`: 11
- `pages/TrainerProfile.jsx`: 11
- `sections/Pricing.jsx`: 11
- `sections/Footer/Footer.jsx`: 10

## Cách xử lý

1. Ưu tiên product surfaces và interaction lặp lại thường xuyên trước brand/landing entrance.
2. Khi sửa một surface, xác định property thực sự đổi rồi thay bằng explicit transition; không rewrite cơ học toàn repo.
3. Trong cùng PR/task, kiểm tra reduced motion, pointer capability, keyboard/focus và visual desktop/mobile.
4. Dùng ChatWidget pilot và `ui-quality` motion discipline làm contract tham chiếu.

## Lệnh tái tạo baseline

```powershell
rg -n 'transition-all|transition:\s*all' client/src `
  --glob '*.js' --glob '*.jsx' --glob '*.ts' --glob '*.tsx' --glob '*.css'
```

Loại các file dưới `__tests__/` khi tính production matches.
