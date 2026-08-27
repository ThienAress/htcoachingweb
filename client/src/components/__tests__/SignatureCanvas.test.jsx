import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SignatureCanvas from "../SignatureCanvas";

describe("SignatureCanvas", () => {
  it("shows image upload only when the contract editor enables it", () => {
    const enabled = renderToStaticMarkup(
      <SignatureCanvas onSignatureChange={() => {}} allowImageUpload />,
    );
    const defaultCanvas = renderToStaticMarkup(
      <SignatureCanvas onSignatureChange={() => {}} />,
    );

    expect(enabled).toContain("Tải ảnh chữ ký");
    expect(enabled).toContain('accept="image/png,image/jpeg,image/webp"');
    expect(defaultCanvas).not.toContain("Tải ảnh chữ ký");
  });
});
