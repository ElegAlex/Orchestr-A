import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import {
  User,
  UserSkill,
  Leave,
  ResourceAllocation,
  WorkloadSnapshot,
  WorkloadCalculation,
  WorkloadAlert,
  WorkingHours,
  ProductivityProfile,
  UserPreferences
} from '../../types';
import { resourceService } from '../../services/resource.service';

interface ResourceState {
  // Utilisateurs et profils
  users: User[];
  selectedUser: User | null;
  
  // Compétences
  userSkills: { [userId: string]: UserSkill[] };
  skillsLoading: boolean;
  
  // Congés
  leaves: Leave[];
  leavesLoading: boolean;
  
  // Affectations
  allocations: ResourceAllocation[];
  allocationsLoading: boolean;
  
  // Calculs de charge
  workloads: { [userId: string]: WorkloadCalculation };
  workloadSnapshots: { [userId: string]: WorkloadSnapshot[] };
  workloadLoading: boolean;
  
  // Analyse d'équipe
  teamAnalysis: {
    teamMetrics: any | null;
    individualAnalyses: any[];
    teamOptimizations: any[];
  };
  teamAnalysisLoading: boolean;
  
  // Optimisations individuelles
  optimizations: { [userId: string]: any[] };
  optimizationsLoading: boolean;
  
  // Alertes et suggestions
  alerts: WorkloadAlert[];
  suggestions: { [userId: string]: any[] };
  
  // État général
  loading: boolean;
  error: string | null;
  
  // Filtres et vues
  filters: {
    department?: string;
    role?: string;
    availability?: 'available' | 'overloaded' | 'all';
    skillCategory?: string;
  };
  viewMode: 'list' | 'grid' | 'chart';
}

const initialState: ResourceState = {
  users: [],
  selectedUser: null,
  userSkills: {},
  skillsLoading: false,
  leaves: [],
  leavesLoading: false,
  allocations: [],
  allocationsLoading: false,
  workloads: {},
  workloadSnapshots: {},
  workloadLoading: false,
  teamAnalysis: {
    teamMetrics: null,
    individualAnalyses: [],
    teamOptimizations: []
  },
  teamAnalysisLoading: false,
  optimizations: {},
  optimizationsLoading: false,
  alerts: [],
  suggestions: {},
  loading: false,
  error: null,
  filters: {},
  viewMode: 'list'
};

// =============================================================================
// ASYNC THUNKS
// =============================================================================

// Charger tous les utilisateurs avec profils
export const fetchUsers = createAsyncThunk(
  'resources/fetchUsers',
  async () => {
    return await resourceService.getAllUsersWithProfiles();
  }
);

// Charger les compétences d'un utilisateur
export const fetchUserSkills = createAsyncThunk(
  'resources/fetchUserSkills',
  async (userId: string) => {
    const skills = await resourceService.getUserSkills(userId);
    return { userId, skills };
  }
);

// Charger les compétences de tous les utilisateurs
export const fetchAllUsersSkills = createAsyncThunk(
  'resources/fetchAllUsersSkills',
  async (userIds: string[]) => {
    const allSkills = await Promise.all(
      userIds.map(async (userId) => {
        try {
          const skills = await resourceService.getUserSkills(userId);
          return { userId, skills };
        } catch (error) {
          console.warn(`Erreur lors du chargement des compétences pour l'utilisateur ${userId}:`, error);
          return { userId, skills: [] };
        }
      })
    );
    return allSkills;
  }
);

// Ajouter une compétence
export const addUserSkill = createAsyncThunk(
  'resources/addUserSkill',
  async ({ userId, skill }: { userId: string; skill: Omit<UserSkill, 'id' | 'createdAt' | 'updatedAt'> }) => {
    const newSkill = await resourceService.addUserSkill(userId, skill);
    return { userId, skill: newSkill };
  }
);

// Mettre à jour une compétence
export const updateUserSkill = createAsyncThunk(
  'resources/updateUserSkill',
  async ({ userId, skillId, updates }: { userId: string; skillId: string; updates: Partial<UserSkill> }) => {
    await resourceService.updateUserSkill(userId, skillId, updates);
    return { userId, skillId, updates };
  }
);

// Supprimer une compétence
export const deleteUserSkill = createAsyncThunk(
  'resources/deleteUserSkill',
  async ({ userId, skillId }: { userId: string; skillId: string }) => {
    await resourceService.deleteUserSkill(userId, skillId);
    return { userId, skillId };
  }
);

// Créer un congé
export const createLeave = createAsyncThunk(
  'resources/createLeave',
  async (leave: Omit<Leave, 'id' | 'createdAt' | 'updatedAt'>) => {
    return await resourceService.createLeave(leave);
  }
);

// Approuver un congé
export const approveLeave = createAsyncThunk(
  'resources/approveLeave',
  async ({ leaveId, approvedBy }: { leaveId: string; approvedBy: string }) => {
    await resourceService.approveLeave(leaveId, approvedBy);
    return { leaveId, approvedBy };
  }
);

// Charger les congés d'un utilisateur
export const fetchUserLeaves = createAsyncThunk(
  'resources/fetchUserLeaves',
  async ({ userId, status }: { userId: string; status?: Leave['status'] }) => {
    const leaves = await resourceService.getUserLeaves(userId, status);
    return { userId, leaves };
  }
);

// Calculer la charge d'un utilisateur
export const calculateUserWorkload = createAsyncThunk(
  'resources/calculateUserWorkload',
  async ({ userId, startDate, endDate }: { userId: string; startDate: Date; endDate: Date }) => {
    return await resourceService.calculateUserWorkload(userId, startDate, endDate);
  }
);

// Créer une affectation
export const createAllocation = createAsyncThunk(
  'resources/createAllocation',
  async (allocation: Omit<ResourceAllocation, 'id' | 'createdAt' | 'updatedAt'>) => {
    return await resourceService.createAllocation(allocation);
  }
);

// Confirmer une affectation
export const confirmAllocation = createAsyncThunk(
  'resources/confirmAllocation',
  async (allocationId: string) => {
    await resourceService.confirmAllocation(allocationId);
    return allocationId;
  }
);

// Suggestions d'affectation
export const suggestResourceAllocation = createAsyncThunk(
  'resources/suggestResourceAllocation',
  async (taskRequirements: {
    requiredSkills: string[];
    estimatedHours: number;
    startDate: Date;
    endDate: Date;
  }) => {
    return await resourceService.suggestResourceAllocation(taskRequirements);
  }
);

// Analyser la charge d'équipe
export const analyzeTeamWorkload = createAsyncThunk(
  'resources/analyzeTeamWorkload',
  async ({ userIds, startDate, endDate }: {
    userIds: string[];
    startDate: Date;
    endDate: Date;
  }) => {
    return await resourceService.analyzeTeamWorkload(userIds, startDate, endDate);
  }
);

// Obtenir les optimisations de charge
export const getWorkloadOptimizations = createAsyncThunk(
  'resources/getWorkloadOptimizations',
  async ({ userId, startDate, endDate }: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }) => {
    return await resourceService.getWorkloadOptimizations(userId, startDate, endDate);
  }
);

// Mettre à jour le profil de travail d'un utilisateur
export const updateUserWorkingProfile = createAsyncThunk(
  'resources/updateUserWorkingProfile',
  async ({ userId, profile }: {
    userId: string;
    profile: {
      workingHours?: WorkingHours;
      productivity?: ProductivityProfile;
      preferences?: UserPreferences;
    }
  }) => {
    await resourceService.updateUserWorkingProfile(userId, profile);
    return { userId, profile };
  }
);

// =============================================================================
// SLICE
// =============================================================================

const resourceSlice = createSlice({
  name: 'resources',
  initialState,
  reducers: {
    // Actions synchrones
    setSelectedUser: (state, action: PayloadAction<User | null>) => {
      state.selectedUser = action.payload;
    },
    
    setFilters: (state, action: PayloadAction<ResourceState['filters']>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    
    setViewMode: (state, action: PayloadAction<ResourceState['viewMode']>) => {
      state.viewMode = action.payload;
    },
    
    clearError: (state) => {
      state.error = null;
    },
    
    addAlert: (state, action: PayloadAction<WorkloadAlert>) => {
      state.alerts.push(action.payload);
    },
    
    removeAlert: (state, action: PayloadAction<string>) => {
      state.alerts = state.alerts.filter(alert => alert.id !== action.payload);
    },
    
    resolveAlert: (state, action: PayloadAction<string>) => {
      const alert = state.alerts.find(alert => alert.id === action.payload);
      if (alert) {
        alert.resolvedAt = new Date();
      }
    },
    
    updateWorkloadSnapshot: (state, action: PayloadAction<{ userId: string; snapshots: WorkloadSnapshot[] }>) => {
      state.workloadSnapshots[action.payload.userId] = action.payload.snapshots;
    },
    
    // Real-time updates
    updateUserWorkload: (state, action: PayloadAction<WorkloadCalculation>) => {
      state.workloads[action.payload.userId] = action.payload;
    },
    
    // Optimisation UI
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    
    setSkillsLoading: (state, action: PayloadAction<boolean>) => {
      state.skillsLoading = action.payload;
    },

    // Anciennes actions pour compatibilité
    setResources: (state, action: PayloadAction<User[]>) => {
      state.users = action.payload;
    },
    setAllocations: (state, action: PayloadAction<ResourceAllocation[]>) => {
      state.allocations = action.payload;
    },
    addAllocation: (state, action: PayloadAction<ResourceAllocation>) => {
      state.allocations.push(action.payload);
    },
    updateAllocation: (state, action: PayloadAction<ResourceAllocation>) => {
      const index = state.allocations.findIndex(a => a.id === action.payload.id);
      if (index !== -1) {
        state.allocations[index] = action.payload;
      }
    },
    deleteAllocation: (state, action: PayloadAction<string>) => {
      state.allocations = state.allocations.filter(a => a.id !== action.payload);
    },
    setLeaves: (state, action: PayloadAction<Leave[]>) => {
      state.leaves = action.payload;
    },
    addLeave: (state, action: PayloadAction<Leave>) => {
      state.leaves.push(action.payload);
    },
    updateLeave: (state, action: PayloadAction<Leave>) => {
      const index = state.leaves.findIndex(l => l.id === action.payload.id);
      if (index !== -1) {
        state.leaves[index] = action.payload;
      }
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
  
  extraReducers: (builder) => {
    // Users
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload;
        state.error = null;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Erreur lors du chargement des utilisateurs';
      });

    // Skills
    builder
      .addCase(fetchUserSkills.pending, (state) => {
        state.skillsLoading = true;
      })
      .addCase(fetchUserSkills.fulfilled, (state, action) => {
        state.skillsLoading = false;
        state.userSkills[action.payload.userId] = action.payload.skills;
      })
      .addCase(fetchUserSkills.rejected, (state, action) => {
        state.skillsLoading = false;
        state.error = action.error.message || 'Erreur lors du chargement des compétences';
      })
      
      .addCase(addUserSkill.fulfilled, (state, action) => {
        const { userId, skill } = action.payload;
        if (!state.userSkills[userId]) {
          state.userSkills[userId] = [];
        }
        state.userSkills[userId].push(skill);
      })
      
      .addCase(updateUserSkill.fulfilled, (state, action) => {
        const { userId, skillId, updates } = action.payload;
        const userSkills = state.userSkills[userId];
        if (userSkills) {
          const skillIndex = userSkills.findIndex(skill => skill.id === skillId);
          if (skillIndex !== -1) {
            userSkills[skillIndex] = { ...userSkills[skillIndex], ...updates };
          }
        }
      })
      
      .addCase(deleteUserSkill.fulfilled, (state, action) => {
        const { userId, skillId } = action.payload;
        const userSkills = state.userSkills[userId];
        if (userSkills) {
          state.userSkills[userId] = userSkills.filter(skill => skill.id !== skillId);
        }
      })

      .addCase(fetchAllUsersSkills.pending, (state) => {
        state.skillsLoading = true;
      })
      .addCase(fetchAllUsersSkills.fulfilled, (state, action) => {
        state.skillsLoading = false;
        action.payload.forEach(({ userId, skills }) => {
          state.userSkills[userId] = skills;
        });
      })
      .addCase(fetchAllUsersSkills.rejected, (state, action) => {
        state.skillsLoading = false;
        state.error = action.error.message || 'Erreur lors du chargement des compétences';
      });

    // Leaves
    builder
      .addCase(fetchUserLeaves.pending, (state) => {
        state.leavesLoading = true;
      })
      .addCase(fetchUserLeaves.fulfilled, (state, action) => {
        state.leavesLoading = false;
        // Merger les congés de l'utilisateur avec les congés existants
        const { userId, leaves } = action.payload;
        const existingLeaves = state.leaves.filter(leave => leave.userId !== userId);
        state.leaves = [...existingLeaves, ...leaves];
      })
      .addCase(fetchUserLeaves.rejected, (state, action) => {
        state.leavesLoading = false;
        state.error = action.error.message || 'Erreur lors du chargement des congés';
      })
      
      .addCase(createLeave.fulfilled, (state, action) => {
        state.leaves.push(action.payload);
      })
      
      .addCase(approveLeave.fulfilled, (state, action) => {
        const { leaveId, approvedBy } = action.payload;
        const leave = state.leaves.find(l => l.id === leaveId);
        if (leave) {
          leave.status = 'approved';
          leave.approvedBy = approvedBy;
          leave.approvedAt = new Date();
        }
      });

    // Workload
    builder
      .addCase(calculateUserWorkload.pending, (state) => {
        state.workloadLoading = true;
      })
      .addCase(calculateUserWorkload.fulfilled, (state, action) => {
        state.workloadLoading = false;
        state.workloads[action.payload.userId] = action.payload;
        
        // Ajouter les alertes
        if (action.payload.alerts.length > 0) {
          action.payload.alerts.forEach(alert => {
            const existingAlert = state.alerts.find(a => a.id === alert.id);
            if (!existingAlert) {
              state.alerts.push(alert);
            }
          });
        }
      })
      .addCase(calculateUserWorkload.rejected, (state, action) => {
        state.workloadLoading = false;
        state.error = action.error.message || 'Erreur lors du calcul de charge';
      });

    // Allocations
    builder
      .addCase(createAllocation.pending, (state) => {
        state.allocationsLoading = true;
      })
      .addCase(createAllocation.fulfilled, (state, action) => {
        state.allocationsLoading = false;
        state.allocations.push(action.payload);
      })
      .addCase(createAllocation.rejected, (state, action) => {
        state.allocationsLoading = false;
        state.error = action.error.message || 'Erreur lors de la création de l\'affectation';
      })
      
      .addCase(confirmAllocation.fulfilled, (state, action) => {
        const allocation = state.allocations.find(a => a.id === action.payload);
        if (allocation) {
          allocation.status = 'confirmed';
        }
      });

    // Suggestions
    builder
      .addCase(suggestResourceAllocation.fulfilled, (state, action) => {
        // Stocker les suggestions dans l'état global pour réutilisation
        state.suggestions['latest'] = action.payload;
      });

    // Profile updates
    builder
      .addCase(updateUserWorkingProfile.fulfilled, (state, action) => {
        const { userId, profile } = action.payload;
        const user = state.users.find(u => u.id === userId);
        if (user) {
          Object.assign(user, profile);
        }
        
        if (state.selectedUser && state.selectedUser.id === userId) {
          Object.assign(state.selectedUser, profile);
        }
      });

    // Team analysis
    builder
      .addCase(analyzeTeamWorkload.pending, (state) => {
        state.teamAnalysisLoading = true;
      })
      .addCase(analyzeTeamWorkload.fulfilled, (state, action) => {
        state.teamAnalysisLoading = false;
        state.teamAnalysis = action.payload;
      })
      .addCase(analyzeTeamWorkload.rejected, (state, action) => {
        state.teamAnalysisLoading = false;
        state.error = action.error.message || 'Erreur lors de l\'analyse d\'équipe';
      });

    // Optimizations
    builder
      .addCase(getWorkloadOptimizations.pending, (state) => {
        state.optimizationsLoading = true;
      })
      .addCase(getWorkloadOptimizations.fulfilled, (state, action) => {
        state.optimizationsLoading = false;
        // L'action payload contient les optimizations pour un userId spécifique
        // Nous devrons passer le userId dans le meta ou ajuster la structure
        state.optimizations['latest'] = action.payload;
      })
      .addCase(getWorkloadOptimizations.rejected, (state, action) => {
        state.optimizationsLoading = false;
        state.error = action.error.message || 'Erreur lors du calcul des optimisations';
      });
  },
});

export const {
  setSelectedUser,
  setFilters,
  setViewMode,
  clearError,
  addAlert,
  removeAlert,
  resolveAlert,
  updateWorkloadSnapshot,
  updateUserWorkload,
  setLoading,
  setSkillsLoading,
  // Anciennes actions
  setResources,
  setAllocations,
  addAllocation,
  updateAllocation,
  deleteAllocation,
  setLeaves,
  addLeave,
  updateLeave,
  setError,
} = resourceSlice.actions;


export default resourceSlice.reducer;