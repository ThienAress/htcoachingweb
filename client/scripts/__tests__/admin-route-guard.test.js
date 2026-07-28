import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const adminRouteSource = fs.readFileSync(
  path.resolve(__dirname, "../../src/routes/AdminRoute.jsx"),
  "utf8",
);

describe("AdminRoute guard structure", () => {
  it("handles subscription API errors after the unauthenticated redirect", () => {
    const unauthenticatedBranch = adminRouteSource.indexOf("if (!user)");
    const loginRedirect = adminRouteSource.indexOf(
      'return <Navigate to="/login" replace />;',
      unauthenticatedBranch,
    );
    const subscriptionErrorBranch = adminRouteSource.indexOf(
      "if (requiresSubscription && subError)",
    );

    expect(unauthenticatedBranch).toBeGreaterThan(-1);
    expect(loginRedirect).toBeGreaterThan(unauthenticatedBranch);
    expect(subscriptionErrorBranch).toBeGreaterThan(loginRedirect);
  });
});
