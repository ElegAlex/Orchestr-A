# 🛠️ GUIDE DE DÉVELOPPEMENT - ORCHESTR'A V2

Guide complet pour développer les modules manquants et continuer le projet.

---

## 📋 TABLE DES MATIÈRES

1. [Architecture du projet](#architecture-du-projet)
2. [Modules développés](#modules-développés)
3. [Pattern de développement](#pattern-de-développement)
4. [Créer un nouveau module](#créer-un-nouveau-module)
5. [Modules à développer](#modules-à-développer)
6. [Frontend - Guide](#frontend-guide)
7. [Tests](#tests)
8. [Déploiement](#déploiement)

---

## 🏗️ ARCHITECTURE DU PROJET

### Structure Backend (NestJS)

```
apps/api/src/
├── main.ts                    ✅ Configuration Fastify + Swagger
├── app.module.ts              ✅ Module principal
├── app.controller.ts          ✅ Health check
├── app.service.ts             ✅ Service principal
├── prisma/
│   ├── prisma.module.ts       ✅ Module Prisma global
│   └── prisma.service.ts      ✅ Service Prisma avec connexion DB
├── auth/                      ✅ MODULE COMPLET
│   ├── auth.module.ts
│   ├── auth.controller.ts     (4 endpoints)
│   ├── auth.service.ts        (login, register, profile)
│   ├── dto/
│   │   ├── login.dto.ts
│   │   └── register.dto.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   └── local.strategy.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   └── decorators/
│       ├── current-user.decorator.ts
│       ├── roles.decorator.ts
│       └── public.decorator.ts
└── users/                     ✅ MODULE COMPLET
    ├── users.module.ts
    ├── users.controller.ts    (11 endpoints)
    ├── users.service.ts       (CRUD + gestion rôles + passwords)
    └── dto/
        ├── create-user.dto.ts
        ├── update-user.dto.ts
        └── change-password.dto.ts
```

### Modules développés ✅

| Module | Statut | Endpoints | Fonctionnalités |
|--------|--------|-----------|-----------------|
| **Auth** | ✅ Complet | 4 | Login, Register, Profile, Me |
| **Users** | ✅ Complet | 11 | CRUD, Roles, Passwords, Filtres |

### Modules à développer 📝

| Module | Priority | Endpoints estimés | Complexité |
|--------|----------|-------------------|------------|
| **Projects** | 🔴 Haute | ~10 | Moyenne |
| **Tasks** | 🔴 Haute | ~12 | Haute (dépendances, RACI) |
| **Departments** | 🟡 Moyenne | ~5 | Faible |
| **Services** | 🟡 Moyenne | ~5 | Faible |
| **Leaves** | 🔴 Haute | ~8 | Moyenne (calculs jours ouvrés) |
| **Telework** | 🔴 Haute | ~6 | Moyenne |
| **Skills** | 🟡 Moyenne | ~8 | Moyenne |
| **Epics** | 🟢 Basse | ~5 | Faible |
| **Milestones** | 🟢 Basse | ~5 | Faible |
| **TimeTracking** | 🟡 Moyenne | ~7 | Moyenne |
| **Documents** | 🟢 Basse | ~5 | Faible |
| **Comments** | 🟢 Basse | ~5 | Faible |

---

## 🎯 PATTERN DE DÉVELOPPEMENT

Tous les modules suivent le **même pattern architectural** que les modules Auth et Users.

### Structure d'un module type

```
<module>/
├── <module>.module.ts         # Configuration module
├── <module>.controller.ts     # Endpoints API REST
├── <module>.service.ts        # Logique métier
├── dto/
│   ├── create-<module>.dto.ts # Validation création
│   ├── update-<module>.dto.ts # Validation mise à jour
│   └── ...autres-dto.ts       # DTOs spécifiques
├── entities/                  # (optionnel) Classes métier
└── interfaces/                # (optionnel) Interfaces TypeScript
```

### Checklist pour chaque module

- [ ] **1. Créer le dossier** : `mkdir -p src/<module>/dto`
- [ ] **2. DTOs** : Créer les DTOs avec validation
- [ ] **3. Service** : Logique métier avec Prisma
- [ ] **4. Controller** : Endpoints avec Swagger
- [ ] **5. Module** : Lier service + controller
- [ ] **6. AppModule** : Importer le module
- [ ] **7. Guards** : Ajouter authentification/rôles si nécessaire
- [ ] **8. Tests** : Tests unitaires du service
- [ ] **9. Documentation** : Compléter le Swagger

---

## 🆕 CRÉER UN NOUVEAU MODULE

### Exemple : Module Projects

#### 1. Créer la structure

```bash
cd apps/api/src
mkdir -p projects/dto
```

#### 2. DTOs

**`projects/dto/create-project.dto.ts`**

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsDateString, IsInt, Min } from 'class-validator';
import { ProjectStatus, Priority } from 'database';

export class CreateProjectDto {
  @ApiProperty({ description: 'Nom du projet' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ProjectStatus, default: ProjectStatus.DRAFT })
  @IsEnum(ProjectStatus)
  status: ProjectStatus;

  @ApiProperty({ enum: Priority, default: Priority.NORMAL })
  @IsEnum(Priority)
  priority: Priority;

  @ApiProperty({ description: 'Date de début', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: 'Date de fin', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ description: 'Budget en heures', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  budgetHours?: number;
}
```

**`projects/dto/update-project.dto.ts`**

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateProjectDto } from './create-project.dto';

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
```

#### 3. Service

**`projects/projects.service.ts`**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createProjectDto: CreateProjectDto) {
    return this.prisma.project.create({
      data: createProjectDto,
    });
  }

  async findAll() {
    return this.prisma.project.findMany({
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        epics: true,
        milestones: true,
        tasks: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }

    return project;
  }

  async update(id: string, updateProjectDto: UpdateProjectDto) {
    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }

    return this.prisma.project.update({
      where: { id },
      data: updateProjectDto,
    });
  }

  async remove(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }

    await this.prisma.project.delete({
      where: { id },
    });

    return { message: 'Projet supprimé avec succès' };
  }
}
```

#### 4. Controller

**`projects/projects.controller.ts`**

```typescript
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from 'database';

@ApiTags('projects')
@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @ApiOperation({ summary: 'Créer un nouveau projet' })
  create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(createProjectDto);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer tous les projets' })
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un projet par ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.RESPONSABLE, Role.MANAGER)
  @ApiOperation({ summary: 'Mettre à jour un projet' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, updateProjectDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Supprimer un projet' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.projectsService.remove(id);
  }
}
```

#### 5. Module

**`projects/projects.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
```

#### 6. Importer dans AppModule

**`app.module.ts`**

```typescript
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [
    ConfigModule.forRoot({ ... }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProjectsModule, // ✨ Ajouter ici
  ],
  ...
})
export class AppModule {}
```

---

## 📦 MODULES À DÉVELOPPER

### 1. Module Projects (HAUTE PRIORITÉ)

**Endpoints à créer :**

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/projects` | Créer un projet |
| GET | `/projects` | Liste des projets (avec filtres) |
| GET | `/projects/:id` | Détails d'un projet |
| PATCH | `/projects/:id` | Mettre à jour un projet |
| DELETE | `/projects/:id` | Supprimer un projet |
| POST | `/projects/:id/members` | Ajouter un membre |
| DELETE | `/projects/:id/members/:userId` | Retirer un membre |
| GET | `/projects/:id/stats` | Statistiques du projet |
| GET | `/projects/:id/tasks` | Tâches du projet |
| GET | `/projects/status/:status` | Projets par statut |

**Fonctionnalités spécifiques :**
- Gestion des membres avec allocation (%)
- Calcul du budget consommé vs prévu
- Statistiques (progression, vélocité)
- Filtres par statut, priorité, manager

### 2. Module Tasks (HAUTE PRIORITÉ)

**Endpoints à créer :**

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/tasks` | Créer une tâche |
| GET | `/tasks` | Liste des tâches |
| GET | `/tasks/:id` | Détails d'une tâche |
| PATCH | `/tasks/:id` | Mettre à jour une tâche |
| DELETE | `/tasks/:id` | Supprimer une tâche |
| POST | `/tasks/:id/dependencies` | Ajouter une dépendance |
| DELETE | `/tasks/:id/dependencies/:depId` | Retirer une dépendance |
| POST | `/tasks/:id/raci` | Définir matrice RACI |
| PATCH | `/tasks/:id/progress` | Mettre à jour la progression |
| GET | `/tasks/user/:userId` | Tâches d'un utilisateur |
| GET | `/tasks/project/:projectId` | Tâches d'un projet |
| GET | `/tasks/status/:status` | Tâches par statut |

**Fonctionnalités spécifiques :**
- Gestion des dépendances (bloque/bloquée par)
- Matrice RACI (Responsible, Accountable, Consulted, Informed)
- Time tracking intégré
- Progression 0-100%
- Checklist d'items

### 3. Module Leaves (HAUTE PRIORITÉ)

**Endpoints à créer :**

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/leaves` | Déclarer un congé |
| GET | `/leaves` | Liste des congés |
| GET | `/leaves/me` | Mes congés |
| GET | `/leaves/:id` | Détails d'un congé |
| DELETE | `/leaves/:id` | Annuler un congé |
| GET | `/leaves/balance/:userId` | Solde de congés |
| GET | `/leaves/calendar/:year/:month` | Calendrier des absences |
| GET | `/leaves/team` | Congés de l'équipe |

**Fonctionnalités spécifiques :**
- Calcul automatique des jours ouvrés
- Gestion des demi-journées (matin/après-midi)
- Débit automatique du solde
- Exclusion des weekends et jours fériés
- Système déclaratif (pas de validation par défaut)

**Algorithme calcul jours ouvrés :**

```typescript
// Exemple de fonction utilitaire
import { eachDayOfInterval, isWeekend, format } from 'date-fns';

function calculateWorkingDays(
  startDate: Date,
  endDate: Date,
  holidays: Date[],
  halfDay?: 'MORNING' | 'AFTERNOON'
): number {
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  let workingDays = days.filter(day => {
    if (isWeekend(day)) return false;
    const isHoliday = holidays.some(holiday =>
      format(holiday, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
    );
    return !isHoliday;
  }).length;

  if (halfDay) {
    workingDays -= 0.5;
  }

  return workingDays;
}
```

### 4. Module Telework (HAUTE PRIORITÉ)

**Endpoints à créer :**

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/telework/schedule` | Définir planning récurrent |
| GET | `/telework/schedule/:userId` | Planning d'un utilisateur |
| POST | `/telework/exception` | Ajouter une exception |
| DELETE | `/telework/exception/:id` | Supprimer une exception |
| GET | `/telework/calendar/:year/:month` | Calendrier télétravail |
| GET | `/telework/team/today` | Qui est où aujourd'hui |

**Fonctionnalités spécifiques :**
- Planning hebdomadaire récurrent
- Exceptions ponctuelles (jour spécifique)
- Vue "qui est où" (présence bureau/télétravail)
- Limite max jours/semaine (configurable)

### 5. Module Skills

**Endpoints à créer :**

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/skills` | Créer une compétence |
| GET | `/skills` | Liste des compétences |
| POST | `/skills/user/:userId` | Affecter compétence à user |
| DELETE | `/skills/user/:userId/:skillId` | Retirer compétence |
| GET | `/skills/matrix/:departmentId` | Matrice de compétences |
| GET | `/skills/gaps/:projectId` | Skill gaps d'un projet |

### 6. Modules simples (PRIORITÉ BASSE)

**Departments, Services, Epics, Milestones, Documents, Comments**

Suivre le même pattern que Projects avec CRUD simple.

---

## 🎨 FRONTEND GUIDE

### Stack Frontend

- Next.js 15.5 (App Router)
- React 19.1
- TypeScript 5.7
- Tailwind CSS 4
- TanStack Query 5 (gestion état serveur)
- Zustand 5 (gestion état client)

### Structure recommandée

```
apps/web/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Layout avec sidebar
│   │   ├── dashboard/page.tsx
│   │   ├── projects/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── tasks/page.tsx
│   │   ├── users/page.tsx
│   │   └── ...
│   └── layout.tsx
├── components/
│   ├── ui/                         # shadcn/ui components
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── Navigation.tsx
│   ├── projects/
│   │   ├── ProjectCard.tsx
│   │   ├── ProjectForm.tsx
│   │   └── ProjectKanban.tsx
│   └── ...
├── lib/
│   ├── api/
│   │   ├── client.ts              # Axios/Fetch config
│   │   ├── auth.ts
│   │   ├── projects.ts
│   │   └── ...
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useProjects.ts
│   │   └── ...
│   └── utils/
└── stores/
    ├── auth.store.ts
    └── ui.store.ts
```

### Exemple API Client

**`lib/api/client.ts`**

```typescript
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token JWT
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercepteur pour gérer les erreurs
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

**`lib/api/auth.ts`**

```typescript
import { apiClient } from './client';

export interface LoginRequest {
  login: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    login: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

export const authApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login', data);
    return response.data;
  },

  getProfile: async () => {
    const response = await apiClient.get('/auth/profile');
    return response.data;
  },

  register: async (data: any) => {
    const response = await apiClient.post('/auth/register', data);
    return response.data;
  },
};
```

### Exemple avec TanStack Query

**`hooks/useAuth.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, type LoginRequest } from '@/lib/api/auth';
import { useRouter } from 'next/navigation';

export function useLogin() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
    onSuccess: (data) => {
      localStorage.setItem('access_token', data.access_token);
      queryClient.setQueryData(['user'], data.user);
      router.push('/dashboard');
    },
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ['user'],
    queryFn: () => authApi.getProfile(),
    retry: false,
  });
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return () => {
    localStorage.removeItem('access_token');
    queryClient.clear();
    router.push('/login');
  };
}
```

### Page de Login

**`app/(auth)/login/page.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useLogin } from '@/lib/hooks/useAuth';

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const loginMutation = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ login, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <h2 className="text-3xl font-bold text-center">ORCHESTR'A V2</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Login
            </label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loginMutation.isPending ? 'Connexion...' : 'Se connecter'}
          </button>

          {loginMutation.isError && (
            <p className="text-red-600 text-sm text-center">
              Erreur de connexion
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
```

---

## 🧪 TESTS

### Tests Backend (Vitest)

**Exemple de test pour UsersService**

```typescript
import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [UsersService, PrismaService],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    it('should create a user', async () => {
      const createDto = {
        email: 'test@test.com',
        login: 'test',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        role: 'CONTRIBUTEUR',
      };

      const result = await service.create(createDto);

      expect(result).toHaveProperty('id');
      expect(result.email).toBe(createDto.email);
    });

    it('should throw ConflictException if email exists', async () => {
      // Test...
    });
  });
});
```

---

## 🚀 DÉPLOIEMENT

### 1. Build

```bash
# Build tous les projets
pnpm run build

# Build API seulement
cd apps/api && pnpm run build

# Build Web seulement
cd apps/web && pnpm run build
```

### 2. Docker Production

```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Démarrer
docker-compose -f docker-compose.prod.yml up -d
```

### 3. Migrations en production

```bash
pnpm run db:migrate:deploy
```

---

## 📝 CHECKLIST AVANT MISE EN PRODUCTION

- [ ] Tous les tests passent
- [ ] Variables d'environnement de production configurées
- [ ] JWT_SECRET changé (min 32 caractères)
- [ ] Mots de passe admin changés
- [ ] HTTPS configuré
- [ ] CORS configuré avec domaines autorisés
- [ ] Rate limiting activé
- [ ] Logs configurés
- [ ] Backup automatique configuré
- [ ] Monitoring (Sentry, Grafana) configuré
- [ ] Documentation API à jour

---

**Pour toute question, consultez :**
- [README.md](./README.md)
- [STACK-TECHNIQUE.md](./STACK-TECHNIQUE.md)
- [REFONTE.md](./REFONTE.md)
