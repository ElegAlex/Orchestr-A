'use client';

import { useState, useEffect } from 'react';
import { Milestone, MilestoneStatus } from '@/types';
import toast from 'react-hot-toast';

interface MilestoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Milestone>) => Promise<void>;
  milestone?: Milestone | null;
  projectId: string;
}

export function MilestoneModal({
  isOpen,
  onClose,
  onSave,
  milestone,
  projectId,
}: MilestoneModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    dueDate: '',
    status: MilestoneStatus.PENDING,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (milestone) {
      setFormData({
        name: milestone.name || '',
        description: milestone.description || '',
        dueDate: milestone.dueDate
          ? new Date(milestone.dueDate).toISOString().split('T')[0]
          : '',
        status: milestone.status || MilestoneStatus.PENDING,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        dueDate: '',
        status: MilestoneStatus.PENDING,
      });
    }
  }, [milestone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Le nom du jalon est obligatoire');
      return;
    }

    setIsSubmitting(true);

    try {
      // Envoyer uniquement les champs acceptés par le backend
      const milestoneData: Partial<Milestone> & { projectId: string; dueDate?: string } = {
        name: formData.name,
        description: formData.description,
        projectId,
      };

      if (formData.dueDate) {
        milestoneData.dueDate = new Date(formData.dueDate).toISOString();
      }

      await onSave(milestoneData);
      onClose();
    } catch (err) {
      console.error('Error saving milestone:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {milestone ? 'Modifier le jalon' : 'Nouveau jalon'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Nom du jalon */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Nom du jalon <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: Livraison V1.0, Revue de projet..."
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Décrivez l'objectif et les livrables de ce jalon..."
            />
          </div>

          {/* Date d'échéance */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Date d&apos;échéance
            </label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Statut (en lecture seule avec explication) */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Statut
            </label>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">
                    Statut calculé automatiquement
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Le statut du jalon est déterminé automatiquement en fonction de l&apos;avancement des tâches qui lui sont associées.
                  </p>
                </div>
              </div>
            </div>
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
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Enregistrement...</span>
                </>
              ) : (
                <span>{milestone ? 'Mettre à jour' : 'Créer le jalon'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
