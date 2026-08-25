import { formatDayLabel, getWeekDays, toDateKey } from "../../lib/dashboard/date-utils.js";
import {
  computeEventPosition,
  computeOpenHoursPosition,
  isDateClosed,
  toRigaDateKey,
  type GridWindow,
} from "../../lib/dashboard/calendar-layout.js";
import type { Booking } from "../../lib/api/bookings.js";
import type { BusinessHour } from "../../lib/api/business-hours.js";
import type { Closure } from "../../lib/api/closures.js";

type Props = {
  weekStart: Date;
  bookings: Booking[];
  businessHours: BusinessHour[];
  closures: Closure[];
  staffId: string | null;
};

const GRID_START_HOUR = 7;
const GRID_END_HOUR = 20;
const PX_PER_HOUR = 60;
const HOURS = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => GRID_START_HOUR + i);
const WINDOW: GridWindow = { startHour: GRID_START_HOUR, endHour: GRID_END_HOUR, pxPerHour: PX_PER_HOUR };

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-900 border-blue-300",
  pending_verification: "bg-amber-100 text-amber-900 border-amber-300",
  completed: "bg-green-100 text-green-900 border-green-300",
  no_show: "bg-red-100 text-red-900 border-red-300",
};

const TIME_LABEL_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Riga",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export default function WeekCalendar({ weekStart, bookings, businessHours, closures, staffId }: Props) {
  const days = getWeekDays(weekStart);
  const gridHeight = (GRID_END_HOUR - GRID_START_HOUR) * PX_PER_HOUR;
  const closureRanges = closures.map((c) => ({
    staffId: c.staff_id,
    startsOn: c.starts_on,
    endsOn: c.ends_on,
    isRecurringYearly: c.is_recurring_yearly,
  }));

  return (
    <div className="overflow-x-auto rounded border border-gray-200 bg-white">
      <div className="grid" style={{ gridTemplateColumns: "4rem repeat(7, minmax(9rem, 1fr))" }}>
        <div />
        {days.map((day) => (
          <div key={toDateKey(day)} className="border-b border-l border-gray-200 p-2 text-center">
            <h3 className="text-sm font-semibold">{formatDayLabel(day)}</h3>
          </div>
        ))}

        <div className="relative" style={{ height: gridHeight }}>
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="absolute right-0 left-0 border-t border-gray-100 pr-2 text-right text-xs text-gray-400"
              style={{ top: (hour - GRID_START_HOUR) * PX_PER_HOUR }}
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {days.map((day) => {
          const dayKey = toDateKey(day);
          const dow = day.getDay();
          const hoursForDay = businessHours.find((h) => h.day_of_week === dow);
          const openPos = computeOpenHoursPosition(
            hoursForDay
              ? { opensAt: hoursForDay.opens_at, closesAt: hoursForDay.closes_at, isClosed: hoursForDay.is_closed }
              : undefined,
            WINDOW,
          );
          const closed = isDateClosed(dayKey, closureRanges, staffId);
          const dayBookings = bookings.filter((b) => b.status !== "cancelled" && toRigaDateKey(b.starts_at) === dayKey);

          return (
            <div key={dayKey} className="relative border-l border-gray-200" style={{ height: gridHeight }}>
              {!closed && openPos && (
                <div className="absolute right-0 left-0 bg-green-50" style={{ top: openPos.topPx, height: openPos.heightPx }} />
              )}
              {closed && <div className="absolute inset-0 bg-gray-100" />}
              <ul role="list" aria-label={`Bookings on ${formatDayLabel(day)}`} className="absolute inset-0">
                {dayBookings.map((b) => {
                  const pos = computeEventPosition(b.starts_at, b.ends_at, WINDOW);
                  if (!pos) return null;
                  const timeLabel = TIME_LABEL_FORMAT.format(new Date(b.starts_at));
                  return (
                    <li
                      key={b.id}
                      role="listitem"
                      className={`absolute right-1 left-1 overflow-hidden rounded border px-1 text-xs ${STATUS_STYLES[b.status] ?? "bg-gray-100 text-gray-700 border-gray-300"}`}
                      style={{ top: pos.topPx, height: pos.heightPx }}
                    >
                      {timeLabel} · {b.status}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
