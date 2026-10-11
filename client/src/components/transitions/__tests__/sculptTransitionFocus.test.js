import { describe, expect, test } from "vitest";

import { getSculptFocusRestoreTarget } from "../sculptTransitionFocus";

describe("getSculptFocusRestoreTarget", () => {
  test("trả focus về link còn hiển thị", () => {
    const trigger = { isConnected: true, closest: () => null };

    expect(getSculptFocusRestoreTarget(trigger)).toBe(trigger);
  });

  test("trả focus về nút mở menu khi link nằm trong drawer đã inert", () => {
    const menuButton = {
      isConnected: true,
      getAttribute: () => "mobile-menu-drawer",
      closest: () => null,
    };
    const trigger = {
      isConnected: true,
      closest: () => ({ id: "mobile-menu-drawer" }),
    };
    const documentObject = {
      querySelectorAll: () => [menuButton],
    };

    expect(getSculptFocusRestoreTarget(trigger, documentObject)).toBe(menuButton);
  });

  test("không focus phần tử đã unmount", () => {
    expect(getSculptFocusRestoreTarget({ isConnected: false })).toBeNull();
  });
});
