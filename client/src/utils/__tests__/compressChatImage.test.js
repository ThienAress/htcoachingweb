import { describe, expect, it } from "vitest";

import { dataUrlByteLength } from "../compressChatImage.js";

describe("dataUrlByteLength", () => {
  it("calculates decoded base64 bytes", () => {
    expect(dataUrlByteLength("data:image/png;base64,YQ==")).toBe(1);
    expect(dataUrlByteLength("data:image/png;base64,YWI=")).toBe(2);
    expect(dataUrlByteLength("data:image/png;base64,YWJj")).toBe(3);
  });
});
