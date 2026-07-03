import puppeteer from 'puppeteer';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5174; // Port tạm thời để prerender
const DIST_DIR = path.resolve(__dirname, '../dist');

// Danh sách các route cần prerender (các route SEO quan trọng)
const routesToPrerender = [
  '/',
  '/ket-qua-khach-hang',
  '/blog',
  '/club',
  '/exercises',
  '/tdee-calculator',
  '/mealplan'
];

async function prerender() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('Error: "dist" folder not found. Please run "npm run build" first.');
    process.exit(1);
  }

  // Khởi tạo server tĩnh cho thư mục dist
  const app = express();
  
  // Xử lý SPA fallback (chuyển mọi route về index.html để CSR tiếp quản nếu route không tồn tại)
  app.use(express.static(DIST_DIR));
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });

  const server = app.listen(PORT, async () => {
    console.log(`Prerender server running at http://localhost:${PORT}`);
    let browser;
    
    try {
      browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      for (const route of routesToPrerender) {
        console.log(`Prerendering route: ${route}`);
        const page = await browser.newPage();
        
        // Chờ đến khi network idle (không còn request nào tải) để đảm bảo JS/API đã chạy xong
        await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle0' });

        // Lấy nội dung HTML đã được render
        const html = await page.content();

        // Tạo thư mục nếu route có depth > 1 (ví dụ /ket-qua-khach-hang -> dist/ket-qua-khach-hang)
        const routePath = route === '/' ? DIST_DIR : path.join(DIST_DIR, route);
        if (route !== '/') {
          if (!fs.existsSync(routePath)) {
            fs.mkdirSync(routePath, { recursive: true });
          }
        }

        const filePath = path.join(routePath, 'index.html');
        fs.writeFileSync(filePath, html, 'utf8');
        console.log(`Saved: ${filePath}`);
        
        await page.close();
      }
      
      console.log('Prerendering completed successfully.');
    } catch (err) {
      console.error('Error during prerendering:', err);
    } finally {
      if (browser) await browser.close();
      server.close();
    }
  });
}

prerender();
