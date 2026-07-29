import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { getTodayDashboardDay } from "../services/todayDashboard.service";
import { adaptTodayDashboard } from "../pages/today-dashboard/todayDashboard.adapter";
import { isValidDateKey } from "../utils/vietnamDate";

export const useTodayDashboardDay = (dateKey) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const validDate = isValidDateKey(dateKey);
  const query = useQuery({
    queryKey: ["today-dashboard", user?._id, dateKey],
    queryFn: async () => {
      const response = await getTodayDashboardDay(dateKey);
      return adaptTodayDashboard(response.data.data);
    },
    enabled: Boolean(user?._id && validDate),
    staleTime: 30_000,
    retry: (count, error) =>
      count < 1 && Number(error.response?.status || 500) >= 500,
  });
  const refetchToday = query.refetch;

  const handleJournalChanged = useCallback(
    (journal) => {
      if (journal) {
        queryClient.setQueryData(
          ["today-dashboard", user?._id, dateKey],
          (current) =>
            current
              ? {
                  ...current,
                  sections: {
                    ...current.sections,
                    journal: {
                      ...current.sections.journal,
                      status: "ready",
                      day: journal,
                    },
                  },
                }
              : current,
        );
      }
      void refetchToday();
    },
    [dateKey, queryClient, refetchToday, user?._id],
  );

  return { handleJournalChanged, query, validDate };
};
