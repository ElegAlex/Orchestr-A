# ORCHESTR'A V2

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.0.0-green)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)

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

## 🚀 Déploiement rapide

### Option 1 : Image All-in-One (Ultra-simple)

Une seule commande, tout est inclus (PostgreSQL, Redis, API, Web) :

```bash
docker run -d \
  --name orchestr-a \
  -p 3000:3000 \
  -v orchestr-a-data:/data \
  ghcr.io/elegalex/orchestr-a:latest
```

**Accès** : http://localhost:3000 — Login : `admin@orchestr-a.local` / `admin123`

### Option 2 : Docker Compose (Multi-services)

Déployez avec docker-compose pour plus de contrôle :

```bash
curl -fsSL https://raw.githubusercontent.com/ElegAlex/Orchestr-A/master/install.sh | bash
```

Ou manuellement :

```bash
# Télécharger la configuration
mkdir orchestr-a && cd orchestr-a
curl -fsSL https://raw.githubusercontent.com/ElegAlex/Orchestr-A/master/docker-compose.standalone.yml -o docker-compose.yml

# Configurer (générer vos secrets)
cat > .env << EOF
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
JWT_SECRET=$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 64)
EOF

# Démarrer
docker compose pull
docker compose up -d
```

**Accès** : http://localhost:3000 — Login : `admin` / `admin123`

📖 [Documentation complète du déploiement](docs/QUICK-DEPLOY.md)

---

## 🛠️ Stack Technique

### Backend

- **Node.js** >= 22.0.0 LTS
- **NestJS** 11.1.10 + **Fastify** 5
- **Prisma** 6.19.1 (ORM)
- **PostgreSQL** 18
- **Redis** 7.4

### Frontend

- **Next.js** 16.1.1 (App Router)
- **React** 19.2.3
- **TypeScript** 5
- **Tailwind CSS** 4
- **TanStack Query** 5.90.6
- **Zustand** 5.0.8

### Infrastructure

- **Docker** + **Docker Compose**
- **Turborepo** 2.3.3 (Monorepo)
- **pnpm** 9.15.9

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
git clone https://github.com/ElegAlex/Orchestr-A.git
cd Orchestr-A
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
- 🔌 **API** : http://localhost:4000
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

- [Déploiement Docker](./DOCKER-DEPLOY.md) - Guide de déploiement Docker (3 étapes)
- [Cahier des charges](./REFONTE.md) - Spécifications fonctionnelles complètes
- [Stack technique](./STACK-TECHNIQUE.md) - Architecture et technologies détaillées
- [Ce qui a été fait](./WHAT-HAS-BEEN-DONE.md) - État d'avancement complet
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
- **API Health** : http://localhost:4000/api/health

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
git clone https://github.com/ElegAlex/Orchestr-A.git && cd Orchestr-A

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

- **[DOCKER-DEPLOY.md](./DOCKER-DEPLOY.md)** - Guide de déploiement Docker simplifié
- **[docs/Déploiement.md](./docs/Déploiement.md)** - Déploiement VPS complet (hybride)

## Contribution

Les contributions sont les bienvenues ! Consultez le [guide de contribution](./CONTRIBUTING.md) pour commencer.

Ce projet adhère au [Contributor Covenant](./CODE_OF_CONDUCT.md).

## Licence

MIT License - Voir le fichier [LICENSE](./LICENSE)

## Auteur

Alexandre BERGE - [@ElegAlex](https://github.com/ElegAlex)
