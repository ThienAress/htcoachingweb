import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "../..");

// Load .env.development trước (nếu có), sau đó .env làm fallback
// dotenv không ghi đè biến đã tồn tại → dev values được ưu tiên
dotenv.config({ path: path.resolve(root, ".env.development") });
dotenv.config({ path: path.resolve(root, ".env") });

console.log("🔧 ENV loaded →", {
  NODE_ENV: process.env.NODE_ENV,
  CLIENT_URL: process.env.CLIENT_URL,
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
});
