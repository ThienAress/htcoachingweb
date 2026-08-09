const listKey = (root, filters) => [...root, "list", filters];

export const subscriptionKeys = {
  all: () => ["route-subscription"],
  mine: (userId) => [...subscriptionKeys.all(), userId],
};

export const walletAccountKeys = {
  wallet: {
    all: () => ["wallet"],
    mine: (userId) => [...walletAccountKeys.wallet.all(), "mine", userId],
    deposits: (userId) => [
      ...walletAccountKeys.wallet.all(),
      "deposits",
      userId,
    ],
    policy: () => ["deposit-policy"],
  },
  account: {
    all: () => ["account"],
    orders: (userId) => [
      ...walletAccountKeys.account.all(),
      "orders",
      userId,
    ],
    transactions: (userId) => [
      ...walletAccountKeys.account.all(),
      "transactions",
      userId,
    ],
    contracts: (userId) => [
      ...walletAccountKeys.account.all(),
      "contracts",
      userId,
    ],
  },
};

export const coachingKeys = {
  all: () => ["coaching"],
  foodDatabase: () => ["foods", "catalog"],
  mealPlanAccess: (userId) => ["meal-plan-access", userId],
  trainerClients: () => ["trainer-clients"],
};

export const adminQueryKeys = {
  bookings: {
    all: () => ["admin-bookings"],
    list: (filters) => listKey(adminQueryKeys.bookings.all(), filters),
  },
  blogPosts: {
    all: () => ["admin-blog-posts"],
    list: (filters) => listKey(adminQueryKeys.blogPosts.all(), filters),
  },
  checkins: {
    all: () => ["checkins"],
    list: (filters) => listKey(adminQueryKeys.checkins.all(), filters),
  },
  contactMessages: {
    all: () => ["contactMessages"],
    list: (filters) => listKey(adminQueryKeys.contactMessages.all(), filters),
  },
  customerStories: {
    all: () => ["admin-customer-stories"],
    list: (filters) => listKey(adminQueryKeys.customerStories.all(), filters),
  },
  exercises: {
    all: () => ["exercises"],
    list: (filters) => listKey(adminQueryKeys.exercises.all(), filters),
  },
  exerciseSuggestions: {
    all: () => ["exerciseSuggestions"],
    list: (filters) =>
      listKey(adminQueryKeys.exerciseSuggestions.all(), filters),
  },
  f1AiRules: {
    all: () => ["f1AiRules"],
  },
  foods: {
    all: () => ["foods"],
    list: (filters) => listKey(adminQueryKeys.foods.all(), filters),
  },
  orders: {
    all: () => ["orders"],
    list: (filters) => listKey(adminQueryKeys.orders.all(), filters),
  },
  siteSettings: {
    all: () => ["site-settings"],
  },
  subscribers: {
    all: () => ["subscribers"],
    list: (filters) => listKey(adminQueryKeys.subscribers.all(), filters),
  },
  trainers: {
    all: () => ["admin-trainers"],
    list: (filters) => listKey(adminQueryKeys.trainers.all(), filters),
    details: () => ["admin-trainer-detail"],
    detail: (trainerId) => [
      ...adminQueryKeys.trainers.details(),
      trainerId,
    ],
  },
  users: {
    all: () => ["users"],
    list: (filters) => listKey(adminQueryKeys.users.all(), filters),
  },
};

export const publicRecipeKeys = {
  all: () => ["recipes"],
  list: (filters) => listKey(publicRecipeKeys.all(), filters),
  detail: (slug, language) => ["recipe", slug, language],
  bookmarks: (userId) => ["recipe-bookmarks", userId || "anonymous"],
};