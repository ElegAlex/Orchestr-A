# ORCHESTR'A - Documentation Technique

## Index

### Audit & Backlog Docker Production

| Document | Description |
|----------|-------------|
| [docker-production-audit.md](./docker-production-audit.md) | Audit complet + Backlog de remédiation |
| [docker-compose.prod.target.yml](./docker-compose.prod.target.yml) | Configuration Docker cible (après tous les sprints) |

### Configurations cibles (dossier `targets/`)

Ces fichiers représentent l'état final visé après implémentation complète du backlog.

| Fichier | Destination finale | Status |
|---------|-------------------|--------|
| [docker-entrypoint.sh.target](./targets/docker-entrypoint.sh.target) | `apps/api/docker-entrypoint.sh` | IMPLEMENTÉ |
| [init-env.sh.target](./targets/init-env.sh.target) | `scripts/init-env.sh` | IMPLEMENTÉ |
| [nginx.conf.target](./targets/nginx.conf.target) | `nginx/nginx.conf` | IMPLEMENTÉ |
| [env.production.example.target](./targets/env.production.example.target) | `.env.production.example` | IMPLEMENTÉ |

## Backlog Résumé

### Sprint 1 : Blocages critiques (TERMINÉ 2025-12-15)
- [x] 1.1 Créer entrypoint API avec migrations auto
- [x] 1.2 Modifier Dockerfile API
- [x] 1.3 Corriger healthcheck Redis
- [x] 1.4 Corriger NEXT_PUBLIC_API_URL
- [x] 1.5 Ajouter condition healthcheck web→api
- [x] 1.6 (bonus) Ajouter healthcheck nginx + depends_on web

### Sprint 2 : Sécurisation réseau (TERMINÉ 2025-12-15)
- [x] 2.1 Retirer port PostgreSQL exposé + ajout init.sql
- [x] 2.2 Retirer port Redis exposé
- [x] 2.3 Retirer port API exposé
- [x] 2.4 Retirer port Web exposé
- [x] 2.5 Ports nginx configurables (HTTP_PORT, HTTPS_PORT)

### Sprint 3 : Automatisation secrets (TERMINÉ 2025-12-15)
- [x] 3.1 Créer script init-env.sh
- [x] 3.2 Mettre à jour .env.production.example

### Sprint 4 : Configuration SSL/TLS (TERMINÉ 2025-12-15)
- [x] 4.1 Améliorer nginx.conf (MIME, gzip, headers, rate limiting)
- [x] 4.2 Support SSL conditionnel (commenté, prêt à activer)
- [x] 4.3 Cache statique Next.js (_next/static)
- [x] 4.4 Endpoint healthcheck nginx (/nginx-health)

### Sprint 5 : Polish production-ready (TERMINÉ 2025-12-15)
- [x] 5.1 Labels Docker (com.orchestr-a.service, com.orchestr-a.tier)
- [x] 5.2 Log rotation (json-file driver avec max-size/max-file)
- [x] 5.3 Fixer versions images (nginx:1.27-alpine)
- [x] 5.4 Monter init.sql en production
- [x] 5.5 Redis persistence (appendonly yes)
- [x] 5.6 Mettre à jour README section déploiement

### Sprint 6 : Corrections post-déploiement (TERMINÉ 2025-12-15)
- [x] 6.1 Fix TypeScript: prop `onImportMilestones` manquante dans `MilestoneRoadmap.tsx`
- [x] 6.2 Créer migration Prisma pour tables manquantes (app_settings, personal_todos, leave_type_configs, leave_validation_delegates)
- [x] 6.3 Automatiser création compte admin dans entrypoint
- [x] 6.4 Ajouter fallback `db push` si migrations échouent

## Fichiers modifiés (Sprint 6)

| Fichier | Modification |
|---------|-------------|
| `apps/web/src/components/MilestoneRoadmap.tsx` | Ajout prop `onImportMilestones` |
| `apps/api/docker-entrypoint.sh` | Ajout seeding admin + fallback db push |
| `packages/database/prisma/migrations/20251215120000_add_missing_tables/` | Nouvelle migration |

## Validation finale

```bash
# Test complet from scratch
git clone <repo> && cd orchestr-a
./scripts/init-env.sh
# Éditer CORS_ORIGIN dans .env.production
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
sleep 120
curl http://localhost/api/health  # Doit retourner 200
docker compose --env-file .env.production -f docker-compose.prod.yml ps  # Tous "healthy"
```

## Compte admin par défaut

| Champ | Valeur |
|-------|--------|
| Email | `admin@orchestr-a.internal` |
| Login | `admin` |
| Mot de passe | `admin123` |

**Important** : Changer le mot de passe admin après le premier déploiement.
