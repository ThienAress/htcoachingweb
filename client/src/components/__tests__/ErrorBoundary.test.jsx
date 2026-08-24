import { renderToStaticMarkup } from "react-dom/server";
import { HelmetProvider } from "react-helmet-async";
import { describe, expect, it, vi } from "vitest";

import ErrorBoundary from "../ErrorBoundary.jsx";
import {
  CHUNK_RECOVERY_SESSION_KEY,
  isStaleDynamicImportError,
  recoverStaleDynamicImport,
} from "../../utils/chunkRecovery.js";

const makeStorage = () => {
  const values = new Map();
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, String(value))),
    removeItem: vi.fn((key) => values.delete(key)),
  };
};

describe("ErrorBoundary fatal fallback", () => {
  it("never renders a raw dynamic-import error into indexable copy", () => {
    const boundary = new ErrorBoundary({ children: null });
    const helmetContext = {};
    boundary.state = {
      hasError: true,
      error: new Error(
        "Failed to fetch dynamically imported module: /assets/Home-old.js",
      ),
    };

    const html = renderToStaticMarkup(
      <HelmetProvider context={helmetContext}>{boundary.render()}</HelmetProvider>,
    );

    expect(html).toContain("data-app-fatal-error");
    expect(html).toContain("data-nosnippet");
    expect(html).toContain('name="robots" content="noindex,nofollow"');
    expect(html).not.toContain("Failed to fetch dynamically imported module");
    expect(html).not.toContain("Home-old.js");
  });
});

describe("stale dynamic-import recovery", () => {
  it.each([
    "Failed to fetch dynamically imported module: /assets/Home-old.js",
    "Importing a module script failed.",
    "ChunkLoadError: Loading chunk 42 failed",
  ])("recognizes a stale deployment asset error: %s", (message) => {
    expect(isStaleDynamicImportError(new Error(message))).toBe(true);
  });

  it("reloads only once per session and prevents a loop", () => {
    const storage = makeStorage();
    const reload = vi.fn();
    const error = new Error("Failed to fetch dynamically imported module");

    expect(recoverStaleDynamicImport(error, { storage, reload })).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(
      CHUNK_RECOVERY_SESSION_KEY,
      "1",
    );
    expect(reload).toHaveBeenCalledTimes(1);

    expect(recoverStaleDynamicImport(error, { storage, reload })).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload for an unrelated application error", () => {
    const reload = vi.fn();
    expect(
      recoverStaleDynamicImport(new Error("Unexpected form state"), {
        storage: makeStorage(),
        reload,
      }),
    ).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
