import { useEffect, useState } from "react";
import type { ApiClientConfig } from "../lib/api/client.js";
import type { ServiceCategory } from "../lib/api/service-categories.js";
import { listServices, listStaff, type Service, type StaffMember } from "../lib/api/catalog.js";
import { describeApiError } from "../lib/api/errors.js";
import CategoriesPanel from "./catalog/CategoriesPanel.js";
import ServicesPanel from "./catalog/ServicesPanel.js";
import StaffPanel from "./catalog/StaffPanel.js";

type Tab = "categories" | "services" | "staff";

type Props = { apiConfig: ApiClientConfig; categories: ServiceCategory[] };

export default function CatalogScreen({ apiConfig, categories: initialCategories }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("categories");

  // Categories are cached here (not re-derived from a prop each mount) so
  // that a mutation made while the Categories tab is active is still
  // reflected after switching away and back, and in the Services tab's
  // category <select>, which shares this same state.
  const [categories, setCategories] = useState<ServiceCategory[]>(initialCategories);

  // Services are fetched once and shared between the Services tab and the
  // Staff tab's "manage services" checklist, so both stay in sync.
  const [services, setServices] = useState<Service[] | null>(null);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);

  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);

  useEffect(() => {
    if ((activeTab === "services" || activeTab === "staff") && services === null && !servicesLoading) {
      setServicesLoading(true);
      setServicesError(null);
      listServices(apiConfig)
        .then(setServices)
        .catch((err) => setServicesError(describeApiError(err)))
        .finally(() => setServicesLoading(false));
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "staff" && staff === null && !staffLoading) {
      setStaffLoading(true);
      setStaffError(null);
      listStaff(apiConfig)
        .then(setStaff)
        .catch((err) => setStaffError(describeApiError(err)))
        .finally(() => setStaffLoading(false));
    }
  }, [activeTab]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <button
          className={`rounded px-3 py-2 text-sm font-medium ${activeTab === "categories" ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"}`}
          onClick={() => setActiveTab("categories")}
        >
          Categories
        </button>
        <button
          className={`rounded px-3 py-2 text-sm font-medium ${activeTab === "services" ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"}`}
          onClick={() => setActiveTab("services")}
        >
          Services
        </button>
        <button
          className={`rounded px-3 py-2 text-sm font-medium ${activeTab === "staff" ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"}`}
          onClick={() => setActiveTab("staff")}
        >
          Staff
        </button>
      </div>

      {activeTab === "categories" && (
        <CategoriesPanel apiConfig={apiConfig} categories={categories} onCategoriesChange={setCategories} />
      )}

      {activeTab === "services" && (
        <>
          {servicesError && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{servicesError}</p>}
          {!servicesError && (servicesLoading || services === null) && (
            <p className="text-sm text-gray-500">Loading…</p>
          )}
          {services !== null && (
            <ServicesPanel
              apiConfig={apiConfig}
              services={services}
              categories={categories}
              onServicesChange={setServices}
            />
          )}
        </>
      )}

      {activeTab === "staff" && (
        <>
          {(servicesError || staffError) && (
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{servicesError ?? staffError}</p>
          )}
          {!servicesError && !staffError && (servicesLoading || staffLoading || services === null || staff === null) && (
            <p className="text-sm text-gray-500">Loading…</p>
          )}
          {services !== null && staff !== null && (
            <StaffPanel apiConfig={apiConfig} staff={staff} services={services} onStaffChange={setStaff} />
          )}
        </>
      )}
    </div>
  );
}
