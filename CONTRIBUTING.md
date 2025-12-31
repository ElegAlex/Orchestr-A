# 🤝 GUIDE DE CONTRIBUTION - ORCHESTR'A V2

## 📋 Avant de commencer une session

### 1. Documents à lire (5-10 min)

**Obligatoires :**

1. **STATUS-SUMMARY.md** - Vue d'ensemble rapide (2 min)
2. **FRONTEND-LATEST-UPDATE.md** - Dernière session (3 min)
3. `git status` - Vérifier état du repo (1 min)

**Si besoin de contexte :**

- WHAT-HAS-BEEN-DONE.md - État détaillé complet
- PLANNING-VIEW-SPECS.md - Si travail sur Planning
- STACK-TECHNIQUE.md - Si questions d'architecture

### 2. Vérifications techniques

```bash
# Vérifier la branche
git branch

# Vérifier les containers Docker
docker ps --filter "name=orchestr-a"

# Vérifier les logs récents
docker logs orchestr-a-web-prod --tail 20

# Pull les derniers changements
git pull origin master
```

---

## 🎯 PROCHAINES TÂCHES PRIORITAIRES

### Sprint 1 : Tests & Qualité (Semaine 1)

**Priorité : HAUTE**

- [ ] **Tests Backend** (6h)
  - [ ] Configurer Vitest
  - [ ] Tests services Auth (auth.service.spec.ts)
  - [ ] Tests services Users (users.service.spec.ts)
  - [ ] Tests services Projects (projects.service.spec.ts)
  - [ ] Tests services Tasks (tasks.service.spec.ts)
  - [ ] Tests services Leaves (leaves.service.spec.ts)

- [ ] **Tests Frontend** (4h)
  - [ ] Configurer React Testing Library
  - [ ] Tests LoginForm
  - [ ] Tests MainLayout
  - [ ] Tests ProjectsList
  - [ ] Tests TasksKanban

- [ ] **Tests E2E** (3h)
  - [ ] Configurer Playwright
  - [ ] Scénario: Login → Dashboard
  - [ ] Scénario: CRUD Project
  - [ ] Scénario: CRUD Task
  - [ ] Scénario: Planning view

### Sprint 2 : Analytics & Export (Semaine 2)

**Priorité : MOYENNE**

- [ ] **Dashboard Analytics** (4h)
  - [ ] Intégrer recharts
  - [ ] Graphique Burndown
  - [ ] Graphique Vélocité
  - [ ] Graphique Charge équipe
  - [ ] KPIs temps réel

- [ ] **Export Planning** (3h)
  - [ ] Export PDF Planning (jspdf)
  - [ ] Export Excel Planning (xlsx)
  - [ ] Export avec filtres

- [ ] **Rapports** (2h)
  - [ ] Rapport temps par projet
  - [ ] Rapport charge par user
  - [ ] Rapport congés équipe

### Sprint 3 : Workflow & Notifications (Semaine 3)

**Priorité : MOYENNE**

- [ ] **Approbation Congés** (3h)
  - [ ] Interface manager (liste demandes)
  - [ ] Actions approuver/refuser
  - [ ] Notifications email

- [ ] **Notifications temps réel** (4h)
  - [ ] WebSocket setup
  - [ ] Service notifications frontend
  - [ ] Toast notifications
  - [ ] Centre de notifications

- [ ] **Workflow Tâches** (2h)
  - [ ] Assignation automatique
  - [ ] Notifications de mention
  - [ ] Alertes deadlines

### Sprint 4 : Production & CI/CD (Semaine 4)

**Priorité : HAUTE**

- [ ] **CI/CD** (4h)
  - [ ] GitHub Actions workflow
  - [ ] Tests automatiques
  - [ ] Build Docker auto
  - [ ] Deploy staging auto

- [ ] **Monitoring** (2h)
  - [ ] Sentry pour erreurs
  - [ ] Logs centralisés
  - [ ] Métriques performance

- [ ] **Documentation** (2h)
  - [ ] Documentation utilisateur
  - [ ] Guide déploiement
  - [ ] Tutoriels vidéo

---

## 📝 CONVENTION DE COMMITS

### Format du message

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat** : Nouvelle fonctionnalité
- **fix** : Correction de bug
- **refactor** : Refactoring (pas de changement fonctionnel)
- **perf** : Amélioration de performance
- **test** : Ajout/modification de tests
- **docs** : Documentation uniquement
- **style** : Formatage, missing semi-colons, etc.
- **chore** : Maintenance, dépendances, config

### Scopes (optionnel)

- `api` : Backend NestJS
- `web` : Frontend Next.js
- `planning` : Page Planning
- `tasks` : Page Tasks
- `auth` : Authentification
- `docker` : Configuration Docker
- `ci` : CI/CD

### Exemples

```bash
# Nouvelle feature
git commit -m "feat(planning): add export PDF functionality"

# Bug fix
git commit -m "fix(tasks): resolve drag-drop issue on Safari"

# Refactoring
git commit -m "refactor(api): extract common validation logic"

# Tests
git commit -m "test(auth): add unit tests for login service"

# Documentation
git commit -m "docs: update CONTRIBUTING.md with testing guide"
```

---

## ✅ CHECKLIST AVANT COMMIT

### 1. Code Quality

- [ ] Code compilé sans erreur (`npm run build` ou `docker build`)
- [ ] Pas de console.log oubliés
- [ ] Pas de TODO/FIXME critiques non documentés
- [ ] Variables d'environnement sensibles dans .env (pas dans le code)
- [ ] Types TypeScript corrects (pas de `any` évitables)

### 2. Tests

- [ ] Tests unitaires passent (`npm run test`)
- [ ] Tests E2E passent (si applicable)
- [ ] Nouvelles fonctionnalités ont des tests

### 3. Documentation

- [ ] README.md à jour si changement d'API
- [ ] WHAT-HAS-BEEN-DONE.md à jour si feature majeure
- [ ] STATUS-SUMMARY.md à jour si changement d'avancement
- [ ] Commentaires JSDoc pour fonctions complexes

### 4. Git

- [ ] Pas de fichiers sensibles (secrets, tokens, credentials)
- [ ] .gitignore à jour
- [ ] Branche correcte (develop pour features, master pour releases)
- [ ] Commit message suit la convention

### 5. Docker (si applicable)

- [ ] Build Docker réussit
- [ ] Containers démarrent correctement
- [ ] Variables d'environnement documentées dans .env.example

---

## 🔄 WORKFLOW GIT

### Branches

```
master      → Production (protected)
  ↑
develop     → Intégration (default branch)
  ↑
feature/*   → Nouvelles fonctionnalités
fix/*       → Corrections de bugs
```

### Créer une feature

```bash
# Depuis develop
git checkout develop
git pull origin develop

# Créer branche feature
git checkout -b feature/export-planning

# Développer...

# Commit
git add .
git commit -m "feat(planning): add PDF export"

# Push
git push origin feature/export-planning

# Créer Pull Request sur GitHub
# develop ← feature/export-planning
```

### Hotfix urgent

```bash
# Depuis master
git checkout master
git checkout -b fix/critical-bug

# Fix...

# Commit et push
git add .
git commit -m "fix(api): resolve authentication timeout"
git push origin fix/critical-bug

# PR vers master ET develop
```

---

## 🧪 TESTS

### Lancer les tests

```bash
# Backend (API)
cd apps/api
npm run test              # Tests unitaires
npm run test:cov          # Avec couverture
npm run test:e2e          # Tests E2E

# Frontend (Web)
cd apps/web
npm run test              # Tests composants
npm run test:e2e          # Tests E2E Playwright
```

### Écrire un test

**Backend (Vitest):**

```typescript
// apps/api/src/auth/auth.service.spec.ts
import { Test } from "@nestjs/testing";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AuthService],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it("should validate user credentials", async () => {
    const result = await service.validateUser("test@example.com", "password");
    expect(result).toBeDefined();
  });
});
```

**Frontend (React Testing Library):**

```typescript
// apps/web/app/login/page.test.tsx
import { render, screen } from '@testing-library/react';
import LoginPage from './page';

describe('LoginPage', () => {
  it('should render login form', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connexion/i })).toBeInTheDocument();
  });
});
```

---

## 🚀 DÉPLOIEMENT

### Build Production

```bash
# Build tous les services
docker-compose --env-file .env.production -f docker-compose.prod.yml build

# Démarrer
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d

# Vérifier
docker ps
docker logs orchestr-a-web-prod --tail 50
```

### Rebuild après modification

```bash
# Rebuild service spécifique (ex: web)
docker-compose --env-file .env.production -f docker-compose.prod.yml build web --no-cache
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d web
```

---

## 📊 MÉTRIQUES DE QUALITÉ

### Objectifs

- **Couverture tests backend** : ≥ 80%
- **Couverture tests frontend** : ≥ 70%
- **Build time** : < 30s
- **Bundle size** : < 500KB (first load)
- **Lighthouse score** : ≥ 90

### Vérifier

```bash
# Couverture backend
cd apps/api && npm run test:cov

# Couverture frontend
cd apps/web && npm run test:cov

# Bundle size
cd apps/web && npm run build
# Vérifier output "First Load JS"

# Lighthouse
npm run lighthouse
```

---

## 🆘 RÉSOLUTION DE PROBLÈMES

### Build échoue

```bash
# Nettoyer cache
rm -rf apps/*/node_modules
rm -rf node_modules
pnpm install

# Rebuild Docker from scratch
docker-compose down -v
docker system prune -af
docker-compose build --no-cache
```

### Erreurs TypeScript

```bash
# Vérifier types
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit

# Régénérer Prisma types
cd packages/database && npx prisma generate
```

### Containers ne démarrent pas

```bash
# Logs détaillés
docker-compose logs -f

# Vérifier ports
lsof -i :3000
lsof -i :3001
lsof -i :5432

# Restart
docker-compose restart
```

---

## 📞 RESSOURCES

### Documentation

- [README.md](./README.md) - Vue d'ensemble
- [STATUS-SUMMARY.md](./STATUS-SUMMARY.md) - État actuel
- [STACK-TECHNIQUE.md](./STACK-TECHNIQUE.md) - Architecture
- [WHAT-HAS-BEEN-DONE.md](./WHAT-HAS-BEEN-DONE.md) - Détails complets

### Outils

- **Swagger API** : http://localhost:3001/api/docs
- **Prisma Studio** : `pnpm run db:studio`
- **GitHub Repo** : https://github.com/ElegAlex/Orchestr-A

### Commandes Rapides

```bash
# Démarrer tout
pnpm run dev

# Build tout
pnpm run build

# Tests
pnpm run test

# Linter
pnpm run lint

# Format
pnpm run format

# Docker
pnpm run docker:dev     # Start services
pnpm run docker:down    # Stop services
pnpm run docker:clean   # Clean all

# Base de données
pnpm run db:migrate     # Run migrations
pnpm run db:seed        # Seed data
pnpm run db:studio      # Open Prisma Studio
pnpm run db:reset       # Reset DB
```

---

## ✨ CONSEILS

### Pour une session productive

1. **Planifier** : Choisir 1-3 tâches max par session
2. **Documenter** : Mettre à jour STATUS-SUMMARY.md en fin de session
3. **Tester** : Tester manuellement + automatiquement
4. **Commit souvent** : Petits commits fréquents > gros commits rares
5. **Review** : Relire son code avant de commit

### Pour des commits propres

- Message clair et descriptif
- Un commit = une modification logique
- Pas de code commenté
- Pas de fichiers de debug

### Pour collaborer

- Créer une branche pour chaque feature
- Pull Request avec description détaillée
- Demander review si changement majeur
- Merger après tests passés

---

**Dernière mise à jour** : 07/11/2025
**Contributeurs** : ElegAlex, Claude (AI Assistant)
