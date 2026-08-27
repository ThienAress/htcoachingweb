const listKey = (root, filters) => [...root, "list", filters];

export const subscriptionKeys = {
  all: () => ["route-subscription"],
  mine: (userId) => [...subscriptionKeys.all(), userId],
};

export const fitnessPlusKeys = {
  all: () => ["fitness-plus"],
  catalog: () => [...fitnessPlusKeys.all(), "catalog"],
  mine: (userId) => [...fitnessPlusKeys.all(), "mine", userId],
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
  mealPlanPreferences: (userId) => ["meal-plan-preferences", userId],
  trainerClients: () => ["trainer-clients"],
};

export const aiMemoryKeys = {
  all: () => ["ai-memory"],
  mine: (userId) => [...aiMemoryKeys.all(), userId],
};

export const adminQueryKeys = {
  skillRadar: {
    all: () => ["admin-skill-radar"],
  },
  serviceAccessPolicies: {
    all: () => ["admin-service-access-policies"],
    communityFeatureReport: (filters) => [
      ...adminQueryKeys.serviceAccessPolicies.all(),
      "community-feature-report",
      filters,
    ],
  },
  conversionOrigins: {
    all: () => ["admin-conversion-origins"],
    bookings: () => [...adminQueryKeys.conversionOrigins.all(), "bookings"],
    contacts: () => [...adminQueryKeys.conversionOrigins.all(), "contacts"],
  },
  seoAnalytics: {
    all: () => ["admin-seo-analytics"],
    overview: (filters) => [
      ...adminQueryKeys.seoAnalytics.all(),
      "overview",
      filters,
    ],
    providers: () => [
      ...adminQueryKeys.seoAnalytics.all(),
      "providers",
    ],
    blogs: {
      all: () => [...adminQueryKeys.seoAnalytics.all(), "blogs"],
      list: (filters) =>
        listKey(adminQueryKeys.seoAnalytics.blogs.all(), filters),
      detail: (slug, filters) => [
        ...adminQueryKeys.seoAnalytics.blogs.all(),
        "detail",
        slug,
        filters,
      ],
    },
    keywords: {
      all: () => [...adminQueryKeys.seoAnalytics.all(), "keywords"],
      list: (filters) =>
        listKey(adminQueryKeys.seoAnalytics.keywords.all(), filters),
    },
  },
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
  reviews: (recipeId) => ["recipe-reviews", recipeId],
};

export const publicExerciseKeys = {
  all: () => ["public-exercises"],
  detail: (exerciseId, language) => [
    ...publicExerciseKeys.all(),
    "detail",
    exerciseId,
    language,
  ],
  reviews: (exerciseId) => [
    ...publicExerciseKeys.all(),
    "reviews",
    exerciseId,
  ],
};
