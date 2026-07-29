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
      throw new Error("A day can contain at most 20 habit completions");
    }
    next.push(value);
  }
  return next;
};
