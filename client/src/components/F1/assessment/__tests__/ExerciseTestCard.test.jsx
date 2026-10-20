import { renderToStaticMarkup } from "react-dom/server";
import { Dumbbell } from "lucide-react";
import { describe, expect, it } from "vitest";
import ExerciseTestCard from "../ExerciseTestCard";
import { createExercise } from "../../../../utils/assessmentExercises";

const suggestion = {
  reason: "Ưu tiên các bài đẩy bằng trọng lượng cơ thể để HLV dễ quan sát.",
  dosage: "2-3 hiệp x 8-10 reps hoặc 2-3 hiệp x 20-30 giây",
  tiers: { easy: ["Wall Push-Up"], standard: [], advanced: [] },
  protocolOptions: [],
};

const render = (props) =>
  renderToStaticMarkup(
    <ExerciseTestCard title="Sức mạnh" icon={Dumbbell} onChange={() => {}} suggestion={suggestion} {...props} />,
  );

describe("ExerciseTestCard suggested volume", () => {
  const value = { exercises: [createExercise({ name: "Wall Push-Up", tier: "easy" })] };

  it("shows the editable Sets x Reps and Sets x Time lines with the scoring note", () => {
    const markup = render({ value });

    expect(markup).toContain("Khối lượng tập đề xuất");
    expect(markup).not.toContain("Gợi ý khởi đầu");
    expect(markup).toContain("Sets x Reps");
    expect(markup).toContain("2–3 sets x 8–10 reps");
    expect(markup).toContain("Sets x Time");
    expect(markup).toContain("2–3 sets x 20–30 giây");
    expect(markup).toContain('aria-label="Sửa Sets x Reps"');
    expect(markup).toContain('aria-label="Sửa Sets x Time"');
    expect(markup).toContain("Chú thích:");
    expect(markup).toContain("Hệ số bạn thiết lập dùng để chấm điểm bài tập");
  });

  it("puts the short note inside the volume block, starting with Chú thích", () => {
    const markup = render({ value });
    const block = markup.slice(markup.indexOf("Khối lượng tập đề xuất"));
    expect(block).toContain("Chú thích:");
    expect(block.indexOf("Sets x Time")).toBeLessThan(block.indexOf("Chú thích:"));
    expect(markup).not.toContain("Ưu tiên các bài đẩy bằng trọng lượng cơ thể");
  });

  it("uses a saved exercise protocol as the volume shown", () => {
    const saved = {
      exercises: [
        {
          ...createExercise({ name: "Wall Push-Up", tier: "easy" }),
          inputMode: "reps",
          selectedProtocol: { mode: "reps", setsMin: 3, setsMax: 4, valueMin: 10, valueMax: 12, unit: "reps" },
        },
      ],
    };
    expect(render({ value: saved })).toContain("3–4 sets x 10–12 reps");
  });

  it("shows the plain dosage for result-scored cards and no editor", () => {
    const markup = render({ value, scoring: "result", suggestion: { ...suggestion, dosage: "20-30 phút, tăng dần theo từng tuần" } });
    expect(markup).toContain("Khối lượng tập đề xuất:");
    expect(markup).toContain("20-30 phút");
    expect(markup).not.toContain("Sửa Sets x Reps");
  });
});
