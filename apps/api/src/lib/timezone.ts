// Minimal timezone helpers using only the built-in Intl API — no extra
// dependency for what's a narrow need (convert a tenant-local wall-clock
// time into the correct UTC instant). Uses the standard "two-pass" offset
// trick: format a UTC guess in the target zone, measure the drift, correct
// once. This converges correctly except in the exact seconds around a DST
// transition — acceptable for appointment-slot granularity (15+ minutes),
// and DST transitions land outside business hours in practice. Flagging
// this as a known simplification rather than silently assuming perfection;
// revisit with a real tz library (e.g. luxon) if this ever bites.

function getTimezoneOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - date.getTime()) / 60_000;
}

// dateISO: 'YYYY-MM-DD', time: 'HH:MM' or 'HH:MM:SS', both interpreted as
// wall-clock time in `timeZone`. Returns the equivalent UTC instant.
export function zonedTimeToUtc(dateISO: string, time: string, timeZone: string): Date {
  const [year, month, day] = dateISO.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute);

  let guess = new Date(naiveUtcMs);
  for (let i = 0; i < 2; i++) {
    const offsetMinutes = getTimezoneOffsetMinutes(guess, timeZone);
    guess = new Date(naiveUtcMs - offsetMinutes * 60_000);
  }
  return guess;
}
