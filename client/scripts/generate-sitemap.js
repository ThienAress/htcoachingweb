import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = "https://htcoachingweb.onrender.com/api";
const SITE_URL = "https://htcoachingweb.io.vn";

const staticRoutes = [
  { url: "/", priority: 1.0, changefreq: "weekly" },
  { url: "/ket-qua-khach-hang", priority: 0.9, changefreq: "weekly" },
  { url: "/club", priority: 0.8, changefreq: "monthly" },
  { url: "/exercises", priority: 0.8, changefreq: "monthly" },
  { url: "/tdee-calculator", priority: 0.7, changefreq: "yearly" },
  { url: "/mealplan", priority: 0.7, changefreq: "yearly" },
];

async function generateSitemap() {
  try {
    console.log("Generating sitemap...");
    
    let dynamicRoutes = [];
    try {
      // Fetch public customer stories
      const res = await axios.get(`${API_URL}/customer-stories?limit=100`);
      const stories = res.data?.data || [];
      
      dynamicRoutes = stories.map(story => ({
        url: `/ket-qua-khach-hang/${story.slug}`,
        priority: 0.8,
        changefreq: "monthly",
      }));
      console.log(`Fetched ${dynamicRoutes.length} customer stories for sitemap.`);
    } catch (err) {
      console.error("Failed to fetch customer stories for sitemap:", err.message);
      // Tiếp tục sinh sitemap với các route tĩnh nếu lỗi API
    }

    const allRoutes = [...staticRoutes, ...dynamicRoutes];

    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allRoutes
  .map(
    (route) => `  <url>
    <loc>${SITE_URL}${route.url}</loc>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

    // Đảm bảo thư mục public tồn tại
    const publicDir = path.resolve(__dirname, '../public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const sitemapPath = path.join(publicDir, 'sitemap.xml');
    fs.writeFileSync(sitemapPath, sitemapContent, 'utf8');
    
    console.log(`Sitemap generated successfully at ${sitemapPath}`);
  } catch (error) {
    console.error("Error generating sitemap:", error);
    process.exit(1);
  }
}

generateSitemap();
