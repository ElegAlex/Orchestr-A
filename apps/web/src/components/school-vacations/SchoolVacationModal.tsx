"use client";

import { useState, useEffect } from "react";
import {
  SchoolVacation,
  CreateSchoolVacationDto,
  UpdateSchoolVacationDto,
} from "@/types";
import { schoolVacationsService } from "@/services/school-vacations.service";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

interface SchoolVacationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vacation?: SchoolVacation | null;
  defaultYear?: number;
}

export function SchoolVacationModal({
  isOpen,
  onClose,
  onSuccess,
  vacation,
  defaultYear,
}: SchoolVacationModalProps) {
  const t = useTranslations("settings.schoolVacations.modal");
  const tCommon = useTranslations("common.actions");

  const isEditing = !!vacation;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<{
    name: string;
    startDate: string;
    endDate: string;
    year: number;
  }>({
    name: "",
    startDate: "",
    endDate: "",
    year: defaultYear || new Date().getFullYear(),
  });

  useEffect(() => {
    if (vacation) {
      setFormData({
        name: vacation.name,
        startDate: vacation.startDate.split("T")[0],
        endDate: vacation.endDate.split("T")[0],
        year: vacation.year,
      });
    } else {
      const year = defaultYear || new Date().getFullYear();
      setFormData({
        name: "",
        startDate: `${year}-09-01`,
        endDate: `${year}-09-07`,
        year,
      });
    }
  }, [vacation, defaultYear, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error(t("messages.nameRequired"));
      return;
    }

    if (!formData.startDate) {
      toast.error(t("messages.startDateRequired"));
      return;
    }

    if (!formData.endDate) {
      toast.error(t("messages.endDateRequired"));
      return;
    }

    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      toast.error(t("messages.endDateBeforeStart"));
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && vacation) {
        const updateData: UpdateSchoolVacationDto = {
          name: formData.name,
          startDate: formData.startDate,
          endDate: formData.endDate,
          year: formData.year,
        };
        await schoolVacationsService.update(vacation.id, updateData);
        toast.success(t("messages.updateSuccess"));
      } else {
        const createData: CreateSchoolVacationDto = {
          name: formData.name,
          startDate: formData.startDate,
          endDate: formData.endDate,
          year: formData.year,
        };
        await schoolVacationsService.create(createData);
        toast.success(t("messages.createSuccess"));
      }
      onSuccess();
      onClose();
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      const message = error.response?.data?.message || t("messages.saveError");
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateForDisplay = (dateStr: string): string => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {isEditing ? t("titleEdit") : t("titleCreate")}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              {t("fields.name")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t("placeholders.name")}
              maxLength={100}
            />
          </div>

          {/* Date de debut */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              {t("fields.startDate")} <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.startDate}
              onChange={(e) =>
                setFormData({ ...formData, startDate: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {formData.startDate && (
              <p className="mt-1 text-sm text-gray-500">
                {formatDateForDisplay(formData.startDate)}
              </p>
            )}
          </div>

          {/* Date de fin */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              {t("fields.endDate")} <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.endDate}
              onChange={(e) =>
                setFormData({ ...formData, endDate: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {formData.endDate && (
              <p className="mt-1 text-sm text-gray-500">
                {formatDateForDisplay(formData.endDate)}
              </p>
            )}
          </div>

          {/* Annee scolaire */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              {t("fields.year")}
            </label>
            <input
              type="number"
              value={formData.year}
              onChange={(e) =>
                setFormData({ ...formData, year: parseInt(e.target.value, 10) })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min={2000}
              max={2100}
            />
            <p className="mt-1 text-sm text-gray-500">
              {t("fields.yearHint", {
                year: `${formData.year}-${formData.year + 1}`,
              })}
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>{t("buttons.saving")}</span>
                </>
              ) : (
                <span>
                  {isEditing ? t("buttons.update") : tCommon("create")}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
