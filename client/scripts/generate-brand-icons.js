import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

// Offline conversion only: geometry and colors remain the supplied designer artwork.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "public/branding/ht-v2");
const outputDir = path.join(root, "public/favicon/ht-v2");
const color = await fs.readFile(path.join(sourceDir, "ht-mark-color.svg"), "utf8");
const onDark = await fs.readFile(path.join(sourceDir, "ht-mark-on-dark.svg"), "utf8");
const iconSvg = onDark.replace(/(<svg[^>]*>)/, '$1<rect width="1000" height="1000" fill="#111111"/>');
const maskable = await fs.readFile(path.join(sourceDir, "ht-app-icon-maskable-black-1024.png"));
const svgUrl = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
const maskUrl = `data:image/png;base64,${maskable.toString("base64")}`;

function makeIco(entries) {
  const header = Buffer.alloc(6 + 16 * entries.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  let offset = header.length;
  entries.forEach(({ size, png }, index) => {
    const entry = 6 + 16 * index;
    header[entry] = size;
    header[entry + 1] = size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...entries.map(({ png }) => png)]);
}

const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (request) => request.url().startsWith("data:") || request.url() === "about:blank"
    ? request.continue() : request.abort());
  const render = async (url, size, background = null) => {
    const result = await page.evaluate(async ({ url, size, background }) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const context = canvas.getContext("2d");
      if (background) {
        context.fillStyle = background;
        context.fillRect(0, 0, size, size);
      }
      context.drawImage(image, 0, 0, size, size);
      const { data } = context.getImageData(0, 0, size, size);
      let outsideSafeCircle = 0;
      let transparentPixels = 0;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const index = 4 * (y * size + x);
        if (data[index + 3] < 255) transparentPixels++;
        const foreground = Math.max(data[index], data[index + 1], data[index + 2]) > 40;
        if (foreground && Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) > size * 0.4) outsideSafeCircle++;
      }
      return { png: canvas.toDataURL("image/png").split(",")[1], outsideSafeCircle, transparentPixels };
    }, { url, size, background });
    return { ...result, png: Buffer.from(result.png, "base64") };
  };
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, "favicon.svg"), iconSvg);
  const icoEntries = [];
  for (const size of [16, 32, 48, 96]) {
    const { png } = await render(svgUrl(iconSvg), size);
    if (size < 96) icoEntries.push({ size, png });
    else await fs.writeFile(path.join(outputDir, "favicon-96x96.png"), png);
  }
  await fs.writeFile(path.join(outputDir, "favicon.ico"), makeIco(icoEntries));
  await fs.writeFile(path.join(outputDir, "apple-touch-icon.png"), (await render(maskUrl, 180)).png);
  for (const size of [192, 512]) {
    await fs.writeFile(path.join(outputDir, `icon-${size}.png`), (await render(svgUrl(color), size)).png);
    const output = await render(maskUrl, size);
    if (output.outsideSafeCircle || output.transparentPixels) throw new Error(`Maskable ${size}: unsafe or transparent artwork`);
    await fs.writeFile(path.join(outputDir, `maskable-${size}.png`), output.png);
    console.info(`maskable-${size}: opaque; all foreground within radius 40%`);
  }
  await fs.writeFile(path.join(sourceDir, "organization-logo.png"), (await render(svgUrl(color), 512, "#ffffff")).png);
  console.info("Generated versioned brand icons offline.");
} finally {
  await browser.close();
}
