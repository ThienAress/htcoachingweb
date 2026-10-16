import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import F1PredictionModeDialog from "../F1PredictionModeDialog";

const render = (props) =>
  renderToStaticMarkup(
    <F1PredictionModeDialog
      customer={{ fullName: "Khách A", code: "F1-0001" }}
      onSystem={vi.fn()}
      onTrainer={vi.fn()}
      onClose={vi.fn()}
      {...props}
    />,
  );

describe("F1PredictionModeDialog", () => {
  it("keeps the first-time choice dialog without a current mode", () => {
    const markup = render({ stageOrder: 1 });
    expect(markup).toContain("Tạo dự đoán kết quả");
    expect(markup).not.toContain("Đang dùng");
    expect(markup).not.toContain("Thay đổi dự đoán");
  });

  it("marks the mode in use and warns that it can be changed once", () => {
    const markup = render({ stageOrder: 3, currentMode: "system", canRegenerate: false });
    expect(markup).toContain("Thay đổi dự đoán");
    expect(markup).toContain("Chọn cách dựng từ giai đoạn 3 trở đi");
    expect(markup).toContain("Mỗi khách chỉ đổi cách dự đoán được một lần");
    expect(markup.match(/Đang dùng/g)).toHaveLength(2); // badge + button label of the current choice
  });

  it("disables both choices once the change was used", () => {
    const markup = render({ stageOrder: 5, currentMode: "trainer", locked: true });
    expect(markup).toContain("đã thay đổi cách dự đoán một lần nên không thể thay đổi nữa");
    expect(markup.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
