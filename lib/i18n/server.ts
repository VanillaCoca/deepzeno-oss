import { cookies } from "next/headers";
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/dictionaries";
import { homeMessages } from "@/lib/i18n/messages/home";

// Server-side counterpart to the client LocaleProvider: server components (the
// homepage) read the locale from the cookie that setLocale() writes, then
// translate from the same source dictionaries. English is the fallback.
const LOCALE_COOKIE = "zeno-locale";

export async function getServerLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}

export async function getHomeTranslator() {
  const locale = await getServerLocale();
  return (key: string, params?: Record<string, string | number>) => {
    const template =
      homeMessages[locale][key] ?? homeMessages[defaultLocale][key] ?? key;
    if (!params) {
      return template;
    }
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match
    );
  };
}
