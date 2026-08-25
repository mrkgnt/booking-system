import { useEffect, useRef, useState } from "react";
import type { ApiClientConfig } from "../lib/api/client.js";
import { listBookings, type Booking } from "../lib/api/bookings.js";
import { listBusinessHours, type BusinessHour } from "../lib/api/business-hours.js";
import { listClosures, type Closure } from "../lib/api/closures.js";
import type { StaffMember } from "../lib/api/catalog.js";
import { describeApiError } from "../lib/api/errors.js";
import { addWeeks, formatWeekRangeLabel, getWeekDays, getWeekStart, toDateKey } from "../lib/dashboard/date-utils.js";
import { computeBookingStats } from "../lib/dashboard/dashboard-stats.js";
import StatsCards from "./dashboard/StatsCards.js";
import WeekCalendar from "./dashboard/WeekCalendar.js";
import DatePickerButton from "./dashboard/DatePickerButton.js";

type Props = {
  apiConfig: ApiClientConfig;
  staff: StaffMember[];
  initialWeekStartKey: string;
  initialBookings: Booking[];
  initialBusinessHours: BusinessHour[];
  initialClosures: Closure[];
};

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function weekRangeIso(weekStart: Date): { from: string; to: string } {
  const days = getWeekDays(weekStart);
  const from = new Date(days[0]);
  from.setHours(0, 0, 0, 0);
  const to = new Date(days[6]);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function DashboardScreen({
  apiConfig,
  staff,
  initialWeekStartKey,
  initialBookings,
  initialBusinessHours,
  initialClosures,
}: Props) {
  const [weekStart, setWeekStart] = useState(() => parseDateKey(initialWeekStartKey));
  const [staffId, setStaffId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>(initialBusinessHours);
  const [closures, setClosures] = useState<Closure[]>(initialClosures);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInitialRender = useRef(true);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return; // SSR already provided this exact data — skip the redundant refetch
    }
    let cancelled = false;
    async function refresh() {
      setLoading(true);
      setError(null);
      try {
        const { from, to } = weekRangeIso(weekStart);
        // Business hours/closures are fetched business-wide (staffId: null)
        // unconditionally, then unioned with the staff-specific fetch when a
        // staff filter is active. The API's staffId query param is a strict
        // .eq() filter with no fallback — a staff member with no hours/
        // closures of their own (true for every staff at Dent Di today, per
        // db/seed/generate-seed.ts) comes back as an empty array, which would
        // otherwise make the calendar render as "closed all week" for that
        // staff even though the business-wide hours actually apply. Ordering
        // staff-specific first means WeekCalendar's businessHours.find(...)
        // still prefers a real staff override for any day that has one.
        const [b, businessWideHours, businessWideClosures, staffHours, staffClosures] = await Promise.all([
          listBookings(apiConfig, { from, to, staffId: staffId || undefined }),
          listBusinessHours(apiConfig, null),
          listClosures(apiConfig, null),
          staffId ? listBusinessHours(apiConfig, staffId) : Promise.resolve([] as BusinessHour[]),
          staffId ? listClosures(apiConfig, staffId) : Promise.resolve([] as Closure[]),
        ]);
        if (cancelled) return;
        setBookings(b);
        setBusinessHours([...staffHours, ...businessWideHours]);
        setClosures([...staffClosures, ...businessWideClosures]);
      } catch (err) {
        if (!cancelled) setError(describeApiError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    refresh();
    return () => {
      cancelled = true;
    };
  }, [weekStart.getTime(), staffId]);

  const stats = computeBookingStats(bookings);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">{formatWeekRangeLabel(weekStart)}</h2>
          <button className="rounded border border-gray-300 px-3 py-1.5 text-sm" onClick={() => setWeekStart((w) => addWeeks(w, -1))}>
            Previous week
          </button>
          <button className="rounded border border-gray-300 px-3 py-1.5 text-sm" onClick={() => setWeekStart(getWeekStart(new Date()))}>
            This week
          </button>
          <button className="rounded border border-gray-300 px-3 py-1.5 text-sm" onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
            Next week
          </button>
          <DatePickerButton onSelect={(date) => setWeekStart(getWeekStart(date))} />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="dashboard-staff-filter" className="text-sm font-medium">
            Staff
          </label>
          <select
            id="dashboard-staff-filter"
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
          >
            <option value="">All staff</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <StatsCards stats={stats} />

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <WeekCalendar weekStart={weekStart} bookings={bookings} businessHours={businessHours} closures={closures} staffId={staffId || null} />
      )}
    </div>
  );
}
