# SEO indexing remediation evidence — 2026-08-10

## Scope and evidence mode

Mục tiêu là sửa hai tín hiệu kỹ thuật đã xác nhận: sitemap tăng lên 785 URL sau khi công bố 747 recipe legacy và
unknown URL bị broad SPA fallback trả homepage HTTP 200. Báo cáo này chỉ có bằng chứng `static`; `rendered` và `live`
được ghi rõ là chưa chạy, không được suy diễn thành Google đã lập chỉ mục.

## Eight-step status

1. **True 404 — static PASS**: `client/public/404.html` có `noindex`; `_redirects` kết thúc bằng `/* /404.html 404`.
2. **Scoped SPA rewrite — static PASS**: chỉ route app/auth/admin/trainer đã biết được rewrite tới `index.html 200`;
   không còn `/* /index.html 200`.

Thiết kế này dựa trên [Netlify rewrite shadowing](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/):
static prerendered files được ưu tiên khi rule không dùng force, còn rewrite `200` toàn cục sẽ biến mọi URL thành SPA shell.
3. **Split sitemap — static PASS**: `sitemap.xml` là sitemap index; child files tách core, content và recipes.
4. **Không submit toàn bộ recipe — static PASS**: recipe sitemap có 30 URL thay vì 747 URL.
5. **Curate 20–50 recipe — static PASS về contract**: production strict build chấm điểm nội dung và chọn tối đa 30;
   release fail nếu ít hơn 20 recipe đạt gate tên, ảnh, ít nhất 3 nguyên liệu và 2 bước. Snapshot local fallback chỉ bảo đảm
   bound 30 vì không có payload chi tiết live.
6. **Giá trị riêng — static PARTIAL**: trang detail giữ nguyên nguyên liệu, hướng dẫn và internal links; bổ sung nguồn tham
   khảo an toàn cùng `isBasedOn`. Macro, khẩu phần chuẩn hóa và HLV review không tồn tại trong schema hiện tại nên được
   defer, không bịa dữ liệu hoặc mở schema change trong hotfix.
7. **URL tests — static PASS / rendered SKIP**: config bảo vệ URL app hợp lệ và final 404; toàn bộ 747 recipe public vẫn
   nằm trong internal prerender manifest để direct URL hợp lệ không bị biến thành 404 chỉ vì không có trong sitemap.
8. **GSC validation — live SKIP**: chưa deploy và phiên hiện tại không có quyền GSC property. Chỉ bấm Validate sau khi
   production HTTP checks xác nhận URL tốt 200/canonical đúng, URL giả 404 và URL đã xóa 404/410.

## Static counts

| Artifact | URLs |
|---|---:|
| Sitemap index children | 3 |
| Core sitemap | 9 |
| Blog/story/trainer content sitemap | 29 |
| Curated recipe sitemap | 30 |
| Total URL submitted through child sitemaps | 68 |
| Local offline-fallback prerender manifest | 68 |
| Strict production prerender contract | Tất cả public URL fetched; với snapshot hiện tại dự kiến 785 |
| Recipe detail routes retained in strict production | Tất cả public recipes; snapshot hiện tại dự kiến 747 |

## Post-deploy live gate

- Check one core page, one blog/story page and three curated recipes: HTTP 200, one self-canonical, meaningful title/body.
- Check one published but non-submitted recipe: HTTP 200 and correct recipe content.
- Check one fake recipe slug, one fake blog slug and one arbitrary path: true HTTP 404, no homepage canonical.
- Check a known deleted URL: HTTP 404 or 410.
- Resubmit only `sitemap.xml`, then validate the GSC issue after Google observes the new HTTP behavior.
