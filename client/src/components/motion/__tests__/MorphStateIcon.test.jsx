import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("morphicons/react", () => ({
  MorphIcon: ({ icon, reducedMotion, spring, ...props }) => (
    <svg
      {...props}
      data-icon={icon}
      data-reduced-motion={reducedMotion}
      data-spring={spring}
    />
  ),
}));

import MorphStateIcon from "../MorphStateIcon";

describe("MorphStateIcon", () => {
  test("enforces project motion policy and decorative semantics", () => {
    const html = renderToStaticMarkup(
      <MorphStateIcon state="menu" size={20} className="size-5" />,
    );

    expect({
      reducedMotion: html.includes('data-reduced-motion="user"'),
      spring: html.includes('data-spring="smooth"'),
      decorative: html.includes('aria-hidden="true"'),
      focusable: html.includes('focusable="false"'),
    }).toEqual({
      reducedMotion: true,
      spring: true,
      decorative: true,
      focusable: true,
    });
  });

  test("maps menu and close states to different stable path data", () => {
    const menu = renderToStaticMarkup(<MorphStateIcon state="menu" />);
    const close = renderToStaticMarkup(<MorphStateIcon state="close" />);

    expect({
      menuState: menu.includes('data-icon-state="menu"'),
      closeState: close.includes('data-icon-state="close"'),
      differentGeometry: menu.match(/data-icon="([^"]+)"/)?.[1]
        !== close.match(/data-icon="([^"]+)"/)?.[1],
    }).toEqual({
      menuState: true,
      closeState: true,
      differentGeometry: true,
    });
  });
});
