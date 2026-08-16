import { describe, expect, it } from "vitest";

import { mockLLMStream } from "../mock.provider.js";

const collect = async (message) => {
  const chunks = [];
  for await (const chunk of mockLLMStream(
    [{ role: "user", content: message }],
    [],
  )) {
    chunks.push(chunk);
  }
  return chunks;
};

describe("mock TDEE provider", () => {
  it("maps a complete natural-language form submission to canonical evidence", async () => {
    const chunks = await collect(
      "Tính TDEE: Nam, 30 tuổi, 175cm, 75kg, vận động ngoài buổi tập: Chủ yếu ngồi, số bước: 4000 bước/ngày, tập 5 buổi/tuần, 50 phút/buổi, cường độ Vừa, mục tiêu Giảm mỡ",
    );

    expect(chunks).toEqual([
      {
        type: "tool_call",
        toolCalls: [
          expect.objectContaining({
            name: "calculate_tdee",
            args: expect.objectContaining({
              gender: "male",
              dailyMovement: "mostly_seated",
              steps: "under_5000",
              trainingFrequency: "five_plus",
              trainingDuration: "between_45_60",
              trainingIntensity: "moderate",
              goal: "fat_loss",
            }),
          }),
        ],
      },
    ]);
  });

  it("asks for missing gender instead of silently assuming male", async () => {
    const chunks = await collect(
      "Tính TDEE: 30 tuổi, 175cm, 75kg, văn phòng, 4000 bước, 5 buổi/tuần, 50 phút, cường độ vừa, giảm mỡ",
    );

    expect(chunks[0]).toMatchObject({ type: "text" });
    expect(chunks[0].content).toMatch(/giới tính/i);
  });

  it("does not mistake cân nặng for training intensity", async () => {
    const chunks = await collect(
      "Tính TDEE: Nam, 30 tuổi, 175cm, cân nặng 75kg, vận động ngoài buổi tập: Chủ yếu ngồi, số bước: 4000 bước/ngày, tập 5 buổi/tuần, 50 phút/buổi, mục tiêu Giảm mỡ",
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ type: "text" });
    expect(chunks[0]).not.toHaveProperty("toolCalls");
  });

  it("preserves an explicit no-training state without inventing a workout", async () => {
    const chunks = await collect(
      "Tính TDEE: Nữ, 30 tuổi, 165cm, 60kg, vận động ngoài buổi tập: Chủ yếu ngồi, số bước: 4000 bước/ngày, tập 0 buổi/tuần, 0 phút/buổi, cường độ Không áp dụng, mục tiêu Duy trì",
    );

    expect(chunks[0].toolCalls[0].args).toMatchObject({
      gender: "female",
      trainingFrequency: "none",
      trainingDuration: "none",
      trainingIntensity: "none",
      goal: "maintenance",
      activityLevel: "sedentary",
    });
  });

  it("does not call the tool for contradictory no-training evidence", async () => {
    const chunks = await collect(
      "Tính TDEE: Nữ, 30 tuổi, 165cm, 60kg, vận động ngoài buổi tập: Chủ yếu ngồi, số bước: 4000 bước/ngày, tập 0 buổi/tuần, 50 phút/buổi, cường độ Vừa, mục tiêu Duy trì",
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ type: "text" });
    expect(chunks[0]).not.toHaveProperty("toolCalls");
  });
});
