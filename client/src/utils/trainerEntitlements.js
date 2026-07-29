export const canAccessF1 = (user, subscription) => {
  if (user?.role === "admin") return true;
  return subscription?.entitlements?.f1CrmAi === true;
};
