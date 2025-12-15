# ORCHESTR'A - Audit Docker Production

> **Date** : 2025-12-15
> **Objectif** : Déploiement "one-liner" avec `docker-compose up -d`
> **Standards de référence** : Portainer, Nextcloud, Gitea, LinuxServer.io

---

## Table des matières

1. [Résumé exécutif](#résumé-exécutif)
2. [Tableau des écarts](#tableau-des-écarts)
3. [Analyse détaillée](#analyse-détaillée)
4. [Backlog de remédiation](#backlog-de-remédiation)
5. [Configurations cibles](#configurations-cibles)
6. [Checklist de validation](#checklist-de-validation)

---

## Résumé exécutif

### État actuel
L'infrastructure Docker actuelle est **fonctionnelle en développement** mais présente plusieurs obstacles à un déploiement production "zero-touch" :

- **3 problèmes CRITIQUES** : Migrations manuelles, healthcheck Redis cassé, URL frontend hardcodée
- **8 problèmes MAJEURS** : Ports exposés, dépendances incomplètes, SSL absent
- **7 problèmes MINEURS** : Labels manquants, versions non fixées, compression désactivée

### Objectif cible
```bash
git clone <repo> && cd orchestr-a
./scripts/init-env.sh        # Génère les secrets automatiquement
# Éditer CORS_ORIGIN
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
# Application fonctionnelle en ~2 minutes, sans intervention manuelle
```

---

## Tableau des écarts

| # | Élément | Fichier:Ligne | État actuel | Problème | Sévérité |
|---|---------|---------------|-------------|----------|----------|
| 1 | Migrations DB | `scripts/deploy-production.sh:165` | Exécutées manuellement via script | Requiert intervention humaine après `docker-compose up` | **CRITIQUE** |
| 2 | NEXT_PUBLIC_API_URL | `docker-compose.prod.yml:135` | Hardcodé `http://localhost:3001/api` | Variable build-time incorrecte, port 3001 au lieu de 4000 | **CRITIQUE** |
| 3 | Redis healthcheck | `docker-compose.prod.yml:46` | `redis-cli --raw incr ping` | Syntaxe incorrecte + ne teste pas l'authentification | **CRITIQUE** |
| 4 | Port PostgreSQL | `docker-compose.prod.yml:16` | `"${DATABASE_PORT:-5432}:5432"` | Exposition externe de la DB en production | **MAJEUR** |
| 5 | Port Redis | `docker-compose.prod.yml:42` | `"${REDIS_PORT:-6379}:6379"` | Exposition externe du cache | **MAJEUR** |
| 6 | Port API | `docker-compose.prod.yml:99` | `"${API_PORT:-4000}:4000"` | Bypass du reverse proxy possible | **MAJEUR** |
| 7 | Nginx depends_on | `docker-compose.prod.yml:161` | Seulement `api` | Ne dépend pas de `web`, peut démarrer avant le frontend | **MAJEUR** |
| 8 | SSL | `nginx/nginx.conf` | Pas de bloc SSL | HTTPS non disponible out-of-the-box | **MAJEUR** |
| 9 | Web depends_on | `docker-compose.prod.yml:131` | `depends_on: - api` sans condition | Peut démarrer avant que l'API soit healthy | **MAJEUR** |
| 10 | CORS_ORIGIN | `docker-compose.prod.yml:89` | Default `http://localhost:3000` | Valeur dev en production | **MAJEUR** |
| 11 | Secrets .env | `.env.production.example` | Valeurs placeholder `CHANGE_ME_*` | Configuration manuelle requise | **MAJEUR** |
| 12 | Nomenclature variables | `.env.example` vs `.env.production.example` | Dev: `POSTGRES_*`, Prod: `DATABASE_*` | Confusion, maintenance difficile | MINEUR |
| 13 | init.sql production | `docker-compose.prod.yml` | Non monté | Extension uuid-ossp non créée en prod | MINEUR |
| 14 | Nginx MIME types | `nginx/nginx.conf` | `include mime.types;` absent | Fichiers statiques mal servis | MINEUR |
| 15 | Nginx gzip | `nginx/nginx.conf` | Compression désactivée | Performance réseau sous-optimale | MINEUR |
| 16 | Version nginx | `docker-compose.prod.yml:159` | `nginx:alpine` sans tag | Version imprévisible | MINEUR |
| 17 | Labels Docker | Tous les services | Aucun label | Pas de métadonnées pour orchestration/monitoring | MINEUR |
| 18 | Log rotation | Tous les services | Non configuré | Disque peut saturer | MINEUR |

---

## Analyse détaillée

### CRITIQUE #1 : Migrations non automatisées

**Fichier** : `scripts/deploy-production.sh:165`

**Situation actuelle** :
```bash
# Ligne 165 du script de déploiement
docker-compose -f docker-compose.prod.yml exec -T api sh -c "cd packages/database && npx prisma migrate deploy"
```

**Impact** :
- Impossible de faire un déploiement "one-liner"
- Risque d'oubli des migrations
- Première installation échoue car les tables n'existent pas

**Solution** : Créer un entrypoint personnalisé pour l'API qui exécute les migrations au démarrage.

---

### CRITIQUE #2 : NEXT_PUBLIC_API_URL hardcodé

**Fichier** : `docker-compose.prod.yml:135`

**Situation actuelle** :
```yaml
environment:
  NEXT_PUBLIC_API_URL: http://localhost:3001/api  # PROBLÈME: 3001 au lieu de 4000
```

**Impact** :
- `NEXT_PUBLIC_API_URL` est une variable **build-time** pour Next.js
- La valeur est compilée dans le bundle JavaScript
- Le port 3001 est incorrect (l'API est sur 4000)
- Chaque déploiement avec un domaine différent nécessite un rebuild

**Solution** : Utiliser un build argument et mettre `/api` comme valeur par défaut (relatif au reverse proxy).

---

### CRITIQUE #3 : Healthcheck Redis incorrect

**Fichier** : `docker-compose.prod.yml:46`

**Situation actuelle** :
```yaml
healthcheck:
  test: ["CMD", "redis-cli", "--raw", "incr", "ping"]  # Syntaxe incorrecte
```

**Impact** :
- `--raw incr ping` n'est pas une commande valide
- Ne vérifie pas que l'authentification fonctionne
- Le service peut être marqué "healthy" alors qu'il ne l'est pas

**Solution** :
```yaml
healthcheck:
  test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
```

---

### MAJEUR #4-6 : Ports internes exposés

**Fichiers** : `docker-compose.prod.yml:16,42,99`

**Situation actuelle** :
```yaml
postgres:
  ports:
    - "${DATABASE_PORT:-5432}:5432"  # DB accessible depuis l'extérieur
redis:
  ports:
    - "${REDIS_PORT:-6379}:6379"     # Cache accessible depuis l'extérieur
api:
  ports:
    - "${API_PORT:-4000}:4000"       # API bypass possible
```

**Impact** :
- Surface d'attaque augmentée
- Connexions directes possibles sans passer par le reverse proxy
- Rate limiting contournable

**Solution** : Remplacer `ports` par `expose` pour communication interne uniquement.

---

### MAJEUR #7 : Dépendances Nginx incomplètes

**Fichier** : `docker-compose.prod.yml:161`

**Situation actuelle** :
```yaml
nginx:
  depends_on:
    - api  # Manque: web
```

**Impact** : Nginx peut démarrer avant que le frontend soit prêt, causant des erreurs 502.

**Solution** :
```yaml
nginx:
  depends_on:
    api:
      condition: service_healthy
    web:
      condition: service_healthy
```

---

### MAJEUR #8 : Pas de SSL out-of-the-box

**Fichier** : `nginx/nginx.conf`

**Situation actuelle** : Configuration HTTP uniquement, pas de bloc `listen 443 ssl`.

**Impact** :
- Données transmises en clair
- Non conforme aux standards de sécurité modernes
- Nécessite configuration manuelle pour HTTPS

**Solution** : Intégrer Traefik avec Let's Encrypt automatique, ou ajouter un sidecar certbot.

---

## Backlog de remédiation

### Sprint 1 : Blocages critiques (One-liner impossible)

| ID | Tâche | Priorité | Effort | Fichiers impactés |
|----|-------|----------|--------|-------------------|
| 1.1 | Créer `apps/api/docker-entrypoint.sh` avec migrations auto | P0 | 30min | Nouveau fichier |
| 1.2 | Modifier Dockerfile API pour utiliser l'entrypoint | P0 | 10min | `apps/api/Dockerfile` |
| 1.3 | Corriger healthcheck Redis avec authentification | P0 | 5min | `docker-compose.prod.yml` |
| 1.4 | Corriger NEXT_PUBLIC_API_URL en build arg | P0 | 15min | `docker-compose.prod.yml`, `apps/web/Dockerfile` |
| 1.5 | Ajouter `condition: service_healthy` sur web→api | P0 | 5min | `docker-compose.prod.yml` |

**Critère de validation Sprint 1** :
```bash
docker-compose -f docker-compose.prod.yml down -v
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d
sleep 120
curl http://localhost/api/health  # Doit retourner 200
```

---

### Sprint 2 : Sécurisation réseau

| ID | Tâche | Priorité | Effort | Fichiers impactés |
|----|-------|----------|--------|-------------------|
| 2.1 | Retirer mapping port PostgreSQL | P1 | 5min | `docker-compose.prod.yml` |
| 2.2 | Retirer mapping port Redis | P1 | 5min | `docker-compose.prod.yml` |
| 2.3 | Retirer mapping port API | P1 | 5min | `docker-compose.prod.yml` |
| 2.4 | Corriger dépendances nginx (api + web avec healthcheck) | P1 | 10min | `docker-compose.prod.yml` |

**Critère de validation Sprint 2** :
```bash
curl http://localhost:5432  # Connection refused (OK)
curl http://localhost:6379  # Connection refused (OK)
curl http://localhost:4000  # Connection refused (OK)
curl http://localhost       # 200 OK via nginx
curl http://localhost/api/health  # 200 OK via nginx
```

---

### Sprint 3 : Automatisation secrets

| ID | Tâche | Priorité | Effort | Fichiers impactés |
|----|-------|----------|--------|-------------------|
| 3.1 | Créer `scripts/init-env.sh` pour génération auto des secrets | P1 | 30min | Nouveau fichier |
| 3.2 | Mettre à jour `.env.production.example` avec documentation claire | P1 | 20min | `.env.production.example` |
| 3.3 | Ajouter validation des secrets obligatoires | P2 | 15min | `docker-compose.prod.yml` |

**Critère de validation Sprint 3** :
```bash
rm -f .env.production
./scripts/init-env.sh
cat .env.production | grep -E "PASSWORD|SECRET"  # Tous remplis avec valeurs aléatoires
```

---

### Sprint 4 : Configuration SSL/TLS

| ID | Tâche | Priorité | Effort | Fichiers impactés |
|----|-------|----------|--------|-------------------|
| 4.1 | Améliorer `nginx/nginx.conf` (MIME, gzip, headers sécurité) | P2 | 30min | `nginx/nginx.conf` |
| 4.2 | Ajouter support SSL conditionnel | P2 | 45min | `nginx/nginx.conf` |
| 4.3 | Mettre à jour `scripts/configure-ssl.sh` | P2 | 30min | `scripts/configure-ssl.sh` |

**Critère de validation Sprint 4** :
```bash
curl -I https://localhost  # Certificat valide (si configuré)
curl -I http://localhost   # Headers de sécurité présents
```

---

### Sprint 5 : Polish production-ready

| ID | Tâche | Priorité | Effort | Fichiers impactés |
|----|-------|----------|--------|-------------------|
| 5.1 | Ajouter labels Docker sur tous les services | P3 | 15min | `docker-compose.prod.yml` |
| 5.2 | Configurer log rotation | P3 | 10min | `docker-compose.prod.yml` |
| 5.3 | Fixer versions des images (nginx:1.27-alpine) | P3 | 5min | `docker-compose.prod.yml` |
| 5.4 | Monter init.sql en production | P3 | 5min | `docker-compose.prod.yml` |
| 5.5 | Harmoniser nomenclature variables env | P3 | 20min | Tous fichiers .env |
| 5.6 | Mettre à jour README section déploiement | P3 | 30min | `README.md` |

---

## Configurations cibles

### docker-compose.prod.yml (Sprint 1-5 appliqués)

Voir fichier séparé : [`docker-compose.prod.target.yml`](./docker-compose.prod.target.yml)

### Nouveaux fichiers à créer

| Fichier | Description | Sprint |
|---------|-------------|--------|
| `apps/api/docker-entrypoint.sh` | Script d'initialisation avec migrations | 1 |
| `scripts/init-env.sh` | Génération automatique des secrets | 3 |
| `docs/DEPLOYMENT.md` | Documentation déploiement simplifiée | 5 |

---

## Checklist de validation

### Déploiement One-Liner
- [ ] `docker compose up -d` démarre TOUS les services sans intervention
- [ ] Les migrations s'exécutent automatiquement au premier démarrage
- [ ] Les secrets sont générés automatiquement si absents (via `init-env.sh`)
- [ ] Aucune commande manuelle requise après `up -d`

### Sécurité
- [ ] Aucun port interne exposé (DB: 5432, Redis: 6379, API: 4000)
- [ ] Seuls ports 80/443 accessibles depuis l'extérieur
- [ ] Mots de passe obligatoires via `${VAR:?error}`
- [ ] Pas de secrets en clair dans docker-compose.yml
- [ ] Headers de sécurité nginx (X-Frame-Options, X-Content-Type-Options)
- [ ] Non-root users dans tous les containers applicatifs

### Résilience
- [ ] Healthchecks sur tous les services
- [ ] `depends_on` avec `condition: service_healthy`
- [ ] `restart: unless-stopped` sur tous les services
- [ ] Resource limits définis (CPU/RAM)
- [ ] Log rotation configurée

### Maintenabilité
- [ ] `.env.example` documenté avec commentaires
- [ ] README section déploiement claire et concise
- [ ] Scripts de backup/restore fonctionnels
- [ ] Labels Docker pour identification

### Test de validation finale
```bash
# Depuis un environnement vierge
git clone <repo> && cd orchestr-a
./scripts/init-env.sh
nano .env.production  # Modifier CORS_ORIGIN uniquement
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
sleep 120  # Attendre démarrage complet
curl http://localhost/api/health  # Doit retourner 200
docker compose -f docker-compose.prod.yml ps  # Tous "healthy"
```

---

## Historique des modifications

| Date | Version | Auteur | Description |
|------|---------|--------|-------------|
| 2025-12-15 | 1.0 | Claude (Audit) | Création initiale de l'audit |

