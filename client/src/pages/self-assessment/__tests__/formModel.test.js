import { describe, expect, it } from "vitest";

import {
  hasAnyTestValue,
  profileDefaults,
  profileSchema,
  profileToPayload,
  screeningDefaults,
  screeningSchema,
  screeningToPayload,
  testsDefaults,
  testsSchema,
  testsToPayload,
} from "../formModel";

const validScreening = { ...screeningDefaults(null), allowDataStorage: true };
const validProfile = {
  ...profileDefaults(null),
  age: "30",
  gender: "male",
  heightCm: "175",
  weightKg: "80",
  currentlyTraining: "yes",
  trainingExperience: "intermediate",
  primaryGoal: "muscle_gain",
};

const firstMessage = (result) => result.error?.issues?.[0]?.message;

describe("form sàng lọc", () => {
  it("bắt buộc đồng ý lưu dữ liệu sức khỏe", () => {
    const result = screeningSchema.safeParse({ ...validScreening, allowDataStorage: false });
    expect(result.success).toBe(false);
    expect(firstMessage(result)).toContain("đồng ý");
  });

  it("từ chối mức đau ngoài 0-10 và chỉ gửi vùng đau khi có đau", () => {
    expect(screeningSchema.safeParse({ ...validScreening, painLevel: "11" }).success).toBe(false);
    const noPain = screeningToPayload({ ...validScreening, painLevel: "0", painLocation: ["knee"] });
    expect(noPain.screening.painLocation).toEqual([]);
    expect(noPain.screening.hasPainNow).toBe(false);
    const withPain = screeningToPayload({ ...validScreening, painLevel: "3", painLocation: ["knee"] });
    expect(withPain.screening.painLocation).toEqual(["knee"]);
    expect(withPain.consent.allowDataStorage).toBe(true);
  });
});

describe("form thông tin cá nhân", () => {
  it("nhận dữ liệu hợp lệ và đổi chuỗi thành số trong payload", () => {
    expect(profileSchema.safeParse(validProfile).success).toBe(true);
    const payload = profileToPayload({ ...validProfile, waistCm: "", restingHeartRate: "58" });
    expect(payload.step).toBe(2);
    expect(payload.profile).toMatchObject({ age: 30, gender: "male", waistCm: null, restingHeartRate: 58 });
    expect(payload.training).toMatchObject({ currentlyTraining: true, trainingExperience: "intermediate" });
  });

  it("báo lỗi tiếng Việt khi thiếu trường bắt buộc hoặc giá trị vô lý", () => {
    const missing = profileSchema.safeParse({ ...validProfile, age: "", gender: "" });
    const messages = missing.error.issues.map((issue) => issue.message);
    expect(messages).toContain("Vui lòng nhập tuổi.");
    expect(messages).toContain("Vui lòng chọn giới tính.");
    expect(profileSchema.safeParse({ ...validProfile, weightKg: "900" }).success).toBe(false);
  });

  it("điền sẵn từ bản đánh giá trước", () => {
    const defaults = profileDefaults({
      profile: { age: 31, gender: "female", heightCm: 160, weightKg: 52 },
      training: { currentlyTraining: false, trainingExperience: "beginner", primaryGoal: "fat_loss" },
    });
    expect(defaults).toMatchObject({ age: "31", gender: "female", currentlyTraining: "no", primaryGoal: "fat_loss" });
  });
});

describe("form bài kiểm tra", () => {
  const empty = testsDefaults(null);

  it("bài đi bộ cần đủ số phút và nhịp tim", () => {
    const result = testsSchema.safeParse({ ...empty, walkMinutes: "15" });
    expect(firstMessage(result)).toContain("nhịp tim");
  });

  it("nhập số lần mà chưa chọn cách làm thì báo lỗi", () => {
    const result = testsSchema.safeParse({ ...empty, pushReps: "20" });
    expect(firstMessage(result)).toContain("cách hít đất");
  });

  it("tạo payload theo từng nhóm và bỏ trống nhóm chưa làm", () => {
    const values = { ...empty, pushVariant: "knee", pushReps: "20", plankVariant: "full", plankSeconds: "70" };
    expect(testsSchema.safeParse(values).success).toBe(true);
    expect(hasAnyTestValue(values)).toBe(true);
    expect(hasAnyTestValue(empty)).toBe(false);
    const payload = testsToPayload(values);
    expect(payload.tests.upperBodyPush).toEqual({ variant: "knee", reps: 20 });
    expect(payload.tests.coreEndurance).toEqual({ variant: "full", seconds: 70 });
    expect(payload.tests.lowerBody).toEqual({ variant: "", reps: null });
    expect(payload.tests.cardio).toEqual({ variant: "", minutes: null, endHeartRate: null });
  });
});
