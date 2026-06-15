export const BUSINESS_TIME_ZONE = "Asia/Damascus";

export function toIsoDateOnlyInTimeZone(
  date: Date,
  timeZone = BUSINESS_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

export function toDateTimeMinuteInTimeZone(
  date: Date,
  timeZone = BUSINESS_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return `${values.get("year")}-${values.get("month")}-${values.get("day")} ${values.get("hour")}:${values.get("minute")}`;
}

export function correctLegacyUtcDateOnly(
  dateOnly: string,
  eventTimeIso: string | null | undefined,
  timeZone = BUSINESS_TIME_ZONE,
): string {
  if (!eventTimeIso) {
    return dateOnly;
  }

  const eventTime = new Date(eventTimeIso);
  if (Number.isNaN(eventTime.getTime())) {
    return dateOnly;
  }

  const utcDate = eventTime.toISOString().slice(0, 10);
  if (dateOnly !== utcDate) {
    return dateOnly;
  }

  return toIsoDateOnlyInTimeZone(eventTime, timeZone);
}
