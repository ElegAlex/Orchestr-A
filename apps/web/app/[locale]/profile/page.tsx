"use client";

import { useState, useRef } from "react";
import { format, parseISO, isValid } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { MainLayout } from "@/components/MainLayout";
import { useAuthStore } from "@/stores/auth.store";
import { usersService } from "@/services/users.service";
import { useThemeStore, Theme } from "@/stores/theme.store";
import { UserAvatar } from "@/components/UserAvatar";
import toast from "react-hot-toast";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { IcsExportSection } from "@/components/planning-export/IcsExportSection";
import { IcsImportSection } from "@/components/planning-export/IcsImportSection";

const PERSONA_PRESETS = Array.from(
  { length: 36 },
  (_, i) => `persona_${String(i + 1).padStart(2, "0")}`,
);
const INITIALS_PRESET = "initials";

type TabType = "personal" | "security" | "preferences" | "import-export";

export default function ProfilePage() {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const { theme, setTheme } = useThemeStore();
  const setUser = useAuthStore((state) => state.setUser);
  const [activeTab, setActiveTab] = useState<TabType>("personal");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleAvatarPreset = async (preset: string) => {
    try {
      setAvatarLoading(true);
      const updated = await usersService.setAvatarPreset(preset);
      setUser({ ...user!, ...updated });
      toast.success("Avatar mis à jour");
    } catch {
      toast.error("Erreur lors de la mise à jour de l'avatar");
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setAvatarLoading(true);
      const updated = await usersService.uploadAvatar(file);
      setUser({ ...user!, ...updated });
      toast.success("Avatar mis à jour");
    } catch (err) {
      console.error("Avatar upload error:", err);
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const msg = axiosErr?.response?.data?.message || "Erreur inconnue";
      toast.error(`Erreur upload: ${msg}`);
    } finally {
      setAvatarLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAvatarDelete = async () => {
    try {
      setAvatarLoading(true);
      const updated = await usersService.deleteAvatar();
      setUser({ ...user!, ...updated });
      toast.success("Avatar supprimé");
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setAvatarLoading(false);
    }
  };

  const ROLE_BADGE_COLORS: Record<string, string> = {
    ADMIN: "bg-red-100 text-red-800",
    RESPONSABLE: "bg-purple-100 text-purple-800",
    MANAGER: "bg-blue-100 text-blue-800",
    REFERENT_TECHNIQUE: "bg-green-100 text-green-800",
    CONTRIBUTEUR: "bg-gray-100 text-gray-800",
  };
  const getRoleBadgeColor = (role: string) =>
    ROLE_BADGE_COLORS[role] || "bg-yellow-100 text-yellow-800";

  const getRoleLabel = (role: string) => {
    return tCommon(`roles.${role}`);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(t("messages.passwordMismatch"));
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast.error(t("messages.passwordTooShort"));
      return;
    }

    try {
      await usersService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success(t("messages.passwordChangeSuccess"));
      setShowPasswordModal(false);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      toast.error(
        axiosError.response?.data?.message || t("messages.passwordChangeError"),
      );
    }
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600">{t("loading")}</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-gray-600 mt-1">{t("subtitle")}</p>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-start space-x-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <UserAvatar user={user} size="lg" />
            </div>

            {/* Info */}
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">
                {user.firstName} {user.lastName}
              </h2>
              <p className="text-gray-600 mt-1">{user.email}</p>
              <div className="flex items-center space-x-3 mt-3">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(
                    user.role,
                  )}`}
                >
                  {getRoleLabel(user.role)}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    user.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {user.isActive
                    ? tCommon("status.active")
                    : tCommon("status.inactive")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("personal")}
              className={`${
                activeTab === "personal"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
            >
              {t("tabs.personal")}
            </button>
            <button
              onClick={() => setActiveTab("security")}
              className={`${
                activeTab === "security"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
            >
              {t("tabs.security")}
            </button>
            <button
              onClick={() => setActiveTab("preferences")}
              className={`${
                activeTab === "preferences"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
            >
              {t("tabs.preferences")}
            </button>
            <button
              onClick={() => setActiveTab("import-export")}
              className={`${
                activeTab === "import-export"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition`}
            >
              Import / Export
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === "personal" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("personal.title")}
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("personal.firstName")}
                  </label>
                  <p className="text-gray-900">{user.firstName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("personal.lastName")}
                  </label>
                  <p className="text-gray-900">{user.lastName}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("personal.email")}
                </label>
                <p className="text-gray-900">{user.email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("personal.login")}
                </label>
                <p className="text-gray-900">@{user.login}</p>
              </div>

              {user.department && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("personal.department")}
                  </label>
                  <p className="text-gray-900">{user.department.name}</p>
                </div>
              )}

              {user.userServices && user.userServices.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("personal.services")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {user.userServices.map((us) => (
                      <span
                        key={us.service.id}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                      >
                        {us.service.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("personal.memberSince")}
                </label>
                <p className="text-gray-900">
                  {user?.createdAt && isValid(parseISO(user.createdAt))
                    ? format(parseISO(user.createdAt), "PPP", {
                        locale: locale === "en" ? enUS : fr,
                      })
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "security" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("security.title")}
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {t("security.password.title")}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  {t("security.password.description")}
                </p>
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {t("security.password.changeButton")}
                </button>
              </div>

              <div className="pt-6 border-t border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">
                  {t("security.loginHistory.title")}
                </h3>
                <p className="text-sm text-gray-600">
                  {t("security.loginHistory.lastLogin")}{" "}
                  {new Date().toLocaleDateString(
                    locale === "en" ? "en-US" : "fr-FR",
                    {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "preferences" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("preferences.title")}
              </h2>
            </div>
            <div className="p-6 space-y-6">
              {/* Avatar section */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Avatar</h3>
                <div className="flex items-start gap-6">
                  {/* Current avatar preview */}
                  <div className="flex-shrink-0">
                    <UserAvatar user={user} size="lg" />
                  </div>
                  <div className="flex-1 space-y-4">
                    {/* Initials preset */}
                    <div>
                      <p className="text-sm text-gray-600 mb-3">
                        Utiliser mes initiales (dégradé unique) :
                      </p>
                      <button
                        onClick={() => handleAvatarPreset(INITIALS_PRESET)}
                        disabled={avatarLoading}
                        className={`rounded-full border-2 transition hover:scale-105 disabled:opacity-50 ${
                          user.avatarPreset === INITIALS_PRESET && !user.avatarUrl
                            ? "border-blue-500 ring-2 ring-blue-300"
                            : "border-transparent hover:border-gray-300"
                        }`}
                        title="Initiales"
                      >
                        <UserAvatar
                          user={{ ...user, avatarUrl: null, avatarPreset: "initials" }}
                          size="md"
                        />
                      </button>
                    </div>

                    {/* Preset grid */}
                    <div>
                      <p className="text-sm text-gray-600 mb-3">
                        Choisir une illustration :
                      </p>
                      <div className="grid grid-cols-8 gap-2">
                        {PERSONA_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            onClick={() => handleAvatarPreset(preset)}
                            disabled={avatarLoading}
                            className={`w-12 h-12 rounded-full overflow-hidden border-2 transition hover:scale-105 disabled:opacity-50 bg-gray-50 ${
                              user.avatarPreset === preset && !user.avatarUrl
                                ? "border-blue-500 ring-2 ring-blue-300"
                                : "border-transparent hover:border-gray-300"
                            }`}
                            title={preset}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/avatars/${preset}.svg`}
                              alt={preset}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Upload & Delete */}
                    <div className="flex items-center gap-3 pt-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleAvatarUpload}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={avatarLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm disabled:opacity-50"
                      >
                        Télécharger une image
                      </button>
                      {(user.avatarUrl || user.avatarPreset) && (
                        <button
                          onClick={handleAvatarDelete}
                          disabled={avatarLoading}
                          className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition text-sm disabled:opacity-50"
                        >
                          Supprimer
                        </button>
                      )}
                      {avatarLoading && (
                        <span className="text-sm text-gray-500">
                          Chargement...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200"></div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {t("preferences.language.title")}
                </h3>
                <select
                  value={locale}
                  onChange={(e) => {
                    const newLocale = e.target.value;
                    if (newLocale !== locale) {
                      const newPath = pathname.replace(
                        `/${locale}/`,
                        `/${newLocale}/`,
                      );
                      router.push(newPath);
                    }
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="fr">{t("preferences.language.fr")}</option>
                  <option value="en">{t("preferences.language.en")}</option>
                </select>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {t("preferences.theme.title")}
                </h3>
                <select
                  value={theme === "girly" ? "light" : theme}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "auto") {
                      const prefersDark = window.matchMedia(
                        "(prefers-color-scheme: dark)",
                      ).matches;
                      setTheme(prefersDark ? "dark" : "light");
                    } else {
                      setTheme(val as Theme);
                    }
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                >
                  <option value="light">{t("preferences.theme.light")}</option>
                  <option value="dark">{t("preferences.theme.dark")}</option>
                  <option value="auto">{t("preferences.theme.auto")}</option>
                </select>
              </div>

              <div className="pt-6">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                  {t("preferences.save")}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "import-export" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Import / Export ICS
              </h2>
            </div>
            <div className="p-6 space-y-8">
              <IcsExportSection />
              <div className="border-t border-gray-200 pt-6">
                <IcsImportSection />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {t("security.changePasswordModal.title")}
            </h2>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("security.changePasswordModal.currentPassword")}
                </label>
                <input
                  type="password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      currentPassword: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("security.changePasswordModal.newPassword")}
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      newPassword: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t("security.changePasswordModal.minLength")}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("security.changePasswordModal.confirmPassword")}
                </label>
                <input
                  type="password"
                  required
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordForm({
                      currentPassword: "",
                      newPassword: "",
                      confirmPassword: "",
                    });
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  {t("security.changePasswordModal.cancel")}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {t("security.changePasswordModal.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
