'use client';

import { useState, useEffect } from 'react';
import {
  Holiday,
  HolidayType,
  CreateHolidayDto,
  UpdateHolidayDto,
  HOLIDAY_TYPE_LABELS,
} from '@/types';
import { holidaysService } from '@/services/holidays.service';
import toast from 'react-hot-toast';

interface HolidayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  holiday?: Holiday | null;
  defaultYear?: number;
}

export function HolidayModal({
  isOpen,
  onClose,
  onSuccess,
  holiday,
  defaultYear,
}: HolidayModalProps) {
  const isEditing = !!holiday;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<CreateHolidayDto>({
    date: '',
    name: '',
    type: HolidayType.LEGAL,
    isWorkDay: false,
    description: '',
    recurring: false,
  });

  useEffect(() => {
    if (holiday) {
      setFormData({
        date: holiday.date.split('T')[0],
        name: holiday.name,
        type: holiday.type,
        isWorkDay: holiday.isWorkDay,
        description: holiday.description || '',
        recurring: holiday.recurring,
      });
    } else {
      const year = defaultYear || new Date().getFullYear();
      setFormData({
        date: `${year}-01-01`,
        name: '',
        type: HolidayType.LEGAL,
        isWorkDay: false,
        description: '',
        recurring: false,
      });
    }
  }, [holiday, defaultYear, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Le nom du jour ferie est obligatoire');
      return;
    }

    if (!formData.date) {
      toast.error('La date est obligatoire');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && holiday) {
        const updateData: UpdateHolidayDto = {
          date: formData.date,
          name: formData.name,
          type: formData.type,
          isWorkDay: formData.isWorkDay,
          description: formData.description || undefined,
          recurring: formData.recurring,
        };
        await holidaysService.update(holiday.id, updateData);
        toast.success('Jour ferie mis a jour');
      } else {
        await holidaysService.create(formData);
        toast.success('Jour ferie cree avec succes');
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      const message =
        error.response?.data?.message || 'Erreur lors de l\'enregistrement';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateForDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {isEditing ? 'Modifier le jour ferie' : 'Ajouter un jour ferie'}
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
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {formData.date && (
              <p className="mt-1 text-sm text-gray-500">
                {formatDateForDisplay(formData.date)}
              </p>
            )}
          </div>

          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: Jour de l'An"
              maxLength={100}
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Type
            </label>
            <select
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value as HolidayType })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Object.entries(HOLIDAY_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Description (optionnel)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Notes ou precisions..."
              maxLength={255}
            />
          </div>

          {/* Jour ouvre */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="text-sm font-medium text-gray-900">
                Jour ouvre
              </label>
              <p className="text-sm text-gray-500">
                Si active, ce jour compte comme un jour travaille
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isWorkDay}
                onChange={(e) =>
                  setFormData({ ...formData, isWorkDay: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Recurrent */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="text-sm font-medium text-gray-900">
                Recurrent
              </label>
              <p className="text-sm text-gray-500">
                Se repete automatiquement chaque annee
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.recurring}
                onChange={(e) =>
                  setFormData({ ...formData, recurring: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              Annuler
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
                  <span>Enregistrement...</span>
                </>
              ) : (
                <span>{isEditing ? 'Mettre a jour' : 'Creer'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
