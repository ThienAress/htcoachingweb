import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MealPlanPreferenceConfirmDialog from "../MealPlanPreferenceConfirmDialog";

const renderDialog = (action, isPending = false) =>
  renderToStaticMarkup(
    <MealPlanPreferenceConfirmDialog
      action={action}
      isPending={isPending}
      onCancel={() => {}}
      onConfirm={() => {}}
    />,
  );

describe("MealPlanPreferenceConfirmDialog", () => {
  it("renders the save confirmation contract", () => {
    const html = renderDialog("save");

    expect({
      dialog: html.includes('role="dialog"'),
      modal: html.includes('aria-modal="true"'),
      title: html.includes("Xác nhận lưu điều kiện"),
      cancel: html.includes(">Hủy</button>"),
      confirm: html.includes(">Đồng ý lưu</button>"),
    }).toEqual({
      dialog: true,
      modal: true,
      title: true,
      cancel: true,
      confirm: true,
    });
  });

  it("renders the destructive clear confirmation and pending state", () => {
    const html = renderDialog("clear", true);

    expect({
      title: html.includes("Xác nhận bỏ lưu điều kiện"),
      pending: html.includes("Đang xử lý..."),
      disabledButtons: (html.match(/disabled=""/g) || []).length,
    }).toEqual({ title: true, pending: true, disabledButtons: 2 });
  });
});
