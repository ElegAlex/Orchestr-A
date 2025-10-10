export interface User {
  id: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  permissions?: string[];
  avatarUrl?: string;
  department?: string;
  managerId?: string; // ID du manager de l'utilisateur (pour hiérarchie)
  serviceId?: string; // Deprecated - à supprimer progressivement
  serviceIds?: string[]; // Nouveau: support multi-services  
  skills?: Skill[];
  availability?: number;
  workingHours?: WorkingHours;
  productivity?: ProductivityProfile;
  preferences?: UserPreferences;
  contract?: WorkContract;
  createdAt: Date;
  lastLoginAt: Date;
  updatedAt?: Date;
  isActive: boolean;
  // Nouveaux champs pour le système de login interne
  login?: string; // Login unique pour connexion (nom_prenom)
  loginType?: 'email' | 'internal'; // Type de connexion
  createdBy?: string; // ID de l'admin qui a créé l'utilisateur
}

export type UserRole = 'admin' | 'responsable' | 'manager' | 'teamLead' | 'contributor' | 'viewer';

export interface Skill {
  id: string;
  name: string;
  level: 1 | 2 | 3; // Niveau en étoiles : 1 = débutant, 2 = intermédiaire, 3 = expert
  category: SkillCategory;
  description?: string;
  certifiedAt?: Date;
  lastUsed?: Date;
  validatedBy?: string;
}

export type SkillCategory = 
  | 'technical' // Technique
  | 'management' // Management  
  | 'domain' // Métier/Domaine
  | 'methodology' // Méthodologique
  | 'soft' // Soft skills
  | 'language'; // Langues

export interface RequiredSkill {
  skillId: string;
  skillName: string;
  minimumLevel: 1 | 2 | 3;
  isRequired: boolean;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  description: string;
  status: ProjectStatus;
  priority: Priority;
  startDate: Date;
  dueDate: Date;        // Date de fin planifiée
  actualDueDate?: Date; // Date de fin réelle
  progress: number;
  budget?: number;
  spentBudget?: number;
  sponsor: string;
  projectManager: string;
  teamMembers: TeamMember[];
  tags: string[];
  category: ProjectCategory;
  methodology: 'waterfall' | 'agile' | 'hybrid';
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectStatus = 'draft' | 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';
export type ProjectCategory = 'IT' | 'HR' | 'Finance' | 'Compliance' | 'Other';

export interface TeamMember {
  userId: string;
  role: string;
  allocationPercentage: number;
  startDate: Date;
  endDate?: Date;
}

export interface Task {
  id: string;
  code?: string;
  projectId: string;
  taskCategory?: TaskCategory;
  
  // Identity
  title: string;
  description: string;
  acceptanceCriteria?: string;
  definitionOfDone?: string[];
  
  // Hierarchy
  parentTaskId?: string;
  epicId?: string;
  milestoneId?: string;  // Lien optionnel vers un jalon
  type: TaskType;
  
  // RACI - Responsability Assignment (tous optionnels)
  responsible?: string[];    // R - Responsable(s) d'exécuter la tâche (ex-assigneeId)
  accountable?: string[];    // A - Autorité finale, décisionnaire (ex-reporterId)
  consulted?: string[];      // C - Consulté(s), expertise requise (ex-contributors)
  informed?: string[];       // I - Informé(s) des résultats (ex-validators)
  
  
  // Status
  status: TaskStatus;
  
  // Planning & Estimation
  priority: Priority;
  storyPoints?: number;
  estimatedHours?: number;
  remainingHours?: number;
  loggedHours?: number;
  dueDate?: Date;
  
  // Dates
  startDate?: Date;
  completedDate?: Date;

  // Créneaux horaires (pour tâches simples)
  startTime?: string; // Format "HH:mm" (ex: "09:00")
  endTime?: string;   // Format "HH:mm" (ex: "17:00")
  
  // Blocking & Dependencies
  isBlocked?: boolean;
  blockedReason?: string;
  dependencies: TaskDependency[];
  
  // Metadata
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  businessValue?: number;
  technicalDebt?: boolean;
  requiredSkills?: RequiredSkill[];
  labels: string[];
  attachments: Attachment[];
  comments: Comment[];
  customFields?: Record<string, any>;

  // Time tracking
  timeSpent?: number;
  timeEntries?: TimeEntry[];
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  deletedAt?: Date;
}

export type TaskType = 'EPIC' | 'STORY' | 'TASK' | 'BUG' | 'SPIKE';
export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';
export type TaskCategory = 'PROJECT_TASK' | 'SIMPLE_TASK' | 'OBJECTIVE_TASK';

export interface TaskDependency {
  taskId: string;
  type: 'FS' | 'FF' | 'SF' | 'SS';
  lag?: number;
}

export interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface Comment {
  id: string;
  authorId: string;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  mentions?: string[];
  parentId?: string; // For threaded comments
  reactions?: CommentReaction[];
}

export interface CommentReaction {
  userId: string;
  emoji: string;
  createdAt: Date;
}

export interface TaskComment extends Comment {
  taskId: string;
  type?: 'comment' | 'status_change' | 'assignment_change' | 'due_date_change';
  metadata?: {
    oldValue?: any;
    newValue?: any;
    fieldChanged?: string;
  };
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: Date;
  downloadUrl: string;
  thumbnailUrl?: string;
  description?: string;
  tags?: string[];
  isPublic: boolean;
  version: number;
  previousVersionId?: string;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  hours: number;
  date: Date;
  description?: string;
  type?: 'development' | 'testing' | 'review' | 'documentation' | 'meeting' | 'other';
  createdAt: Date;
  updatedAt: Date;
}


export interface ResourceAllocation {
  id: string;
  userId: string;
  projectId: string;
  taskId?: string;
  allocationPercentage: number;
  startDate: Date;
  endDate: Date;
  status: 'tentative' | 'confirmed' | 'completed';
  estimatedHours: number;
  actualHours?: number;
  requiredSkills: RequiredSkill[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Leave {
  id: string;
  userId: string;
  type: 'vacation' | 'sick' | 'training' | 'other';
  startDate: Date;
  endDate: Date;
  workingDaysCount: number;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Date;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// NOUVEAUX TYPES POUR GESTION DES RESSOURCES

export interface WorkingHours {
  weeklyHours: number;
  dailyHours: number;
  workingDays: string[];
}

export interface ProductivityProfile {
  rate: number;
  lastUpdated: Date;
}

export interface UserPreferences {
  remoteWorkDays?: string[];
  maxProjectsParallel: number;
  notificationFrequency: 'realtime' | 'daily' | 'weekly';
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
  timezone?: string;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  dashboardLayout?: string[];
}

export interface UserSkill {
  id: string;
  name: string;
  category: SkillCategory;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  yearsExperience: number;
  lastUsed?: Date;
  certifications?: string[];
  projects?: string[];
  selfAssessed: boolean;
  managerValidated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkloadSnapshot {
  userId: string;
  weekStart: Date;
  weekEnd: Date;
  capacity: {
    theoretical: number;
    net: number;
    available: number;
  };
  allocated: {
    confirmed: number;
    tentative: number;
    total: number;
  };
  deductions: {
    leaves: number;
    training: number;
    meetings: number;
    other: number;
  };
  overloadRisk: 'none' | 'low' | 'medium' | 'high' | 'critical';
  calculatedAt: Date;
  validUntil: Date;
}

export interface WorkloadCalculation {
  userId: string;
  period: {
    start: Date;
    end: Date;
  };
  availability: WorkloadSnapshot;
  suggestions: AllocationSuggestion[];
  alerts: WorkloadAlert[];
}

export interface AllocationSuggestion {
  type: 'reallocation' | 'skill_match' | 'capacity_warning';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  actions: string[];
}

export interface WorkloadAlert {
  id: string;
  userId: string;
  type: 'overload' | 'underload' | 'skill_gap' | 'deadline_risk';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold?: number;
  currentValue?: number;
  createdAt: Date;
  resolvedAt?: Date;
}

// ========================================
// GESTION AVANCEE DES RESSOURCES
// ========================================

// Contrat de travail
export interface WorkContract {
  id: string;
  userId: string;
  type: ContractType;
  workingTimePercentage: number; // 100% = temps plein, 50% = mi-temps
  weeklyHours: number; // Heures par semaine (35, 39, etc.)
  workingDays: WeekDay[]; // Jours de travail
  workingSchedule?: DailySchedule[]; // Horaires détaillés par jour
  startDate: Date;
  endDate?: Date; // null pour CDI
  hourlyRate?: number; // Pour freelances
  annualSalary?: number;
  paidLeaveDays: number; // Congés payés annuels
  rttDays?: number; // RTT si applicable
  isRemoteAllowed: boolean;
  maxRemoteDaysPerWeek?: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ContractType = 'CDI' | 'CDD' | 'FREELANCE' | 'INTERN' | 'PART_TIME';

export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface DailySchedule {
  day: WeekDay;
  isWorking: boolean;
  morningStart?: string; // "08:00"
  morningEnd?: string; // "12:00"
  afternoonStart?: string; // "14:00"
  afternoonEnd?: string; // "18:00"
  totalHours: number; // Calculé automatiquement
}

// Gestion des congés
export interface LeaveRequest {
  id: string;
  userId: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  halfDayStart?: boolean; // Demi-journée début
  halfDayEnd?: boolean; // Demi-journée fin
  totalDays: number; // Calculé automatiquement
  reason?: string;
  status: LeaveStatus;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type LeaveType =
  | 'PAID_LEAVE' // Congés payés
  | 'RTT' // Récupération temps de travail
  | 'SICK_LEAVE' // Congé maladie
  | 'MATERNITY_LEAVE' // Congé maternité
  | 'PATERNITY_LEAVE' // Congé paternité
  | 'EXCEPTIONAL_LEAVE' // Congé exceptionnel
  | 'CONVENTIONAL_LEAVE' // Congé conventionnel
  | 'UNPAID_LEAVE' // Congé sans solde
  | 'TRAINING'; // Formation

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

// Jours fériés et calendrier
export interface Holiday {
  id: string;
  name: string;
  date: Date;
  type: HolidayType;
  isNational: boolean;
  regions?: string[]; // Spécifique à certaines régions (Alsace-Moselle, etc.)
  isWorkingDay?: boolean; // Override manuel
  createdAt: Date;
  updatedAt?: Date;
}

export type HolidayType =
  | 'FIXED' // Date fixe (Noël, Fête du travail)
  | 'CALCULATED' // Date calculée (Pâques, Ascension)
  | 'CUSTOM'; // Défini manuellement

// Congés scolaires
export type SchoolHolidayZone = 'A' | 'B' | 'C' | 'ALL';

export type SchoolHolidayPeriod =
  | 'TOUSSAINT' // Vacances de la Toussaint
  | 'NOEL' // Vacances de Noël
  | 'HIVER' // Vacances d'hiver
  | 'PRINTEMPS' // Vacances de printemps
  | 'ETE'; // Grandes vacances d'été

export interface SchoolHoliday {
  id: string;
  name: string; // "Vacances d'hiver 2025"
  period: SchoolHolidayPeriod;
  zone: SchoolHolidayZone; // A, B, C ou ALL pour toutes les zones
  startDate: Date;
  endDate: Date;
  year: number; // Année scolaire (ex: 2024 pour 2024-2025)
  createdAt: Date;
  updatedAt?: Date;
}

// Calculs de capacité
export interface UserCapacity {
  userId: string;
  period: DatePeriod;
  theoreticalDays: number; // Jours théoriques selon contrat
  availableDays: number; // Jours réellement disponibles
  plannedDays: number; // Jours déjà alloués
  remainingDays: number; // Jours libres
  overallocationDays?: number; // Surcharge si négative
  holidayDays: number; // Jours fériés
  leaveDays: number; // Congés
  workingDaysInPeriod: number[]; // Par jour de la période
  alerts: CapacityAlert[];
}

export interface DatePeriod {
  startDate: Date;
  endDate: Date;
  label?: string; // "Q1 2024", "Janvier 2024"
}

export interface CapacityAlert {
  type: 'OVERALLOCATION' | 'UNDERUTILIZATION' | 'LEAVE_CONFLICT' | 'SKILL_SHORTAGE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  suggestedActions: string[];
  affectedProjects?: string[];
}

// Planning global
export interface ResourcePlanning {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  resources: ResourceAllocation[];
  projects: string[]; // IDs des projets inclus
  totalCapacity: number; // En jours-homme
  usedCapacity: number;
  availableCapacity: number;
  overallocationRate: number; // Pourcentage de surcharge
  createdAt: Date;
  updatedAt: Date;
}

export interface ResourceAllocation {
  userId: string;
  projectId: string;
  allocationPercentage: number; // % du temps de la personne
  startDate: Date;
  endDate: Date;
  estimatedDays: number;
  role: string;
  isConfirmed: boolean;
}

// Métriques RH
export interface HRMetrics {
  period: DatePeriod;
  totalEmployees: number;
  activeEmployees: number;
  averageUtilizationRate: number;
  totalCapacityDays: number;
  totalAllocatedDays: number;
  totalLeaveDays: number;
  overallocationPercentage: number;
  departmentBreakdown: DepartmentMetrics[];
  contractTypeBreakdown: ContractMetrics[];
}

export interface DepartmentMetrics {
  department: string;
  employeeCount: number;
  utilizationRate: number;
  averageSalary?: number;
}

export interface ContractMetrics {
  contractType: ContractType;
  count: number;
  averageHours: number;
  utilizationRate: number;
}

// Métriques des compétences pour le dashboard opérationnel
export interface SkillMetrics {
  skillId: string;
  skillName: string;
  category: SkillCategory;
  
  // Disponibilité des compétences
  totalPeople: number;
  availablePeople: number; // Charge < 80%
  
  // Répartition par niveau
  level1Count: number; // 1 étoile
  level2Count: number; // 2 étoiles  
  level3Count: number; // 3 étoiles
  
  // Taux d'utilisation
  utilizationRate: number; // % de personnes avec cette compétence actuellement occupées
  
  // Demande vs offre
  demandCount: number; // Nombre de tâches nécessitant cette compétence
  supplyCount: number; // Nombre de personnes disponibles avec cette compétence
  
  // Alertes
  isInShortage: boolean; // Pénurie de compétence
  shortageLevel?: 'low' | 'medium' | 'high' | 'critical';
}

export interface SkillDashboardData {
  period: DatePeriod;
  skillMetrics: SkillMetrics[];
  topInDemandSkills: SkillMetrics[];
  skillsInShortage: SkillMetrics[];
  overallSkillUtilization: number;
  skillCategories: SkillCategoryMetrics[];
}

export interface SkillCategoryMetrics {
  category: SkillCategory;
  categoryLabel: string;
  totalSkills: number;
  averageUtilization: number;
  peopleCount: number;
  demandCount: number;
}

// Department management
export interface Department {
  id: string;
  name: string;
  description?: string;
  color: string;
  managerId?: string; // Responsable de département
  budget?: number;
  isActive: boolean;
  parentDepartmentId?: string; // Pour une hiérarchie si nécessaire
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDepartmentRequest {
  name: string;
  description?: string;
  color: string;
  managerId?: string;
  budget?: number;
  parentDepartmentId?: string;
}

// ========================================
// EPICS & MILESTONES - Gestion avancée de projets
// ========================================

/**
 * Epic - Grande fonctionnalité divisible en tâches
 * Représente un bloc de travail important avec une valeur business
 */
export interface Epic {
  id: string;
  projectId: string;
  
  // Identité
  code: string; // Ex: "EP-001"
  title: string;
  description: string;
  businessValue: string; // Description de la valeur apportée
  acceptanceCriteria: string[]; // Critères d'acceptation
  
  // Hiérarchie
  parentEpicId?: string; // Pour des épics imbriqués
  taskIds: string[]; // Tâches liées à cet epic
  
  // Responsables
  ownerId: string; // Product Owner ou responsable métier
  technicalLeadId?: string; // Lead technique
  
  // Planning
  status: EpicStatus;
  priority: Priority;
  startDate?: Date;
  dueDate?: Date;      // Date de fin planifiée
  completedDate?: Date;
  
  // Métriques
  progress: number; // 0-100% calculé depuis les tâches
  estimatedStoryPoints?: number;
  actualStoryPoints?: number;
  taskCount: number;
  completedTaskCount: number;
  
  // Budget
  estimatedBudget?: number;
  actualBudget?: number;
  
  // Risques et dépendances
  risks?: Risk[];
  dependencies?: EpicDependency[];
  
  // Métadonnées
  color: string; // Couleur pour la visualisation
  icon?: string; // Icône pour la représentation visuelle
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export type EpicStatus = 
  | 'upcoming'    // À venir
  | 'in_progress' // En cours
  | 'completed';  // Terminé

export interface EpicDependency {
  epicId: string;
  type: 'blocks' | 'requires' | 'relates_to';
  description?: string;
}

/**
 * Milestone - Jalon de projet
 * Point de contrôle important dans le calendrier du projet
 */
export interface Milestone {
  id: string;
  projectId: string;
  
  // Identité
  code: string; // Ex: "M1", "M2"
  name: string;
  description: string;
  type: MilestoneType;
  
  // Timing
  startDate?: Date; // Date de début de la période du jalon
  dueDate?: Date;   // Date de fin de la période du jalon
  followsTasks?: boolean; // Si true, les dates s'ajustent automatiquement selon les tâches liées
  isKeyDate: boolean; // Jalon critique ne pouvant être déplacé
  
  // Livrables
  deliverables: Deliverable[];
  successCriteria: string[]; // Critères de succès
  
  // Responsables
  ownerId: string; // Responsable du jalon
  reviewers: string[]; // Personnes qui valident
  
  // État
  status: MilestoneStatus;
  completionRate: number; // 0-100%
  
  // Dépendances
  dependsOn: MilestoneDependency[]; // Autres jalons ou epics prérequis
  epicIds: string[]; // Epics qui doivent être terminés
  taskIds: string[]; // Tâches spécifiques à compléter
  
  // Validation
  validationRequired: boolean;
  validatedBy?: string;
  validatedAt?: Date;
  validationNotes?: string;
  
  // Impact
  impact: 'low' | 'medium' | 'high' | 'critical';
  affectedTeams: string[]; // IDs des équipes impactées
  
  // Visualisation
  color: string;
  icon?: string;
  showOnRoadmap: boolean; // Visible sur la roadmap publique
  
  // Métadonnées
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  notes?: string;
}

export type MilestoneType = 
  | 'delivery'     // Livraison
  | 'review'       // Revue de projet
  | 'decision'     // Point de décision Go/NoGo
  | 'release'      // Release/Mise en production
  | 'demo'         // Démonstration
  | 'checkpoint'   // Point de contrôle
  | 'deadline';    // Échéance contractuelle

export type MilestoneStatus = 
  | 'upcoming'     // À venir
  | 'in_progress'  // En cours
  | 'completed';   // Complété

export interface Deliverable {
  id: string;
  name: string;
  description: string;
  type: 'document' | 'software' | 'report' | 'presentation' | 'other';
  isRequired: boolean;
  status: 'pending' | 'in_progress' | 'delivered' | 'approved';
  attachmentIds?: string[];
}

export interface MilestoneDependency {
  type: 'milestone' | 'epic' | 'task';
  id: string;
  name: string;
  isCritical: boolean; // Bloquant ou non
}

export interface Risk {
  id: string;
  description: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high' | 'critical';
  mitigation: string;
  owner: string;
  status: 'identified' | 'mitigated' | 'accepted' | 'closed';
}