import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where,
  orderBy 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Skill, SkillCategory } from '../types';

interface SkillDefinition {
  id: string;
  name: string;
  category: SkillCategory;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number; // Nombre de fois utilisée
}

class SkillManagementService {
  private skillsCache: Map<string, SkillDefinition> = new Map();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate = 0;

  /**
   * Compétences prédéfinies par défaut
   */
  private readonly DEFAULT_SKILLS: Record<SkillCategory, string[]> = {
    technical: [
      'React', 'TypeScript', 'JavaScript', 'Node.js', 'Python', 
      'Java', 'Docker', 'Kubernetes', 'AWS', 'Azure', 
      'Firebase', 'MongoDB', 'PostgreSQL', 'Git', 'DevOps'
    ],
    management: [
      'Gestion d\'équipe', 'Planification projet', 'Budget', 
      'Leadership', 'Gestion des risques', 'Négociation',
      'Coaching', 'Reporting'
    ],
    domain: [
      'Secteur public', 'Finance', 'RH', 'Marchés publics',
      'Juridique', 'Comptabilité', 'Audit', 'Conformité',
      'Gestion administrative', 'Relations citoyens'
    ],
    methodology: [
      'Agile', 'Scrum', 'Kanban', 'Waterfall', 'PMBOK', 
      'PRINCE2', 'DevOps', 'Lean', 'Six Sigma'
    ],
    soft: [
      'Communication', 'Travail d\'équipe', 'Résolution de problèmes',
      'Créativité', 'Adaptation', 'Autonomie', 'Rigueur',
      'Gestion du temps', 'Esprit d\'initiative'
    ],
    language: [
      'Français', 'Anglais', 'Espagnol', 'Allemand', 
      'Italien', 'Mandarin', 'Arabe', 'Portugais'
    ]
  };

  /**
   * Initialise les compétences par défaut si nécessaire
   */
  async initializeDefaultSkills(): Promise<void> {
    try {
      const existingSkills = await this.getAllSkills();
      
      if (existingSkills.length === 0) {
        console.log('🎯 Initialisation des compétences par défaut...');
        
        for (const [category, skills] of Object.entries(this.DEFAULT_SKILLS)) {
          for (const skillName of skills) {
            await this.createSkill({
              name: skillName,
              category: category as SkillCategory,
              description: `Compétence ${category}`,
            });
          }
        }
        
        console.log('✅ Compétences par défaut initialisées');
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation des compétences:', error);
    }
  }

  /**
   * Récupère toutes les compétences actives
   */
  async getAllSkills(useCache = true): Promise<SkillDefinition[]> {
    const now = Date.now();
    
    // Vérifier le cache
    if (useCache && this.skillsCache.size > 0 && (now - this.lastCacheUpdate) < this.cacheExpiry) {
      return Array.from(this.skillsCache.values()).filter(skill => skill.isActive);
    }

    try {
      // Requête simple sans orderBy pour éviter les problèmes d'index
      const skillsQuery = query(
        collection(db, 'skills'),
        where('isActive', '==', true)
      );
      
      const snapshot = await getDocs(skillsQuery);
      const skills: SkillDefinition[] = [];
      
      this.skillsCache.clear();
      
      snapshot.forEach(doc => {
        const skillData = { id: doc.id, ...doc.data() } as SkillDefinition;
        skills.push(skillData);
        this.skillsCache.set(skillData.id, skillData);
      });
      
      // Trier côté client
      skills.sort((a, b) => a.name.localeCompare(b.name));
      
      this.lastCacheUpdate = now;
      console.log(`📊 Compétences chargées depuis Firebase: ${skills.length} compétences`);
      return skills;
    } catch (error) {
      console.error('Erreur lors du chargement des compétences:', error);
      
      // Fallback sur les compétences par défaut
      return this.getDefaultSkillsAsFallback();
    }
  }

  /**
   * Récupère les compétences par catégorie
   */
  async getSkillsByCategory(category: SkillCategory): Promise<SkillDefinition[]> {
    const allSkills = await this.getAllSkills();
    return allSkills.filter(skill => skill.category === category);
  }

  /**
   * Crée ou met à jour une compétence
   */
  async createSkill(skillData: {
    name: string;
    category: SkillCategory;
    description?: string;
  }): Promise<SkillDefinition> {
    try {
      // Vérifier si la compétence existe déjà
      const existingSkill = await this.findSkillByName(skillData.name);
      
      if (existingSkill) {
        // Réactiver si elle était désactivée
        if (!existingSkill.isActive) {
          return await this.updateSkill(existingSkill.id, { 
            isActive: true,
            usageCount: existingSkill.usageCount + 1 
          });
        }
        
        // Incrémenter le compteur d'usage
        return await this.updateSkill(existingSkill.id, { 
          usageCount: existingSkill.usageCount + 1 
        });
      }

      // Créer une nouvelle compétence
      const skillId = `skill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newSkill: SkillDefinition = {
        id: skillId,
        name: skillData.name.trim(),
        category: skillData.category,
        description: skillData.description,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 1
      };

      // Filtrer les valeurs undefined pour Firestore
      const firebaseData = Object.fromEntries(
        Object.entries(newSkill).filter(([_, value]) => value !== undefined)
      );

      await setDoc(doc(db, 'skills', skillId), firebaseData);
      
      // Mettre à jour le cache
      this.skillsCache.set(skillId, newSkill);
      
      console.log('✅ Nouvelle compétence créée:', skillData.name);
      return newSkill;
    } catch (error) {
      console.error('Erreur lors de la création de la compétence:', error);
      throw error;
    }
  }

  /**
   * Met à jour une compétence existante
   */
  async updateSkill(skillId: string, updates: Partial<SkillDefinition>): Promise<SkillDefinition> {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };

      await updateDoc(doc(db, 'skills', skillId), updateData);
      
      // Mettre à jour le cache
      const cachedSkill = this.skillsCache.get(skillId);
      if (cachedSkill) {
        const updatedSkill = { ...cachedSkill, ...updateData };
        this.skillsCache.set(skillId, updatedSkill);
        return updatedSkill;
      }
      
      // Recharger depuis la base si pas en cache
      const skills = await this.getAllSkills(false);
      return skills.find(s => s.id === skillId)!;
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la compétence:', error);
      throw error;
    }
  }

  /**
   * Supprime une compétence
   */
  async deleteSkill(skillId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'skills', skillId));
      
      // Supprimer du cache
      this.skillsCache.delete(skillId);
      
      console.log('✅ Compétence supprimée:', skillId);
    } catch (error) {
      console.error('Erreur lors de la suppression de la compétence:', error);
      throw error;
    }
  }

  /**
   * Recherche une compétence par nom
   */
  async findSkillByName(name: string): Promise<SkillDefinition | null> {
    const allSkills = await this.getAllSkills();
    return allSkills.find(skill => 
      skill.name.toLowerCase() === name.toLowerCase()
    ) || null;
  }

  /**
   * Récupère les compétences les plus utilisées
   */
  async getPopularSkills(limit = 20): Promise<SkillDefinition[]> {
    const allSkills = await this.getAllSkills();
    return allSkills
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  /**
   * Recherche de compétences avec autocomplétion
   */
  async searchSkills(searchTerm: string, category?: SkillCategory): Promise<SkillDefinition[]> {
    let skills = await this.getAllSkills();
    
    if (category) {
      skills = skills.filter(skill => skill.category === category);
    }
    
    if (!searchTerm.trim()) {
      return skills.slice(0, 10); // Top 10 si pas de recherche
    }
    
    const term = searchTerm.toLowerCase();
    return skills.filter(skill =>
      skill.name.toLowerCase().includes(term) ||
      skill.description?.toLowerCase().includes(term)
    ).slice(0, 10);
  }

  /**
   * Désactive une compétence
   */
  async deactivateSkill(skillId: string): Promise<void> {
    await this.updateSkill(skillId, { isActive: false });
  }

  /**
   * Conversion des compétences par défaut pour fallback
   */
  private getDefaultSkillsAsFallback(): SkillDefinition[] {
    const skills: SkillDefinition[] = [];
    let index = 0;
    
    for (const [category, skillNames] of Object.entries(this.DEFAULT_SKILLS)) {
      for (const name of skillNames) {
        skills.push({
          id: `default_${index++}`,
          name,
          category: category as SkillCategory,
          description: `Compétence ${category} par défaut`,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 0
        });
      }
    }
    
    return skills;
  }

  /**
   * Nettoie le cache
   */
  clearCache(): void {
    this.skillsCache.clear();
    this.lastCacheUpdate = 0;
  }

  /**
   * Obtient les statistiques des compétences
   */
  async getSkillsStats(): Promise<{
    total: number;
    byCategory: Record<SkillCategory, number>;
    mostUsed: SkillDefinition[];
  }> {
    const skills = await this.getAllSkills();
    
    const byCategory: Record<SkillCategory, number> = {
      technical: 0,
      management: 0,
      domain: 0,
      methodology: 0,
      soft: 0,
      language: 0
    };
    
    skills.forEach(skill => {
      byCategory[skill.category]++;
    });
    
    const mostUsed = skills
      .filter(skill => skill.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5);
    
    return {
      total: skills.length,
      byCategory,
      mostUsed
    };
  }
}

export const skillManagementService = new SkillManagementService();