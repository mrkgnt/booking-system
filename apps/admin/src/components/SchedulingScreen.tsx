import { useState } from "react";
import type { ApiClientConfig } from "../lib/api/client.js";
import type { BusinessHour } from "../lib/api/business-hours.js";
import type { StaffMember } from "../lib/api/catalog.js";
import HoursPanel from "./scheduling/HoursPanel.js";
import ClosuresPanel from "./scheduling/ClosuresPanel.js";

type Tab = "hours" | "closures";

type Props = { apiConfig: ApiClientConfig; hours: BusinessHour[]; staff: StaffMember[] };

export default function SchedulingScreen({ apiConfig, hours, staff }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("hours");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <button
          className={`rounded px-3 py-2 text-sm font-medium ${activeTab === "hours" ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"}`}
          onClick={() => setActiveTab("hours")}
        >
          Business Hours
        </button>
        <button
          className={`rounded px-3 py-2 text-sm font-medium ${activeTab === "closures" ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"}`}
          onClick={() => setActiveTab("closures")}
        >
          Closures
        </button>
      </div>

      {activeTab === "hours" && <HoursPanel apiConfig={apiConfig} hours={hours} staff={staff} />}
      {activeTab === "closures" && <ClosuresPanel apiConfig={apiConfig} staff={staff} />}
    </div>
  );
}
