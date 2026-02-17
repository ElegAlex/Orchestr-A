import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./src/i18n/config";

export default createMiddleware({
  locales,
  defaultLocale,
});

export const config = {
  // Match all pathnames except Next.js internals and static files
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
