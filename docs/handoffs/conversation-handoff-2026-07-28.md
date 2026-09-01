# HTCOACHINGWEB - TOM TAT BAN GIAO CUOC TRO CHUYEN

> Cap nhat ngay 28/07/2026. Noi dung nay tong hop chuoi cong viec da hoan thanh den lan deploy commit `4059cfe` ngay 25/07/2026. Worktree hien tai co cac thay doi moi chua commit va khong nam trong snapshot nay.

## 1. Boi canh du an

- Repository: `ThienAress/htcoachingweb`.
- Workspace local: duong dan cu the da duoc redact khoi tai lieu ban giao.
- Frontend: React 19, Vite, deploy tren Netlify.
- Backend: Express 5, Mongoose/MongoDB, deploy tren Render.
- Database production: MongoDB Atlas.
- Quy trinh trien khai: phat trien va kiem tra tren `staging`, sau do merge/push sang `main`.
- Chu du an lam solo; email quan ly da duoc redact khoi tai lieu ban giao.

## 2. Muc tieu audit ban dau

Da audit sau codebase ve:

- Bao mat va tinh on dinh.
- React rendering performance.
- Server-side data integrity.
- AI/knowledge base.
- Blog, recipe va customer stories.
- Check-in va coaching content.
- MongoDB models/indexes.
- Unit, integration va E2E.
- CI/CD, monitoring, alerting va production readiness.
- SEO, sitemap va prerender.

Bao cao audit va sua loi theo phase duoc luu trong thu muc `docs/`.

## 3. Cac phase da xu ly

Da trien khai lien tuc cac phase 1 den 10, sau do mo rong them cac buoc production readiness:

- Va cac van de bao mat, validation, ownership/IDOR va data integrity.
- Cai thien AI/knowledge base va Gemini adapter.
- Them bounded retry cho AI va health check.
- Bo sung error state cho Recipe UI.
- Sua Recipe API production tung tra `404`.
- Toi uu va kiem tra blog, recipe, check-in va coaching content.
- Review model indexes va transaction safety.
- Mo rong E2E sang Chromium, Firefox va WebKit.
- Them monitoring, production smoke, staging health va security workflows.
- Chuan bi release checklist, rollback runbook va production smoke commands.

## 4. Git va du lieu repository

Da xu ly:

- Loai `current_kb_entries.txt` khoi local va Git theo xac nhan cua user.
- File tren tung chua chuoi dung cho Google Search Console; van duoc xoa vi da lo push len Git va user xac nhan khong can giu trong repository.
- Untrack va xoa 51 file test trong `server/uploads`; user xac nhan khong con su dung.
- Chay secret scanner va repository data-boundary scanner.
- Bao toan luong lon thay doi local bang snapshot va commit co to chuc.
- Khong force-push hoac rewrite lich su repository.
- GitHub cached refs cu duoc xac dinh la van de can GitHub Support xu ly, khong dung thao tac pha lich su repository.

## 5. Staging

Da thiet lap va kiem tra:

- Frontend staging tren Netlify.
- Backend staging tren Render.
- Database staging tach khoi production, dung `htcoaching_staging`.
- User da authorize Netlify CLI va Render.
- User dong y truyen staging secrets sang Render.
- Staging dung de thu tinh nang, bao mat, toi uu va migration truoc production.
- Blog/recipe thieu o staging la do staging DB tach biet, khong tu dong bo lien tuc tu production.
- Sao chep production sang staging chi la snapshot tai thoi diem chay; du lieu phat sinh sau do khong tu copy.

## 6. Alert va monitoring

Da cau hinh:

- GitHub Actions production monitoring.
- `Staging Health and Security` workflow.
- Read-only production smoke.
- Bounded retry cho Render cold start.
- Security check dung `if: always()` de van chay khi health timeout.
- User da xac nhan nhan duoc email alert.
- Cac email `Staging Health and Security failed` truoc day phan lon thuoc commit cu va cold-start timeout.
- Production Monitor trong lich su da chay thanh cong.
- Workflow moi tren commit production cuoi da chay thanh cong.

## 7. Database va du lieu that

Nguyen tac xuyen suot:

- Moi thao tac can thiep du lieu that phai hoi user truoc.
- User cho phep xoa du lieu F1/khach hang test vi khong can giu lai.
- Da dung backup/snapshot truoc cac thao tac co rui ro.
- Backup la diem rollback, khong phai dau hieu code chac chan co loi.
- Local duoc tach khoi database `gym-app` de tranh vo tinh ghi sai moi truong.
- Da cai thien thu tu transaction trong order deletion va F1 privacy lifecycle, tranh chay cac MongoDB operation song song trong transaction.

## 8. Auth production

Production tung gap:

```text
Google login fail: Khong co token
```

Da dieu tra va sua topology/configuration Google OAuth. Sau do:

- User xac nhan Google login production da hoat dong.
- Cac chuc nang production duoc kiem tra thuc te va hoat dong tot.
- Production smoke xac nhan Google OAuth start tra redirect hop le `302`.

## 9. Dependency, test va CI

Da thuc hien:

- Review dependency advisory o client va server.
- Nang cap dependency can thiet.
- Them dependency audit policy va tests.
- Client con mot advisory React Router lien quan RSC duoc waiver co pham vi vi du an khong dung RSC.
- Server dependency audit khong con advisory can waiver.
- Secret scan: PASS.
- Repository data-boundary scan: 0 violation.
- Client lint: PASS.
- Client tests: 101 tests PASS.
- Server tests: 158 tests PASS.
- Ops/policy tests: 11 tests PASS.
- E2E Chromium, Firefox va WebKit: 138/138 PASS.
- Client production build va prerender: PASS.
- Canh bao chunk lon cua Vite con ton tai nhung bundle budget van PASS.
- Co canh bao Mongoose `validateSync` lien quan Mongoose 10, chua gay fail.

## 10. Netlify va Puppeteer

Netlify tung bao Puppeteer khong tim thay Chrome khi chay `scripts/prerender.js`.

Da dieu chinh dependency/build setup de Netlify co browser can thiet. Ket qua:

- Production build chay thanh cong.
- Prerender hoan thanh 83/83 routes.
- Netlify production phuc vu ban sitemap moi thanh cong.

## 11. SEO va sitemap

Van de ban dau:

- Google Search Console dang xac thuc 19 URL `Da phat hien thay, hien chua duoc lap chi muc`.
- Xac thuc bat dau ngay 23/07; chua cap nhat sau hai ngay la binh thuong vi Google can thoi gian crawl va reprocess.
- Sitemap tung chi co mot phan recipe do dynamic route fetch chi lay page dau.

Phuong an da chon:

- Giu mot `sitemap.xml` day du o quy mo hien tai.
- Them pagination khi lay Recipe API de dua toan bo recipe public vao sitemap.
- Chua can tach `sitemap-recipes.xml` vi tong URL va file size con rat nho so voi gioi han sitemap.
- Co the chuyen sang sitemap index khi URL tang lon dang ke.

Ket qua production:

- Tong URL: `780`.
- Recipe URL: `747`.
- Unique URL: `780`.
- Khong co URL trung.
- Sitemap production va ban build khop nhau.
- Prerender van gioi han hop ly o 83 routes, khong prerender ca 747 recipe.

## 12. Bon commit production cuoi

```text
e6752c3 chore(codex): migrate project guidance to skills
7cae9d4 fix(ci): harden dependency and staging checks
d124854 fix(f1): stabilize lifecycle and transaction operations
4059cfe fix(seo): include all published recipes in sitemap
```

Noi dung chinh:

- Chuyen project guidance sang `.agents/skills/<skill>/SKILL.md`.
- Them `AGENTS.md` va `.agents/reference/project-guide.md`.
- Hardening CI, dependency policy va staging health.
- Sua F1 wizard, transaction order va E2E stability.
- Dua toan bo published recipes vao sitemap.

## 13. Trang thai Git tai moc ban giao 25/07

Da thuc hien:

```text
git merge --ff-only fix/production-auth-and-data-migration
git push origin main
```

Ket qua tai thoi diem do:

- `main` duoc fast-forward, khong tao merge commit.
- Push thanh cong tu `da0214b` len `4059cfe`.
- Local `main` va `origin/main` cung SHA `4059cfeb713bb6f28c966b79fa9a2044260bc705`.
- Divergence: `0 0`.
- Worktree sach tai thoi diem ban giao 25/07.

Luu y: ngay 28/07, workspace da co them nhieu thay doi chua commit. Can review rieng cac thay doi nay; khong duoc suy luan worktree hien tai van sach.

## 14. CI va production sau push

GitHub Actions run:

```text
CI run ID: 30154455344
Commit: 4059cfe
Conclusion: success
```

Tat ca job deu thanh cong:

- `client`: success.
- `server`: success.
- `secrets`: success.
- `e2e`: success.

Production smoke sau deploy PASS:

- Client document.
- Web manifest.
- API liveness va readiness.
- Google OAuth topology.
- Blog list/detail API.
- Recipe list/detail API.
- Recipe taxonomy API.
- Dynamic sitemap.

## 15. Viec nen lam tiep

1. Review toan bo thay doi chua commit phat sinh sau moc `4059cfe` truoc khi merge hoac deploy tiep.
2. Theo doi Google Search Console them 1-3 tuan, khong gui xac thuc lap lai lien tuc.
3. Theo doi scheduled `Staging Health and Security` de xac nhan bounded retry da giam false alarm.
4. Kiem tra Netlify va Render dashboard de xac nhan deploy SHA mong muon.
5. Theo doi 5xx, latency, API readiness va integrity metrics.
6. Lap backlog rieng cho canh bao Mongoose 10 va toi uu Vite chunks lon.
7. Chi tach sitemap index hoac `sitemap-recipes.xml` khi so URL/file size tang dang ke.
8. Truoc lan push tiep theo, chay `$pre-deploy` hoac `$ship`; tat ca gate phai PASS moi deploy.

## 16. Diem bat dau cho cuoc tro chuyen moi

Moc production da xac nhan on dinh la commit `4059cfe`: CI xanh, production smoke xanh va sitemap production co du 747 recipe URL. Tuy nhien, workspace ngay 28/07 da co cong viec moi chua commit. Cuoc tro chuyen moi nen bat dau bang `git status`, review diff hien tai, xac dinh muc tieu cua cac thay doi moi va tuyet doi khong reset/revert chung.
