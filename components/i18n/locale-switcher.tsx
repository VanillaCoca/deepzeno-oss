"use client";

import { LanguagesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALES, type Locale } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

// Standalone language picker for surfaces outside the workspace shell (auth
// pages, the project-selection landing) so the user can choose their language
// from sign-in onward — the in-app switcher lives in the account menu. Calls
// router.refresh() after switching so server components that read the locale
// cookie (e.g. the homepage translator) re-render in the new language.
export function LocaleSwitcher({
  className,
  align = "end",
}: {
  className?: string;
  align?: "start" | "center" | "end";
}) {
  const { locale, setLocale, t } = useLocale();
  const router = useRouter();
  const current =
    LOCALES.find((option) => option.code === locale) ?? LOCALES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("account.language")}
          className={cn(
            "h-8 gap-1.5 px-2.5 text-[13px] text-muted-foreground hover:text-foreground",
            className
          )}
          size="sm"
          variant="ghost"
        >
          <LanguagesIcon className="size-4" />
          <span>{current.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-36">
        <DropdownMenuRadioGroup
          onValueChange={(value) => {
            setLocale(value as Locale);
            router.refresh();
          }}
          value={locale}
        >
          {LOCALES.map((option) => (
            <DropdownMenuRadioItem key={option.code} value={option.code}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
