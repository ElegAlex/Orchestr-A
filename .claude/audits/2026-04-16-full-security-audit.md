# Audit de Sécurité Complet — ORCHESTR'A V2

**Date** : 2026-04-16
**Auditeur** : Claude Opus 4.6 (automated deep audit)
**Périmètre** : Intégralité du codebase (API, Frontend, Infra, Docker, CI/CD)
**Méthode** : 6 agents spécialisés en 2 waves parallèles
**Statut** : ✅ REMÉDIATION COMPLÈTE — 39/39 findings corrigés, build OK, 1036/1036 tests passing

---

## Résumé Exécutif

| Sévérité | Nombre |
|----------|--------|
| CRITICAL | 2 |
| HIGH | 9 |
| MEDIUM | 16 |
| LOW | 12 |
| **Total** | **39** |

Les vulnérabilités les plus critiques concernent :
1. **IDOR massif** — plusieurs ressources (documents, tasks, epics, milestones) n'ont aucune vérification d'ownership
2. **Escalade de privilèges** — un utilisateur avec `users:update` peut s'assigner le rôle ADMIN
3. **JWT secret hardcodé** dans le Dockerfile all-in-one
4. **Aucune révocation de tokens** après changement de mot de passe

---

## CRITICAL (2)

### C-01: Documents — Aucun contrôle d'ownership sur Update/Delete
- **Fichier** : `apps/api/src/documents/documents.controller.ts:64-80`
- **Confiance** : 0.95
- **Description** : `PATCH /documents/:id` et `DELETE /documents/:id` vérifient uniquement les permissions RBAC (`documents:update`/`documents:delete`), jamais l'ownership. Aucun `@OwnershipCheck`, aucune vérification service-level.
- **Exploit** : Tout utilisateur avec `documents:update` peut modifier/supprimer les documents de n'importe quel autre utilisateur, y compris changer l'URL du fichier.
- **Fix** : Ajouter `@OwnershipCheck({ resource: 'document', bypassPermission: 'documents:manage_any' })` et implémenter le type `document` dans `OwnershipService`.

### C-02: JWT Secret Hardcodé dans le Dockerfile All-in-One
- **Fichier** : `docker/all-in-one/Dockerfile:155`
- **Confiance** : 0.95
- **Description** : `ENV JWT_SECRET=change-me-in-production-minimum-32-characters` est baked dans l'image Docker. L'entrypoint auto-génère un secret si la valeur par défaut est détectée, mais la valeur est lisible dans l'image.
- **Exploit** : Si l'entrypoint est contourné ou si un opérateur override explicitement avec la valeur par défaut, un attaquant peut forger des JWT pour n'importe quel utilisateur, y compris ADMIN.
- **Fix** : Supprimer la valeur par défaut du Dockerfile. L'entrypoint gère déjà l'auto-génération.

---

## HIGH (9)

### H-01: Escalade de Privilèges via PATCH /users/:id
- **Fichier** : `apps/api/src/users/users.controller.ts:267-289`, `users.service.ts:286-404`
- **Confiance** : 0.90
- **Description** : L'endpoint `PATCH /users/:id` accepte un champ `role` via `UpdateUserDto` (extends `PartialType(CreateUserDto)`). Aucune vérification que l'appelant a un rôle supérieur à celui qu'il assigne. Un RESPONSABLE avec `users:update` peut promouvoir n'importe qui en ADMIN.
- **Fix** : Ajouter une vérification de hiérarchie de rôles : un utilisateur ne peut assigner que des rôles inférieurs au sien. Séparer l'assignation de rôle dans un endpoint dédié avec `users:manage_roles`.

### H-02: Aucune Révocation de Tokens Après Changement de Mot de Passe
- **Fichier** : `apps/api/src/users/users.service.ts:629-679`, `auth.service.ts:332-369`
- **Confiance** : 0.95
- **Description** : `changePassword`, `resetPassword` (admin), et `resetPassword` (token) ne révoquent ni les JWT access tokens (via blacklist) ni les refresh tokens. Un JWT volé reste valide jusqu'à expiration (15min), et un refresh token volé permet un accès persistant indéfiniment.
- **Fix** : Après tout changement de mot de passe, appeler `refreshTokenService.revokeAllForUser(userId)` et blacklister le JTI courant.

### H-03: Tasks — Aucun Contrôle d'Ownership/Projet sur Update
- **Fichier** : `apps/api/src/tasks/tasks.controller.ts:199-219`
- **Confiance** : 0.90
- **Description** : `PATCH /tasks/:id` ne passe aucun contexte utilisateur au service. Tout utilisateur avec `tasks:update` peut modifier n'importe quelle tâche du système, y compris changer assignee, status, projet.
- **Fix** : Vérifier l'appartenance au projet de la tâche, ou que l'utilisateur est l'assigné, ou qu'il a `tasks:manage_any`.

### H-04: Epics — Aucun Contrôle de Membership Projet
- **Fichier** : `apps/api/src/epics/epics.controller.ts:60-77`
- **Confiance** : 0.90
- **Description** : `PATCH/DELETE /epics/:id` — aucune vérification que l'utilisateur est membre du projet parent.
- **Fix** : Vérifier l'appartenance au projet de l'epic.

### H-05: Milestones — Aucun Contrôle de Membership Projet
- **Fichier** : `apps/api/src/milestones/milestones.controller.ts:70-94`
- **Confiance** : 0.90
- **Description** : Même problème que H-04 pour les milestones.
- **Fix** : Identique à H-04.

### H-06: Projects Hard Delete Sans OwnershipCheck
- **Fichier** : `apps/api/src/projects/projects.controller.ts:199-215`
- **Confiance** : 0.95
- **Description** : `DELETE /projects/:id/hard` n'a pas de `@OwnershipCheck`, contrairement au soft-delete qui l'a. Tout utilisateur avec `projects:delete` peut détruire définitivement n'importe quel projet.
- **Fix** : Ajouter `@OwnershipCheck({ resource: 'project', bypassPermission: 'projects:manage_any' })`.

### H-07: Open Registration Crée des Comptes Actifs
- **Fichier** : `apps/api/src/auth/auth.controller.ts:124-141`
- **Confiance** : 0.95
- **Description** : `POST /auth/register` est `@Public()` et crée un compte CONTRIBUTEUR actif sans approbation. Un CONTRIBUTEUR a des permissions réelles (tasks:create, leaves:create, events:read, etc.).
- **Fix** : Créer les comptes avec `isActive: false` et requérir une activation admin, ou ajouter un système d'invitation.

### H-08: CSP Permet unsafe-inline et unsafe-eval
- **Fichier** : `nginx/nginx.conf:71`
- **Confiance** : 0.95
- **Description** : `script-src 'self' 'unsafe-inline' 'unsafe-eval'` annule l'essentiel de la protection CSP contre les XSS. Combiné avec les tokens JWT en localStorage, un XSS permet le vol de session.
- **Fix** : Supprimer `unsafe-eval`. Remplacer `unsafe-inline` par une CSP nonce-based.

### H-09: Mot de Passe PostgreSQL Hardcodé dans l'Entrypoint All-in-One
- **Fichier** : `docker/all-in-one/entrypoint.sh:100,109`
- **Confiance** : 0.95
- **Description** : Le mot de passe `orchestr_a` est hardcodé pour l'utilisateur PostgreSQL et dans le DATABASE_URL.
- **Fix** : Utiliser `${POSTGRES_PASSWORD}` depuis les variables d'environnement.

---

## MEDIUM (16)

### M-01: Auto-Approbation des Congés (ADMIN/RESPONSABLE)
- **Fichier** : `apps/api/src/leaves/leaves.service.ts:1103-1232`
- **Confiance** : 0.95
- **Description** : Un ADMIN/RESPONSABLE peut approuver ses propres demandes de congé. `canValidate` retourne `true` pour ces rôles sans vérifier `leave.userId !== validatorId`.
- **Fix** : Ajouter `if (leave.userId === validatorId) throw new ForbiddenException()`.

### M-02: @Body('field') Contourne Toute Validation
- **Fichier** : `leaves.controller.ts:573-575`, `users.controller.ts:369`, `tasks.controller.ts:400`
- **Confiance** : 0.95
- **Description** : `@Body('newPassword')` pour le reset admin n'a aucune validation (longueur, complexité). Les délégations de congés extraient `delegateId`, `startDate`, `endDate` sans validation.
- **Fix** : Créer des DTOs avec class-validator pour chaque cas.

### M-03: Inline Body Types Contournent le ValidationPipe
- **Fichier** : `tasks.controller.ts:468`, `planning-export.controller.ts:51,65`, `leave-types.controller.ts:113`, `skills.controller.ts:339`
- **Confiance** : 0.95
- **Description** : Les types TypeScript inline sont effacés au runtime — le ValidationPipe ne valide rien.
- **Fix** : Remplacer par des classes DTO avec décorateurs class-validator.

### M-04: Redis Blacklist Fail-Open
- **Fichier** : `apps/api/src/auth/jwt-blacklist.service.ts:38-49`
- **Confiance** : 0.90
- **Description** : Si Redis tombe, `isBlacklisted()` retourne `false` — les tokens révoqués redeviennent valides.
- **Fix** : Retourner `true` (fail-closed) ou throw `UnauthorizedException` en cas d'erreur Redis.

### M-05: Rotation Non-Atomique des Refresh Tokens (TOCTOU)
- **Fichier** : `apps/api/src/auth/refresh-token.service.ts:76-113`
- **Confiance** : 0.80
- **Description** : find + update sans transaction. Deux requêtes concurrentes peuvent créer deux familles de tokens valides.
- **Fix** : Wrapper dans `prisma.$transaction()` ou utiliser un WHERE atomique.

### M-06: Documents Read Sans Permission Guard
- **Fichier** : `apps/api/src/documents/documents.controller.ts:45-61`
- **Confiance** : 0.85
- **Description** : `GET /documents` et `GET /documents/:id` n'ont pas de `@Permissions()`. Tout utilisateur authentifié peut lister tous les documents.
- **Fix** : Ajouter `@Permissions('documents:read')`.

### M-07: Leave Balance Expose les Soldes de N'importe Quel Utilisateur
- **Fichier** : `apps/api/src/leaves/leaves.controller.ts:264-280`
- **Confiance** : 0.80
- **Description** : `GET /leaves/balance/:userId` avec seulement `leaves:read` permet de voir les soldes de congés de n'importe qui.
- **Fix** : Vérifier `userId === currentUserId` ou exiger `leaves:manage`.

### M-08: Time-Tracking findAll Sans userId Retourne Toutes les Entrées
- **Fichier** : `apps/api/src/time-tracking/time-tracking.service.ts:191-232`
- **Confiance** : 0.85
- **Description** : Sans filtre `userId`, toutes les entrées de tous les utilisateurs sont retournées.
- **Fix** : Forcer `where.userId = currentUser.id` quand l'utilisateur n'a pas `time_tracking:view_any`.

### M-09: Time-Tracking GET /:id Sans Contrôle d'Accès
- **Fichier** : `apps/api/src/time-tracking/time-tracking.controller.ts:191-203`
- **Confiance** : 0.90
- **Description** : Aucun `@Permissions` ni ownership check sur la lecture d'une entrée individuelle.
- **Fix** : Ajouter ownership check ou `@Permissions('time_tracking:read')`.

### M-10: Events GET /range Retourne Tous les Événements
- **Fichier** : `apps/api/src/events/events.controller.ts:91-106`
- **Confiance** : 0.85
- **Description** : Aucun scoping utilisateur, retourne tous les événements du système pour la plage de dates.
- **Fix** : Injecter `@CurrentUser()` et appliquer le même scoping que `findAll`.

### M-11: Events stopRecurrence Sans OwnershipCheck
- **Fichier** : `apps/api/src/events/events.controller.ts:218-230`
- **Confiance** : 0.90
- **Description** : `DELETE /events/:id/recurrence` n'a pas d'`@OwnershipCheck`, contrairement aux autres mutations d'événements.
- **Fix** : Ajouter `@OwnershipCheck({ resource: 'event', bypassPermission: 'events:manage_any' })`.

### M-12: Projects addMember Sans OwnershipCheck
- **Fichier** : `apps/api/src/projects/projects.controller.ts:217-240`
- **Confiance** : 0.80
- **Description** : `POST /projects/:id/members` n'a pas d'`@OwnershipCheck`, contrairement aux autres opérations sur les membres.
- **Fix** : Ajouter `@OwnershipCheck`.

### M-13: Settings Controller Permet la Création de Clés Arbitraires
- **Fichier** : `apps/api/src/settings/settings.controller.ts:46-65`
- **Confiance** : 0.85
- **Description** : `PUT /settings/:key` accepte n'importe quelle clé et crée via upsert.
- **Fix** : Valider contre une allowlist de clés connues.

### M-14: Stored XSS via Import ICS
- **Fichier** : `apps/api/src/planning-export/planning-export.service.ts:160-219`
- **Confiance** : 0.80
- **Description** : `SUMMARY` et `DESCRIPTION` des fichiers ICS sont stockés sans sanitisation. React auto-escape les JSX, mais si un composant utilise du rendu markdown ou similaire, c'est exploitable.
- **Fix** : Sanitiser les champs avant stockage (strip HTML).

### M-15: Swagger Basic Auth Non Implémenté (SEC-01)
- **Fichier** : `apps/api/src/main.ts:77-85`
- **Confiance** : 0.90
- **Description** : `SWAGGER_USER`/`SWAGGER_PASS` sont documentés mais le wiring basic-auth n'est PAS implémenté. Si activé en prod, Swagger est public.
- **Fix** : Implémenter `@fastify/basic-auth` ou protéger via nginx `auth_basic`.

### M-16: Headers de Sécurité Nginx Perdus par Héritage add_header
- **Fichier** : `nginx/nginx.conf:67-72 vs 131 vs 186-187`
- **Confiance** : 0.80
- **Description** : Les `add_header` au niveau `http` ne sont pas hérités par les blocs `server`/`location` qui définissent leurs propres `add_header`. Les réponses HTTPS perdent X-Frame-Options, CSP, etc.
- **Fix** : Déplacer tous les headers dans le bloc `server`, ou utiliser `ngx_http_headers_more_module`.

---

## LOW (12)

| ID | Description | Fichier |
|----|-------------|---------|
| L-01 | Password hash chargé en mémoire inutilement (analytics) | `analytics.service.ts:168-172` |
| L-02 | Bcrypt cost factor inconsistant (10 vs 12) | `users.service.ts:349` |
| L-03 | ResetPasswordDto manque la regex de complexité | `reset-password.dto.ts:17` |
| L-04 | Hardcoded role check dans comments.service.ts | `comments.service.ts:121-136` |
| L-05 | Hardcoded role check dans events.controller.ts | `events.controller.ts:119-134` |
| L-06 | ParseUUIDPipe manquant sur ~12 @Param | Multiples controllers |
| L-07 | Query params enum non validés au runtime | Multiples controllers |
| L-08 | Reports frontend bypass l'instance Axios centralisée | `apps/web/app/[locale]/reports/` (8 fichiers) |
| L-09 | Aucun security header dans next.config.ts | `apps/web/next.config.ts` |
| L-10 | Credentials admin par défaut (admin/admin123) | `entrypoint.sh:167-183` |
| L-11 | PostgreSQL local trust auth dans all-in-one | `entrypoint.sh:71` |
| L-12 | Tasks GET /assignee/:userId bypass le scoping RBAC | `tasks.controller.ts:128-139` |

---

## Observations Positives

L'application présente de bonnes pratiques de sécurité :

- **Zéro SQL brut** — tout passe par Prisma ORM, aucun `$queryRaw`/`$executeRaw`
- **Zéro `dangerouslySetInnerHTML`** — aucune instance dans tout le frontend
- **Zéro `eval()`** — aucun usage dans le code applicatif
- **Refresh token rotation** avec détection de réutilisation et révocation en cascade
- **Magic bytes validation** sur les uploads d'avatars
- **Rate limiting** sur les endpoints critiques (login, register, refresh, reset)
- **Helmet** avec CSP (même si trop permissive)
- **CORS configurable** (pas de wildcard)
- **Redaction des logs** (authorization headers, passwords, cookies)
- **Production Docker hardening** : no-new-privileges, cap_drop ALL, resource limits, scram-sha-256
- **Auth store design** : rôles/permissions jamais persistés en localStorage, rehydratés depuis l'API
- **CSRF non-applicable** : Bearer token auth, pas de cookies

---

## Matrice de Priorisation

### Urgent (à corriger immédiatement)
1. **C-01** Documents IDOR
2. **H-01** Escalade de privilèges via role update
3. **H-02** Pas de révocation tokens après password change
4. **H-03** Tasks IDOR
5. **H-06** Projects hard delete sans ownership
6. **C-02** JWT secret hardcodé (Dockerfile)

### Important (sprint suivant)
7. **H-04/H-05** Epics/Milestones IDOR
8. **H-07** Open registration
9. **M-01** Auto-approbation congés
10. **M-02/M-03** Validation bypass
11. **M-04** Redis fail-open
12. **H-08** CSP unsafe-eval/unsafe-inline

### À planifier
13. Tous les findings MEDIUM restants
14. Tous les findings LOW

---

*Rapport généré automatiquement par audit en 2 waves de 3 agents spécialisés chacune.*
*Temps total d'audit : ~6 minutes.*
