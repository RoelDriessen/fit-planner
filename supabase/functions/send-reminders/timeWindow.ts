// Pure date/time helpers — no Deno/network dependencies, easy to unit test.

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface LocalParts {
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
  weekday: number; // 0=Sun..6=Sat, matches JS Date.getDay() / weekly_reminder_day
}

// Computes the given instant's local date/time/weekday in an IANA timezone,
// via Intl formatting rather than string-round-tripping through toLocaleString,
// so it stays correct across DST transitions.
export function localParts(date: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;

  const weekdayStr = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);

  return {
    dateStr: `${map.year}-${map.month}-${map.day}`,
    timeStr: `${map.hour}:${map.minute}`,
    weekday: WEEKDAY_INDEX[weekdayStr] ?? 0,
  };
}

// True if currentTimeStr ("HH:mm") falls within [targetTimeStr, targetTimeStr + bucketMinutes).
// A bucket (not exact-match) keeps this robust to a missed or delayed cron tick.
export function isWithinBucket(currentTimeStr: string, targetTimeStr: string, bucketMinutes = 10): boolean {
  const toMinutes = (t: string) => {
    const [h, m] = t.slice(0, 5).split(":").map(Number);
    return h * 60 + m;
  };
  const current = toMinutes(currentTimeStr);
  const target = toMinutes(targetTimeStr);
  return current >= target && current < target + bucketMinutes;
}
