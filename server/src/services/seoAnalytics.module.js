import { createDefaultGa4Provider } from "./googleAnalytics.provider.js";
import { createDefaultSearchConsoleProvider } from "./googleSearchConsole.provider.js";
import { createSeoAnalyticsReadService } from "./seoAnalyticsRead.service.js";
import { createSeoAnalyticsSyncService } from "./seoAnalyticsSync.service.js";

export const createSeoAnalyticsModule = ({ env = process.env } = {}) => {
  const providers = {
    ga4: createDefaultGa4Provider({ env }),
    gsc: createDefaultSearchConsoleProvider({ env }),
  };
  return {
    providers,
    readService: createSeoAnalyticsReadService({
      providerConfiguration: {
        ga4: providers.ga4.configured,
        gsc: providers.gsc.configured,
      },
    }),
    syncService: createSeoAnalyticsSyncService({ providers }),
  };
};
