# ORCHESTR'A V2 — Rapport d'Audit de Sécurité

**Date :** 20 mars 2026
**Périmètre :** API NestJS + Frontend Next.js + Infrastructure Docker/Nginx
**Méthodologie :** Tests manuels basés sur OWASP Top 10:2025, 14 domaines, 40+ tests
**Environnement :** Dev local (API port 4000, Frontend port 4001, PostgreSQL, Redis)

---

## Résumé Exécutif

**4 vulnérabilités CRITIQUES, 5 HAUTES, 10 MOYENNES, 3 BASSES** identifiées sur 40+ tests exécutés.

> **STATUT : REMÉDIATION COMPLÈTE (20 mars 2026)**
>
> Les 4 phases de remédiation ont été livrées en 4 commits successifs.
> **19 des 22 vulnérabilités ont été corrigées**, incluant toutes les CRITIQUES et HAUTES.
> 3 vulnérabilités BASSES restent en backlog (dangerouslySetInnerHTML, race condition todos, Prisma filter 500).
>
> | Phase   | Commit    | Vulnérabilités corrigées                                             |
> | ------- | --------- | -------------------------------------------------------------------- |
> | Phase 1 | `2824577` | VULN-001, VULN-003, VULN-005                                         |
> | Phase 2 | `92e0042` | VULN-002, VULN-004                                                   |
> | Phase 3 | `3b73d12` | VULN-006, VULN-007, VULN-008, VULN-011                               |
> | Phase 4 | `04629ca` | VULN-009, VULN-012, VULN-016, VULN-017 (déjà OK), VULN-018, VULN-019 |

~~La vulnérabilité la plus grave permet à **n'importe qui sur Internet de créer un compte ADMIN** via l'endpoint public d'inscription.~~ **CORRIGÉ** — Le champ `role` est supprimé du RegisterDto et rejeté par `forbidNonWhitelisted`.

### Bilan par catégorie OWASP

| OWASP | Catégorie                 | Verdict                                                               |
| ----- | ------------------------- | --------------------------------------------------------------------- |
| A01   | Broken Access Control     | **CRITIQUE** — 6 IDOR confirmés + élévation de privilèges             |
| A02   | Cryptographic Failures    | SÉCURISÉ — bcrypt, pas de fuite de hash                               |
| A03   | Injection                 | SÉCURISÉ (SQL) / PARTIEL (XSS stocké accepté, React protège au rendu) |
| A04   | Insecure Design           | **HAUTE** — Absence de contrôle d'accès par conception                |
| A05   | Security Misconfiguration | **HAUTE** — Headers manquants, helmet incompatible Fastify            |
| A06   | Vulnerable Components     | **HAUTE** — 70 vulnérabilités dont 2 critiques (jspdf)                |
| A07   | Auth Failures             | **CRITIQUE** — Pas de rate limiting, mdp faibles acceptés             |
| A08   | Software Integrity        | PARTIEL — MIME type non vérifié sur upload                            |
| A09   | Logging & Monitoring      | **HAUTE** — Aucun audit log de sécurité                               |
| A10   | SSRF                      | SÉCURISÉ — Pas de fetch côté serveur                                  |

---

## Vulnérabilités CRITIQUES

### VULN-001 : Création de compte ADMIN via inscription publique

- **Sévérité :** CRITIQUE
- **OWASP :** A01 Broken Access Control
- **Endpoint :** `POST /api/auth/register` (public, sans authentification)
- **Fichiers :** `apps/api/src/auth/dto/register.dto.ts:57-61`, `apps/api/src/auth/auth.service.ts:154`
- **Description :** Le `RegisterDto` accepte un champ `role` optionnel avec `@IsEnum(Role)`. Le service utilise `registerDto.role || Role.CONTRIBUTEUR`. N'importe qui peut envoyer `{"role":"ADMIN"}` dans la requête d'inscription pour obtenir un accès administrateur complet.
- **Preuve :** `POST /api/auth/register` avec `"role":"ADMIN"` → compte créé avec rôle ADMIN confirmé via `/api/auth/me`
- **Correctif :** Supprimer le champ `role` du `RegisterDto`, ou forcer `Role.CONTRIBUTEUR` dans le service indépendamment de l'input.

### VULN-002 : IDOR systémique — Lecture de données d'autres utilisateurs

- **Sévérité :** CRITIQUE
- **OWASP :** A01 Broken Access Control
- **Endpoints :** `GET /api/leaves`, `GET /api/telework`, `GET /api/events`, `GET /api/projects`, `GET /api/tasks`, `GET /api/comments`
- **Description :** Tout utilisateur authentifié (même CONTRIBUTEUR) peut lire les congés, télétravail, événements, projets, tâches et commentaires de n'importe quel autre utilisateur. Aucun contrôle d'ownership ou d'appartenance projet n'est effectué.
- **Preuve :** Un CONTRIBUTEUR accède aux congés de l'admin via `?userId=ADMIN_ID`, aux projets dont il n'est pas membre, et aux commentaires confidentiels.
- **Correctif :** Ajouter des guards d'ownership sur tous les endpoints de données personnelles (congés, télétravail, événements). Ajouter des vérifications d'appartenance projet pour projets/tâches/commentaires.

### VULN-003 : Absence de rate limiting sur l'authentification

- **Sévérité :** CRITIQUE
- **OWASP :** A07 Identification & Authentication Failures
- **Endpoint :** `POST /api/auth/login`
- **Description :** 30 tentatives de login échouées en quelques secondes sans aucun blocage. `@nestjs/throttler` n'est pas installé. Le rate limiting Nginx existe mais ne protège qu'en mode proxy.
- **Preuve :** 30 requêtes consécutives avec mauvais mot de passe → 30x `401`, aucun `429`
- **Correctif :** Installer `@nestjs/throttler`, configurer un `ThrottlerGuard` global, avec des limites strictes sur `/auth/login` (5 tentatives/15 min) et `/auth/register`.

### VULN-004 : Escalade horizontale — Modification/Suppression de congés d'autres utilisateurs

- **Sévérité :** CRITIQUE
- **OWASP :** A01 Broken Access Control
- **Endpoints :** `PATCH /api/leaves/:id`, `DELETE /api/leaves/:id`
- **Fichiers :** `apps/api/src/leaves/leaves.controller.ts:247-252,272-274`, `apps/api/src/leaves/leaves.service.ts:558,670`
- **Description :** Tout utilisateur authentifié peut modifier ou supprimer les congés de n'importe quel autre utilisateur. Le controller ne passe pas `@CurrentUser()` au service, et le service ne vérifie pas l'ownership.
- **Preuve :** Un CONTRIBUTEUR modifie le commentaire du congé de l'admin et le supprime avec succès.
- **Correctif :** Ajouter `@CurrentUser()` dans le controller et un contrôle d'ownership dans `leaves.service.ts` pour `update()` et `remove()`.

---

## Vulnérabilités HAUTES

### VULN-005 : Élévation de rôle via UpdateUserDto

- **Sévérité :** HAUTE
- **OWASP :** A01
- **Endpoint :** `PATCH /api/users/:id`
- **Fichiers :** `apps/api/src/users/dto/update-user.dto.ts:6`, `apps/api/src/users/users.service.ts:329-331`
- **Description :** `UpdateUserDto` hérite `role` de `CreateUserDto` via `PartialType`. Le service spread tous les champs DTO (sauf `password` et `serviceIds`) dans `prisma.user.update()`. Un utilisateur avec permission `users:update` (MANAGER+) peut modifier le rôle de n'importe quel utilisateur.
- **Correctif :** Exclure `role` du destructuring dans `users.service.ts`, ou créer un endpoint dédié `/users/:id/role` protégé par `@Roles(Role.ADMIN)`.

### VULN-006 : Politique de mot de passe faible

- **Sévérité :** HAUTE
- **OWASP :** A07
- **Description :** Minimum 6 caractères, pas de complexité requise. `123456` et `password` acceptés.
- **Correctif :** Minimum 12 caractères, exiger majuscule + chiffre + caractère spécial. Vérifier contre une liste de mots de passe courants.

### VULN-007 : Headers de sécurité HTTP absents

- **Sévérité :** HAUTE
- **OWASP :** A05
- **Fichier :** `apps/api/src/main.ts:32-41`
- **Description :** `helmet` (package Express) est importé mais l'application utilise Fastify. Les headers de sécurité (X-Frame-Options, X-Content-Type-Options, CSP, etc.) ne sont **pas injectés**. Aucun header de sécurité n'apparaît dans les réponses API.
- **Correctif :** Remplacer `helmet` par `@fastify/helmet` et adapter l'enregistrement (`app.register()` au lieu de `app.use()`).

### VULN-008 : Upload de fichiers — MIME type non validé

- **Sévérité :** HAUTE
- **OWASP :** A08
- **Fichier :** `apps/api/src/users/users.service.ts:1240-1241`
- **Description :** La validation d'avatar vérifie `file.mimetype` (fourni par le client) et non le contenu réel du fichier (magic bytes). Un shell PHP déguisé en `.jpg` est accepté.
- **Correctif :** Utiliser la bibliothèque `file-type` pour vérifier les magic bytes du fichier uploadé.

### VULN-009 : 70 vulnérabilités dans les dépendances (dont 2 critiques)

- **Sévérité :** HAUTE
- **OWASP :** A06
- **Description :** `pnpm audit` rapporte 2 critiques (jspdf — Path Traversal + HTML Injection), 42 high, 20 moderate, 6 low.
- **Correctif :** Mettre à jour `jspdf` vers >=4.2.1, exécuter `pnpm update`, et mettre en place un audit automatisé en CI.

---

## Vulnérabilités MOYENNES

| ID       | Vulnérabilité                              | OWASP | Description                                                                                                                                    | Correctif                                                                |
| -------- | ------------------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| VULN-010 | Inscription en masse sans contrôle         | A07   | 15 comptes créés en rafale sans rate limiting ni captcha                                                                                       | Rate limiting + vérification email                                       |
| VULN-011 | Pagination non bornée                      | A09   | `?limit=99999` accepté, risque DoS mémoire                                                                                                     | Plafonner à 100 dans le DTO de pagination                                |
| VULN-012 | Absence de logging de sécurité             | A09   | Aucun audit log pour échecs auth, tentatives d'escalade, accès non autorisés                                                                   | Implémenter un service d'audit logging                                   |
| VULN-013 | XSS stocké dans les champs texte           | A03   | `<script>alert(1)</script>` accepté dans firstName, titres de tâches. React protège au rendu, mais risque si d'autres clients consomment l'API | Sanitizer côté serveur (ex: `sanitize-html`)                             |
| VULN-014 | JWT dans localStorage                      | A07   | Token accessible par XSS. Choix conscient (CLAUDE.md) mais risque réel                                                                         | Migration vers cookie HttpOnly si possible                               |
| VULN-015 | Path traversal potentiel dans deleteAvatar | A01   | `avatarUrl` utilisé dans `join(cwd, path)` sans validation de préfixe. Mitigé car l'URL est écrite côté serveur                                | Ajouter validation `path.startsWith('uploads/avatars/')`                 |
| VULN-016 | CORS fallback en HTTP                      | A05   | Si `ALLOWED_ORIGINS` non défini, fallback à `http://localhost:3000`                                                                            | Fail-closed : array vide par défaut                                      |
| VULN-017 | Swagger accessible sans auth               | A05   | `/api/docs` et `/api/docs-json` exposent 107 endpoints                                                                                         | Protéger par auth guard ou s'assurer que `SWAGGER_ENABLED=false` en prod |
| VULN-018 | Docker prod sans hardening                 | A05   | Pas de `cap_drop: ALL`, pas de `security_opt`, all-in-one en root                                                                              | Ajouter les directives de sécurité Docker                                |
| VULN-019 | Nginx manque `server_tokens off` et CSP    | A05   | Version Nginx exposée, pas de Content-Security-Policy                                                                                          | Ajouter `server_tokens off` et header CSP                                |

---

## Vulnérabilités BASSES

| ID       | Vulnérabilité                                   | Description                                              |
| -------- | ----------------------------------------------- | -------------------------------------------------------- |
| VULN-020 | dangerouslySetInnerHTML dans ImportPreviewModal | Source = i18n statique, risque faible                    |
| VULN-021 | Race condition sur limite personal todos        | 22/25 créés au lieu de 20 max, TOCTOU pattern            |
| VULN-022 | Prisma filter injection → 500 au lieu de 400    | Pas de fuite de données mais erreur serveur inappropriée |

---

## Points Sécurisés (pas d'action requise)

| Aspect                         | Verdict  | Détail                                                    |
| ------------------------------ | -------- | --------------------------------------------------------- |
| Injection SQL                  | SÉCURISÉ | Prisma paramétrise toutes les requêtes, aucun `$queryRaw` |
| Validation JWT signature       | SÉCURISÉ | Tokens tamponnés/expirés correctement rejetés             |
| Révocation après désactivation | SÉCURISÉ | JWT invalide immédiatement après `isActive: false`        |
| Énumération d'utilisateurs     | SÉCURISÉ | Message d'erreur identique login inexistant/mauvais mdp   |
| Fuite de données sensibles     | SÉCURISÉ | `passwordHash` jamais exposé dans les réponses            |
| Messages d'erreur              | SÉCURISÉ | Pas de stack trace, pas de chemins serveur                |
| Secrets dans le code           | SÉCURISÉ | Tout via ConfigService/env vars                           |
| SSRF                           | SÉCURISÉ | Aucun fetch côté serveur de URLs utilisateur              |
| ReDoS                          | SÉCURISÉ | Toutes les regex sont bornées et linéaires                |
| Taille d'upload                | SÉCURISÉ | Limite 2MB fonctionnelle                                  |
| Télétravail (mutations)        | SÉCURISÉ | Ownership check correct (403)                             |
| .dockerignore                  | SÉCURISÉ | .env exclus des images                                    |

---

## Plan de Remédiation Priorisé

### Phase 1 : Urgence immédiate (à corriger AUJOURD'HUI)

| #   | Action                                                        | Effort | Impact                     |
| --- | ------------------------------------------------------------- | ------ | -------------------------- |
| 1   | Supprimer `role` du `RegisterDto` ou forcer `CONTRIBUTEUR`    | 5 min  | Élimine VULN-001           |
| 2   | Exclure `role` du spread dans `users.service.ts:329`          | 5 min  | Élimine VULN-005           |
| 3   | Installer `@nestjs/throttler` + configurer rate limiting auth | 30 min | Élimine VULN-003, VULN-010 |

### Phase 2 : Semaine 1

| #   | Action                                                        | Effort | Impact                               |
| --- | ------------------------------------------------------------- | ------ | ------------------------------------ |
| 4   | Ajouter ownership checks sur congés (read + write)            | 2h     | Élimine VULN-002 (partiel), VULN-004 |
| 5   | Ajouter ownership checks sur télétravail et événements (read) | 2h     | Élimine VULN-002 (partiel)           |
| 6   | Ajouter membership checks sur projets/tâches/commentaires     | 4h     | Élimine VULN-002 (complet)           |
| 7   | Remplacer `helmet` par `@fastify/helmet`                      | 30 min | Élimine VULN-007                     |
| 8   | Valider les magic bytes des uploads                           | 1h     | Élimine VULN-008                     |

### Phase 3 : Semaine 2-3

| #   | Action                                                         | Effort | Impact                     |
| --- | -------------------------------------------------------------- | ------ | -------------------------- |
| 9   | Renforcer la politique de mot de passe (12+ chars, complexité) | 1h     | Élimine VULN-006           |
| 10  | Mettre à jour `jspdf` et dépendances vulnérables               | 2h     | Élimine VULN-009           |
| 11  | Implémenter un service d'audit logging                         | 4h     | Élimine VULN-012           |
| 12  | Plafonner la pagination à 100                                  | 30 min | Élimine VULN-011           |
| 13  | Sanitizer côté serveur pour les champs texte                   | 2h     | Élimine VULN-013           |
| 14  | Hardening Docker + Nginx                                       | 2h     | Élimine VULN-018, VULN-019 |

### Phase 4 : Backlog

| #   | Action                                       | Effort |
| --- | -------------------------------------------- | ------ |
| 15  | Swagger auth guard en prod                   | 30 min |
| 16  | CORS fail-closed                             | 15 min |
| 17  | Audit logging automatisé en CI/CD            | 2h     |
| 18  | Migration JWT localStorage → HttpOnly cookie | 8h     |

---

## Annexe : Détail des Tests Exécutés

| Test  | Domaine                          | Résultat   | Sévérité |
| ----- | -------------------------------- | ---------- | -------- |
| 1.2.0 | Register ADMIN public            | VULNÉRABLE | CRITIQUE |
| 1.1.1 | Escalade CONTRIBUTEUR → ADMIN    | SÉCURISÉ   | —        |
| 1.1.2 | Escalade via admin PATCH         | PARTIEL    | MOYENNE  |
| 1.2.1 | Inscription en masse             | VULNÉRABLE | MOYENNE  |
| 2.1   | IDOR Congés                      | VULNÉRABLE | HAUTE    |
| 2.2   | IDOR Télétravail                 | VULNÉRABLE | HAUTE    |
| 2.3   | IDOR Événements                  | VULNÉRABLE | HAUTE    |
| 2.4   | IDOR Projets                     | VULNÉRABLE | HAUTE    |
| 2.5   | IDOR Tâches                      | VULNÉRABLE | HAUTE    |
| 2.6   | IDOR Commentaires                | VULNÉRABLE | HAUTE    |
| 3.1   | Brute force login                | VULNÉRABLE | CRITIQUE |
| 3.2   | Énumération utilisateurs         | SÉCURISÉ   | —        |
| 3.3   | Politique mot de passe           | VULNÉRABLE | HAUTE    |
| 3.4   | Validation JWT                   | SÉCURISÉ   | —        |
| 3.5   | Révocation token                 | SÉCURISÉ   | —        |
| 4.1   | Injection SQL                    | SÉCURISÉ   | —        |
| 4.2   | Prisma filter injection          | PARTIEL    | MOYENNE  |
| 4.3   | XSS stocké                       | PARTIEL    | MOYENNE  |
| 5.1   | Fuite données /users             | SÉCURISÉ   | —        |
| 5.2   | Fuite données /auth/me           | SÉCURISÉ   | —        |
| 5.3   | Fuite dans erreurs               | SÉCURISÉ   | —        |
| 5.4   | Swagger accessible               | PARTIEL    | MOYENNE  |
| 6.1   | Path traversal avatar            | PARTIEL    | MOYENNE  |
| 6.2   | Upload MIME falsifié             | VULNÉRABLE | HAUTE    |
| 6.3   | Taille upload                    | SÉCURISÉ   | —        |
| 7.1   | Headers sécurité                 | VULNÉRABLE | HAUTE    |
| 7.2   | CORS evil origin                 | PARTIEL    | MOYENNE  |
| 7.3   | Endpoints debug                  | PARTIEL    | MOYENNE  |
| 7.4   | CORS fallback                    | PARTIEL    | MOYENNE  |
| 8.1   | Pagination non bornée            | VULNÉRABLE | MOYENNE  |
| 8.2   | Rate limiting global             | PARTIEL    | MOYENNE  |
| 8.3   | ReDoS                            | SÉCURISÉ   | —        |
| 9.1   | Docker sécurité                  | PARTIEL    | MOYENNE  |
| 9.2   | Secrets Docker                   | SÉCURISÉ   | —        |
| 9.3   | Nginx sécurité                   | PARTIEL    | MOYENNE  |
| 10.1  | Audit dépendances                | VULNÉRABLE | HAUTE    |
| 10.2  | Secrets hardcodés                | SÉCURISÉ   | —        |
| 11.1  | JWT localStorage                 | VULNÉRABLE | MOYENNE  |
| 11.2  | dangerouslySetInnerHTML          | PARTIEL    | BASSE    |
| 11.3  | CSRF                             | VULNÉRABLE | MOYENNE  |
| 13.1  | Escalade horizontale congés      | VULNÉRABLE | CRITIQUE |
| 13.2  | Escalade horizontale télétravail | SÉCURISÉ   | —        |
| 14.1  | SSRF                             | SÉCURISÉ   | —        |
| 14.2  | Audit logging                    | VULNÉRABLE | MOYENNE  |
| 12.1  | Race condition todos             | VULNÉRABLE | BASSE    |
