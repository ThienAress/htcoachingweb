import { Navigate } from "react-router-dom";
import { getVietnamDateKey } from "../../utils/vietnamDate";

const TodayDashboardIndex = () => (
  <Navigate to={"/dashboard/today/" + getVietnamDateKey()} replace />
);

export default TodayDashboardIndex;
