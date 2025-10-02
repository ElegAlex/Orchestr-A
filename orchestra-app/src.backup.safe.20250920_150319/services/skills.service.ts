import { 
  SkillMetrics, 
  SkillDashboardData, 
  SkillCategoryMetrics, 
  SkillCategory, 
  User, 
  Task, 
  Skill,
  DatePeriod 
} from '../types';

class SkillsService {
  
  /**
   * Calcule les métriques de compétences pour le dashboard opérationnel
   */
  async getSkillsMetrics(period: DatePeriod): Promise<SkillDashboardData> {
    try {
      // TODO: Remplacer par de vraies données
      const users = await this.getAllUsers();
      const tasks = await this.getAllActiveTasks();
      
      const skillMetrics = await this.calculateSkillMetrics(users, tasks);
      const categoryMetrics = this.calculateCategoryMetrics(skillMetrics);
      
      // Trier les compétences par demande et pénurie
      const topInDemandSkills = skillMetrics
        .filter(s => s.demandCount > 0)
        .sort((a, b) => b.demandCount - a.demandCount)
        .slice(0, 10);
        
      const skillsInShortage = skillMetrics
        .filter(s => s.isInShortage)
        .sort((a, b) => {
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          const aLevel = severityOrder[a.shortageLevel || 'low'];
          const bLevel = severityOrder[b.shortageLevel || 'low'];
          return bLevel - aLevel;
        });
      
      const overallUtilization = this.calculateOverallSkillUtilization(skillMetrics);
      
      return {
        period,
        skillMetrics,
        topInDemandSkills,
        skillsInShortage,
        overallSkillUtilization: overallUtilization,
        skillCategories: categoryMetrics
      };
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Calcule les métriques pour chaque compétence individuelle
   */
  private async calculateSkillMetrics(users: User[], tasks: Task[]): Promise<SkillMetrics[]> {
    // Récupérer toutes les compétences uniques
    const allSkills = new Map<string, { name: string; category: SkillCategory }>();
    
    users.forEach(user => {
      user.skills?.forEach(skill => {
        allSkills.set(skill.name, {
          name: skill.name,
          category: skill.category
        });
      });
    });
    
    const skillMetrics: SkillMetrics[] = [];
    
    const skillEntries = Array.from(allSkills.entries());
    for (const [skillName, skillInfo] of skillEntries) {
      const metrics = await this.calculateSingleSkillMetrics(
        skillName,
        skillInfo.category,
        users,
        tasks
      );
      skillMetrics.push(metrics);
    }
    
    return skillMetrics;
  }

  /**
   * Calcule les métriques pour une compétence spécifique
   */
  private async calculateSingleSkillMetrics(
    skillName: string,
    category: SkillCategory,
    users: User[],
    tasks: Task[]
  ): Promise<SkillMetrics> {
    
    // Personnes ayant cette compétence
    const peopleWithSkill = users.filter(user =>
      user.skills?.some(skill => skill.name === skillName)
    );
    
    // Répartition par niveau
    let level1Count = 0;
    let level2Count = 0;  
    let level3Count = 0;
    
    peopleWithSkill.forEach(user => {
      const userSkill = user.skills?.find(s => s.name === skillName);
      if (userSkill) {
        switch (userSkill.level) {
          case 1: level1Count++; break;
          case 2: level2Count++; break;
          case 3: level3Count++; break;
        }
      }
    });
    
    // Personnes disponibles (charge < 80%)
    const availablePeople = peopleWithSkill.filter(user =>
      (user.availability || 100) < 80
    ).length;
    
    // Tâches nécessitant cette compétence
    const demandCount = tasks.filter(task =>
      task.requiredSkills?.some(reqSkill => reqSkill.skillName === skillName)
    ).length;
    
    // Taux d'utilisation (personnes occupées / total)
    const busyPeople = peopleWithSkill.length - availablePeople;
    const utilizationRate = peopleWithSkill.length > 0 
      ? (busyPeople / peopleWithSkill.length) * 100 
      : 0;
    
    // Détection de pénurie
    const supplyDemandRatio = demandCount > 0 ? availablePeople / demandCount : 1;
    const isInShortage = supplyDemandRatio < 0.5;
    
    let shortageLevel: 'low' | 'medium' | 'high' | 'critical' | undefined;
    if (isInShortage) {
      if (supplyDemandRatio < 0.1) shortageLevel = 'critical';
      else if (supplyDemandRatio < 0.25) shortageLevel = 'high';
      else if (supplyDemandRatio < 0.4) shortageLevel = 'medium';
      else shortageLevel = 'low';
    }
    
    return {
      skillId: `skill-${skillName}`,
      skillName,
      category,
      totalPeople: peopleWithSkill.length,
      availablePeople,
      level1Count,
      level2Count,
      level3Count,
      utilizationRate,
      demandCount,
      supplyCount: availablePeople,
      isInShortage,
      shortageLevel
    };
  }

  /**
   * Calcule les métriques par catégorie de compétences
   */
  private calculateCategoryMetrics(skillMetrics: SkillMetrics[]): SkillCategoryMetrics[] {
    const categories: Record<SkillCategory, SkillCategoryMetrics> = {
      technical: { category: 'technical', categoryLabel: 'Technique', totalSkills: 0, averageUtilization: 0, peopleCount: 0, demandCount: 0 },
      management: { category: 'management', categoryLabel: 'Management', totalSkills: 0, averageUtilization: 0, peopleCount: 0, demandCount: 0 },
      domain: { category: 'domain', categoryLabel: 'Métier/Domaine', totalSkills: 0, averageUtilization: 0, peopleCount: 0, demandCount: 0 },
      methodology: { category: 'methodology', categoryLabel: 'Méthodologique', totalSkills: 0, averageUtilization: 0, peopleCount: 0, demandCount: 0 },
      soft: { category: 'soft', categoryLabel: 'Soft Skills', totalSkills: 0, averageUtilization: 0, peopleCount: 0, demandCount: 0 },
      language: { category: 'language', categoryLabel: 'Langues', totalSkills: 0, averageUtilization: 0, peopleCount: 0, demandCount: 0 }
    };

    skillMetrics.forEach(skill => {
      const cat = categories[skill.category];
      cat.totalSkills++;
      cat.peopleCount += skill.totalPeople;
      cat.demandCount += skill.demandCount;
    });

    // Calcul de l'utilisation moyenne par catégorie
    Object.values(categories).forEach(cat => {
      const categorySkills = skillMetrics.filter(s => s.category === cat.category);
      if (categorySkills.length > 0) {
        cat.averageUtilization = categorySkills.reduce((sum, s) => sum + s.utilizationRate, 0) / categorySkills.length;
      }
    });

    return Object.values(categories).filter(cat => cat.totalSkills > 0);
  }

  /**
   * Calcule le taux d'utilisation global des compétences
   */
  private calculateOverallSkillUtilization(skillMetrics: SkillMetrics[]): number {
    if (skillMetrics.length === 0) return 0;
    
    const totalUtilization = skillMetrics.reduce((sum, skill) => sum + skill.utilizationRate, 0);
    return totalUtilization / skillMetrics.length;
  }

  /**
   * Obtient toutes les compétences disponibles par catégorie
   */
  getAvailableSkillsByCategory(): Record<SkillCategory, string[]> {
    return {
      technical: [
        'React', 'TypeScript', 'JavaScript', 'Node.js', 'Python', 
        'Java', 'Docker', 'Kubernetes', 'AWS', 'Azure', 
        'Firebase', 'MongoDB', 'PostgreSQL', 'Git'
      ],
      management: [
        'Gestion d\'équipe', 'Planification projet', 'Budget', 
        'Leadership', 'Gestion des risques', 'Négociation'
      ],
      domain: [
        'Secteur public', 'Finance', 'RH', 'Marchés publics',
        'Juridique', 'Comptabilité', 'Audit', 'Conformité'
      ],
      methodology: [
        'Agile', 'Scrum', 'Kanban', 'Waterfall', 'PMBOK', 
        'PRINCE2', 'DevOps', 'Lean'
      ],
      soft: [
        'Communication', 'Travail d\'équipe', 'Résolution de problèmes',
        'Créativité', 'Adaptation', 'Autonomie', 'Rigueur'
      ],
      language: [
        'Français', 'Anglais', 'Espagnol', 'Allemand', 
        'Italien', 'Mandarin', 'Arabe'
      ]
    };
  }

  /**
   * Trouve les personnes ayant une compétence spécifique avec un niveau minimum
   */
  findPeopleWithSkill(skillName: string, minimumLevel: 1 | 2 | 3, users: User[]): User[] {
    return users.filter(user =>
      user.skills?.some(skill =>
        skill.name === skillName && skill.level >= minimumLevel
      )
    );
  }

  /**
   * Recommande des personnes pour une tâche basée sur ses compétences requises
   */
  recommendPeopleForTask(task: Task, users: User[]): { user: User; matchScore: number }[] {
    if (!task.requiredSkills || task.requiredSkills.length === 0) {
      return users.map(user => ({ user, matchScore: 0 }));
    }

    const recommendations = users.map(user => {
      let matchScore = 0;
      const totalRequiredSkills = task.requiredSkills!.length;
      
      task.requiredSkills!.forEach(requiredSkill => {
        const userSkill = user.skills?.find(s => s.name === requiredSkill.skillName);
        if (userSkill) {
          if (userSkill.level >= requiredSkill.minimumLevel) {
            // Score complet si niveau suffisant
            matchScore += requiredSkill.isRequired ? 2 : 1;
          } else {
            // Score partiel si compétence présente mais niveau insuffisant
            matchScore += requiredSkill.isRequired ? 0.5 : 0.3;
          }
        }
      });
      
      // Normaliser le score sur 100
      const normalizedScore = (matchScore / (totalRequiredSkills * 2)) * 100;
      
      return { user, matchScore: Math.round(normalizedScore) };
    });

    // Trier par score décroissant
    return recommendations.sort((a, b) => b.matchScore - a.matchScore);
  }

  private async getAllUsers(): Promise<User[]> {
    const { userService } = await import('./user.service');
    return await userService.getAllUsers();
  }

  private async getAllActiveTasks(): Promise<Task[]> {
    const { taskService } = await import('./task.service');
    return await taskService.getTasks();
  }
}

export const skillsService = new SkillsService();