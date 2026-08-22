import { describe, expect, it } from "vitest";

import { lockDocumentScroll } from "../useModalScrollLock.js";

describe("lockDocumentScroll", () => {
  it("locks overflow without changing body position or scroll offset styles", () => {
    const style = {
      overflow: "auto",
      overscrollBehavior: "contain",
      position: "",
      top: "",
    };

    const restore = lockDocumentScroll({ body: { style } });

    expect({ ...style }).toEqual({
      overflow: "hidden",
      overscrollBehavior: "none",
      position: "",
      top: "",
    });

    restore();
    expect({ ...style }).toEqual({
      overflow: "auto",
      overscrollBehavior: "contain",
      position: "",
      top: "",
    });
  });
});
