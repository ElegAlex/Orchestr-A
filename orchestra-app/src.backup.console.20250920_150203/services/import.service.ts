import Papa from 'papaparse';
import { Task, Milestone, TaskStatus, TaskType, Priority, MilestoneStatus, MilestoneType } from '../types';
import { taskService } from './task.service';
import { milestoneService } from './milestone.service';

export interface ImportRow {
  Type: string;
  Nom: string;
  Description: string;
  Date_début?: string;
  Date_fin?: string;
  Priorité?: string;
  Assigné?: string;
  Status?: string;
  Parent?: string;
  [key: string]: string | undefined;
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: ImportError[];
  createdTasks: Task[];
  createdMilestones: Milestone[];
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
  data: ImportRow;
}

export interface ImportPreview {
  isValid: boolean;
  totalRows: number;
  taskCount: number;
  milestoneCount: number;
  errors: ImportError[];
  data: ImportRow[];
}

class ImportService {
  private readonly TYPE_MAPPING: Record<string, 'TASK' | 'MILESTONE'> = {
    'TACHE': 'TASK',
    'TÂCHE': 'TASK',
    'TASK': 'TASK',
    'JALON': 'MILESTONE',
    'MILESTONE': 'MILESTONE',
    'M': 'MILESTONE',
    'T': 'TASK'
  };

  private readonly STATUS_MAPPING: Record<string, TaskStatus> = {
    'TODO': 'TODO',
    'À FAIRE': 'TODO',
    'A FAIRE': 'TODO',
    'EN COURS': 'IN_PROGRESS',
    'IN_PROGRESS': 'IN_PROGRESS',
    'PROGRESS': 'IN_PROGRESS',
    'TERMINÉ': 'DONE',
    'TERMINE': 'DONE',
    'DONE': 'DONE',
    'FINI': 'DONE',
    'BLOQUÉ': 'BLOCKED',
    'BLOQUE': 'BLOCKED',
    'BLOCKED': 'BLOCKED'
  };

  private readonly MILESTONE_STATUS_MAPPING: Record<string, MilestoneStatus> = {
    'UPCOMING': 'upcoming',
    'À VENIR': 'upcoming',
    'A VENIR': 'upcoming',
    'PLANIFIÉ': 'upcoming',
    'PLANIFIE': 'upcoming',
    'EN COURS': 'in_progress',
    'IN_PROGRESS': 'in_progress',
    'PROGRESS': 'in_progress',
    'À RISQUE': 'in_progress',
    'A RISQUE': 'in_progress',
    'AT_RISK': 'in_progress',
    'RISQUE': 'in_progress',
    'TERMINÉ': 'completed',
    'TERMINE': 'completed',
    'COMPLETED': 'completed',
    'FINI': 'completed',
    'MANQUÉ': 'completed',
    'MANQUE': 'completed',
    'MISSED': 'completed',
    'RATÉ': 'completed',
    'RATE': 'completed'
  };

  private readonly PRIORITY_MAPPING: Record<string, Priority> = {
    'CRITIQUE': 'P0',
    'P0': 'P0',
    '0': 'P0',
    'HAUTE': 'P1',
    'HIGH': 'P1',
    'P1': 'P1',
    '1': 'P1',
    'NORMALE': 'P2',
    'NORMAL': 'P2',
    'MEDIUM': 'P2',
    'P2': 'P2',
    '2': 'P2',
    'BASSE': 'P3',
    'LOW': 'P3',
    'P3': 'P3',
    '3': 'P3'
  };

  /**
   * Parse CSV data from text
   */
  parseCSV(csvText: string): Promise<ImportRow[]> {
    return new Promise((resolve, reject) => {
      Papa.parse<ImportRow>(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => {
          // Normaliser les en-têtes courants
          const normalized = header.trim().toLowerCase();
          if (normalized.includes('type')) return 'Type';
          if (normalized.includes('nom') || normalized.includes('titre') || normalized.includes('title')) return 'Nom';
          if (normalized.includes('description') || normalized.includes('desc')) return 'Description';
          if (normalized.includes('début') || normalized.includes('start') || normalized.includes('debut')) return 'Date_début';
          if (normalized.includes('fin') || normalized.includes('end') || normalized.includes('échéance') || normalized.includes('echeance') || normalized.includes('due')) return 'Date_fin';
          if (normalized.includes('priorité') || normalized.includes('priority') || normalized.includes('priorite')) return 'Priorité';
          if (normalized.includes('assigné') || normalized.includes('assigne') || normalized.includes('assigned') || normalized.includes('responsable')) return 'Assigné';
          if (normalized.includes('status') || normalized.includes('statut') || normalized.includes('état') || normalized.includes('etat')) return 'Status';
          if (normalized.includes('parent') || normalized.includes('epic') || normalized.includes('jalon')) return 'Parent';
          
          return header; // Garder l'en-tête original si pas de mapping
        },
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(new Error(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`));
          } else {
            resolve(results.data as ImportRow[]);
          }
        },
        error: (error: any) => {
          reject(error);
        }
      });
    });
  }

  /**
   * Parse clipboard data (tab-separated or CSV)
   */
  parseClipboard(clipboardText: string): Promise<ImportRow[]> {
    // Détecter si c'est du TSV (données Excel collées)
    const lines = clipboardText.trim().split('\n');
    const firstLine = lines[0];
    
    // Si la première ligne contient des tabulations, c'est probablement du TSV
    if (firstLine.includes('\t')) {
      return new Promise((resolve, reject) => {
        Papa.parse<ImportRow>(clipboardText, {
          header: true,
          delimiter: '\t',
          skipEmptyLines: true,
          transformHeader: (header: string) => {
            const normalized = header.trim().toLowerCase();
            if (normalized.includes('type')) return 'Type';
            if (normalized.includes('nom') || normalized.includes('titre') || normalized.includes('title')) return 'Nom';
            if (normalized.includes('description') || normalized.includes('desc')) return 'Description';
            if (normalized.includes('début') || normalized.includes('start') || normalized.includes('debut')) return 'Date_début';
            if (normalized.includes('fin') || normalized.includes('end') || normalized.includes('échéance') || normalized.includes('echeance') || normalized.includes('due')) return 'Date_fin';
            if (normalized.includes('priorité') || normalized.includes('priority') || normalized.includes('priorite')) return 'Priorité';
            if (normalized.includes('assigné') || normalized.includes('assigne') || normalized.includes('assigned') || normalized.includes('responsable')) return 'Assigné';
            if (normalized.includes('status') || normalized.includes('statut') || normalized.includes('état') || normalized.includes('etat')) return 'Status';
            if (normalized.includes('parent') || normalized.includes('epic') || normalized.includes('jalon')) return 'Parent';
            
            return header;
          },
          complete: (results) => {
            if (results.errors.length > 0) {
              reject(new Error(`TSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`));
            } else {
              resolve(results.data as ImportRow[]);
            }
          },
          error: (error: any) => {
            reject(error);
          }
        });
      });
    } else {
      // Sinon, traiter comme du CSV
      return this.parseCSV(clipboardText);
    }
  }

  /**
   * Validate and preview import data
   */
  async validateImportData(data: ImportRow[]): Promise<ImportPreview> {
    const errors: ImportError[] = [];
    let taskCount = 0;
    let milestoneCount = 0;

    data.forEach((row, index) => {
      const rowNumber = index + 1;

      // Validation du Type (obligatoire)
      if (!row.Type || row.Type.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'Type',
          message: 'Le type est obligatoire (TACHE ou JALON)',
          data: row
        });
        return;
      }

      const normalizedType = row.Type.toUpperCase().trim();
      const mappedType = this.TYPE_MAPPING[normalizedType];
      
      if (!mappedType) {
        errors.push({
          row: rowNumber,
          field: 'Type',
          message: `Type invalide: "${row.Type}". Utilisez TACHE ou JALON`,
          data: row
        });
        return;
      }

      if (mappedType === 'TASK') {
        taskCount++;
      } else {
        milestoneCount++;
      }

      // Validation du Nom (obligatoire)
      if (!row.Nom || row.Nom.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'Nom',
          message: 'Le nom est obligatoire',
          data: row
        });
      }

      // Validation des dates
      if (row.Date_début && !this.isValidDate(row.Date_début)) {
        errors.push({
          row: rowNumber,
          field: 'Date_début',
          message: `Date de début invalide: "${row.Date_début}". Format attendu: YYYY-MM-DD`,
          data: row
        });
      }

      if (row.Date_fin && !this.isValidDate(row.Date_fin)) {
        errors.push({
          row: rowNumber,
          field: 'Date_fin',
          message: `Date de fin invalide: "${row.Date_fin}". Format attendu: YYYY-MM-DD`,
          data: row
        });
      }

      // Validation de la priorité
      if (row.Priorité && !this.PRIORITY_MAPPING[row.Priorité.toUpperCase()]) {
        errors.push({
          row: rowNumber,
          field: 'Priorité',
          message: `Priorité invalide: "${row.Priorité}". Utilisez P0, P1, P2, P3 ou CRITIQUE, HAUTE, NORMALE, BASSE`,
          data: row
        });
      }

      // Validation du statut selon le type
      if (row.Status) {
        if (mappedType === 'TASK' && !this.STATUS_MAPPING[row.Status.toUpperCase()]) {
          errors.push({
            row: rowNumber,
            field: 'Status',
            message: `Statut de tâche invalide: "${row.Status}". Utilisez TODO, IN_PROGRESS, DONE, BLOCKED`,
            data: row
          });
        } else if (mappedType === 'MILESTONE' && !this.MILESTONE_STATUS_MAPPING[row.Status.toUpperCase()]) {
          errors.push({
            row: rowNumber,
            field: 'Status',
            message: `Statut de jalon invalide: "${row.Status}". Utilisez UPCOMING, IN_PROGRESS, AT_RISK, COMPLETED, MISSED`,
            data: row
          });
        }
      }

      // Validation email pour assigné (basique)
      if (row.Assigné && !this.isValidEmail(row.Assigné)) {
        errors.push({
          row: rowNumber,
          field: 'Assigné',
          message: `Email invalide: "${row.Assigné}"`,
          data: row
        });
      }
    });

    return {
      isValid: errors.length === 0,
      totalRows: data.length,
      taskCount,
      milestoneCount,
      errors,
      data
    };
  }

  /**
   * Import tasks and milestones to project
   */
  async importToProject(projectId: string, data: ImportRow[]): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      totalRows: data.length,
      successCount: 0,
      errorCount: 0,
      errors: [],
      createdTasks: [],
      createdMilestones: []
    };

    // D'abord valider les données
    const validation = await this.validateImportData(data);
    if (!validation.isValid) {
      result.errors = validation.errors;
      result.errorCount = validation.errors.length;
      return result;
    }

    // Créer d'abord les jalons, puis les tâches
    const milestoneRows = data.filter(row => this.TYPE_MAPPING[row.Type.toUpperCase()] === 'MILESTONE');
    const taskRows = data.filter(row => this.TYPE_MAPPING[row.Type.toUpperCase()] === 'TASK');
    
    // Map des noms vers les IDs créés pour les relations parent/enfant
    const createdItemsMap = new Map<string, string>();

    // Import des jalons
    for (const row of milestoneRows) {
      try {
        const milestone = await this.createMilestoneFromRow(projectId, row);
        result.createdMilestones.push(milestone);
        createdItemsMap.set(row.Nom, milestone.id);
        result.successCount++;
      } catch (error) {
        result.errors.push({
          row: data.indexOf(row) + 1,
          message: `Erreur lors de la création du jalon: ${error}`,
          data: row
        });
        result.errorCount++;
      }
    }

    // Import des tâches
    for (const row of taskRows) {
      try {
        const task = await this.createTaskFromRow(projectId, row, createdItemsMap);
        result.createdTasks.push(task);
        createdItemsMap.set(row.Nom, task.id);
        result.successCount++;
      } catch (error) {
        result.errors.push({
          row: data.indexOf(row) + 1,
          message: `Erreur lors de la création de la tâche: ${error}`,
          data: row
        });
        result.errorCount++;
      }
    }

    result.success = result.errorCount === 0;
    return result;
  }

  private async createMilestoneFromRow(projectId: string, row: ImportRow): Promise<Milestone> {
    const milestoneData: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt'> = {
      projectId,
      code: `M${Date.now().toString().slice(-4)}`, // Code temporaire, sera remplacé
      name: row.Nom,
      description: row.Description || '',
      type: 'checkpoint' as MilestoneType,
      dueDate: this.parseDate(row.Date_fin || row.Date_début || new Date().toISOString()),
      isKeyDate: false,
      deliverables: [],
      successCriteria: [],
      ownerId: '', // Sera défini plus tard
      reviewers: [],
      status: this.parseMilestoneStatus(row.Status),
      completionRate: 0,
      dependsOn: [],
      epicIds: [],
      taskIds: [],
      validationRequired: false,
      impact: 'medium',
      affectedTeams: [],
      color: '#1976d2',
      showOnRoadmap: true,
      createdBy: '', // Sera défini lors de la création
      notes: ''
    };

    const milestoneId = await milestoneService.createMilestone(milestoneData);
    const createdMilestone = await milestoneService.getMilestoneById(milestoneId);
    
    if (!createdMilestone) {
      throw new Error('Erreur lors de la création du jalon');
    }

    return createdMilestone;
  }

  private async createTaskFromRow(projectId: string, row: ImportRow, createdItemsMap: Map<string, string>): Promise<Task> {
    const taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
      projectId,
      taskCategory: 'PROJECT_TASK',
      title: row.Nom,
      description: row.Description || '',
      type: 'TASK' as TaskType,
      status: this.parseTaskStatus(row.Status),
      priority: this.parsePriority(row.Priorité),
      responsible: row.Assigné ? [row.Assigné] : [],
      accountable: [], // À définir manuellement
      consulted: [],
      informed: [],
      dueDate: row.Date_fin ? this.parseDate(row.Date_fin) : undefined,
      startDate: row.Date_début ? this.parseDate(row.Date_début) : undefined,
      dependencies: [],
      labels: [],
      attachments: [],
      comments: [],
      customFields: {},
      definitionOfDone: [],
      acceptanceCriteria: '',
      remainingHours: undefined,
      loggedHours: 0,
      completedDate: undefined,
      isBlocked: false,
      riskLevel: 'low',
      businessValue: 0,
      technicalDebt: false,
      requiredSkills: [],
      timeSpent: 0,
      timeEntries: [],
      createdBy: '', // Sera défini lors de la création
      deletedAt: undefined
    };

    return await taskService.createTask(taskData);
  }

  private parseDate(dateString: string): Date {
    // Essayer différents formats de date
    const formats = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
      /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY
    ];

    if (formats[0].test(dateString)) {
      return new Date(dateString);
    } else if (formats[1].test(dateString)) {
      const [day, month, year] = dateString.split('/');
      return new Date(`${year}-${month}-${day}`);
    } else if (formats[2].test(dateString)) {
      const [day, month, year] = dateString.split('-');
      return new Date(`${year}-${month}-${day}`);
    }
    
    // Fallback: essayer le parsing automatique
    return new Date(dateString);
  }

  private parseTaskStatus(status?: string): TaskStatus {
    if (!status) return 'TODO';
    return this.STATUS_MAPPING[status.toUpperCase()] || 'TODO';
  }

  private parseMilestoneStatus(status?: string): MilestoneStatus {
    if (!status) return 'upcoming';
    return this.MILESTONE_STATUS_MAPPING[status.toUpperCase()] || 'upcoming';
  }

  private parsePriority(priority?: string): Priority {
    if (!priority) return 'P2';
    return this.PRIORITY_MAPPING[priority.toUpperCase()] || 'P2';
  }

  private isValidDate(dateString: string): boolean {
    const formats = [
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{2}\/\d{2}\/\d{4}$/,
      /^\d{2}-\d{2}-\d{4}$/,
    ];

    return formats.some(format => format.test(dateString)) && !isNaN(new Date(this.parseDate(dateString)).getTime());
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Generate template CSV for download
   */
  generateTemplateCSV(): string {
    const template = [
      // En-têtes simples
      ['Type', 'Nom', 'Description', 'Date_début', 'Date_fin', 'Priorité', 'Assigné', 'Status', 'Parent'],
      // Exemples
      ['JALON', 'Livraison V1.0', 'Première version fonctionnelle', '2025-01-15', '2025-01-15', 'P0', '', 'upcoming', ''],
      ['TACHE', 'Développer interface utilisateur', 'Créer les écrans de connexion', '2025-01-10', '2025-01-14', 'P1', 'dev@entreprise.com', 'TODO', 'Livraison V1.0'],
      ['TACHE', 'Tests fonctionnels', 'Valider les fonctionnalités', '2025-01-12', '2025-01-15', 'P2', 'qa@entreprise.com', 'TODO', 'Livraison V1.0']
    ];

    return Papa.unparse(template, {
      delimiter: ',',
      header: false
    });
  }
}

export const importService = new ImportService();