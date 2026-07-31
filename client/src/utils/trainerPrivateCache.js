export const TRAINER_PRIVATE_QUERY_ROOTS = Object.freeze([
  "coaching-comments",
  "coaching-activity",
  "coaching-habits",
  "daily-journal-timeline",
  "progress",
  "today-dashboard",
  "trainer-clients",
  "weekly-checkin",
  "wellness-target",
]);

export const purgeTrainerPrivateQueries = async (
  queryClient,
  { type = "all" } = {},
) => {
  await Promise.all(
    TRAINER_PRIVATE_QUERY_ROOTS.map(async (root) => {
      const filters = { queryKey: [root], type };
      await queryClient.cancelQueries(filters);
      queryClient.removeQueries(filters);
    }),
  );
};
