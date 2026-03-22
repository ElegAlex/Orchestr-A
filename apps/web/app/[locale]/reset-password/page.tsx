"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLocale } from "next-intl";
import { api } from "@/lib/api";
import { Logo } from "@/components/Logo";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const locale = useLocale();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Lien de réinitialisation invalide ou manquant.");
    }
  }, [token]);

  const validate = (): string | null => {
    if (!token) return "Lien de réinitialisation invalide.";
    if (newPassword.length < 8)
      return "Le mot de passe doit contenir au moins 8 caractères.";
    if (newPassword !== confirmPassword)
      return "Les mots de passe ne correspondent pas.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.post("/auth/reset-password", { token, newPassword });
      setSuccess(true);
    } catch (err) {
      const axiosError = err as {
        response?: { data?: { message?: string } };
      };
      setError(
        axiosError.response?.data?.message ||
          "Une erreur est survenue. Veuillez réessayer.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 girly:from-pink-50 girly:to-pink-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[var(--card)] rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo size="xl" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">
            Réinitialisation du mot de passe
          </h1>
          <p className="text-[var(--muted-foreground)] text-sm">
            Choisissez un nouveau mot de passe pour votre compte.
          </p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-green-800 dark:text-green-200 text-sm font-medium">
                Mot de passe modifié avec succès !
              </p>
              <p className="text-green-700 dark:text-green-300 text-sm mt-1">
                Vous pouvez maintenant vous connecter avec votre nouveau mot de
                passe.
              </p>
            </div>
            <Link
              href={`/${locale}/login`}
              className="block w-full text-center bg-[var(--primary)] text-[var(--primary-foreground)] py-2 px-4 rounded-lg hover:opacity-90 transition font-medium"
            >
              Se connecter
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-red-800 dark:text-red-200 text-sm">
                  {error}
                </p>
              </div>
            )}

            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium text-[var(--foreground)] mb-2"
              >
                Nouveau mot de passe
              </label>
              <input
                id="newPassword"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={!token}
                className="w-full px-4 py-2 border border-[var(--input-border)] bg-[var(--background)] text-[var(--input-text)] rounded-lg focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent disabled:opacity-50"
                placeholder="Minimum 8 caractères"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-[var(--foreground)] mb-2"
              >
                Confirmer le mot de passe
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={!token}
                className="w-full px-4 py-2 border border-[var(--input-border)] bg-[var(--background)] text-[var(--input-text)] rounded-lg focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent disabled:opacity-50"
                placeholder="Répétez le mot de passe"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full bg-[var(--primary)] text-[var(--primary-foreground)] py-2 px-4 rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading
                ? "Validation en cours..."
                : "Valider le nouveau mot de passe"}
            </button>

            <div className="text-center">
              <Link
                href={`/${locale}/login`}
                className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition"
              >
                Retour à la connexion
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-[var(--muted-foreground)]">Chargement...</p>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
