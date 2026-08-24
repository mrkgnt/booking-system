import { Fragment, useState } from "react";
import type { ApiClientConfig } from "../../lib/api/client.js";
import {
  createStaffMember,
  deleteStaffMember,
  listStaff,
  replaceStaffServices,
  updateStaffMember,
  type Service,
  type StaffMember,
} from "../../lib/api/catalog.js";
import { describeApiError } from "../../lib/api/errors.js";

type Props = { apiConfig: ApiClientConfig; staff: StaffMember[]; services: Service[] };

type EditValues = { name: string; isActive: boolean; isBookable: boolean };

type CreateValues = {
  name: string;
  photoUrl: string;
  bioLv: string;
  bioRu: string;
  bioEn: string;
  displayOrder: number;
  isActive: boolean;
  isBookable: boolean;
};

const EMPTY_CREATE_VALUES: CreateValues = {
  name: "",
  photoUrl: "",
  bioLv: "",
  bioRu: "",
  bioEn: "",
  displayOrder: 0,
  isActive: true,
  isBookable: true,
};

export default function StaffPanel({ apiConfig, staff: initialStaff, services }: Props) {
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EditValues>({ name: "", isActive: true, isBookable: true });
  const [editError, setEditError] = useState<string | null>(null);

  const [managingId, setManagingId] = useState<string | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [servicesError, setServicesError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formValues, setFormValues] = useState<CreateValues>(EMPTY_CREATE_VALUES);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  async function refresh() {
    setError(null);
    try {
      setStaff(await listStaff(apiConfig));
    } catch (err) {
      setError(describeApiError(err));
    }
  }

  function startEdit(member: StaffMember) {
    setEditingId(member.id);
    setEditError(null);
    setEditValues({ name: member.name, isActive: member.is_active, isBookable: member.is_bookable });
  }

  async function handleSaveEdit(id: string) {
    try {
      await updateStaffMember(apiConfig, id, {
        name: editValues.name,
        isActive: editValues.isActive,
        isBookable: editValues.isBookable,
      });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setEditError(describeApiError(err));
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this staff member?")) return;
    try {
      await deleteStaffMember(apiConfig, id);
      await refresh();
    } catch (err) {
      setError(describeApiError(err));
    }
  }

  function toggleManageServices(member: StaffMember) {
    if (managingId === member.id) {
      setManagingId(null);
      return;
    }
    setManagingId(member.id);
    setServicesError(null);
    setSelectedServiceIds(new Set());
  }

  function toggleServiceChecked(serviceId: string) {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  }

  async function handleSaveServices(staffId: string) {
    try {
      await replaceStaffServices(apiConfig, staffId, [...selectedServiceIds]);
      setManagingId(null);
    } catch (err) {
      setServicesError(describeApiError(err));
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const bio = Object.fromEntries(
        ([["lv", formValues.bioLv], ["ru", formValues.bioRu], ["en", formValues.bioEn]] as const)
          .filter(([, v]) => v.trim() !== ""),
      ) as Record<"lv" | "ru" | "en", string>;
      await createStaffMember(apiConfig, {
        name: formValues.name,
        photoUrl: formValues.photoUrl.trim() === "" ? undefined : formValues.photoUrl,
        displayOrder: Number(formValues.displayOrder),
        isActive: formValues.isActive,
        isBookable: formValues.isBookable,
        bio: Object.keys(bio).length > 0 ? bio : undefined,
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
            <th className="py-2">Name</th><th>Active</th><th>Bookable</th><th></th>
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => (
            <Fragment key={s.id}>
              <tr className="border-b border-gray-100">
                {editingId === s.id ? (
                  <td className="py-2" colSpan={4}>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                        placeholder="Name"
                        value={editValues.name}
                        onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editValues.isActive}
                          onChange={(e) => setEditValues((v) => ({ ...v, isActive: e.target.checked }))}
                        />
                        Active
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editValues.isBookable}
                          onChange={(e) => setEditValues((v) => ({ ...v, isBookable: e.target.checked }))}
                        />
                        Bookable
                      </label>
                      <button className="text-sm text-gray-900" onClick={() => handleSaveEdit(s.id)}>Save</button>
                    </div>
                    {editError && <p className="text-sm text-red-700">{editError}</p>}
                  </td>
                ) : (
                  <>
                    <td className="py-2">{s.name}</td>
                    <td>{s.is_active ? "Yes" : "No"}</td>
                    <td>{s.is_bookable ? "Yes" : "No"}</td>
                    <td>
                      <button className="text-sm text-blue-600 hover:underline" onClick={() => startEdit(s)}>Edit</button>{" "}
                      <button className="text-sm text-blue-600 hover:underline" onClick={() => toggleManageServices(s)}>Manage services</button>{" "}
                      <button className="text-sm text-red-600 hover:underline" onClick={() => handleDelete(s.id)}>Delete</button>
                    </td>
                  </>
                )}
              </tr>
              {managingId === s.id && (
                <tr className="border-b border-gray-100">
                  <td colSpan={4} className="py-2">
                    <div className="space-y-2 rounded border border-gray-200 bg-gray-50 p-3">
                      {servicesError && <p className="text-sm text-red-700">{servicesError}</p>}
                      <div className="flex flex-wrap gap-3">
                        {services.map((svc) => (
                          <label key={svc.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selectedServiceIds.has(svc.id)}
                              onChange={() => toggleServiceChecked(svc.id)}
                            />
                            {svc.name.lv}
                          </label>
                        ))}
                      </div>
                      <button className="rounded bg-gray-900 px-3 py-2 text-sm text-white" onClick={() => handleSaveServices(s.id)}>
                        Save services
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {staff.length === 0 && <tr><td colSpan={4} className="py-4 text-gray-400">No staff yet.</td></tr>}
        </tbody>
      </table>

      <button className="rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white" onClick={() => setShowForm((v) => !v)}>
        {showForm ? "Cancel" : "New staff"}
      </button>
      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded border border-gray-200 bg-white p-4">
          {formErrors.map((msg) => <p key={msg} className="text-sm text-red-700">{msg}</p>)}
          <input required placeholder="Name" value={formValues.name} onChange={(e) => setFormValues((v) => ({ ...v, name: e.target.value }))} />
          <input
            placeholder="Photo URL (optional)"
            value={formValues.photoUrl}
            onChange={(e) => setFormValues((v) => ({ ...v, photoUrl: e.target.value }))}
          />
          <input placeholder="Bio (LV)" value={formValues.bioLv} onChange={(e) => setFormValues((v) => ({ ...v, bioLv: e.target.value }))} />
          <input placeholder="Bio (RU)" value={formValues.bioRu} onChange={(e) => setFormValues((v) => ({ ...v, bioRu: e.target.value }))} />
          <input placeholder="Bio (EN)" value={formValues.bioEn} onChange={(e) => setFormValues((v) => ({ ...v, bioEn: e.target.value }))} />
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formValues.isBookable}
              onChange={(e) => setFormValues((v) => ({ ...v, isBookable: e.target.checked }))}
            />
            Bookable
          </label>
          <button type="submit" className="rounded bg-gray-900 px-3 py-2 text-sm text-white">Save staff</button>
        </form>
      )}
    </div>
  );
}
