import { CalendarDays } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import WorkspacePageHeader from "../WorkspacePageHeader";

describe("WorkspacePageHeader", () => {
  it("shows the page name once as the main heading, with the description and actions", () => {
    const html = renderToStaticMarkup(
      <WorkspacePageHeader
        icon={CalendarDays}
        title="Quản lý lịch tập"
        description="Mỗi buổi tập gắn với ngày cụ thể"
        actions={<button type="button">Tạo lịch mới</button>}
      />,
    );

    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html.match(/Quản lý lịch tập/g)).toHaveLength(1);
    expect(html).toContain("Mỗi buổi tập gắn với ngày cụ thể");
    expect(html).toContain("Tạo lịch mới");
    expect(html).toContain('aria-hidden="true"');
  });

  it("leaves out the description and actions when they are not given", () => {
    const html = renderToStaticMarkup(<WorkspacePageHeader title="Giáo án" />);

    expect(html).toContain("Giáo án");
    expect(html).not.toContain("<p");
    expect(html).not.toContain("<button");
  });
});
