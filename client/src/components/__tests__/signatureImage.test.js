import { describe, expect, it } from "vitest";
import {
  fitSignatureDimensions,
  signatureDataUrlBytes,
  validateSignatureSourceFile,
} from "../signatureImage";

describe("signature image upload", () => {
  it("accepts bounded PNG, JPEG and WebP source files", () => {
    expect(
      ["image/png", "image/jpeg", "image/webp"].map((type) =>
        validateSignatureSourceFile({ type, size: 1024 }),
      ),
    ).toEqual([null, null, null]);
  });

  it("rejects unsupported or oversized source files", () => {
    expect([
      validateSignatureSourceFile({ type: "image/svg+xml", size: 1024 }),
      validateSignatureSourceFile({ type: "image/png", size: 5 * 1024 * 1024 + 1 }),
    ]).toEqual([
      "Chỉ hỗ trợ ảnh PNG, JPG/JPEG hoặc WebP.",
      "Ảnh chữ ký nguồn không được vượt quá 5 MB.",
    ]);
  });

  it("fits the source inside 1200 x 400 and measures base64 bytes", () => {
    expect([
      fitSignatureDimensions(2400, 1200),
      fitSignatureDimensions(600, 200),
      signatureDataUrlBytes("data:image/png;base64,AQIDBA=="),
    ]).toEqual([
      { width: 800, height: 400 },
      { width: 600, height: 200 },
      4,
    ]);
  });
});
