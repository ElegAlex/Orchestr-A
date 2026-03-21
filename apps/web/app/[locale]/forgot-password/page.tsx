"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { Logo } from "@/components/Logo";

export default function ForgotPasswordPage() {
  const locale = useLocale();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 girly:from-pink-50 girly:to-pink-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[var(--card)] rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo size="xl" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">
            Mot de passe oublié
          </h1>
        </div>

        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-blue-800 dark:text-blue-200 text-sm font-medium">
              Comment réinitialiser votre mot de passe ?
            </p>
            <p className="text-blue-700 dark:text-blue-300 text-sm mt-2">
              La réinitialisation du mot de passe est gérée par les
              administrateurs de l&apos;application.
            </p>
            <p className="text-blue-700 dark:text-blue-300 text-sm mt-2">
              Contactez votre administrateur pour obtenir un lien de
              réinitialisation. Ce lien sera valable 24h.
            </p>
          </div>

          <Link
            href={`/${locale}/login`}
            className="block w-full text-center bg-[var(--primary)] text-[var(--primary-foreground)] py-2 px-4 rounded-lg hover:opacity-90 transition font-medium"
          >
            Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
