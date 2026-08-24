import { useState } from "react";
import type { ApiClientConfig } from "../lib/api/client.js";
import { updatePatient, type Patient } from "../lib/api/patients.js";
import type { Booking } from "../lib/api/bookings.js";
import { describeApiError } from "../lib/api/errors.js";
import { formatBookingTime } from "../lib/format.js";

type Props = { apiConfig: ApiClientConfig; patient: Patient; bookings: Booking[] };

export default function PatientDetailScreen({ apiConfig, patient, bookings }: Props) {
  const [name, setName] = useState(patient.name);
  const [email, setEmail] = useState(patient.email ?? "");
  const [phone, setPhone] = useState(patient.phone ?? "");
  const [notes, setNotes] = useState(patient.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updatePatient(apiConfig, patient.id, {
        name,
        email: email || undefined,
        phone: phone || undefined,
        notes,
      });
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <a className="text-sm text-blue-600 hover:underline" href="/patients">Back to patients</a>
      <h2 className="text-lg font-semibold">{patient.name}</h2>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={handleSave} className="space-y-3 rounded border border-gray-200 bg-white p-4">
        <input
          placeholder="Name"
          className="block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="Email"
          className="block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          placeholder="Phone"
          className="block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <textarea
          placeholder="Notes"
          className="block w-full rounded border border-gray-300 px-2 py-1 text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button type="submit" disabled={saving} className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white">
          Save
        </button>
      </form>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2">Starts</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id} className="border-b border-gray-100">
              <td className="py-2">{formatBookingTime(b.starts_at)}</td>
              <td>{b.status}</td>
            </tr>
          ))}
          {bookings.length === 0 && <tr><td colSpan={2} className="py-4 text-gray-400">No bookings.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
