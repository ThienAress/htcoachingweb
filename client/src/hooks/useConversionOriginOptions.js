import { useQuery } from "@tanstack/react-query";

import { adminQueryKeys } from "../queries/queryKeys";
import { getBookings } from "../services/booking.service";
import { getContactMessages } from "../services/contact.service";

export const useConversionOriginOptions = (enabled) => {
  const bookingsQuery = useQuery({
    queryKey: adminQueryKeys.conversionOrigins.bookings(),
    queryFn: ({ signal }) =>
      getBookings(1, 100, "", "", signal).then(
        (response) => response.data.data || [],
      ),
    enabled,
    staleTime: 60 * 1000,
  });
  const contactsQuery = useQuery({
    queryKey: adminQueryKeys.conversionOrigins.contacts(),
    queryFn: ({ signal }) =>
      getContactMessages(1, 100, "", "", signal).then(
        (response) => response.data.data || [],
      ),
    enabled,
    staleTime: 60 * 1000,
  });

  return {
    bookings: bookingsQuery.data || [],
    contacts: contactsQuery.data || [],
    isLoading: bookingsQuery.isLoading || contactsQuery.isLoading,
    isError: bookingsQuery.isError || contactsQuery.isError,
    retry: () => Promise.all([bookingsQuery.refetch(), contactsQuery.refetch()]),
  };
};
