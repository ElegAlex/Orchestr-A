# 🎯 ORCHESTR'A V2

Application de gestion de projets et de ressources humaines pour collectivités territoriales.

## 📋 Description

ORCHESTR'A V2 est une plateforme web moderne qui permet de gérer :
- **Projets** : Gestion complète de projets avec Kanban drag-and-drop, Gantt, jalons
- **Planning Unifié** : Vue Semaine/Mois intégrant télétravail, congés et tâches
- **Ressources Humaines** : Congés, télétravail, compétences, charge de travail
- **Suivi du temps** : Time tracking et rapports
- **Analytics** : Dashboards et KPIs

### ✨ Fonctionnalités Clés

✅ **Kanban Interactif** : Drag-and-drop natif pour déplacer les tâches entre colonnes
✅ **Planning d'Équipe** : Grille utilisateurs × jours avec vue hebdomadaire et mensuelle
✅ **Gestion Télétravail** : Toggle direct dans le planning, planning hebdomadaire
✅ **Gestion Congés** : Workflow d'approbation, calcul jours ouvrés, détection chevauchements
✅ **Authentification** : JWT avec RBAC (6 rôles), routes protégées
✅ **API REST** : 107 endpoints documentés avec Swagger

## 🚀 Stack Technique

### Backend
- **Node.js** 22.20.0 LTS
- **NestJS** 11.1 + **Fastify** 5
- **Prisma** 6.16 (ORM)
- **PostgreSQL** 18
- **Redis** 7.4

### Frontend
- **Next.js** 15.5 (App Router)
- **React** 19.1
- **TypeScript** 5.7
- **Tailwind CSS** 4
- **TanStack Query** 5
- **Zustand** 5

### Infrastructure
- **Docker** 28 + **Docker Compose**
- **Turborepo** 2 (Monorepo)
- **pnpm** 9

## 📦 Structure du projet

```
orchestr-a-v2/
├── apps/
│   ├── api/              # Backend NestJS + Fastify
│   ├── web/              # Frontend Next.js
│   └── docs/             # Documentation
├── packages/
│   ├── database/         # Prisma schemas & migrations
│   ├── types/            # Types TypeScript partagés
│   ├── ui/               # Composants UI réutilisables
│   ├── config/           # Configurations partagées
│   └── utils/            # Utilities partagées
├── infrastructure/
│   └── docker/           # Configuration Docker
├── tools/
│   └── scripts/          # Scripts DevOps
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

## 🛠️ Installation

### Prérequis

- **Node.js** >= 22.0.0
- **pnpm** >= 9.0.0
- **Docker** & **Docker Compose**

### Étapes

1. **Cloner le repository**
```bash
git clone https://github.com/org/orchestr-a-v2.git
cd orchestr-a-v2
```

2. **Installer pnpm** (si pas déjà installé)
```bash
npm install -g pnpm@9
```

3. **Installer les dépendances**
```bash
pnpm install
```

4. **Configuration de l'environnement**
```bash
cp .env.example .env
# Éditer .env avec vos valeurs
```

5. **Démarrer les services Docker**
```bash
pnpm run docker:dev
```

6. **Exécuter les migrations de base de données**
```bash
pnpm run db:migrate
```

7. **Seed la base de données** (données de test)
```bash
pnpm run db:seed
```

8. **Démarrer l'application en mode développement**
```bash
pnpm run dev
```

L'application sera disponible sur :
- 🌐 **Frontend** : http://localhost:3000
- 🔌 **API** : http://localhost:3001
- 📊 **Prisma Studio** : `pnpm run db:studio`

## 📝 Scripts disponibles

### Développement
```bash
pnpm run dev          # Démarrer tous les projets en mode dev
pnpm run build        # Build tous les projets
pnpm run start        # Démarrer tous les projets en mode prod
pnpm run lint         # Linter tous les projets
pnpm run format       # Formatter le code
```

### Docker
```bash
pnpm run docker:dev   # Démarrer PostgreSQL + Redis
pnpm run docker:down  # Arrêter les conteneurs
pnpm run docker:logs  # Voir les logs
pnpm run docker:clean # Supprimer volumes et conteneurs
```

### Base de données
```bash
pnpm run db:migrate         # Exécuter les migrations
pnpm run db:migrate:deploy  # Déployer les migrations (prod)
pnpm run db:studio          # Ouvrir Prisma Studio
pnpm run db:seed            # Seed la base de données
pnpm run db:reset           # Reset la base de données
```

### Tests
```bash
pnpm run test       # Tests unitaires
pnpm run test:cov   # Tests avec couverture
pnpm run test:e2e   # Tests E2E
```

## 📚 Documentation

- [Cahier des charges](./REFONTE.md) - Spécifications fonctionnelles complètes
- [Stack technique](./STACK-TECHNIQUE.md) - Architecture et technologies détaillées
- [Ce qui a été fait](./WHAT-HAS-BEEN-DONE.md) - État d'avancement complet
- [Dernière mise à jour frontend](./FRONTEND-LATEST-UPDATE.md) - Session du 07/11/2025
- [Spécifications Planning](./PLANNING-VIEW-SPECS.md) - Vue planning d'équipe

## 🔐 Utilisateurs par défaut (après seed)

- **Admin** : `admin@orchestr-a.internal` / `admin123`

⚠️ **Changez ces identifiants en production !**

## 🧪 Tests

```bash
# Tests unitaires
pnpm run test

# Tests avec couverture
pnpm run test:cov

# Tests E2E
pnpm run test:e2e
```

## 📊 Monitoring

- **Logs** : `docker-compose logs -f`
- **Prisma Studio** : `pnpm run db:studio`
- **API Health** : http://localhost:3001/health

## 🐛 Debugging

### Backend (API)
```bash
cd apps/api
pnpm run start:debug
```

### Frontend (Web)
Utiliser les DevTools Chrome/Firefox

### Base de données
```bash
# Se connecter à PostgreSQL
docker exec -it orchestr-a-db psql -U orchestr_a -d orchestr_a_v2

# Voir les logs Redis
docker logs orchestr-a-redis -f
```

## 🚢 Déploiement Production

### Quick Start (One-liner)

```bash
# 1. Cloner
git clone https://github.com/org/orchestr-a-v2.git && cd orchestr-a-v2

# 2. Générer la configuration (secrets auto-générés)
./scripts/init-env.sh

# 3. Configurer votre domaine
nano .env.production  # Modifier CORS_ORIGIN

# 4. Déployer
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

L'application sera disponible sur `http://localhost` après ~2 minutes.

### Prérequis Production

- Docker Engine 24+
- Docker Compose v2+
- 4 Go RAM minimum
- Ports 80/443 disponibles

### Vérification

```bash
# Status des services
docker compose -f docker-compose.prod.yml ps

# Health check
curl http://localhost/api/health

# Logs temps réel
docker compose -f docker-compose.prod.yml logs -f
```

### SSL/HTTPS

```bash
# Placer vos certificats
cp fullchain.pem privkey.pem ./nginx/ssl/

# Décommenter le bloc HTTPS dans nginx/nginx.conf
# Redémarrer nginx
docker compose -f docker-compose.prod.yml restart nginx
```

### Maintenance

```bash
# Mise à jour
git pull && docker compose -f docker-compose.prod.yml up -d --build

# Backup base de données
./scripts/backup-database.sh

# Arrêt propre
docker compose -f docker-compose.prod.yml down
```

### Documentation détaillée

Voir [docs/docker-production-audit.md](./docs/docker-production-audit.md) pour la documentation complète.

## 🤝 Contribution

1. Créer une branche : `git checkout -b feature/ma-fonctionnalite`
2. Commit : `git commit -m "feat: ajout de ma fonctionnalité"`
3. Push : `git push origin feature/ma-fonctionnalite`
4. Créer une Pull Request

### Conventions de commits

Format : `type(scope): message`

**Types** :
- `feat`: Nouvelle fonctionnalité
- `fix`: Correction bug
- `refactor`: Refactoring
- `perf`: Performance
- `docs`: Documentation
- `test`: Tests
- `chore`: Maintenance

## 📄 License

UNLICENSED - Usage interne uniquement

## 👥 Équipe

ORCHESTR'A Team

---

**Version** : 2.0.0
**Date** : 07/11/2025
**Statut** : ✅ Frontend 90% complet - Prêt pour tests
