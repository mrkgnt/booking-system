import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resolveLanguageLabel, shouldShowLocaleSwitcher } from "@/lib/locale.js";

type Props = {
  supportedLocales: string[];
  activeLocale: string;
  onLocaleChange: (locale: string) => void;
  disabled?: boolean;
};

// Renders nothing at all for a single-locale Tenant (issue #13's
// acceptance criteria) — not just visually hidden, genuinely absent from
// the DOM, so a single-locale Tenant's drawer never ships this markup.
export default function LocaleSwitcher({ supportedLocales, activeLocale, onLocaleChange, disabled }: Props) {
  if (!shouldShowLocaleSwitcher(supportedLocales)) return null;

  const label = resolveLanguageLabel(activeLocale);

  return (
    <div className="flex items-center gap-2" data-testid="locale-switcher">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select value={activeLocale} onValueChange={onLocaleChange} disabled={disabled}>
        <SelectTrigger size="sm" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {supportedLocales.map((locale) => (
            <SelectItem key={locale} value={locale}>
              {locale.toUpperCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
