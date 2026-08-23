export function formatBookingTime(isoString: string, timeZone = "Europe/Riga"): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(isoString));
}

export function toDatetimeLocalValue(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
