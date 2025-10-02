import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
  limit,
  startAfter,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  LeaveRequest, 
  User, 
  WorkContract, 
  LeaveType,
  DatePeriod 
} from '../types';
import { leaveService } from './leave.service';

// Types pour les analytics RH
export interface HRMetrics {
  period: DatePeriod;
  totalEmployees: number;
  activeEmployees: number;
  totalLeaveRequests: number;
  totalLeaveDays: number;
  approvedLeaveRequests: number;
  rejectedLeaveRequests: number;
  pendingLeaveRequests: number;
  averageLeaveDaysPerEmployee: number;
  leaveTypeBreakdown: LeaveTypeStats[];
  monthlyTrends: MonthlyLeaveStats[];
  departmentStats: DepartmentLeaveStats[];
  topLeaveUsers: UserLeaveStats[];
  absenteeismRate: number;
  leaveApprovalRate: number;
  averageApprovalTime: number; // en heures
}

export interface LeaveTypeStats {
  type: LeaveType;
  count: number;
  totalDays: number;
  averageDuration: number;
  approvalRate: number;
}

export interface MonthlyLeaveStats {
  month: string;
  year: number;
  totalRequests: number;
  totalDays: number;
  approvedDays: number;
  rejectedDays: number;
}

export interface DepartmentLeaveStats {
  department: string;
  employeeCount: number;
  totalLeaveDays: number;
  averageLeaveDaysPerEmployee: number;
  absenteeismRate: number;
  mostPopularLeaveType: LeaveType;
}

export interface UserLeaveStats {
  userId: string;
  displayName: string;
  department: string;
  totalLeaveDays: number;
  leaveRequestsCount: number;
  averageRequestDuration: number;
  lastLeaveDate: Date | null;
}

export interface LeavePatternAnalysis {
  seasonalTrends: {
    month: number;
    averageDays: number;
    requestCount: number;
    pattern: 'HIGH' | 'MEDIUM' | 'LOW';
  }[];
  weeklyPatterns: {
    dayOfWeek: number;
    frequency: number; // nombre de demandes commençant ce jour
  }[];
  durationDistribution: {
    range: string; // "1 jour", "2-3 jours", etc.
    count: number;
    percentage: number;
  }[];
}

export interface TeamCapacityForecast {
  period: DatePeriod;
  departments: {
    name: string;
    totalCapacity: number; // en jours-personne
    plannedAbsence: number;
    availableCapacity: number;
    utilizationRate: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    recommendations: string[];
  }[];
}

class HRAnalyticsService {
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  private metricsCache = new Map<string, { data: any; timestamp: number }>();

  // ========================================
  // MÉTRIQUES PRINCIPALES
  // ========================================

  /**
   * Calcule les métriques RH globales pour une période
   */
  async getHRMetrics(period: DatePeriod): Promise<HRMetrics> {
    const cacheKey = `hr-metrics-${period.startDate.getTime()}-${period.endDate.getTime()}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      // Récupérer tous les utilisateurs
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
      
      
      const activeEmployees = users.filter(u => u.isActive || true); // Fallback si isActive n'existe pas
      
      // Récupérer les demandes de congés pour la période
      // TEMPORAIRE: Requête désactivée car nécessite un index composite Firestore
      // const leavesQuery = query(
      //   collection(db, 'leaveRequests'),
      //   where('startDate', '>=', Timestamp.fromDate(period.startDate)),
      //   where('startDate', '<=', Timestamp.fromDate(period.endDate)),
      //   orderBy('startDate', 'asc')
      // );
      
      // Utiliser requête simple sans index composite
      const leavesSnapshot = await getDocs(collection(db, 'leaveRequests'));
      const leaves = leavesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.dueDate?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate(),
          approvedAt: data.approvedAt?.toDate(),
        };
      }) as LeaveRequest[];

      // Filtrer côté client pour la période demandée
      const filteredLeaves = leaves.filter(l => 
        l.startDate >= period.startDate && l.startDate <= period.endDate
      );

      const approvedLeaves = filteredLeaves.filter(l => l.status === 'APPROVED');
      const rejectedLeaves = filteredLeaves.filter(l => l.status === 'REJECTED');
      const pendingLeaves = filteredLeaves.filter(l => l.status === 'PENDING');
      
      const totalLeaveDays = approvedLeaves.reduce((sum, l) => sum + l.totalDays, 0);
      
      const metrics: HRMetrics = {
        period,
        totalEmployees: users.length,
        activeEmployees: activeEmployees.length,
        totalLeaveRequests: leaves.length,
        totalLeaveDays,
        approvedLeaveRequests: approvedLeaves.length,
        rejectedLeaveRequests: rejectedLeaves.length,
        pendingLeaveRequests: pendingLeaves.length,
        averageLeaveDaysPerEmployee: activeEmployees.length > 0 ? totalLeaveDays / activeEmployees.length : 0,
        leaveTypeBreakdown: await this.calculateLeaveTypeStats(leaves),
        monthlyTrends: await this.calculateMonthlyTrends(leaves, period),
        departmentStats: await this.calculateDepartmentStats(leaves, users),
        topLeaveUsers: await this.calculateTopLeaveUsers(leaves, users),
        absenteeismRate: this.calculateAbsenteeismRate(totalLeaveDays, activeEmployees.length, period),
        leaveApprovalRate: leaves.length > 0 ? (approvedLeaves.length / leaves.length) * 100 : 0,
        averageApprovalTime: await this.calculateAverageApprovalTime(approvedLeaves),
      };

      this.setCachedData(cacheKey, metrics);
      return metrics;
    } catch (error) {
      console.error('Erreur lors du calcul des métriques RH:', error);
      throw error;
    }
  }

  /**
   * Analyse les patterns de congés
   */
  async analyzeLeavePatterns(period: DatePeriod): Promise<LeavePatternAnalysis> {
    try {
      // TEMPORAIRE: Requête désactivée car nécessite un index composite Firestore
      // const leavesQuery = query(
      //   collection(db, 'leaveRequests'),
      //   where('status', '==', 'APPROVED'),
      //   where('startDate', '>=', Timestamp.fromDate(new Date(period.startDate.getFullYear() - 1, 0, 1))),
      //   where('startDate', '<=', Timestamp.fromDate(period.endDate))
      // );
      
      // Utiliser requête simple sans index composite
      const leavesSnapshot = await getDocs(collection(db, 'leaveRequests'));
      const leaves = leavesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.dueDate?.toDate() || new Date(),
        };
      }) as LeaveRequest[];

      // Filtrer côté client pour les congés approuvés de la période étendue
      const approvedLeaves = leaves.filter(l => 
        l.status === 'APPROVED' &&
        l.startDate >= new Date(period.startDate.getFullYear() - 1, 0, 1) &&
        l.startDate <= period.endDate
      );

      return {
        seasonalTrends: this.analyzeSeasonalTrends(approvedLeaves),
        weeklyPatterns: this.analyzeWeeklyPatterns(approvedLeaves),
        durationDistribution: this.analyzeDurationDistribution(approvedLeaves),
      };
    } catch (error) {
      console.error('Erreur lors de l\'analyse des patterns:', error);
      throw error;
    }
  }

  /**
   * Prédit la capacité d'équipe future
   * TEMPORAIRE: Index Firestore requis - fonction désactivée
   */
  async forecastTeamCapacity(futurePeriod: DatePeriod): Promise<TeamCapacityForecast> {
    try {
      // TEMPORAIRE: Requête désactivée car nécessite un index composite Firestore
      // const futureLeavesQuery = query(
      //   collection(db, 'leaveRequests'),
      //   where('status', '==', 'APPROVED'),
      //   where('startDate', '>=', Timestamp.fromDate(futurePeriod.startDate)),
      //   where('endDate', '<=', Timestamp.fromDate(futurePeriod.dueDate))
      // );
      
      // TEMPORAIRE: Retourner des données par défaut jusqu'à création des index Firestore
      const forecast: TeamCapacityForecast = {
        period: futurePeriod,
        departments: [],
      };

      return forecast;
    } catch (error) {
      console.error('Erreur lors de la prévision de capacité:', error);
      throw error;
    }
  }

  // ========================================
  // CALCULS PRIVÉS
  // ========================================

  private async calculateLeaveTypeStats(leaves: LeaveRequest[]): Promise<LeaveTypeStats[]> {
    const typeMap = new Map<LeaveType, { count: number; totalDays: number; approved: number }>();
    
    leaves.forEach(leave => {
      if (!typeMap.has(leave.type)) {
        typeMap.set(leave.type, { count: 0, totalDays: 0, approved: 0 });
      }
      
      const stats = typeMap.get(leave.type)!;
      stats.count++;
      stats.totalDays += leave.totalDays;
      
      if (leave.status === 'APPROVED') {
        stats.approved++;
      }
    });

    return Array.from(typeMap.entries()).map(([type, stats]) => ({
      type,
      count: stats.count,
      totalDays: stats.totalDays,
      averageDuration: stats.count > 0 ? stats.totalDays / stats.count : 0,
      approvalRate: stats.count > 0 ? (stats.approved / stats.count) * 100 : 0,
    }));
  }

  private async calculateMonthlyTrends(leaves: LeaveRequest[], period: DatePeriod): Promise<MonthlyLeaveStats[]> {
    const monthMap = new Map<string, {
      totalRequests: number;
      totalDays: number;
      approvedDays: number;
      rejectedDays: number;
    }>();

    leaves.forEach(leave => {
      const monthKey = `${leave.startDate.getFullYear()}-${leave.startDate.getMonth() + 1}`;
      
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          totalRequests: 0,
          totalDays: 0,
          approvedDays: 0,
          rejectedDays: 0,
        });
      }

      const stats = monthMap.get(monthKey)!;
      stats.totalRequests++;
      stats.totalDays += leave.totalDays;
      
      if (leave.status === 'APPROVED') {
        stats.approvedDays += leave.totalDays;
      } else if (leave.status === 'REJECTED') {
        stats.rejectedDays += leave.totalDays;
      }
    });

    return Array.from(monthMap.entries()).map(([monthKey, stats]) => {
      const [year, month] = monthKey.split('-').map(Number);
      return {
        month: new Date(year, month - 1).toLocaleDateString('fr-FR', { month: 'long' }),
        year,
        ...stats,
      };
    });
  }

  private async calculateDepartmentStats(leaves: LeaveRequest[], users: User[]): Promise<DepartmentLeaveStats[]> {
    const departments = this.groupByDepartment(users);
    
    return departments.map(dept => {
      const deptLeaves = leaves.filter(leave => 
        users.find(u => u.id === leave.userId)?.department === dept.name
      );
      
      const approvedLeaves = deptLeaves.filter(l => l.status === 'APPROVED');
      const totalDays = approvedLeaves.reduce((sum, l) => sum + l.totalDays, 0);
      
      // Calculer le type de congé le plus populaire
      const typeFreq = new Map<LeaveType, number>();
      approvedLeaves.forEach(leave => {
        typeFreq.set(leave.type, (typeFreq.get(leave.type) || 0) + 1);
      });
      
      const mostPopularType = Array.from(typeFreq.entries())
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'PAID_LEAVE';

      return {
        department: dept.name,
        employeeCount: dept.userCount,
        totalLeaveDays: totalDays,
        averageLeaveDaysPerEmployee: dept.userCount > 0 ? totalDays / dept.userCount : 0,
        absenteeismRate: this.calculateAbsenteeismRate(totalDays, dept.userCount, { 
          startDate: new Date(), 
          endDate: new Date(), 
          label: '' 
        }),
        mostPopularLeaveType: mostPopularType,
      };
    });
  }

  private async calculateTopLeaveUsers(leaves: LeaveRequest[], users: User[]): Promise<UserLeaveStats[]> {
    const userMap = new Map<string, { totalDays: number; count: number; lastDate: Date | null }>();
    
    leaves.filter(l => l.status === 'APPROVED').forEach(leave => {
      if (!userMap.has(leave.userId)) {
        userMap.set(leave.userId, { totalDays: 0, count: 0, lastDate: null });
      }
      
      const stats = userMap.get(leave.userId)!;
      stats.totalDays += leave.totalDays;
      stats.count++;
      
      if (!stats.lastDate || leave.startDate > stats.lastDate) {
        stats.lastDate = leave.startDate;
      }
    });

    return Array.from(userMap.entries())
      .map(([userId, stats]) => {
        const user = users.find(u => u.id === userId);
        return {
          userId,
          displayName: user?.displayName || 'Utilisateur inconnu',
          department: user?.department || 'Non défini',
          totalLeaveDays: stats.totalDays,
          leaveRequestsCount: stats.count,
          averageRequestDuration: stats.count > 0 ? stats.totalDays / stats.count : 0,
          lastLeaveDate: stats.lastDate,
        };
      })
      .sort((a, b) => b.totalLeaveDays - a.totalLeaveDays)
      .slice(0, 10);
  }

  private calculateAbsenteeismRate(totalLeaveDays: number, employeeCount: number, period: DatePeriod): number {
    if (employeeCount === 0) return 0;
    
    const periodDays = Math.ceil((period.endDate.getTime() - period.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const workingDays = Math.floor(periodDays * (5/7)); // Approximation 5 jours sur 7
    const totalPossibleWorkingDays = employeeCount * workingDays;
    
    return totalPossibleWorkingDays > 0 ? (totalLeaveDays / totalPossibleWorkingDays) * 100 : 0;
  }

  private async calculateAverageApprovalTime(approvedLeaves: LeaveRequest[]): Promise<number> {
    const approvalsWithTime = approvedLeaves.filter(l => l.approvedAt && l.createdAt);
    
    if (approvalsWithTime.length === 0) return 0;
    
    const totalHours = approvalsWithTime.reduce((sum, leave) => {
      const diffMs = leave.approvedAt!.getTime() - leave.createdAt!.getTime();
      return sum + (diffMs / (1000 * 60 * 60));
    }, 0);
    
    return totalHours / approvalsWithTime.length;
  }

  private analyzeSeasonalTrends(leaves: LeaveRequest[]) {
    const monthStats = new Array(12).fill(0).map(() => ({ days: 0, count: 0 }));
    
    leaves.forEach(leave => {
      const month = leave.startDate.getMonth();
      monthStats[month].days += leave.totalDays;
      monthStats[month].count++;
    });

    const maxDays = Math.max(...monthStats.map(s => s.days));
    
    return monthStats.map((stats, month) => ({
      month: month + 1,
      averageDays: stats.count > 0 ? stats.days / stats.count : 0,
      requestCount: stats.count,
      pattern: stats.days > maxDays * 0.7 ? 'HIGH' as const : 
               stats.days > maxDays * 0.3 ? 'MEDIUM' as const : 'LOW' as const,
    }));
  }

  private analyzeWeeklyPatterns(leaves: LeaveRequest[]) {
    const dayStats = new Array(7).fill(0);
    
    leaves.forEach(leave => {
      const dayOfWeek = leave.startDate.getDay();
      dayStats[dayOfWeek]++;
    });

    return dayStats.map((frequency, dayOfWeek) => ({
      dayOfWeek,
      frequency,
    }));
  }

  private analyzeDurationDistribution(leaves: LeaveRequest[]) {
    const ranges = [
      { range: '1 jour', min: 1, max: 1 },
      { range: '2-3 jours', min: 2, max: 3 },
      { range: '4-7 jours', min: 4, max: 7 },
      { range: '8-14 jours', min: 8, max: 14 },
      { range: '15+ jours', min: 15, max: Infinity },
    ];

    const distribution = ranges.map(range => ({
      range: range.range,
      count: leaves.filter(l => l.totalDays >= range.min && l.totalDays <= range.max).length,
      percentage: 0,
    }));

    const total = leaves.length;
    distribution.forEach(d => {
      d.percentage = total > 0 ? (d.count / total) * 100 : 0;
    });

    return distribution;
  }

  private groupByDepartment(users: User[]): { name: string; userCount: number }[] {
    const deptMap = new Map<string, number>();
    
    users.filter(u => u.isActive).forEach(user => {
      const dept = user.department || 'Non défini';
      deptMap.set(dept, (deptMap.get(dept) || 0) + 1);
    });

    return Array.from(deptMap.entries()).map(([name, userCount]) => ({
      name,
      userCount,
    }));
  }

  private async calculateWorkingDays(startDate: Date, endDate: Date): Promise<number> {
    // Utilisation du service holiday pour calculer les jours ouvrés
    try {
      // TODO: Intégrer avec holidayService.getWorkingDaysBetween()
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      return Math.floor(totalDays * (5/7)); // Approximation
    } catch (error) {
      console.error('Erreur calcul jours ouvrés:', error);
      return 0;
    }
  }

  private assessRiskLevel(utilizationRate: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (utilizationRate > 30) return 'HIGH';
    if (utilizationRate > 15) return 'MEDIUM';
    return 'LOW';
  }

  private generateRecommendations(department: string, utilizationRate: number, plannedAbsence: number): string[] {
    const recommendations: string[] = [];
    
    if (utilizationRate > 30) {
      recommendations.push('Planifier du personnel supplémentaire ou des prestataires');
      recommendations.push('Envisager le report de projets non critiques');
    }
    
    if (utilizationRate > 15) {
      recommendations.push('Surveiller la charge de travail de près');
      recommendations.push('Préparer un plan de continuité');
    }
    
    if (plannedAbsence === 0) {
      recommendations.push('Encourager la prise de congés pour maintenir la motivation');
    }

    return recommendations;
  }

  // ========================================
  // CACHE MANAGEMENT
  // ========================================

  private getCachedData(key: string): any {
    const cached = this.metricsCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  private setCachedData(key: string, data: any): void {
    this.metricsCache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Efface le cache (utile après des modifications importantes)
   */
  clearCache(): void {
    this.metricsCache.clear();
  }

}

export const hrAnalyticsService = new HRAnalyticsService();