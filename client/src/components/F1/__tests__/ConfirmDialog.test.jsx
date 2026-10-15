import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ConfirmDialog from "../ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders an accessible centered dialog with details and actions", () => {
    const markup = renderToStaticMarkup(
      <ConfirmDialog
        title="Tạo ảnh dự đoán?"
        message="Hệ thống sẽ tạo ảnh sau tập."
        details={["Mỗi lần tạo ảnh sẽ phát sinh chi phí."]}
        confirmLabel="Tạo ảnh"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(markup).toContain('role="alertdialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain("items-center justify-center");
    expect(markup).toContain("Tạo ảnh dự đoán?");
    expect(markup).toContain("Mỗi lần tạo ảnh sẽ phát sinh chi phí.");
    expect(markup).toContain(">Tạo ảnh<");
    expect(markup).toContain(">Huỷ<");
  });

  it("uses the danger palette for destructive confirmations", () => {
    const markup = renderToStaticMarkup(
      <ConfirmDialog
        title="Xóa khách hàng F1?"
        message="Bạn có chắc không?"
        tone="danger"
        confirmLabel="Xóa dữ liệu"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(markup).toContain("from-red-600");
  });
});
