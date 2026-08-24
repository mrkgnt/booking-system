import { useEffect, useState } from "react";
import type { ApiClientConfig } from "../../lib/api/client.js";
import { createClosure, deleteClosure, listClosures, type Closure } from "../../lib/api/closures.js";
import type { StaffMember } from "../../lib/api/catalog.js";
import { describeApiError } from "../../lib/api/errors.js";

type Props = { apiConfig: ApiClientConfig; staff: StaffMember[] };

type FormValues = { startsOn: string; endsOn: string; reason: string; isRecurringYearly: boolean };

const EMPTY_FORM_VALUES: FormValues = { startsOn: "", endsOn: "", reason: "", isRecurringYearly: false };

export default function ClosuresPanel({ apiConfig, staff }: Props) {
  const [scopeId, setScopeId] = useState("");
  const [closures, setClosures] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formValues, setFormValues] = useState<FormValues>(EMPTY_FORM_VALUES);
  const [formError, setFormError] = useState<string | null>(null);

  async function refresh(scope: string) {
    setLoading(true);
    setError(null);
    try {
      setClosures(await listClosures(apiConfig, scope || null));
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(""); }, []);

  async function handleScopeChange(value: string) {
    setScopeId(value);
    await refresh(value);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this closure?")) return;
    try {
      await deleteClosure(apiConfig, id);
      await refresh(scopeId);
    } catch (err) {
      setError(describeApiError(err));
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createClosure(apiConfig, {
        staffId: scopeId || null,
        startsOn: formValues.startsOn,
        endsOn: formValues.endsOn,
        reason: formValues.reason || undefined,
        isRecurringYearly: formValues.isRecurringYearly,
      });
      setShowForm(false);
      setFormValues(EMPTY_FORM_VALUES);
      setFormError(null);
      await refresh(scopeId);
    } catch (err) {
      setFormError(describeApiError(err));
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
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              <th className="py-2">Starts</th><th>Ends</th><th>Reason</th><th>Recurring</th><th></th>
            </tr>
          </thead>
          <tbody>
            {closures.map((c) => (
              <tr key={c.id} className="border-b border-gray-100">
                <td className="py-2">{c.starts_on}</td>
                <td>{c.ends_on}</td>
                <td>{c.reason ?? "—"}</td>
                <td>{c.is_recurring_yearly ? "Yes" : "No"}</td>
                <td>
                  <button className="text-sm text-red-600 hover:underline" onClick={() => handleDelete(c.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {closures.length === 0 && <tr><td colSpan={5} className="py-4 text-gray-400">No closures scheduled.</td></tr>}
          </tbody>
        </table>
      )}

      <button className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white" onClick={() => setShowForm((v) => !v)}>
        {showForm ? "Cancel" : "New closure"}
      </button>
      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded border border-gray-200 bg-white p-4">
          {formError && <p className="text-sm text-red-700">{formError}</p>}
          <input
            required
            type="date"
            value={formValues.startsOn}
            onChange={(e) => setFormValues((v) => ({ ...v, startsOn: e.target.value }))}
          />
          <input
            required
            type="date"
            value={formValues.endsOn}
            onChange={(e) => setFormValues((v) => ({ ...v, endsOn: e.target.value }))}
          />
          <input
            placeholder="Reason (optional)"
            value={formValues.reason}
            onChange={(e) => setFormValues((v) => ({ ...v, reason: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formValues.isRecurringYearly}
              onChange={(e) => setFormValues((v) => ({ ...v, isRecurringYearly: e.target.checked }))}
            />
            Recurring yearly
          </label>
          <button type="submit" className="rounded bg-gray-900 px-3 py-2 text-sm text-white">Save closure</button>
        </form>
      )}
    </div>
  );
}
