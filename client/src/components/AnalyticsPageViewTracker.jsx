import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { trackAnalyticsPageView } from "../utils/analytics";

export default function AnalyticsPageViewTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    trackAnalyticsPageView(pathname);
  }, [pathname]);

  return null;
}
