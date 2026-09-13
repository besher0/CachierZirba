const BUSINESS_TIME_ZONE = 'Asia/Damascus';

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  const zonedTimeAsUtc = Date.UTC(
    Number(values.get('year')),
    Number(values.get('month')) - 1,
    Number(values.get('day')),
    Number(values.get('hour')),
    Number(values.get('minute')),
    Number(values.get('second')),
    date.getUTCMilliseconds(),
  );

  return zonedTimeAsUtc - date.getTime();
}

function toUtcDateFromZonedDateTime(
  dateOnly: string,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone = BUSINESS_TIME_ZONE,
): Date {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const utcGuess = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, millisecond),
  );
  const firstPass = new Date(
    utcGuess.getTime() - getTimeZoneOffsetMs(utcGuess, timeZone),
  );
  const secondPass = new Date(
    utcGuess.getTime() - getTimeZoneOffsetMs(firstPass, timeZone),
  );

  return secondPass;
}

function normalizeDateInput(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function toBusinessDayStartBoundary(
  value: string | undefined,
): string | undefined {
  const normalized = normalizeDateInput(value);
  if (!normalized) {
    return undefined;
  }

  if (!DATE_ONLY_REGEX.test(normalized)) {
    return normalized;
  }

  return toUtcDateFromZonedDateTime(
    normalized,
    0,
    0,
    0,
    0,
  ).toISOString();
}

export function toBusinessDayEndBoundary(
  value: string | undefined,
): string | undefined {
  const normalized = normalizeDateInput(value);
  if (!normalized) {
    return undefined;
  }

  if (!DATE_ONLY_REGEX.test(normalized)) {
    return normalized;
  }

  return toUtcDateFromZonedDateTime(
    normalized,
    23,
    59,
    59,
    999,
  ).toISOString();
}

export function toDateOnly(value: string | undefined): string | undefined {
  const normalized = normalizeDateInput(value);
  return normalized?.slice(0, 10);
}
