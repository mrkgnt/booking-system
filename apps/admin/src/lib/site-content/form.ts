// Pure, DOM/network-free core of the Site Content screen's form rendering
// (ADR-0005, issue #20) — the actual vitest seam for this module. Turns a
// page's site_sections schema + its current site_content values into a
// flat, ordered list of "what to render" rows keyed by each field's
// declared `type`, and separately flags which required rows are still
// blank. Kept out of the React component so the field-type -> input
// mapping and the required-field check are testable without rendering
// anything.

import type { SiteContentValue, SiteSection } from "../api/site-content.js";

export type RenderedField = {
  sectionKey: string;
  fieldKey: string;
  label: string;
  inputType: "text" | "textarea" | "image";
  value: string;
  required: boolean;
  localized: boolean;
};

// Sections ordered by display_order (not assumed to arrive pre-sorted —
// the API already orders them, but this stays correct even if a caller
// passes sections in a different order), fields kept in the schema's own
// array order within each section. A missing value (field never saved,
// or section absent from `content` entirely) resolves to "", matching
// how the admin form always has *something* to bind an input to.
export function buildRenderedFields(sections: SiteSection[], content: SiteContentValue): RenderedField[] {
  const rows: RenderedField[] = [];
  for (const section of [...sections].sort((a, b) => a.display_order - b.display_order)) {
    const sectionContent = content[section.section_key] ?? {};
    for (const field of section.fields) {
      rows.push({
        sectionKey: section.section_key,
        fieldKey: field.key,
        label: field.label,
        inputType: field.type,
        value: sectionContent[field.key] ?? "",
        required: field.required,
        localized: field.localized,
      });
    }
  }
  return rows;
}

function isEmptyValue(value: string): boolean {
  return value.trim().length === 0;
}

// Mirrors apps/api's findMissingRequiredFields (apps/api/src/lib/
// site-content.ts) at the client, so Save can block before a round trip
// rather than only after the server rejects it — same client-side-mirrors-
// server-validation precedent as validate-force-book.ts.
export function findMissingRequiredFields(fields: RenderedField[]): RenderedField[] {
  return fields.filter((field) => field.required && isEmptyValue(field.value));
}
