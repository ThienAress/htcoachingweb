# SEO evidence modes

SEO audit phải ghi mode cho từng kết luận. Một mode không được giả làm bằng chứng của mode khác.

## Static

Đọc App routes, `<SEO>` props, JSON-LD source, internal links, sitemap generator, prerender list, robots và llms files.
Static evidence chứng minh code/config tồn tại, không chứng minh DOM cuối hoặc production response.

## Rendered

Dùng browser chạy trang để kiểm tra final `<title>`, meta description, canonical, robots và
`script[type="application/ld+json"]`. Kiểm tra navigation, mobile overflow, image dimensions/loading và console/network.
Không kết luận “thiếu schema” từ `curl`/text fetch vì tool có thể bỏ script hoặc không chạy JavaScript.

## Live

Chỉ dùng khi target và credential/data source đã xác định:

- HTTP status, redirect chain/loop, canonical destination và soft-404 behavior.
- PageSpeed/lab và field Core Web Vitals: LCP, INP, CLS; ghi rõ nguồn/thời điểm/device.
- GSC index/coverage/query/page và GA4 landing/conversion khi đã cấu hình.
- Cannibalization chỉ khi nhiều canonical page cạnh tranh cùng query/topic với dữ liệu đủ; không suy từ keyword giống nhau.
- E-E-A-T/content review: author/source, first-hand evidence, claim accuracy, freshness và internal topical links.

Thiếu live credential hoặc production target phải ghi `SKIP`/`BLOCKED`, không đổi thành PASS/FAIL. Không đưa raw query,
user identifier hoặc analytics export vào report repo-native.
