/**
 * Service de gestion des présences
 * Calcule qui est présent sur site, en télétravail ou absent pour une date donnée
 */

import { userService } from './user.service';
import { leaveService } from './leave.service';
import { User } from '../types';
import { db } from '../config/firebase';
import { collection, getDocs } from 'firebase/firestore';

export interface PresenceStatus {
  onSite: UserPresence[];
  telework: UserPresence[];
  absent: UserPresence[];
}

export interface UserPresence {
  user: User;
  status: 'on_site' | 'telework' | 'absent';
  details?: string; // Ex: "Congé payé", "Télétravail validé"
  validationStatus?: 'APPROVED' | 'PENDING' | 'REJECTED';
}

class PresenceService {
  /**
   * Récupère les présences pour une date donnée
   */
  async getPresencesForDate(date: Date): Promise<PresenceStatus> {
    try {
      // 1. Récupérer tous les utilisateurs actifs (exclure admin et observateurs)
      const allUsers = await userService.getAllUsers();
      const activeUsers = allUsers.filter(u =>
        u.isActive !== false &&
        u.role !== 'admin' &&
        u.role !== 'viewer'
      );

      // 2. Récupérer TOUS les congés (on filtrera après)
      const leavesRef = collection(db, 'leaveRequests');
      const leavesSnapshot = await getDocs(leavesRef);

      const leavesOnDate = leavesSnapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId,
            type: data.type,
            status: data.status,
            startDate: data.startDate?.toDate ? data.startDate.toDate() : new Date(data.startDate),
            endDate: data.endDate?.toDate ? data.endDate.toDate() : new Date(data.endDate),
            reason: data.reason,
          };
        })
        .filter(leave => {
          // Ne garder que les congés approuvés (normaliser majuscule/minuscule)
          if (!leave.status || leave.status.toUpperCase() !== 'APPROVED') return false;

          const leaveStart = new Date(leave.startDate);
          const leaveEnd = new Date(leave.endDate);
          const targetDate = new Date(date);
          targetDate.setHours(0, 0, 0, 0);
          leaveStart.setHours(0, 0, 0, 0);
          leaveEnd.setHours(0, 0, 0, 0);

          const isInRange = targetDate >= leaveStart && targetDate <= leaveEnd;
          return isInRange;
        });

      // 3. Récupérer TOUS les overrides télétravail (on filtrera après)
      const teleworkOverridesRef = collection(db, 'teleworkOverrides');
      const teleworkSnapshot = await getDocs(teleworkOverridesRef);

      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);

      const teleworkOnDate = teleworkSnapshot.docs
        .map(doc => {
          const data = doc.data();

          let overrideDate: Date;
          if (data.date?.toDate) {
            overrideDate = data.date.toDate();
          } else if (data.date?.seconds) {
            // Format Timestamp Firebase
            overrideDate = new Date(data.date.seconds * 1000);
          } else {
            overrideDate = new Date(data.date);
          }

          overrideDate.setHours(0, 0, 0, 0);

          return {
            userId: data.userId,
            status: data.approvalStatus || data.status || 'PENDING',
            mode: data.mode,
            date: overrideDate,
          };
        })
        .filter(override => {
          const isSameDay = override.date.getTime() === targetDate.getTime();
          const isRemote = override.mode === 'remote';
          return isSameDay && isRemote;
        });

      // 4. Classifier les utilisateurs
      const onSite: UserPresence[] = [];
      const telework: UserPresence[] = [];
      const absent: UserPresence[] = [];

      for (const user of activeUsers) {
        // Vérifier si absent (congé)
        const userLeave = leavesOnDate.find(leave => leave.userId === user.id);
        if (userLeave) {
          absent.push({
            user,
            status: 'absent',
            details: this.getLeaveTypeLabel(userLeave.type),
            validationStatus: 'APPROVED'
          });
          continue;
        }

        // Vérifier si en télétravail
        const userTelework = teleworkOnDate.find(res => res.userId === user.id);
        if (userTelework) {
          // Normaliser le status (approved/APPROVED, pending/PENDING, etc.)
          const normalizedStatus = userTelework.status.toUpperCase();

          telework.push({
            user,
            status: 'telework',
            details: normalizedStatus === 'APPROVED' ? 'Télétravail validé' :
                     normalizedStatus === 'PENDING' ? 'En attente de validation' :
                     'Télétravail',
            validationStatus: normalizedStatus as 'APPROVED' | 'PENDING' | 'REJECTED'
          });
          continue;
        }

        // Sinon, présent sur site
        onSite.push({
          user,
          status: 'on_site',
          details: 'Sur site'
        });
      }

      return { onSite, telework, absent };
    } catch (error) {
      console.error('Erreur lors de la récupération des présences:', error);
      throw error;
    }
  }

  /**
   * Labels pour les types de congés
   */
  private getLeaveTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      PAID_LEAVE: 'Congé payé',
      RTT: 'RTT',
      SICK_LEAVE: 'Congé maladie',
      MATERNITY_LEAVE: 'Congé maternité',
      PATERNITY_LEAVE: 'Congé paternité',
      EXCEPTIONAL_LEAVE: 'Congé exceptionnel',
      CONVENTIONAL_LEAVE: 'Congé conventionnel',
      UNPAID_LEAVE: 'Congé sans solde',
      TRAINING: 'Formation',
    };
    return labels[type] || type;
  }

  /**
   * Statistiques pour une date donnée
   */
  async getPresenceStats(date: Date): Promise<{
    totalUsers: number;
    onSiteCount: number;
    teleworkCount: number;
    absentCount: number;
    onSitePercentage: number;
    teleworkPercentage: number;
  }> {
    const presences = await this.getPresencesForDate(date);
    const totalUsers = presences.onSite.length + presences.telework.length + presences.absent.length;

    return {
      totalUsers,
      onSiteCount: presences.onSite.length,
      teleworkCount: presences.telework.length,
      absentCount: presences.absent.length,
      onSitePercentage: totalUsers > 0 ? Math.round((presences.onSite.length / totalUsers) * 100) : 0,
      teleworkPercentage: totalUsers > 0 ? Math.round((presences.telework.length / totalUsers) * 100) : 0,
    };
  }
}

export const presenceService = new PresenceService();
