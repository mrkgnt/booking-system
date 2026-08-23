import { useEffect, useState } from "react";
import type { ApiClientConfig } from "../lib/api/client.js";
import { listBookings, type Booking, type BookingStatus, type ListBookingsFilters } from "../lib/api/bookings.js";
import type { Service, StaffMember } from "../lib/api/catalog.js";
import { describeApiError } from "../lib/api/errors.js";
import { formatBookingTime } from "../lib/format.js";

const STATUSES: BookingStatus[] = ["pending_verification", "confirmed", "completed", "cancelled", "no_show"];

type Props = { apiConfig: ApiClientConfig; services: Service[]; staff: StaffMember[] };

export default function BookingsScreen({ apiConfig, services, staff }: Props) {
  const [filters, setFilters] = useState<ListBookingsFilters>({});
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setBookings(await listBookings(apiConfig, filters));
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [filters.status, filters.staffId, filters.from, filters.to]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <select
          className="rounded border border-gray-300 px-2 py-1 text-sm"
          value={filters.status ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, status: (e.target.value || undefined) as BookingStatus | undefined }))}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          className="rounded border border-gray-300 px-2 py-1 text-sm"
          value={filters.staffId ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, staffId: e.target.value || undefined }))}
        >
          <option value="">All staff</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="date" className="rounded border border-gray-300 px-2 py-1 text-sm"
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value ? new Date(e.target.value).toISOString() : undefined }))} />
        <input type="date" className="rounded border border-gray-300 px-2 py-1 text-sm"
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value ? new Date(e.target.value).toISOString() : undefined }))} />
      </div>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Starts</th><th>Status</th><th>Staff</th><th>Source</th><th></th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-b border-gray-100">
                <td className="py-2">{formatBookingTime(b.starts_at)}</td>
                <td>{b.status}</td>
                <td>{staff.find((s) => s.id === b.staff_id)?.name ?? "—"}</td>
                <td>{b.source}</td>
                <td>{/* cancel/reschedule row actions land here in Tasks 12–13 */}</td>
              </tr>
            ))}
            {bookings.length === 0 && <tr><td colSpan={5} className="py-4 text-gray-400">No bookings match these filters.</td></tr>}
          </tbody>
        </table>
      )}
      {/* Force-book "New booking" toggle lands here in Task 11 */}
    </div>
  );
}
