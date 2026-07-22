import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL =
  process.env.SITEMAP_API_URL ||
  process.env.VITE_API_URL ||
  "https://htcoachingweb.onrender.com/api";
const SKIP_DYNAMIC_ROUTES = process.env.SKIP_DYNAMIC_ROUTES === "true";
const REQUIRE_DYNAMIC_ROUTES =
  process.env.REQUIRE_DYNAMIC_ROUTES === "true";
const fetchApi = (pathName) =>
  SKIP_DYNAMIC_ROUTES
    ? Promise.resolve({ data: { data: [] } })
    : axios.get(`${API_URL}${pathName}`, { timeout: 10000 });
const SITE_URL = "https://htcoachingweb.io.vn";
const today = new Date().toISOString().split('T')[0];

const staticRoutes = [
  { url: "/", priority: 1.0, changefreq: "weekly", lastmod: today },
  { url: "/ket-qua-khach-hang", priority: 0.9, changefreq: "weekly", lastmod: today },
  { url: "/blog", priority: 0.9, changefreq: "weekly", lastmod: today },
  { url: "/cong-thuc-nau-an", priority: 0.8, changefreq: "weekly", lastmod: today },
  { url: "/club", priority: 0.8, changefreq: "monthly", lastmod: today },
  { url: "/exercises", priority: 0.8, changefreq: "monthly", lastmod: today },
  { url: "/tdee-calculator", priority: 0.7, changefreq: "yearly", lastmod: today },
  { url: "/mealplan", priority: 0.7, changefreq: "yearly", lastmod: today },
];

async function generateSitemap() {
  try {
    console.log("Generating sitemap...");
    let fetchFailures = 0;
    let dynamicRoutes = [];
    try {
      // Fetch public customer stories
      const res = await fetchApi("/customer-stories?limit=100");
      const stories = res.data?.data || [];
      
      dynamicRoutes = stories.map(story => ({
        url: `/ket-qua-khach-hang/${story.slug}`,
        priority: 0.8,
        changefreq: "monthly",
        lastmod: story.updatedAt ? new Date(story.updatedAt).toISOString().split('T')[0] : today,
      }));
      console.log(`Fetched ${dynamicRoutes.length} customer stories for sitemap.`);
    } catch (err) {
      fetchFailures += 1;
      console.error("Failed to fetch customer stories for sitemap:", err.message);
    }

    // Fetch trainer profiles
    let trainerRoutes = [];
    try {
      const res = await fetchApi("/trainers");
      const trainers = res.data?.data || res.data || [];
      
      trainerRoutes = trainers
        .filter(t => t.slug)
        .map(trainer => ({
          url: `/huan-luyen-vien/${trainer.slug}`,
          priority: 0.8,
          changefreq: "monthly",
          lastmod: trainer.updatedAt ? new Date(trainer.updatedAt).toISOString().split('T')[0] : today,
        }));
      console.log(`Fetched ${trainerRoutes.length} trainer profiles for sitemap.`);
    } catch (err) {
      fetchFailures += 1;
      console.error("Failed to fetch trainers for sitemap:", err.message);
    }

    // Fetch blog posts
    let blogRoutes = [];
    try {
      const res = await fetchApi("/blog?limit=50");
      const posts = res.data?.data || [];
      
      blogRoutes = posts.map(post => ({
        url: `/blog/${post.slug}`,
        priority: 0.7,
        changefreq: "monthly",
        lastmod: post.updatedAt ? new Date(post.updatedAt).toISOString().split('T')[0] : today,
      }));
      console.log(`Fetched ${blogRoutes.length} blog posts for sitemap.`);
    } catch (err) {
      fetchFailures += 1;
      console.error("Failed to fetch blog posts for sitemap:", err.message);
    }

    // Fetch recipes
    let recipeRoutes = [];
    try {
      const res = await fetchApi("/recipes?limit=500");
      const recipes = res.data?.data || [];

      recipeRoutes = recipes.map(recipe => ({
        url: `/cong-thuc-nau-an/${recipe.slug}`,
        priority: 0.7,
        changefreq: "monthly",
        lastmod: recipe.updatedAt ? new Date(recipe.updatedAt).toISOString().split('T')[0] : today,
      }));
      console.log(`Fetched ${recipeRoutes.length} recipes for sitemap.`);
    } catch (err) {
      fetchFailures += 1;
      console.error("Failed to fetch recipes for sitemap:", err.message);
    }

    const publicDir = path.resolve(__dirname, '../public');
    const sitemapPath = path.join(publicDir, 'sitemap.xml');
    if (fetchFailures > 0 && !SKIP_DYNAMIC_ROUTES) {
      if (REQUIRE_DYNAMIC_ROUTES) {
        throw new Error(
          `Failed to fetch ${fetchFailures} dynamic sitemap source(s)`,
        );
      }
      if (fs.existsSync(sitemapPath)) {
        const existing = fs.readFileSync(sitemapPath, "utf8");
        const existingRouteCount = (existing.match(/<loc>/g) || []).length;
        if (existingRouteCount > staticRoutes.length) {
          console.warn(
            `Preserving existing sitemap with ${existingRouteCount} routes because ${fetchFailures} dynamic source(s) failed.`,
          );
          return;
        }
      }
    }

    const allRoutes = [...staticRoutes, ...dynamicRoutes, ...trainerRoutes, ...blogRoutes, ...recipeRoutes];

    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allRoutes
  .map(
    (route) => `  <url>
    <loc>${SITE_URL}${route.url}</loc>
    <lastmod>${route.lastmod || today}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

    // Đảm bảo thư mục public tồn tại
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    fs.writeFileSync(sitemapPath, sitemapContent, 'utf8');
    
    console.log(`Sitemap generated successfully at ${sitemapPath}`);
  } catch (error) {
    console.error("Error generating sitemap:", error);
    process.exit(1);
  }
}

generateSitemap();
