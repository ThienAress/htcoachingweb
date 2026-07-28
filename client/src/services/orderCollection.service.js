import { getOrders } from "./order.service";

export const getAllOrders = async () => {
  const limit = 100;
  const first = await getOrders(1, limit);
  const firstData = first.data.data;
  if (firstData.totalPages <= 1) return firstData.orders || [];

  const remaining = await Promise.all(
    Array.from({ length: firstData.totalPages - 1 }, (_, index) =>
      getOrders(index + 2, limit),
    ),
  );
  return [
    ...(firstData.orders || []),
    ...remaining.flatMap((response) => response.data.data.orders || []),
  ];
};
