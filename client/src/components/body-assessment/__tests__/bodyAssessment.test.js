import { describe, expect, it } from 'vitest';
import { assessmentDelta, assessmentFormSchema, assessmentValues, measurementHistory } from '../bodyAssessment';

describe('body assessment presentation contract', () => {
  it('keeps a missing region missing instead of zero', () => {
    expect(assessmentDelta(null, 2)).toBeNull();
  });
  it('compares mass without rounding the stored values', () => {
    expect(assessmentDelta(3.84, 3.78)).toBeCloseTo(0.06, 10);
  });
  it('allows reference percentages above 100 but rejects negative masses', () => {
    const value = assessmentValues();
    value.segments.leftArm.leanReferencePercent = '210';
    expect(assessmentFormSchema.parse(value).segments.leftArm.leanReferencePercent).toBe(210);
    value.segments.leftArm.leanKg = '-1';
    expect(assessmentFormSchema.safeParse(value).success).toBe(false);
  });
  it('sorts real measurement dates and preserves missing region points', () => {
    const items = [
      { id: 'b', published: { measuredDateKey: '2026-09-08', segments: {} } },
      { id: 'a', published: { measuredDateKey: '2026-09-01', segments: { leftArm: { leanKg: 3.78 } } } },
    ];
    expect(measurementHistory(items, 'leftArm', 'leanKg')).toEqual([
      { dateKey: '2026-09-01', value: 3.78 },
      { dateKey: '2026-09-08', value: null },
    ]);
  });
});
