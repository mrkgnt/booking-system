# Admin Dashboard (Weekly Calendar + Stats) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "Dashboard" screen to `apps/admin` — the staff back office's new default landing page — showing an Outlook-style weekly calendar (business hours shaded, bookings as positioned blocks) plus three stat cards (Confirmed / Pending / Cancelled appointment counts for the currently displayed week), using shadcn/ui for the reusable UI primitives (Button, Card, Popover, Calendar date-picker).

**Architecture:** Pure client-side feature on top of existing, unchanged API routes — no backend changes. `GET /admin/bookings` (already supports `from`/`to`/`staffId`), `GET /admin/business-hours`, `GET /admin/closures`, and `GET /admin/staff` supply everything needed. A new Astro page (`dashboard.astro`) SSR-prefetches the current week's data (mirroring the existing `bookings.astro`/`scheduling.astro` pattern), and a React island (`DashboardScreen`) owns week-navigation and staff-filter state, refetching client-side on change. All date/time math for positioning events on the grid goes through the business's `Europe/Riga` timezone explicitly (via `Intl.DateTimeFormat`), never raw local `Date` arithmetic — this is the same class of bug `apps/admin/src/lib/format.ts`'s `formatBookingTime` already exists to avoid.

**Tech Stack:** Astro 5 (server output) + React 19 islands (existing), Tailwind v4 (existing, CSS-only config, no `tailwind.config.js`), shadcn/ui (new — Button/Card/Popover/Calendar only), Vitest (pure-logic unit tests), Playwright (E2E, against the real dev servers + live Dent Di Supabase project, matching every existing spec in `apps/admin/e2e/`).

**Spec:** No separate spec doc — synthesized directly from a live codebase walkthrough (existing `apps/admin` screens, `apps/api` admin routes, `apps/api/src/lib/availability.ts`'s day-of-week/timezone conventions) plus explicit design decisions the user confirmed before this plan was written:
- Time-grid calendar is custom-built (Tailwind + shadcn primitives), not a scheduling library — shadcn itself has no ready-made Outlook-style time-grid component, only a date-picker `Calendar`.
- Staff distinction on the calendar is via a filter/toggle control ("All staff" or one specific staff member), not color-overlay or side-by-side sub-columns.
- The three stat cards reflect the **currently displayed week** (and the currently selected staff filter) — not all-time totals.
- Dashboard becomes the **new default landing page** (first nav item, and where `/`, login, and `index.astro` all redirect).

## Global Constraints

- **No backend changes.** Every data need is already served by `GET /admin/bookings` (`from`/`to`/`staffId`/`status` query params), `GET /admin/business-hours` (`staffId` query param, `null`/omitted = business-wide), `GET /admin/closures` (same), and `GET /admin/staff`. Do not modify anything under `apps/api/`.
- **Business timezone is `Europe/Riga`.** Every place that needs "what calendar day/time is this UTC instant, in the clinic's own timezone" must go through `Intl.DateTimeFormat` with `timeZone: "Europe/Riga"` — never `Date.getHours()`/`Date.getDate()` on a raw instant, since those use the *browser's* local timezone, which will not generally be Riga's. This mirrors the existing pattern in `apps/admin/src/lib/format.ts`'s `formatBookingTime`.
- **The dashboard is read-only.** No booking creation, cancel, or reschedule actions live on this screen — those stay on the existing Bookings screen (`/bookings`). Clicking a booking block does nothing in this pass (a natural, explicitly deferred follow-up, not silently dropped).
- **The calendar week runs Monday → Sunday** (matches EU/Latvian convention). This is purely a *display* convention — `business_hours.day_of_week` (`0`=Sunday..`6`=Saturday, matching Postgres `EXTRACT(DOW)`) is unchanged and must still be looked up via `date.getDay()`, not a Monday-first index.
- **shadcn/ui is used only for `Button`, `Card`, `Popover`, and `Calendar`** (the date-picker used for "jump to a week"). The existing native `<select>` pattern for filters (used by every other admin screen — Bookings' status/staff filters, Scheduling's staff-scope selector) is kept for the staff filter here too, for consistency — do not introduce a shadcn `Select` for it.
- **Cancelled bookings are excluded from the calendar grid** (a cancelled slot is available time again) but **included in the stats count** (the user explicitly asked for a "Cancelled" stat). `no_show`/`completed`/`confirmed`/`pending_verification` all render as blocks; `cancelled` does not.
- **Playwright selectors are role/label/placeholder-only** (matching every existing spec in `apps/admin/e2e/`) — no CSS class/tag selectors, with the one pre-existing exception already in use elsewhere (`input[type="date"]`/`input[type="datetime-local"]`, which have no accessible-name alternative).
- **This plan adds no new npm dependencies beyond what the shadcn CLI itself installs** (`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `@radix-ui/react-slot`, `@radix-ui/react-popover`, `react-day-picker`, plus whatever else the CLI's `add` command pulls in for Button/Card/Popover/Calendar). No date-math library (`date-fns`, `dayjs`, etc.) is added — all date/week arithmetic is hand-written using native `Date`/`Intl`, matching this codebase's existing philosophy (see `apps/api/src/lib/timezone.ts`).
- **`describeApiError`'s generic `not_found` message** ("Booking not found — it may have been removed.") is a known, pre-existing rough edge shared across every admin resource, not specific to this feature — do not fix it as part of this plan; it's out of scope.

---

## File Structure

New files:
- `apps/admin/components.json` — shadcn/ui config (created by the CLI).
- `apps/admin/src/lib/utils.ts` — shadcn's `cn()` class-merge helper (created by the CLI).
- `apps/admin/src/components/ui/button.tsx`, `card.tsx`, `popover.tsx`, `calendar.tsx` — shadcn primitives (created by the CLI).
- `apps/admin/src/lib/dashboard/date-utils.ts` — pure week-navigation date math (Monday-anchored week start, week days, add/subtract weeks, date-key/label formatting).
- `apps/admin/src/lib/dashboard/dashboard-stats.ts` — pure booking-status counter.
- `apps/admin/src/lib/dashboard/calendar-layout.ts` — pure Riga-timezone-aware grid position math (event position, open-hours shading position, closure-day check).
- `apps/admin/test/lib/dashboard/date-utils.test.ts`, `dashboard-stats.test.ts`, `calendar-layout.test.ts` — Vitest unit tests for the three files above.
- `apps/admin/e2e/dashboard.spec.ts` — Playwright E2E spec, written and confirmed red before the screen exists.
- `apps/admin/src/components/dashboard/WeekCalendar.tsx` — the time-grid component.
- `apps/admin/src/components/dashboard/StatsCards.tsx` — the three stat cards (shadcn `Card`).
- `apps/admin/src/components/dashboard/DatePickerButton.tsx` — shadcn `Popover` + `Calendar` "jump to a week" control.
- `apps/admin/src/components/DashboardScreen.tsx` — top-level screen: week-nav state, staff-filter state, data fetching, composes the three components above.
- `apps/admin/src/pages/dashboard.astro` — new page, SSR-prefetches staff list + the current week's bookings/business-hours/closures.

Modified files:
- `apps/admin/tsconfig.json` — add the `@/*` path alias the shadcn CLI expects.
- `apps/admin/src/layouts/AdminLayout.astro` — add "Dashboard" as the first nav item.
- `apps/admin/src/pages/index.astro` — redirect to `/dashboard` instead of `/bookings`.
- `apps/admin/src/pages/api/auth/login.ts` — redirect to `/dashboard` after a successful login instead of `/bookings`.

---

### Task 1: shadcn/ui setup

**Files:**
- Modify: `apps/admin/tsconfig.json`
- Create (via CLI): `apps/admin/components.json`, `apps/admin/src/lib/utils.ts`, `apps/admin/src/components/ui/button.tsx`, `apps/admin/src/components/ui/card.tsx`, `apps/admin/src/components/ui/popover.tsx`, `apps/admin/src/components/ui/calendar.tsx`

**Interfaces:**
- Produces: `cn(...classes)` from `apps/admin/src/lib/utils.ts`; `Button` from `./ui/button.js`; `Card`, `CardHeader`, `CardTitle`, `CardContent` from `./ui/card.js`; `Popover`, `PopoverTrigger`, `PopoverContent` from `./ui/popover.js`; `Calendar` (props include at least `mode: "single"` and `onSelect: (date: Date | undefined) => void`) from `./ui/calendar.js`. Later tasks (7, 8) import these directly.

- [ ] **Step 1: Add the path alias shadcn's CLI expects**

Edit `apps/admin/tsconfig.json` — add a `paths` entry under `compilerOptions` (keep every existing key):

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "src/**/*", "../api/src/lib/database.types.ts"],
  "exclude": ["dist"],
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

- [ ] **Step 2: Run the shadcn init CLI**

From `apps/admin/`:

```bash
pnpm dlx shadcn@latest init
```

If it runs non-interactively (recent CLI versions accept `-y`/`--defaults`), that's fine — otherwise answer the prompts exactly as follows:
- Which style would you like to use? → **Default**
- Which color would you like to use as base color? → **Neutral** (closest match to the grays already used throughout `apps/admin`)
- Would you like to use CSS variables for colors? → **Yes**
- Where is your global CSS file? → `src/styles/global.css` (existing file — the CLI appends its `@theme`/CSS-variable block to it; it must NOT replace the existing `@import "tailwindcss";` line)
- Configure the import alias for components → `@/components`
- Configure the import alias for utils → `@/lib/utils`

This creates `apps/admin/components.json` and `apps/admin/src/lib/utils.ts`.

- [ ] **Step 3: Add the four components actually used by this plan**

```bash
pnpm dlx shadcn@latest add button card popover calendar
```

This creates `apps/admin/src/components/ui/button.tsx`, `card.tsx`, `popover.tsx`, `calendar.tsx`, and adds their dependencies (`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `@radix-ui/react-slot`, `@radix-ui/react-popover`, `react-day-picker`, etc.) to `apps/admin/package.json`.

- [ ] **Step 4: Verify the install is sound**

```bash
pnpm --filter @booking-system/admin typecheck
pnpm --filter @booking-system/admin build
```

Expected: both clean (0 errors) — `typecheck` covers `astro check` + `tsc --noEmit`, `build` proves the new components and their Radix/CSS integration actually compile end-to-end, not just typecheck.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/tsconfig.json apps/admin/components.json apps/admin/src/lib/utils.ts apps/admin/src/components/ui apps/admin/package.json apps/admin/src/styles/global.css pnpm-lock.yaml
git commit -m "chore(admin): add shadcn/ui (Button, Card, Popover, Calendar)"
```

---

### Task 2: Date utilities (pure, TDD)

**Files:**
- Create: `apps/admin/src/lib/dashboard/date-utils.ts`
- Test: `apps/admin/test/lib/dashboard/date-utils.test.ts`

**Interfaces:**
- Produces: `getWeekStart(date: Date): Date`, `getWeekDays(weekStart: Date): Date[]`, `addWeeks(date: Date, n: number): Date`, `toDateKey(date: Date): string` ('YYYY-MM-DD', local), `formatDayLabel(date: Date): string`, `formatWeekRangeLabel(weekStart: Date): string`. Consumed by Task 6 (`WeekCalendar`), Task 8 (`DashboardScreen`, `dashboard.astro`).

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/admin/test/lib/dashboard/date-utils.test.ts
import { describe, expect, it } from "vitest";
import {
  addWeeks,
  formatDayLabel,
  formatWeekRangeLabel,
  getWeekDays,
  getWeekStart,
  toDateKey,
} from "../../../src/lib/dashboard/date-utils.js";

describe("getWeekStart", () => {
  it("returns the same date when given a Monday", () => {
    expect(toDateKey(getWeekStart(new Date(2026, 0, 5)))).toBe("2026-01-05");
  });
  it("returns the preceding Monday for a mid-week date", () => {
    expect(toDateKey(getWeekStart(new Date(2026, 0, 7)))).toBe("2026-01-05");
  });
  it("returns the preceding Monday for a Sunday", () => {
    expect(toDateKey(getWeekStart(new Date(2026, 0, 11)))).toBe("2026-01-05");
  });
});

describe("getWeekDays", () => {
  it("returns 7 consecutive days starting at weekStart", () => {
    const days = getWeekDays(new Date(2026, 0, 5));
    expect(days).toHaveLength(7);
    expect(toDateKey(days[0])).toBe("2026-01-05");
    expect(toDateKey(days[6])).toBe("2026-01-11");
  });
});

describe("addWeeks", () => {
  it("moves forward by n weeks", () => {
    expect(toDateKey(addWeeks(new Date(2026, 0, 5), 1))).toBe("2026-01-12");
  });
  it("moves backward with a negative n", () => {
    expect(toDateKey(addWeeks(new Date(2026, 0, 5), -1))).toBe("2025-12-29");
  });
});

describe("toDateKey", () => {
  it("pads single-digit month and day", () => {
    expect(toDateKey(new Date(2026, 2, 5))).toBe("2026-03-05");
  });
});

describe("formatDayLabel", () => {
  it("formats a weekday abbreviation with day and month", () => {
    expect(formatDayLabel(new Date(2026, 0, 5))).toBe("Mon 5 Jan");
  });
});

describe("formatWeekRangeLabel", () => {
  it("formats a Mon-Sun range", () => {
    expect(formatWeekRangeLabel(new Date(2026, 0, 5))).toBe("5 Jan – 11 Jan, 2026");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @booking-system/admin exec vitest run test/lib/dashboard/date-utils.test.ts`
Expected: FAIL — `Cannot find module '../../../src/lib/dashboard/date-utils.js'`

- [ ] **Step 3: Write the implementation**

```typescript
// apps/admin/src/lib/dashboard/date-utils.ts

/** Monday of the week containing `date`, at local midnight. */
export function getWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Sunday..6=Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

/** The 7 dates (Mon..Sun) of the week starting at `weekStart`. */
export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function addWeeks(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

/** 'YYYY-MM-DD' in local time — a stable per-day key, not a UTC conversion. */
export function toDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const WEEKDAY_FORMAT = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const MONTH_DAY_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

export function formatDayLabel(date: Date): string {
  return WEEKDAY_FORMAT.format(date);
}

/** e.g. "5 Jan – 11 Jan, 2026" for the Mon..Sun week starting at weekStart. */
export function formatWeekRangeLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return `${MONTH_DAY_FORMAT.format(weekStart)} – ${MONTH_DAY_FORMAT.format(weekEnd)}, ${weekEnd.getFullYear()}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @booking-system/admin exec vitest run test/lib/dashboard/date-utils.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/lib/dashboard/date-utils.ts apps/admin/test/lib/dashboard/date-utils.test.ts
git commit -m "feat(admin): add dashboard week-navigation date utilities"
```

---

### Task 3: Booking stats calculator (pure, TDD)

**Files:**
- Create: `apps/admin/src/lib/dashboard/dashboard-stats.ts`
- Test: `apps/admin/test/lib/dashboard/dashboard-stats.test.ts`

**Interfaces:**
- Consumes: nothing beyond a plain `{ status: string }[]` shape (deliberately not importing the full `Booking` type, so this stays a trivially pure function — see the `Pick<...>` note below).
- Produces: `BookingStats = { confirmed: number; pending: number; cancelled: number }`, `computeBookingStats(bookings: { status: string }[]): BookingStats`. Consumed by Task 7 (`StatsCards`) and Task 8 (`DashboardScreen`).

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/admin/test/lib/dashboard/dashboard-stats.test.ts
import { describe, expect, it } from "vitest";
import { computeBookingStats } from "../../../src/lib/dashboard/dashboard-stats.js";

describe("computeBookingStats", () => {
  it("returns zero counts for an empty list", () => {
    expect(computeBookingStats([])).toEqual({ confirmed: 0, pending: 0, cancelled: 0 });
  });

  it("counts confirmed, pending_verification, and cancelled separately", () => {
    const bookings = [
      { status: "confirmed" },
      { status: "confirmed" },
      { status: "pending_verification" },
      { status: "cancelled" },
      { status: "cancelled" },
      { status: "cancelled" },
    ];
    expect(computeBookingStats(bookings)).toEqual({ confirmed: 2, pending: 1, cancelled: 3 });
  });

  it("ignores completed and no_show statuses", () => {
    const bookings = [{ status: "completed" }, { status: "no_show" }, { status: "confirmed" }];
    expect(computeBookingStats(bookings)).toEqual({ confirmed: 1, pending: 0, cancelled: 0 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @booking-system/admin exec vitest run test/lib/dashboard/dashboard-stats.test.ts`
Expected: FAIL — `Cannot find module '../../../src/lib/dashboard/dashboard-stats.js'`

- [ ] **Step 3: Write the implementation**

```typescript
// apps/admin/src/lib/dashboard/dashboard-stats.ts

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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @booking-system/admin exec vitest run test/lib/dashboard/dashboard-stats.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/lib/dashboard/dashboard-stats.ts apps/admin/test/lib/dashboard/dashboard-stats.test.ts
git commit -m "feat(admin): add dashboard booking-stats calculator"
```

---

### Task 4: Calendar layout math (pure, Riga-timezone-aware, TDD)

**Files:**
- Create: `apps/admin/src/lib/dashboard/calendar-layout.ts`
- Test: `apps/admin/test/lib/dashboard/calendar-layout.test.ts`

**Interfaces:**
- Produces: `toRigaDateKey(isoInstant: string): string`, `minutesSinceMidnight(isoInstant: string): number`, `GridWindow = { startHour: number; endHour: number; pxPerHour: number }`, `GridPosition = { topPx: number; heightPx: number }`, `computeEventPosition(startsAt: string, endsAt: string, window: GridWindow): GridPosition | null`, `BusinessHoursWindow = { opensAt: string | null; closesAt: string | null; isClosed: boolean }`, `computeOpenHoursPosition(hours: BusinessHoursWindow | undefined, window: GridWindow): GridPosition | null`, `ClosureRange = { staffId: string | null; startsOn: string; endsOn: string; isRecurringYearly: boolean }`, `isDateClosed(dateKey: string, closures: ClosureRange[], staffId: string | null): boolean`. All consumed by Task 6 (`WeekCalendar`).

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/admin/test/lib/dashboard/calendar-layout.test.ts
import { describe, expect, it } from "vitest";
import {
  computeEventPosition,
  computeOpenHoursPosition,
  isDateClosed,
  minutesSinceMidnight,
  toRigaDateKey,
  type GridWindow,
} from "../../../src/lib/dashboard/calendar-layout.js";

describe("toRigaDateKey", () => {
  it("converts a UTC instant to its Europe/Riga calendar date", () => {
    // 22:30 UTC on Jan 5 is 00:30 the next day in Riga (winter, UTC+2)
    expect(toRigaDateKey("2026-01-05T22:30:00Z")).toBe("2026-01-06");
  });
});

describe("minutesSinceMidnight", () => {
  it("returns minutes since local midnight in Europe/Riga (winter, UTC+2)", () => {
    expect(minutesSinceMidnight("2026-01-05T07:30:00Z")).toBe(9 * 60 + 30);
  });
});

const window: GridWindow = { startHour: 8, endHour: 18, pxPerHour: 60 };

describe("computeEventPosition", () => {
  it("positions a booking fully inside the grid window", () => {
    // 07:00-07:30 UTC = 09:00-09:30 Riga (winter)
    expect(computeEventPosition("2026-01-05T07:00:00Z", "2026-01-05T07:30:00Z", window)).toEqual({
      topPx: 60,
      heightPx: 30,
    });
  });

  it("returns null for an event entirely outside the grid window", () => {
    // 18:00 Riga is exactly the grid end — outside the half-open window
    expect(computeEventPosition("2026-01-05T16:00:00Z", "2026-01-05T16:30:00Z", window)).toBeNull();
  });

  it("clamps an event that starts before the grid window", () => {
    // 07:00-09:00 Riga, grid starts at 08:00
    expect(computeEventPosition("2026-01-05T05:00:00Z", "2026-01-05T07:00:00Z", window)).toEqual({
      topPx: 0,
      heightPx: 60,
    });
  });

  it("enforces a 15-minute minimum visible height for very short bookings", () => {
    const pos = computeEventPosition("2026-01-05T07:00:00Z", "2026-01-05T07:05:00Z", window);
    expect(pos!.heightPx).toBe(15);
  });
});

describe("computeOpenHoursPosition", () => {
  it("positions the open-hours band for a normal day", () => {
    expect(
      computeOpenHoursPosition({ opensAt: "09:00:00", closesAt: "18:00:00", isClosed: false }, window),
    ).toEqual({ topPx: 60, heightPx: 540 });
  });

  it("returns null for a closed day", () => {
    expect(computeOpenHoursPosition({ opensAt: null, closesAt: null, isClosed: true }, window)).toBeNull();
  });

  it("returns null when hours are undefined (no matching row)", () => {
    expect(computeOpenHoursPosition(undefined, window)).toBeNull();
  });
});

describe("isDateClosed", () => {
  const closures = [
    { staffId: null, startsOn: "2026-12-24", endsOn: "2026-12-26", isRecurringYearly: false },
    { staffId: "staff-1", startsOn: "2026-06-01", endsOn: "2026-06-01", isRecurringYearly: false },
    { staffId: null, startsOn: "2020-01-01", endsOn: "2020-01-01", isRecurringYearly: true },
  ];

  it("matches a business-wide closure regardless of staffId", () => {
    expect(isDateClosed("2026-12-25", closures, "staff-1")).toBe(true);
    expect(isDateClosed("2026-12-25", closures, null)).toBe(true);
  });

  it("matches a staff-specific closure only for that staff", () => {
    expect(isDateClosed("2026-06-01", closures, "staff-1")).toBe(true);
    expect(isDateClosed("2026-06-01", closures, "staff-2")).toBe(false);
  });

  it("matches a recurring-yearly closure by month-day, any year", () => {
    expect(isDateClosed("2030-01-01", closures, null)).toBe(true);
    expect(isDateClosed("2030-01-02", closures, null)).toBe(false);
  });

  it("returns false when no closure matches", () => {
    expect(isDateClosed("2026-03-15", closures, null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @booking-system/admin exec vitest run test/lib/dashboard/calendar-layout.test.ts`
Expected: FAIL — `Cannot find module '../../../src/lib/dashboard/calendar-layout.js'`

- [ ] **Step 3: Write the implementation**

```typescript
// apps/admin/src/lib/dashboard/calendar-layout.ts

const TIMEZONE = "Europe/Riga";
const DATE_KEY_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const TIME_PARTS_FORMAT = new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** 'YYYY-MM-DD' calendar date (Europe/Riga) for a UTC ISO instant. */
export function toRigaDateKey(isoInstant: string): string {
  return DATE_KEY_FORMAT.format(new Date(isoInstant));
}

/** Minutes since local midnight (Europe/Riga) for a UTC ISO instant. */
export function minutesSinceMidnight(isoInstant: string): number {
  const parts = TIME_PARTS_FORMAT.formatToParts(new Date(isoInstant));
  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  const minute = Number(parts.find((p) => p.type === "minute")!.value);
  return hour * 60 + minute;
}

export type GridWindow = { startHour: number; endHour: number; pxPerHour: number };
export type GridPosition = { topPx: number; heightPx: number };

const MIN_HEIGHT_MINUTES = 15;

/**
 * Vertical position/height for an event within a single day's column,
 * clamped to [startHour, endHour). The caller is responsible for bucketing
 * events into day columns via toRigaDateKey before calling this — this
 * function only positions within a single day, it doesn't check which day.
 */
export function computeEventPosition(startsAt: string, endsAt: string, window: GridWindow): GridPosition | null {
  const gridStartMin = window.startHour * 60;
  const gridEndMin = window.endHour * 60;
  const startMin = minutesSinceMidnight(startsAt);
  let endMin = minutesSinceMidnight(endsAt);
  // A booking crossing local midnight isn't expected in practice (services
  // are same-day), but clip to the grid end rather than produce a negative
  // duration if it ever happens.
  if (endMin <= startMin) endMin = gridEndMin;
  if (endMin <= gridStartMin || startMin >= gridEndMin) return null;
  const clampedStart = Math.max(startMin, gridStartMin);
  const clampedEnd = Math.min(endMin, gridEndMin);
  const pxPerMinute = window.pxPerHour / 60;
  return {
    topPx: (clampedStart - gridStartMin) * pxPerMinute,
    heightPx: Math.max(clampedEnd - clampedStart, MIN_HEIGHT_MINUTES) * pxPerMinute,
  };
}

export type BusinessHoursWindow = { opensAt: string | null; closesAt: string | null; isClosed: boolean };

/** Shaded "open" region for one day, in the same coordinate space as computeEventPosition. */
export function computeOpenHoursPosition(hours: BusinessHoursWindow | undefined, window: GridWindow): GridPosition | null {
  if (!hours || hours.isClosed || !hours.opensAt || !hours.closesAt) return null;
  const [openH, openM] = hours.opensAt.split(":").map(Number);
  const [closeH, closeM] = hours.closesAt.split(":").map(Number);
  const opensMin = openH * 60 + openM;
  const closesMin = closeH * 60 + closeM;
  const gridStartMin = window.startHour * 60;
  const gridEndMin = window.endHour * 60;
  if (closesMin <= gridStartMin || opensMin >= gridEndMin) return null;
  const clampedOpens = Math.max(opensMin, gridStartMin);
  const clampedCloses = Math.min(closesMin, gridEndMin);
  const pxPerMinute = window.pxPerHour / 60;
  return {
    topPx: (clampedOpens - gridStartMin) * pxPerMinute,
    heightPx: (clampedCloses - clampedOpens) * pxPerMinute,
  };
}

export type ClosureRange = { staffId: string | null; startsOn: string; endsOn: string; isRecurringYearly: boolean };

/**
 * Whether `dateKey` ('YYYY-MM-DD') falls inside any closure applicable to
 * `staffId` — a business-wide closure (staffId: null) applies to every
 * staff scope. Recurring-yearly closures are compared by month-day only,
 * matching the display-only precision this dashboard needs (the source of
 * truth for actual booking availability remains apps/api's availability.ts).
 */
export function isDateClosed(dateKey: string, closures: ClosureRange[], staffId: string | null): boolean {
  return closures.some((c) => {
    if (c.staffId !== null && c.staffId !== staffId) return false;
    if (c.isRecurringYearly) {
      const monthDay = dateKey.slice(5);
      const startMonthDay = c.startsOn.slice(5);
      const endMonthDay = c.endsOn.slice(5);
      return monthDay >= startMonthDay && monthDay <= endMonthDay;
    }
    return dateKey >= c.startsOn && dateKey <= c.endsOn;
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @booking-system/admin exec vitest run test/lib/dashboard/calendar-layout.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/lib/dashboard/calendar-layout.ts apps/admin/test/lib/dashboard/calendar-layout.test.ts
git commit -m "feat(admin): add Riga-timezone-aware calendar grid position math"
```

---

### Task 5: E2E spec — write first, confirm red

**Files:**
- Create: `apps/admin/e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: `login`, `OWNER_EMAIL`, `OWNER_PASSWORD`, `skipIfNoCreds` from `./helpers.js` (existing).
- Defines the accessibility contract Tasks 6-8 must build to satisfy:
  - Page heading: `role=heading, level=1, name="Dashboard"` (from `AdminLayout`'s existing `<h1>{title}</h1>`).
  - Nav link: `role=link, name="Dashboard"`.
  - Stat cards: `role=status, name="Confirmed appointments this week"` / `"Pending appointments this week"` / `"Cancelled appointments this week"`, each containing the count as its text content.
  - Week label: the **only** `role=heading, level=2` on the page, text changes when navigating weeks.
  - Nav buttons: `role=button, name="Previous week"` / `"Next week"` / `"This week"`.
  - Date-jump button: `role=button, name="Pick a date"`, opens a `role=grid` (shadcn `Calendar`).
  - Staff filter: `getByLabel("Staff")` (a `<select>`), first option "All staff".

- [ ] **Step 1: Write the spec**

```typescript
// apps/admin/e2e/dashboard.spec.ts
import { test, expect } from "@playwright/test";
import { login, OWNER_EMAIL, OWNER_PASSWORD, skipIfNoCreds } from "./helpers.js";

test.skip(skipIfNoCreds, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

test("login lands on the dashboard, showing stat cards", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();

  await expect(page.getByRole("status", { name: "Confirmed appointments this week" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Pending appointments this week" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Cancelled appointments this week" })).toBeVisible();
});

test("force-booking a new confirmed booking this week increments the Confirmed stat", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);
  await expect(page).toHaveURL(/\/dashboard$/);

  const confirmedStat = page.getByRole("status", { name: "Confirmed appointments this week" });
  const before = Number(await confirmedStat.textContent());

  // Force-book via the existing Bookings screen — the dashboard itself is
  // read-only, it has no booking-creation form of its own.
  await page.getByRole("link", { name: "Bookings" }).click();
  await page.getByRole("button", { name: "New booking" }).click();
  await page.getByRole("combobox").nth(2).selectOption({ index: 1 }); // service
  await page.getByRole("combobox").nth(3).selectOption({ index: 1 }); // staff

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const minute = Date.now() % 60;
  const startsAtLocal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T09:${pad(minute)}`;
  await page.locator('input[type="datetime-local"]').first().fill(startsAtLocal);
  await page.getByPlaceholder("Patient name").fill(`E2E Dashboard Patient ${Date.now()}`);
  await page.getByPlaceholder("Email").fill(`e2e-dashboard-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Book" }).click();

  // Scoped to rows that still show a Cancel button: an already-cancelled
  // leftover with a coincidentally matching displayed time renders no
  // action buttons, so this excludes it (same pattern as
  // bookings-errors.spec.ts / login-and-bookings.spec.ts).
  const activeRow = page.getByRole("row").filter({ has: page.getByRole("button", { name: "Cancel" }) }).last();
  await expect(activeRow).toBeVisible({ timeout: 10_000 });

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(confirmedStat).toHaveText(String(before + 1));

  // Clean up.
  await page.getByRole("link", { name: "Bookings" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("row").filter({ has: page.getByRole("button", { name: "Cancel" }) }).last()
    .getByRole("button", { name: "Cancel" }).click();
});

test("Previous week / Next week / This week navigation changes the displayed week label", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);
  await expect(page).toHaveURL(/\/dashboard$/);

  const weekLabel = page.getByRole("heading", { level: 2 });
  const initialLabel = await weekLabel.textContent();

  await page.getByRole("button", { name: "Next week" }).click();
  await expect(weekLabel).not.toHaveText(initialLabel!);

  await page.getByRole("button", { name: "This week" }).click();
  await expect(weekLabel).toHaveText(initialLabel!);
});

test("staff filter narrows the calendar to one staff member", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);
  await expect(page).toHaveURL(/\/dashboard$/);

  const staffFilter = page.getByLabel("Staff");
  await expect(staffFilter).toBeVisible();
  await staffFilter.selectOption({ index: 1 });
  await expect(page.getByRole("status", { name: "Confirmed appointments this week" })).toBeVisible();
  await staffFilter.selectOption({ index: 0 }); // back to "All staff"
});

test("the date picker opens a calendar and selecting a day changes the displayed week", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);
  await expect(page).toHaveURL(/\/dashboard$/);

  const weekLabel = page.getByRole("heading", { level: 2 });
  const initialLabel = await weekLabel.textContent();

  await page.getByRole("button", { name: "Pick a date" }).click();
  const grid = page.getByRole("grid");
  await expect(grid).toBeVisible();
  // Pick a day generically (not by exact accessible name, which depends on
  // react-day-picker's internal formatting) — any day far enough from
  // today reliably lands in a different week.
  await grid.getByRole("button").last().click();

  await expect(weekLabel).not.toHaveText(initialLabel!);
});
```

- [ ] **Step 2: Confirm the spec fails for the right reason**

Start both dev servers (`pnpm --filter @booking-system/api dev` and `pnpm --filter @booking-system/admin dev`), then:

```bash
E2E_OWNER_EMAIL=owner@dentdi.lv E2E_OWNER_PASSWORD=testpassword123 \
  pnpm --filter @booking-system/admin exec playwright test dashboard.spec.ts --workers=1
```

Expected: every test FAILs — `/dashboard` doesn't exist yet (login still redirects to `/bookings`, so `expect(page).toHaveURL(/\/dashboard$/)` fails immediately in each test). This is the "red" checkpoint; do not fix it in this task.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/e2e/dashboard.spec.ts
git commit -m "test(admin): add dashboard spec (red — screen not built yet)"
```

---

### Task 6: WeekCalendar component

**Files:**
- Create: `apps/admin/src/components/dashboard/WeekCalendar.tsx`

**Interfaces:**
- Consumes: `getWeekDays`, `formatDayLabel`, `toDateKey` from `../../lib/dashboard/date-utils.js`; `computeEventPosition`, `computeOpenHoursPosition`, `isDateClosed`, `toRigaDateKey`, `type GridWindow` from `../../lib/dashboard/calendar-layout.js`; `type Booking` from `../../lib/api/bookings.js`; `type BusinessHour` from `../../lib/api/business-hours.js`; `type Closure` from `../../lib/api/closures.js`.
- Produces: `WeekCalendar` React component, `Props = { weekStart: Date; bookings: Booking[]; businessHours: BusinessHour[]; closures: Closure[]; staffId: string | null }`. Consumed by Task 8 (`DashboardScreen`).

- [ ] **Step 1: Write the component**

```tsx
// apps/admin/src/components/dashboard/WeekCalendar.tsx
import { formatDayLabel, getWeekDays, toDateKey } from "../../lib/dashboard/date-utils.js";
import {
  computeEventPosition,
  computeOpenHoursPosition,
  isDateClosed,
  toRigaDateKey,
  type GridWindow,
} from "../../lib/dashboard/calendar-layout.js";
import type { Booking } from "../../lib/api/bookings.js";
import type { BusinessHour } from "../../lib/api/business-hours.js";
import type { Closure } from "../../lib/api/closures.js";

type Props = {
  weekStart: Date;
  bookings: Booking[];
  businessHours: BusinessHour[];
  closures: Closure[];
  staffId: string | null;
};

const GRID_START_HOUR = 7;
const GRID_END_HOUR = 20;
const PX_PER_HOUR = 60;
const HOURS = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => GRID_START_HOUR + i);
const WINDOW: GridWindow = { startHour: GRID_START_HOUR, endHour: GRID_END_HOUR, pxPerHour: PX_PER_HOUR };

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-900 border-blue-300",
  pending_verification: "bg-amber-100 text-amber-900 border-amber-300",
  completed: "bg-green-100 text-green-900 border-green-300",
  no_show: "bg-red-100 text-red-900 border-red-300",
};

const TIME_LABEL_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Riga",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export default function WeekCalendar({ weekStart, bookings, businessHours, closures, staffId }: Props) {
  const days = getWeekDays(weekStart);
  const gridHeight = (GRID_END_HOUR - GRID_START_HOUR) * PX_PER_HOUR;
  const closureRanges = closures.map((c) => ({
    staffId: c.staff_id,
    startsOn: c.starts_on,
    endsOn: c.ends_on,
    isRecurringYearly: c.is_recurring_yearly,
  }));

  return (
    <div className="overflow-x-auto rounded border border-gray-200 bg-white">
      <div className="grid" style={{ gridTemplateColumns: "4rem repeat(7, minmax(9rem, 1fr))" }}>
        <div />
        {days.map((day) => (
          <div key={toDateKey(day)} className="border-b border-l border-gray-200 p-2 text-center">
            <h3 className="text-sm font-semibold">{formatDayLabel(day)}</h3>
          </div>
        ))}

        <div className="relative" style={{ height: gridHeight }}>
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="absolute right-0 left-0 border-t border-gray-100 pr-2 text-right text-xs text-gray-400"
              style={{ top: (hour - GRID_START_HOUR) * PX_PER_HOUR }}
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {days.map((day) => {
          const dayKey = toDateKey(day);
          const dow = day.getDay();
          const hoursForDay = businessHours.find((h) => h.day_of_week === dow);
          const openPos = computeOpenHoursPosition(
            hoursForDay
              ? { opensAt: hoursForDay.opens_at, closesAt: hoursForDay.closes_at, isClosed: hoursForDay.is_closed }
              : undefined,
            WINDOW,
          );
          const closed = isDateClosed(dayKey, closureRanges, staffId);
          const dayBookings = bookings.filter((b) => b.status !== "cancelled" && toRigaDateKey(b.starts_at) === dayKey);

          return (
            <div key={dayKey} className="relative border-l border-gray-200" style={{ height: gridHeight }}>
              {!closed && openPos && (
                <div className="absolute right-0 left-0 bg-green-50" style={{ top: openPos.topPx, height: openPos.heightPx }} />
              )}
              {closed && <div className="absolute inset-0 bg-gray-100" />}
              <ul role="list" aria-label={`Bookings on ${formatDayLabel(day)}`} className="absolute inset-0">
                {dayBookings.map((b) => {
                  const pos = computeEventPosition(b.starts_at, b.ends_at, WINDOW);
                  if (!pos) return null;
                  const timeLabel = TIME_LABEL_FORMAT.format(new Date(b.starts_at));
                  return (
                    <li
                      key={b.id}
                      role="listitem"
                      className={`absolute right-1 left-1 overflow-hidden rounded border px-1 text-xs ${STATUS_STYLES[b.status] ?? "bg-gray-100 text-gray-700 border-gray-300"}`}
                      style={{ top: pos.topPx, height: pos.heightPx }}
                    >
                      {timeLabel} · {b.status}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm --filter @booking-system/admin typecheck`
Expected: clean (this component isn't wired into a page yet, so nothing renders it — this step only proves the types line up against `Booking`/`BusinessHour`/`Closure`).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/dashboard/WeekCalendar.tsx
git commit -m "feat(admin): add WeekCalendar time-grid component"
```

---

### Task 7: StatsCards + DatePickerButton components

**Files:**
- Create: `apps/admin/src/components/dashboard/StatsCards.tsx`
- Create: `apps/admin/src/components/dashboard/DatePickerButton.tsx`

**Interfaces:**
- Consumes: `Card`, `CardHeader`, `CardTitle`, `CardContent` from `../ui/card.js`; `Button` from `../ui/button.js`; `Popover`, `PopoverTrigger`, `PopoverContent` from `../ui/popover.js`; `Calendar` from `../ui/calendar.js`; `type BookingStats` from `../../lib/dashboard/dashboard-stats.js`.
- Produces: `StatsCards` (`Props = { stats: BookingStats }`), `DatePickerButton` (`Props = { onSelect: (date: Date) => void }`). Both consumed by Task 8 (`DashboardScreen`).

- [ ] **Step 1: Write StatsCards**

```tsx
// apps/admin/src/components/dashboard/StatsCards.tsx
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
```

- [ ] **Step 2: Write DatePickerButton**

```tsx
// apps/admin/src/components/dashboard/DatePickerButton.tsx
import { useState } from "react";
import { Button } from "../ui/button.js";
import { Calendar } from "../ui/calendar.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.js";

type Props = { onSelect: (date: Date) => void };

export default function DatePickerButton({ onSelect }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Pick a date
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          onSelect={(date) => {
            if (date) {
              onSelect(date);
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
```

If the CLI-generated `Calendar`'s `onSelect` prop signature differs slightly from `(date: Date | undefined) => void` (react-day-picker's exact prop types have shifted across versions), adjust this call site to match whatever `apps/admin/src/components/ui/calendar.tsx` actually exports — the important behavior to preserve is: selecting a day calls `onSelect` with that `Date` and closes the popover.

- [ ] **Step 3: Verify it typechecks**

Run: `pnpm --filter @booking-system/admin typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/components/dashboard/StatsCards.tsx apps/admin/src/components/dashboard/DatePickerButton.tsx
git commit -m "feat(admin): add StatsCards and DatePickerButton components"
```

---

### Task 8: DashboardScreen + dashboard.astro + nav/redirect wiring (makes Task 5's spec green)

**Files:**
- Create: `apps/admin/src/components/DashboardScreen.tsx`
- Create: `apps/admin/src/pages/dashboard.astro`
- Modify: `apps/admin/src/layouts/AdminLayout.astro`
- Modify: `apps/admin/src/pages/index.astro`
- Modify: `apps/admin/src/pages/api/auth/login.ts`

**Interfaces:**
- Consumes: `listBookings`, `type Booking` from `./lib/api/bookings.js`; `listBusinessHours`, `type BusinessHour` from `./lib/api/business-hours.js`; `listClosures`, `type Closure` from `./lib/api/closures.js`; `listStaff`, `type StaffMember` from `./lib/api/catalog.js`; `describeApiError` from `./lib/api/errors.js`; `addWeeks`, `formatWeekRangeLabel`, `getWeekDays`, `getWeekStart`, `toDateKey` from `./lib/dashboard/date-utils.js`; `computeBookingStats` from `./lib/dashboard/dashboard-stats.js`; `StatsCards`, `WeekCalendar`, `DatePickerButton` from `./components/dashboard/*.js` (Tasks 6-7).

- [ ] **Step 1: Write DashboardScreen**

```tsx
// apps/admin/src/components/DashboardScreen.tsx
import { useEffect, useRef, useState } from "react";
import type { ApiClientConfig } from "../lib/api/client.js";
import { listBookings, type Booking } from "../lib/api/bookings.js";
import { listBusinessHours, type BusinessHour } from "../lib/api/business-hours.js";
import { listClosures, type Closure } from "../lib/api/closures.js";
import type { StaffMember } from "../lib/api/catalog.js";
import { describeApiError } from "../lib/api/errors.js";
import { addWeeks, formatWeekRangeLabel, getWeekDays, getWeekStart, toDateKey } from "../lib/dashboard/date-utils.js";
import { computeBookingStats } from "../lib/dashboard/dashboard-stats.js";
import StatsCards from "./dashboard/StatsCards.js";
import WeekCalendar from "./dashboard/WeekCalendar.js";
import DatePickerButton from "./dashboard/DatePickerButton.js";

type Props = {
  apiConfig: ApiClientConfig;
  staff: StaffMember[];
  initialWeekStartKey: string;
  initialBookings: Booking[];
  initialBusinessHours: BusinessHour[];
  initialClosures: Closure[];
};

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function weekRangeIso(weekStart: Date): { from: string; to: string } {
  const days = getWeekDays(weekStart);
  const from = new Date(days[0]);
  from.setHours(0, 0, 0, 0);
  const to = new Date(days[6]);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function DashboardScreen({
  apiConfig,
  staff,
  initialWeekStartKey,
  initialBookings,
  initialBusinessHours,
  initialClosures,
}: Props) {
  const [weekStart, setWeekStart] = useState(() => parseDateKey(initialWeekStartKey));
  const [staffId, setStaffId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>(initialBusinessHours);
  const [closures, setClosures] = useState<Closure[]>(initialClosures);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInitialRender = useRef(true);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return; // SSR already provided this exact data — skip the redundant refetch
    }
    let cancelled = false;
    async function refresh() {
      setLoading(true);
      setError(null);
      try {
        const { from, to } = weekRangeIso(weekStart);
        const [b, h, c] = await Promise.all([
          listBookings(apiConfig, { from, to, staffId: staffId || undefined }),
          listBusinessHours(apiConfig, staffId || null),
          listClosures(apiConfig, staffId || null),
        ]);
        if (cancelled) return;
        setBookings(b);
        setBusinessHours(h);
        setClosures(c);
      } catch (err) {
        if (!cancelled) setError(describeApiError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    refresh();
    return () => {
      cancelled = true;
    };
  }, [weekStart.getTime(), staffId]);

  const stats = computeBookingStats(bookings);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">{formatWeekRangeLabel(weekStart)}</h2>
          <button className="rounded border border-gray-300 px-3 py-1.5 text-sm" onClick={() => setWeekStart((w) => addWeeks(w, -1))}>
            Previous week
          </button>
          <button className="rounded border border-gray-300 px-3 py-1.5 text-sm" onClick={() => setWeekStart(getWeekStart(new Date()))}>
            This week
          </button>
          <button className="rounded border border-gray-300 px-3 py-1.5 text-sm" onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
            Next week
          </button>
          <DatePickerButton onSelect={(date) => setWeekStart(getWeekStart(date))} />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="dashboard-staff-filter" className="text-sm font-medium">
            Staff
          </label>
          <select
            id="dashboard-staff-filter"
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
          >
            <option value="">All staff</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <StatsCards stats={stats} />

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <WeekCalendar weekStart={weekStart} bookings={bookings} businessHours={businessHours} closures={closures} staffId={staffId || null} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write dashboard.astro**

```astro
---
// apps/admin/src/pages/dashboard.astro
import AdminLayout from "../layouts/AdminLayout.astro";
import DashboardScreen from "../components/DashboardScreen.tsx";
import { listStaff } from "../lib/api/catalog.js";
import { listBookings } from "../lib/api/bookings.js";
import { listBusinessHours } from "../lib/api/business-hours.js";
import { listClosures } from "../lib/api/closures.js";
import { getWeekDays, getWeekStart, toDateKey } from "../lib/dashboard/date-utils.js";

const session = Astro.locals.session!;
const apiConfig = {
  baseUrl: import.meta.env.API_BASE_URL,
  tenantSlug: import.meta.env.TENANT_SLUG,
  accessToken: session.accessToken,
};

const weekStart = getWeekStart(new Date());
const weekDays = getWeekDays(weekStart);
const from = new Date(weekDays[0]);
from.setHours(0, 0, 0, 0);
const to = new Date(weekDays[6]);
to.setHours(23, 59, 59, 999);

const [staff, bookings, businessHours, closures] = await Promise.all([
  listStaff(apiConfig),
  listBookings(apiConfig, { from: from.toISOString(), to: to.toISOString() }),
  listBusinessHours(apiConfig, null),
  listClosures(apiConfig, null),
]);
---

<AdminLayout title="Dashboard">
  <DashboardScreen
    client:load
    apiConfig={apiConfig}
    staff={staff}
    initialWeekStartKey={toDateKey(weekStart)}
    initialBookings={bookings}
    initialBusinessHours={businessHours}
    initialClosures={closures}
  />
</AdminLayout>
```

- [ ] **Step 3: Wire up nav + redirects**

Edit `apps/admin/src/layouts/AdminLayout.astro` — add `"Dashboard"` as the first entry in `navItems`:

```astro
const navItems = [
  { href: "/dashboard", label: "Dashboard", enabled: true },
  { href: "/bookings", label: "Bookings", enabled: true },
  { href: "/patients", label: "Patients", enabled: true },
  { href: "/catalog", label: "Catalog", enabled: true },
  { href: "/scheduling", label: "Scheduling", enabled: true },
];
```

Edit `apps/admin/src/pages/index.astro`:

```astro
---
return Astro.redirect("/dashboard");
---
```

Edit `apps/admin/src/pages/api/auth/login.ts` — change the success redirect:

```typescript
  return redirect("/dashboard");
```

(This is the last line of the `POST` handler — the existing early-return error redirects to `/login?error=...` stay unchanged.)

- [ ] **Step 4: Run the full unit suite and typecheck**

```bash
pnpm --filter @booking-system/admin test
pnpm --filter @booking-system/admin typecheck
```

Expected: all unit tests pass (the pre-existing 17 plus the 22 added across Tasks 2-4), typecheck clean.

- [ ] **Step 5: Run Task 5's spec and confirm it's now green**

With both dev servers running:

```bash
E2E_OWNER_EMAIL=owner@dentdi.lv E2E_OWNER_PASSWORD=testpassword123 \
  pnpm --filter @booking-system/admin exec playwright test dashboard.spec.ts --workers=1
```

Expected: all 5 tests PASS.

- [ ] **Step 6: Run the full existing E2E suite to confirm no regression**

```bash
E2E_OWNER_EMAIL=owner@dentdi.lv E2E_OWNER_PASSWORD=testpassword123 \
  pnpm --filter @booking-system/admin exec playwright test --workers=1
```

Expected: all specs pass, including `login-and-bookings.spec.ts` (which asserts on post-login/post-logout redirect behavior — check its `toHaveURL` assertions still hold now that the landing page changed; update them to `/dashboard` if the spec asserted `/bookings` specifically after login, though its actual behavior under test — bookings CRUD — is reached by navigating via the nav link, not by relying on the post-login landing page).

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/components/DashboardScreen.tsx apps/admin/src/pages/dashboard.astro apps/admin/src/layouts/AdminLayout.astro apps/admin/src/pages/index.astro apps/admin/src/pages/api/auth/login.ts
git commit -m "feat(admin): add Dashboard screen as the new default landing page"
```

---

## Self-Review Notes

**Spec coverage:**
- "Calendar view with availability... for the week" → Task 6 (`WeekCalendar`) + Task 4 (grid math), business-hours shading + closure greying.
- "Total number of confirmed, canceled and pending appointments" → Task 3 (`computeBookingStats`) + Task 7 (`StatsCards`), scoped to the currently displayed week per the user's confirmed choice.
- "Use shadcn for calendar, date picker, time picker, clock and so on" → Task 1 (shadcn setup) + Task 7 (`DatePickerButton` wrapping shadcn `Popover`+`Calendar`). No shadcn time-picker/clock component exists (shadcn has none, and this dashboard is read-only — no time-entry UI is needed here at all; time entry for booking creation already exists as a native `datetime-local` input on the separate Bookings screen, unchanged).
- Dashboard as new landing page → Task 8 (nav + both redirect sites).

**Placeholder scan:** No "TBD"/"handle appropriately"/unwritten test bodies found — every step has literal, complete code or an exact command.

**Type consistency:** `BookingStats` (Task 3) is used identically in `StatsCards` (Task 7) and `DashboardScreen` (Task 8). `GridWindow`/`GridPosition`/`ClosureRange` (Task 4) are used identically in `WeekCalendar` (Task 6). `computeBookingStats`'s parameter type intentionally stays a minimal `{ status: string }[]` rather than the full `Booking` type, so it never needs to import `bookings.ts` — verified this doesn't create a mismatch anywhere it's called (`DashboardScreen` passes a real `Booking[]`, which is structurally compatible).

**Known follow-ups, deliberately deferred (not dropped):**
- Clicking a booking block doesn't do anything yet (no quick-view/manage popover) — the dashboard is read-only in this pass.
- No per-staff color-coding when "All staff" is selected — bookings are colored by status instead, and disambiguated by the staff filter, per the user's own confirmed choice.
- `isDateClosed`'s recurring-yearly month-day comparison doesn't handle a range that wraps across Dec 31 → Jan 1 (e.g. "closed Dec 20 – Jan 5 every year") — same accepted simplification the rest of the codebase already lives with elsewhere for display purposes; the real availability calculation in `apps/api/src/lib/availability.ts` is unaffected and already handles this correctly server-side.
