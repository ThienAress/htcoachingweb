export const getInitialEmailSelectionError = (preferences) =>
  preferences?.customerEmailConfigured !== true &&
  !preferences?.morningHealthEmail &&
  !preferences?.checkinEmail
    ? "Hãy chọn ít nhất một email thông báo trước khi lưu"
    : "";
