import { useState } from "react";
import type { ApiClientConfig } from "../../lib/api/client.js";
import { createService, deleteService, listServices, updateService, type Service } from "../../lib/api/catalog.js";
import type { ServiceCategory } from "../../lib/api/service-categories.js";
import { describeApiError } from "../../lib/api/errors.js";

type Props = {
  apiConfig: ApiClientConfig;
  services: Service[];
  categories: ServiceCategory[];
  onServicesChange?: (services: Service[]) => void;
};

type EditValues = { lv: string; ru: string; en: string; durationMinutes: number; isActive: boolean };

type CreateValues = {
  nameLv: string;
  nameRu: string;
  nameEn: string;
  descLv: string;
  descRu: string;
  descEn: string;
  categoryId: string;
  durationMinutes: number;
  bufferMinutesBefore: number;
  bufferMinutesAfter: number;
  priceAmount: string;
  priceCurrency: string;
  pricePrefix: "exact" | "from" | "up_to";
  displayOrder: number;
  isActive: boolean;
};

const EMPTY_CREATE_VALUES: CreateValues = {
  nameLv: "",
  nameRu: "",
  nameEn: "",
  descLv: "",
  descRu: "",
  descEn: "",
  categoryId: "",
  durationMinutes: 30,
  bufferMinutesBefore: 0,
  bufferMinutesAfter: 0,
  priceAmount: "",
  priceCurrency: "EUR",
  pricePrefix: "exact",
  displayOrder: 0,
  isActive: true,
};

export default function ServicesPanel({ apiConfig, services: initialServices, categories, onServicesChange }: Props) {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EditValues>({ lv: "", ru: "", en: "", durationMinutes: 0, isActive: true });
  const [editError, setEditError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formValues, setFormValues] = useState<CreateValues>(EMPTY_CREATE_VALUES);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  async function refresh() {
    setError(null);
    try {
      const result = await listServices(apiConfig);
      setServices(result);
      onServicesChange?.(result);
    } catch (err) {
      setError(describeApiError(err));
    }
  }

  function startEdit(service: Service) {
    setEditingId(service.id);
    setEditError(null);
    setEditValues({
      lv: service.name.lv ?? "",
      ru: service.name.ru ?? "",
      en: service.name.en ?? "",
      durationMinutes: service.duration_minutes,
      isActive: service.is_active,
    });
  }

  async function handleSaveEdit(id: string) {
    try {
      await updateService(apiConfig, id, {
        name: { lv: editValues.lv, ru: editValues.ru, en: editValues.en },
        durationMinutes: Number(editValues.durationMinutes),
        isActive: editValues.isActive,
      });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setEditError(describeApiError(err));
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this service?")) return;
    try {
      await deleteService(apiConfig, id);
      await refresh();
    } catch (err) {
      setError(describeApiError(err));
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const description = Object.fromEntries(
        ([["lv", formValues.descLv], ["ru", formValues.descRu], ["en", formValues.descEn]] as const)
          .filter(([, v]) => v.trim() !== ""),
      ) as Record<"lv" | "ru" | "en", string>;
      await createService(apiConfig, {
        categoryId: formValues.categoryId || undefined,
        durationMinutes: Number(formValues.durationMinutes),
        bufferMinutesBefore: Number(formValues.bufferMinutesBefore),
        bufferMinutesAfter: Number(formValues.bufferMinutesAfter),
        priceAmount: formValues.priceAmount === "" ? undefined : Number(formValues.priceAmount),
        priceCurrency: formValues.priceCurrency,
        pricePrefix: formValues.pricePrefix,
        displayOrder: Number(formValues.displayOrder),
        isActive: formValues.isActive,
        name: { lv: formValues.nameLv, ru: formValues.nameRu, en: formValues.nameEn },
        description: Object.keys(description).length > 0 ? description : undefined,
      });
      setShowForm(false);
      setFormValues(EMPTY_CREATE_VALUES);
      setFormErrors([]);
      await refresh();
    } catch (err) {
      setFormErrors([describeApiError(err)]);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2">Name</th><th>Duration</th><th>Price</th><th>Active</th><th></th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.id} className="border-b border-gray-100">
              {editingId === s.id ? (
                <td className="py-2" colSpan={5}>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                      placeholder="Name (LV)"
                      value={editValues.lv}
                      onChange={(e) => setEditValues((v) => ({ ...v, lv: e.target.value }))}
                    />
                    <input
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                      placeholder="Name (RU)"
                      value={editValues.ru}
                      onChange={(e) => setEditValues((v) => ({ ...v, ru: e.target.value }))}
                    />
                    <input
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                      placeholder="Name (EN)"
                      value={editValues.en}
                      onChange={(e) => setEditValues((v) => ({ ...v, en: e.target.value }))}
                    />
                    <input
                      type="number"
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                      value={editValues.durationMinutes}
                      onChange={(e) => setEditValues((v) => ({ ...v, durationMinutes: Number(e.target.value) }))}
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editValues.isActive}
                        onChange={(e) => setEditValues((v) => ({ ...v, isActive: e.target.checked }))}
                      />
                      Active
                    </label>
                    <button className="text-sm text-gray-900" onClick={() => handleSaveEdit(s.id)}>Save</button>
                  </div>
                  {editError && <p className="text-sm text-red-700">{editError}</p>}
                </td>
              ) : (
                <>
                  <td className="py-2">{s.name.lv}</td>
                  <td>{s.duration_minutes} min</td>
                  <td>{s.price_amount ? `${s.price_amount} ${s.price_currency}` : "—"}</td>
                  <td>{s.is_active ? "Yes" : "No"}</td>
                  <td>
                    <button className="text-sm text-blue-600 hover:underline" onClick={() => startEdit(s)}>Edit</button>{" "}
                    <button className="text-sm text-red-600 hover:underline" onClick={() => handleDelete(s.id)}>Delete</button>
                  </td>
                </>
              )}
            </tr>
          ))}
          {services.length === 0 && <tr><td colSpan={5} className="py-4 text-gray-400">No services yet.</td></tr>}
        </tbody>
      </table>

      <button className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white" onClick={() => setShowForm((v) => !v)}>
        {showForm ? "Cancel" : "New service"}
      </button>
      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded border border-gray-200 bg-white p-4">
          {formErrors.map((msg) => <p key={msg} className="text-sm text-red-700">{msg}</p>)}
          <input required placeholder="Name (LV)" value={formValues.nameLv} onChange={(e) => setFormValues((v) => ({ ...v, nameLv: e.target.value }))} />
          <input required placeholder="Name (RU)" value={formValues.nameRu} onChange={(e) => setFormValues((v) => ({ ...v, nameRu: e.target.value }))} />
          <input required placeholder="Name (EN)" value={formValues.nameEn} onChange={(e) => setFormValues((v) => ({ ...v, nameEn: e.target.value }))} />
          <input placeholder="Description (LV)" value={formValues.descLv} onChange={(e) => setFormValues((v) => ({ ...v, descLv: e.target.value }))} />
          <input placeholder="Description (RU)" value={formValues.descRu} onChange={(e) => setFormValues((v) => ({ ...v, descRu: e.target.value }))} />
          <input placeholder="Description (EN)" value={formValues.descEn} onChange={(e) => setFormValues((v) => ({ ...v, descEn: e.target.value }))} />
          <select value={formValues.categoryId} onChange={(e) => setFormValues((v) => ({ ...v, categoryId: e.target.value }))}>
            <option value="">No category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name.lv}</option>)}
          </select>
          <input
            type="number"
            required
            placeholder="Duration (minutes)"
            value={formValues.durationMinutes}
            onChange={(e) => setFormValues((v) => ({ ...v, durationMinutes: Number(e.target.value) }))}
          />
          <input
            type="number"
            placeholder="Buffer before (minutes)"
            value={formValues.bufferMinutesBefore}
            onChange={(e) => setFormValues((v) => ({ ...v, bufferMinutesBefore: Number(e.target.value) }))}
          />
          <input
            type="number"
            placeholder="Buffer after (minutes)"
            value={formValues.bufferMinutesAfter}
            onChange={(e) => setFormValues((v) => ({ ...v, bufferMinutesAfter: Number(e.target.value) }))}
          />
          <input
            type="number"
            placeholder="Price amount"
            value={formValues.priceAmount}
            onChange={(e) => setFormValues((v) => ({ ...v, priceAmount: e.target.value }))}
          />
          <input
            placeholder="Price currency"
            value={formValues.priceCurrency}
            onChange={(e) => setFormValues((v) => ({ ...v, priceCurrency: e.target.value }))}
          />
          <select value={formValues.pricePrefix} onChange={(e) => setFormValues((v) => ({ ...v, pricePrefix: e.target.value as CreateValues["pricePrefix"] }))}>
            <option value="exact">exact</option>
            <option value="from">from</option>
            <option value="up_to">up_to</option>
          </select>
          <input
            type="number"
            value={formValues.displayOrder}
            onChange={(e) => setFormValues((v) => ({ ...v, displayOrder: Number(e.target.value) }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formValues.isActive}
              onChange={(e) => setFormValues((v) => ({ ...v, isActive: e.target.checked }))}
            />
            Active
          </label>
          <button type="submit" className="rounded bg-gray-900 px-3 py-2 text-sm text-white">Save service</button>
        </form>
      )}
    </div>
  );
}
