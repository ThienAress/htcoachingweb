import { readFileSync, readdirSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

const publicRoot = new URL("../../public/", import.meta.url);
const iconsRoot = new URL("favicon/ht-v2/", publicRoot);
const readIcon = (name) => readFileSync(new URL(name, iconsRoot));
const dimensions = (png) => [png.readUInt32BE(16), png.readUInt32BE(20)];

function decodeRgba(png) {
  const [width, height] = dimensions(png);
  if (png[24] !== 8 || png[25] !== 6 || png[28] !== 0) throw new Error("Expected noninterlaced RGBA8 PNG");
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    if (png.toString("ascii", offset + 4, offset + 8) === "IDAT") chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  const pixels = Buffer.alloc(width * height * 4);
  const paeth = (a, b, c) => {
    const prediction = a + b - c;
    const distances = [Math.abs(prediction - a), Math.abs(prediction - b), Math.abs(prediction - c)];
    return distances[0] <= distances[1] && distances[0] <= distances[2] ? a : distances[1] <= distances[2] ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x;
      const left = x >= 4 ? pixels[index - 4] : 0;
      const up = y ? pixels[index - stride] : 0;
      const diagonal = y && x >= 4 ? pixels[index - stride - 4] : 0;
      const predictor = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, diagonal)][filter];
      if (predictor === undefined) throw new Error("Invalid PNG filter");
      pixels[index] = (raw[y * (stride + 1) + x + 1] + predictor) & 255;
    }
  }
  return { width, height, pixels };
}

describe("versioned brand icon distribution", () => {
  it.each([
    ["favicon-96x96.png", 96], ["apple-touch-icon.png", 180],
    ["icon-192.png", 192], ["icon-512.png", 512],
    ["maskable-192.png", 192], ["maskable-512.png", 512],
  ])("publishes %s with its advertised size", (filename, size) => {
    const png = readIcon(filename);
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(dimensions(png)).toEqual([size, size]);
  });

  it.each([192, 512])("keeps every maskable-%s foreground pixel within the safe circle and its background opaque", (size) => {
    const { pixels } = decodeRgba(readIcon(`maskable-${size}.png`));
    let invalid = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const index = 4 * (y * size + x);
      const foreground = Math.max(...pixels.subarray(index, index + 3)) > 40;
      if (pixels[index + 3] !== 255 || (foreground && Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) > 0.4 * size)) invalid++;
    }
    expect(invalid).toBe(0);
  });

  it("keeps regular icons transparent and declares regular/maskable separately", () => {
    const { pixels } = decodeRgba(readIcon("icon-192.png"));
    expect(pixels[3]).toBe(0);
    const manifest = JSON.parse(readIcon("site.webmanifest"));
    expect(manifest.icons.map(({ purpose }) => purpose)).toEqual(["any", "any", "maskable", "maskable"]);
    for (const icon of manifest.icons) expect(readFileSync(new URL(icon.src.slice(1), publicRoot)).length).toBeGreaterThan(0);
  });

  it("ships valid PNG-backed ICO entries at 16, 32 and 48 pixels", () => {
    const ico = readIcon("favicon.ico");
    expect([ico.readUInt16LE(0), ico.readUInt16LE(2), ico.readUInt16LE(4)]).toEqual([0, 1, 3]);
    for (const [index, size] of [16, 32, 48].entries()) {
      const entry = 6 + index * 16;
      const offset = ico.readUInt32LE(entry + 12);
      expect([ico[entry], ico[entry + 1]]).toEqual([size, size]);
      expect(dimensions(ico.subarray(offset, offset + ico.readUInt32LE(entry + 8)))).toEqual([size, size]);
    }
  });

  it("keeps designer SVGs vector-only and browser-safe", () => {
    const directory = new URL("branding/ht-v2/", publicRoot);
    for (const name of readdirSync(directory).filter((file) => file.endsWith(".svg"))) {
      expect(readFileSync(new URL(name, directory), "utf8")).not.toMatch(/<(?:image|script|foreignObject|text)\b|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|javascript:|data:)/i);
    }
  });

  it("references only versioned icon paths and a standalone organization logo", () => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    expect([...html.matchAll(/href="(\/favicon\/[^"]+)"/g)].map((match) => match[1])).toHaveLength(5);
    for (const [, url] of html.matchAll(/href="(\/favicon\/[^"]+)"/g)) {
      expect(url).toMatch(/^\/favicon\/ht-v2\//);
      expect(readFileSync(new URL(url.slice(1), publicRoot)).length).toBeGreaterThan(0);
    }
    expect(dimensions(readFileSync(new URL("branding/ht-v2/organization-logo.png", publicRoot)))).toEqual([512, 512]);
  });
});
