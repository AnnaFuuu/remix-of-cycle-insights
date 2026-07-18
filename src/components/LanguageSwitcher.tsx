import { Languages } from "lucide-react";
import { useI18n, type Locale } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="flex items-center gap-1.5">
      <Languages className="h-3.5 w-3.5 text-muted-foreground" />
      <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
        <SelectTrigger className="h-7 w-[110px] border-none bg-transparent px-2 text-xs shadow-none focus:ring-0">
          <SelectValue placeholder={t("lang.label")} />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="en">{t("lang.en")}</SelectItem>
          <SelectItem value="zh">{t("lang.zh")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}