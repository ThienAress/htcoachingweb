import puppeteer from 'puppeteer';
import express from 'express';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5174; // Port tạm thời để prerender
const DIST_DIR = path.resolve(__dirname, '../dist');
const API_URL = "https://htcoachingweb.onrender.com/api";

// Danh sách các route tĩnh cơ bản
const staticRoutes = [
  '/',
  '/ket-qua-khach-hang',
  '/blog',
  '/club',
  '/exercises',
  '/tdee-calculator',
  '/mealplan'
];

async function fetchDynamicRoutes() {
  const dynamicRoutes = [];
  try {
    console.log('Fetching dynamic routes from API...');
    
    // 1. Customer Stories
    const storiesRes = await axios.get(`${API_URL}/customer-stories?limit=100`);
    const stories = storiesRes.data?.data || [];
    stories.forEach(s => dynamicRoutes.push(`/ket-qua-khach-hang/${s.slug}`));
    
    // 2. Trainers
    const trainersRes = await axios.get(`${API_URL}/trainers`);
    const trainers = trainersRes.data?.data || trainersRes.data || [];
    trainers.filter(t => t.slug).forEach(t => dynamicRoutes.push(`/huan-luyen-vien/${t.slug}`));
    
    // 3. Blogs
    const blogRes = await axios.get(`${API_URL}/blog?limit=100`);
    const posts = blogRes.data?.data || [];
    posts.forEach(p => dynamicRoutes.push(`/blog/${p.slug}`));

    console.log(`Fetched ${dynamicRoutes.length} dynamic routes.`);
  } catch (err) {
    console.error('Warning: Failed to fetch some dynamic routes for prerender:', err.message);
  }
  return dynamicRoutes;
}

async function prerender() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('Error: "dist" folder not found. Please run "npm run build" first.');
    process.exit(1);
  }

  const dynamicRoutes = await fetchDynamicRoutes();
  const routesToPrerender = [...staticRoutes, ...dynamicRoutes];

  // Khởi tạo server tĩnh cho thư mục dist
  const app = express();
  
  // Xử lý SPA fallback (chuyển mọi route về index.html để CSR tiếp quản nếu route không tồn tại)
  app.use(express.static(DIST_DIR));
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });

  const server = app.listen(PORT, async () => {
    console.log(`Prerender server running at http://localhost:${PORT}`);
    console.log(`Total routes to prerender: ${routesToPrerender.length}`);
    
    let browser;
    
    try {
      browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      for (const route of routesToPrerender) {
        console.log(`Prerendering route: ${route}`);
        const page = await browser.newPage();
        
        // Tối ưu Network Interception: Chặn tải tài nguyên không cần thiết cho SEO
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const resourceType = req.resourceType();
          if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
            req.abort();
          } else {
            req.continue();
          }
        });
        
        try {
          // Chờ đến khi network idle 2 và đảm bảo React mount xong (id root)
          await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle2', timeout: 30000 });
          await page.waitForSelector('#root', { timeout: 10000 });
          
          // Chờ thêm 1 chút xíu để đảm bảo component con bên trong render data xong
          await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
          console.warn(`Timeout/Warning rendering ${route}: ${e.message}`);
        }

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
