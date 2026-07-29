const COLUMNS = [
  "eventType",
  "occurredAt",
  "timeZone",
  "targetType",
  "sourceId",
  "dateKey",
];

export const csvEscape = (input) => {
  let value = String(input ?? "");
  const formula = /^[=+\-@]/.test(value);
  if (formula) value = "'" + value;
  const escaped = value.replaceAll('"', '""');
  return formula || /[",\r\n]/.test(value)
    ? '"' + escaped + '"'
    : escaped;
};

export const coachingActivityToCsv = (data) => {
  const rows = data.items.map((item) =>
    COLUMNS.map((column) => csvEscape(item[column])).join(","),
  );
  return [COLUMNS.join(","), ...rows].join("\r\n") + "\r\n";
};
