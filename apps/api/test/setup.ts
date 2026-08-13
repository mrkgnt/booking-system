import "dotenv/config";

// Force env validation to run now (rather than lazily on first import from a
// test file), so a missing DENTDI_SUPABASE_* var fails the whole run with
// one clear message instead of a confusing error from whichever test
// happened to import config/env.ts first.
await import("../src/config/env.js");
