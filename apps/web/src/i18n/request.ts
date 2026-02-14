import { getRequestConfig } from 'next-intl/server';
import { type Locale } from './config';

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure that the incoming locale is valid
  if (!locale || !['fr', 'en'].includes(locale)) {
    locale = 'fr';
  }

  // Load all message files for the locale and merge them
  const messages = {
    ...(await import(`../../messages/${locale}/common.json`)).default,
  };

  return {
    locale,
    messages,
  };
});
