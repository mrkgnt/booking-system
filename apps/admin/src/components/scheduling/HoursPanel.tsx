import { useState } from "react";
import type { ApiClientConfig } from "../../lib/api/client.js";
import { listBusinessHours, replaceBusinessHours, type BusinessHour, type HourInput } from "../../lib/api/business-hours.js";
import type { StaffMember } from "../../lib/api/catalog.js";
import { describeApiError } from "../../lib/api/errors.js";

type Props = { apiConfig: ApiClientConfig; hours: BusinessHour[]; staff: StaffMember[] };

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Row = { dayOfWeek: number; isClosed: boolean; opensAt: string; closesAt: string };

function toTimeInputValue(value: string | null): string {
  return value ? value.slice(0, 5) : "";
}

function buildRows(hours: BusinessHour[]): Row[] {
  return DAY_NAMES.map((_, dayOfWeek) => {
    const existing = hours.find((h) => h.day_of_week === dayOfWeek);
    if (!existing) return { dayOfWeek, isClosed: true, opensAt: "", closesAt: "" };
    return {
      dayOfWeek,
      isClosed: existing.is_closed,
      opensAt: toTimeInputValue(existing.opens_at),
      closesAt: toTimeInputValue(existing.closes_at),
    };
  });
}

// A staff scope with zero fetched rows means "no per-staff override exists —
// this staff member inherits business-wide hours", which must stay visually
// distinct from a deliberate "closed every day" override. Business-wide scope
// (scopeId === "") has no such inherited state, so it's never ambiguous.
function computeInheriting(scopeId: string, hours: BusinessHour[]): boolean {
  return scopeId !== "" && hours.length === 0;
}

export default function HoursPanel({ apiConfig, hours: initialHours, staff }: Props) {
  const [scopeId, setScopeId] = useState("");
  const [rows, setRows] = useState<Row[]>(buildRows(initialHours));
  const [inheriting, setInheriting] = useState(() => computeInheriting("", initialHours));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleScopeChange(value: string) {
    setScopeId(value);
    setLoading(true);
    setError(null);
    try {
      const hours = await listBusinessHours(apiConfig, value || null);
      setRows(buildRows(hours));
      setInheriting(computeInheriting(value, hours));
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setLoading(false);
    }
  }

  function startCustomHours() {
    setInheriting(false);
  }

  function updateRow(dayOfWeek: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.dayOfWeek === dayOfWeek ? { ...r, ...patch } : r)));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const hours: HourInput[] = rows.map((r) => ({
        dayOfWeek: r.dayOfWeek,
        opensAt: r.isClosed || !r.opensAt ? null : `${r.opensAt}:00`,
        closesAt: r.isClosed || !r.closesAt ? null : `${r.closesAt}:00`,
        isClosed: r.isClosed,
      }));
      const saved = await replaceBusinessHours(apiConfig, scopeId || null, hours);
      setRows(buildRows(saved));
      setInheriting(computeInheriting(scopeId, saved));
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <select
        className="rounded border border-gray-300 px-2 py-1 text-sm"
        value={scopeId}
        onChange={(e) => handleScopeChange(e.target.value)}
      >
        <option value="">Business-wide</option>
        {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : inheriting ? (
        <div className="space-y-3 rounded border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            No staff-specific schedule — currently inheriting business hours.
          </p>
          <button
            className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white"
            onClick={startCustomHours}
          >
            Set custom hours for this staff member
          </button>
        </div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Day</th><th>Closed</th><th>Opens</th><th>Closes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.dayOfWeek} className="border-b border-gray-100">
                <td className="py-2">{DAY_NAMES[r.dayOfWeek]}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={r.isClosed}
                    onChange={(e) => updateRow(r.dayOfWeek, { isClosed: e.target.checked })}
                  />
                </td>
                <td>
                  <input
                    type="time"
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                    value={r.opensAt}
                    disabled={r.isClosed}
                    onChange={(e) => updateRow(r.dayOfWeek, { opensAt: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="time"
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                    value={r.closesAt}
                    disabled={r.isClosed}
                    onChange={(e) => updateRow(r.dayOfWeek, { closesAt: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && !inheriting && (
        <button
          className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white"
          onClick={handleSave}
          disabled={saving}
        >
          Save hours
        </button>
      )}
    </div>
  );
}
