import { Navigate } from "react-router-dom";
import { TODAY_PLATFORM_ENABLED } from "../config/featureFlags";

const TodayPlatformRoute = ({ children, fallback = "/account" }) =>
  TODAY_PLATFORM_ENABLED ? children : <Navigate to={fallback} replace />;

export default TodayPlatformRoute;
