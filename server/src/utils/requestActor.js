export const getRequestActor = (req) => ({
  id: req.user.id,
  role: req.isAdmin
    ? "admin"
    : req.isTrainer
      ? "trainer"
      : req.user.role,
});

export const getContextualRequestActor = (req) => ({
  id: req.user.id,
  role: req.user.role,
  canActAsTrainer: Boolean(req.isTrainer && !req.isAdmin),
});
