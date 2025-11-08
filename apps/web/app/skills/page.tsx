'use client';

import { MainLayout } from '@/components/MainLayout';
import { useEffect, useState } from 'react';
import { skillsService } from '@/services/skills.service';
import { usersService } from '@/services/users.service';
import { useAuthStore } from '@/stores/auth.store';
import { Skill, SkillCategory, SkillLevel, Role, User } from '@/types';

export default function SkillsPage() {
  const { user: currentUser } = useAuthStore();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | ''>('');

  const [skillForm, setSkillForm] = useState({
    name: '',
    category: '' as SkillCategory | '',
    description: '',
  });

  const [assignForm, setAssignForm] = useState({
    userId: '',
    skillId: '',
    level: '' as SkillLevel | '',
  });

  // Permissions
  const canManageSkills = currentUser?.role === Role.ADMIN || currentUser?.role === Role.RESPONSABLE;

  useEffect(() => {
    fetchSkills();
    fetchUsers();
  }, [selectedCategory]);

  const fetchSkills = async () => {
    try {
      setLoading(true);
      const response = await skillsService.getAll(
        1,
        100,
        selectedCategory || undefined
      );
      setSkills(response.data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des compétences:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await usersService.getAll(1, 100);
      setUsers(Array.isArray(response) ? response : response.data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
    }
  };

  const handleCreateSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await skillsService.create({
        name: skillForm.name,
        category: skillForm.category as SkillCategory,
        description: skillForm.description || undefined,
      });
      setShowCreateModal(false);
      setSkillForm({ name: '', category: '', description: '' });
      fetchSkills();
    } catch (error) {
      console.error('Erreur lors de la création de la compétence:', error);
      alert('Erreur lors de la création de la compétence');
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
      });
      setShowEditModal(false);
      setEditingSkill(null);
      setSkillForm({ name: '', category: '', description: '' });
      fetchSkills();
    } catch (error) {
      console.error('Erreur lors de la modification de la compétence:', error);
      alert('Erreur lors de la modification de la compétence');
    }
  };

  const handleDeleteSkill = async (id: string, name: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la compétence "${name}" ?`)) {
      return;
    }

    try {
      await skillsService.delete(id);
      fetchSkills();
    } catch (error) {
      console.error('Erreur lors de la suppression de la compétence:', error);
      alert('Erreur lors de la suppression de la compétence');
    }
  };

  const openEditModal = (skill: Skill) => {
    setEditingSkill(skill);
    setSkillForm({
      name: skill.name,
      category: skill.category,
      description: skill.description || '',
    });
    setShowEditModal(true);
  };

  const openAssignModal = (skillId: string) => {
    setAssignForm({
      userId: '',
      skillId,
      level: '',
    });
    setShowAssignModal(true);
  };

  const handleAssignSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await skillsService.assignToUser(assignForm.userId, {
        skillId: assignForm.skillId,
        level: assignForm.level as SkillLevel,
      });
      setShowAssignModal(false);
      setAssignForm({ userId: '', skillId: '', level: '' });
      alert('Compétence assignée avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'assignation de la compétence:', error);
      alert('Erreur lors de l\'assignation de la compétence');
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

  const getLevelLabel = (level: SkillLevel): string => {
    const labels: Record<SkillLevel, string> = {
      BEGINNER: 'Débutant',
      INTERMEDIATE: 'Intermédiaire',
      EXPERT: 'Expert',
      MASTER: 'Maître',
    };
    return labels[level];
  };

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
              Gérez le référentiel de compétences et les assignations
            </p>
          </div>
          {canManageSkills && (
            <button
              onClick={() => {
                setSkillForm({ name: '', category: '', description: '' });
                setShowCreateModal(true);
              }}
              className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Créer une compétence
            </button>
          )}
        </div>

        {/* Filtres */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filtrer par catégorie
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as SkillCategory | '')}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
          >
            <option value="">Toutes les catégories</option>
            <option value="TECHNICAL">Technique</option>
            <option value="METHODOLOGY">Méthodologie</option>
            <option value="SOFT_SKILL">Soft Skills</option>
            <option value="BUSINESS">Métier</option>
          </select>
        </div>

        {/* Table des compétences */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nom
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Catégorie
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {skills.map((skill) => (
                  <tr key={skill.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {skill.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {getCategoryLabel(skill.category)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500">
                        {skill.description || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openAssignModal(skill.id)}
                        className="text-green-600 hover:text-green-900 mr-4"
                      >
                        Assigner
                      </button>
                      {canManageSkills && (
                        <>
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
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal de création */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Créer une compétence
              </h2>
                <form onSubmit={handleCreateSkill}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Nom *
                    </label>
                    <input
                      type="text"
                      required
                      value={skillForm.name}
                      onChange={(e) =>
                        setSkillForm({ ...skillForm, name: e.target.value })
                      }
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Catégorie *
                    </label>
                    <select
                      required
                      value={skillForm.category}
                      onChange={(e) =>
                        setSkillForm({
                          ...skillForm,
                          category: e.target.value as SkillCategory,
                        })
                      }
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="">Sélectionner une catégorie</option>
                      <option value="TECHNICAL">Technique</option>
                      <option value="METHODOLOGY">Méthodologie</option>
                      <option value="SOFT_SKILL">Soft Skills</option>
                      <option value="BUSINESS">Métier</option>
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      value={skillForm.description}
                      onChange={(e) =>
                        setSkillForm({ ...skillForm, description: e.target.value })
                      }
                      rows={3}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
        )}

        {/* Modal de modification */}
        {showEditModal && editingSkill && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Modifier la compétence
              </h2>
                <form onSubmit={handleEditSkill}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Nom
                    </label>
                    <input
                      type="text"
                      value={skillForm.name}
                      onChange={(e) =>
                        setSkillForm({ ...skillForm, name: e.target.value })
                      }
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Catégorie
                    </label>
                    <select
                      value={skillForm.category}
                      onChange={(e) =>
                        setSkillForm({
                          ...skillForm,
                          category: e.target.value as SkillCategory,
                        })
                      }
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="">Sélectionner une catégorie</option>
                      <option value="TECHNICAL">Technique</option>
                      <option value="METHODOLOGY">Méthodologie</option>
                      <option value="SOFT_SKILL">Soft Skills</option>
                      <option value="BUSINESS">Métier</option>
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      value={skillForm.description}
                      onChange={(e) =>
                        setSkillForm({ ...skillForm, description: e.target.value })
                      }
                      rows={3}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingSkill(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Modifier
                </button>
              </div>
            </form>
          </div>
        </div>
        )}

        {/* Modal d'assignation */}
        {showAssignModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-lg w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Assigner une compétence à un utilisateur
              </h2>
                <form onSubmit={handleAssignSkill}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Utilisateur *
                    </label>
                    <select
                      required
                      value={assignForm.userId}
                      onChange={(e) =>
                        setAssignForm({ ...assignForm, userId: e.target.value })
                      }
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="">Sélectionner un utilisateur</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.firstName} {user.lastName} - {user.role}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Niveau *
                    </label>
                    <select
                      required
                      value={assignForm.level}
                      onChange={(e) =>
                        setAssignForm({
                          ...assignForm,
                          level: e.target.value as SkillLevel,
                        })
                      }
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="">Sélectionner un niveau</option>
                      <option value="BEGINNER">Débutant</option>
                      <option value="INTERMEDIATE">Intermédiaire</option>
                      <option value="EXPERT">Expert</option>
                      <option value="MASTER">Maître</option>
                    </select>
                  </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  Assigner
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
