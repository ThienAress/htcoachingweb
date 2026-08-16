import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ConfirmationCard from "../ConfirmationCard";

describe("AI confirmation card", () => {
  it("renders accessible actions without exposing the opaque token", () => {
    const html = renderToStaticMarkup(
      <ConfirmationCard
        data={{
          token: "opaque-token-that-must-not-be-rendered",
          expiresAt: "2026-08-13T01:00:00.000Z",
          title: "Xác nhận hành động",
          description: "Kiểm tra trước khi thực hiện.",
        }}
      />,
    );

    expect({
      labelled:
        /aria-labelledby="([^"]+)"/.test(html) &&
        /<h3 id="([^"]+)"/.test(html),
      confirm: html.includes(">Xác nhận</button>"),
      cancel: html.includes(">Hủy</button>"),
      tokenHidden: !html.includes("opaque-token-that-must-not-be-rendered"),
      buttons: (html.match(/type="button"/g) || []).length,
    }).toEqual({
      labelled: true,
      confirm: true,
      cancel: true,
      tokenHidden: true,
      buttons: 2,
    });
  });
});
