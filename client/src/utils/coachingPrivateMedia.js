export const buildExerciseFeedbackPayload = (exercise) => ({
  exerciseId: exercise._id,
  completed: Boolean(exercise.completed),
  clientFeedbackNote: exercise.clientFeedbackNote || "",
});
