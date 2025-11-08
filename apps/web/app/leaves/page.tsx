'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { useAuthStore } from '@/stores/auth.store';
import { leavesService } from '@/services/leaves.service';
import {
  Leave,
  LeaveType,
  LeaveStatus,
  HalfDay,
  CreateLeaveDto,
} from '@/types';
import toast from 'react-hot-toast';

export default function LeavesPage() {
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState<CreateLeaveDto>({
    type: LeaveType.CP,
    startDate: '',
    endDate: '',
    halfDay: undefined,
    comment: '',
  });

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const data = await leavesService.getMyLeaves();
      setLeaves(data);
    } catch (error: any) {
      if (error.response?.status !== 404) {
        toast.error('Erreur lors du chargement des congés');
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await leavesService.create(formData);
      toast.success('Congé déclaré avec succès');
      setShowCreateModal(false);
      resetForm();
      fetchLeaves();
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || 'Erreur lors de la déclaration'
      );
    }
  };

  const resetForm = () => {
    setFormData({
      type: LeaveType.CP,
      startDate: '',
      endDate: '',
      halfDay: undefined,
      comment: '',
    });
  };

  const getLeaveTypeBadgeColor = (type: LeaveType) => {
    switch (type) {
      case LeaveType.CP:
        return 'bg-blue-100 text-blue-800';
      case LeaveType.RTT:
        return 'bg-green-100 text-green-800';
      case LeaveType.SICK_LEAVE:
        return 'bg-red-100 text-red-800';
      case LeaveType.UNPAID:
        return 'bg-gray-100 text-gray-800';
      case LeaveType.OTHER:
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getLeaveTypeLabel = (type: LeaveType) => {
    switch (type) {
      case LeaveType.CP:
        return 'Congés Payés';
      case LeaveType.RTT:
        return 'RTT';
      case LeaveType.SICK_LEAVE:
        return 'Maladie';
      case LeaveType.UNPAID:
        return 'Sans solde';
      case LeaveType.OTHER:
        return 'Autre';
      default:
        return type;
    }
  };

  const getLeaveStatusBadgeColor = (status: LeaveStatus) => {
    switch (status) {
      case LeaveStatus.APPROVED:
        return 'bg-green-100 text-green-800';
      case LeaveStatus.PENDING:
        return 'bg-yellow-100 text-yellow-800';
      case LeaveStatus.REJECTED:
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getLeaveStatusLabel = (status: LeaveStatus) => {
    switch (status) {
      case LeaveStatus.APPROVED:
        return 'Approuvé';
      case LeaveStatus.PENDING:
        return 'En attente';
      case LeaveStatus.REJECTED:
        return 'Refusé';
      default:
        return status;
    }
  };

  const getHalfDayLabel = (halfDay?: HalfDay) => {
    if (!halfDay) return '';
    return halfDay === HalfDay.MORNING ? 'Matin' : 'Après-midi';
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mes congés</h1>
            <p className="text-gray-600 mt-1">{leaves.length} congé(s)</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
          >
            <span>+</span>
            <span>Déclarer un congé</span>
          </button>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">ℹ️</div>
            <div>
              <h3 className="font-semibold text-blue-900">
                Système déclaratif
              </h3>
              <p className="text-sm text-blue-800 mt-1">
                Les congés sont approuvés automatiquement lors de la
                déclaration. Assurez-vous de respecter le processus interne de
                votre équipe avant de déclarer vos absences.
              </p>
            </div>
          </div>
        </div>

        {/* Leaves List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {leaves.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🏖️</div>
              <p className="text-gray-500">Aucun congé déclaré</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 text-blue-600 hover:text-blue-800"
              >
                Déclarer votre premier congé
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {leaves.map((leave) => (
                <div
                  key={leave.id}
                  className="p-6 hover:bg-gray-50 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getLeaveTypeBadgeColor(
                            leave.type
                          )}`}
                        >
                          {getLeaveTypeLabel(leave.type)}
                        </span>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getLeaveStatusBadgeColor(
                            leave.status
                          )}`}
                        >
                          {getLeaveStatusLabel(leave.status)}
                        </span>
                      </div>

                      <div className="flex items-center space-x-6 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Du :</span>{' '}
                          {new Date(leave.startDate).toLocaleDateString(
                            'fr-FR',
                            { weekday: 'long', day: 'numeric', month: 'long' }
                          )}
                          {leave.halfDay &&
                            leave.startDate === leave.endDate &&
                            ` (${getHalfDayLabel(leave.halfDay)})`}
                        </div>
                        <div>
                          <span className="font-medium">Au :</span>{' '}
                          {new Date(leave.endDate).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                          })}
                        </div>
                        <div>
                          <span className="font-medium">Durée :</span>{' '}
                          {leave.days} jour{leave.days > 1 ? 's' : ''}
                        </div>
                      </div>

                      {leave.comment && (
                        <p className="text-sm text-gray-600 mt-2">
                          {leave.comment}
                        </p>
                      )}

                      <p className="text-xs text-gray-500 mt-2">
                        Déclaré le{' '}
                        {new Date(leave.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Déclarer un congé
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type de congé *
                </label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value as LeaveType,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={LeaveType.CP}>Congés Payés (CP)</option>
                  <option value={LeaveType.RTT}>RTT</option>
                  <option value={LeaveType.SICK_LEAVE}>Maladie</option>
                  <option value={LeaveType.UNPAID}>Sans solde</option>
                  <option value={LeaveType.OTHER}>Autre</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de début *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de fin *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {formData.startDate === formData.endDate &&
                formData.startDate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Demi-journée (optionnel)
                    </label>
                    <select
                      value={formData.halfDay || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          halfDay: e.target.value
                            ? (e.target.value as HalfDay)
                            : undefined,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Journée complète</option>
                      <option value={HalfDay.MORNING}>Matin</option>
                      <option value={HalfDay.AFTERNOON}>Après-midi</option>
                    </select>
                  </div>
                )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Commentaire (optionnel)
                </label>
                <textarea
                  value={formData.comment}
                  onChange={(e) =>
                    setFormData({ ...formData, comment: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ajoutez un commentaire si nécessaire..."
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  ⚠️ En déclarant ce congé, il sera automatiquement approuvé.
                  Assurez-vous d'avoir l'accord de votre responsable.
                </p>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Déclarer le congé
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
