export const retryServerQueryOnce = (failureCount, error) => {
  const status = error?.response?.status;
  return failureCount < 1 && (!status || status >= 500);
};
