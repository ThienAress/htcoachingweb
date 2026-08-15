import { describe, expect, it, vi } from "vitest";
import {
  TRAINER_WORKSPACE_THEME_STORAGE_KEY,
  persistTrainerWorkspaceTheme,
  resolveInitialTrainerWorkspaceTheme,
} from "../trainerWorkspaceTheme.js";

const createStorage = (entries = {}) => {
  const values = new Map(Object.entries(entries));
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
  };
};

describe("trainer workspace theme", () => {
  it("mặc định dùng giao diện sáng", () => {
    expect(resolveInitialTrainerWorkspaceTheme(createStorage())).toBe("light");
  });

  it("khôi phục và lưu lựa chọn hợp lệ", () => {
    const storage = createStorage({
      [TRAINER_WORKSPACE_THEME_STORAGE_KEY]: "dark",
    });

    expect(resolveInitialTrainerWorkspaceTheme(storage)).toBe("dark");
    persistTrainerWorkspaceTheme("light", storage);

    expect(storage.setItem).toHaveBeenCalledWith(
      TRAINER_WORKSPACE_THEME_STORAGE_KEY,
      "light",
    );
  });

  it("bỏ qua theme không hỗ trợ và fallback sáng khi storage lỗi", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("storage unavailable");
      }),
      setItem: vi.fn(),
    };

    expect(resolveInitialTrainerWorkspaceTheme(storage)).toBe("light");
    persistTrainerWorkspaceTheme("sepia", storage);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
