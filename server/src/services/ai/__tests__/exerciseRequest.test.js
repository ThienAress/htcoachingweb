import { describe, expect, it } from 'vitest';
import { buildExerciseRequest, isExerciseCatalogRequest } from '../exerciseRequest.js';

describe('canonical exercise request', () => {
  it('preserves original count and bands despite incomplete model arguments', () => {
    expect(buildExerciseRequest('Tìm 4 bài tập lưng cho người mới, chỉ dùng dây kháng lực', {limit: 5})).toEqual({
      muscleGroup: 'Lưng', limit: 4,
      searchQuery: 'bài tập Lưng người mới chỉ dùng dây kháng lực',
    });
  });
  it('preserves both equipment types regardless of ordering', () => {
    expect(buildExerciseRequest('Tìm 3 bài ngực chỉ có dây kháng lực và tạ đơn').searchQuery)
      .toContain('chỉ có tạ đơn và dây kháng lực');
  });
  it.each(['không có dụng cụ', 'bodyweight', 'không cần dụng cụ'])(
    'preserves no-equipment wording: %s', (equipment) => {
      expect(buildExerciseRequest(`Tìm 4 bài tập lưng ${equipment}`).searchQuery)
        .toContain('không cần dụng cụ');
    },
  );
  it('does not invent a constraint for unrestricted equipment mentions', () => {
    expect(buildExerciseRequest('Tìm bài lưng, phòng gym có tạ đơn và dây kháng lực').searchQuery)
      .not.toContain('chỉ');
  });
  it('keeps an exact named exercise for direct catalog lookup', () => {
    expect(buildExerciseRequest('Cách tập Romanian deadlift').searchQuery)
      .toMatch(/Romanian deadlift/i);
  });
  it('keeps a named exercise with its muscle context', () => {
    const request = buildExerciseRequest('Tìm bài tập lưng lat pulldown');
    expect(request.muscleGroup).toBe('Lưng');
    expect(request.searchQuery).toMatch(/lat pulldown/i);
    expect(request.exerciseName).toBe('lat pulldown');
  });
  it('recognizes one-band wording with a numeric count', () => {
    expect(buildExerciseRequest('Tìm bài tập lưng, chỉ có 1 dây kháng lực').searchQuery)
      .toContain('dây kháng lực');
  });
  it('does not force a catalog lookup for technique-only questions', () => {
    expect(isExerciseCatalogRequest('Cách squat đúng kỹ thuật là gì?')).toBe(false);
  });
  it('keeps pain and replacement advice out of the catalog lookup lane', () => {
    expect(isExerciseCatalogRequest(
      'Đầu gối hơi khó chịu khi squat. Hãy gợi ý 4 bài thay thế an toàn.',
    )).toBe(false);
  });
});
