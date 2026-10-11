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

  it("giữ scroll lock cho tới khi cả menu và preview cùng đóng, bất kể thứ tự cleanup", () => {
    const style = { overflow: "auto", overscrollBehavior: "contain" };
    const documentObject = { body: { style } };

    const closeMenu = lockDocumentScroll(documentObject);
    const closePreview = lockDocumentScroll(documentObject);
    closeMenu();
    expect(style.overflow).toBe("hidden");

    closePreview();
    expect(style).toEqual({ overflow: "auto", overscrollBehavior: "contain" });
  });

  it("không mở lại scroll khi preview đóng trước menu", () => {
    const style = { overflow: "", overscrollBehavior: "" };
    const documentObject = { body: { style } };

    const closeMenu = lockDocumentScroll(documentObject);
    const closePreview = lockDocumentScroll(documentObject);
    closePreview();
    expect(style.overflow).toBe("hidden");

    closeMenu();
    closeMenu();
    expect(style).toEqual({ overflow: "", overscrollBehavior: "" });
  });
});
