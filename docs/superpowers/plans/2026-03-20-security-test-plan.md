# ORCHESTR'A V2 — Plan de Tests de Sécurité

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Valider la posture de sécurité de l'application ORCHESTR'A V2 sur l'ensemble des vecteurs d'attaque OWASP Top 10:2025, identifier les vulnérabilités exploitables, et produire un rapport priorisé avec correctifs.

**Architecture:** Plan en 14 domaines de test couvrant l'ensemble de la stack (API NestJS, Frontend Next.js, infra Docker/Nginx). Chaque tâche est un test autonome avec payload, commande, et résultat attendu. Les tests sont exécutables en environnement de dev local (`pnpm run docker:dev` + `pnpm run dev`).

**Tech Stack:** NestJS 11 + Fastify 5, Prisma 6, PostgreSQL, Redis, Next.js 16, Docker, Nginx

**Prérequis:**

```bash
# Démarrer l'environnement
pnpm run docker:dev
pnpm run db:migrate && pnpm run db:seed
pnpm run dev

# Obtenir un token JWT pour les tests (login: admin / admin123)
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"admin","password":"admin123"}' | jq -r '.access_token')

# Créer un utilisateur CONTRIBUTEUR pour tester l'élévation
CONTRIB_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"login":"testcontrib","password":"Test123!","firstName":"Test","lastName":"Contrib","email":"contrib@test.com"}' | jq -r '.access_token')
# Si register ne retourne pas de token, login après register :
CONTRIB_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"testcontrib","password":"Test123!"}' | jq -r '.access_token')

CONTRIB_ID=$(curl -s http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $CONTRIB_TOKEN" | jq -r '.id')

# Créer un utilisateur MANAGER (via admin) pour tester l'élévation avec permissions
MANAGER_RESP=$(curl -s -X POST http://localhost:3001/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"login":"testmanager","password":"Test123!","firstName":"Test","lastName":"Manager","email":"manager@test.com","role":"MANAGER"}')
MANAGER_ID=$(echo $MANAGER_RESP | jq -r '.id')
MANAGER_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"testmanager","password":"Test123!"}' | jq -r '.access_token')

# Récupérer l'ID admin
ADMIN_ID=$(curl -s http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq -r '.id')
```

---

## Domaine 1 : Élévation de Privilèges (Broken Access Control — OWASP A01)

> **Contexte trouvé dans l'audit :** `UpdateUserDto` hérite de `PartialType(CreateUserDto)` qui inclut le champ `role`. Le service `users.service.ts:272-390` spread tous les champs DTO dans `updateData` sans exclure `role`.

### Task 1.1 : Élévation de rôle via PATCH /users/:id

**Files:**

- Test: `apps/api/src/users/__tests__/privilege-escalation.spec.ts`
- Vulnérable: `apps/api/src/users/dto/update-user.dto.ts`
- Vulnérable: `apps/api/src/users/users.service.ts:272-390`

**Vecteur d'attaque :** Un utilisateur avec permission `users:update` envoie `{"role": "ADMIN"}` dans un PATCH.

- [ ] **Step 1 : Tester l'élévation de rôle — Utilisateur CONTRIBUTEUR**

```bash
# Récupérer l'ID du contributeur
CONTRIB_ID=$(curl -s http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $CONTRIB_TOKEN" | jq -r '.id')

# Tenter d'élever son propre rôle (sans permission users:update)
curl -s -X PATCH "http://localhost:3001/api/users/$CONTRIB_ID" \
  -H "Authorization: Bearer $CONTRIB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "ADMIN"}'
```

Résultat attendu SÉCURISÉ : `403 Forbidden` (pas de permission `users:update`)
Résultat si VULNÉRABLE : `200 OK` avec `role: "ADMIN"`

- [ ] **Step 2 : Tester l'élévation de rôle — Utilisateur MANAGER avec users:update**

```bash
# Avec un token MANAGER qui a users:update
# Tenter de s'auto-promouvoir ADMIN
curl -s -X PATCH "http://localhost:3001/api/users/$MANAGER_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "ADMIN"}'
```

Résultat attendu SÉCURISÉ : `403 Forbidden` ou champ `role` ignoré
Résultat si VULNÉRABLE : `200 OK` avec `role: "ADMIN"` — **CRITIQUE**

- [ ] **Step 3 : Tester l'injection de champs non-DTO**

```bash
# Tenter d'injecter isActive: false sur un autre utilisateur
curl -s -X PATCH "http://localhost:3001/api/users/$ADMIN_ID" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'
```

Résultat attendu SÉCURISÉ : `400 Bad Request` (forbidNonWhitelisted devrait bloquer)
Note : Le `ValidationPipe` global avec `forbidNonWhitelisted: true` devrait protéger, mais `isActive` pourrait être dans le DTO hérité.

- [ ] **Step 4 : Documenter les résultats**

Remplir la matrice :

| Payload                             | Rôle testeur | Résultat | Verdict |
| ----------------------------------- | ------------ | -------- | ------- |
| `{"role":"ADMIN"}`                  | CONTRIBUTEUR | ?        | ?       |
| `{"role":"ADMIN"}`                  | MANAGER      | ?        | ?       |
| `{"isActive":false}`                | MANAGER      | ?        | ?       |
| `{"role":"ADMIN","isActive":false}` | ADMIN        | ?        | ?       |

---

### Task 1.2 : CRITIQUE — Création de compte ADMIN via inscription publique

**Files:**

- Test: `apps/api/src/auth/__tests__/register-abuse.spec.ts`
- Vulnérable: `apps/api/src/auth/auth.controller.ts:55-68`
- Vulnérable: `apps/api/src/auth/dto/register.dto.ts:57-61` (accepte `role?: Role` avec `@IsOptional()`)
- Vulnérable: `apps/api/src/auth/auth.service.ts:154` (utilise `registerDto.role || Role.CONTRIBUTEUR`)

**Vecteur d'attaque :** `POST /api/auth/register` est public (`@Public()`). Le `RegisterDto` inclut un champ `role` optionnel avec `@IsEnum(Role)`. Le service utilise `registerDto.role || Role.CONTRIBUTEUR`. Puisque `forbidNonWhitelisted` ne rejette que les champs NON déclarés dans le DTO, et que `role` EST déclaré, **n'importe qui sur Internet peut créer un compte ADMIN**.

De plus : `RegisterDto` accepte aussi `departmentId` et `serviceIds`, permettant à un utilisateur public de s'assigner à n'importe quel département/service.

- [ ] **Step 0 : Tester la création d'un compte ADMIN (PRIORITÉ #1)**

```bash
# SANS AUTHENTIFICATION — endpoint public
curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"login":"hacker_admin","password":"123456","firstName":"H","lastName":"X","email":"h@x.com","role":"ADMIN"}'

# Vérifier le rôle du compte créé
HACKER_TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"hacker_admin","password":"123456"}' | jq -r '.access_token')

curl -s http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $HACKER_TOKEN" | jq '.role'
```

Résultat attendu SÉCURISÉ : Rôle ignoré, compte créé avec `CONTRIBUTEUR`
Résultat si VULNÉRABLE : `"ADMIN"` retourné — **VULNÉRABILITÉ CRITIQUE #1 : compromission totale de l'application**

- [ ] **Step 0b : Tester l'injection de département/services**

```bash
curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"login":"dept_inject","password":"123456","firstName":"D","lastName":"I","email":"d@i.com","departmentId":"<UUID-dept-sensible>","serviceIds":["<UUID-service-RH>"]}'
```

Résultat attendu SÉCURISÉ : Champs ignorés ou rejetés

- [ ] **Step 1 : Tester l'inscription en masse (absence de rate limiting)**

```bash
# Créer 10 comptes rapidement
for i in $(seq 1 10); do
  curl -s -X POST http://localhost:3001/api/auth/register \
    -H "Content-Type: application/json" \
    -d "{\"login\":\"flood$i\",\"password\":\"123456\",\"firstName\":\"Flood\",\"lastName\":\"$i\",\"email\":\"flood$i@test.com\"}" &
done
wait
```

Résultat attendu SÉCURISÉ : Rate limiting après N tentatives
Résultat si VULNÉRABLE : 10 comptes créés sans restriction

- [ ] **Step 2 : Tester l'inscription avec rôle injecté**

```bash
curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"login":"hacker","password":"123456","firstName":"H","lastName":"X","email":"h@x.com","role":"ADMIN"}'
```

Résultat attendu SÉCURISÉ : `400` (champ `role` rejeté par forbidNonWhitelisted) ou rôle ignoré (CONTRIBUTEUR assigné)
Résultat si VULNÉRABLE : Compte créé avec rôle ADMIN

---

## Domaine 2 : IDOR — Insecure Direct Object References (OWASP A01)

> **Contexte trouvé dans l'audit :** Plusieurs endpoints acceptent un `userId` en query param sans vérifier que le demandeur a le droit d'accéder aux données de cet utilisateur.

### Task 2.1 : IDOR sur les congés (Leaves)

**Files:**

- Vulnérable: `apps/api/src/leaves/leaves.controller.ts:92-107`
- Vulnérable: `apps/api/src/leaves/leaves.service.ts`

- [ ] **Step 1 : Accéder aux congés d'un autre utilisateur**

```bash
# En tant que CONTRIBUTEUR, lire les congés de l'admin
ADMIN_ID=$(curl -s http://localhost:3001/api/users \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id')

curl -s "http://localhost:3001/api/leaves?userId=$ADMIN_ID" \
  -H "Authorization: Bearer $CONTRIB_TOKEN"
```

Résultat attendu SÉCURISÉ : `403 Forbidden` ou données filtrées (uniquement ses propres congés)
Résultat si VULNÉRABLE : Liste des congés de l'admin retournée — **CRITIQUE (données RH sensibles)**

### Task 2.2 : IDOR sur le télétravail

**Files:**

- Vulnérable: `apps/api/src/telework/telework.controller.ts:74-87`

- [ ] **Step 1 : Accéder au télétravail d'un autre utilisateur**

```bash
curl -s "http://localhost:3001/api/telework?userId=$ADMIN_ID" \
  -H "Authorization: Bearer $CONTRIB_TOKEN"
```

Résultat attendu SÉCURISÉ : `403` ou filtrage par ownership
Résultat si VULNÉRABLE : Planning télétravail d'un autre utilisateur visible

### Task 2.3 : IDOR sur les événements

**Files:**

- Vulnérable: `apps/api/src/events/events.controller.ts:71-77`

- [ ] **Step 1 : Accéder aux événements d'un autre utilisateur**

```bash
curl -s "http://localhost:3001/api/events?userId=$ADMIN_ID" \
  -H "Authorization: Bearer $CONTRIB_TOKEN"
```

Résultat attendu SÉCURISÉ : `403` ou filtrage
Résultat si VULNÉRABLE : Agenda d'un autre utilisateur visible

### Task 2.4 : IDOR sur les projets et tâches

**Files:**

- Vulnérable: `apps/api/src/projects/projects.controller.ts:110-111`
- Vulnérable: `apps/api/src/tasks/tasks.controller.ts`

- [ ] **Step 1 : Accéder à un projet sans en être membre**

```bash
# Lister tous les projets (en tant que contributeur)
curl -s "http://localhost:3001/api/projects" \
  -H "Authorization: Bearer $CONTRIB_TOKEN" | jq '.data | length'

# Accéder au détail d'un projet spécifique
PROJECT_ID=$(curl -s "http://localhost:3001/api/projects" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id')

curl -s "http://localhost:3001/api/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $CONTRIB_TOKEN"
```

Résultat attendu SÉCURISÉ : Seuls les projets dont l'utilisateur est membre sont visibles
Résultat si VULNÉRABLE : Tous les projets visibles par tout utilisateur authentifié

- [ ] **Step 2 : Accéder aux commentaires d'une tâche sans appartenance projet**

```bash
TASK_ID=$(curl -s "http://localhost:3001/api/tasks" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id')

curl -s "http://localhost:3001/api/comments?taskId=$TASK_ID" \
  -H "Authorization: Bearer $CONTRIB_TOKEN"
```

Résultat attendu SÉCURISÉ : `403` si pas membre du projet
Résultat si VULNÉRABLE : Commentaires visibles

---

## Domaine 3 : Authentification (OWASP A07)

### Task 3.1 : Brute force sur le login

**Files:**

- Vulnérable: `apps/api/src/auth/auth.controller.ts` (endpoint login)
- Config manquante: Pas de `@nestjs/throttler` configuré

- [ ] **Step 1 : Tester l'absence de rate limiting**

```bash
# 50 tentatives de login avec mauvais password en 10 secondes
for i in $(seq 1 50); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"login":"admin","password":"wrong'$i'"}')
  echo "Attempt $i: $CODE"
done
```

Résultat attendu SÉCURISÉ : `429 Too Many Requests` après 5-10 tentatives
Résultat si VULNÉRABLE : 50x `401 Unauthorized` sans blocage — **CRITIQUE**

- [ ] **Step 2 : Tester l'énumération d'utilisateurs**

```bash
# Login inexistant
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"utilisateur_inexistant","password":"test"}' | jq '.message'

# Login existant, mauvais password
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"admin","password":"mauvais"}' | jq '.message'
```

Résultat attendu SÉCURISÉ : Message identique dans les 2 cas (ex: "Identifiants invalides")
Résultat si VULNÉRABLE : Messages différents permettant de deviner les logins existants

### Task 3.2 : Force du mot de passe

**Files:**

- Vulnérable: `apps/api/src/auth/dto/register.dto.ts`

- [ ] **Step 1 : Tester l'inscription avec mot de passe faible**

```bash
# Mot de passe de 6 caractères (minimum actuel)
curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"login":"weakpwd","password":"123456","firstName":"W","lastName":"P","email":"w@p.com"}'

# Mot de passe de 1 caractère
curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"login":"weakpwd2","password":"a","firstName":"W","lastName":"P","email":"w2@p.com"}'
```

Résultat attendu SÉCURISÉ : Minimum 12 caractères, avec complexité (majuscule, chiffre, caractère spécial)
Résultat si VULNÉRABLE : Acceptation de mots de passe faibles

### Task 3.3 : Manipulation de JWT

**Files:**

- Référence: `apps/api/src/auth/strategies/jwt.strategy.ts`

- [ ] **Step 1 : Tester un token avec rôle modifié**

```bash
# Décoder le token actuel
echo $CONTRIB_TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | jq .

# Forger un token avec rôle ADMIN (sans connaître le secret)
# Utiliser jwt.io ou un script pour modifier le payload
# Le test vérifie que le serveur VALIDE la signature
```

Résultat attendu SÉCURISÉ : `401 Unauthorized` (signature invalide)
Note : L'audit montre que `jwt.strategy.ts` re-vérifie le rôle en DB — c'est un point fort.

- [ ] **Step 2 : Tester un token expiré**

```bash
# Utiliser un token vieux de > 8h (ou modifier JWT_EXPIRES_IN à "1s" en test)
sleep 2
curl -s http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $EXPIRED_TOKEN"
```

Résultat attendu SÉCURISÉ : `401 Unauthorized`

- [ ] **Step 3 : Tester la révocation après désactivation**

```bash
# 1. Récupérer token du contributeur
# 2. Désactiver l'utilisateur (en admin)
curl -s -X PATCH "http://localhost:3001/api/users/$CONTRIB_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'

# 3. Tester le token du contributeur désactivé
curl -s http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $CONTRIB_TOKEN"
```

Résultat attendu SÉCURISÉ : `401 Unauthorized` (vérifié — l'audit confirme que isActive est checké)

---

## Domaine 4 : Injection (OWASP A03)

### Task 4.1 : Injection SQL via Prisma

**Files:**

- Référence: Tous les services utilisant PrismaService

- [ ] **Step 1 : Tester les injections classiques dans les filtres**

```bash
# Injection via query params
curl -s "http://localhost:3001/api/users?role=ADMIN'%20OR%201=1--" \
  -H "Authorization: Bearer $TOKEN"

curl -s "http://localhost:3001/api/tasks?search=test'%3BDELETE%20FROM%20users--" \
  -H "Authorization: Bearer $TOKEN"

curl -s "http://localhost:3001/api/projects?search=%27%20UNION%20SELECT%20*%20FROM%20users--" \
  -H "Authorization: Bearer $TOKEN"
```

Résultat attendu SÉCURISÉ : `400 Bad Request` ou résultats vides (Prisma paramétrise automatiquement)
Note : L'audit n'a trouvé aucun `$queryRaw` — risque FAIBLE, mais à vérifier.

### Task 4.2 : NoSQL Injection / Prisma Filter Injection

- [ ] **Step 1 : Tester l'injection d'opérateurs Prisma**

```bash
# Tenter d'injecter des opérateurs Prisma via JSON
curl -s "http://localhost:3001/api/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -G --data-urlencode 'role={"not":"OBSERVATEUR"}'
```

Résultat attendu SÉCURISÉ : Rejeté par validation DTO (class-validator enum)

### Task 4.3 : XSS stocké via champs texte

**Files:**

- Référence: Endpoints de création de tâches, projets, commentaires

- [ ] **Step 1 : Injecter du XSS dans les champs texte**

```bash
# XSS dans le nom de tâche
curl -s -X POST http://localhost:3001/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"<script>alert(document.cookie)</script>","description":"test"}'

# XSS dans un commentaire
curl -s -X POST http://localhost:3001/api/comments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"<img src=x onerror=alert(1)>","taskId":"'$TASK_ID'"}'

# XSS dans le nom d'utilisateur
curl -s -X PATCH "http://localhost:3001/api/users/$CONTRIB_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"<svg onload=alert(1)>","lastName":"test"}'
```

Résultat attendu SÉCURISÉ : Stocké tel quel (React échappe par défaut à l'affichage), SAUF si `dangerouslySetInnerHTML` est utilisé
Note : L'audit a trouvé un `dangerouslySetInnerHTML` dans `ImportPreviewModal.tsx:313-329` — vérifier si les données injectées transitent par ce composant.

---

## Domaine 5 : Exposition de Données Sensibles (OWASP A02)

### Task 5.1 : Fuite de données dans les réponses API

**Files:**

- Référence: Tous les controllers retournant des entités User

- [ ] **Step 1 : Vérifier les champs retournés par /api/users**

```bash
# Lister les utilisateurs et vérifier les champs exposés
curl -s "http://localhost:3001/api/users" \
  -H "Authorization: Bearer $TOKEN" | jq '.data[0] | keys'
```

Résultat attendu SÉCURISÉ : Pas de `passwordHash`, `resetToken`, champs internes
Résultat si VULNÉRABLE : Hash du password, tokens, ou données internes exposés

- [ ] **Step 2 : Vérifier /api/auth/me**

```bash
curl -s http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq 'keys'
```

Vérifier l'absence de : `passwordHash`, `refreshToken`, données sensibles internes

- [ ] **Step 3 : Vérifier les réponses d'erreur**

```bash
# Provoquer une erreur serveur
curl -s "http://localhost:3001/api/users/not-a-uuid" \
  -H "Authorization: Bearer $TOKEN"

curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"","password":""}'
```

Résultat attendu SÉCURISÉ : Pas de stack trace, pas de détails d'implémentation
Résultat si VULNÉRABLE : Stack traces NestJS, noms de tables Prisma, chemins serveur

### Task 5.2 : Swagger exposé en production

**Files:**

- Référence: `apps/api/src/main.ts` (config Swagger)

- [ ] **Step 1 : Vérifier la condition d'activation Swagger**

```bash
# Vérifier si Swagger est conditionné
grep -n "swagger\|SWAGGER" apps/api/src/main.ts
```

Résultat attendu SÉCURISÉ : Swagger conditionné par `NODE_ENV !== 'production'` ou `SWAGGER_ENABLED`
Résultat si VULNÉRABLE : Swagger accessible sans condition → expose tous les endpoints et DTOs

---

## Domaine 6 : Sécurité des Fichiers (OWASP A08)

### Task 6.1 : Path Traversal dans deleteAvatar

**Files:**

- Vulnérable: `apps/api/src/users/users.service.ts:1304-1305`

**Vecteur d'attaque :** `avatarUrl` est utilisé pour construire un chemin de suppression sans validation.

- [ ] **Step 1 : Analyser le code de suppression**

```bash
# Vérifier le code de deleteAvatar
grep -A 10 "deleteAvatar\|unlink" apps/api/src/users/users.service.ts
```

Vérifier que :

- `relativePath` est validé (commence par `uploads/avatars/`)
- `path.normalize()` est utilisé
- Le résultat ne peut pas échapper au répertoire uploads

- [ ] **Step 2 : Tester le path traversal (si l'avatar est manipulable en DB)**

Note : Ce test nécessite de pouvoir définir une `avatarUrl` arbitraire. Si l'URL est générée côté serveur uniquement, le risque est réduit. Vérifier si un endpoint permet de définir `avatarUrl` directement.

```bash
# Tenter de définir une avatarUrl malveillante
curl -s -X PATCH "http://localhost:3001/api/users/$CONTRIB_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"avatarUrl":"/api/uploads/avatars/../../.env"}'
```

Résultat attendu SÉCURISÉ : Champ rejeté ou valeur sanitisée

### Task 6.2 : Upload de fichiers malveillants

**Files:**

- Référence: `apps/api/src/users/users.service.ts:1239-1283`

- [ ] **Step 1 : Tester l'upload avec un MIME type falsifié**

```bash
# Créer un fichier PHP déguisé en image
echo '<?php system($_GET["cmd"]); ?>' > /tmp/shell.php.jpg

curl -s -X POST "http://localhost:3001/api/users/$CONTRIB_ID/avatar" \
  -H "Authorization: Bearer $CONTRIB_TOKEN" \
  -F "file=@/tmp/shell.php.jpg;type=image/jpeg"
```

Résultat attendu SÉCURISÉ : Validation du contenu réel du fichier (magic bytes), pas seulement le MIME déclaré
Note : L'audit montre que la validation est basée sur `file.mimetype` (déclaré par le client) — potentiellement contournable.

- [ ] **Step 2 : Tester la taille maximale**

```bash
# Créer un fichier de 3MB (au-dessus de la limite de 2MB)
dd if=/dev/zero of=/tmp/large.jpg bs=1M count=3 2>/dev/null
curl -s -X POST "http://localhost:3001/api/users/$CONTRIB_ID/avatar" \
  -H "Authorization: Bearer $CONTRIB_TOKEN" \
  -F "file=@/tmp/large.jpg;type=image/jpeg"
```

Résultat attendu SÉCURISÉ : `413 Payload Too Large`

---

## Domaine 7 : Sécurité de Configuration (OWASP A05)

### Task 7.1 : Headers de sécurité HTTP

- [ ] **Step 1 : Vérifier les headers de sécurité**

```bash
curl -sI http://localhost:3001/api/health | grep -iE "x-frame|x-content|strict-transport|content-security|x-xss|referrer-policy|permissions-policy"
```

Checklist de headers attendus :

- [ ] `X-Frame-Options: SAMEORIGIN` ou `DENY`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Strict-Transport-Security` (en prod HTTPS)
- [ ] `Content-Security-Policy`
- [ ] `Referrer-Policy`
- [ ] `Permissions-Policy`
- [ ] Pas de `X-Powered-By` (Helmet le retire)

### Task 7.2 : CORS permissif

**Files:**

- Référence: `apps/api/src/main.ts:45`

- [ ] **Step 1 : Tester CORS avec une origine non autorisée**

```bash
curl -s -X OPTIONS http://localhost:3001/api/users \
  -H "Origin: https://evil.com" \
  -H "Access-Control-Request-Method: GET" \
  -D - -o /dev/null | grep -i "access-control"
```

Résultat attendu SÉCURISÉ : Pas de `Access-Control-Allow-Origin: https://evil.com`
Résultat si VULNÉRABLE : Origin reflété ou `*` retourné

- [ ] **Step 2 : Tester le fallback CORS en l'absence de ALLOWED_ORIGINS**

```bash
# Vérifier le comportement par défaut dans le code
grep -n "ALLOWED_ORIGINS\|cors\|origin" apps/api/src/main.ts
```

L'audit montre un fallback à `http://localhost:3000` — en prod, si la variable est vide, le comportement doit être fail-closed.

### Task 7.3 : Endpoints de debug/admin exposés

- [ ] **Step 1 : Chercher des endpoints de debug**

```bash
# Tester des paths courants
for path in /api/debug /api/metrics /api/admin /api/graphql /api/docs /api/swagger; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001$path")
  echo "$path: $CODE"
done
```

Résultat attendu SÉCURISÉ : `404` pour tous sauf `/api/docs` (si Swagger activé en dev uniquement)

---

## Domaine 8 : Déni de Service applicatif (OWASP A09)

### Task 8.1 : Pagination non bornée

**Files:**

- Vulnérable: `apps/api/src/users/users.service.ts:385` (default limit=200)

- [ ] **Step 1 : Tester les limites de pagination**

```bash
# Demander une très grande page
curl -s "http://localhost:3001/api/users?limit=10000" \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'

curl -s "http://localhost:3001/api/tasks?limit=99999" \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'

curl -s "http://localhost:3001/api/projects?limit=50000" \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'
```

Résultat attendu SÉCURISÉ : Limite plafonnée (max 50-100)
Résultat si VULNÉRABLE : Milliers d'enregistrements retournés — risque DoS mémoire

### Task 8.2 : Rate limiting global

- [ ] **Step 1 : Vérifier la présence de @nestjs/throttler**

```bash
grep -r "throttler\|ThrottlerModule\|@Throttle" apps/api/src/
cat apps/api/package.json | jq '.dependencies["@nestjs/throttler"] // .devDependencies["@nestjs/throttler"] // "NOT INSTALLED"'
```

Résultat attendu SÉCURISÉ : ThrottlerModule configuré globalement
Résultat si VULNÉRABLE : Aucune mention de throttler — **CRITIQUE pour la production**

### Task 8.3 : ReDoS dans les validations regex

- [ ] **Step 1 : Identifier les regex custom dans les DTOs**

```bash
grep -rn "@Matches\|@IsMatching\|new RegExp" apps/api/src/ --include="*.ts"
```

Si des regex custom existent, tester avec des entrées pathologiques (ex: `aaaaaaaaaaaaaaaaaaaaaa!` pour des regex avec backtracking).

---

## Domaine 9 : Sécurité Docker & Infrastructure (OWASP A05)

### Task 9.1 : Configuration Docker production

**Files:**

- Référence: `docker-compose.prod.yml`
- Référence: `apps/api/Dockerfile`, `apps/web/Dockerfile`

- [ ] **Step 1 : Vérifier l'isolation des conteneurs**

```bash
# Vérifier les utilisateurs non-root
grep -n "USER\|user:" apps/api/Dockerfile apps/web/Dockerfile docker-compose.prod.yml

# Vérifier les capabilities
grep -n "cap_drop\|cap_add\|security_opt\|read_only" docker-compose.prod.yml

# Vérifier les limites de ressources
grep -n "mem_limit\|cpus\|deploy" docker-compose.prod.yml
```

Checklist :

- [ ] Conteneurs exécutés en non-root
- [ ] `cap_drop: ALL` appliqué
- [ ] `read_only: true` si possible
- [ ] Limites mémoire/CPU définies
- [ ] Pas de `privileged: true`
- [ ] Pas de `network_mode: host`

- [ ] **Step 2 : Vérifier les ports exposés**

```bash
grep -n "ports:" docker-compose.prod.yml -A 2
```

Résultat attendu SÉCURISÉ : Seul Nginx (80/443) exposé. PostgreSQL et Redis non exposés.

### Task 9.2 : Secrets dans les images Docker

- [ ] **Step 1 : Vérifier que les secrets ne sont pas dans les layers**

```bash
# Vérifier le .dockerignore
cat apps/api/.dockerignore 2>/dev/null || cat .dockerignore 2>/dev/null
# Doit contenir : .env, .env.*, node_modules, .git
```

### Task 9.3 : Sécurité Nginx

**Files:**

- Référence: `nginx/nginx.conf`

- [ ] **Step 1 : Vérifier la configuration Nginx**

```bash
grep -n "server_tokens\|add_header\|ssl_protocols\|ssl_ciphers\|limit_req" nginx/nginx.conf
```

Checklist :

- [ ] `server_tokens off;` (masquer la version)
- [ ] TLS 1.2+ uniquement
- [ ] Headers de sécurité
- [ ] Rate limiting configuré
- [ ] Pas de directory listing

---

## Domaine 10 : Sécurité des Dépendances (OWASP A06)

### Task 10.1 : Audit des dépendances

- [ ] **Step 1 : Scanner les vulnérabilités connues**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA
pnpm audit 2>&1 | head -50
```

- [ ] **Step 2 : Vérifier les dépendances obsolètes critiques**

```bash
pnpm outdated 2>&1 | grep -iE "major|critical" | head -20
```

- [ ] **Step 3 : Chercher des dépendances suspectes**

```bash
# Vérifier les postinstall scripts
grep -r "postinstall\|preinstall" node_modules/.package-lock.json 2>/dev/null | head -20
# Ou
jq '.scripts.postinstall // empty' apps/api/package.json apps/web/package.json
```

---

## Domaine 11 : Sécurité Frontend Spécifique (OWASP A03, A07)

### Task 11.1 : Stockage de tokens

**Files:**

- Référence: `apps/web/src/lib/api.ts` ou équivalent

- [ ] **Step 1 : Identifier où le JWT est stocké**

```bash
grep -rn "localStorage\|sessionStorage\|cookie" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -i "token\|jwt\|auth"
```

Résultat attendu SÉCURISÉ : Cookie HttpOnly + Secure + SameSite=Strict
Résultat si VULNÉRABLE : `localStorage` (accessible par XSS) — **Connu et accepté selon CLAUDE.md**

### Task 11.2 : XSS via dangerouslySetInnerHTML

**Files:**

- Vulnérable: `apps/web/src/components/ImportPreviewModal.tsx:313-329`

- [ ] **Step 1 : Recenser toutes les utilisations de dangerouslySetInnerHTML**

```bash
grep -rn "dangerouslySetInnerHTML\|innerHTML" apps/web/ --include="*.tsx" --include="*.ts"
```

Chaque occurrence doit être vérifiée :

- La source de données est-elle contrôlée (i18n statique) ou user-input ?
- Y a-t-il un sanitizer (DOMPurify) ?

### Task 11.3 : Protection CSRF

- [ ] **Step 1 : Vérifier la protection CSRF**

```bash
# Chercher des mécanismes CSRF
grep -rn "csrf\|CSRF\|xsrf\|XSRF" apps/api/src/ apps/web/src/ --include="*.ts" --include="*.tsx"
```

Note : Avec une API JWT Bearer token (pas de cookies d'auth), le CSRF est moins critique car le token n'est pas envoyé automatiquement. Mais si des cookies sont utilisés, c'est un risque.

---

## Domaine 12 : Logique Métier & Race Conditions

### Task 12.1 : Race condition sur les opérations concurrentes

- [ ] **Step 1 : Double approbation de congés**

```bash
# Créer une demande de congé, puis l'approuver 2 fois simultanément
LEAVE_ID="<id-d-un-conge-en-attente>"

curl -s -X PATCH "http://localhost:3001/api/leaves/$LEAVE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"APPROVED"}' &

curl -s -X PATCH "http://localhost:3001/api/leaves/$LEAVE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"REJECTED"}' &

wait
```

Résultat attendu SÉCURISÉ : Un seul changement accepté, le second échoue ou est idempotent
Résultat si VULNÉRABLE : État incohérent

### Task 12.2 : Dépassement de limite Personal Todos

**Files:**

- Référence: Hard-coded limit de 20 items

- [ ] **Step 1 : Tester le dépassement de la limite**

```bash
# Créer 25 todos rapidement
for i in $(seq 1 25); do
  curl -s -X POST http://localhost:3001/api/personal-todos \
    -H "Authorization: Bearer $CONTRIB_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"title\":\"Todo $i\"}" &
done
wait

# Compter le nombre total
curl -s http://localhost:3001/api/personal-todos \
  -H "Authorization: Bearer $CONTRIB_TOKEN" | jq '.data | length'
```

Résultat attendu SÉCURISÉ : Maximum 20, tentatives supplémentaires rejetées
Résultat si VULNÉRABLE : Plus de 20 créés via race condition

---

## Domaine 13 : Escalade Horizontale sur Mutations (OWASP A01)

> **Contexte revue :** Les IDOR du Domaine 2 couvrent les lectures. Ici on teste les mutations (PATCH/DELETE) sur des ressources d'autres utilisateurs.

### Task 13.1 : Modification/Suppression de congés d'un autre utilisateur

**Files:**

- Vulnérable: `apps/api/src/leaves/leaves.controller.ts` (update, remove)

- [ ] **Step 1 : Modifier le congé d'un autre utilisateur**

```bash
# Créer un congé en tant qu'admin
LEAVE_RESP=$(curl -s -X POST http://localhost:3001/api/leaves \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2026-04-01","endDate":"2026-04-05","type":"ANNUAL","reason":"Vacances"}')
LEAVE_ID=$(echo $LEAVE_RESP | jq -r '.id')

# Tenter de modifier ce congé en tant que CONTRIBUTEUR
curl -s -X PATCH "http://localhost:3001/api/leaves/$LEAVE_ID" \
  -H "Authorization: Bearer $CONTRIB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"APPROVED"}'
```

Résultat attendu SÉCURISÉ : `403 Forbidden`
Résultat si VULNÉRABLE : Congé modifié par un utilisateur non-propriétaire

- [ ] **Step 2 : Supprimer le congé d'un autre utilisateur**

```bash
curl -s -X DELETE "http://localhost:3001/api/leaves/$LEAVE_ID" \
  -H "Authorization: Bearer $CONTRIB_TOKEN"
```

Résultat attendu SÉCURISÉ : `403 Forbidden`

### Task 13.2 : Modification/Suppression de télétravail d'un autre utilisateur

- [ ] **Step 1 : Mêmes tests que 13.1 sur /api/telework**

```bash
# Créer un télétravail en tant qu'admin, tenter de modifier/supprimer en tant que contributeur
TELEWORK_RESP=$(curl -s -X POST http://localhost:3001/api/telework \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-04-01","type":"FULL_DAY"}')
TELEWORK_ID=$(echo $TELEWORK_RESP | jq -r '.id')

curl -s -X PATCH "http://localhost:3001/api/telework/$TELEWORK_ID" \
  -H "Authorization: Bearer $CONTRIB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"APPROVED"}'

curl -s -X DELETE "http://localhost:3001/api/telework/$TELEWORK_ID" \
  -H "Authorization: Bearer $CONTRIB_TOKEN"
```

---

## Domaine 14 : SSRF & Logging (OWASP A10, A09)

### Task 14.1 : SSRF — Fetch d'URLs contrôlées par l'utilisateur

**Files:**

- Référence: `apps/api/src/documents/` (stockage d'URLs), `apps/api/src/users/` (avatarUrl)

- [ ] **Step 1 : Identifier les endpoints qui acceptent des URLs**

```bash
grep -rn "url\|URL\|href\|link" apps/api/src/ --include="*.dto.ts" | grep -i "@Is"
```

- [ ] **Step 2 : Tester l'injection d'URL SSRF**

```bash
# Si un endpoint accepte une URL et la fetch côté serveur :
# Tester avec des URLs internes
curl -s -X POST http://localhost:3001/api/documents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"http://169.254.169.254/latest/meta-data/","title":"test","mimeType":"text/html","projectId":"'$PROJECT_ID'"}'

# Tester avec localhost
curl -s -X POST http://localhost:3001/api/documents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"http://localhost:5432","title":"test","mimeType":"text/html","projectId":"'$PROJECT_ID'"}'
```

Résultat attendu SÉCURISÉ : URLs validées (whitelist de schémas/domaines) ou pas de fetch côté serveur
Note : Si l'app ne fetch jamais les URLs (stockage de référence uniquement), le risque SSRF est nul.

### Task 14.2 : Logging de sécurité

- [ ] **Step 1 : Vérifier que les échecs d'authentification sont loggés**

```bash
# Provoquer 5 échecs de login
for i in $(seq 1 5); do
  curl -s -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"login":"admin","password":"wrong"}'
done

# Vérifier les logs
docker logs orchestr-a-api 2>&1 | tail -20 | grep -i "auth\|login\|fail\|error\|401"
```

Résultat attendu SÉCURISÉ : Chaque échec loggé avec IP, timestamp, login tenté
Résultat si VULNÉRABLE : Aucune trace des tentatives échouées

- [ ] **Step 2 : Vérifier que les tentatives d'élévation sont loggées**

```bash
# Provoquer une tentative d'accès non autorisé
curl -s -X PATCH "http://localhost:3001/api/users/$ADMIN_ID" \
  -H "Authorization: Bearer $CONTRIB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"ADMIN"}'

# Vérifier les logs
docker logs orchestr-a-api 2>&1 | tail -20 | grep -i "403\|forbidden\|unauthorized\|role\|escalat"
```

Résultat attendu SÉCURISÉ : Tentative loggée avec détails (user, action, cible)
Résultat si VULNÉRABLE : Aucun log d'audit de sécurité

- [ ] **Step 3 : Vérifier la présence d'un système d'audit**

```bash
grep -rn "audit\|AuditLog\|SecurityLog\|logger.*security" apps/api/src/ --include="*.ts"
```

---

## Synthèse : Matrice de Risque

| #     | Vulnérabilité                                  | Sévérité     | OWASP   | Probabilité exploitation | Domaine   |
| ----- | ---------------------------------------------- | ------------ | ------- | ------------------------ | --------- |
| **0** | **Création compte ADMIN via register public**  | **CRITIQUE** | **A01** | **Certaine**             | **1.2**   |
| 1     | Élévation de rôle via UpdateUserDto (MANAGER+) | **CRITIQUE** | A01     | Haute                    | 1.1       |
| 2     | IDOR Congés/Télétravail/Events (lecture)       | **CRITIQUE** | A01     | Haute                    | 2.1-2.3   |
| 3     | Absence de rate limiting                       | **CRITIQUE** | A07     | Haute                    | 3.1       |
| 4     | IDOR Projets/Tâches/Commentaires (lecture)     | **HAUTE**    | A01     | Moyenne                  | 2.4       |
| 5     | Escalade horizontale mutations (PATCH/DELETE)  | **HAUTE**    | A01     | Haute                    | 13.1-13.2 |
| 6     | Pagination non bornée (DoS)                    | **HAUTE**    | A09     | Moyenne                  | 8.1       |
| 7     | Absence de logging de sécurité                 | **HAUTE**    | A09     | N/A (détection)          | 14.2      |
| 8     | Mot de passe minimum 6 chars                   | **MOYENNE**  | A07     | Haute                    | 3.2       |
| 9     | Path traversal deleteAvatar                    | **MOYENNE**  | A01     | Basse                    | 6.1       |
| 10    | dangerouslySetInnerHTML XSS                    | **MOYENNE**  | A03     | Basse                    | 11.2      |
| 11    | CORS fallback HTTP                             | **MOYENNE**  | A05     | Basse                    | 7.2       |
| 12    | JWT dans localStorage                          | **BASSE**    | A07     | Basse                    | 11.1      |
| 13    | MIME type non vérifié (magic bytes)            | **BASSE**    | A08     | Basse                    | 6.2       |

---

## Outillage Recommandé

Basé sur l'analyse de `/security/Skills de sécurité...md` et adapté au contexte ORCHESTR'A :

### Pour ce plan de test (exécution immédiate, sans installation)

- **curl + jq** : Suffisant pour 80% des tests ci-dessus
- **`/security-review`** : Commande native Claude Code pour revue statique

### Pour aller plus loin (installation requise)

1. **getsentry/skills@security-review** : Revue méthodologique du code (meilleur rapport signal/bruit)
2. **Serveur MCP Snyk** : `npx -y snyk@latest mcp configure --tool=claude-cli` — SAST + SCA + containers
3. **agamm/claude-code-owasp** : Checklist OWASP Top 10:2025 automatisée
4. **TransilienceAI communitytools** : `/pentest` en staging pour tests offensifs automatisés

### Pour le CI/CD

- **GitHub Action `anthropics/claude-code-security-review`** : Revue de sécurité automatique sur chaque PR
