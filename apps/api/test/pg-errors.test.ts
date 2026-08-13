import { describe, expect, it } from "vitest";
import { classifySupabaseError, isIdempotencyKeyViolation } from "../src/lib/pg-errors.js";

describe("classifySupabaseError", () => {
  it("maps exclusion_violation (23P01) to 409 slot_unavailable", () => {
    const result = classifySupabaseError({ code: "23P01", message: "conflicting key value" });
    expect(result).toEqual({ httpStatus: 409, body: { error: "slot_unavailable" } });
  });

  it("maps foreign_key_violation (23503) to 409 reference_no_longer_valid", () => {
    const result = classifySupabaseError({ code: "23503", message: "violates foreign key" });
    expect(result).toEqual({ httpStatus: 409, body: { error: "reference_no_longer_valid" } });
  });

  it("maps check_violation (23514) to 500 internal_error", () => {
    const result = classifySupabaseError({ code: "23514", message: "violates check constraint" });
    expect(result).toEqual({ httpStatus: 500, body: { error: "internal_error" } });
  });

  it("maps a non-idempotency-key unique_violation to 409 conflict", () => {
    const result = classifySupabaseError({ code: "23505", message: "duplicate key value" });
    expect(result).toEqual({ httpStatus: 409, body: { error: "conflict" } });
  });

  it("maps an unknown error code to 500 internal_error", () => {
    const result = classifySupabaseError({ code: "99999", message: "whatever" });
    expect(result).toEqual({ httpStatus: 500, body: { error: "internal_error" } });
  });
});

describe("isIdempotencyKeyViolation", () => {
  it("detects a unique_violation on idempotency_key", () => {
    expect(
      isIdempotencyKeyViolation({
        code: "23505",
        message: 'duplicate key value violates unique constraint "bookings_idempotency_key_key"',
      }),
    ).toBe(true);
  });

  it("does not flag other unique violations", () => {
    expect(isIdempotencyKeyViolation({ code: "23505", message: "duplicate key value violates unique constraint \"patients_pkey\"" })).toBe(
      false,
    );
  });

  it("does not flag non-unique-violation errors", () => {
    expect(isIdempotencyKeyViolation({ code: "23503", message: "idempotency_key mentioned but wrong code" })).toBe(false);
  });
});
