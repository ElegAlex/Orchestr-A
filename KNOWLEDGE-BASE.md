# KNOWLEDGE BASE — ORCHESTR'A V2

> Document de référence pour le projet ORCHESTR'A V2 - Généré automatiquement le 2026-02-04

---

## 1. Vue d'ensemble

**Type de projet** : Monorepo Turborepo avec pnpm workspaces

**Description** : Application de gestion de projets et de ressources humaines pour collectivités territoriales (mairies, communautés de communes, etc.)

**Fonctionnalités principales** :

- Gestion de projets avec Kanban drag-and-drop, Gantt, jalons et épopées
- Planning unifié (vue semaine/mois) intégrant télétravail, congés et tâches
- Gestion RH : congés, télétravail, compétences, charge de travail
- Suivi du temps (time tracking) et rapports analytiques
- Système RBAC avec 6 rôles distincts

**Version** : 2.0.0
**Licence** : MIT
**Auteur** : Alexandre BERGE

---

## 2. Stack technique

### Runtime & Build

| Composant  | Version       | Usage                   |
| ---------- | ------------- | ----------------------- |
| Node.js    | >= 22.0.0 LTS | Runtime JavaScript      |
| pnpm       | 9.15.9        | Gestionnaire de paquets |
| Turborepo  | 2.3.3         | Orchestration monorepo  |
| TypeScript | 5.7.x         | Typage statique         |

### Backend (apps/api)

| Composant         | Version | Usage                                       |
| ----------------- | ------- | ------------------------------------------- |
| NestJS            | 11.1.10 | Framework backend                           |
| Fastify           | 5.x     | Serveur HTTP (via @nestjs/platform-fastify) |
| Prisma            | 6.19.1  | ORM & migrations                            |
| Passport.js       | 0.7.0   | Authentification                            |
| JWT (@nestjs/jwt) | 11.0.2  | Tokens d'authentification                   |
| bcrypt            | 5.1.1   | Hachage mots de passe (12 rounds)           |
| class-validator   | 0.14.3  | Validation DTO                              |
| class-transformer | 0.5.1   | Transformation des objets                   |
| Helmet            | 8.0.0   | Headers de sécurité                         |
| Swagger           | 11.2.3  | Documentation API                           |
| date-fns          | 3.6.0   | Manipulation des dates                      |
| Vitest            | 4.0.9   | Tests unitaires                             |
| Supertest         | 7.0.0   | Tests d'intégration                         |

### Frontend (apps/web)

| Composant                    | Version       | Usage                        |
| ---------------------------- | ------------- | ---------------------------- |
| Next.js                      | 16.1.1        | Framework React (App Router) |
| React                        | 19.2.3        | Bibliothèque UI              |
| Tailwind CSS                 | 4.x           | Styling utilitaire           |
| TanStack Query               | 5.90.6        | Gestion état serveur         |
| Zustand                      | 5.0.8         | Gestion état client          |
| Axios                        | 1.13.2        | Client HTTP                  |
| React Hook Form              | 7.66.0        | Gestion formulaires          |
| Zod                          | 4.1.12        | Validation schémas           |
| Radix UI                     | Latest        | Composants accessibles       |
| Lucide React                 | 0.552.0       | Icônes                       |
| Recharts                     | 3.3.0         | Graphiques                   |
| @rsagiev/gantt-task-react-19 | 0.3.9         | Diagramme de Gantt           |
| react-hot-toast              | 2.6.0         | Notifications                |
| jspdf + jspdf-autotable      | 3.0.3 / 5.0.2 | Export PDF                   |
| xlsx                         | 0.18.5        | Export Excel                 |
| Jest                         | 30.0.0        | Tests unitaires              |
| Playwright                   | 1.56.1        | Tests E2E                    |

### Infrastructure

| Composant      | Version     | Usage                         |
| -------------- | ----------- | ----------------------------- |
| PostgreSQL     | 18-alpine   | Base de données               |
| Redis          | 7.4-alpine  | Cache et sessions             |
| Nginx          | 1.27-alpine | Reverse proxy                 |
| Docker         | 24+         | Containerisation              |
| Docker Compose | v2+         | Orchestration containers      |
| Certbot        | Latest      | Certificats SSL Let's Encrypt |

### Qualité & CI/CD

| Composant      | Version | Usage              |
| -------------- | ------- | ------------------ |
| ESLint         | 9.x     | Linting            |
| Prettier       | 3.4.2   | Formatting         |
| Husky          | 9.1.7   | Git hooks          |
| lint-staged    | 15.2.11 | Lint staged files  |
| GitHub Actions | -       | CI/CD              |
| Codecov        | -       | Couverture de code |

---

## 3. Architecture

### Structure du monorepo

```
orchestr-a-v2/
├── apps/
│   ├── api/                 # Backend NestJS + Fastify
│   └── web/                 # Frontend Next.js
├── packages/
│   ├── database/            # Prisma schemas & migrations
│   ├── types/               # Types TypeScript partagés
│   ├── ui/                  # Composants UI réutilisables (shadcn/ui)
│   ├── config/              # Configurations partagées
│   └── utils/               # Utilitaires partagés
├── infrastructure/
│   └── docker/              # Scripts Docker (init.sql)
├── nginx/                   # Configuration Nginx
├── scripts/                 # Scripts DevOps
├── e2e/                     # Tests E2E Playwright
├── docker-compose.yml       # Dev environment
├── docker-compose.prod.yml  # Production environment
├── turbo.json               # Turborepo config
└── pnpm-workspace.yaml      # pnpm workspaces
```

### API (apps/api)

**Pattern** : Architecture modulaire NestJS avec séparation Controller/Service/Module

```
apps/api/src/
├── main.ts                    # Bootstrap Fastify + Swagger
├── app.module.ts              # Module racine
├── app.controller.ts          # Health check endpoints
├── prisma/                    # Module Prisma (singleton)
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── auth/                      # Authentification JWT
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/            # Passport strategies (JWT, Local)
│   ├── guards/                # JwtAuthGuard, RolesGuard
│   ├── decorators/            # @CurrentUser, @Roles
│   └── dto/
├── [domain]/                  # Pour chaque domaine métier
│   ├── [domain].module.ts     # Configuration du module
│   ├── [domain].controller.ts # Routes HTTP
│   ├── [domain].service.ts    # Logique métier
│   ├── [domain].*.spec.ts     # Tests unitaires
│   └── dto/                   # Data Transfer Objects
└── __mocks__/                 # Mocks pour tests
```

**Modules métier** (18 modules) :

- `auth` - Authentification et autorisation
- `users` - Gestion des utilisateurs
- `departments` - Départements
- `services` - Services (au sein des départements)
- `projects` - Projets
- `tasks` - Tâches
- `epics` - Épopées (groupes de tâches)
- `milestones` - Jalons
- `leaves` - Congés
- `leave-types` - Types de congés configurables
- `telework` - Télétravail
- `skills` - Compétences
- `time-tracking` - Suivi du temps
- `documents` - Documents
- `comments` - Commentaires
- `analytics` - Analytiques et rapports
- `personal-todos` - To-dos personnels
- `settings` - Paramètres application
- `holidays` - Jours fériés

**Patterns identifiés** :

- **Service Layer Pattern** : Logique métier isolée dans les services
- **DTO Pattern** : Validation entrées avec class-validator
- **Repository Pattern** : Via PrismaService (singleton)
- **Guard Pattern** : Protection des routes (JWT, Roles)
- **Decorator Pattern** : @CurrentUser, @Roles pour injection contextuelle

### Frontend (apps/web)

**Pattern** : Next.js App Router avec séparation pages/composants/services

```
apps/web/
├── app/                       # Next.js App Router
│   ├── layout.tsx             # Layout racine (AuthProvider, Toaster)
│   ├── page.tsx               # Page d'accueil (redirect)
│   ├── globals.css            # Styles globaux Tailwind
│   ├── login/page.tsx         # Page de connexion
│   ├── register/page.tsx      # Page d'inscription
│   ├── dashboard/page.tsx     # Tableau de bord
│   ├── projects/              # Gestion projets
│   │   ├── page.tsx           # Liste des projets
│   │   └── [id]/page.tsx      # Détail projet
│   ├── tasks/                 # Gestion tâches
│   │   ├── page.tsx           # Liste/Kanban
│   │   └── [id]/page.tsx      # Détail tâche
│   ├── planning/page.tsx      # Vue planning équipe
│   ├── leaves/page.tsx        # Gestion congés
│   ├── telework/page.tsx      # Gestion télétravail
│   ├── skills/page.tsx        # Matrice compétences
│   ├── time-tracking/page.tsx # Suivi temps
│   ├── reports/page.tsx       # Rapports
│   ├── users/page.tsx         # Gestion utilisateurs
│   ├── departments/page.tsx   # Gestion départements
│   ├── settings/page.tsx      # Paramètres
│   └── profile/page.tsx       # Profil utilisateur
├── src/
│   ├── components/            # Composants React
│   │   ├── AuthProvider.tsx   # Context d'authentification
│   │   ├── planning/          # Composants planning
│   │   └── holidays/          # Composants jours fériés
│   ├── services/              # Services API (un par domaine)
│   │   ├── auth.service.ts
│   │   ├── projects.service.ts
│   │   ├── tasks.service.ts
│   │   └── ...
│   ├── stores/                # Zustand stores
│   │   ├── auth.store.ts      # État authentification
│   │   ├── planningView.store.ts
│   │   └── settings.store.ts
│   ├── hooks/                 # Custom hooks
│   │   └── usePlanningData.ts
│   ├── lib/                   # Utilitaires
│   │   ├── api.ts             # Instance Axios configurée
│   │   ├── date-utils.ts
│   │   └── planning-utils.ts
│   ├── types/                 # Types TypeScript
│   │   └── index.ts
│   └── utils/                 # Helpers
│       └── dependencyValidation.ts
└── public/                    # Assets statiques
```

**Patterns identifiés** :

- **Service Layer** : Services API découplés
- **Store Pattern** : Zustand pour état global (auth, settings)
- **Custom Hooks** : Logique réutilisable (usePlanningData)
- **Interceptors** : Axios interceptors pour auth et erreurs
- **Provider Pattern** : AuthProvider pour contexte auth

---

## 4. Modèles de données

### Schéma Prisma (packages/database/prisma/schema.prisma)

#### Entités principales et relations

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    User     │───────│  Department │───────│   Service   │
│             │  N:1  │             │  1:N  │             │
│ - id        │       │ - id        │       │ - id        │
│ - email     │       │ - name      │       │ - name      │
│ - login     │       │ - managerId │       │ - managerId │
│ - role      │       │             │       │             │
└──────┬──────┘       └─────────────┘       └─────────────┘
       │
       │ N:M via ProjectMember
       ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Project   │───────│    Epic     │───────│    Task     │
│             │  1:N  │             │  1:N  │             │
│ - id        │       │ - id        │       │ - id        │
│ - name      │       │ - name      │       │ - title     │
│ - status    │       │ - progress  │       │ - status    │
│ - priority  │       │             │       │ - assigneeId│
└──────┬──────┘       └─────────────┘       └──────┬──────┘
       │                                          │
       │ 1:N                                      │ N:M via TaskAssignee
       ▼                                          ▼
┌─────────────┐                            ┌─────────────┐
│  Milestone  │                            │ TimeEntry   │
│             │                            │             │
│ - id        │                            │ - id        │
│ - dueDate   │                            │ - hours     │
│ - status    │                            │ - date      │
└─────────────┘                            └─────────────┘
```

#### Enums

```typescript
enum Role {
  ADMIN           // Administrateur système
  RESPONSABLE     // Responsable de service/département
  MANAGER         // Chef de projet
  REFERENT_TECHNIQUE  // Référent technique
  CONTRIBUTEUR    // Membre équipe (défaut)
  OBSERVATEUR     // Lecture seule
}

enum ProjectStatus {
  DRAFT, ACTIVE, SUSPENDED, COMPLETED, CANCELLED
}

enum TaskStatus {
  TODO, IN_PROGRESS, IN_REVIEW, DONE, BLOCKED
}

enum Priority {
  LOW, NORMAL, HIGH, CRITICAL
}

enum LeaveStatus {
  PENDING, APPROVED, REJECTED
}

enum LeaveType {
  CP, RTT, SICK_LEAVE, UNPAID, OTHER
}

enum SkillLevel {
  BEGINNER, INTERMEDIATE, EXPERT, MASTER
}

enum SkillCategory {
  TECHNICAL, METHODOLOGY, SOFT_SKILL, BUSINESS
}

enum ActivityType {
  DEVELOPMENT, MEETING, SUPPORT, TRAINING, OTHER
}

enum HolidayType {
  LEGAL, BRIDGE, CLOSURE, CUSTOM
}
```

#### Tables principales

| Table                        | Description          | Champs clés                                                             |
| ---------------------------- | -------------------- | ----------------------------------------------------------------------- |
| `users`                      | Utilisateurs         | id, email, login, passwordHash, role, departmentId                      |
| `departments`                | Départements         | id, name, managerId                                                     |
| `services`                   | Services             | id, name, departmentId, managerId                                       |
| `user_services`              | Liaison User-Service | userId, serviceId                                                       |
| `projects`                   | Projets              | id, name, status, priority, startDate, endDate, budgetHours             |
| `project_members`            | Membres projet       | projectId, userId, role, allocation                                     |
| `epics`                      | Épopées              | id, name, projectId, progress                                           |
| `milestones`                 | Jalons               | id, name, projectId, dueDate, status                                    |
| `tasks`                      | Tâches               | id, title, status, priority, projectId, epicId, milestoneId, assigneeId |
| `task_assignees`             | Multi-assignation    | taskId, userId                                                          |
| `task_dependencies`          | Dépendances          | taskId, dependsOnTaskId                                                 |
| `task_raci`                  | Matrice RACI         | taskId, userId, role                                                    |
| `time_entries`               | Pointages temps      | userId, projectId, taskId, date, hours                                  |
| `leaves`                     | Congés               | userId, leaveTypeId, startDate, endDate, status                         |
| `leave_type_configs`         | Types congés         | code, name, color, isPaid, requiresApproval                             |
| `leave_validation_delegates` | Délégations          | delegatorId, delegateId, startDate, endDate                             |
| `telework_schedules`         | Télétravail          | userId, date, isTelework                                                |
| `skills`                     | Compétences          | id, name, category                                                      |
| `user_skills`                | Compétences user     | userId, skillId, level                                                  |
| `holidays`                   | Jours fériés         | date, name, type, isWorkDay                                             |
| `documents`                  | Documents            | id, name, url, projectId                                                |
| `comments`                   | Commentaires         | id, content, taskId, authorId                                           |
| `personal_todos`             | To-dos perso         | userId, text, completed                                                 |
| `app_settings`               | Paramètres           | key, value, category                                                    |

---

## 5. Routes principales

### API REST (107 endpoints)

#### Authentification (`/api/auth`)

| Méthode | Route            | Description                 |
| ------- | ---------------- | --------------------------- |
| POST    | `/auth/login`    | Connexion (retourne JWT)    |
| POST    | `/auth/register` | Inscription                 |
| GET     | `/auth/profile`  | Profil utilisateur connecté |
| GET     | `/auth/me`       | Alias profil                |

#### Utilisateurs (`/api/users`)

| Méthode | Route                       | Description                  |
| ------- | --------------------------- | ---------------------------- |
| GET     | `/users`                    | Liste des utilisateurs       |
| POST    | `/users`                    | Créer un utilisateur         |
| GET     | `/users/:id`                | Détail utilisateur           |
| PATCH   | `/users/:id`                | Modifier utilisateur         |
| DELETE  | `/users/:id`                | Désactiver utilisateur       |
| DELETE  | `/users/:id/hard`           | Supprimer définitivement     |
| GET     | `/users/:id/dependencies`   | Vérifier dépendances         |
| PATCH   | `/users/me/change-password` | Changer mot de passe         |
| POST    | `/users/:id/reset-password` | Reset mot de passe           |
| GET     | `/users/presence`           | Présence équipe              |
| GET     | `/users/department/:id`     | Utilisateurs par département |
| GET     | `/users/service/:id`        | Utilisateurs par service     |
| GET     | `/users/role/:role`         | Utilisateurs par rôle        |
| POST    | `/users/import/validate`    | Valider import CSV           |
| POST    | `/users/import`             | Importer utilisateurs        |
| GET     | `/users/import/template`    | Template import              |

#### Projets (`/api/projects`)

| Méthode | Route                                  | Description              |
| ------- | -------------------------------------- | ------------------------ |
| GET     | `/projects`                            | Liste des projets        |
| POST    | `/projects`                            | Créer un projet          |
| GET     | `/projects/:id`                        | Détail projet            |
| PATCH   | `/projects/:id`                        | Modifier projet          |
| DELETE  | `/projects/:id`                        | Soft delete              |
| DELETE  | `/projects/:id/hard`                   | Hard delete              |
| GET     | `/projects/:id/stats`                  | Statistiques projet      |
| GET     | `/projects/user/:userId`               | Projets d'un utilisateur |
| POST    | `/projects/:id/members`                | Ajouter membre           |
| DELETE  | `/projects/:projectId/members/:userId` | Retirer membre           |

#### Tâches (`/api/tasks`)

| Méthode | Route                                       | Description                                        |
| ------- | ------------------------------------------- | -------------------------------------------------- |
| GET     | `/tasks`                                    | Liste avec filtres (status, priority, page, limit) |
| POST    | `/tasks`                                    | Créer une tâche                                    |
| GET     | `/tasks/:id`                                | Détail tâche                                       |
| PATCH   | `/tasks/:id`                                | Modifier tâche                                     |
| DELETE  | `/tasks/:id`                                | Supprimer tâche                                    |
| GET     | `/tasks/assignee/:userId`                   | Tâches assignées                                   |
| GET     | `/tasks/project/:projectId`                 | Tâches du projet                                   |
| GET     | `/tasks/orphans`                            | Tâches sans projet                                 |
| POST    | `/tasks/:id/dependencies`                   | Ajouter dépendance                                 |
| DELETE  | `/tasks/:taskId/dependencies/:dependsOnId`  | Retirer dépendance                                 |
| POST    | `/tasks/:id/raci`                           | Assigner RACI                                      |
| DELETE  | `/tasks/:taskId/raci/:userId/:role`         | Retirer RACI                                       |
| POST    | `/tasks/project/:projectId/import/validate` | Valider import                                     |
| POST    | `/tasks/project/:projectId/import`          | Importer tâches                                    |
| GET     | `/tasks/project/:projectId/import-template` | Template import                                    |
| POST    | `/tasks/:id/attach-project`                 | Attacher à un projet                               |
| POST    | `/tasks/:id/detach-project`                 | Détacher du projet                                 |

#### Congés (`/api/leaves`)

| Méthode | Route                        | Description          |
| ------- | ---------------------------- | -------------------- |
| GET     | `/leaves`                    | Liste avec filtres   |
| POST    | `/leaves`                    | Demander un congé    |
| GET     | `/leaves/:id`                | Détail congé         |
| PATCH   | `/leaves/:id`                | Modifier demande     |
| DELETE  | `/leaves/:id`                | Annuler demande      |
| GET     | `/leaves/me`                 | Mes congés           |
| GET     | `/leaves/me/balance`         | Mon solde            |
| GET     | `/leaves/balance/:userId`    | Solde utilisateur    |
| GET     | `/leaves/pending-validation` | À valider            |
| POST    | `/leaves/:id/approve`        | Approuver            |
| POST    | `/leaves/:id/reject`         | Rejeter              |
| POST    | `/leaves/:id/cancel`         | Annuler              |
| POST    | `/leaves/delegations`        | Créer délégation     |
| GET     | `/leaves/delegations/me`     | Mes délégations      |
| DELETE  | `/leaves/delegations/:id`    | Supprimer délégation |

#### Télétravail (`/api/telework`)

| Méthode | Route                         | Description          |
| ------- | ----------------------------- | -------------------- |
| GET     | `/telework`                   | Liste                |
| POST    | `/telework`                   | Déclarer télétravail |
| GET     | `/telework/me/week`           | Ma semaine           |
| GET     | `/telework/me/stats`          | Mes stats            |
| GET     | `/telework/team/:date`        | Planning équipe      |
| GET     | `/telework/user/:userId/week` | Semaine utilisateur  |

#### Compétences (`/api/skills`)

| Méthode | Route                     | Description               |
| ------- | ------------------------- | ------------------------- |
| GET     | `/skills`                 | Liste compétences         |
| POST    | `/skills`                 | Créer compétence          |
| GET     | `/skills/matrix`          | Matrice compétences       |
| GET     | `/skills/search/:skillId` | Rechercher par compétence |
| POST    | `/skills/me/assign`       | S'assigner une compétence |
| GET     | `/skills/me/my-skills`    | Mes compétences           |

#### Time Tracking (`/api/time-tracking`)

| Méthode | Route                                      | Description         |
| ------- | ------------------------------------------ | ------------------- |
| GET     | `/time-tracking`                           | Liste entrées       |
| POST    | `/time-tracking`                           | Saisir temps        |
| GET     | `/time-tracking/me`                        | Mes entrées         |
| GET     | `/time-tracking/me/report`                 | Mon rapport         |
| GET     | `/time-tracking/user/:userId/report`       | Rapport utilisateur |
| GET     | `/time-tracking/project/:projectId/report` | Rapport projet      |

#### Autres endpoints

- `/api/departments` - CRUD départements
- `/api/services` - CRUD services
- `/api/epics` - CRUD épopées
- `/api/milestones` - CRUD jalons + import
- `/api/documents` - CRUD documents
- `/api/comments` - CRUD commentaires
- `/api/leave-types` - Configuration types congés
- `/api/holidays` - Gestion jours fériés
- `/api/personal-todos` - To-dos personnels (max 20)
- `/api/settings` - Paramètres application
- `/api/analytics` - KPIs et exports
- `/api/health` - Health check

### Frontend (Next.js App Router)

| Route            | Page          | Description                           |
| ---------------- | ------------- | ------------------------------------- |
| `/`              | Redirect      | Redirection vers /login ou /dashboard |
| `/login`         | Login         | Connexion                             |
| `/register`      | Register      | Inscription                           |
| `/dashboard`     | Dashboard     | Tableau de bord                       |
| `/projects`      | Projects      | Liste/gestion projets                 |
| `/projects/[id]` | ProjectDetail | Détail projet (Kanban, Gantt)         |
| `/tasks`         | Tasks         | Liste/Kanban tâches                   |
| `/tasks/[id]`    | TaskDetail    | Détail tâche                          |
| `/planning`      | Planning      | Vue planning équipe (semaine/mois)    |
| `/leaves`        | Leaves        | Gestion congés                        |
| `/telework`      | Telework      | Gestion télétravail                   |
| `/skills`        | Skills        | Matrice compétences                   |
| `/time-tracking` | TimeTracking  | Suivi du temps                        |
| `/reports`       | Reports       | Rapports et exports                   |
| `/users`         | Users         | Gestion utilisateurs (admin)          |
| `/departments`   | Departments   | Gestion départements                  |
| `/settings`      | Settings      | Paramètres application                |
| `/profile`       | Profile       | Profil utilisateur                    |

---

## 6. Conventions

### Nommage

| Type                   | Convention               | Exemple                 |
| ---------------------- | ------------------------ | ----------------------- |
| Fichiers module NestJS | `[name].module.ts`       | `users.module.ts`       |
| Fichiers controller    | `[name].controller.ts`   | `users.controller.ts`   |
| Fichiers service       | `[name].service.ts`      | `users.service.ts`      |
| Fichiers DTO           | `[action]-[name].dto.ts` | `create-user.dto.ts`    |
| Fichiers test backend  | `[name].spec.ts`         | `users.service.spec.ts` |
| Fichiers test frontend | `[name].test.ts`         | `auth.service.test.ts`  |
| Composants React       | PascalCase               | `AuthProvider.tsx`      |
| Services frontend      | `[name].service.ts`      | `auth.service.ts`       |
| Stores Zustand         | `[name].store.ts`        | `auth.store.ts`         |
| Hooks                  | `use[Name].ts`           | `usePlanningData.ts`    |

### Structure des imports (ordre)

```typescript
// 1. Modules Node.js / externes
import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

// 2. Modules internes (alias @/)
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";

// 3. Types/interfaces
import { User } from "@/types";
```

### Validation des données (Backend)

```typescript
// DTOs avec class-validator
export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus = TaskStatus.TODO;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority = Priority.NORMAL;
}
```

### Gestion des erreurs (Backend)

```typescript
// Exceptions NestJS standards
throw new NotFoundException("Projet introuvable");
throw new BadRequestException("Données invalides");
throw new ConflictException("Email déjà utilisé");
throw new UnauthorizedException("Non autorisé");
```

### Client API (Frontend)

```typescript
// Service pattern avec Axios
export const tasksService = {
  async getAll(page = 1, limit = 20, status?: TaskStatus) {
    const response = await api.get<PaginatedResponse<Task>>("/tasks", {
      params: { page, limit, status },
    });
    return response.data;
  },

  async create(data: CreateTaskDto): Promise<Task> {
    const response = await api.post<Task>("/tasks", data);
    return response.data;
  },
};
```

### Store Zustand (Frontend)

```typescript
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  logout: () => {
    authService.logout();
    set({ user: null, isAuthenticated: false });
  },
}));
```

### Tests

**Backend (Vitest)** :

```typescript
describe("TasksService", () => {
  let service: TasksService;
  let prisma: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: mockDeep<PrismaClient>() },
      ],
    }).compile();

    service = module.get(TasksService);
    prisma = module.get(PrismaService);
  });

  it("should create a task", async () => {
    prisma.task.create.mockResolvedValue(mockTask);
    const result = await service.create(createTaskDto);
    expect(result).toEqual(mockTask);
  });
});
```

**Frontend (Jest + Testing Library)** :

```typescript
describe("auth.service", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("should store token on login", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: mockAuthResponse });
    await authService.login({ login: "admin", password: "test" });
    expect(localStorage.getItem("access_token")).toBe("mock-token");
  });
});
```

---

## 7. Scripts utiles

### Développement

| Script                  | Usage                                 |
| ----------------------- | ------------------------------------- |
| `pnpm run dev`          | Démarrer tous les projets en mode dev |
| `pnpm run build`        | Build tous les projets                |
| `pnpm run lint`         | Linter tous les projets               |
| `pnpm run format`       | Formater le code (Prettier)           |
| `pnpm run format:check` | Vérifier le formatage                 |

### Docker

| Script                  | Usage                             |
| ----------------------- | --------------------------------- |
| `pnpm run docker:dev`   | Démarrer PostgreSQL + Redis (dev) |
| `pnpm run docker:down`  | Arrêter les conteneurs            |
| `pnpm run docker:logs`  | Voir les logs                     |
| `pnpm run docker:clean` | Supprimer volumes et conteneurs   |

### Base de données

| Script                       | Usage                          |
| ---------------------------- | ------------------------------ |
| `pnpm run db:migrate`        | Exécuter les migrations (dev)  |
| `pnpm run db:migrate:deploy` | Déployer les migrations (prod) |
| `pnpm run db:studio`         | Ouvrir Prisma Studio           |
| `pnpm run db:seed`           | Seed la base de données        |
| `pnpm run db:reset`          | Reset complet de la base       |

### Tests

| Script              | Usage                 |
| ------------------- | --------------------- |
| `pnpm run test`     | Tests unitaires       |
| `pnpm run test:cov` | Tests avec couverture |
| `pnpm run test:e2e` | Tests E2E Playwright  |

### Production

| Script                           | Usage                                |
| -------------------------------- | ------------------------------------ |
| `./scripts/init-env.sh`          | Générer .env.production avec secrets |
| `./scripts/deploy-production.sh` | Script de déploiement                |
| `./scripts/backup-database.sh`   | Backup PostgreSQL                    |
| `./scripts/restore-database.sh`  | Restore PostgreSQL                   |
| `./scripts/health-check.sh`      | Vérifier santé des services          |
| `./scripts/configure-ssl.sh`     | Configuration SSL                    |

### Commande Docker Compose Production

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

---

## 8. Points d'attention

### Tests E2E en CI

Le job E2E est **désactivé** dans le CI (`if: false`) à cause de problèmes CORS/réseau en environnement GitHub Actions. Les tests fonctionnent localement.

```yaml
# .github/workflows/ci.yml:169
if: false # TODO: Fix CORS/networking issues in CI environment
```

**Action requise** : Investiguer la configuration réseau entre les services dans GitHub Actions.

### Dépendances à surveiller

| Package | Version actuelle | Note                                                |
| ------- | ---------------- | --------------------------------------------------- |
| Next.js | 16.1.1           | Version très récente, surveiller la stabilité       |
| React   | 19.2.3           | Version 19, vérifier compatibilité des libs tierces |
| Prisma  | 6.19.1           | Version récente, migrations importantes             |

### Architecture

1. **Personal Todos** : Limite à 20 items par utilisateur (hard-coded)

   ```typescript
   const MAX_TODOS = 20; // apps/api/src/personal-todos/personal-todos.service.ts:11
   ```

2. **Tâches orphelines** : Le système supporte les tâches sans projet (réunions, tâches transverses). Ceci est intentionnel.

3. **Soft delete** : Les projets utilisent le soft delete (status CANCELLED) par défaut. Hard delete disponible via endpoint séparé.

### Sécurité

1. **JWT** : Token dans localStorage (vulnérable XSS). Pour une sécurité accrue, envisager httpOnly cookies.

2. **Bcrypt** : 12 rounds configurés (bon équilibre sécurité/performance)

3. **CORS** : Configurable via `CORS_ORIGIN` en production

4. **Rate limiting** : Configurable via `THROTTLE_LIMIT` et `THROTTLE_TTL`

### Configuration requise

**Secrets obligatoires en production** :

- `DATABASE_PASSWORD` (min 16 chars)
- `REDIS_PASSWORD` (min 16 chars)
- `JWT_SECRET` (min 32 chars)
- `CORS_ORIGIN` (URL du domaine)

### Identifiants par défaut

Après le seed initial :

- **Login** : `admin`
- **Email** : `admin@orchestr-a.internal`
- **Mot de passe** : `admin123`

**IMPORTANT** : Changer impérativement en production !

---

## 9. Fichiers de configuration clés

| Fichier                                  | Usage                          |
| ---------------------------------------- | ------------------------------ |
| `turbo.json`                             | Pipeline Turborepo             |
| `pnpm-workspace.yaml`                    | Définition workspaces          |
| `docker-compose.yml`                     | Stack de développement         |
| `docker-compose.prod.yml`                | Stack de production            |
| `apps/api/Dockerfile`                    | Image Docker API               |
| `apps/web/Dockerfile`                    | Image Docker Web               |
| `nginx/nginx.conf`                       | Configuration reverse proxy    |
| `packages/database/prisma/schema.prisma` | Schéma base de données         |
| `.env.example`                           | Variables d'environnement dev  |
| `.env.production.example`                | Variables d'environnement prod |
| `.github/workflows/ci.yml`               | Pipeline CI                    |
| `.github/workflows/deploy.yml`           | Pipeline déploiement           |

---

## 10. Couverture de tests

### Backend (30 fichiers de tests)

- Controllers : 17 fichiers `*.controller.spec.ts`
- Services : 13 fichiers `*.service.spec.ts`
- Framework : Vitest 4.x

### Frontend (18 fichiers de tests)

- Services : 14 fichiers `*.service.test.ts`
- Hooks : 1 fichier
- Utils : 2 fichiers
- Framework : Jest 30.x + Testing Library

---

_Document généré pour servir de référence dans les futures sessions de développement._
