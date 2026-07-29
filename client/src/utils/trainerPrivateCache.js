export const TRAINER_PRIVATE_QUERY_ROOTS = Object.freeze([
  "coaching-comments",
  "coaching-activity",
  "coaching-habits",
  "daily-journal-timeline",
  "progress",
  "today-dashboard",
  "weekly-checkin",
]);

export const purgeTrainerPrivateQueries = async (queryClient) => {
  await Promise.all(
    TRAINER_PRIVATE_QUERY_ROOTS.map((root) =>
      queryClient.resetQueries({ queryKey: [root], type: "all" }),
    ),
  );
};
