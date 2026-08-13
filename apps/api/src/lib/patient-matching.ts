// Pure patient find-or-create SELECTION logic — the Supabase query that
// fetches candidates lives in routes/bookings.ts; this module only decides
// which (if any) candidate to reuse. Separated so the decision logic is
// unit-testable without a DB.
//
// MVP heuristic, not a real identity system: there's no unique constraint
// on patients.email or patients.phone (correctly — a household can share a
// phone), so this is inherently approximate. Matches on exact email OR
// exact phone; if multiple candidates match, picks the most-recently-
// created one rather than erroring — blocking booking creation over an
// ambiguous match is worse than an imperfect merge. Accepted MVP debt, not
// a silent gap: a real "merge duplicate patients" admin tool is out of
// scope here.

export type PatientCandidate = {
  id: string;
  email: string | null;
  phone: string | null;
  createdAt: string; // ISO
};

export type NewPatientInput = {
  email?: string;
  phone?: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().]/g, "");
}

// Returns the candidate to reuse, or null if a new patient should be
// created. Does not mutate input.
export function selectMatchingPatient(
  candidates: PatientCandidate[],
  input: NewPatientInput,
): PatientCandidate | null {
  const email = input.email ? normalizeEmail(input.email) : undefined;
  const phone = input.phone ? normalizePhone(input.phone) : undefined;

  const matches = candidates.filter((c) => {
    const candidateEmail = c.email ? normalizeEmail(c.email) : undefined;
    const candidatePhone = c.phone ? normalizePhone(c.phone) : undefined;
    return (email && candidateEmail === email) || (phone && candidatePhone === phone);
  });

  if (matches.length === 0) {
    return null;
  }

  return matches.reduce((mostRecent, candidate) =>
    new Date(candidate.createdAt).getTime() > new Date(mostRecent.createdAt).getTime()
      ? candidate
      : mostRecent,
  );
}
