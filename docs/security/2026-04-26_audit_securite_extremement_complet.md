# Audit sécurité extrêmement complet — ORCHESTR'A V2

**Date de l’audit :** 2026-04-26  
**Périmètre :** `apps/api`, `apps/web`, `packages/database`, configuration `nginx`  
**Méthode :** revue de code statique orientée menaces + vérifications automatisées disponibles localement.

---

## 1) Résumé exécutif

L’application présente une **base de sécurité globalement solide côté API** (JWT court + refresh rotation, blacklist JWT, contrôles RBAC/ownership, validation DTO stricte, protections upload type magic bytes, redaction des logs sensibles), mais conserve encore des **risques structurels importants côté session web et posture défensive par défaut**.

### Niveau de risque global

- **Risque global actuel : MOYEN → ÉLEVÉ** (selon exposition Internet et maturité XSS côté front).
- **Aucun exploit critique “one-click” confirmé** durant cet audit sur API (sans accès XSS préalable).
- **Deux priorités P0/P1** ressortent :
  1. Jetons d’auth persistés en `localStorage` (access + refresh).
  2. Mode RBAC `permissive` par défaut (risque de route non décorée acceptée).

---

## 2) Contrôles de sécurité positifs observés

1. **JWT access court (15m par défaut) + refresh token avec rotation/révocation**, ce qui réduit la fenêtre d’abus d’un access token compromis.  
2. **Blacklist JWT basée sur `jti`** et stratégie *fail-closed* si Redis indisponible pour la vérification de révocation.  
3. **RBAC via permissions explicites** et garde globale dédiée (avec mode enforce possible).  
4. **Protection ownership** sur ressources sensibles (IDOR hardening).  
5. **Validation stricte des entrées** (`whitelist`, `forbidNonWhitelisted`, `transform`).  
6. **Contrôle d’upload par signature binaire (“magic bytes”)** et whitelist MIME.  
7. **Redaction des secrets dans les logs API** (headers et champs sensibles).

---

## 3) Vulnérabilités / faiblesses identifiées

## SEC-A1 — Tokens d’authentification stockés en `localStorage`

- **Sévérité : ÉLEVÉE**  
- **Probabilité : moyenne** (dépend du niveau XSS front)  
- **Impact : élevé** (prise de session, persistance via refresh token)

### Observation
Le front stocke explicitement `access_token` et `refresh_token` dans `localStorage`.

### Risque
Toute XSS exploitable (même ponctuelle) permet exfiltration immédiate des jetons et usurpation de session. La présence du refresh token en `localStorage` aggrave la persistance d’attaque.

### Recommandation
- Migrer vers **cookies `HttpOnly` + `Secure` + `SameSite`** (pattern BFF/API compatible).  
- Mettre en place une stratégie CSRF robuste si cookies cross-site sont nécessaires.  
- Conserver la logique de rotation/revocation déjà présente côté API.

---

## SEC-A2 — RBAC global avec mode `permissive` par défaut

- **Sévérité : ÉLEVÉE**  
- **Probabilité : moyenne** (erreur humaine de décorateur)  
- **Impact : élevé** (endpoint potentiellement exposé)

### Observation
Le guard RBAC V2 bascule en `permissive` si `RBAC_GUARD_MODE` n’est pas explicitement défini à `enforce`.

### Risque
Une route oubliée sans décorateur RBAC explicite peut rester accessible en prod si la variable d’environnement est mal configurée.

### Recommandation
- Passer le **default code en `enforce`** (et autoriser `permissive` uniquement en dev/test).  
- Ajouter un test d’intégration “policy coverage” qui échoue si une route métier n’a ni `@Public`, ni `@AllowSelfService`, ni `@RequirePermissions`.

---

## SEC-A3 — Champ `forcePasswordChange` non appliqué dans le flux d’auth

- **Sévérité : MOYENNE**  
- **Probabilité : élevée** (état déjà connu)  
- **Impact : moyen à élevé** (mot de passe faible/default peut perdurer)

### Observation
Le schéma utilisateur contient `forcePasswordChange`, mais le flux `login` ne bloque pas/contraint la connexion si ce flag est actif.

### Risque
Après reset administrateur ou onboarding, un compte peut rester actif sans obligation de changer un secret initial.

### Recommandation
- Enrichir `login`/`me` avec un flag d’état sécurité et imposer un parcours de changement de mot de passe avant accès normal.

---

## SEC-A4 — Tokens de reset mot de passe stockés en clair

- **Sévérité : MOYENNE**  
- **Probabilité : faible à moyenne** (nécessite accès DB)  
- **Impact : élevé si DB compromise**

### Observation
Le modèle `PasswordResetToken` persiste `token` en clair et la vérification se fait par lookup direct.

### Risque
En cas de fuite DB/backup, les tokens non expirés/non utilisés sont exploitables immédiatement.

### Recommandation
- Stocker **uniquement un hash** du token (similaire au design refresh token).  
- Retourner le token brut uniquement à l’émission (jamais persister en clair).

---

## SEC-A5 — Surface anti-bruteforce perfectible sur login/register

- **Sévérité : MOYENNE**  
- **Probabilité : moyenne**  
- **Impact : moyen**

### Observation
Le throttling est présent, mais principalement par IP globale, sans verrouillage combiné identifiant/IP ni délais progressifs.

### Risque
Attaques distribuées ou ciblées (credential stuffing) restent praticables à volume moyen.

### Recommandation
- Ajouter rate-limit par couple `login + IP`, délais exponentiels, et alerting SOC/applicatif sur bursts.

---

## 4) Vérifications exécutées pendant l’audit

1. **Audit dépendances npm (prod) :** aucune vulnérabilité remontée localement.  
2. **Audit pnpm (prod) :** endpoint registry refusé (403), donc résultat incomplet côté pnpm.  
3. **Tests sécurité unitaires ciblés API :** 31 tests passés (`auth`, `ownership`, `magic-bytes`).

---

## 5) Plan de remédiation priorisé

### P0 (immédiat)
1. Basculer architecture session vers cookies `HttpOnly` (access court + refresh rotatif).  
2. Forcer `RBAC_GUARD_MODE=enforce` par défaut en code + CI policy coverage.

### P1 (court terme)
3. Activer réellement `forcePasswordChange` dans login + UX de changement obligatoire.  
4. Hacher les reset tokens en base et adapter le flow de validation.

### P2 (moyen terme)
5. Durcir anti-bruteforce (multi-dimensionnel + alerting).  
6. Compléter observabilité sécurité (dashboard tentatives login, refresh anomalies, refus RBAC).

---

## 6) Conclusion

L’application est clairement montée en maturité par rapport aux audits précédents (hardening réel sur API), mais **la sécurité de session front reste le point le plus sensible**. Le risque n’est pas théorique : en présence d’une XSS, le stockage local des jetons expose directement l’authentification.

La combinaison **cookies HttpOnly + RBAC enforce par défaut + reset-token hashé + forcePasswordChange effectif** ferait passer la posture globale vers un niveau **élevé de robustesse**.
