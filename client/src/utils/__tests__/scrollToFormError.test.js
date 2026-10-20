import { describe, expect, it, vi } from "vitest";
import { FORM_ERROR_ATTR, scrollToFirstFormError } from "../scrollToFormError";

const fakeControl = () => ({ focus: vi.fn(), hasAttribute: () => true });

describe("scrollToFirstFormError", () => {
  it("does nothing when the form has no error marker", () => {
    expect(scrollToFirstFormError({ querySelector: () => null })).toBe(false);
    expect(scrollToFirstFormError(null)).toBe(false);
  });

  it("scrolls the first error into view and focuses a control in the same group", () => {
    const control = fakeControl();
    const container = { querySelector: vi.fn(() => control) };
    const marker = { scrollIntoView: vi.fn(), closest: vi.fn(() => container), parentElement: null };
    const form = { querySelector: vi.fn(() => marker) };

    expect(scrollToFirstFormError(form)).toBe(true);
    expect(form.querySelector).toHaveBeenCalledWith(`[${FORM_ERROR_ATTR}]`);
    expect(marker.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(control.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("focuses the error line itself when the group has no control", () => {
    const marker = {
      scrollIntoView: vi.fn(),
      closest: vi.fn(() => ({ querySelector: () => null })),
      parentElement: null,
      hasAttribute: () => false,
      setAttribute: vi.fn(),
      focus: vi.fn(),
    };
    expect(scrollToFirstFormError({ querySelector: () => marker })).toBe(true);
    expect(marker.setAttribute).toHaveBeenCalledWith("tabindex", "-1");
    expect(marker.focus).toHaveBeenCalled();
  });
});
