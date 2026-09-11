# HTCOACHING runtime artwork

Unchanged SVG files and maskable PNG source supplied by the designer in the
HTCoaching_Brand_Production delivery, September 2026. Outlined lettering is Lato;
its supplied OFL license is preserved alongside the artwork. No live fonts,
embedded raster, remote resource or generator upload is needed for the SVGs.

`*-dark.svg` is for light backgrounds; `*-light.svg` is for dark backgrounds.
Wordmark minimum 140px, slogan lockup minimum 260px. Keep surrounding clear space
at least half the letter H's cap height. The mark artboard includes clear space.
Do not stretch artwork, add effects or use an emblem as a small icon.

From the client directory, regenerate derived PNG/ICO assets offline with
`node scripts/generate-brand-icons.js` (existing Puppeteer/Chromium required).
The SVG favicon adds a neutral background behind the unchanged on-dark mark for
contrast in both light and dark tabs. Regular PWA icons remain transparent;
maskable icons use the supplied opaque safe-zone source and are checked during
generation. `organization-logo.png` has a white background for crawler contrast.
Old assets remain available for compatibility. No trademark clearance is implied.
