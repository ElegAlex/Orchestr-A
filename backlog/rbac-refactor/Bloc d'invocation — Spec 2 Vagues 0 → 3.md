Arbitrages PO post-readiness Spec 2 :

1. Branche git : rester sur master (workflow habituel, cf. memory feedback_no_feature_branches).
2. Backup prod : le dump du 2026-04-19 17:36 est considéré suffisant (pas de changement prod critique depuis). Aucun nouveau pg_dump requis avant V0.
3. Cadence : enchaînement automatique V0 → V1 → V2 → V3 sans STOP intermédiaire. STOP obligatoire avant V4 (drop legacy irréversible).

====================================================================
SPEC 2 — Vagues 0 à 3 (enchaînement automatique)
====================================================================

Inputs obligatoires à lire intégralement avant toute action :
1. backlog/rbac-templates-library-design.md
2. backlog/spec-2-rbac-backend.md (la spec)
3. backlog/rbac-refactor/po-decisions.md (14 arbitrages PO)
4. backlog/rbac-refactor/audit/ (6 fichiers, inputs)
5. backlog/rbac-refactor/contract/ (5 fichiers, contrat technique — fait foi)
6. backlog/rbac-refactor/spec2-readiness.md (Phase 0 validée)

Phase 0 readiness déjà validée. Tu pars directement sur Vague 0 A.

====================================================================
VAGUE 0 — Fondations (A puis B, séquentiel)
====================================================================

TEAMMATE A — Schema, migration, seed
Suivre spec-2-rbac-backend.md §3 Vague 0 Teammate A, en respectant STRICTEMENT :
- contract-03-type-model.md pour le schema Prisma et la migration SQL.
- contract-02-templates.ts (constante LEGACY_ROLE_MIGRATION) pour le backfill.
- Migration structurée en étapes non-bloquantes (cf. Risque 5 de spec-2).
- Seed idempotent (upsert sur roles, ne touche pas aux users existants).

Critères de fin Vague 0 A non négociables :
- pnpm db:migrate passe sans erreur sur DB locale fraîche.
- pnpm db:seed insère exactement 26 rôles système (isSystem=true).
- Backfill users.role_id : zéro user avec roleId NULL après backfill. Si user résiduel, STOP et remonter au PO (pas d'enchaînement).
- Anciennes tables role_configs, permissions, role_permissions CONSERVÉES à ce stade (drop en V4).

TEAMMATE B — Package @orchestra/rbac
Suivre spec-2-rbac-backend.md §3 Vague 0 Teammate B :
- Intégrer contract-01-atomic-permissions.ts et contract-02-templates.ts dans packages/rbac/.
- Exporter les types PermissionCode, RoleTemplateKey, RoleCategoryKey, RoleTemplate et la constante ROLE_TEMPLATES.
- Tests unitaires :
  (a) pour chaque template : le count effectif correspond exactement à la table §9 de contract-05 (countss normatifs post-corrections).
  (b) test de cohérence : aucune permission inconnue (toutes présentes dans CATALOG_PERMISSIONS).
- pnpm --filter @orchestra/rbac build et pnpm --filter @orchestra/rbac test passent.

====================================================================
VAGUE 1 — Services & consommation (C + D parallèle)
====================================================================

Suivre spec-2-rbac-backend.md §3 Vague 1.

TEAMMATE C — PermissionsService + décorateurs + guards
- Respecter contract-04-helpers-api.md pour les signatures.
- PermissionsService lookup : user → roleId → role.templateKey → ROLE_TEMPLATES[templateKey].permissions. Cache in-memory (templates immutables).
- Préserver le cache Redis role-permissions:<CODE> existant (cf. audit-06 §3.2 fail-soft).
- Nouveaux décorateurs : @RequirePermission, @RequirePermissions (AND), @RequireAnyPermission (OR).
- Nouveau PermissionsGuard zero-trust (arbitrage D2 po-decisions).
- @AllowSelfService() pour allowlist (cf. contract-05 §2.12).
- OwnershipGuard adapté : consomme nouveau PermissionsService pour détecter manage_any (inclut documents:manage_any — D6 #4).
- Ancien RolesGuard et @Roles() CONSERVÉS (suppression V4).

TEAMMATE D — Endpoints CRUD rôles
- Module apps/api/src/rbac/roles.controller.ts (remplace role-management.controller.ts).
- Endpoints : GET /roles, GET /roles/templates, POST /roles, PATCH /roles/:id, DELETE /roles/:id.
- Blocage isSystem=true sur mutations (D9 po-decisions).
- @RequirePermission('users:manage_roles') sur tous les écrits.
- Suppression avec users rattachés : 409 + liste des users (cf. spec-3 Vague 1 D).

====================================================================
VAGUE 2 — Migration déclarative + zero-trust + câblages (E)
====================================================================

Suivre spec-2-rbac-backend.md §3 Vague 2 + contract-05 §3.

TEAMMATE E — Migration endpoints existants + nouveaux câblages

Ordre d'exécution interne à E (critique pour éviter de casser le back pendant la migration) :

(a) Activer le PermissionsGuard zero-trust (fail-closed) côté code MAIS avec mode "dry-run" : logger les refus au lieu de les appliquer. Durée : le temps de câbler tout le reste avant d'activer le hard-fail.

(b) Pour chaque controller de audit-02 §1 : remplacer @Permissions par @RequirePermissions avec les codes du catalogue atomique. Vérifier que chaque permission en sortie existe dans PermissionCode (strict TS impose).

(c) Câblage D3 — 8 endpoints mutants sans @Permissions (cf. contract-05 §3.1). Chaque câblage accompagné d'un test d'intégration qui valide le 403 pour user non autorisé.

(d) Câblage D4 Cat B — 7 lectures à protéger (cf. contract-05 §3.2). Idem test d'intégration.

(e) Correction D6 #1 (admin:access → reports:export), D6 #2 (leaves:validate → leaves:approve), D6 #4 (documents:manage_any câblé via OwnershipCheck), D7 (telework:manage_others → telework:manage_any partout). Cf. contract-05 §3.3 à §3.5.

(f) Correction D8 — coercion readAll sur time-tracking (cf. contract-05 §3.6).

(g) D12 — migrer la dernière occurrence de @Roles() sur role-management.controller.ts vers @RequirePermission('users:manage_roles') (cf. contract-05 §3.8).

(h) Allowlist : appliquer @AllowSelfService() aux 26 endpoints listés dans contract-05 §2.

(i) Basculer le PermissionsGuard en mode hard-fail. Rebuild. Smoke test de connexion + navigation basique.

====================================================================
VAGUE 3 — Tests d'intégration (F)
====================================================================

Suivre spec-2-rbac-backend.md §3 Vague 3.

TEAMMATE F — Tests d'intégration RBAC
- Chaque template (26) a ≥ 6 tests d'intégration (3 positifs + 3 négatifs).
- Tests manage_any : 5 permissions bypass couvertes (tasks, projects, events, time_tracking, leaves). Ajouter documents:manage_any (D6 #4). Chaque perm testée en positif (user avec perm passe) et négatif (user BASIC_USER bloqué).
- Tests de non-régression sur les 8 endpoints mutants D3.
- Tests du module roles (CRUD rôles, blocage isSystem, 409 avec users rattachés).
- pnpm --filter api test:cov — couverture RBAC > 80%.
- Rapport final : liste des tests ajoutés/modifiés + couverture atteinte par module.

====================================================================
RÈGLES D'EXÉCUTION GLOBALES (non négociables)
====================================================================

R1. Enchaînement automatique V0 → V1 → V2 → V3. Pas de STOP intermédiaire sauf échec technique bloquant (migration qui échoue, test existant cassé par un refactor, etc.). Dans ce cas : STOP, rapport d'incident, attente de validation PO.

R2. STOP impératif après V3. Ne pas lancer V4. V4 sera déclenchée par le PO après validation en prod (délai min 7 jours).

R3. Chaque vague produit un rapport de fin de vague dans backlog/rbac-refactor/spec2-progress/ :
- spec2-v0-report.md
- spec2-v1-report.md
- spec2-v2-report.md
- spec2-v3-report.md
Chaque rapport contient : actions effectuées, critères de fin validés (avec sorties brutes des commandes), points d'attention pour la vague suivante.

R4. Respect strict des contrats : contract-01 à contract-05 font foi. Si tu détectes une incohérence technique empêchant une implémentation fidèle, STOP et remonte — ne dévie pas de ton propre chef.

R5. Vérifications RÉELLES dans les rapports : chaque "✓" doit être appuyé sur une commande grep/test/build réellement exécutée, avec sa sortie brute incluse. Pas de "✓" sans preuve.

R6. Workflow git : commits atomiques par vague sur master, messages conformes convention projet. Avant V0, créer un tag Git "pre-rbac-spec2" sur HEAD actuel pour rollback manuel en cas d'incident (même si on reste sur master).

R7. Backup prod : celui du 2026-04-19 17:36 est accepté comme suffisant pour V0-V3. Aucun nouveau pg_dump requis.

====================================================================
STOP OBLIGATOIRES (toujours actifs)
====================================================================

- STOP si migration Prisma échoue (V0 A).
- STOP si un user reste avec roleId NULL après backfill (V0 A).
- STOP si un test existant précédemment vert passe rouge après un refactor (impossible à ignorer).
- STOP si couverture RBAC < 80% en fin de V3.
- STOP après V3 (règle R2).

Démarre par créer le tag Git pre-rbac-spec2, puis lance Vague 0 A.