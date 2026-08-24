import { useState } from "react";
import type { ApiClientConfig } from "../../lib/api/client.js";
import {
  createServiceCategory,
  deleteServiceCategory,
  listServiceCategories,
  updateServiceCategory,
  type ServiceCategory,
} from "../../lib/api/service-categories.js";
import { describeApiError } from "../../lib/api/errors.js";

type Props = { apiConfig: ApiClientConfig; categories: ServiceCategory[] };

type EditValues = { lv: string; ru: string; en: string };

type CreateValues = {
  lv: string;
  ru: string;
  en: string;
  icon: string;
  displayOrder: number;
  isActive: boolean;
};

const EMPTY_CREATE_VALUES: CreateValues = { lv: "", ru: "", en: "", icon: "", displayOrder: 0, isActive: true };

export default function CategoriesPanel({ apiConfig, categories: initialCategories }: Props) {
  const [categories, setCategories] = useState<ServiceCategory[]>(initialCategories);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EditValues>({ lv: "", ru: "", en: "" });
  const [editError, setEditError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formValues, setFormValues] = useState<CreateValues>(EMPTY_CREATE_VALUES);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  async function refresh() {
    setError(null);
    try {
      setCategories(await listServiceCategories(apiConfig));
    } catch (err) {
      setError(describeApiError(err));
    }
  }

  function startEdit(category: ServiceCategory) {
    setEditingId(category.id);
    setEditError(null);
    setEditValues({ lv: category.name.lv ?? "", ru: category.name.ru ?? "", en: category.name.en ?? "" });
  }

  async function handleSaveEdit(id: string) {
    try {
      await updateServiceCategory(apiConfig, id, { name: { lv: editValues.lv, ru: editValues.ru, en: editValues.en } });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setEditError(describeApiError(err));
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this category?")) return;
    try {
      await deleteServiceCategory(apiConfig, id);
      await refresh();
    } catch (err) {
      setError(describeApiError(err));
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createServiceCategory(apiConfig, {
        name: { lv: formValues.lv, ru: formValues.ru, en: formValues.en },
        icon: formValues.icon || undefined,
        displayOrder: formValues.displayOrder,
        isActive: formValues.isActive,
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
            <th className="py-2">Name</th><th>Active</th><th>Order</th><th></th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id} className="border-b border-gray-100">
              {editingId === c.id ? (
                <td className="py-2" colSpan={4}>
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
                    <button className="text-sm text-gray-900" onClick={() => handleSaveEdit(c.id)}>Save</button>
                  </div>
                  {editError && <p className="text-sm text-red-700">{editError}</p>}
                </td>
              ) : (
                <>
                  <td className="py-2">{c.name.lv}</td>
                  <td>{c.is_active ? "Yes" : "No"}</td>
                  <td>{c.display_order}</td>
                  <td>
                    <button className="text-sm text-blue-600 hover:underline" onClick={() => startEdit(c)}>Edit</button>{" "}
                    <button className="text-sm text-red-600 hover:underline" onClick={() => handleDelete(c.id)}>Delete</button>
                  </td>
                </>
              )}
            </tr>
          ))}
          {categories.length === 0 && <tr><td colSpan={4} className="py-4 text-gray-400">No categories yet.</td></tr>}
        </tbody>
      </table>

      <button className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white" onClick={() => setShowForm((v) => !v)}>
        {showForm ? "Cancel" : "New category"}
      </button>
      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded border border-gray-200 bg-white p-4">
          {formErrors.map((msg) => <p key={msg} className="text-sm text-red-700">{msg}</p>)}
          <input required placeholder="Name (LV)" value={formValues.lv} onChange={(e) => setFormValues((v) => ({ ...v, lv: e.target.value }))} />
          <input required placeholder="Name (RU)" value={formValues.ru} onChange={(e) => setFormValues((v) => ({ ...v, ru: e.target.value }))} />
          <input required placeholder="Name (EN)" value={formValues.en} onChange={(e) => setFormValues((v) => ({ ...v, en: e.target.value }))} />
          <input placeholder="Icon (optional)" value={formValues.icon} onChange={(e) => setFormValues((v) => ({ ...v, icon: e.target.value }))} />
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
          <button type="submit" className="rounded bg-gray-900 px-3 py-2 text-sm text-white">Save category</button>
        </form>
      )}
    </div>
  );
}
