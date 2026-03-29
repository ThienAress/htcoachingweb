// Chuyển UTC string thành local datetime-local value (YYYY-MM-DDTHH:mm)
export const utcToLocalDateTime = (utcString) => {
  if (!utcString) return "";
  const date = new Date(utcString);
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Chuyển local datetime-local value (YYYY-MM-DDTHH:mm) thành UTC ISO string
export const localDateTimeToUTC = (localDateTimeString) => {
  if (!localDateTimeString) return "";
  const date = new Date(localDateTimeString);
  if (isNaN(date.getTime())) return "";
  return date.toISOString();
};
