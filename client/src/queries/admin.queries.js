import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import { getBookings } from "../services/booking.service";
import { adminQueryKeys } from "./queryKeys";

export const adminBookingsQueryOptions = ({
  page,
  limit = 9,
  status,
  search,
}) => {
  const filters = { page, limit, status, search };

  return queryOptions({
    queryKey: adminQueryKeys.bookings.list(filters),
    queryFn: ({ signal }) =>
      getBookings(page, limit, status, search, signal).then((response) => ({
        items: response.data.data,
        pagination: response.data.pagination,
      })),
    placeholderData: keepPreviousData,
  });
};