import { Card, CardContent, CardHeader, CardTitle } from "../ui/card.js";
import type { BookingStats } from "../../lib/dashboard/dashboard-stats.js";

type Props = { stats: BookingStats };

const CARDS: { key: keyof BookingStats; label: string }[] = [
  { key: "confirmed", label: "Confirmed" },
  { key: "pending", label: "Pending" },
  { key: "cancelled", label: "Cancelled" },
];

export default function StatsCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {CARDS.map(({ key, label }) => (
        <Card key={key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p role="status" aria-label={`${label} appointments this week`} className="text-3xl font-semibold">
              {stats[key]}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
