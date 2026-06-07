"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { usersService } from "@/services/users.service";
import { Logo } from "@/components/Logo";

/**
 * SEC-FE-001 — Forced password change screen.
 *
 * Shown when the Axios response interceptor catches a 403 PASSWORD_CHANGE_REQUIRED
 * from ForcePasswordChangeGuard (SEC-004). The user's JWT is still valid; they can
 * only reach PATCH /users/me/change-password (@AllowPasswordChange) until they
 * reset their password, after which normal navigation resumes.
 */
export default function ChangePasswordPage() {
  const locale = useLocale();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!currentPassword) return "Veuillez saisir votre mot de passe actuel.";
    if (newPassword.length < 8)
      return "Le nouveau mot de passe doit contenir au moins 8 caractères.";
    if (newPassword !== confirmPassword)
      return "Les mots de passe ne correspondent pas.";
    if (currentPassword === newPassword)
      return "Le nouveau mot de passe doit être différent de l'actuel.";
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
      await usersService.changePassword({
        currentPassword,
        newPassword,
      });
      setSuccess(true);
      // Give the user a moment to read the success message, then redirect to login
      // so they re-authenticate with a fresh token (no mustChangePassword flag).
      setTimeout(() => {
        window.location.href = `/${locale}/login`;
      }, 2000);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string } };
      };
      setError(
        axiosErr?.response?.data?.message ||
          "Une erreur est survenue. Vérifiez votre mot de passe actuel.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Logo size="xl" className="mx-auto" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Changement de mot de passe requis
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Votre administrateur vous demande de définir un nouveau mot de passe
            avant de continuer.
          </p>
        </div>

        {success ? (
          <div className="rounded-md bg-green-50 p-4 text-center">
            <p className="text-sm font-medium text-green-800">
              Mot de passe modifié avec succès. Redirection en cours…
            </p>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="current-password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Mot de passe actuel
                </label>
                <input
                  id="current-password"
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border px-3 py-2"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>

              <div>
                <label
                  htmlFor="new-password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Nouveau mot de passe
                </label>
                <input
                  id="new-password"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border px-3 py-2"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Confirmer le nouveau mot de passe
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border px-3 py-2"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Enregistrement…" : "Changer le mot de passe"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
