import { SERVICE_ACCESS_TIERS } from "../constants/serviceAccessPolicies.js";
import { resolveServiceAccessCandidates } from "./serviceAccessPolicy.service.js";

const FITNESS_PLUS_TIERS = new Set([
  SERVICE_ACCESS_TIERS.FITNESS_PLUS_ESSENTIAL,
  SERVICE_ACCESS_TIERS.FITNESS_PLUS_SMART,
  SERVICE_ACCESS_TIERS.FITNESS_PLUS_MAX,
]);

export const resolveCustomerDashboardAccess = async (actor, options = {}) => {
  const candidates = await resolveServiceAccessCandidates(actor, options);
  const tiers = new Set(candidates.map(({ tier }) => tier));
  const hasCoaching = tiers.has(SERVICE_ACCESS_TIERS.COACHING_CUSTOMER);
  const hasFitnessPlus = [...FITNESS_PLUS_TIERS].some((tier) => tiers.has(tier));
  const hasTrainerAccess =
    tiers.has(SERVICE_ACCESS_TIERS.TRAINER) ||
    tiers.has(SERVICE_ACCESS_TIERS.ADMIN);
  const accessMode = hasTrainerAccess
    ? "blocked"
    : hasCoaching
    ? "coaching"
    : hasFitnessPlus
      ? "self_managed"
      : "blocked";

  return {
    accessMode,
    hasActiveCustomerPlan: hasCoaching || hasFitnessPlus,
    hasCoaching,
    hasFitnessPlus,
    hasTrainerAccess,
  };
};
