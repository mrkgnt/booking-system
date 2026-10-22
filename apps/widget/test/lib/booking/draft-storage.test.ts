import { describe, expect, it } from "vitest";
import {
  draftStorageKey,
  loadDraft,
  clearDraft,
  saveDraft,
  type DraftStorage,
} from "../../../src/lib/booking/draft-storage.js";
import type { FlowState } from "../../../src/lib/booking/flow-state.js";

// In-memory fake implementing the same tiny DraftStorage interface a real
// `window.sessionStorage` satisfies — lets this whole module be covered
// under vitest's "node" environment (no jsdom) per issue #15/#6's testing
// decision.
function fakeStorage(initial: Record<string, string> = {}): DraftStorage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key)! : null),
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

describe("draftStorageKey", () => {
  it("scopes the key to the given tenant slug", () => {
    expect(draftStorageKey("dentdi")).toBe("platform-widget:draft:dentdi");
  });

  it("produces a different key for a different tenant slug", () => {
    expect(draftStorageKey("dentdi")).not.toBe(draftStorageKey("other-tenant"));
  });
});

describe("saveDraft / loadDraft round-trip", () => {
  it("saves a draftable step and loads back an equal state", () => {
    const storage = fakeStorage();
    const state: FlowState = { step: "availability", serviceId: "svc-1", staffId: "staff-1" };

    saveDraft(storage, "dentdi", state);

    expect(loadDraft(storage, "dentdi")).toEqual(state);
  });

  it("keys drafts per tenant — a draft saved for one tenant isn't visible under another's key", () => {
    const storage = fakeStorage();
    saveDraft(storage, "dentdi", { step: "service" });

    expect(loadDraft(storage, "other-tenant")).toBeNull();
  });

  it("returns null when no draft exists for the tenant", () => {
    const storage = fakeStorage();
    expect(loadDraft(storage, "dentdi")).toBeNull();
  });

  it("returns null (rather than throwing) when the stored value is corrupt JSON", () => {
    const storage = fakeStorage({ [draftStorageKey("dentdi")]: "{not json" });
    expect(loadDraft(storage, "dentdi")).toBeNull();
  });
});

describe("saveDraft — non-draftable steps", () => {
  it("does not persist a confirm_pending step — clears any existing draft instead", () => {
    const storage = fakeStorage();
    saveDraft(storage, "dentdi", { step: "availability", serviceId: "svc-1" });
    expect(loadDraft(storage, "dentdi")).not.toBeNull();

    saveDraft(storage, "dentdi", {
      step: "confirm_pending",
      serviceId: "svc-1",
      slot: { staffId: "staff-1", startsAt: "2026-11-01T10:00:00.000Z", endsAt: "2026-11-01T10:45:00.000Z" },
      bookingId: "booking-1",
    });

    expect(loadDraft(storage, "dentdi")).toBeNull();
  });

  it("does not persist a confirmed step — clears any existing draft instead", () => {
    const storage = fakeStorage();
    saveDraft(storage, "dentdi", { step: "service" });

    saveDraft(storage, "dentdi", {
      step: "confirmed",
      serviceId: "svc-1",
      slot: { staffId: "staff-1", startsAt: "2026-11-01T10:00:00.000Z", endsAt: "2026-11-01T10:45:00.000Z" },
      bookingId: "booking-1",
    });

    expect(loadDraft(storage, "dentdi")).toBeNull();
  });
});

describe("clearDraft", () => {
  it("removes a previously-saved draft for the given tenant", () => {
    const storage = fakeStorage();
    saveDraft(storage, "dentdi", { step: "service" });

    clearDraft(storage, "dentdi");

    expect(loadDraft(storage, "dentdi")).toBeNull();
  });

  it("leaves another tenant's draft untouched", () => {
    const storage = fakeStorage();
    saveDraft(storage, "dentdi", { step: "service" });
    saveDraft(storage, "other-tenant", { step: "availability", serviceId: "svc-2" });

    clearDraft(storage, "dentdi");

    expect(loadDraft(storage, "other-tenant")).toEqual({ step: "availability", serviceId: "svc-2" });
  });
});
