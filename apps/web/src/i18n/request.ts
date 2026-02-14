import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !['fr', 'en'].includes(locale)) {
    locale = 'fr';
  }

  const messages = {
    common: (await import(`../../messages/${locale}/common.json`)).default,
    auth: (await import(`../../messages/${locale}/auth.json`)).default,
    dashboard: (await import(`../../messages/${locale}/dashboard.json`)).default,
    projects: (await import(`../../messages/${locale}/projects.json`)).default,
    tasks: (await import(`../../messages/${locale}/tasks.json`)).default,
    planning: (await import(`../../messages/${locale}/planning.json`)).default,
    events: (await import(`../../messages/${locale}/events.json`)).default,
    hr: (await import(`../../messages/${locale}/hr.json`)).default,
    admin: (await import(`../../messages/${locale}/admin.json`)).default,
    settings: (await import(`../../messages/${locale}/settings.json`)).default,
    profile: (await import(`../../messages/${locale}/profile.json`)).default,
  };

  return {
    locale,
    messages,
  };
});
