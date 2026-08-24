import { useEffect, useState } from "react";
import type { ApiClientConfig } from "../lib/api/client.js";
import { listServiceCategories, type ServiceCategory } from "../lib/api/service-categories.js";
import { listServices, type Service } from "../lib/api/catalog.js";
import CategoriesPanel from "./catalog/CategoriesPanel.js";
import ServicesPanel from "./catalog/ServicesPanel.js";

type Tab = "categories" | "services" | "staff";

type Props = { apiConfig: ApiClientConfig; categories: ServiceCategory[] };

export default function CatalogScreen({ apiConfig, categories }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("categories");
  const [services, setServices] = useState<Service[] | null>(null);
  const [servicesCategories, setServicesCategories] = useState<ServiceCategory[] | null>(null);

  useEffect(() => {
    if (activeTab === "services" && services === null) {
      Promise.all([listServices(apiConfig), listServiceCategories(apiConfig)]).then(([s, c]) => {
        setServices(s);
        setServicesCategories(c);
      });
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

      {activeTab === "categories" && <CategoriesPanel apiConfig={apiConfig} categories={categories} />}
      {activeTab === "services" && services && servicesCategories && (
        <ServicesPanel apiConfig={apiConfig} services={services} categories={servicesCategories} />
      )}
      {activeTab === "staff" && <div className="text-sm text-gray-500">Coming soon</div>}
    </div>
  );
}
