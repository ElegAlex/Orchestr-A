# Audit E2E CI - Analyse des causes d'échec

**Date** : 17 février 2026
**Commit de référence** : `d39b2a1` (3e tentative)
**Pipeline** : GitHub Actions — job `e2e-tests`

---

## Résumé exécutif

Le job E2E était désactivé (`if: false`) avec le commentaire "TODO: Fix CORS/networking issues". Trois runs successifs ont été nécessaires pour identifier l'ensemble des problèmes. Il reste un blocage non résolu.

| Run | Commit    | Résultat               | Cause                                                              |
| --- | --------- | ---------------------- | ------------------------------------------------------------------ |
| 1   | `511ea10` | API crash au démarrage | Commandes Prisma invalides — migrations jamais exécutées           |
| 2   | `dbea05a` | 40/45 tests timeout    | Locale Chromium en anglais — sélecteurs français KO                |
| 3   | `d39b2a1` | 38/45 tests timeout    | Login API échoue — proxy Next.js ne transmet pas les requêtes POST |

---

## Problème 1 : Commandes Prisma invalides (RÉSOLU)

**Symptôme** : L'API crash au démarrage avec `The table 'public.role_configs' does not exist`.

**Cause racine** : Le CI utilisait `pnpm --filter database prisma migrate deploy`. Cette commande cherche un script `prisma` dans le `package.json` de `packages/database/` — qui n'existe pas. Le message d'erreur `None of the selected packages has a "prisma" script` passait inaperçu car il ne faisait pas échouer l'étape (exit code 0).

Les vrais noms de scripts dans `packages/database/package.json` :

- `db:generate` (pas `prisma generate`)
- `db:migrate:deploy` (pas `prisma migrate deploy`)
- `db:seed` (pas `prisma db seed`)

**Impact** : Aucune migration n'était exécutée, la BDD restait vide, l'API crashait.

**Fix appliqué** : Commit `dbea05a` — remplacement des 7 occurrences dans `ci.yml`.

**Note** : Ce même bug affecte silencieusement les jobs `backend-tests` et `build` (étape `Generate Prisma Client`), mais sans conséquence car le client Prisma est généré automatiquement par le hook `postinstall` de `@prisma/client`, et les tests backend mockent Prisma.

---

## Problème 2 : Locale Chromium par défaut = anglais (RÉSOLU)

**Symptôme** : 40/45 tests échouent avec `waiting for getByRole('button', { name: /se connecter/i })` — timeout 30s.

**Cause racine** : Headless Chromium en CI utilise la locale `en-US` par défaut. Le middleware `next-intl` détecte la locale du navigateur via l'en-tête `Accept-Language` et redirige `/login` vers `/en/login` (au lieu de `/fr/login`). Le bouton affiche "Sign in" au lieu de "Se connecter", et le sélecteur `/se connecter/i` ne matche jamais.

En local, le développeur a un navigateur configuré en français → `/fr/login` → "Se connecter" → tests passent.

**Impact** : Tous les tests qui interagissent avec le bouton de login échouent (40/45). Avec 2 retries × 30s de timeout × 40 tests = **~1h de CI perdue**.

**Fix appliqué** : Commit `d39b2a1` — ajout de `locale: "fr-FR"` dans `playwright.config.ts` + réduction des retries de 2 à 1.

---

## Problème 3 : Proxy Next.js ne transmet pas les POST (NON RÉSOLU)

**Symptôme** : Le bouton "Se connecter" est maintenant trouvé et cliqué (5 tests passent, dont les checks de page), mais `waitForURL("**/dashboard")` timeout systématiquement. Le login API ne redirige jamais vers le dashboard.

**Analyse détaillée** :

### Chaîne de requête attendue

```
Browser (Playwright)
  → POST http://localhost:3000/api/auth/login  {login:"admin", password:"admin123"}
  → Next.js rewrite proxy (next.config.ts)
  → POST http://localhost:3001/api/auth/login
  → NestJS/Fastify API
  → 200 OK {access_token, user}
  → authService.login() stocke le token dans localStorage
  → router.push("/fr/dashboard")
```

### Où ça casse

L'appel API `POST /api/auth/login` transite par le proxy rewrite de Next.js :

```typescript
// apps/web/next.config.ts
async rewrites() {
    const apiUrl = process.env.API_URL || ...;
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
}
```

**L'URL de destination est correcte** (`http://localhost:3001/api/:path*`, vérifiée via `API_URL` définie à build time). Mais la requête POST avec body JSON ne parvient probablement pas à l'API, car :

1. **Les rewrites Next.js vers des URL externes peuvent ne pas proxyer le body des POST** dans certaines configurations. C'est un problème connu avec `output: "standalone"` et Next.js 16 en production (`next start`). Les rewrites fonctionnent bien en dev (`next dev`) mais pas toujours avec `next start`.

2. **Pas de logs API côté CI** : L'API lance Fastify en mode `logger: true`, mais les logs sont dans le process backgroundé (`pnpm --filter api start &`). Ils ne sont pas capturés par GitHub Actions. On ne peut donc pas confirmer si la requête arrive à l'API ou non.

3. **Le formulaire de login côté client** :
   - `authService.login()` utilise Axios → `POST /api/auth/login`
   - L'intercepteur Axios ajoute `Content-Type: application/json`
   - Si la requête échoue, le `catch` affiche un toast d'erreur et `setLoading(false)` — la page reste sur `/fr/login`
   - Si le proxy renvoie un 404 ou un body HTML (page Next.js), Axios jette une erreur

### Causes probables (par ordre de probabilité)

| #   | Cause                                                                                        | Probabilité | Diagnostic                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Rewrite proxy Next.js ne forward pas les POST/body en production avec `output: "standalone"` | **Haute**   | Next.js utilise `node-http-proxy` pour les rewrites externes. Avec `output: "standalone"`, le serveur standalone peut ne pas inclure le module de proxy. Et `next start` en mode standard peut aussi avoir des limites. |
| 2   | Le middleware next-intl intercepte `/api` malgré le matcher `(?!api)`                        | **Faible**  | Le matcher exclut explicitement `/api`. Mais à vérifier en production.                                                                                                                                                  |
| 3   | L'API rejette la requête (CORS, validation DTO, etc.)                                        | **Faible**  | L'admin est seedé, le DTO matche le body envoyé, CORS est configuré. Mais sans logs API, impossible de confirmer.                                                                                                       |

---

## Recommandation de fix pour le problème 3

### Option A : Remplacer le rewrite par un route handler Next.js (RECOMMANDÉE)

Créer un vrai endpoint API côté Next.js qui proxye les requêtes :

```
apps/web/app/api/[...path]/route.ts
```

Ce route handler utilise `fetch()` côté serveur pour appeler l'API backend et retourner la réponse. Avantages :

- Contrôle total sur le proxy (headers, body, méthode)
- Fonctionne en dev ET en production
- Compatible avec `output: "standalone"`
- Pas de dépendance au comportement interne des rewrites Next.js

### Option B : Utiliser `NEXT_PUBLIC_API_URL` + CORS

Remettre `NEXT_PUBLIC_API_URL=http://localhost:3001` au build (comme c'était avant). Le client appelle l'API directement en cross-origin. Configurer `ALLOWED_ORIGINS=http://localhost:3000` sur l'API. Avantages :

- Plus simple à implémenter
- Pas de proxy intermédiaire
  Inconvénient :
- Requêtes cross-origin (preflight OPTIONS, cookies SameSite)

### Option C : Ajouter un step de debug dans le CI

Avant de choisir A ou B, ajouter dans le CI un step qui teste le proxy :

```yaml
- name: Test API proxy
  run: |
    curl -v http://localhost:3001/api/auth/login -X POST \
      -H "Content-Type: application/json" \
      -d '{"login":"admin","password":"admin123"}'
    echo "---"
    curl -v http://localhost:3000/api/auth/login -X POST \
      -H "Content-Type: application/json" \
      -d '{"login":"admin","password":"admin123"}'
```

Cela confirmerait si le problème est le proxy Next.js ou autre chose.

---

## Problèmes annexes identifiés

### Durée excessive du job E2E

- **Cause** : 1 seul worker (`workers: 1` en CI), retries actifs, timeouts de 15-60s par test
- **Impact** : 20min quand ça marche, 1h+ quand ça échoue
- **Recommandation** : Garder `workers: 1` (stabilité) mais réduire le timeout global et déplacer les tests les plus rapides en premier

### Logs API non capturés

- **Cause** : `pnpm --filter api start &` lance le process en background, ses stdout/stderr ne sont pas dans les logs GitHub Actions
- **Impact** : Impossible de diagnostiquer les erreurs API côté serveur
- **Recommandation** : Rediriger les logs vers un fichier et l'uploader comme artifact :
  ```yaml
  run: |
    pnpm --filter api start > /tmp/api.log 2>&1 &
  ```

### Tests E2E fragiles

- **Sélecteurs dépendants de la langue** : `getByRole('button', { name: /se connecter/i })` casse si la locale change
- **Timeouts hardcodés** : `waitForTimeout(2000)`, `{ timeout: 15000 }` — fragiles en CI lent
- **Recommandation** : Utiliser `data-testid` pour les éléments critiques, `waitForLoadState` au lieu de timeouts fixes

---

## Prochaines étapes

1. **Ajouter le step de debug** (Option C) pour confirmer que le proxy est la cause
2. **Implémenter le fix** (Option A ou B selon les résultats du debug)
3. **Capturer les logs API** en CI
4. **Stabiliser les sélecteurs E2E** avec `data-testid`
