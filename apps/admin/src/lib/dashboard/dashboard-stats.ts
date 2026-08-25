export type BookingStats = { confirmed: number; pending: number; cancelled: number };

export function computeBookingStats(bookings: { status: string }[]): BookingStats {
  return bookings.reduce<BookingStats>(
    (acc, b) => {
      if (b.status === "confirmed") acc.confirmed += 1;
      else if (b.status === "pending_verification") acc.pending += 1;
      else if (b.status === "cancelled") acc.cancelled += 1;
      return acc;
    },
    { confirmed: 0, pending: 0, cancelled: 0 },
  );
}
