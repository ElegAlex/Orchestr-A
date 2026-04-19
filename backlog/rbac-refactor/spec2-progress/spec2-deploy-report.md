# Spec 2 — Deploy Report

**Date :** 2026-04-19 21:13 UTC
**Cible :** `debian@92.222.35.25:/opt/orchestra` (prod)
**Branche :** `master` — HEAD `2ab4363`
**Mode RBAC :** `enforce` dès la première startup (pas de phase permissive)

---

## Commits déployés (depuis HEAD pré-deploy `e7af32d`)

| SHA | Sujet |
|------|------|
| `d359dd0` | `fix(rbac): include packages/rbac in api Dockerfile build context` |
| `a78aee3` | `fix(rbac): copy packages/rbac in api production stage (runtime resolution)` |
| `2ab4363` | `fix(rbac): Node 22 ESM requires .ts extensions on rbac internal imports` |

Les trois fix sont strictement infra/ESM. Aucun changement fonctionnel par rapport à Spec 2 V0→V3 commits déjà mergés.

---

## Phases exécutées

### Phase 5 — Rebuild & redéploiement API

- `git pull origin master` sur VPS → `a78aee3..2ab4363` fast-forward (4 fichiers).
- `docker compose -f docker-compose.prod.yml build api` → image `orchestra-api` SHA `029f7c9ad2a5` construite en ~20 s (stage `builder` + `production`).
- `docker compose -f docker-compose.prod.yml up -d api` → container `orchestr-a-api-prod` recréé, **healthy** au bout de ~15 s.

### Phase 5.3 — État containers

```
orchestr-a-api-prod              Up 25 seconds (healthy)
orchestr-a-nginx-prod            Up 3 days (unhealthy)     ← pré-existant, hors scope
orchestr-a-postgres-prod         Up 3 days (healthy)
orchestr-a-redis-prod            Up 3 days (healthy)
orchestr-a-certbot-prod          Up 3 days
```

Anomalies hors scope signalées au PO (voir bas du rapport).

### Phase 6 — Cache Redis

```
docker exec orchestr-a-redis-prod redis-cli -a "$REDIS_PASSWORD" FLUSHDB
→ OK
```

Tout cache `role-permissions:<code>` (TTL 5 min) purgé — le prochain appel resource reconstruit depuis la DB.

### Phase 7 — Vérification DB

| Check | Résultat |
|-------|----------|
| Migration `20260419192835_rbac_v0_add_roles_table` appliquée | ✅ `finished_at = 2026-04-19 20:53:09 UTC` |
| `SELECT COUNT(*) FROM roles` | **26** ✅ |
| `SELECT COUNT(*) FROM users WHERE "roleId" IS NULL` | **0** ✅ |
| Mapping `code ↔ templateKey` cohérent | ✅ (26 lignes, même valeur sur les deux colonnes — voir annexe) |

### Phase 8 — Smoke tests

```
# Santé
docker exec orchestr-a-api-prod wget -qO- http://127.0.0.1:4000/api/health
→ {"status":"ok","timestamp":"2026-04-19T21:14:51.526Z","uptime":86.59s}

# Zero-trust (route protégée sans token)
docker exec orchestr-a-api-prod wget -S http://127.0.0.1:4000/api/roles/templates
→ HTTP/1.1 401 Unauthorized
```

Logs démarrage (extrait) :

```
[RoleManagementService] [Seed] ADMIN: rôle existant — 1 nouvelles permissions ajoutées (total attendu: 107)
[RoleManagementService] [Seed] RESPONSABLE: rôle existant — 1 nouvelles permissions ajoutées (total attendu: 104)
[RoleManagementService] [Seed] MANAGER: rôle existant — 1 nouvelles permissions ajoutées (total attendu: 71)
[NestApplication] Nest application successfully started
Server listening at http://172.19.0.5:4000
```

Aucune erreur RBAC, aucun crash, aucune exception au boot.

---

## Warning non bloquant

```
(node:1) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///app/packages/rbac/atomic-permissions.ts is not specified and it doesn't parse as CommonJS.
To eliminate this warning, add "type": "module" to /app/packages/rbac/package.json.
```

- **Impact :** cosmétique ; Node charge correctement les `.ts` via strip-types, l'API fonctionne.
- **Fix proposé :** ajouter `"type": "module"` dans `packages/rbac/package.json` (à traiter dans un commit follow-up — vérifier que les tests vitest et les imports depuis `seed.ts` restent OK).

---

## Anomalies pré-existantes (hors scope Spec 2)

À remonter au PO :

1. `orchestr-a-web-prod` en état `Created` (jamais démarré cette session). Front probablement servi par une image antérieure ou non exposé — à valider indépendamment du refactor RBAC.
2. `orchestr-a-nginx-prod` marqué `unhealthy` depuis 3 jours. Healthcheck à revoir (hors scope).
3. Container orphelin `orchestra-api-run-2d0d7d69a233` (Up 13 days) issu d'un `docker run` manuel antérieur au 2026-04-05. Non lié à Compose. Laissé en place (pas d'action destructive sans décision explicite).
4. **Backup cron manquant** (rappel du 2026-04-16) : `pg_dump` n'est pas cronifié sur le VPS — le dump `orchestra-20260419-173653.sql.gz` de cette session est manuel. Un cron quotidien + rétention 7 j reste à provisionner.

---

## Synthèse

- RBAC Spec 2 (V0→V3) **en prod avec guards en mode `enforce`**.
- 26 rôles système seedés avec `templateKey` alignés.
- 0 utilisateur orphelin (backfill `roleId` depuis l'enum legacy validé).
- Santé API ✅, zero-trust sur `/api/roles/templates` ✅, cache Redis purgé ✅.
- Reste : follow-up cosmétique (`"type": "module"`), vérification état `web`, provisionner backup cron.
