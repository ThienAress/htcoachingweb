import { Navigate, useParams } from "react-router-dom";
import { dashboardPathFor } from "../../utils/customerDashboardNavigation";
import { getVietnamDateKey, isValidDateKey } from "../../utils/vietnamDate";

const LegacyDashboardRedirect = ({ destination = "today" }) => {
  const { dateKey } = useParams();
  const resolvedDate = isValidDateKey(dateKey) ? dateKey : getVietnamDateKey();
  return (
    <Navigate
      to={dashboardPathFor(destination, resolvedDate)}
      replace
    />
  );
};

export default LegacyDashboardRedirect;
