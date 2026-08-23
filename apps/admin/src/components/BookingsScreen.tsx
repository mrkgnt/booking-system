import { useEffect, useState } from "react";
import type { ApiClientConfig } from "../lib/api/client.js";
import { cancelBooking, forceBookBooking, listBookings, rescheduleBooking, type Booking, type BookingStatus, type ListBookingsFilters } from "../lib/api/bookings.js";
import type { Service, StaffMember } from "../lib/api/catalog.js";
import { describeApiError } from "../lib/api/errors.js";
import { validateForceBookForm, type ForceBookFormValues } from "../lib/api/validate-force-book.js";
import { formatBookingTime, toDatetimeLocalValue } from "../lib/format.js";

const STATUSES: BookingStatus[] = ["pending_verification", "confirmed", "completed", "cancelled", "no_show"];

type Props = { apiConfig: ApiClientConfig; services: Service[]; staff: StaffMember[] };

export default function BookingsScreen({ apiConfig, services, staff }: Props) {
  const [filters, setFilters] = useState<ListBookingsFilters>({});
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formValues, setFormValues] = useState<ForceBookFormValues>({
    serviceId: "", staffId: "", startsAt: "", locale: "lv", patientName: "", patientEmail: "", patientPhone: "",
  });
  const [formErrors, setFormErrors] = useState<string[]>([]);

  async function handleForceBook(e: React.FormEvent) {
    e.preventDefault();
    const errors = validateForceBookForm(formValues);
    setFormErrors(errors);
    if (errors.length > 0) return;
    try {
      await forceBookBooking(apiConfig, {
        serviceId: formValues.serviceId, staffId: formValues.staffId,
        startsAt: new Date(formValues.startsAt).toISOString(), locale: formValues.locale as "lv" | "ru" | "en",
        patient: { name: formValues.patientName, email: formValues.patientEmail || undefined, phone: formValues.patientPhone || undefined },
      });
      setShowForm(false);
      await refresh();
    } catch (err) {
      setFormErrors([describeApiError(err)]);
    }
  }

  async function handleCancel(bookingId: string) {
    if (!window.confirm("Cancel this booking?")) return;
    try {
      await cancelBooking(apiConfig, bookingId);
      await refresh();
    } catch (err) {
      setError(describeApiError(err));
    }
  }

  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [newStartsAt, setNewStartsAt] = useState("");

  async function handleReschedule(bookingId: string) {
    try {
      await rescheduleBooking(apiConfig, bookingId, new Date(newStartsAt).toISOString());
      setReschedulingId(null);
      await refresh();
    } catch (err) {
      setError(describeApiError(err));
    }
  }

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
                <td>
                  {!["cancelled", "completed", "no_show"].includes(b.status) && (
                    <>
                      <button className="text-sm text-red-600 hover:underline" onClick={() => handleCancel(b.id)}>Cancel</button>{" "}
                      <button className="text-sm text-blue-600 hover:underline"
                        onClick={() => { setReschedulingId(b.id); setNewStartsAt(toDatetimeLocalValue(b.starts_at)); }}>
                        Reschedule
                      </button>
                      {reschedulingId === b.id && (
                        <span className="ml-2 inline-flex gap-2">
                          <input type="datetime-local" value={newStartsAt} onChange={(e) => setNewStartsAt(e.target.value)} />
                          <button className="text-sm text-gray-900" onClick={() => handleReschedule(b.id)}>Save</button>
                        </span>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
            {bookings.length === 0 && <tr><td colSpan={5} className="py-4 text-gray-400">No bookings match these filters.</td></tr>}
          </tbody>
        </table>
      )}
      <button className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white" onClick={() => setShowForm((v) => !v)}>
        {showForm ? "Cancel" : "New booking"}
      </button>
      {showForm && (
        <form onSubmit={handleForceBook} className="space-y-3 rounded border border-gray-200 bg-white p-4">
          {formErrors.map((msg) => <p key={msg} className="text-sm text-red-700">{msg}</p>)}
          <select value={formValues.serviceId} onChange={(e) => setFormValues((v) => ({ ...v, serviceId: e.target.value }))}>
            <option value="">Select service</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name.lv ?? Object.values(s.name)[0]}</option>)}
          </select>
          <select value={formValues.staffId} onChange={(e) => setFormValues((v) => ({ ...v, staffId: e.target.value }))}>
            <option value="">Select staff</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="datetime-local" value={formValues.startsAt} onChange={(e) => setFormValues((v) => ({ ...v, startsAt: e.target.value }))} />
          <input placeholder="Patient name" value={formValues.patientName} onChange={(e) => setFormValues((v) => ({ ...v, patientName: e.target.value }))} />
          <input placeholder="Email" value={formValues.patientEmail} onChange={(e) => setFormValues((v) => ({ ...v, patientEmail: e.target.value }))} />
          <input placeholder="Phone" value={formValues.patientPhone} onChange={(e) => setFormValues((v) => ({ ...v, patientPhone: e.target.value }))} />
          <button type="submit" className="rounded bg-gray-900 px-3 py-2 text-sm text-white">Book</button>
        </form>
      )}
    </div>
  );
}
