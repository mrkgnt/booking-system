// Pure classification of Postgres/PostgREST error objects into HTTP
// responses — centralized here so every route reuses the same mapping
// instead of re-deriving `error.code` switches inline. Never echoes raw
// Postgres detail to the client (avoids leaking schema internals); full
// error should be logged server-side by the caller.

export type ClassifiedError = {
  httpStatus: number;
  body: { error: string; details?: unknown };
};

export type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
};

const PG_UNIQUE_VIOLATION = "23505";
const PG_FOREIGN_KEY_VIOLATION = "23503";
const PG_CHECK_VIOLATION = "23514";
const PG_EXCLUSION_VIOLATION = "23P01";

export function classifySupabaseError(error: SupabaseLikeError): ClassifiedError {
  switch (error.code) {
    case PG_UNIQUE_VIOLATION:
      // Callers should special-case idempotency_key violations themselves
      // (that's a success path — fetch and return the existing row, 200,
      // never reaching this classifier at all). Any other unique violation
      // reaching here is a genuine conflict.
      return { httpStatus: 409, body: { error: "conflict" } };
    case PG_EXCLUSION_VIOLATION:
      return { httpStatus: 409, body: { error: "slot_unavailable" } };
    case PG_FOREIGN_KEY_VIOLATION:
      return { httpStatus: 409, body: { error: "reference_no_longer_valid" } };
    case PG_CHECK_VIOLATION:
      // Shouldn't happen — the app controls status/source literals — but
      // defensively treat as an internal error rather than a client one.
      return { httpStatus: 500, body: { error: "internal_error" } };
    default:
      return { httpStatus: 500, body: { error: "internal_error" } };
  }
}

export function isIdempotencyKeyViolation(error: SupabaseLikeError): boolean {
  return error.code === PG_UNIQUE_VIOLATION && (error.message ?? "").includes("idempotency_key");
}
