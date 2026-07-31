export const toHabitCompletionCommands = (completions = []) =>
  completions.map((completion) => ({
    habitId: completion.habitId,
    status: completion.status,
  }));

export const upsertHabitCompletion = (
  completions,
  { habitId, lineageKey, status },
) => {
  const index = completions.findIndex(
    (completion) =>
      completion.lineageKey === lineageKey || completion.habitId === habitId,
  );
  const next = toHabitCompletionCommands(completions);
  const value = { habitId, status };
  if (index >= 0) next[index] = value;
  else {
    if (next.length >= 20) {
      throw new Error("Mỗi ngày có tối đa 20 lượt hoàn thành thói quen");
    }
    next.push(value);
  }
  return next;
};
