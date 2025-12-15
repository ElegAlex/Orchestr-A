# 🚀 Guide CI/CD - ORCHESTR'A V2

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Pipeline CI/CD](#pipeline-cicd)
3. [Tests automatisés](#tests-automatisés)
4. [Workflows GitHub Actions](#workflows-github-actions)
5. [Déploiement local](#déploiement-local)
6. [Déploiement production](#déploiement-production)
7. [Monitoring & Maintenance](#monitoring--maintenance)

---

## 🎯 Vue d'ensemble

Le pipeline CI/CD d'ORCHESTR'A V2 garantit la qualité du code et automatise les déploiements.

### Architecture CI/CD

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Commit    │────▶│  Lint/Format │────▶│    Tests    │────▶│    Build     │
│   & Push    │     │    Check     │     │ (Unit/E2E)  │     │  Validation  │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
                                                                      │
                                                                      ▼
                                                             ┌──────────────┐
                                                             │   Deploy to  │
                                                             │  Production  │
                                                             └──────────────┘
```

### Composants

- **Linting & Formatting** : ESLint + Prettier
- **Tests Backend** : Vitest (80% couverture cible)
- **Tests Frontend** : Jest + React Testing Library (70% couverture)
- **Tests E2E** : Playwright
- **Builds** : Turborepo multi-apps
- **Docker** : Images multi-stage optimisées
- **CI/CD** : GitHub Actions

---

## 🔄 Pipeline CI/CD

### Workflow automatique

Le pipeline s'exécute automatiquement sur :
- **Push** sur `master` ou `develop`
- **Pull Request** vers `master` ou `develop`

### Étapes du pipeline

#### 1️⃣ **Lint & Format** (1-2 min)
- ✅ Vérification ESLint
- ✅ Vérification Prettier
- ❌ Bloque si erreurs

#### 2️⃣ **Tests Backend** (3-5 min)
- ✅ Tests unitaires Vitest
- ✅ Couverture de code
- ✅ Services : PostgreSQL 18 + Redis 7.4
- ❌ Bloque si tests échouent

#### 3️⃣ **Tests Frontend** (2-3 min)
- ✅ Tests composants Jest
- ✅ Couverture de code
- ❌ Bloque si tests échouent

#### 4️⃣ **Tests E2E** (5-10 min)
- ✅ Tests Playwright sur Chromium
- ✅ Scénarios : Auth, Projects, Tasks, Full Workflow
- ✅ Rapport HTML généré
- ❌ Bloque si tests critiques échouent

#### 5️⃣ **Build Validation** (3-5 min)
- ✅ Build backend (NestJS)
- ✅ Build frontend (Next.js)
- ✅ Génération Prisma Client
- ❌ Bloque si build échoue

#### 6️⃣ **Docker Build** (5-10 min) - Master uniquement
- ✅ Build image API
- ✅ Build image Web
- ✅ Cache GitHub Actions
- ℹ️ Optionnel, ne bloque pas

#### 7️⃣ **Deploy** (2-5 min) - Master uniquement
- ✅ Déploiement automatique ou manuel
- ✅ Health checks
- ✅ Rollback automatique si échec

---

## 🧪 Tests automatisés

### Tests Backend (Vitest)

**Localisation** : `apps/api/src/**/*.spec.ts`

**Modules testés** :
- ✅ Auth (5 tests)
- ✅ Users (10 tests)
- ✅ Projects (7 tests)
- ✅ Tasks (8 tests)
- ✅ Leaves (9 tests)
- ✅ Analytics (3 tests)
- ✅ Comments (4 tests)
- ✅ Departments (5 tests)
- ✅ Epics (7 tests)
- ✅ Milestones (7 tests)
- ✅ Services (5 tests)
- ✅ Time Tracking (7 tests)
- ✅ Documents (6 tests)
- ✅ Skills (7 tests)
- ✅ Telework (6 tests)

**Commandes** :
```bash
# Exécuter tous les tests
pnpm --filter api test

# Tests avec couverture
pnpm --filter api test:cov

# Mode watch
pnpm --filter api test:watch

# UI interactive
pnpm --filter api test:ui
```

**Configuration** : `apps/api/vitest.config.ts`
- Seuils de couverture : 80% (lines, functions, branches, statements)
- Environnement : Node.js
- Reporters : text, json, html, lcov

### Tests Frontend (Jest)

**Localisation** : `apps/web/**/__tests__/**/*.test.tsx`

**Composants testés** :
- ✅ Login Page
- ✅ Dashboard Page
- ✅ Projects Page
- ✅ Button Component

**Commandes** :
```bash
# Exécuter tous les tests
pnpm --filter web test

# Tests avec couverture
pnpm --filter web test:coverage

# Mode watch
pnpm --filter web test:watch
```

**Configuration** : `apps/web/jest.config.js`
- Environnement : jsdom (simule navigateur)
- Setup : `@testing-library/jest-dom`

### Tests E2E (Playwright)

**Localisation** : `e2e/*.spec.ts`

**Scénarios testés** :
1. **auth.spec.ts** : Authentification
   - Affichage page login
   - Erreur credentials invalides
   - Login réussi avec admin

2. **projects.spec.ts** : Gestion projets
   - Liste projets
   - Création projet
   - Modification projet
   - Suppression projet

3. **tasks.spec.ts** : Gestion tâches
   - Création tâche
   - Changement statut
   - Drag & drop Kanban

4. **full-workflow.spec.ts** : Workflow complet
   - Authentification
   - Création projet
   - Ajout tâches
   - Assignation membres
   - Suivi progression

**Commandes** :
```bash
# Exécuter tous les tests E2E
pnpm test:e2e

# Mode interactif
pnpm --filter web exec playwright test --ui

# Debug
pnpm --filter web exec playwright test --debug

# Rapport HTML
pnpm --filter web exec playwright show-report
```

**Configuration** : `playwright.config.ts`
- Navigateurs : Chromium (Chrome/Edge)
- Base URL : `http://localhost:3000`
- Timeout : 120s pour démarrage serveur
- Retries : 2 en CI, 0 en local

---

## ⚙️ Workflows GitHub Actions

### 📄 `.github/workflows/ci.yml` - Pipeline principal

**Déclencheurs** :
- Push sur `master` ou `develop`
- Pull Request vers `master` ou `develop`

**Jobs** :
1. `lint` - Vérification code
2. `backend-tests` - Tests API (avec PostgreSQL + Redis)
3. `frontend-tests` - Tests Next.js
4. `e2e-tests` - Tests end-to-end
5. `build` - Validation build
6. `docker-build` - Build images Docker (master uniquement)
7. `notify-success` - Notification succès

**Variables d'environnement** :
- `NODE_VERSION`: 22.x
- `PNPM_VERSION`: 9.15.9

**Services Docker (CI)** :
```yaml
postgres:
  image: postgres:18
  env:
    POSTGRES_USER: orchestr_a
    POSTGRES_PASSWORD: orchestr_a_dev_password
    POSTGRES_DB: orchestr_a_v2_test

redis:
  image: redis:7.4-alpine
```

### 📄 `.github/workflows/deploy.yml` - Déploiement

**Déclencheurs** :
- Après succès du workflow CI (master)
- Manuellement via `workflow_dispatch`

**Jobs** :
1. `deploy` - Build et déploiement images Docker
2. `notify` - Notification status déploiement

**Secrets requis** (pour déploiement serveur distant) :
- `DEPLOY_HOST` : IP/hostname serveur
- `DEPLOY_USER` : Utilisateur SSH
- `DEPLOY_KEY` : Clé privée SSH

---

## 🏠 Déploiement local

### Test du pipeline CI en local

Utilisez le script fourni :

```bash
./scripts/test-ci-locally.sh
```

**Le script exécute** :
1. ✅ Vérification prérequis
2. ✅ Installation dépendances
3. ✅ Génération Prisma
4. ✅ Lint & format
5. ✅ Démarrage PostgreSQL + Redis
6. ✅ Migrations DB
7. ✅ Tests backend
8. ✅ Tests frontend
9. ✅ Build backend
10. ✅ Build frontend
11. ⚙️ Tests E2E (optionnel)
12. ⚙️ Build Docker (optionnel)

**Prérequis** :
- Node.js 22.x
- pnpm 9.x
- Docker & Docker Compose
- 8 GB RAM minimum

### Environnement de développement

```bash
# Démarrer services Docker
pnpm run docker:dev

# Démarrer applications
pnpm run dev

# URLs
- Frontend: http://localhost:3000
- API: http://localhost:3001
- Swagger: http://localhost:3001/api/docs
- Prisma Studio: pnpm run db:studio
```

### Environnement Docker local

```bash
# Build et démarrage
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d --build

# Vérifier statut
docker-compose -f docker-compose.prod.yml ps

# Logs
docker-compose -f docker-compose.prod.yml logs -f

# Arrêt
docker-compose -f docker-compose.prod.yml down
```

---

## 🌐 Déploiement production

### Prérequis serveur

**Spécifications minimales** :
- CPU : 4 cores
- RAM : 8 GB
- Stockage : 50 GB SSD
- OS : Ubuntu 22.04 LTS ou Debian 12
- Docker : 28.x
- Docker Compose : 2.x

**Installation Docker** :
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin
```

### Configuration serveur

**1. Cloner le repository** :
```bash
git clone https://github.com/votre-org/orchestr-a-refonte.git
cd orchestr-a-refonte
```

**2. Configurer les variables d'environnement** :
```bash
cp .env.production.example .env.production
nano .env.production
```

**Variables critiques** :
```env
# Base de données
DATABASE_URL=postgresql://user:password@postgres:5432/orchestr_a_v2

# Sécurité
JWT_SECRET=<générer_secret_fort>
JWT_EXPIRATION=7d

# Redis
REDIS_URL=redis://redis:6379

# API
API_PORT=3001
API_HOST=0.0.0.0

# Frontend
NEXT_PUBLIC_API_URL=https://api.votre-domaine.com
```

**Générer JWT_SECRET** :
```bash
openssl rand -base64 64
```

**3. Configurer le firewall** :
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

**4. Configurer Nginx (reverse proxy + HTTPS)** :

Installer Nginx :
```bash
sudo apt-get install nginx certbot python3-certbot-nginx
```

Configuration Nginx (`/etc/nginx/sites-available/orchestr-a`) :
```nginx
# API Backend
server {
    listen 80;
    server_name api.votre-domaine.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Frontend Web
server {
    listen 80;
    server_name votre-domaine.com www.votre-domaine.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Activer la configuration :
```bash
sudo ln -s /etc/nginx/sites-available/orchestr-a /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**5. Configurer HTTPS avec Let's Encrypt** :
```bash
sudo certbot --nginx -d votre-domaine.com -d www.votre-domaine.com -d api.votre-domaine.com
```

### Déploiement manuel

**1. Build et démarrage** :
```bash
# Avec script de déploiement
./scripts/deploy-production.sh

# Ou manuellement
docker-compose --env-file .env.production -f docker-compose.prod.yml build
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d
```

**2. Migrations de base de données** :
```bash
docker-compose -f docker-compose.prod.yml exec api pnpm prisma migrate deploy
```

**3. Seed initial (première installation)** :
```bash
docker-compose -f docker-compose.prod.yml exec api pnpm prisma db seed
```

**4. Vérification** :
```bash
# Status des conteneurs
docker-compose -f docker-compose.prod.yml ps

# Health checks
curl http://localhost:3001/health
curl http://localhost:3000

# Logs
docker-compose -f docker-compose.prod.yml logs -f --tail=100
```

### Déploiement automatisé (GitHub Actions)

**1. Configurer les secrets GitHub** :
```
Settings > Secrets and variables > Actions > New repository secret
```

Secrets requis :
- `DEPLOY_HOST` : IP ou hostname du serveur
- `DEPLOY_USER` : Utilisateur SSH (ex: `ubuntu`)
- `DEPLOY_KEY` : Contenu de la clé privée SSH

**2. Activer le workflow** :

Le workflow `deploy.yml` se déclenche automatiquement après un push réussi sur `master`.

Pour déployer manuellement :
```
Actions > Deploy to Production > Run workflow
```

**3. Monitoring du déploiement** :

Suivre l'exécution dans l'onglet "Actions" de GitHub.

### Mise à jour de production

**Zero-downtime deployment** :
```bash
# Pull dernières modifications
git pull origin master

# Rebuild uniquement les services modifiés
docker-compose -f docker-compose.prod.yml build api web

# Rolling update
docker-compose -f docker-compose.prod.yml up -d --no-deps api web
```

**Avec downtime minimal** :
```bash
./scripts/deploy-production.sh
```

### Rollback

En cas de problème :
```bash
# Revenir au commit précédent
git log --oneline -n 5
git checkout <commit-hash-stable>

# Rebuild et redémarrage
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Ou restaurer une backup DB
docker-compose -f docker-compose.prod.yml exec postgres psql -U orchestr_a -d orchestr_a_v2 < backup.sql
```

---

## 📊 Monitoring & Maintenance

### Logs

**Voir tous les logs** :
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

**Logs spécifiques** :
```bash
# API
docker-compose -f docker-compose.prod.yml logs -f api --tail=100

# Frontend
docker-compose -f docker-compose.prod.yml logs -f web --tail=100

# PostgreSQL
docker-compose -f docker-compose.prod.yml logs -f postgres --tail=50

# Redis
docker-compose -f docker-compose.prod.yml logs -f redis --tail=50
```

### Health Checks

**API Health** :
```bash
curl http://localhost:3001/health
# Réponse attendue : {"status":"ok"}
```

**Frontend Health** :
```bash
curl -I http://localhost:3000
# Réponse attendue : HTTP/1.1 200 OK
```

**PostgreSQL Health** :
```bash
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U orchestr_a
# Réponse attendue : accepting connections
```

**Redis Health** :
```bash
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping
# Réponse attendue : PONG
```

### Backups

**Backup PostgreSQL** :
```bash
# Créer un backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U orchestr_a orchestr_a_v2 > backup-$(date +%Y%m%d-%H%M%S).sql

# Restaurer un backup
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U orchestr_a orchestr_a_v2 < backup-20251120-100000.sql
```

**Backup automatique** (cron) :
```bash
# Ajouter au crontab
crontab -e

# Backup quotidien à 2h du matin
0 2 * * * cd /chemin/orchestr-a-refonte && docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U orchestr_a orchestr_a_v2 > /backups/orchestr-a-$(date +\%Y\%m\%d).sql
```

### Monitoring ressources

**Utilisation CPU/RAM** :
```bash
docker stats orchestr-a-api-prod orchestr-a-web-prod orchestr-a-postgres-prod orchestr-a-redis-prod
```

**Espace disque** :
```bash
# Volumes Docker
docker system df -v

# Espace système
df -h
```

### Nettoyage

**Nettoyer images inutilisées** :
```bash
docker system prune -a
```

**Nettoyer volumes inutilisés** :
```bash
docker volume prune
```

**Nettoyer logs** :
```bash
# Truncate logs Docker
truncate -s 0 /var/lib/docker/containers/*/*-json.log
```

### Alertes recommandées

Configurer des alertes pour :
- ❌ Services down (API, Web, PostgreSQL, Redis)
- 💾 Espace disque < 10%
- 🔥 CPU > 80% pendant 5 minutes
- 💥 RAM > 90%
- 🐛 Erreurs API > 50/min
- ⚠️ Temps de réponse > 2s

**Outils recommandés** :
- **Uptime monitoring** : UptimeRobot, Pingdom
- **Application monitoring** : Sentry, LogRocket
- **Infrastructure monitoring** : Datadog, New Relic, Grafana

---

## 📋 Checklist pré-production

Avant de déployer en production :

### Code
- [ ] Tous les tests passent (backend, frontend, E2E)
- [ ] Couverture tests ≥ 70%
- [ ] Pas de warnings ESLint critiques
- [ ] Code formaté avec Prettier
- [ ] Secrets/credentials retirés du code

### Configuration
- [ ] Variables d'environnement configurées
- [ ] JWT_SECRET généré (fort)
- [ ] DATABASE_URL sécurisée
- [ ] CORS configuré correctement
- [ ] Rate limiting activé

### Infrastructure
- [ ] Serveur provisionné (4 CPU, 8GB RAM min)
- [ ] Docker installé
- [ ] Firewall configuré
- [ ] Nginx installé et configuré
- [ ] HTTPS/SSL configuré (Let's Encrypt)
- [ ] Nom de domaine pointé vers le serveur

### Base de données
- [ ] PostgreSQL 18 installé
- [ ] Migrations exécutées
- [ ] Seed initial effectué
- [ ] Backups automatiques configurés
- [ ] Index de performance créés

### Monitoring
- [ ] Health checks configurés
- [ ] Logs centralisés
- [ ] Alertes configurées
- [ ] Uptime monitoring activé
- [ ] Sentry/error tracking configuré

### Sécurité
- [ ] Scan vulnérabilités (npm audit)
- [ ] Dependencies à jour
- [ ] HTTPS forcé
- [ ] Headers de sécurité (Helmet)
- [ ] Rate limiting API
- [ ] Input validation
- [ ] SQL injection protection (Prisma)
- [ ] XSS protection

### Documentation
- [ ] README à jour
- [ ] Guide déploiement complet
- [ ] Architecture documentée
- [ ] API documentée (Swagger)
- [ ] Runbook opérationnel

---

## 🔗 Ressources

### Documentation
- [README.md](./README.md) - Vue d'ensemble
- [STATUS-SUMMARY.md](./STATUS-SUMMARY.md) - État du projet
- [STACK-TECHNIQUE.md](./STACK-TECHNIQUE.md) - Architecture technique

### Outils CI/CD
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Turborepo](https://turbo.build/repo/docs)
- [Docker Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)

### Tests
- [Vitest](https://vitest.dev/)
- [Jest](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright](https://playwright.dev/)

### Monitoring
- [Sentry](https://sentry.io/)
- [Datadog](https://www.datadoghq.com/)
- [Grafana](https://grafana.com/)

---

## 🆘 Support & Troubleshooting

### Problèmes courants

**Tests échouent en CI mais passent en local**
```bash
# Cause : différences d'environnement
# Solution : utiliser les mêmes versions Node/pnpm
nvm install 22
npm install -g pnpm@9.15.9
```

**Build Docker échoue**
```bash
# Cause : cache corrompu
# Solution : rebuild sans cache
docker-compose -f docker-compose.prod.yml build --no-cache
```

**Services ne démarrent pas**
```bash
# Vérifier les logs
docker-compose -f docker-compose.prod.yml logs

# Vérifier la config
docker-compose -f docker-compose.prod.yml config
```

**PostgreSQL connection failed**
```bash
# Vérifier que PostgreSQL est prêt
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# Vérifier DATABASE_URL
echo $DATABASE_URL
```

### Contact

Pour toute question ou problème :
- 📧 Email : dev@orchestr-a.internal
- 📚 Documentation : ./docs/
- 🐛 Issues : GitHub Issues

---

**Dernière mise à jour** : 20/11/2025
**Version** : 2.0.0
**Auteur** : ORCHESTR'A Team
