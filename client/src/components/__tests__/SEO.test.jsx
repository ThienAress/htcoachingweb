import { renderToStaticMarkup } from "react-dom/server";
import { HelmetProvider } from "react-helmet-async";
import { describe, expect, it, vi } from "vitest";

import SEO from "../SEO.jsx";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { language: "vi" } }),
}));

const renderMetadata = (component) => {
  return renderToStaticMarkup(
    <HelmetProvider>{component}</HelmetProvider>,
  );
};

describe("SEO robots modes", () => {
  it("keeps normal public pages indexable with a canonical and JSON-LD", () => {
    const metadata = renderMetadata(
      <SEO
        title="Công thức"
        description="Mô tả"
        canonical="/cong-thuc-nau-an/pho/"
        jsonLd={{ "@type": "Recipe", name: "Phở" }}
      />,
    );

    expect(metadata).toContain('content="index,follow"');
    expect(metadata).toContain(
      'href="https://htcoachingweb.io.vn/cong-thuc-nau-an/pho/"',
    );
    expect(metadata).toContain('type="application/ld+json"');
  });

  it("quarantines public detail pages with noindex,follow and no index signals", () => {
    const metadata = renderMetadata(
      <SEO
        title="Công thức"
        description="Mô tả"
        canonical="/cong-thuc-nau-an/pho/"
        noindexFollow
        jsonLd={{ "@type": "Recipe", name: "Phở" }}
      />,
    );

    expect(metadata).toContain('content="noindex,follow"');
    expect(metadata).not.toContain('rel="canonical"');
    expect(metadata).not.toContain('property="og:url"');
    expect(metadata).not.toContain('type="application/ld+json"');
  });

  it("preserves noindex,nofollow for private and system pages", () => {
    const metadata = renderMetadata(
      <SEO title="Quản trị" canonical="/admin/" noindex />,
    );

    expect(metadata).toContain('content="noindex,nofollow"');
    expect(metadata).not.toContain('rel="canonical"');
  });
});
