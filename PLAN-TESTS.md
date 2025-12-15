# 🧪 PLAN D'IMPLÉMENTATION DES TESTS - ORCHESTR'A V2

**Objectif** : Couverture complète 80%+ (Backend + Frontend + E2E)
**Date de création** : 28/11/2025
**Dernière mise à jour** : 30/11/2025

---

## 🎉 IMPLÉMENTATION RÉALISÉE (Session 30/11/2025)

### Fichiers de Tests Créés

#### Tests Controllers Backend (4 fichiers, 66 tests)

| Fichier | Tests | Couverture |
|---------|-------|------------|
| `auth.controller.spec.ts` | 9 | login, register, getProfile, getCurrentUser |
| `users.controller.spec.ts` | 18 | CRUD, filters, password, permissions |
| `projects.controller.spec.ts` | 17 | CRUD, stats, members, filters |
| `tasks.controller.spec.ts` | 22 | CRUD, filters, dependencies, RACI |

#### Tests E2E Playwright (3 fichiers, ~36 tests)

| Fichier | Tests | Couverture |
|---------|-------|------------|
| `leaves.spec.ts` | 9 | CRUD congés, workflow approbation |
| `planning.spec.ts` | 13 | Navigation, filtres, drag-drop, toggle |
| `permissions.spec.ts` | 14 | RBAC, accès protégé, session |

#### Tests Frontend Jest (3 fichiers, ~41 tests)

| Fichier | Tests | Couverture |
|---------|-------|------------|
| `planning/__tests__/page.test.tsx` | 7 | Rendu composant, props |
| `tasks/__tests__/page.test.tsx` | 18 | Kanban, filtres, CRUD, drag-drop |
| `users/__tests__/page.test.tsx` | 16 | Liste, CRUD, permissions, services |

---

## 📊 ÉTAT ACTUEL (Après Session 30/11/2025)

### Infrastructure Existante ✅

| Composant | Framework | Configuration | Status |
|-----------|-----------|---------------|--------|
| **Backend** | Vitest 4.0.9 | `apps/api/vitest.config.ts` | ✅ Configuré |
| **Frontend** | Jest 30 + RTL 16.3 | `apps/web/jest.config.js` | ✅ Configuré |
| **E2E** | Playwright 1.56 | `playwright.config.ts` | ✅ Configuré |

### Tests Actuels

| Type | Fichiers | Couverture estimée |
|------|----------|-------------------|
| **Backend (Vitest)** | 19 fichiers `.spec.ts` | ~55-60% |
| **Frontend (Jest)** | 7 fichiers `.test.tsx` | ~35-40% |
| **E2E (Playwright)** | 7 fichiers `.spec.ts` | ~60% scénarios |

### Modules Backend Testés vs Non Testés

| Module | Service | Controller | Qualité |
|--------|---------|------------|---------|
| auth | ✅ `auth.service.spec.ts` | ✅ `auth.controller.spec.ts` | ⭐⭐⭐⭐ Complet |
| users | ✅ `users.service.spec.ts` | ✅ `users.controller.spec.ts` | ⭐⭐⭐⭐ Complet |
| projects | ✅ `projects.service.spec.ts` | ✅ `projects.controller.spec.ts` | ⭐⭐⭐⭐ Complet |
| tasks | ✅ `tasks.service.spec.ts` | ✅ `tasks.controller.spec.ts` | ⭐⭐⭐⭐ Complet |
| departments | ✅ `departments.service.spec.ts` | ❌ Manquant | ⭐⭐ Partiel |
| services | ✅ `services.service.spec.ts` | ❌ Manquant | ⭐⭐ Partiel |
| leaves | ✅ `leaves.service.spec.ts` | ❌ Manquant | ⭐⭐ Partiel |
| telework | ✅ `telework.service.spec.ts` | ❌ Manquant | ⭐⭐ Partiel |
| skills | ✅ `skills.service.spec.ts` | ❌ Manquant | ⭐⭐ Partiel |
| time-tracking | ✅ `time-tracking.service.spec.ts` | ❌ Manquant | ⭐⭐ Partiel |
| epics | ✅ `epics.service.spec.ts` | ❌ Manquant | ⭐⭐ Partiel |
| milestones | ✅ `milestones.service.spec.ts` | ❌ Manquant | ⭐⭐ Partiel |
| documents | ✅ `documents.service.spec.ts` | ❌ Manquant | ⭐⭐ Partiel |
| comments | ✅ `comments.service.spec.ts` | ❌ Manquant | ⭐⭐ Partiel |
| analytics | ✅ `analytics.controller.spec.ts` | - | ⭐ Minimal |
| leave-types | ❌ Manquant | ❌ Manquant | - |
| personal-todos | ❌ Manquant | ❌ Manquant | - |
| settings | ❌ Manquant | ❌ Manquant | - |

---

## 🎯 PLAN D'IMPLÉMENTATION

### Phase 1 : Compléter les Tests Backend (Priorité Haute)

#### 1.1 Tests Controllers Manquants
**Objectif** : Tester les endpoints HTTP (validation, guards, responses)

| Controller | Priorité | Estimation | Status |
|------------|----------|------------|--------|
| `auth.controller.spec.ts` | 🔴 CRITIQUE | 1h | ✅ FAIT (30/11) |
| `users.controller.spec.ts` | 🔴 CRITIQUE | 1.5h | ✅ FAIT (30/11) |
| `projects.controller.spec.ts` | 🔴 CRITIQUE | 1.5h | ✅ FAIT (30/11) |
| `tasks.controller.spec.ts` | 🔴 CRITIQUE | 1.5h | ✅ FAIT (30/11) |
| `leaves.controller.spec.ts` | 🟡 HAUTE | 1h | 📝 À faire |
| `telework.controller.spec.ts` | 🟡 HAUTE | 1h | 📝 À faire |
| `skills.controller.spec.ts` | 🟢 MOYENNE | 45min | 📝 À faire |
| `time-tracking.controller.spec.ts` | 🟢 MOYENNE | 45min | 📝 À faire |
| `departments.controller.spec.ts` | 🟢 MOYENNE | 30min | 📝 À faire |
| `services.controller.spec.ts` | 🟢 MOYENNE | 30min | 📝 À faire |
| `epics.controller.spec.ts` | 🟢 MOYENNE | 30min | 📝 À faire |
| `milestones.controller.spec.ts` | 🟢 MOYENNE | 30min | 📝 À faire |
| `documents.controller.spec.ts` | 🟢 MOYENNE | 30min | 📝 À faire |
| `comments.controller.spec.ts` | 🟢 MOYENNE | 30min | 📝 À faire |
| `analytics.controller.spec.ts` | 🟢 MOYENNE | 30min | 📝 À faire |
| `leave-types.controller.spec.ts` | 🟢 MOYENNE | 30min | 📝 À faire |
| `personal-todos.controller.spec.ts` | ⚪ BASSE | 30min | 📝 À faire |
| `settings.controller.spec.ts` | ⚪ BASSE | 30min | 📝 À faire |

**Réalisé** : 4/18 (5.5h)
**Restant** : 14/18 (~7.5h)

#### 1.2 Tests Services Manquants

| Service | Priorité | Estimation |
|---------|----------|------------|
| `leave-types.service.spec.ts` | 🟡 HAUTE | 1h |
| `personal-todos.service.spec.ts` | ⚪ BASSE | 30min |
| `settings.service.spec.ts` | ⚪ BASSE | 30min |

**Sous-total** : ~2h

#### 1.3 Amélioration Tests Services Existants

Chaque fichier existant doit être enrichi avec :
- Tests des cas d'erreur (edge cases)
- Tests des validations métier
- Tests des relations complexes

| Service | Tests à ajouter | Estimation |
|---------|-----------------|------------|
| auth.service | Cas token expiré, refresh, logout | 1h |
| projects.service | Stats, getStats, filtres avancés | 1h |
| tasks.service | Dépendances circulaires, RACI | 1.5h |
| leaves.service | Calcul jours ouvrés, chevauchements | 1.5h |
| telework.service | Planning hebdo, exceptions | 1h |
| skills.service | Matrice, niveaux, assignation | 1h |

**Sous-total** : ~7h

#### 1.4 Tests Guards et Decorators

| Fichier | Priorité | Estimation |
|---------|----------|------------|
| `jwt-auth.guard.spec.ts` | 🔴 CRITIQUE | 1h |
| `roles.guard.spec.ts` | 🔴 CRITIQUE | 1h |
| `current-user.decorator.spec.ts` | 🟡 HAUTE | 30min |

**Sous-total** : ~2.5h

---

### Phase 2 : Tests Frontend (Priorité Moyenne)

#### 2.1 Tests Composants UI

| Composant | Priorité | Estimation |
|-----------|----------|------------|
| `Button.test.tsx` | ✅ Existe | - |
| `Input.test.tsx` | 🟡 HAUTE | 30min |
| `Modal.test.tsx` | 🟡 HAUTE | 45min |
| `Card.test.tsx` | 🟢 MOYENNE | 30min |
| `Table.test.tsx` | 🟢 MOYENNE | 45min |
| `Sidebar.test.tsx` | 🟢 MOYENNE | 30min |
| `Header.test.tsx` | 🟢 MOYENNE | 30min |

**Sous-total** : ~3.5h

#### 2.2 Tests Pages

| Page | Priorité | Estimation |
|------|----------|------------|
| `login/page.test.tsx` | ✅ Existe (améliorer) | 30min |
| `dashboard/page.test.tsx` | ✅ Existe (améliorer) | 30min |
| `projects/page.test.tsx` | ✅ Existe (améliorer) | 30min |
| `projects/[id]/page.test.tsx` | 🔴 CRITIQUE | 1h |
| `tasks/page.test.tsx` | 🔴 CRITIQUE | 1h |
| `planning/page.test.tsx` | 🔴 CRITIQUE | 1.5h |
| `users/page.test.tsx` | 🟡 HAUTE | 1h |
| `leaves/page.test.tsx` | 🟡 HAUTE | 1h |
| `telework/page.test.tsx` | 🟢 MOYENNE | 45min |
| `time-tracking/page.test.tsx` | 🟢 MOYENNE | 45min |
| `skills/page.test.tsx` | 🟢 MOYENNE | 45min |
| `reports/page.test.tsx` | 🟢 MOYENNE | 1h |
| `profile/page.test.tsx` | ⚪ BASSE | 30min |
| `settings/page.test.tsx` | ⚪ BASSE | 30min |
| `departments/page.test.tsx` | ⚪ BASSE | 30min |

**Sous-total** : ~11h

#### 2.3 Tests Hooks et Services

| Fichier | Priorité | Estimation |
|---------|----------|------------|
| `useAuth.test.ts` | 🔴 CRITIQUE | 1h |
| `api.test.ts` (intercepteurs) | 🔴 CRITIQUE | 1h |
| `auth.service.test.ts` | 🟡 HAUTE | 45min |
| `projects.service.test.ts` | 🟡 HAUTE | 45min |
| `tasks.service.test.ts` | 🟡 HAUTE | 45min |
| `users.service.test.ts` | 🟢 MOYENNE | 30min |
| `leaves.service.test.ts` | 🟢 MOYENNE | 30min |

**Sous-total** : ~5.5h

---

### Phase 3 : Tests E2E (Priorité Haute)

#### 3.1 Scénarios Existants à Améliorer

| Fichier | Améliorations | Estimation |
|---------|---------------|------------|
| `auth.spec.ts` | Register, forgot password, session | 1h |
| `projects.spec.ts` | CRUD complet, membres, Gantt | 2h |
| `tasks.spec.ts` | Kanban drag-drop, filtres, détail | 2h |
| `full-workflow.spec.ts` | Parcours complets multi-rôles | 1.5h |

**Sous-total** : ~6.5h

#### 3.2 Nouveaux Scénarios E2E

| Scénario | Priorité | Estimation |
|----------|----------|------------|
| `leaves.spec.ts` | 🔴 CRITIQUE | 2h |
| `telework.spec.ts` | 🟡 HAUTE | 1.5h |
| `planning.spec.ts` | 🔴 CRITIQUE | 2h |
| `users.spec.ts` | 🟡 HAUTE | 1.5h |
| `reports.spec.ts` | 🟢 MOYENNE | 1h |
| `skills.spec.ts` | 🟢 MOYENNE | 1h |
| `time-tracking.spec.ts` | 🟢 MOYENNE | 1h |
| `roles-permissions.spec.ts` | 🔴 CRITIQUE | 2h |
| `responsive.spec.ts` | ⚪ BASSE | 1h |

**Sous-total** : ~13h

---

## 📋 RÉSUMÉ ET PLANNING

### Estimation Totale

| Phase | Heures | Priorité |
|-------|--------|----------|
| **Phase 1** : Backend | 24.5h | 🔴 CRITIQUE |
| **Phase 2** : Frontend | 20h | 🟡 HAUTE |
| **Phase 3** : E2E | 19.5h | 🟡 HAUTE |
| **Total** | **64h** | - |

### Planning Recommandé

#### Semaine 1 : Backend Core (24h)
- **Jour 1-2** : Controllers critiques (Auth, Users, Projects, Tasks)
- **Jour 3** : Guards, Decorators, Services manquants
- **Jour 4-5** : Amélioration services existants

#### Semaine 2 : Frontend + E2E (40h)
- **Jour 1-2** : Composants UI + Pages critiques
- **Jour 3** : Hooks et Services frontend
- **Jour 4-5** : Tests E2E nouveaux scénarios

---

## 🛠️ STRUCTURE DES FICHIERS DE TEST

### Backend (Pattern à suivre)

```
apps/api/src/
├── auth/
│   ├── auth.service.ts
│   ├── auth.service.spec.ts     ✅ Existe
│   ├── auth.controller.ts
│   └── auth.controller.spec.ts  📝 À créer
├── users/
│   ├── users.service.ts
│   ├── users.service.spec.ts    ✅ Existe
│   ├── users.controller.ts
│   └── users.controller.spec.ts 📝 À créer
└── ...
```

### Frontend (Pattern à suivre)

```
apps/web/
├── app/
│   ├── login/
│   │   ├── page.tsx
│   │   └── __tests__/
│   │       └── page.test.tsx    ✅ Existe
│   ├── dashboard/
│   │   ├── page.tsx
│   │   └── __tests__/
│   │       └── page.test.tsx    ✅ Existe
│   └── ...
├── src/
│   ├── components/
│   │   └── __tests__/
│   │       └── Button.test.tsx  ✅ Existe
│   ├── hooks/
│   │   └── __tests__/
│   │       └── useAuth.test.ts  📝 À créer
│   └── services/
│       └── __tests__/
│           └── api.test.ts      📝 À créer
```

### E2E (Pattern à suivre)

```
e2e/
├── auth.spec.ts         ✅ Existe
├── projects.spec.ts     ✅ Existe
├── tasks.spec.ts        ✅ Existe
├── full-workflow.spec.ts ✅ Existe
├── leaves.spec.ts       📝 À créer
├── planning.spec.ts     📝 À créer
├── users.spec.ts        📝 À créer
└── ...
```

---

## 🔧 TEMPLATES DE TESTS

### Template Controller (Backend)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { XxxController } from './xxx.controller';
import { XxxService } from './xxx.service';

describe('XxxController', () => {
  let controller: XxxController;
  let service: XxxService;

  const mockService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [XxxController],
      providers: [
        { provide: XxxService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<XxxController>(XxxController);
    service = module.get<XxxService>(XxxService);
  });

  describe('create', () => {
    it('should create successfully', async () => {
      const dto = { /* ... */ };
      const expected = { id: '1', ...dto };
      mockService.create.mockResolvedValue(expected);

      const result = await controller.create(dto);

      expect(result).toEqual(expected);
      expect(mockService.create).toHaveBeenCalledWith(dto);
    });
  });

  // ... autres tests
});
```

### Template Page (Frontend)

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import XxxPage from '../page';

// Mock des dépendances
jest.mock('@/src/services/xxx.service', () => ({
  xxxService: {
    getAll: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
}));

describe('XxxPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render page title', () => {
    render(<XxxPage />);
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('should display loading state', () => {
    render(<XxxPage />);
    expect(screen.getByText(/chargement/i)).toBeInTheDocument();
  });

  // ... autres tests
});
```

### Template E2E (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Xxx Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByPlaceholder(/login ou email/i).fill('admin');
    await page.getByPlaceholder(/mot de passe/i).fill('admin123');
    await page.getByRole('button', { name: /se connecter/i }).click();
    await page.waitForURL('**/dashboard');
  });

  test('should display xxx page', async ({ page }) => {
    await page.goto('/xxx');
    await expect(page.locator('h1')).toContainText(/xxx/i);
  });

  test('should create new item', async ({ page }) => {
    await page.goto('/xxx');
    await page.getByRole('button', { name: /nouveau/i }).click();
    // ... remplir formulaire
    await page.getByRole('button', { name: /créer/i }).click();
    await expect(page.locator('text=succès')).toBeVisible();
  });
});
```

---

## 📈 MÉTRIQUES CIBLES

### Couverture Backend (80%+)

```
All files          |   80+  |   80+  |   80+  |   80+  |
 auth/             |   90+  |   85+  |   85+  |   90+  |
 users/            |   85+  |   80+  |   80+  |   85+  |
 projects/         |   85+  |   80+  |   80+  |   85+  |
 tasks/            |   85+  |   80+  |   80+  |   85+  |
 leaves/           |   80+  |   75+  |   75+  |   80+  |
 ...               |   80+  |   80+  |   80+  |   80+  |
```

### Couverture Frontend (70%+)

```
All files          |   70+  |   70+  |   70+  |   70+  |
 app/              |   75+  |   70+  |   70+  |   75+  |
 components/       |   80+  |   75+  |   75+  |   80+  |
 hooks/            |   85+  |   80+  |   80+  |   85+  |
 services/         |   80+  |   75+  |   75+  |   80+  |
```

### Scénarios E2E

- ✅ 15+ scénarios couvrant les parcours critiques
- ✅ Multi-navigateurs (Chrome, Firefox)
- ✅ Tests de régression automatisés

---

## ✅ CHECKLIST DE VALIDATION

### Avant de considérer les tests complets :

- [ ] `pnpm test` passe sans erreur (backend)
- [ ] `pnpm test` passe sans erreur (frontend)
- [ ] `pnpm test:e2e` passe sans erreur
- [ ] Couverture backend ≥ 80%
- [ ] Couverture frontend ≥ 70%
- [ ] Tous les scénarios E2E passent
- [ ] CI/CD intégré avec les tests
- [ ] Documentation tests mise à jour

---

## 🚀 COMMANDES

```bash
# Backend
cd apps/api
pnpm test              # Lancer tests
pnpm test:watch        # Mode watch
pnpm test:cov          # Avec couverture
pnpm test:ui           # Interface visuelle

# Frontend
cd apps/web
pnpm test              # Lancer tests
pnpm test:watch        # Mode watch
pnpm test:coverage     # Avec couverture

# E2E
pnpm test:e2e          # Tous les tests E2E
npx playwright test --ui  # Interface visuelle
npx playwright test --headed  # Avec navigateur visible
```

---

**Document créé le** : 28/11/2025
**Auteur** : Claude (Assistant IA)
**Status** : Plan validé - Prêt pour implémentation
