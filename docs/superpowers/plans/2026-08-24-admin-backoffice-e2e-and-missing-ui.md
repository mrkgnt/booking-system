# Admin Back-Office E2E Coverage + Missing CRUD UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `apps/admin` to full parity with `apps/api`'s admin surface — every `/admin/*` resource that already has a working backend route gets a real UI screen — and cover the whole back office (login, bookings, patients, catalog, scheduling) with live Playwright E2E tests against the real Dent Di Supabase project, using `owner@dentdi.lv` / `testpassword123`.

**Architecture:** For each resource with API support but no UI (patients, service categories, services, staff + staff↔service linking, business hours, closures), write the Playwright spec first against a concrete accessibility contract defined in this plan, confirm it fails for the right reason, then hand the *build* work to a fresh subagent that never sees the spec file — only the functional contract — so the UI is built to the spec, not reverse-engineered from test assertions. Reuse every existing pattern: `ApiClientConfig`/`apiFetch`/`ApiError`/`describeApiError`, the `AdminLayout` nav (already has disabled placeholders for Patients/Catalog/Scheduling), and the inline-edit/confirm-before-destroy interaction style already used in `BookingsScreen.tsx`.

**Tech Stack:** Astro (server output) + React islands (`client:load`) + Tailwind v4, `@playwright/test` (chromium only), `@supabase/ssr` session already wired, existing `apps/api` Hono admin routes (no backend changes in this plan — every route already exists).

**Spec:** This plan *is* the spec — synthesized from live inspection of `apps/api/src/routes/admin-*.ts` (route contracts), `apps/admin/src/**` (existing UI conventions), `apps/admin/e2e/login-and-bookings.spec.ts` (existing E2E conventions), `docs/superpowers/plans/2026-08-22-staff-admin-backend.md` (Task 17's still-unverified route list), `docs/superpowers/plans/2026-08-22-back-office-admin-ui.md` (explicitly deferred: Patients/Catalog CRUD UI), and `CLAUDE.md`'s "Open / Non-Blocking Items". User command: *"everything that has been implemented on the API side has to be present in the UI and be tested with playwright... if UI functionality is absent but API exists, write test 1st, then deploy new agent to develop the UI so it doesn't write code specifically to fit the test. TDD is a must."*

## Global Constraints

- E2E specs run against the **real, live Dent Di Supabase project** via already-running local dev servers (`apps/api` on `:8081`, `apps/admin` on `:8080`) — never mock the backend, exactly like `login-and-bookings.spec.ts` already does. No `webServer` in `playwright.config.ts`; that stays unmanaged.
- Credentials for every spec: `E2E_OWNER_EMAIL=owner@dentdi.lv`, `E2E_OWNER_PASSWORD=testpassword123`, passed as env vars at run time — **never** hardcoded into a spec file. Every spec must `test.skip(...)` (not fail) when these are unset, matching the existing spec.
- **This session cannot verify Playwright runs itself** — prior sessions in this repo hit `*.supabase.co` egress blocks from this sandbox (see `CLAUDE.md`'s repeated "not verified live" notes). Every "run the test" step in this plan must actually be executed by a human or an agent with real network access to the live project and both dev servers running. In-sandbox, run `pnpm --filter @booking-system/admin typecheck` and `pnpm --filter @booking-system/admin test` (vitest, no network) for fast feedback instead, and treat Playwright output as something the executor pastes back for review.
- Selectors: role/label/placeholder-based only (`getByRole`, `getByLabel`, `getByPlaceholder`, `getByText`) — no `data-testid`, no CSS selectors. This mirrors the existing spec and forces the UI to be genuinely accessible rather than test-hooked.
- Locales are always exactly `lv`, `ru`, `en` in that order (LV+RU+EN per `CLAUDE.md`'s Decisions Log). Every translated-field form has exactly three text inputs for that field, in that order, with placeholders `"<Field> (LV)"`, `"<Field> (RU)"`, `"<Field> (EN)"` — matching this codebase's existing preference for placeholders over `<label>` on data-entry forms (only the login form uses real `<label>`s; `BookingsScreen`'s force-book form uses placeholders and unlabeled selects/inputs referenced positionally).
- `business_hours.day_of_week` is `0 = Sunday … 6 = Saturday` — confirmed from `apps/api/src/lib/availability.ts`'s `new Date(...).getUTCDay()`, not assumed.
- **TDD sequencing for every new screen** (Tasks 3–8): (1) write the failing Playwright spec against the accessibility contract given in that task, (2) run it, confirm it fails for the right reason (missing route/element — a 404 or "element not found", not a typo in the test itself), (3) use the Agent tool to dispatch a **separate, fresh** agent to build the UI, giving it *only* the functional/accessibility contract reproduced in that task's "UI contract to hand the build agent" block — **never** show it the `.spec.ts` file, never paste its contents, never mention its existence, (4) re-run the spec, get it green — one iteration is acceptable if the agent's exact wording drifts from the contract (fix the *UI* to match the contract; do not loosen the test to match whatever the agent built). No screen is "done" until its spec is green against the live project.
- New mutating screens surface errors via the existing `describeApiError` (`apps/admin/src/lib/api/errors.ts`) — reuse it, don't invent new error copy or a new banner pattern.
- Follow existing file conventions exactly: `.js` extensions on relative imports (NodeNext resolution), React islands hydrate with `client:load`, Tailwind utility classes only, API client modules live in `src/lib/api/`, types come from `Database["public"]["Tables"][...]["Row"]` in `apps/api/src/lib/database.types.ts` re-imported via the existing relative path (`../../../../api/src/lib/database.types.js`).

---

## File Structure

**New E2E specs** (`apps/admin/e2e/`):
- `helpers.ts` — shared `login()` + credential constants, extracted from the existing spec
- `bookings-errors.spec.ts` — negative-path booking coverage (conflict, client validation)
- `patients.spec.ts`
- `catalog-categories.spec.ts`
- `catalog-services.spec.ts`
- `catalog-staff.spec.ts`
- `scheduling-hours.spec.ts`
- `scheduling-closures.spec.ts`

**Modified:** `apps/admin/e2e/login-and-bookings.spec.ts` (use the new helper — no behavior change).

**New API client modules** (`apps/admin/src/lib/api/`):
- `patients.ts`
- `service-categories.ts`
- `business-hours.ts`
- `closures.ts`

**Modified:** `apps/admin/src/lib/api/catalog.ts` (add `createService`/`updateService`/`deleteService`, `createStaffMember`/`updateStaffMember`/`deleteStaffMember`, `replaceStaffServices` alongside the existing read-only `listServices`/`listStaff` — those two stay untouched since `BookingsScreen` depends on them).

**New pages:**
- `apps/admin/src/pages/patients/index.astro`, `apps/admin/src/pages/patients/[id].astro`
- `apps/admin/src/pages/catalog.astro`
- `apps/admin/src/pages/scheduling.astro`

**New components:**
- `apps/admin/src/components/PatientsScreen.tsx`, `apps/admin/src/components/PatientDetailScreen.tsx`
- `apps/admin/src/components/CatalogScreen.tsx` (tab shell: Categories/Services/Staff)
- `apps/admin/src/components/catalog/CategoriesPanel.tsx`, `ServicesPanel.tsx`, `StaffPanel.tsx`
- `apps/admin/src/components/SchedulingScreen.tsx` (tab shell: Business Hours/Closures)
- `apps/admin/src/components/scheduling/HoursPanel.tsx`, `ClosuresPanel.tsx`

**Modified:** `apps/admin/src/layouts/AdminLayout.astro` (flip `enabled: false` → `true` for Patients/Catalog/Scheduling nav items, one flip per task as that task's screen lands).

---

### Task 1: Extract shared E2E login helper

**Files:**
- Create: `apps/admin/e2e/helpers.ts`
- Modify: `apps/admin/e2e/login-and-bookings.spec.ts`

**Interfaces:**
- Produces: `login(page: Page, email: string, password: string): Promise<void>`, `OWNER_EMAIL: string | undefined`, `OWNER_PASSWORD: string | undefined`, `skipIfNoCreds: boolean` — every later task's spec imports these from `./helpers.js`.

This is a pure refactor (six more specs are about to need the same login boilerplate) — no new behavior, so no red/green cycle, just a before/after equivalence check.

- [ ] **Step 1: Create the helper file**

```typescript
// apps/admin/e2e/helpers.ts
import { expect, type Page } from "@playwright/test";

export const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL;
export const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD;
export const skipIfNoCreds = !OWNER_EMAIL || !OWNER_PASSWORD;

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/bookings$/);
}
```

- [ ] **Step 2: Update the existing spec to use it**

Replace lines 1–20 of `apps/admin/e2e/login-and-bookings.spec.ts` (imports through the login block) with:

```typescript
import { test, expect } from "@playwright/test";
import { login, OWNER_EMAIL, OWNER_PASSWORD, skipIfNoCreds } from "./helpers.js";

test.skip(skipIfNoCreds, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

test("login, view bookings, force-book, cancel, reschedule, log out", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);
  await expect(page.getByRole("table")).toBeVisible();
  // ... rest of the test body (filter round-trip through the final redirect-guard
  // assertion) is unchanged — only the login preamble moved into helpers.ts.
```

Leave everything from the "Filter by staff" comment onward exactly as it is today.

- [ ] **Step 3: Run the existing spec to confirm the refactor didn't change behavior**

Run: `E2E_OWNER_EMAIL=owner@dentdi.lv E2E_OWNER_PASSWORD=testpassword123 pnpm --filter @booking-system/admin test:e2e -- e2e/login-and-bookings.spec.ts` (requires both dev servers running locally — see Global Constraints)
Expected: PASS, identical behavior to before the refactor.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/e2e/helpers.ts apps/admin/e2e/login-and-bookings.spec.ts
git commit -m "test(admin): extract shared E2E login helper"
```

---

### Task 2: Booking negative-path E2E coverage

**Files:**
- Create: `apps/admin/e2e/bookings-errors.spec.ts`

**Interfaces:**
- Consumes: `login`, `OWNER_EMAIL`, `OWNER_PASSWORD`, `skipIfNoCreds` from `./helpers.js` (Task 1).

The UI already exists (`BookingsScreen.tsx`) and already surfaces server errors via `describeApiError`, so this task verifies existing behavior rather than driving new UI — it should go green immediately. If it doesn't, that's a real bug to flag, not a test to loosen.

- [ ] **Step 1: Write the failing (well — should-already-pass) test**

```typescript
// apps/admin/e2e/bookings-errors.spec.ts
import { test, expect } from "@playwright/test";
import { login, OWNER_EMAIL, OWNER_PASSWORD, skipIfNoCreds } from "./helpers.js";

test.skip(skipIfNoCreds, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

test("force-book rejects a conflicting slot with a visible error, and doesn't duplicate the booking", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);

  const pad = (n: number) => String(n).padStart(2, "0");
  const day = 1 + (Date.now() % 27);
  const startsAt = `2032-03-${pad(day)}T09:00`;
  const label = `${day} Mar 2032`;

  async function forceBook() {
    await page.getByRole("button", { name: "New booking" }).click();
    await page.getByRole("combobox").nth(2).selectOption({ index: 1 });
    await page.getByRole("combobox").nth(3).selectOption({ index: 1 });
    await page.locator('input[type="datetime-local"]').first().fill(startsAt);
    await page.getByPlaceholder("Patient name").fill(`E2E Conflict Patient ${Date.now()}`);
    await page.getByPlaceholder("Email").fill(`e2e-conflict-${Date.now()}@example.com`);
    await page.getByRole("button", { name: "Book" }).click();
  }

  await forceBook();
  const row = page.getByRole("row").filter({ hasText: label });
  await expect(row).toBeVisible({ timeout: 10_000 });

  // Same service/staff/time again — must be rejected, not silently duplicated.
  await forceBook();
  await expect(page.getByText("That time slot is no longer available.")).toBeVisible();
  await expect(row).toHaveCount(1);

  // Clean up the one booking that did get created.
  page.once("dialog", (d) => d.accept());
  await row.first().getByRole("button", { name: "Cancel" }).click();
  await expect(row.first().getByRole("button", { name: "Cancel" })).toHaveCount(0);
});

test("force-book form blocks submission with missing patient contact info", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);

  await page.getByRole("button", { name: "New booking" }).click();
  await page.getByRole("combobox").nth(2).selectOption({ index: 1 });
  await page.getByRole("combobox").nth(3).selectOption({ index: 1 });
  await page.locator('input[type="datetime-local"]').first().fill("2032-04-10T09:00");
  // Patient name and email/phone all left blank.
  await page.getByRole("button", { name: "Book" }).click();

  await expect(page.getByText("Patient name is required.")).toBeVisible();
  await expect(page.getByText("Patient email or phone is required.")).toBeVisible();
  // Confirms nothing was submitted to the API: the form is still open.
  await expect(page.getByRole("button", { name: "Book" })).toBeVisible();
});
```

- [ ] **Step 2: Run it**

Run: `E2E_OWNER_EMAIL=owner@dentdi.lv E2E_OWNER_PASSWORD=testpassword123 pnpm --filter @booking-system/admin test:e2e -- e2e/bookings-errors.spec.ts`
Expected: PASS. If either assertion fails, that's a real defect in `BookingsScreen.tsx` or `describeApiError` — fix the source, not the test (this task is verification, not TDD-driven implementation).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/e2e/bookings-errors.spec.ts
git commit -m "test(admin): cover booking conflict and validation error paths"
```

---

### Task 3: Patients screen (list, search, detail, edit)

**Files:**
- Create: `apps/admin/src/lib/api/patients.ts`
- Create: `apps/admin/src/pages/patients/index.astro`, `apps/admin/src/pages/patients/[id].astro`
- Create: `apps/admin/src/components/PatientsScreen.tsx`, `apps/admin/src/components/PatientDetailScreen.tsx`
- Modify: `apps/admin/src/layouts/AdminLayout.astro:7` (`{ href: "/patients", label: "Patients", enabled: false }` → `enabled: true`)
- Test: `apps/admin/e2e/patients.spec.ts`

**Interfaces:**
- Consumes: `apiFetch`, `ApiClientConfig`, `ApiError` (`client.ts`); `describeApiError` (`errors.ts`); `Booking` type (`bookings.ts`).
- Produces (`patients.ts`, written directly in Step 1 — this is a thin HTTP wrapper, not "UI", so it's written here rather than delegated):

```typescript
// apps/admin/src/lib/api/patients.ts
import { apiFetch, type ApiClientConfig } from "./client.js";
import type { Database } from "../../../../api/src/lib/database.types.js";
import type { Booking } from "./bookings.js";

export type Patient = Database["public"]["Tables"]["patients"]["Row"];

export async function listPatients(config: ApiClientConfig, q?: string): Promise<Patient[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  const { patients } = await apiFetch<{ patients: Patient[] }>(config, `/admin/patients${qs}`);
  return patients;
}

export async function getPatient(config: ApiClientConfig, id: string): Promise<{ patient: Patient; bookings: Booking[] }> {
  return apiFetch(config, `/admin/patients/${id}`);
}

export type UpdatePatientInput = Partial<{ name: string; email: string; phone: string; notes: string }>;

export async function updatePatient(config: ApiClientConfig, id: string, input: UpdatePatientInput): Promise<Patient> {
  const { patient } = await apiFetch<{ patient: Patient }>(config, `/admin/patients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return patient;
}
```

- [ ] **Step 1: Write `patients.ts`** (code above), commit is deferred to the end of this task.

- [ ] **Step 2: Write the failing Playwright spec**

```typescript
// apps/admin/e2e/patients.spec.ts
import { test, expect } from "@playwright/test";
import { login, OWNER_EMAIL, OWNER_PASSWORD, skipIfNoCreds } from "./helpers.js";

test.skip(skipIfNoCreds, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

test("browse patients, open a detail page, edit and persist notes", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);

  await page.getByRole("link", { name: "Patients" }).click();
  await expect(page).toHaveURL(/\/patients$/);
  const table = page.getByRole("table");
  await expect(table).toBeVisible();

  const firstRow = page.getByRole("row").nth(1); // nth(0) is the header row
  const patientName = (await firstRow.locator("td").first().textContent())!.trim();
  await firstRow.getByRole("link", { name: "View" }).click();
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}$/);
  await expect(page.getByText(patientName)).toBeVisible();

  const note = `E2E note ${Date.now()}`;
  const notesField = page.getByPlaceholder("Notes");
  await notesField.fill(note);
  await page.getByRole("button", { name: "Save" }).click();

  // Reload to prove persistence rather than trusting client-side state.
  await page.reload();
  await expect(page.getByPlaceholder("Notes")).toHaveValue(note);

  await page.getByRole("link", { name: "Back to patients" }).click();
  await expect(page).toHaveURL(/\/patients$/);
});

test("search filters the patients list", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);
  await page.getByRole("link", { name: "Patients" }).click();

  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  const initialRows = await page.getByRole("row").count();

  await page.getByPlaceholder("Search patients").fill("zzz-no-such-patient-zzz");
  await expect(page.getByText("No patients found.")).toBeVisible();

  await page.getByPlaceholder("Search patients").fill("");
  await expect(page.getByRole("row")).toHaveCount(initialRows);
});
```

- [ ] **Step 3: Run it, confirm it fails**

Run: `E2E_OWNER_EMAIL=owner@dentdi.lv E2E_OWNER_PASSWORD=testpassword123 pnpm --filter @booking-system/admin test:e2e -- e2e/patients.spec.ts`
Expected: FAIL — `getByRole("link", { name: "Patients" })` never resolves to a clickable link, because `AdminLayout.astro` still renders it as a disabled `<span>`. Confirm the failure is exactly this (missing/disabled nav link), not a typo in the spec.

- [ ] **Step 4: Dispatch a fresh agent to build the screen**

Using the Agent tool (`subagent_type: general-purpose`), dispatch a new agent with **exactly** this prompt. Do not show it `apps/admin/e2e/patients.spec.ts`, paste its contents, or mention that a test exists for this screen:

```
Build the Patients screen for the Dent Di admin back office at
/home/mrkgnt/Projects/Development/booking-system/apps/admin. This is an
Astro (server output) + React islands + Tailwind v4 app. Follow the
existing conventions in apps/admin/src/pages/bookings.astro and
apps/admin/src/components/BookingsScreen.tsx exactly (read both files
first) — same ApiClientConfig prop-passing pattern from an Astro page
into a client:load React island, same Tailwind utility-class style, same
error handling via describeApiError from apps/admin/src/lib/api/errors.ts.

The API client module apps/admin/src/lib/api/patients.ts already exists
with listPatients(config, q?), getPatient(config, id), and
updatePatient(config, id, input) — use it as-is, do not modify it.

Build:

1. apps/admin/src/pages/patients/index.astro — SSR page (mirror
   bookings.astro's structure: read Astro.locals.session, build
   apiConfig from import.meta.env.API_BASE_URL / TENANT_SLUG /
   session.accessToken, fetch the initial patient list server-side via
   listPatients(apiConfig), wrap in <AdminLayout title="Patients">,
   render a client:load PatientsScreen island with apiConfig and the
   initial patients as props.

2. apps/admin/src/components/PatientsScreen.tsx — a React component
   with:
   - A text input with placeholder exactly "Search patients". Typing in
     it re-fetches via listPatients(apiConfig, query) (debounce is not
     required — refetch on every change, same pattern as
     BookingsScreen's filter useEffect).
   - A <table> (real <table>/<thead>/<tbody> elements so Playwright's
     role="table"/role="row" queries work) with columns: Name, Email,
     Phone, Created — one row per patient, first cell contains the
     patient's name as plain text.
   - Each row has a link with accessible name exactly "View" (an <a>
     element, e.g. <a href={`/patients/${p.id}`}>View</a>) navigating to
     that patient's detail page.
   - When the list is empty, render a single row whose cell reads
     exactly "No patients found." (mirror BookingsScreen's empty-state
     row).
   - Surface fetch errors via describeApiError in a red banner, same
     visual style as BookingsScreen's error banner
     (`className="rounded bg-red-50 px-3 py-2 text-sm text-red-700"`).

3. apps/admin/src/pages/patients/[id].astro — SSR dynamic route. Read
   the `id` param, call getPatient(apiConfig, id) server-side (this
   returns { patient, bookings }), wrap in <AdminLayout title="Patient">,
   render a client:load PatientDetailScreen island with apiConfig,
   patient, and bookings as props.

4. apps/admin/src/components/PatientDetailScreen.tsx — a React
   component with:
   - A link with accessible name exactly "Back to patients" pointing to
     /patients.
   - The patient's name rendered as visible text somewhere on the page
     (e.g. a heading).
   - An edit form with these exact fields, each an <input> (or
     <textarea> for Notes) with a placeholder matching its purpose —
     specifically the Notes field MUST have placeholder exactly "Notes"
     (a <textarea placeholder="Notes">) — and other fields with
     reasonable placeholders ("Name", "Email", "Phone"), all pre-filled
     from the patient prop.
   - A submit button with accessible name exactly "Save" that calls
     updatePatient(apiConfig, patient.id, { name, email, phone, notes })
     with the current form values, and on success does NOT navigate
     away (the field values stay as-is so a page reload can verify
     persistence). On error, show describeApiError's message in the
     same red-banner style.
   - Below the form, a read-only <table> of the patient's booking
     history with columns Starts and Status (use the bookings prop
     directly — starts_at and status fields exist on each booking row;
     format starts_at with formatBookingTime from
     apps/admin/src/lib/format.ts, same as BookingsScreen does).

5. Modify apps/admin/src/layouts/AdminLayout.astro: change the Patients
   nav item's `enabled: false` to `enabled: true` (line ~7) so it
   renders as a real <a href="/patients"> link instead of a disabled
   span.

Do not add features beyond what's listed above (no pagination, no
delete-patient, no create-patient — this platform only ever creates
patients implicitly via booking). Match the existing code's minimalism:
no comments explaining what the code does, small focused components,
reuse existing helpers rather than reimplementing them. When done,
briefly summarize which files you created/modified.
```

- [ ] **Step 5: Re-run the spec, confirm it passes**

Run: `E2E_OWNER_EMAIL=owner@dentdi.lv E2E_OWNER_PASSWORD=testpassword123 pnpm --filter @booking-system/admin test:e2e -- e2e/patients.spec.ts`
Expected: PASS. If a selector mismatch surfaces (e.g. the agent used a `<label>` instead of a placeholder), fix the component to match this task's contract — do not weaken the spec's assertions.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @booking-system/admin typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/lib/api/patients.ts apps/admin/src/pages/patients apps/admin/src/components/PatientsScreen.tsx apps/admin/src/components/PatientDetailScreen.tsx apps/admin/src/layouts/AdminLayout.astro apps/admin/e2e/patients.spec.ts
git commit -m "feat(admin): add patients list/search/detail/edit screen"
```

---

### Task 4: Catalog screen — Service Categories tab

**Files:**
- Create: `apps/admin/src/lib/api/service-categories.ts`
- Create: `apps/admin/src/pages/catalog.astro`
- Create: `apps/admin/src/components/CatalogScreen.tsx`, `apps/admin/src/components/catalog/CategoriesPanel.tsx`
- Modify: `apps/admin/src/layouts/AdminLayout.astro` (`Catalog` nav item `enabled: true`)
- Test: `apps/admin/e2e/catalog-categories.spec.ts`

**Interfaces:**
- Produces (`service-categories.ts`, written directly, same rationale as Task 3):

```typescript
// apps/admin/src/lib/api/service-categories.ts
import { apiFetch, type ApiClientConfig } from "./client.js";
import type { Database } from "../../../../api/src/lib/database.types.js";

export type ServiceCategory = Database["public"]["Tables"]["service_categories"]["Row"] & {
  name: Record<string, string>;
};

export type ServiceCategoryInput = {
  icon?: string;
  displayOrder: number;
  isActive: boolean;
  name: Record<"lv" | "ru" | "en", string>;
};

export async function listServiceCategories(config: ApiClientConfig): Promise<ServiceCategory[]> {
  const { serviceCategories } = await apiFetch<{ serviceCategories: ServiceCategory[] }>(config, "/admin/service-categories");
  return serviceCategories;
}

export async function createServiceCategory(config: ApiClientConfig, input: ServiceCategoryInput): Promise<ServiceCategory> {
  const { serviceCategory } = await apiFetch<{ serviceCategory: ServiceCategory }>(config, "/admin/service-categories", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return serviceCategory;
}

export async function updateServiceCategory(
  config: ApiClientConfig,
  id: string,
  input: Partial<ServiceCategoryInput>,
): Promise<ServiceCategory> {
  const { serviceCategory } = await apiFetch<{ serviceCategory: ServiceCategory }>(config, `/admin/service-categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return serviceCategory;
}

export async function deleteServiceCategory(config: ApiClientConfig, id: string): Promise<void> {
  await apiFetch<void>(config, `/admin/service-categories/${id}`, { method: "DELETE" });
}
```

- Produces (component-level, for Task 5/6 to extend): `CatalogScreen.tsx` holds `activeTab` state (`"categories" | "services" | "staff"`) and renders three always-mounted tab buttons — "Categories", "Services", "Staff" — plus the panel for `activeTab`. Task 5 and 6 add real tab-switch behavior for their tabs; this task's build agent should render the "Services" and "Staff" buttons but they may be inert placeholders until those tasks land (a disabled-looking button is fine — the important part for this task's spec is that "Categories" works and is the default tab).

- [ ] **Step 1: Write `service-categories.ts`** (code above).

- [ ] **Step 2: Write the failing Playwright spec**

```typescript
// apps/admin/e2e/catalog-categories.spec.ts
import { test, expect } from "@playwright/test";
import { login, OWNER_EMAIL, OWNER_PASSWORD, skipIfNoCreds } from "./helpers.js";

test.skip(skipIfNoCreds, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

test("create, edit, and delete a service category", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);

  await page.getByRole("link", { name: "Catalog" }).click();
  await expect(page).toHaveURL(/\/catalog$/);
  await expect(page.getByRole("table")).toBeVisible();

  const suffix = Date.now();
  const nameLv = `E2E Category LV ${suffix}`;
  const nameRu = `E2E Category RU ${suffix}`;
  const nameEn = `E2E Category EN ${suffix}`;

  await page.getByRole("button", { name: "New category" }).click();
  await page.getByPlaceholder("Name (LV)").fill(nameLv);
  await page.getByPlaceholder("Name (RU)").fill(nameRu);
  await page.getByPlaceholder("Name (EN)").fill(nameEn);
  await page.getByRole("button", { name: "Save category" }).click();

  const row = page.getByRole("row").filter({ hasText: nameLv });
  await expect(row).toBeVisible({ timeout: 10_000 });

  // Edit inline.
  await row.getByRole("button", { name: "Edit" }).click();
  const editedLv = `${nameLv} (edited)`;
  await row.getByPlaceholder("Name (LV)").fill(editedLv);
  await row.getByRole("button", { name: "Save" }).click();
  const editedRow = page.getByRole("row").filter({ hasText: editedLv });
  await expect(editedRow).toBeVisible({ timeout: 10_000 });

  // Delete.
  page.once("dialog", (d) => d.accept());
  await editedRow.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("row").filter({ hasText: editedLv })).toHaveCount(0);
});
```

- [ ] **Step 3: Run it, confirm it fails**

Run: `E2E_OWNER_EMAIL=owner@dentdi.lv E2E_OWNER_PASSWORD=testpassword123 pnpm --filter @booking-system/admin test:e2e -- e2e/catalog-categories.spec.ts`
Expected: FAIL — no `/catalog` route exists yet, "Catalog" nav link is disabled.

- [ ] **Step 4: Dispatch a fresh agent to build the screen**

Using the Agent tool (`subagent_type: general-purpose`), dispatch with **exactly** this prompt. Do not show it `apps/admin/e2e/catalog-categories.spec.ts` or mention it exists:

```
Build the Catalog screen's Service Categories tab for the Dent Di admin
back office at /home/mrkgnt/Projects/Development/booking-system/apps/admin
(Astro server output + React islands + Tailwind v4). Read
apps/admin/src/pages/bookings.astro and
apps/admin/src/components/BookingsScreen.tsx first and match their
conventions exactly: same apiConfig prop pattern, same Tailwind utility
style, same inline-edit pattern (a row's "Edit" button reveals inline
inputs + a row-scoped "Save" button, matching how BookingsScreen's
"Reschedule" button works), same confirm-before-destroy pattern
(window.confirm before a "Delete"/"Cancel" action, matching
BookingsScreen's handleCancel), same error handling via describeApiError
from apps/admin/src/lib/api/errors.ts.

The API client module apps/admin/src/lib/api/service-categories.ts
already exists with listServiceCategories(config),
createServiceCategory(config, input), updateServiceCategory(config, id,
input), deleteServiceCategory(config, id) — use it as-is. The
ServiceCategory type has: id, icon (string|null), display_order (number),
is_active (boolean), name (an object like {lv: "...", ru: "...", en:
"..."}).

Build:

1. apps/admin/src/pages/catalog.astro — SSR page. Read Astro.locals.session,
   build apiConfig the same way bookings.astro does, fetch the initial
   category list server-side via listServiceCategories(apiConfig), wrap
   in <AdminLayout title="Catalog">, render a client:load CatalogScreen
   island with apiConfig and categories as props.

2. apps/admin/src/components/CatalogScreen.tsx — a tab shell component:
   - Local state `activeTab: "categories" | "services" | "staff"`,
     defaulting to "categories".
   - Three buttons with accessible names exactly "Categories", "Services",
     "Staff" that switch activeTab (plain <button> elements, styled like
     BookingsScreen's other buttons — no need for ARIA tab roles, this
     codebase doesn't use them elsewhere).
   - When activeTab is "categories", render
     apps/admin/src/components/catalog/CategoriesPanel.tsx, passing
     apiConfig and the initial categories prop through.
   - When activeTab is "services" or "staff", render a simple placeholder
     div with text "Coming soon" — a later task replaces these.

3. apps/admin/src/components/catalog/CategoriesPanel.tsx — a React
   component with:
   - A <table> (real table/thead/tbody elements) listing categories,
     columns: Name (use category.name.lv), Active (render "Yes"/"No"
     from is_active), Order (display_order), and per-row buttons "Edit"
     and "Delete".
   - Clicking a row's "Edit" button reveals, inline within that row,
     three text inputs with placeholders exactly "Name (LV)", "Name
     (RU)", "Name (EN)" pre-filled from category.name.lv/.ru/.en, plus a
     button with accessible name exactly "Save" scoped to that row. Save
     calls updateServiceCategory(apiConfig, category.id, { name: { lv,
     ru, en } }) and refreshes the list on success; on error, show
     describeApiError's message near that row using the existing red-text
     style (`className="text-sm text-red-700"`).
   - Clicking a row's "Delete" button shows window.confirm("Delete this
     category?") — on confirm, calls deleteServiceCategory(apiConfig,
     category.id) and refreshes the list.
   - A button with accessible name exactly "New category" toggles a
     create form (same show/hide toggle pattern as BookingsScreen's "New
     booking" button) with:
     - Three text inputs with placeholders exactly "Name (LV)", "Name
       (RU)", "Name (EN)" (all required).
     - A text input with placeholder exactly "Icon (optional)".
     - A number input (type="number") for display order, defaulting to
       0.
     - A checkbox (role="checkbox") for "Active", checked by default.
     - A submit button with accessible name exactly "Save category" that
       calls createServiceCategory(apiConfig, { name: {lv, ru, en},
       icon: icon || undefined, displayOrder, isActive }), closes the
       form and refreshes the list on success, and shows
       describeApiError's message above the form on failure (don't close
       the form on error, same as BookingsScreen's force-book form).
   - When the category list is empty, render one row whose cell reads
     "No categories yet."

4. Modify apps/admin/src/layouts/AdminLayout.astro: change the Catalog
   nav item's `enabled: false` to `enabled: true`.

Keep it minimal — no drag-to-reorder, no category deletion confirmation
beyond the browser confirm(), no icon picker (plain text input is fine).
Match the existing code's terseness: no explanatory comments, small
focused files. When done, summarize which files you created/modified.
```

- [ ] **Step 5: Re-run the spec, confirm it passes**

Run: `E2E_OWNER_EMAIL=owner@dentdi.lv E2E_OWNER_PASSWORD=testpassword123 pnpm --filter @booking-system/admin test:e2e -- e2e/catalog-categories.spec.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck and commit**

Run: `pnpm --filter @booking-system/admin typecheck` — expect clean.

```bash
git add apps/admin/src/lib/api/service-categories.ts apps/admin/src/pages/catalog.astro apps/admin/src/components/CatalogScreen.tsx apps/admin/src/components/catalog/CategoriesPanel.tsx apps/admin/src/layouts/AdminLayout.astro apps/admin/e2e/catalog-categories.spec.ts
git commit -m "feat(admin): add catalog screen with service categories CRUD"
```

---

### Task 5: Catalog screen — Services tab (full CRUD)

**Files:**
- Modify: `apps/admin/src/lib/api/catalog.ts` (add `createService`/`updateService`/`deleteService`)
- Create: `apps/admin/src/components/catalog/ServicesPanel.tsx`
- Modify: `apps/admin/src/components/CatalogScreen.tsx` (wire the "Services" tab to `ServicesPanel`)
- Modify: `apps/admin/src/pages/catalog.astro` (also fetch categories, needed for the service form's category dropdown)
- Test: `apps/admin/e2e/catalog-services.spec.ts`

**Interfaces:**
- Consumes: `listServiceCategories` (Task 4, for the category dropdown), existing `listServices` (unchanged).
- Produces (added to `catalog.ts`, written directly):

```typescript
// apps/admin/src/lib/api/catalog.ts — append after listStaff:

export type ServiceInput = {
  categoryId?: string | null;
  durationMinutes: number;
  bufferMinutesBefore: number;
  bufferMinutesAfter: number;
  priceAmount?: number | null;
  priceCurrency: string;
  pricePrefix: "exact" | "from" | "up_to";
  displayOrder: number;
  isActive: boolean;
  name: Record<"lv" | "ru" | "en", string>;
  description?: Record<"lv" | "ru" | "en", string>;
};

export async function createService(config: ApiClientConfig, input: ServiceInput): Promise<Service> {
  const { service } = await apiFetch<{ service: Service }>(config, "/admin/services", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return service;
}

export async function updateService(config: ApiClientConfig, id: string, input: Partial<ServiceInput>): Promise<Service> {
  const { service } = await apiFetch<{ service: Service }>(config, `/admin/services/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return service;
}

export async function deleteService(config: ApiClientConfig, id: string): Promise<void> {
  await apiFetch<void>(config, `/admin/services/${id}`, { method: "DELETE" });
}
```

(`ApiClientConfig` is already imported at the top of `catalog.ts`.)

- [ ] **Step 1: Add the three functions to `catalog.ts`** (code above).

- [ ] **Step 2: Write the failing Playwright spec**

```typescript
// apps/admin/e2e/catalog-services.spec.ts
import { test, expect } from "@playwright/test";
import { login, OWNER_EMAIL, OWNER_PASSWORD, skipIfNoCreds } from "./helpers.js";

test.skip(skipIfNoCreds, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

test("create, edit, and delete a service", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);
  await page.getByRole("link", { name: "Catalog" }).click();
  await page.getByRole("button", { name: "Services" }).click();
  await expect(page.getByRole("table")).toBeVisible();

  const suffix = Date.now();
  const nameLv = `E2E Service LV ${suffix}`;

  await page.getByRole("button", { name: "New service" }).click();
  await page.getByPlaceholder("Name (LV)").fill(nameLv);
  await page.getByPlaceholder("Name (RU)").fill(`E2E Service RU ${suffix}`);
  await page.getByPlaceholder("Name (EN)").fill(`E2E Service EN ${suffix}`);
  await page.locator('input[type="number"]').first().fill("30"); // duration minutes
  await page.getByRole("button", { name: "Save service" }).click();

  const row = page.getByRole("row").filter({ hasText: nameLv });
  await expect(row).toBeVisible({ timeout: 10_000 });

  await row.getByRole("button", { name: "Edit" }).click();
  const editedLv = `${nameLv} (edited)`;
  await row.getByPlaceholder("Name (LV)").fill(editedLv);
  await row.getByRole("button", { name: "Save" }).click();
  const editedRow = page.getByRole("row").filter({ hasText: editedLv });
  await expect(editedRow).toBeVisible({ timeout: 10_000 });

  page.once("dialog", (d) => d.accept());
  await editedRow.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("row").filter({ hasText: editedLv })).toHaveCount(0);
});
```

- [ ] **Step 3: Run it, confirm it fails**

Run: `E2E_OWNER_EMAIL=owner@dentdi.lv E2E_OWNER_PASSWORD=testpassword123 pnpm --filter @booking-system/admin test:e2e -- e2e/catalog-services.spec.ts`
Expected: FAIL — the "Services" tab currently renders "Coming soon" (Task 4's placeholder), no table/form exists.

- [ ] **Step 4: Dispatch a fresh agent to build the panel**

Using the Agent tool (`subagent_type: general-purpose`), dispatch with **exactly** this prompt. Do not show it `apps/admin/e2e/catalog-services.spec.ts` or mention it exists:

```
Build the Services tab of the Catalog screen for the Dent Di admin back
office at /home/mrkgnt/Projects/Development/booking-system/apps/admin
(Astro + React islands + Tailwind v4). Read
apps/admin/src/components/catalog/CategoriesPanel.tsx first (it already
exists — a sibling tab's panel) and match its structure and conventions
exactly: same inline-edit-with-row-scoped-Save pattern, same
confirm-before-delete pattern, same show/hide create-form toggle, same
describeApiError error handling from apps/admin/src/lib/api/errors.ts.

The API client module apps/admin/src/lib/api/catalog.ts already has
listServices(config) (existing) plus createService(config, input),
updateService(config, id, input), deleteService(config, id) — use them
as-is. The Service type has: id, category_id (string|null),
duration_minutes, buffer_minutes_before, buffer_minutes_after,
price_amount (number|null), price_currency, price_prefix
("exact"|"from"|"up_to"), display_order, is_active, name (object
{lv,ru,en}), description (object {lv,ru,en}, optional).

Build apps/admin/src/components/catalog/ServicesPanel.tsx:
- Props: apiConfig, services (initial Service[]), categories (initial
  ServiceCategory[] from apps/admin/src/lib/api/service-categories.ts —
  used only to populate a category dropdown, read-only here).
- A <table> listing services, columns: Name (service.name.lv), Duration
  (duration_minutes + " min"), Price (price_amount ? `${price_amount}
  ${price_currency}` : "—"), Active (Yes/No), and per-row "Edit"/"Delete"
  buttons, same interaction pattern as CategoriesPanel (inline edit
  reveals editable fields in the row + row-scoped "Save" button; Delete
  requires window.confirm).
  - The inline edit row only needs to expose: Name (LV/RU/EN, same three
    placeholders as CategoriesPanel), Duration (a number input), and
    Active (a checkbox) — full parity with every field is not required
    for inline edit, but the create form (below) must expose all fields.
- A button "New service" toggling a create form with:
  - Name (LV/RU/EN) placeholders "Name (LV)"/"Name (RU)"/"Name (EN)",
    required.
  - Description (LV/RU/EN), optional, placeholders "Description
    (LV)"/"Description (RU)"/"Description (EN)".
  - A <select> for category, options built from the categories prop
    (option text = category.name.lv), with an empty "No category"
    option.
  - Number inputs for duration minutes (required), buffer before
    minutes (default 0), buffer after minutes (default 0), price amount
    (optional).
  - A text input for price currency, defaulting to "EUR".
  - A <select> for price prefix with options "exact", "from", "up_to"
    (value = the option's own string, default "exact").
  - A number input for display order (default 0).
  - A checkbox for Active, checked by default.
  - A submit button "Save service" calling createService(apiConfig,
    {...}) with all the above mapped to ServiceInput's shape, closing
    the form and refreshing the services list on success. On error,
    show describeApiError's message above the form without closing it.
- Empty state: one row reading "No services yet."

Modify apps/admin/src/components/CatalogScreen.tsx: when activeTab is
"services", render ServicesPanel with apiConfig, the services list, and
categories — fetch both lists (listServices(apiConfig) and
listServiceCategories(apiConfig) from
apps/admin/src/lib/api/service-categories.ts) client-side in a useEffect
when the tab is first switched to (or on mount if simpler — either is
fine, just make sure the data is present before ServicesPanel renders
its table).

Match the existing code's terseness — no explanatory comments, no extra
abstraction beyond what's asked. When done, summarize which files you
created/modified.
```

- [ ] **Step 5: Re-run the spec, confirm it passes**

Run: `E2E_OWNER_EMAIL=owner@dentdi.lv E2E_OWNER_PASSWORD=testpassword123 pnpm --filter @booking-system/admin test:e2e -- e2e/catalog-services.spec.ts`
Expected: PASS. Also re-run `e2e/catalog-categories.spec.ts` to confirm the Categories tab wasn't broken by this change.

- [ ] **Step 6: Typecheck and commit**

Run: `pnpm --filter @booking-system/admin typecheck` — expect clean.

```bash
git add apps/admin/src/lib/api/catalog.ts apps/admin/src/components/catalog/ServicesPanel.tsx apps/admin/src/components/CatalogScreen.tsx apps/admin/src/pages/catalog.astro apps/admin/e2e/catalog-services.spec.ts
git commit -m "feat(admin): add services CRUD to catalog screen"
```

---

### Task 6: Catalog screen — Staff tab (full CRUD + service linking)

**Files:**
- Modify: `apps/admin/src/lib/api/catalog.ts` (add `createStaffMember`/`updateStaffMember`/`deleteStaffMember`/`replaceStaffServices`)
- Create: `apps/admin/src/components/catalog/StaffPanel.tsx`
- Modify: `apps/admin/src/components/CatalogScreen.tsx` (wire the "Staff" tab)
- Test: `apps/admin/e2e/catalog-staff.spec.ts`

**Interfaces:**
- Consumes: existing `listStaff`, `listServices` (for the service-linking checklist).
- Produces (added to `catalog.ts`, written directly):

```typescript
// apps/admin/src/lib/api/catalog.ts — append after the Task 5 additions:

export type StaffInput = {
  name: string;
  photoUrl?: string | null;
  displayOrder: number;
  isActive: boolean;
  isBookable: boolean;
  bio?: Record<"lv" | "ru" | "en", string>;
};

export async function createStaffMember(config: ApiClientConfig, input: StaffInput): Promise<StaffMember> {
  const { staff } = await apiFetch<{ staff: StaffMember }>(config, "/admin/staff", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return staff;
}

export async function updateStaffMember(config: ApiClientConfig, id: string, input: Partial<StaffInput>): Promise<StaffMember> {
  const { staff } = await apiFetch<{ staff: StaffMember }>(config, `/admin/staff/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return staff;
}

export async function deleteStaffMember(config: ApiClientConfig, id: string): Promise<void> {
  await apiFetch<void>(config, `/admin/staff/${id}`, { method: "DELETE" });
}

export async function replaceStaffServices(
  config: ApiClientConfig,
  staffId: string,
  serviceIds: string[],
): Promise<{ id: string; staff_id: string; service_id: string }[]> {
  const { staffServices } = await apiFetch<{ staffServices: { id: string; staff_id: string; service_id: string }[] }>(
    config,
    `/admin/staff/${staffId}/services`,
    { method: "PUT", body: JSON.stringify({ serviceIds }) },
  );
  return staffServices;
}
```

- [ ] **Step 1: Add the four functions to `catalog.ts`** (code above).

- [ ] **Step 2: Write the failing Playwright spec**

```typescript
// apps/admin/e2e/catalog-staff.spec.ts
import { test, expect } from "@playwright/test";
import { login, OWNER_EMAIL, OWNER_PASSWORD, skipIfNoCreds } from "./helpers.js";

test.skip(skipIfNoCreds, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

test("create a staff member, edit them, link services, and delete them", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);
  await page.getByRole("link", { name: "Catalog" }).click();
  await page.getByRole("button", { name: "Staff" }).click();
  await expect(page.getByRole("table")).toBeVisible();

  const suffix = Date.now();
  const name = `E2E Staff ${suffix}`;

  await page.getByRole("button", { name: "New staff" }).click();
  await page.getByPlaceholder("Name").fill(name);
  await page.getByRole("button", { name: "Save staff" }).click();

  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toBeVisible({ timeout: 10_000 });

  // Edit.
  await row.getByRole("button", { name: "Edit" }).click();
  const editedName = `${name} (edited)`;
  await row.getByPlaceholder("Name").fill(editedName);
  await row.getByRole("button", { name: "Save" }).click();
  const editedRow = page.getByRole("row").filter({ hasText: editedName });
  await expect(editedRow).toBeVisible({ timeout: 10_000 });

  // Link services.
  await editedRow.getByRole("button", { name: "Manage services" }).click();
  const firstServiceCheckbox = page.getByRole("checkbox").first();
  await firstServiceCheckbox.check();
  await page.getByRole("button", { name: "Save services" }).click();
  await expect(firstServiceCheckbox).not.toBeVisible(); // panel closes on save

  // Delete.
  page.once("dialog", (d) => d.accept());
  await editedRow.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("row").filter({ hasText: editedName })).toHaveCount(0);
});
```

- [ ] **Step 3: Run it, confirm it fails**

Run: `E2E_OWNER_EMAIL=owner@dentdi.lv E2E_OWNER_PASSWORD=testpassword123 pnpm --filter @booking-system/admin test:e2e -- e2e/catalog-staff.spec.ts`
Expected: FAIL — "Staff" tab still shows "Coming soon".

- [ ] **Step 4: Dispatch a fresh agent to build the panel**

Using the Agent tool (`subagent_type: general-purpose`), dispatch with **exactly** this prompt. Do not show it `apps/admin/e2e/catalog-staff.spec.ts` or mention it exists:

```
Build the Staff tab of the Catalog screen for the Dent Di admin back
office at /home/mrkgnt/Projects/Development/booking-system/apps/admin
(Astro + React islands + Tailwind v4). Read
apps/admin/src/components/catalog/CategoriesPanel.tsx and
apps/admin/src/components/catalog/ServicesPanel.tsx first (both already
exist as sibling tabs) and match their conventions: inline edit with a
row-scoped "Save" button, confirm-before-delete via window.confirm, a
toggleable create form, error handling via describeApiError.

The API client module apps/admin/src/lib/api/catalog.ts already has
listStaff(config) (existing) plus createStaffMember(config, input),
updateStaffMember(config, id, input), deleteStaffMember(config, id), and
replaceStaffServices(config, staffId, serviceIds: string[]) — use them
as-is. The StaffMember type has: id, name (plain string, NOT translated),
photo_url (string|null), display_order, is_active, is_bookable, bio
(object {lv,ru,en}, optional). Note staff.name is a single plain-text
field, unlike service/category names — do not build three-locale inputs
for it.

Build apps/admin/src/components/catalog/StaffPanel.tsx:
- Props: apiConfig, staff (initial StaffMember[]), services (initial
  Service[] from apps/admin/src/lib/api/catalog.ts's listServices — used
  for the service-linking checklist).
- A <table> listing staff, columns: Name, Active (Yes/No), Bookable
  (Yes/No), and per-row buttons "Edit", "Manage services", "Delete".
- "Edit" reveals inline in the row: a text input with placeholder
  exactly "Name" pre-filled with the current name, a checkbox for
  Active, a checkbox for Bookable, and a row-scoped "Save" button
  calling updateStaffMember(apiConfig, staff.id, { name, isActive,
  isBookable }).
- "Manage services" toggles an inline panel below that row listing every
  service from the services prop as a checkbox with an accessible name
  equal to the service's name.lv (wrap each <input type="checkbox"> in a
  <label> containing the service name text so the checkbox's accessible
  name is the service name — this is required for role-based test
  queries to find a specific checkbox by name later). Pre-check whichever
  services are already linked to this staff member if that information
  is available on the staff object; if it isn't (staff_services isn't
  embedded in the /admin/staff response), start with everything
  unchecked — that's acceptable, this is a "replace" operation not a
  diff. A "Save services" button collects the checked service ids and
  calls replaceStaffServices(apiConfig, staff.id, serviceIds), then
  closes the panel.
- "Delete" shows window.confirm("Delete this staff member?") then calls
  deleteStaffMember(apiConfig, staff.id) and refreshes the list.
- A "New staff" button toggles a create form with: a text input
  placeholder "Name" (required), a text input placeholder "Photo URL
  (optional)", three optional bio inputs with placeholders "Bio (LV)",
  "Bio (RU)", "Bio (EN)", a number input for display order (default 0),
  checkboxes for Active (checked by default) and Bookable (checked by
  default), and a submit button "Save staff" calling
  createStaffMember(apiConfig, {...}), closing the form and refreshing
  the list on success. Errors render via describeApiError above the form
  without closing it.
- Empty state: one row reading "No staff yet."

Modify apps/admin/src/components/CatalogScreen.tsx: when activeTab is
"staff", fetch listStaff(apiConfig) and listServices(apiConfig) (both
from apps/admin/src/lib/api/catalog.ts) and render StaffPanel with the
results.

Match the existing terse style — no explanatory comments, no
speculative abstraction. When done, summarize which files you
created/modified.
```

- [ ] **Step 5: Re-run the spec, confirm it passes**

Run: `E2E_OWNER_EMAIL=owner@dentdi.lv E2E_OWNER_PASSWORD=testpassword123 pnpm --filter @booking-system/admin test:e2e -- e2e/catalog-staff.spec.ts`
Expected: PASS. Also re-run `catalog-categories.spec.ts` and `catalog-services.spec.ts` to confirm no regression on the sibling tabs.

- [ ] **Step 6: Typecheck and commit**

Run: `pnpm --filter @booking-system/admin typecheck` — expect clean.

```bash
git add apps/admin/src/lib/api/catalog.ts apps/admin/src/components/catalog/StaffPanel.tsx apps/admin/src/components/CatalogScreen.tsx apps/admin/e2e/catalog-staff.spec.ts
git commit -m "feat(admin): add staff CRUD and service linking to catalog screen"
```

---

### Task 7: Scheduling screen — Business Hours tab

**Files:**
- Create: `apps/admin/src/lib/api/business-hours.ts`
- Create: `apps/admin/src/pages/scheduling.astro`
- Create: `apps/admin/src/components/SchedulingScreen.tsx`, `apps/admin/src/components/scheduling/HoursPanel.tsx`
- Modify: `apps/admin/src/layouts/AdminLayout.astro` (`Scheduling` nav item `enabled: true`)
- Test: `apps/admin/e2e/scheduling-hours.spec.ts`

**Interfaces:**
- Produces (`business-hours.ts`, written directly):

```typescript
// apps/admin/src/lib/api/business-hours.ts
import { apiFetch, type ApiClientConfig } from "./client.js";
import type { Database } from "../../../../api/src/lib/database.types.js";

export type BusinessHour = Database["public"]["Tables"]["business_hours"]["Row"];

export async function listBusinessHours(config: ApiClientConfig, staffId?: string | null): Promise<BusinessHour[]> {
  const qs = staffId ? `?staffId=${staffId}` : "";
  const { businessHours } = await apiFetch<{ businessHours: BusinessHour[] }>(config, `/admin/business-hours${qs}`);
  return businessHours;
}

export type HourInput = { dayOfWeek: number; opensAt: string | null; closesAt: string | null; isClosed: boolean };

export async function replaceBusinessHours(
  config: ApiClientConfig,
  staffId: string | null,
  hours: HourInput[],
): Promise<BusinessHour[]> {
  const { businessHours } = await apiFetch<{ businessHours: BusinessHour[] }>(config, "/admin/business-hours", {
    method: "PUT",
    body: JSON.stringify({ staffId, hours }),
  });
  return businessHours;
}
```

- [ ] **Step 1: Write `business-hours.ts`** (code above).

- [ ] **Step 2: Write the failing Playwright spec**

```typescript
// apps/admin/e2e/scheduling-hours.spec.ts
import { test, expect } from "@playwright/test";
import { login, OWNER_EMAIL, OWNER_PASSWORD, skipIfNoCreds } from "./helpers.js";

test.skip(skipIfNoCreds, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

test("view and edit the business-wide weekly hours", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);

  await page.getByRole("link", { name: "Scheduling" }).click();
  await expect(page).toHaveURL(/\/scheduling$/);
  await expect(page.getByRole("table")).toBeVisible();

  // 7 day rows + 1 header row.
  await expect(page.getByRole("row")).toHaveCount(8);

  const mondayRow = page.getByRole("row").filter({ hasText: "Monday" });
  await mondayRow.locator('input[type="time"]').first().fill("08:30");
  await page.getByRole("button", { name: "Save hours" }).click();

  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "Monday" }).locator('input[type="time"]').first(),
  ).toHaveValue("08:30");
});
```

- [ ] **Step 3: Run it, confirm it fails**

Run: `E2E_OWNER_EMAIL=owner@dentdi.lv E2E_OWNER_PASSWORD=testpassword123 pnpm --filter @booking-system/admin test:e2e -- e2e/scheduling-hours.spec.ts`
Expected: FAIL — no `/scheduling` route, "Scheduling" nav link disabled.

- [ ] **Step 4: Dispatch a fresh agent to build the screen**

Using the Agent tool (`subagent_type: general-purpose`), dispatch with **exactly** this prompt. Do not show it `apps/admin/e2e/scheduling-hours.spec.ts` or mention it exists:

```
Build the Scheduling screen's Business Hours tab for the Dent Di admin
back office at /home/mrkgnt/Projects/Development/booking-system/apps/admin
(Astro + React islands + Tailwind v4). Read
apps/admin/src/pages/bookings.astro,
apps/admin/src/components/BookingsScreen.tsx, and
apps/admin/src/components/CatalogScreen.tsx first (the last one is an
existing tab-shell component — mirror its structure) to match this
codebase's conventions.

The API client module apps/admin/src/lib/api/business-hours.ts already
exists with listBusinessHours(config, staffId?) and
replaceBusinessHours(config, staffId, hours) — use it as-is. staffId
`null`/omitted means the business-wide default schedule; a staff uuid
means that staff member's override schedule. day_of_week is 0=Sunday
through 6=Saturday (confirmed from apps/api/src/lib/availability.ts's
getUTCDay() usage) — do NOT assume 0=Monday.

Build:

1. apps/admin/src/pages/scheduling.astro — SSR page. Build apiConfig the
   same way bookings.astro does. Fetch the initial business-wide hours
   server-side via listBusinessHours(apiConfig) (no staffId — business
   default) and also listStaff(apiConfig) (from
   apps/admin/src/lib/api/catalog.ts, for the staff-scope dropdown). Wrap
   in <AdminLayout title="Scheduling">, render a client:load
   SchedulingScreen island with apiConfig, hours, and staff as props.

2. apps/admin/src/components/SchedulingScreen.tsx — a tab shell:
   - Local state activeTab: "hours" | "closures", defaulting to "hours".
   - Two buttons with accessible names exactly "Business Hours" and
     "Closures" that switch tabs.
   - When activeTab is "hours", render
     apps/admin/src/components/scheduling/HoursPanel.tsx with apiConfig,
     the initial hours, and staff as props.
   - When activeTab is "closures", render a placeholder div with text
     "Coming soon" — a later task replaces this.

3. apps/admin/src/components/scheduling/HoursPanel.tsx — a React
   component with:
   - A <select> for scope: an option "Business-wide" (value "") plus one
     option per staff member (value = staff id, text = staff name).
     Changing this re-fetches listBusinessHours(apiConfig, scopeValue ||
     null) and re-renders the table below for that scope.
   - A <table> with exactly 7 rows (plus a header row), one per day of
     week 0..6 in order Sunday, Monday, Tuesday, Wednesday, Thursday,
     Friday, Saturday — each row's first cell is the day name as plain
     text (e.g. "Monday"). Columns: Day, Closed (a checkbox), Opens (an
     <input type="time">), Closes (an <input type="time">). If a day has
     no existing row in the fetched hours for the current scope, render
     it with Closed checked and both time inputs empty/disabled — the
     table always shows all 7 days regardless of what's returned.
   - Time input values: convert the API's opens_at/closes_at ("HH:MM:SS"
     or null) to "HH:MM" for the <input type="time"> value, and back to
     "HH:MM:SS" (or null if the day is marked closed) when saving.
   - A button "Save hours" that collects all 7 rows into the HourInput[]
     shape ({ dayOfWeek, opensAt, closesAt, isClosed }) and calls
     replaceBusinessHours(apiConfig, currentScopeIdOrNull, hours). Show
     describeApiError's message (from
     apps/admin/src/lib/api/errors.ts) in a red banner on failure.

4. Modify apps/admin/src/layouts/AdminLayout.astro: change the
   Scheduling nav item's `enabled: false` to `enabled: true`.

Keep it minimal — no per-day copy/paste shortcuts, no timezone picker
(everything is Europe/Riga, same as the rest of this app). Match the
existing terse style: no explanatory comments. When done, summarize
which files you created/modified.
```

- [ ] **Step 5: Re-run the spec, confirm it passes**

Run: `E2E_OWNER_EMAIL=owner@dentdi.lv E2E_OWNER_PASSWORD=testpassword123 pnpm --filter @booking-system/admin test:e2e -- e2e/scheduling-hours.spec.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck and commit**

Run: `pnpm --filter @booking-system/admin typecheck` — expect clean.

```bash
git add apps/admin/src/lib/api/business-hours.ts apps/admin/src/pages/scheduling.astro apps/admin/src/components/SchedulingScreen.tsx apps/admin/src/components/scheduling/HoursPanel.tsx apps/admin/src/layouts/AdminLayout.astro apps/admin/e2e/scheduling-hours.spec.ts
git commit -m "feat(admin): add scheduling screen with business hours editor"
```

---

### Task 8: Scheduling screen — Closures tab

**Files:**
- Create: `apps/admin/src/lib/api/closures.ts`
- Create: `apps/admin/src/components/scheduling/ClosuresPanel.tsx`
- Modify: `apps/admin/src/components/SchedulingScreen.tsx` (wire the "Closures" tab)
- Test: `apps/admin/e2e/scheduling-closures.spec.ts`

**Interfaces:**
- Produces (`closures.ts`, written directly):

```typescript
// apps/admin/src/lib/api/closures.ts
import { apiFetch, type ApiClientConfig } from "./client.js";
import type { Database } from "../../../../api/src/lib/database.types.js";

export type Closure = Database["public"]["Tables"]["closures"]["Row"];

export async function listClosures(config: ApiClientConfig, staffId?: string | null): Promise<Closure[]> {
  const qs = staffId ? `?staffId=${staffId}` : "";
  const { closures } = await apiFetch<{ closures: Closure[] }>(config, `/admin/closures${qs}`);
  return closures;
}

export type ClosureInput = {
  staffId: string | null;
  startsOn: string;
  endsOn: string;
  reason?: string;
  isRecurringYearly: boolean;
};

export async function createClosure(config: ApiClientConfig, input: ClosureInput): Promise<Closure> {
  const { closure } = await apiFetch<{ closure: Closure }>(config, "/admin/closures", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return closure;
}

export async function deleteClosure(config: ApiClientConfig, id: string): Promise<void> {
  await apiFetch<void>(config, `/admin/closures/${id}`, { method: "DELETE" });
}
```

- [ ] **Step 1: Write `closures.ts`** (code above).

- [ ] **Step 2: Write the failing Playwright spec**

```typescript
// apps/admin/e2e/scheduling-closures.spec.ts
import { test, expect } from "@playwright/test";
import { login, OWNER_EMAIL, OWNER_PASSWORD, skipIfNoCreds } from "./helpers.js";

test.skip(skipIfNoCreds, "E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD not set");

test("create and delete a business-wide closure", async ({ page }) => {
  await login(page, OWNER_EMAIL!, OWNER_PASSWORD!);
  await page.getByRole("link", { name: "Scheduling" }).click();
  await page.getByRole("button", { name: "Closures" }).click();
  await expect(page.getByRole("table")).toBeVisible();

  const day = 1 + (Date.now() % 27);
  const pad = (n: number) => String(n).padStart(2, "0");
  const startsOn = `2033-05-${pad(day)}`;
  const endsOn = `2033-05-${pad(day)}`;
  const reason = `E2E closure ${Date.now()}`;

  await page.getByRole("button", { name: "New closure" }).click();
  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.nth(0).fill(startsOn);
  await dateInputs.nth(1).fill(endsOn);
  await page.getByPlaceholder("Reason (optional)").fill(reason);
  await page.getByRole("button", { name: "Save closure" }).click();

  const row = page.getByRole("row").filter({ hasText: reason });
  await expect(row).toBeVisible({ timeout: 10_000 });

  page.once("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("row").filter({ hasText: reason })).toHaveCount(0);
});
```

- [ ] **Step 3: Run it, confirm it fails**

Run: `E2E_OWNER_EMAIL=owner@dentdi.lv E2E_OWNER_PASSWORD=testpassword123 pnpm --filter @booking-system/admin test:e2e -- e2e/scheduling-closures.spec.ts`
Expected: FAIL — "Closures" tab still shows "Coming soon".

- [ ] **Step 4: Dispatch a fresh agent to build the panel**

Using the Agent tool (`subagent_type: general-purpose`), dispatch with **exactly** this prompt. Do not show it `apps/admin/e2e/scheduling-closures.spec.ts` or mention it exists:

```
Build the Closures tab of the Scheduling screen for the Dent Di admin
back office at /home/mrkgnt/Projects/Development/booking-system/apps/admin
(Astro + React islands + Tailwind v4). Read
apps/admin/src/components/scheduling/HoursPanel.tsx first (an existing
sibling tab panel) and apps/admin/src/components/catalog/CategoriesPanel.tsx
(for the create-form-toggle and confirm-before-delete conventions) and
match both.

The API client module apps/admin/src/lib/api/closures.ts already exists
with listClosures(config, staffId?), createClosure(config, input),
deleteClosure(config, id) — use it as-is. The Closure type has: id,
staff_id (string|null), starts_on (date string "YYYY-MM-DD"), ends_on
(date string), reason (string|null), is_recurring_yearly (boolean).

Build apps/admin/src/components/scheduling/ClosuresPanel.tsx:
- Props: apiConfig, staff (StaffMember[], for the scope selector).
- A <select> for scope, same convention as HoursPanel: "Business-wide"
  (value "") plus one option per staff member. Changing it re-fetches
  listClosures(apiConfig, scopeValue || null).
- A <table> listing closures for the current scope, columns: Starts
  (starts_on), Ends (ends_on), Reason (reason or "—"), Recurring
  (Yes/No from is_recurring_yearly), and a per-row "Delete" button.
- "Delete" shows window.confirm("Delete this closure?") then calls
  deleteClosure(apiConfig, closure.id) and refreshes the list.
- A "New closure" button toggles a create form with: two <input
  type="date"> fields (starts on, ends on — no labels needed, just plain
  date inputs in that order), a text input with placeholder exactly
  "Reason (optional)", a checkbox for "Recurring yearly", and a submit
  button "Save closure" calling createClosure(apiConfig, { staffId:
  currentScopeIdOrNull, startsOn, endsOn, reason: reason || undefined,
  isRecurringYearly }), closing the form and refreshing the list on
  success. Show describeApiError's message above the form on failure
  without closing it.
- Empty state: one row reading "No closures scheduled."

Modify apps/admin/src/components/SchedulingScreen.tsx: when activeTab is
"closures", fetch listClosures(apiConfig) (business-wide, no staffId)
and render ClosuresPanel with apiConfig and the staff prop already
available on SchedulingScreen.

Match the existing terse style. When done, summarize which files you
created/modified.
```

- [ ] **Step 5: Re-run the spec, confirm it passes**

Run: `E2E_OWNER_EMAIL=owner@dentdi.lv E2E_OWNER_PASSWORD=testpassword123 pnpm --filter @booking-system/admin test:e2e -- e2e/scheduling-closures.spec.ts`
Expected: PASS. Also re-run `scheduling-hours.spec.ts` to confirm no regression on the Hours tab.

- [ ] **Step 6: Typecheck and commit**

Run: `pnpm --filter @booking-system/admin typecheck` — expect clean.

```bash
git add apps/admin/src/lib/api/closures.ts apps/admin/src/components/scheduling/ClosuresPanel.tsx apps/admin/src/components/SchedulingScreen.tsx apps/admin/e2e/scheduling-closures.spec.ts
git commit -m "feat(admin): add closures CRUD to scheduling screen"
```

---

### Task 9: Full regression pass + CLAUDE.md update

**Files:**
- Modify: `/home/mrkgnt/Projects/Development/booking-system/CLAUDE.md`

No new interfaces — this task verifies everything built in Tasks 1–8 together and closes out the documented gap.

- [ ] **Step 1: Run the full unit test suites**

Run: `pnpm --filter @booking-system/admin test` (vitest, no network) and `pnpm --filter @booking-system/api test` (existing API vitest suite, unaffected by this plan but confirms nothing else broke).
Expected: both fully green (existing counts: 13/13 admin, 102/102 api, plus whatever Task 1–8 added to admin's vitest suite, if any — this plan added none, since all new coverage is E2E).

- [ ] **Step 2: Run the full Playwright suite in one pass**

Run: `E2E_OWNER_EMAIL=owner@dentdi.lv E2E_OWNER_PASSWORD=testpassword123 pnpm --filter @booking-system/admin test:e2e` (all 8 spec files: login-and-bookings, bookings-errors, patients, catalog-categories, catalog-services, catalog-staff, scheduling-hours, scheduling-closures)
Expected: all green, run sequentially (`fullyParallel: false` is already set) against the live project. Note in `playwright.config.ts`'s `retries: 0` — a real flake here is a real bug, not noise to retry away (except the already-documented, already-mitigated staffAuth 403 race, which `apiFetch` already retries once internally).

- [ ] **Step 3: Typecheck the whole admin app**

Run: `pnpm --filter @booking-system/admin typecheck`
Expected: clean.

- [ ] **Step 4: Update `CLAUDE.md`**

In the "Current Build Stage" section, add a new checked entry after the existing Playwright E2E entry, and update the two "Still not verified" / "Still outstanding" notes (in the Playwright bullet and in "Open / Non-Blocking Items") to reflect that patients, catalog CRUD, business-hours, and closures now have both UI and E2E coverage. Add a Decisions Log row:

| Area | Decision |
|---|---|
| Admin UI resource coverage | Every `/admin/*` resource with a working API route now has a corresponding UI screen: Patients (list/search/detail/edit), Catalog (service categories/services/staff CRUD + staff↔service linking), Scheduling (business hours/closures) — built via a strict TDD split (Playwright spec written and confirmed red first, then a fresh agent with no visibility into the spec built the UI against a written accessibility contract, then the spec confirmed green). 8 E2E spec files total, all against the live Dent Di project. |

Remove the now-resolved bullet under "Open / Non-Blocking Items" that reads *"Still outstanding: the full 2xx-path curl sequence for the remaining `/admin/*` routes... patients, catalog CRUD..., confirming each writes the expected `audit_log` row where applicable"* — replace it with a note that these routes are now exercised end-to-end via Playwright rather than curl, and flag the still-true finding from the route inventory: `service_categories`, `services`, `staff`, `staff_services`, `business_hours`, and `closures` mutations write **no** `audit_log` row (only `force_book`/`staff_cancel`/`staff_reschedule` do) — call this out explicitly as a known gap if audit coverage of catalog/scheduling edits is ever required, since it's a backend gap this plan's UI work does not change.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: record full admin back-office UI + E2E coverage"
```

---

## Self-Review Notes

- **Spec coverage**: every `/admin/*` route from the API inventory now has a UI path and an E2E assertion — bookings (existing, now with negative-path coverage added), patients, service-categories, services, staff (+ staff_services), business-hours, closures, plus login/logout (existing). `GET /admin/me` has no dedicated UI (it's an identity check the SSR session layer already relies on implicitly) — intentionally out of scope, nothing in the UI needs a standalone "who am I" screen.
- **Audit-log gap**: flagged, not silently dropped — Task 9 documents that only booking mutations write `audit_log`; this plan doesn't add backend audit writes for catalog/scheduling since that's a backend change outside "build the missing UI and test it."
- **TDD-blindness mechanism**: every build-agent prompt in Tasks 3–8 explicitly instructs the dispatched agent not to view the spec file, and each prompt fully specifies the accessible names/roles/placeholders as a standalone functional contract — the same contract the test uses, but delivered as a UI spec, never as test code.
