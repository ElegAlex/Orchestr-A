"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";
import { Logo } from "@/components/Logo";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("auth");
  const setUser = useAuthStore((state) => state.setUser);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    login: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await authService.login(formData);
      setUser(response.user);
      toast.success(t("login.success"));
      router.push(`/${locale}/dashboard`);
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || t("login.errors.generic"),
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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            {t("appName")}
          </h1>
          <p className="text-[var(--muted-foreground)]">{t("tagline")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="login"
              className="block text-sm font-medium text-[var(--foreground)] mb-2"
            >
              {t("login.loginLabel")}
            </label>
            <input
              id="login"
              data-testid="login-username"
              type="text"
              required
              value={formData.login}
              onChange={(e) =>
                setFormData({ ...formData, login: e.target.value })
              }
              className="w-full px-4 py-2 border border-[var(--input-border)] bg-[var(--background)] text-[var(--input-text)] rounded-lg focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent"
              placeholder={t("login.loginPlaceholder")}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-[var(--foreground)] mb-2"
            >
              {t("login.password")}
            </label>
            <input
              id="password"
              data-testid="login-password"
              type="password"
              required
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="w-full px-4 py-2 border border-[var(--input-border)] bg-[var(--background)] text-[var(--input-text)] rounded-lg focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent"
              placeholder={t("login.passwordPlaceholder")}
            />
          </div>

          <button
            type="submit"
            data-testid="login-submit"
            disabled={loading}
            className="w-full bg-[var(--primary)] text-[var(--primary-foreground)] py-2 px-4 rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? t("login.submitting") : t("login.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
