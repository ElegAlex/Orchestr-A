'use client';

import { MainLayout } from '@/components/MainLayout';
import { useEffect, useState } from 'react';
import { skillsService } from '@/services/skills.service';
import { usersService } from '@/services/users.service';
import { useAuthStore } from '@/stores/auth.store';
import { Skill, SkillCategory, SkillLevel, Role, User, UserSkill } from '@/types';
import { SkillsMatrix } from '@/components/SkillsMatrix';
import toast from 'react-hot-toast';

export default function SkillsPage() {
  const { user: currentUser } = useAuthStore();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [userSkills, setUserSkills] = useState<UserSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [showCreateSkillModal, setShowCreateSkillModal] = useState(false);
  const [showEditSkillModal, setShowEditSkillModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | ''>('');
  const [viewMode, setViewMode] = useState<'skills' | 'users' | 'matrix'>('users');

  const [skillForm, setSkillForm] = useState({
    name: '',
    category: '' as SkillCategory | '',
    description: '',
    requiredCount: 1,
  });

  const [skillsToAssign, setSkillsToAssign] = useState<Array<{ skillId: string; level: SkillLevel }>>([]);

  const canManageSkills = currentUser?.role === Role.ADMIN || currentUser?.role === Role.RESPONSABLE;

  useEffect(() => {
    fetchSkills();
    fetchUsers();
  }, [selectedCategory]);

  useEffect(() => {
    if (selectedUser) {
      fetchUserSkills(selectedUser);
    }
  }, [selectedUser]);

  const fetchSkills = async () => {
    try {
      setLoading(true);
      const response = await skillsService.getAll(
        1,
        100,
        selectedCategory || undefined
      );
      setSkills(response.data || []);
    } catch (err) {
      console.error('Erreur lors du chargement des compétences:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await usersService.getAll(1, 100);
      const usersData = Array.isArray(response) ? response : response.data || [];
      setUsers(usersData);
      if (usersData.length > 0 && !selectedUser) {
        setSelectedUser(usersData[0].id);
      }
    } catch (err) {
      console.error('Erreur lors du chargement des utilisateurs:', err);
    }
  };

  const fetchUserSkills = async (userId: string) => {
    try {
      const response = await skillsService.getUserSkills(userId);
      // Le service retourne directement UserSkill[]
      setUserSkills(Array.isArray(response) ? response : []);
    } catch (err) {
      console.error('Erreur lors du chargement des compétences utilisateur:', err);
      setUserSkills([]);
    }
  };

  const handleCreateSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await skillsService.create({
        name: skillForm.name,
        category: skillForm.category as SkillCategory,
        description: skillForm.description || undefined,
        requiredCount: skillForm.requiredCount,
      });
      toast.success('Compétence créée avec succès');
      setShowCreateSkillModal(false);
      setSkillForm({ name: '', category: '', description: '', requiredCount: 1 });
      fetchSkills();
    } catch {
      toast.error('Erreur lors de la création');
    }
  };

  const handleEditSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSkill) return;

    try {
      await skillsService.update(editingSkill.id, {
        name: skillForm.name || undefined,
        category: skillForm.category as SkillCategory || undefined,
        description: skillForm.description || undefined,
        requiredCount: skillForm.requiredCount,
      });
      toast.success('Compétence modifiée avec succès');
      setShowEditSkillModal(false);
      setEditingSkill(null);
      setSkillForm({ name: '', category: '', description: '', requiredCount: 1 });
      fetchSkills();
    } catch {
      toast.error('Erreur lors de la modification');
    }
  };

  const handleDeleteSkill = async (id: string, name: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${name}" ?`)) return;

    try {
      await skillsService.delete(id);
      toast.success('Compétence supprimée');
      fetchSkills();
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const openEditModal = (skill: Skill) => {
    setEditingSkill(skill);
    setSkillForm({
      name: skill.name,
      category: skill.category,
      description: skill.description || '',
      requiredCount: skill.requiredCount || 1,
    });
    setShowEditSkillModal(true);
  };

  const toggleSkillSelection = (skillId: string) => {
    setSkillsToAssign(prev => {
      const exists = prev.find(s => s.skillId === skillId);
      if (exists) {
        return prev.filter(s => s.skillId !== skillId);
      } else {
        return [...prev, { skillId, level: 'INTERMEDIATE' as SkillLevel }];
      }
    });
  };

  const updateSkillLevel = (skillId: string, level: SkillLevel) => {
    setSkillsToAssign(prev =>
      prev.map(s => s.skillId === skillId ? { ...s, level } : s)
    );
  };

  const handleAssignSkills = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || skillsToAssign.length === 0) return;

    try {
      for (const skill of skillsToAssign) {
        await skillsService.assignToUser(selectedUser, {
          skillId: skill.skillId,
          level: skill.level,
        });
      }
      toast.success(`${skillsToAssign.length} compétence(s) assignée(s)`);
      setShowAssignModal(false);
      setSkillsToAssign([]);
      await fetchUserSkills(selectedUser);
    } catch {
      toast.error('Erreur lors de l\'assignation');
    }
  };

  const handleRemoveUserSkill = async (userId: string, skillId: string) => {
    if (!confirm('Retirer cette compétence ?')) return;

    try {
      await skillsService.removeFromUser(userId, skillId);
      toast.success('Compétence retirée');
      fetchUserSkills(userId);
    } catch {
      toast.error('Erreur lors du retrait');
    }
  };

  const handleUpdateUserSkillLevel = async (userId: string, skillId: string, newLevel: SkillLevel) => {
    try {
      await skillsService.updateUserSkill(userId, skillId, { level: newLevel });
      toast.success('Niveau mis à jour');
      fetchUserSkills(userId);
    } catch {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const getCategoryLabel = (category: SkillCategory): string => {
    const labels: Record<SkillCategory, string> = {
      TECHNICAL: 'Technique',
      METHODOLOGY: 'Méthodologie',
      SOFT_SKILL: 'Soft Skills',
      BUSINESS: 'Métier',
    };
    return labels[category];
  };

  const getCategoryColor = (category: SkillCategory): string => {
    const colors: Record<SkillCategory, string> = {
      TECHNICAL: 'bg-blue-100 text-blue-800',
      METHODOLOGY: 'bg-purple-100 text-purple-800',
      SOFT_SKILL: 'bg-green-100 text-green-800',
      BUSINESS: 'bg-orange-100 text-orange-800',
    };
    return colors[category];
  };

  const getLevelColor = (level: SkillLevel): string => {
    const colors: Record<SkillLevel, string> = {
      BEGINNER: 'bg-gray-100 text-gray-700',
      INTERMEDIATE: 'bg-yellow-100 text-yellow-700',
      EXPERT: 'bg-blue-100 text-blue-700',
      MASTER: 'bg-purple-100 text-purple-700',
    };
    return colors[level];
  };

  const getSkillsNotAssigned = () => {
    if (!Array.isArray(userSkills)) return skills;
    const assignedSkillIds = userSkills.map(us => us.skill?.id);
    return skills.filter(s => !assignedSkillIds.includes(s.id));
  };

  const selectedUserData = users.find(u => u.id === selectedUser);

  if (!currentUser) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-600">Chargement...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="sm:flex sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestion des Compétences</h1>
            <p className="mt-2 text-sm text-gray-700">
              Gérez les compétences des utilisateurs
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-3">
            <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
              <button
                onClick={() => setViewMode('users')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  viewMode === 'users'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Par utilisateur
              </button>
              <button
                onClick={() => setViewMode('skills')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  viewMode === 'skills'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Référentiel
              </button>
              <button
                onClick={() => setViewMode('matrix')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                  viewMode === 'matrix'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Matrice
              </button>
            </div>
            {canManageSkills && viewMode === 'skills' && (
              <button
                onClick={() => {
                  setSkillForm({ name: '', category: '', description: '', requiredCount: 1 });
                  setShowCreateSkillModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                + Nouvelle compétence
              </button>
            )}
          </div>
        </div>

        {viewMode === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Liste des utilisateurs */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Utilisateurs</h2>
              <div className="space-y-2">
                {users.map(user => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user.id)}
                    className={`w-full text-left p-3 rounded-lg transition ${
                      selectedUser === user.id
                        ? 'bg-blue-50 border-2 border-blue-500'
                        : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-medium text-gray-900">
                      {user.firstName} {user.lastName}
                    </div>
                    <div className="text-sm text-gray-600">{user.role}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Compétences de l'utilisateur sélectionné */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {selectedUserData && (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        {selectedUserData.firstName} {selectedUserData.lastName}
                      </h2>
                      <p className="text-sm text-gray-600">{userSkills.length} compétence(s)</p>
                    </div>
                    <button
                      onClick={() => {
                        setSkillsToAssign([]);
                        setShowAssignModal(true);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    >
                      + Ajouter des compétences
                    </button>
                  </div>

                  {userSkills.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">🎯</div>
                      <p className="text-gray-500 mb-4">Aucune compétence assignée</p>
                      <button
                        onClick={() => setShowAssignModal(true)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Ajouter des compétences
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Array.isArray(userSkills) && Object.entries(
                        userSkills.reduce((acc, us) => {
                          const category = us.skill?.category || 'TECHNICAL';
                          if (!acc[category]) acc[category] = [];
                          acc[category].push(us);
                          return acc;
                        }, {} as Record<string, UserSkill[]>)
                      ).map(([category, skills]) => (
                        <div key={category} className="border border-gray-200 rounded-lg p-4">
                          <h3 className="font-semibold text-gray-900 mb-3">
                            {getCategoryLabel(category as SkillCategory)}
                          </h3>
                          <div className="space-y-2">
                            {skills.map(us => (
                              <div
                                key={us.skill?.id}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                              >
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900">{us.skill?.name}</div>
                                  {us.skill?.description && (
                                    <div className="text-sm text-gray-600">{us.skill.description}</div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <select
                                    value={us.level}
                                    onChange={(e) =>
                                      handleUpdateUserSkillLevel(
                                        selectedUser,
                                        us.skill?.id || '',
                                        e.target.value as SkillLevel
                                      )
                                    }
                                    className={`px-3 py-1 rounded-full text-xs font-semibold border-0 ${getLevelColor(
                                      us.level
                                    )}`}
                                  >
                                    <option value="BEGINNER">Débutant</option>
                                    <option value="INTERMEDIATE">Intermédiaire</option>
                                    <option value="EXPERT">Expert</option>
                                    <option value="MASTER">Maître</option>
                                  </select>
                                  <button
                                    onClick={() => handleRemoveUserSkill(selectedUser, us.skill?.id || '')}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                    title="Retirer"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {viewMode === 'skills' && (
          <div>
            {/* Filtres */}
            <div className="mb-6">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as SkillCategory | '')}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Toutes les catégories</option>
                <option value="TECHNICAL">Technique</option>
                <option value="METHODOLOGY">Méthodologie</option>
                <option value="SOFT_SKILL">Soft Skills</option>
                <option value="BUSINESS">Métier</option>
              </select>
            </div>

            {/* Table des compétences */}
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="p-4 text-center">Chargement...</div>
              ) : skills.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  Aucune compétence trouvée
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Nom
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Catégorie
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Description
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Ressources requises
                      </th>
                      {canManageSkills && (
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {skills.map((skill) => (
                      <tr key={skill.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {skill.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getCategoryColor(skill.category)}`}>
                            {getCategoryLabel(skill.category)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500">
                            {skill.description || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 bg-gray-100 text-gray-700 text-sm font-medium rounded">
                            {skill.requiredCount || 1}
                          </span>
                        </td>
                        {canManageSkills && (
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <button
                              onClick={() => openEditModal(skill)}
                              className="text-blue-600 hover:text-blue-900 mr-4"
                            >
                              Modifier
                            </button>
                            <button
                              onClick={() => handleDeleteSkill(skill.id, skill.name)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Supprimer
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {viewMode === 'matrix' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <SkillsMatrix />
          </div>
        )}

        {/* Modal Créer compétence */}
        {showCreateSkillModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Créer une compétence</h2>
              <form onSubmit={handleCreateSkill}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                  <input
                    type="text"
                    required
                    value={skillForm.name}
                    onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
                  <select
                    required
                    value={skillForm.category}
                    onChange={(e) => setSkillForm({ ...skillForm, category: e.target.value as SkillCategory })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Sélectionner</option>
                    <option value="TECHNICAL">Technique</option>
                    <option value="METHODOLOGY">Méthodologie</option>
                    <option value="SOFT_SKILL">Soft Skills</option>
                    <option value="BUSINESS">Métier</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={skillForm.description}
                    onChange={(e) => setSkillForm({ ...skillForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ressources requises *
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Nombre de personnes devant maitriser cette competence pour assurer la couverture
                  </p>
                  <input
                    type="number"
                    required
                    min={1}
                    value={skillForm.requiredCount}
                    onChange={(e) => setSkillForm({ ...skillForm, requiredCount: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateSkillModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Créer
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Modifier compétence */}
        {showEditSkillModal && editingSkill && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Modifier la compétence</h2>
              <form onSubmit={handleEditSkill}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                  <input
                    type="text"
                    value={skillForm.name}
                    onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                  <select
                    value={skillForm.category}
                    onChange={(e) => setSkillForm({ ...skillForm, category: e.target.value as SkillCategory })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="TECHNICAL">Technique</option>
                    <option value="METHODOLOGY">Méthodologie</option>
                    <option value="SOFT_SKILL">Soft Skills</option>
                    <option value="BUSINESS">Métier</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={skillForm.description}
                    onChange={(e) => setSkillForm({ ...skillForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ressources requises
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Nombre de personnes devant maitriser cette competence pour assurer la couverture
                  </p>
                  <input
                    type="number"
                    min={1}
                    value={skillForm.requiredCount}
                    onChange={(e) => setSkillForm({ ...skillForm, requiredCount: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditSkillModal(false);
                      setEditingSkill(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Modifier
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Assigner compétences */}
        {showAssignModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Ajouter des compétences à {selectedUserData?.firstName} {selectedUserData?.lastName}
              </h2>
              <form onSubmit={handleAssignSkills}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sélectionnez les compétences et définissez leur niveau ({skillsToAssign.length} sélectionnée(s))
                  </label>
                  <div className="border border-gray-300 rounded-lg p-4 max-h-96 overflow-y-auto">
                    {getSkillsNotAssigned().length === 0 ? (
                      <p className="text-gray-500 text-center py-4">Toutes les compétences sont déjà assignées</p>
                    ) : (
                      <div className="space-y-2">
                        {getSkillsNotAssigned().map(skill => {
                          const isSelected = skillsToAssign.find(s => s.skillId === skill.id);
                          return (
                            <div
                              key={skill.id}
                              className={`flex items-center justify-between p-3 rounded-lg border-2 transition ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center flex-1">
                                <input
                                  type="checkbox"
                                  checked={!!isSelected}
                                  onChange={() => toggleSkillSelection(skill.id)}
                                  className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-gray-900">{skill.name}</div>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${getCategoryColor(skill.category)}`}>
                                    {getCategoryLabel(skill.category)}
                                  </span>
                                </div>
                              </div>
                              {isSelected && (
                                <select
                                  value={isSelected.level}
                                  onChange={(e) => updateSkillLevel(skill.id, e.target.value as SkillLevel)}
                                  className={`ml-3 px-3 py-1 rounded-full text-xs font-semibold border-0 ${getLevelColor(isSelected.level)}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <option value="BEGINNER">Débutant</option>
                                  <option value="INTERMEDIATE">Intermédiaire</option>
                                  <option value="EXPERT">Expert</option>
                                  <option value="MASTER">Maître</option>
                                </select>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAssignModal(false);
                      setSkillsToAssign([]);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={skillsToAssign.length === 0}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Assigner ({skillsToAssign.length})
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
