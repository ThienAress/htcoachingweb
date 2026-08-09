import { describe, expect, it } from "vitest";

import { createTipTapExtensions } from "../tiptap/createTipTapExtensions";

describe("TipTapEditor extensions", () => {
  it("registers the official table kit", () => {
    expect(createTipTapExtensions().map((extension) => extension.name)).toContain(
      "tableKit",
    );
  });
});
