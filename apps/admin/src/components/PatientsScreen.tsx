import { useEffect, useRef, useState } from "react";
import type { ApiClientConfig } from "../lib/api/client.js";
import { listPatients, type Patient } from "../lib/api/patients.js";
import { describeApiError } from "../lib/api/errors.js";
import { formatBookingTime } from "../lib/format.js";

type Props = { apiConfig: ApiClientConfig; patients: Patient[] };

export default function PatientsScreen({ apiConfig, patients: initialPatients }: Props) {
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<Patient[]>(initialPatients);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skippedInitialFetch = useRef(false);

  useEffect(() => {
    if (!skippedInitialFetch.current && query === "") {
      skippedInitialFetch.current = true;
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    listPatients(apiConfig, query || undefined)
      .then((result) => {
        if (!cancelled) setPatients(result);
      })
      .catch((err) => {
        if (!cancelled) setError(describeApiError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search patients"
        className="rounded border border-gray-300 px-2 py-1 text-sm"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Name</th><th>Email</th><th>Phone</th><th>Created</th><th></th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="py-2">{p.name}</td>
                <td>{p.email ?? "—"}</td>
                <td>{p.phone ?? "—"}</td>
                <td>{formatBookingTime(p.created_at)}</td>
                <td><a className="text-sm text-blue-600 hover:underline" href={`/patients/${p.id}`}>View</a></td>
              </tr>
            ))}
            {patients.length === 0 && <tr><td colSpan={5} className="py-4 text-gray-400">No patients found.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
