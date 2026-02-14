"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { locales } from "@/i18n/config";

export function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const currentLocale = useLocale();

  const switchLocale = (newLocale: string) => {
    // Remove the current locale from the pathname
    const segments = pathname.split("/");
    segments[1] = newLocale;
    const newPathname = segments.join("/");
    router.push(newPathname);
  };

  return (
    <div className="flex items-center gap-1 bg-[var(--card)] border border-[var(--border)] rounded-lg p-1">
      {locales.map((locale) => (
        <button
          key={locale}
          onClick={() => switchLocale(locale)}
          className={`px-3 py-1 text-xs font-medium rounded transition ${
            currentLocale === locale
              ? "bg-[var(--primary)] text-white"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]"
          }`}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
