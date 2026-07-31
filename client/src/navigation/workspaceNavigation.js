const ACCOUNT_WORKSPACES = {
  admin: {
    key: "admin",
    labelKey: "nav_user.admin_system",
    path: "/admin",
  },
  customerManagement: {
    key: "customerManagement",
    labelKey: "nav_user.customer_management",
    path: "/trainer",
  },
  customerDashboard: {
    key: "customerDashboard",
    labelKey: "nav_user.today_dashboard",
    path: "/dashboard",
  },
};

const TRAINER_NAVIGATION_GROUPS = [
  {
    key: "overview",
    label: "Tổng quan",
    items: [
      {
        key: "clients",
        label: "Khách hàng của tôi",
        path: "/trainer",
        exact: true,
        activePrefixes: ["/trainer/clients/"],
      },
    ],
  },
  {
    key: "trainingOperations",
    label: "Nghiệp vụ huấn luyện",
    items: [
      {
        key: "health",
        label: "Theo dõi sức khỏe",
        path: "/trainer/health",
      },
      {
        key: "checkin",
        label: "Check-in khách hàng",
        path: "/trainer/checkin",
      },
      {
        key: "coaching",
        label: "Coach Online",
        path: "/trainer/coaching",
      },
      {
        key: "schedule",
        label: "Lịch tập khách hàng",
        path: "/trainer/schedule",
      },
      {
        key: "workoutPlans",
        label: "Giáo án tập luyện",
        path: "/trainer/workout-plans",
      },
    ],
  },
  {
    key: "professionalResources",
    label: "Tài nguyên chuyên môn",
    items: [
      {
        key: "exercises",
        label: "Hệ thống bài tập",
        path: "/exercises",
      },
    ],
  },
  {
    key: "customerGrowth",
    label: "Tăng trưởng khách hàng",
    requiresF1: true,
    items: [
      {
        key: "f1Customers",
        label: "Khách hàng F1",
        path: "/f1-customers",
      },
    ],
  },
];

export const getAccountWorkspaceItems = ({
  isAdmin = false,
  hasTrainerAccess = false,
} = {}) => {
  if (isAdmin) {
    return [ACCOUNT_WORKSPACES.admin, ACCOUNT_WORKSPACES.customerManagement];
  }

  if (hasTrainerAccess) {
    return [ACCOUNT_WORKSPACES.customerManagement];
  }

  return [ACCOUNT_WORKSPACES.customerDashboard];
};

export const getTrainerNavigationGroups = ({ f1Allowed = false } = {}) =>
  TRAINER_NAVIGATION_GROUPS.filter(
    (group) => !group.requiresF1 || f1Allowed,
  ).map((group) => ({
    ...group,
    items: group.items.map((item) => ({ ...item })),
  }));

export const isTrainerNavigationItemActive = (itemKey, pathname) => {
  const item = TRAINER_NAVIGATION_GROUPS.flatMap(
    (group) => group.items,
  ).find((candidate) => candidate.key === itemKey);

  if (!item || typeof pathname !== "string") return false;

  if (pathname === item.path) return true;
  if (item.activePrefixes?.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  return !item.exact && pathname.startsWith(`${item.path}/`);
};

export const getWorkoutPlanWorkspacePath = (
  planId,
  { embedded = true } = {},
) => {
  const basePath = embedded
    ? "/trainer/workout-plans"
    : "/workout-plans";

  return planId
    ? `${basePath}/${encodeURIComponent(String(planId))}`
    : basePath;
};
