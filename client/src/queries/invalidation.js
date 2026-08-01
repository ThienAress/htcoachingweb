export const invalidateByKey = (queryClient, queryKey, options) =>
  queryClient.invalidateQueries({ queryKey }, options);