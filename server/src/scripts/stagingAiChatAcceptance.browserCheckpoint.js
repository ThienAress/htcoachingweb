export const waitForBrowserCheckpoint = async (locator, options, code) => {
  try {
    await locator.waitFor(options);
  } catch {
    const error = new Error("Staging browser checkpoint did not become visible");
    error.code = code;
    throw error;
  }
};
