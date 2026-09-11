import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BrandLogo from "../BrandLogo.jsx";
import GlobalLoading from "../GlobalLoading.jsx";

describe("BrandLogo artwork contract", () => {
  it("uses the light-background wordmark without a slogan by default", () => {
    const html = renderToStaticMarkup(<BrandLogo />);
    expect(html).toContain('/branding/ht-v2/htcoaching-wordmark-dark.svg');
    expect(html).toContain('alt="HTCOACHING"');
    expect(html).toContain('width="1398.1" height="224"');
  });

  it("uses the on-dark mark without a duplicate accessible name when decorative", () => {
    const html = renderToStaticMarkup(<BrandLogo variant="mark" surface="dark" decorative />);
    expect(html).toContain('/branding/ht-v2/ht-mark-on-dark.svg');
    expect(html).toContain('alt=""');
    expect(html).toContain('aria-hidden="true"');
  });

  it("reserves header geometry and switches to the wordmark at desktop width", () => {
    const html = renderToStaticMarkup(<BrandLogo variant="header" surface="dark" />);
    expect(html).toContain('media="(min-width: 1024px)"');
    expect(html).toContain('srcSet="/branding/ht-v2/htcoaching-wordmark-light.svg"');
    expect(html).toContain('src="/branding/ht-v2/ht-mark-on-dark.svg"');
    expect(html).toContain('lg:w-[150px]');
  });

  it("uses a no-slogan fallback only when the footer column cannot fit the minimum", () => {
    const html = renderToStaticMarkup(<BrandLogo variant="footer" surface="dark" />);
    expect(html).toContain('media="(min-width: 1024px) and (max-width: 1279px)"');
    expect(html).toContain('src="/branding/ht-v2/htcoaching-lockup-slogan-light.svg"');
    expect(html).toContain('w-[260px]');
  });

  it("keeps the suspense logo visible before effects and when reduced motion skips animation", () => {
    const html = renderToStaticMarkup(<GlobalLoading />);
    expect(html).toContain('/branding/ht-v2/ht-mark-on-dark.svg');
    expect(html).not.toContain('visibility:hidden');
  });
});
