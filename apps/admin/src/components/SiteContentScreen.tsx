import { useState } from "react";
import type { ApiClientConfig } from "../lib/api/client.js";
import {
  getSiteContent,
  saveSiteContent,
  type SiteContentValue,
  type SiteSection,
} from "../lib/api/site-content.js";
import { describeApiError } from "../lib/api/errors.js";
import { buildRenderedFields, findMissingRequiredFields } from "../lib/site-content/form.js";
import { Button } from "./ui/button.js";
import { Card, CardContent, CardHeader } from "./ui/card.js";
import { Input } from "./ui/input.js";
import { Label } from "./ui/label.js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select.js";
import { Textarea } from "./ui/textarea.js";

type Props = {
  apiConfig: ApiClientConfig;
  page: string;
  sections: SiteSection[];
  initialLocale: string;
  initialContent: SiteContentValue;
};

const LOCALES = ["lv", "ru", "en"] as const;
const LOCALE_LABELS: Record<string, string> = { lv: "LV", ru: "RU", en: "EN" };

// Human-readable fallback for a Section's heading. Section definitions are
// developer-owned (ADR-0005 — no Tenant-facing write path for site_sections
// at all), so this list only needs to cover the Sections that currently
// exist; an unrecognized section_key still renders (title-cased) rather
// than disappearing, since the screen stays schema-driven even here.
const SECTION_LABELS: Record<string, string> = {
  hero: "Hero",
  about: "About",
  stats: "Stats",
  testimonial: "Testimonial",
  value_props: "Value Props",
  gallery: "Gallery",
  quick_contact: "Quick Contact",
};

function sectionLabel(sectionKey: string): string {
  return SECTION_LABELS[sectionKey] ?? sectionKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SiteContentScreen({ apiConfig, page, sections, initialLocale, initialContent }: Props) {
  const [locale, setLocale] = useState(initialLocale);
  const [content, setContent] = useState<SiteContentValue>(initialContent);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [missingKeys, setMissingKeys] = useState<Set<string>>(new Set());

  async function handleLocaleChange(nextLocale: string) {
    if (nextLocale === locale) return;
    setLocale(nextLocale);
    setLoading(true);
    setError(null);
    setSavedMessage(null);
    setMissingKeys(new Set());
    try {
      const result = await getSiteContent(apiConfig, page, nextLocale);
      setContent(result.content);
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setLoading(false);
    }
  }

  function updateField(sectionKey: string, fieldKey: string, value: string) {
    setContent((prev) => ({ ...prev, [sectionKey]: { ...(prev[sectionKey] ?? {}), [fieldKey]: value } }));
    setMissingKeys((prev) => {
      const key = `${sectionKey}.${fieldKey}`;
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setSavedMessage(null);
  }

  async function handleSave() {
    const missing = findMissingRequiredFields(buildRenderedFields(sections, content));
    if (missing.length > 0) {
      setMissingKeys(new Set(missing.map((f) => `${f.sectionKey}.${f.fieldKey}`)));
      setSavedMessage(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await saveSiteContent(apiConfig, page, locale, content);
      setContent(result.content);
      setMissingKeys(new Set());
      setSavedMessage("Saved.");
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setSaving(false);
    }
  }

  const sectionsOrdered = [...sections].sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="site-content-locale">Locale</Label>
          <Select value={locale} onValueChange={handleLocaleChange} disabled={loading || saving}>
            <SelectTrigger id="site-content-locale" aria-label="Locale" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((l) => (
                <SelectItem key={l} value={l}>
                  {LOCALE_LABELS[l]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSave} disabled={saving || loading}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      {error && (
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {missingKeys.size > 0 && (
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          Fill in all required fields before saving.
        </p>
      )}
      {savedMessage && (
        <p role="status" className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">
          {savedMessage}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="space-y-6">
          {sectionsOrdered.map((section) => (
            <Card key={section.section_key}>
              <CardHeader>
                {/* A real <h2>, not shadcn's CardTitle (which renders a
                    non-semantic div with no "heading" accessible role) —
                    matches the plain-<h2>/<h3> precedent CustomerDetailScreen/
                    WeekCalendar already use for genuine section headings. */}
                <h2 className="font-heading text-base font-medium leading-snug">
                  {sectionLabel(section.section_key)}
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                {section.fields.map((field) => {
                  const fieldId = `site-content-${section.section_key}-${field.key}`;
                  const value = content[section.section_key]?.[field.key] ?? "";
                  const missingKey = `${section.section_key}.${field.key}`;
                  const isMissing = missingKeys.has(missingKey);
                  return (
                    <div key={field.key} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={fieldId}>{field.label}</Label>
                        {!field.localized && (
                          <span className="text-xs text-muted-foreground">(shared across languages)</span>
                        )}
                        {field.required && <span className="text-xs text-red-600">*</span>}
                      </div>
                      {field.type === "textarea" ? (
                        <Textarea
                          id={fieldId}
                          value={value}
                          aria-invalid={isMissing}
                          onChange={(e) => updateField(section.section_key, field.key, e.target.value)}
                        />
                      ) : (
                        <Input
                          id={fieldId}
                          type="text"
                          placeholder={field.type === "image" ? "https://…" : undefined}
                          value={value}
                          aria-invalid={isMissing}
                          onChange={(e) => updateField(section.section_key, field.key, e.target.value)}
                        />
                      )}
                      {isMissing && <p className="text-sm text-red-700">{field.label} is required.</p>}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
