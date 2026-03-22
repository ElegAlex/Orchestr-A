# Audit du prompt "Fix E2E proxy + CI + selectors"

> Date : 2026-02-17
> Projet cible : ORCHESTRA (`/home/alex/Documents/REPO/ORCHESTRA`)
> Objectif : confronter chaque instruction du prompt à la réalité du codebase avant lancement de l'équipe

---

## 1. Mauvais répertoire de travail — BLOQUANT

| Prompt                           | Réalité                                           |
| -------------------------------- | ------------------------------------------------- |
| Working directory : `OPSTRACKER` | Le monorepo Next.js / NestJS est dans `ORCHESTRA` |

`OPSTRACKER` est un projet Symfony/PHP sans `package.json`, sans `apps/`, sans TypeScript.
Toute exécution dans ce répertoire échoue immédiatement (`find apps/api/src` → 0, `pnpm run build` → erreur).

**Correction :** lancer Claude Code depuis `/home/alex/Documents/REPO/ORCHESTRA`.

---

## 2. Port API par défaut : 3001 vs 4000 — HAUT

Le prompt utilise `http://localhost:3001` comme default pour le route handler et les curls de test.

| Source                                   | Port              |
| ---------------------------------------- | ----------------- |
| `apps/web/next.config.ts` (dev fallback) | `4000`            |
| `apps/web/next.config.ts` (prod Docker)  | `http://api:4000` |
| `.env.example` → `API_PORT`              | `4000`            |
| `ci.yml` → start backend                 | `3001`            |

Le projet lui-même a une incohérence (4000 en dev, 3001 en CI), mais le default dans le code source est 4000.

**Correction :** le route handler doit utiliser `process.env.API_URL` avec un default cohérent (`http://localhost:4000`). Les curls de test du Teammate 1 doivent cibler le port 4000 pour l'API directe. Aligner le CI séparément si nécessaire.

---

## 3. Chemin du composant login : i18n ignoré — HAUT

| Prompt                        | Réalité                                |
| ----------------------------- | -------------------------------------- |
| `apps/web/app/login/page.tsx` | `apps/web/app/[locale]/login/page.tsx` |

Le projet utilise `next-intl` avec un segment dynamique `[locale]`. Le Teammate 3 ne trouvera pas le fichier au chemin indiqué dans le prompt.

**Correction :** remplacer `apps/web/app/login/page.tsx` par `apps/web/app/[locale]/login/page.tsx` dans le périmètre du Teammate 3.

---

## 4. Middleware i18n peut bloquer les routes `/api/*` — HAUT

Le projet possède un `middleware.ts` (next-intl) qui gère les redirections de locale. Si le matcher du middleware inclut `/api/*`, les requêtes vers le nouveau route handler `app/api/[...path]/route.ts` seront redirigées vers `/fr/api/[...path]` et échoueront silencieusement.

Ce fichier n'est dans le périmètre d'**aucun** teammate.

**Correction :** ajouter au périmètre du Teammate 1 la vérification (et modification si nécessaire) de `middleware.ts` pour exclure `/api` du matcher i18n. Typiquement :

```typescript
export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
```

---

## 5. Variable d'environnement : `API_URL` vs `NEXT_PUBLIC_API_URL` — MOYEN

| Fichier                   | Variable présente                                    |
| ------------------------- | ---------------------------------------------------- |
| `.env.example`            | `NEXT_PUBLIC_API_URL=http://localhost:4000/api`      |
| `.env.production.example` | `NEXT_PUBLIC_API_URL=/api`                           |
| `next.config.ts`          | `process.env.API_URL` (côté serveur, non documentée) |
| `apps/web/src/lib/api.ts` | `process.env.NEXT_PUBLIC_API_URL` (côté client)      |

`API_URL` (sans préfixe `NEXT_PUBLIC_`) est utilisée dans `next.config.ts` mais **n'apparaît dans aucun `.env.*`**. Le prompt demande de "confirmer que API_URL est défini dans les .env" — ce n'est pas le cas.

**Correction :** le Teammate 1 doit ajouter `API_URL=http://localhost:4000` dans `.env.example` et la documenter comme variable serveur (distincte de `NEXT_PUBLIC_API_URL` qui est client-side).

---

## 6. `if: false` sur le job e2e-tests — MOYEN (à confirmer)

Le prompt dit : "Retirer le `if: false` du job e2e-tests pour le réactiver."

L'exploration du `ci.yml` n'a pas confirmé la présence de ce `if: false`. Il est possible qu'il ait déjà été retiré ou qu'il n'ait jamais été là. Si absent, cette instruction est un no-op.

**Correction :** le Teammate 2 doit vérifier et ne rien faire si `if: false` est absent. Mentionner cette condition dans le prompt.

---

## 7. Timeout Playwright non modifiable depuis le CI — MOYEN

Le prompt dit :

> Réduire le timeout global Playwright de 60s à 30s dans le step qui lance les tests (si configurable via env var)

Configuration actuelle dans `playwright.config.ts` :

```typescript
timeout: process.env.CI ? 60000 : 30000,
```

Ce n'est **pas configurable via env var** depuis le CI — c'est un ternaire hardcodé sur `process.env.CI`. Pour le modifier, il faudrait éditer `playwright.config.ts`, fichier qui n'est pas dans le périmètre du Teammate 2.

**Correction :** soit retirer cette instruction, soit ajouter `playwright.config.ts` au périmètre du Teammate 2 pour rendre le timeout configurable via une variable (ex. `PLAYWRIGHT_TIMEOUT`).

---

## 8. `middleware.ts` hors périmètre — MOYEN

Le fichier `apps/web/middleware.ts` (routage i18n next-intl) n'est dans le périmètre d'aucun teammate. Or c'est un point critique pour le bon fonctionnement du route handler `/api/[...path]` (voir point 4).

**Correction :** l'ajouter au périmètre du Teammate 1.

---

## 9. Sélecteurs des champs login pas réellement fragiles — BAS

Le prompt dit de remplacer les "sélecteurs fragiles des champs login/password". Code actuel dans `e2e/helpers.ts` :

```typescript
await page.locator('input[id="login"]').fill(username);
await page.locator('input[id="password"]').fill(password);
await page.getByRole("button", { name: /se connecter/i }).click();
```

- `input[id="login"]` et `input[id="password"]` sont des sélecteurs par **ID stable** — ils ne sont pas fragiles
- Seul `getByRole('button', { name: /se connecter/i })` dépend du texte localisé (fragile si la langue change)

Ajouter des `data-testid` est une bonne pratique, mais qualifier les sélecteurs actuels de "fragiles" est exagéré.

**Impact :** aucun blocage, le Teammate 3 peut quand même ajouter les `data-testid` par amélioration.

---

## 10. `waitForTimeout()` probablement inexistants — BAS

Le prompt dit : "Remplacer les `waitForTimeout()` hardcodés par `waitForLoadState()` ou `waitForSelector()`."

Le helper login utilise déjà un wait intelligent :

```typescript
await page.waitForURL("**/dashboard", { timeout: 15000 });
```

Il faudrait confirmer l'existence de `waitForTimeout()` dans les 8 fichiers E2E. S'ils n'existent pas, cette instruction est un no-op.

**Correction :** conditionner l'instruction : "Remplacer les `waitForTimeout()` hardcodés **s'il y en a**."

---

## 11. Curl de test API directe : mauvais port — MOYEN

Le prompt du Teammate 1 demande de tester avec :

```bash
curl -X POST http://localhost:3000/api/auth/login ...
```

C'est correct pour le proxy Next.js (`next start` → port 3000). Mais le test implicite suppose que l'API tourne sur le port que le route handler cible par défaut. Si le default est corrigé à 4000 (point 2), le test fonctionnera à condition que l'API soit lancée sur le port 4000.

**Correction :** ajouter une étape explicite : "Lancer l'API sur le port 4000 (`pnpm --filter api start`) avant de tester le proxy."

---

## 12. `--filter web build` peut échouer sans les dépendances — BAS

Le prompt demande `pnpm --filter web build`. Or le build du package `web` peut dépendre de `packages/database`, `packages/types`, etc. via les imports. Turborepo résout ces dépendances automatiquement avec `pnpm run build` (via `turbo run build`), mais `--filter web` ne build pas les dépendances en amont.

**Correction :** préférer `pnpm run build` ou `pnpm turbo run build --filter=web...` (avec les trois points pour inclure les dépendances).

---

## Tableau récapitulatif

| #   | Problème                        | Sévérité     | Teammate impacté | Action                             |
| --- | ------------------------------- | ------------ | ---------------- | ---------------------------------- |
| 1   | Mauvais working directory       | **Bloquant** | Tous             | Changer pour ORCHESTRA             |
| 2   | Port API 3001 → 4000            | **Haut**     | T1, T2           | Corriger les defaults et curls     |
| 3   | Chemin login sans `[locale]`    | **Haut**     | T3               | Corriger le chemin                 |
| 4   | Middleware i18n bloque `/api/*` | **Haut**     | T1               | Vérifier/modifier middleware.ts    |
| 5   | `API_URL` absente des .env      | **Moyen**    | T1               | Ajouter dans .env.example          |
| 6   | `if: false` peut-être absent    | **Moyen**    | T2               | Conditionner l'instruction         |
| 7   | Timeout Playwright hardcodé     | **Moyen**    | T2               | Retirer ou élargir périmètre       |
| 8   | middleware.ts hors périmètre    | **Moyen**    | T1               | Ajouter au périmètre               |
| 9   | Sélecteurs champs pas fragiles  | **Bas**      | T3               | Reformuler (amélioration, pas fix) |
| 10  | `waitForTimeout()` inexistants  | **Bas**      | T3               | Conditionner l'instruction         |
| 11  | Port curl test API              | **Moyen**    | T1               | Corriger et documenter             |
| 12  | `--filter web build` isolé      | **Bas**      | T1               | Utiliser turbo avec dépendances    |
