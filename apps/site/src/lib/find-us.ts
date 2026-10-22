// "Find us" band (issue #25): Maps/Waze links built at render time from the
// Tenant's existing business_profile.address — deliberately NOT a Site
// Content field, so there's exactly one source of truth for the address and
// no way for a manually-entered link to drift out of sync with it (issue
// #18's "find us" decision).

export function buildMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function buildWazeUrl(address: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(address)}`;
}
