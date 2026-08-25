/** Monday of the week containing `date`, at local midnight. */
export function getWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Sunday..6=Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

/** The 7 dates (Mon..Sun) of the week starting at `weekStart`. */
export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function addWeeks(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

/** 'YYYY-MM-DD' in local time — a stable per-day key, not a UTC conversion. */
export function toDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const WEEKDAY_FORMAT = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const MONTH_DAY_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

export function formatDayLabel(date: Date): string {
  return WEEKDAY_FORMAT.format(date);
}

/** e.g. "5 Jan – 11 Jan, 2026" for the Mon..Sun week starting at weekStart. */
export function formatWeekRangeLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return `${MONTH_DAY_FORMAT.format(weekStart)} – ${MONTH_DAY_FORMAT.format(weekEnd)}, ${weekEnd.getFullYear()}`;
}
