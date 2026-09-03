const NOINDEX_FOLLOW_META =
  '<meta name="robots" content="noindex,follow" data-rh="true">';

export const createNoindexFallbackShell = (appShellHtml) => {
  const html = String(appShellHtml || "");
  if (!/<\/head>/i.test(html)) {
    throw new Error("App shell is missing a closing head tag");
  }
  if (/<meta[^>]+name=["']robots["']/i.test(html)) {
    throw new Error("App shell already contains a robots meta tag");
  }
  return html.replace(/<\/head>/i, `  ${NOINDEX_FOLLOW_META}\n</head>`);
};
