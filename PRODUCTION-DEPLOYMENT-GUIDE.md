# 🚀 Guide de Déploiement en Production - ORCHESTR'A V2

**Date**: 21 Novembre 2025
**Version**: 2.0.0
**Statut**: ✅ Production Ready

---

## 📋 Table des Matières

1. [Prérequis](#prérequis)
2. [Architecture de Production](#architecture-de-production)
3. [Procédure de Déploiement](#procédure-de-déploiement)
4. [Configuration](#configuration)
5. [Opérations de Maintenance](#opérations-de-maintenance)
6. [Monitoring et Logs](#monitoring-et-logs)
7. [Sauvegardes](#sauvegardes)
8. [Dépannage](#dépannage)
9. [Sécurité](#sécurité)

---

## 🔧 Prérequis

### Logiciels Requis

| Logiciel | Version Minimale | Version Recommandée |
|----------|------------------|---------------------|
| Docker | 24.0+ | 28.0+ |
| Docker Compose | 2.20+ | 2.30+ |
| Node.js | 22.0+ | 22.20+ LTS |
| pnpm | 9.0+ | 9.15+ |
| PostgreSQL | 16+ | 18+ |

### Configuration Matérielle Recommandée

**Environnement de Production:**
- **CPU**: 4 cores minimum, 8 cores recommandé
- **RAM**: 8 GB minimum, 16 GB recommandé
- **Stockage**: 50 GB minimum, 100 GB recommandé
- **Réseau**: Connexion stable 100 Mbps+

---

## 🏗️ Architecture de Production

### Stack Technique

```
┌─────────────────────────────────────────────────┐
│              NGINX Reverse Proxy                │
│          (Port 80 HTTP / 443 HTTPS)             │
└────────────┬────────────────────────┬───────────┘
             │                        │
    ┌────────▼────────┐      ┌────────▼────────┐
    │   Frontend Web  │      │   Backend API   │
    │   Next.js 15    │      │   NestJS 11     │
    │   Port 3000     │      │   Port 3001     │
    └─────────────────┘      └────────┬────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
           ┌────────▼────────┐              ┌──────────▼────────┐
           │  PostgreSQL 18  │              │    Redis 7.4      │
           │   Port 5432     │              │    Port 6379      │
           └─────────────────┘              └───────────────────┘
```

### Services Déployés

| Service | Container | Port | Description |
|---------|-----------|------|-------------|
| **Nginx** | `orchestr-a-nginx-prod` | 80, 443 | Reverse proxy + Load balancer |
| **Frontend** | `orchestr-a-web-prod` | 3000 | Application Next.js |
| **API** | `orchestr-a-api-prod` | 3001 | Backend NestJS REST API |
| **PostgreSQL** | `orchestr-a-postgres-prod` | 5432 | Base de données principale |
| **Redis** | `orchestr-a-redis-prod` | 6379 | Cache et sessions |

---

## 📦 Procédure de Déploiement

### Étape 1: Cloner le Repository

```bash
git clone https://github.com/org/orchestr-a-refonte.git
cd orchestr-a-refonte
```

### Étape 2: Configuration de l'Environnement

```bash
# Copier le fichier de configuration de production
cp .env.production.example .env.production

# Éditer le fichier avec vos valeurs
nano .env.production
```

**Variables critiques à configurer:**

```bash
# Base de données
DATABASE_PASSWORD=VOTRE_MOT_DE_PASSE_FORT

# Redis
REDIS_PASSWORD=VOTRE_MOT_DE_PASSE_REDIS

# JWT Secret (générer avec: openssl rand -base64 64)
JWT_SECRET=VOTRE_SECRET_JWT_FORT

# CORS (domaines autorisés)
CORS_ORIGIN=https://votredomaine.com
```

### Étape 3: Initialisation de la Base de Données

```bash
# Démarrer uniquement PostgreSQL
docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres

# Attendre que PostgreSQL soit prêt
sleep 10

# Exécuter les migrations Prisma
cd packages/database
npx prisma migrate deploy
npx prisma db seed
cd ../..
```

### Étape 4: Build et Déploiement

```bash
# Build et démarrer tous les services
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build

# Vérifier que tous les conteneurs sont opérationnels
docker ps --filter "name=orchestr-a"
```

### Étape 5: Vérification du Déploiement

```bash
# Exécuter le health check
bash scripts/health-check.sh

# Vérifier les logs
docker logs orchestr-a-api-prod --tail 50
docker logs orchestr-a-web-prod --tail 50
```

**URLs de vérification:**
- Frontend: http://localhost (ou votre domaine)
- API Health: http://localhost:3001/api/health
- API Docs (si activé): http://localhost:3001/api/docs

---

## ⚙️ Configuration

### Configuration NGINX

Le fichier `nginx/nginx.conf` configure:
- Reverse proxy vers API (port 4000) et Frontend (port 3000)
- Limites de taille d'upload (100MB)
- Timeouts (300s)
- Headers de sécurité

**Pour activer HTTPS:**

1. Placer vos certificats SSL dans `nginx/ssl/`:
   - `nginx/ssl/orchestr-a.crt` (certificat)
   - `nginx/ssl/orchestr-a.key` (clé privée)

2. Certificats auto-signés (développement uniquement):
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/orchestr-a.key \
  -out nginx/ssl/orchestr-a.crt \
  -subj "/C=FR/ST=France/L=Paris/O=ORCHESTR-A/OU=IT/CN=votredomaine.com"
```

### Variables d'Environnement

#### API Backend

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `NODE_ENV` | Environnement | `production` |
| `API_PORT` | Port de l'API | `4000` |
| `DATABASE_URL` | URL PostgreSQL | (voir .env) |
| `REDIS_HOST` | Hôte Redis | `redis` |
| `JWT_SECRET` | Secret JWT | **À CONFIGURER** |
| `SWAGGER_ENABLED` | Activer Swagger | `false` |
| `THROTTLE_TTL` | Durée rate limiting (s) | `60` |
| `THROTTLE_LIMIT` | Limite requêtes/TTL | `100` |

#### Frontend Web

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `NODE_ENV` | Environnement | `production` |
| `NEXT_PUBLIC_API_URL` | URL API publique | `http://localhost:3001/api` |

---

## 🔄 Opérations de Maintenance

### Mise à Jour de l'Application

```bash
# 1. Sauvegarder la base de données
bash scripts/backup-database.sh

# 2. Récupérer les dernières modifications
git pull origin main

# 3. Rebuild et redéployer
docker compose --env-file .env.production -f docker-compose.prod.yml down
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build

# 4. Vérifier le déploiement
bash scripts/health-check.sh
```

### Redémarrage des Services

```bash
# Redémarrer tous les services
docker compose --env-file .env.production -f docker-compose.prod.yml restart

# Redémarrer un service spécifique
docker restart orchestr-a-api-prod
docker restart orchestr-a-web-prod
```

### Nettoyage des Ressources Docker

```bash
# Nettoyer les images inutilisées
docker image prune -a -f

# Nettoyer les volumes orphelins
docker volume prune -f

# Nettoyer le cache de build
docker builder prune -a -f
```

---

## 📊 Monitoring et Logs

### Consultation des Logs

```bash
# Logs temps réel (tous les services)
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f

# Logs d'un service spécifique
docker logs orchestr-a-api-prod -f
docker logs orchestr-a-web-prod -f --tail 100

# Logs NGINX
docker logs orchestr-a-nginx-prod -f
```

### Métriques de Performance

```bash
# Utilisation des ressources en temps réel
docker stats

# Statistiques système Docker
docker system df
```

### Health Checks Automatiques

Le script `scripts/health-check.sh` vérifie:
- ✅ État des 5 conteneurs Docker
- ✅ Accessibilité HTTP (API et Frontend)
- ✅ Connexion base de données
- ✅ Comptage des enregistrements (users, projects, tasks)
- ✅ Utilisation des ressources (CPU, RAM, disque)

```bash
# Exécuter le health check
bash scripts/health-check.sh

# Planifier des health checks réguliers (cron)
# Ajouter dans crontab -e:
# */15 * * * * /path/to/orchestr-a-refonte/scripts/health-check.sh >> /var/log/orchestr-a-health.log 2>&1
```

---

## 💾 Sauvegardes

### Backup Automatique

Le script `scripts/backup-database.sh` effectue:
- Dump PostgreSQL complet
- Compression gzip
- Rotation automatique (conservation 30 jours)
- Logs détaillés

```bash
# Backup manuel
bash scripts/backup-database.sh

# Configurer les backups automatiques (tous les jours à 2h00)
bash scripts/setup-cron-backup.sh
```

**Emplacement des backups:**
```
backups/
├── orchestr-a-backup-YYYYMMDD_HHMMSS.sql.gz
├── orchestr-a-backup-YYYYMMDD_HHMMSS.sql.gz
└── ...
```

### Restauration d'une Sauvegarde

```bash
# 1. Arrêter l'API
docker stop orchestr-a-api-prod

# 2. Décompresser le backup
gunzip backups/orchestr-a-backup-YYYYMMDD_HHMMSS.sql.gz

# 3. Restaurer dans PostgreSQL
docker exec -i orchestr-a-postgres-prod psql -U postgres -d orchestr_a_prod < backups/orchestr-a-backup-YYYYMMDD_HHMMSS.sql

# 4. Redémarrer l'API
docker start orchestr-a-api-prod

# 5. Vérifier
bash scripts/health-check.sh
```

### Stratégie de Backup Recommandée

| Fréquence | Rétention | Type |
|-----------|-----------|------|
| **Quotidien** | 30 jours | Backup complet |
| **Hebdomadaire** | 12 semaines | Archive long terme |
| **Mensuel** | 12 mois | Archive compliance |

---

## 🛠️ Dépannage

### Problèmes Courants

#### 1. Conteneur ne démarre pas

```bash
# Vérifier les logs d'erreur
docker logs orchestr-a-api-prod --tail 100

# Vérifier la configuration
docker inspect orchestr-a-api-prod

# Rebuild du conteneur
docker compose --env-file .env.production -f docker-compose.prod.yml build api --no-cache
docker compose --env-file .env.production -f docker-compose.prod.yml up -d api
```

#### 2. Erreur de connexion à la base de données

```bash
# Vérifier que PostgreSQL est accessible
docker exec orchestr-a-postgres-prod psql -U postgres -c "SELECT 1;"

# Vérifier DATABASE_URL dans le conteneur API
docker exec orchestr-a-api-prod env | grep DATABASE_URL

# Test de connexion depuis l'API
docker exec orchestr-a-api-prod sh -c 'npx prisma db push --skip-generate'
```

#### 3. Erreur JWT "Unauthorized"

```bash
# Vérifier que JWT_SECRET est identique entre login et validation
docker exec orchestr-a-api-prod env | grep JWT_SECRET

# Reconstruire l'API avec les bonnes variables
docker compose --env-file .env.production -f docker-compose.prod.yml down api
docker compose --env-file .env.production -f docker-compose.prod.yml up -d api
```

#### 4. Frontend ne charge pas

```bash
# Vérifier que NEXT_PUBLIC_API_URL est correct
docker logs orchestr-a-web-prod | grep NEXT_PUBLIC_API_URL

# Vérifier la connexion API depuis le frontend
curl http://localhost:3000/_next/health

# Rebuild du frontend
docker compose --env-file .env.production -f docker-compose.prod.yml build web --no-cache
docker compose --env-file .env.production -f docker-compose.prod.yml up -d web
```

---

## 🔒 Sécurité

### Checklist de Sécurité Production

- [ ] **Mots de passe forts** (DATABASE_PASSWORD, REDIS_PASSWORD, JWT_SECRET)
- [ ] **JWT_SECRET** généré avec `openssl rand -base64 64`
- [ ] **CORS_ORIGIN** configuré avec vos domaines uniquement
- [ ] **SWAGGER_ENABLED=false** en production
- [ ] **Certificats SSL** valides (Let's Encrypt recommandé)
- [ ] **Rate limiting** activé (THROTTLE_TTL, THROTTLE_LIMIT)
- [ ] **Backups automatiques** configurés et testés
- [ ] **Logs** externalisés et analysés
- [ ] **Firewall** configuré (ports 80, 443 ouverts uniquement)
- [ ] **Updates** régulières des dépendances

### Recommandations

1. **Ne jamais committer** les fichiers `.env.production` avec des secrets
2. **Changer les mots de passe** par défaut (admin/admin123)
3. **Désactiver Swagger** en production (`SWAGGER_ENABLED=false`)
4. **Utiliser HTTPS** avec certificats valides (Let's Encrypt)
5. **Monitoring externe** (Sentry, LogRocket, Datadog)
6. **Rotation des secrets** tous les 90 jours
7. **Audits de sécurité** réguliers

---

## 📞 Support et Ressources

### Documentation

- [README.md](./README.md) - Vue d'ensemble du projet
- [STATUS-SUMMARY.md](./STATUS-SUMMARY.md) - État d'avancement
- [STACK-TECHNIQUE.md](./STACK-TECHNIQUE.md) - Architecture technique

### Scripts Utiles

| Script | Description |
|--------|-------------|
| `scripts/backup-database.sh` | Sauvegarde PostgreSQL |
| `scripts/restore-database.sh` | Restauration PostgreSQL |
| `scripts/health-check.sh` | Vérification santé application |
| `scripts/setup-cron-backup.sh` | Configuration backups automatiques |
| `scripts/deploy-production.sh` | Déploiement automatisé |

### Commandes de Debug

```bash
# État global
docker ps --filter "name=orchestr-a"

# Logs combinés
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f --tail 50

# Connexion à un conteneur
docker exec -it orchestr-a-api-prod sh
docker exec -it orchestr-a-postgres-prod psql -U postgres -d orchestr_a_prod

# Utilisation ressources
docker stats --no-stream

# Espace disque
docker system df -v
```

---

## ✅ Checklist Post-Déploiement

- [ ] Tous les conteneurs sont **healthy**
- [ ] Health check réussi (`scripts/health-check.sh`)
- [ ] Login admin fonctionne (http://localhost/login)
- [ ] API accessible (http://localhost:3001/api/health)
- [ ] Base de données peuplée (17 users, 3 projects, 18 tasks)
- [ ] Backup automatique configuré
- [ ] Certificats SSL installés (si production)
- [ ] Mots de passe par défaut changés
- [ ] Monitoring activé
- [ ] Documentation à jour

---

## 📈 Métriques de Production

### Performances Cibles

| Métrique | Cible | Acceptable |
|----------|-------|------------|
| **API Response Time** | < 100ms | < 300ms |
| **Frontend Load Time** | < 2s | < 5s |
| **Database Query Time** | < 50ms | < 150ms |
| **Uptime** | 99.9% | 99.5% |
| **Error Rate** | < 0.1% | < 1% |

### Limites de Ressources

| Service | CPU | RAM | Stockage |
|---------|-----|-----|----------|
| **API** | 2 cores | 1 GB | 500 MB |
| **Frontend** | 1 core | 512 MB | 500 MB |
| **PostgreSQL** | 2 cores | 2 GB | 10 GB |
| **Redis** | 1 core | 512 MB | 256 MB |

---

**Dernière mise à jour**: 21/11/2025
**Auteur**: ORCHESTR'A Team
**Version**: 1.0.0

---

🎉 **ORCHESTR'A V2 est maintenant en production !**
