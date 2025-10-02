# Structure Firestore - Module Ressources

## Collections principales

### `users` (étendu)
```typescript
{
  id: string,
  email: string,
  displayName: string,
  firstName: string,
  lastName: string,
  role: 'admin' | 'project_manager' | 'contributor' | 'viewer',
  avatarUrl?: string,
  department?: string,
  isActive: boolean,
  
  // NOUVELLES PROPRIÉTÉS RESSOURCES
  workingHours: {
    weeklyHours: number, // 35h, 39h, etc.
    dailyHours: number,  // 7h, 8h, etc.
    workingDays: string[], // ['monday', 'tuesday', ...]
  },
  productivity: {
    rate: number, // 0.8 = 80% productif
    lastUpdated: Timestamp,
  },
  preferences: {
    remoteWorkDays?: string[],
    maxProjectsParallel: number,
    notificationFrequency: 'realtime' | 'daily' | 'weekly',
  },
  
  createdAt: Timestamp,
  lastLoginAt: Timestamp,
  updatedAt: Timestamp,
}
```

### `user_skills` (sous-collection de users)
```typescript
users/{userId}/skills/{skillId}
{
  id: string,
  name: string,
  category: 'technical' | 'methodological' | 'domain' | 'soft',
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert',
  yearsExperience: number,
  lastUsed?: Timestamp,
  certifications?: string[],
  projects?: string[], // IDs des projets où utilisé
  selfAssessed: boolean,
  managerValidated: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

### `user_leaves` (congés/absences)
```typescript
leaves/{leaveId}
{
  id: string,
  userId: string,
  type: 'vacation' | 'sick' | 'training' | 'other',
  status: 'pending' | 'approved' | 'rejected',
  startDate: Timestamp,
  endDate: Timestamp,
  workingDaysCount: number, // calculé
  reason?: string,
  approvedBy?: string,
  approvedAt?: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

### `resource_allocations` (affectations)
```typescript
allocations/{allocationId}
{
  id: string,
  userId: string,
  projectId: string,
  taskId?: string,
  allocationPercentage: number, // 50% = 0.5
  startDate: Timestamp,
  endDate: Timestamp,
  status: 'tentative' | 'confirmed' | 'completed',
  estimatedHours: number,
  actualHours?: number,
  requiredSkills: string[], // skill IDs
  createdBy: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

### `workload_snapshots` (cache calculs)
```typescript
workloads/{userId}_{weekStart}
{
  userId: string,
  weekStart: Timestamp, // Lundi de la semaine
  weekEnd: Timestamp,
  
  capacity: {
    theoretical: number, // heures théoriques
    net: number,        // après déductions
    available: number,  // restant disponible
  },
  
  allocated: {
    confirmed: number,
    tentative: number,
    total: number,
  },
  
  deductions: {
    leaves: number,
    training: number,
    meetings: number,
    other: number,
  },
  
  overloadRisk: 'none' | 'low' | 'medium' | 'high' | 'critical',
  
  calculatedAt: Timestamp,
  validUntil: Timestamp, // cache expiry
}
```