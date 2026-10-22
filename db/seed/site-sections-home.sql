-- ============================================================================
-- Site Content CMS — home page Section schema (ADR-0005, tickets #22/#25/#28).
--
-- Unlike site_content (Tenant-editable values, legitimately live-entered via
-- apps/admin's Site Content screen, not a repo artifact), this file IS a
-- reusable template: it declares what Sections the "home" page's Astro
-- components (Hero.astro/About.astro/ValueProps.astro/Gallery.astro/
-- QuickContact.astro) actually expect, keyed generically by page_slug —
-- the exact same shape a second Tenant's Site build needs, not Dent-Di-
-- specific data. This was applied live to the Dent Di project during the
-- #18 build via the Supabase MCP tool but never committed here, leaving
-- it unreproducible from source control — this file closes that gap
-- (found via code review).
--
-- Idempotent: ON CONFLICT on the (page_slug, section_key) unique
-- constraint updates the field list in place, so re-running this after a
-- Section's fields change in code is safe and doesn't duplicate rows.
-- Does NOT touch site_content — a Tenant's entered text/images are never
-- overwritten by re-running this.
-- ============================================================================

insert into site_sections (page_slug, section_key, display_order, fields) values
('home', 'hero', 1, '[
  {"key":"headline","label":"Headline","type":"text","required":true,"localized":true},
  {"key":"subhead","label":"Subheadline","type":"textarea","required":true,"localized":true},
  {"key":"stats_years","label":"Stats: years badge","type":"text","required":false,"localized":true},
  {"key":"stats_languages","label":"Stats: languages badge","type":"text","required":false,"localized":true},
  {"key":"cta_label","label":"Primary CTA label","type":"text","required":true,"localized":true}
]'::jsonb),
('home', 'about', 2, '[
  {"key":"heading","label":"Heading","type":"text","required":true,"localized":true},
  {"key":"paragraphs","label":"Body paragraphs","type":"textarea","required":true,"localized":true}
]'::jsonb),
('home', 'stats', 3, '[
  {"key":"years_text","label":"Years in business","type":"text","required":false,"localized":true},
  {"key":"languages_text","label":"Languages spoken","type":"text","required":false,"localized":true}
]'::jsonb),
('home', 'testimonial', 4, '[
  {"key":"quote","label":"Quote","type":"textarea","required":false,"localized":true},
  {"key":"attribution","label":"Attribution","type":"text","required":false,"localized":true}
]'::jsonb),
('home', 'value_props', 5, '[
  {"key":"items","label":"Checklist items (one per line)","type":"textarea","required":false,"localized":true}
]'::jsonb),
('home', 'gallery', 6, '[
  {"key":"image_urls","label":"Image URLs (one per line)","type":"textarea","required":false,"localized":false}
]'::jsonb),
('home', 'quick_contact', 7, '[
  {"key":"whatsapp_url","label":"WhatsApp link","type":"text","required":false,"localized":false},
  {"key":"telegram_url","label":"Telegram link","type":"text","required":false,"localized":false}
]'::jsonb)
on conflict (page_slug, section_key) do update set
  display_order = excluded.display_order,
  fields = excluded.fields;
