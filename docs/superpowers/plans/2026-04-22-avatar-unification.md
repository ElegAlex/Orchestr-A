# Avatar Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan wave-by-wave. Steps use checkbox (`- [ ]`) syntax for tracking. **All subagents MUST be dispatched with `model: "sonnet"`** (memory rule — orchestrator stays on Opus). Each wave's "Dispatch prompt" is self-contained and copy-paste-ready into the `Agent` tool.

**Goal:** Réduire les 20 lieux de rendu d'avatar à un seul composant `UserAvatar` purement présentationnel, en supprimant les 3 composants privés (AvatarCircle Gantt, Avatar Gantt tooltip, UserPresenceCard) et les 16 inlines, sans migration progressive user-facing.

**Architecture:** Extraction d'utilitaires partagés (`apps/web/src/lib/avatar.ts`) + enrichissement du composant canonique (`badge`, `onError`, tailles xs/xl, `title` natif) + complétion des payloads Prisma (`avatarUrl` + `avatarPreset`) + unification des types (`UserSummary`) + suppression des 10 assets legacy `avatar_0X.svg`. Le composant reste pur (pas de `onClick`/`href`), les wrappers parents gèrent l'interactivité. Aucune migration DB automatique : requête SQL livrée manuellement.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4, Jest 30 + @testing-library/react 16 (frontend), Vitest (backend NestJS), Playwright (E2E), Prisma 6, PostgreSQL 18.

**Spec référence :** `backlog/refactor-avatar/SPEC D'IMPLÉMENTATION — Unification des composants Avatar.md` (version 1.0 ratifiée).

---

## Préambule opérationnel

### Dérogations explicites aux règles mémoire

1. **Branche dédiée `feature/avatar-unification`** (spec §3 + D18). La règle mémoire "pas de branches feature sans demande" est ici _suspendue_ car la spec l'exige explicitement (PR unique). Flag volontaire, signalé à l'utilisateur en amont.
2. **Pas de push+deploy automatique** post-commit. La spec impose un merge via PR avec revue manuelle Alexandre (§7 DoD). La règle "push & deploy automatique" ne s'applique qu'une fois la PR mergée sur `master`.

### Hypothèses vérifiées (2026-04-22)

- `apps/api/` **n'importe pas** depuis `packages/types` (grep 0 hit). Conséquence : la source unique `PERSONA_PRESETS` vit dans `apps/web/src/constants/avatar-presets.ts` (nouveau dossier) et est **dupliquée** dans `apps/api/src/users/dto/avatar-preset.dto.ts` avec commentaire `KEEP IN SYNC`. Option choisie parmi les deux de D16 — justification : éviter une dépendance `api→web` ou une refonte du package `types` hors scope.
- Test runner frontend = **Jest 30** (`apps/web/jest.config.js`). La spec dit `__tests__/UserAvatar.test.tsx` → compatible avec `testMatch: **/__tests__/**/*.[jt]s?(x)`. Les tests utilisent `@testing-library/react` déjà installé (v16.3).
- Line numbers de la spec vérifiés par échantillonnage (7 callsites) : `profile/page.tsx:159,378,396`, `MainLayout.tsx:191`, `planning/UserRow.tsx:61`, `tasks/page.tsx:611-629,640-645`, `projects/[id]/page.tsx:1517,1549`. **Aucune dérive détectée** depuis la rédaction de la spec (commit de référence `b0ec76f`). Si un subagent constate une dérive sur son périmètre, il relit le fichier et ajuste ; il ne devine jamais.
- `PHASE0-REPORT-avatar-unification.md` référencé comme pré-requis mais **absent sur disque** (bien que listé `??` dans le git status initial). Validation par échantillonnage suffisante — la spec est auto-portante.

### Résolution des couplages inter-vagues

Le spec §4 proposait un ordonnancement `V0 → V1 → (V2-A..E ‖ V3 ‖ V4-A..C) → V5 → V6`. Deux couplages cachés impliquent un réordonnancement :

- **V2-D ↔ V4-B** : `PresenceDialog` consomme `UserPresenceItem` dont le payload doit contenir `avatarPreset` (V4-B ajoute ce champ).
- **V2-E ↔ V4-A** : `GanttBase`/`GanttTooltip` consomment un payload de `tasks.service.ts` auquel V4-A ajoute `avatarPreset`.

**Ordonnancement retenu** :

```
V0 (solo)
 └→ V1 (solo)
      └→ Wave W2 (7 parallèles) : V2-A, V2-B, V2-C, V3, V4-A, V4-B, V4-C
           └→ Wave W3 (2 parallèles) : V2-D, V2-E
                └→ V5 (solo)
                     └→ V6 (solo)
```

V2-D et V2-E consomment ainsi un backend déjà enrichi. Les fichiers `MIGRATION-GAPS-<AGENT>.md` restent un filet de sécurité secondaire (pas une dépendance fonctionnelle).

### Invariants globaux vérifiés entre chaque vague

Un "verification gate" à la fin de chaque wave exécute dans l'ordre :

```bash
# Gate frontend
cd /home/alex/Documents/REPO/ORCHESTRA
pnpm --filter web build 2>&1 | tail -20
pnpm --filter web test --passWithNoTests 2>&1 | tail -10

# Gate API
pnpm --filter api test --run 2>&1 | tail -10

# Gate global
pnpm -w run build 2>&1 | tail -5
```

**Attendu : 0 erreur, 0 test rouge.** Si rouge → `git revert HEAD` + analyse racine, _ne pas_ enchaîner sur la wave suivante.

### Stratégie de rollback

Aucune migration DB automatique dans ce refactor. Rollback = `git revert <sha>` + re-push. Les ajouts backend V4 sont strictement additifs dans les `select`/`include` Prisma : revert sans risque structurel. Les users en prod avec `avatarPreset='avatar_0X'` sont absorbés par `onError` V1 (fallback monogramme) jusqu'à l'exécution manuelle du SQL livré en V6.

### Convention `MIGRATION-GAPS-<AGENT>.md` (par agent, sans collision)

Les agents W2/W3 peuvent constater qu'un payload local ne contient pas `avatarUrl`/`avatarPreset`. Dans ce cas :

- **NE PAS** bidouiller un fallback inline.
- **Écrire** dans un fichier **par agent** à la racine du worktree, pour éviter toute race condition en parallélisation :
  - V2-A → `MIGRATION-GAPS-V2-A.md`
  - V2-B → `MIGRATION-GAPS-V2-B.md`
  - V2-C → `MIGRATION-GAPS-V2-C.md`
  - V2-D → `MIGRATION-GAPS-V2-D.md`
  - V2-E → `MIGRATION-GAPS-V2-E.md`
- Format d'une ligne : `| fichier | ligne | expression | type du user local | payload manquant |`.
- V5 consolide + supprime l'ensemble après vérification.

---

## Wave 0 — Fondations (solo, bloquant)

### Task 0.1 : Utilitaires partagés + PERSONA_PRESETS + UserSummary

**Files:**

- Create: `apps/web/src/lib/avatar.ts`
- Create: `apps/web/src/lib/__tests__/avatar.test.ts`
- Create: `apps/web/src/constants/avatar-presets.ts`
- Modify: `apps/web/src/types/index.ts` (ajout `UserSummary`, aucun renommage)

**Dispatch prompt (copier-coller dans Agent tool, `model: "sonnet"`):**

````
You are Wave 0 of the avatar unification refactor. Context: backlog/refactor-avatar/SPEC D'IMPLÉMENTATION — Unification des composants Avatar.md §4 Vague 0.

Execute the following autonomously. No clarifying questions — the spec is authoritative.

1. CREATE apps/web/src/lib/avatar.ts with these exact named exports extracted from apps/web/src/components/UserAvatar.tsx lines 22-54:
   - `GRADIENTS: readonly [string, string][]` (copy the 10 pairs verbatim, keep the hex values and comments)
   - `hashString(s: string): number` (same algorithm: h = (h * 31 + charCodeAt) >>> 0)
   - `getGradient(user: UserSummary): { from: string; to: string; angle: number }` (key = `${firstName.toLowerCase()}:${lastName.toLowerCase()}`, idx = hashString(key) % GRADIENTS.length, angle = (hashString(key) >> 8) % 360)
   - `getInitials(user: UserSummary): string` → `((user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')).toUpperCase()`
   Import UserSummary from '@/types'.

2. CREATE apps/web/src/lib/__tests__/avatar.test.ts — Jest + jsdom already configured. Use these exact tests:
   ```ts
   import { hashString, getGradient, getInitials, GRADIENTS } from '@/lib/avatar';

   describe('hashString', () => {
     it('is deterministic', () => {
       expect(hashString('alice')).toBe(hashString('alice'));
     });
     it('differs for different inputs', () => {
       expect(hashString('alice')).not.toBe(hashString('bob'));
     });
   });

   describe('getGradient', () => {
     it('returns a gradient pair from GRADIENTS', () => {
       const g = getGradient({ id: '1', firstName: 'Alice', lastName: 'Martin' });
       const pairs = GRADIENTS.map(([f, t]) => `${f}|${t}`);
       expect(pairs).toContain(`${g.from}|${g.to}`);
     });
     it('returns angle in [0, 359]', () => {
       const g = getGradient({ id: '1', firstName: 'Alice', lastName: 'Martin' });
       expect(g.angle).toBeGreaterThanOrEqual(0);
       expect(g.angle).toBeLessThan(360);
     });
     it('returns consistent gradient for same user (case-insensitive)', () => {
       const a = getGradient({ id: '1', firstName: 'Alice', lastName: 'MARTIN' });
       const b = getGradient({ id: '1', firstName: 'alice', lastName: 'martin' });
       expect(a).toEqual(b);
     });
   });

   describe('getInitials', () => {
     it('returns uppercased first letters', () => {
       expect(getInitials({ id: '1', firstName: 'alice', lastName: 'martin' })).toBe('AM');
     });
     it('handles missing firstName', () => {
       expect(getInitials({ id: '1', firstName: '', lastName: 'Martin' })).toBe('M');
     });
     it('handles missing lastName', () => {
       expect(getInitials({ id: '1', firstName: 'Alice', lastName: '' })).toBe('A');
     });
     it('handles both missing', () => {
       expect(getInitials({ id: '1', firstName: '', lastName: '' })).toBe('');
     });
   });
````

3. CREATE apps/web/src/constants/avatar-presets.ts (new folder `constants/`):

   ```ts
   export const PERSONA_PRESETS = Array.from(
     { length: 48 },
     (_, i) => `persona_${String(i + 1).padStart(2, "0")}`,
   );
   export const VALID_PRESETS = ["initials", ...PERSONA_PRESETS] as const;
   export type AvatarPreset = (typeof VALID_PRESETS)[number];
   ```

4. MODIFY apps/web/src/types/index.ts — APPEND (do not rename or remove anything) the interface:

   ```ts
   export interface UserSummary {
     id: string;
     firstName: string;
     lastName: string;
     avatarUrl?: string | null;
     avatarPreset?: string | null;
   }
   ```

   Place it near other user-related types (after the existing `User` or `AuthUserDisplay`, whichever comes first).

5. DO NOT modify apps/api/src/users/dto/avatar-preset.dto.ts in this wave — that's V6.

6. VERIFY:
   - Run `cd /home/alex/Documents/REPO/ORCHESTRA && pnpm --filter web test -- avatar.test` — all 10 cases must pass.
   - Run `pnpm --filter web build` — must succeed.
   - Run `pnpm --filter web exec tsc --noEmit` — must succeed (type check).

7. COMMIT with message:
   ```
   refactor(avatar): V0 — fondations (lib/avatar, UserSummary, avatar-presets)
   ```

Report back: test output tail, build output tail, commit SHA.

````

**Verification gate (orchestrator runs after agent returns):**

```bash
cd /home/alex/Documents/REPO/ORCHESTRA
pnpm --filter web test -- avatar.test 2>&1 | tail -15  # 10 passing
pnpm --filter web exec tsc --noEmit 2>&1 | tail -5     # 0 errors
git log --oneline -1                                    # V0 commit visible
````

**Rollback:** `git revert HEAD` (single commit, no downstream dependency yet).

---

## Wave 1 — Enrichir `UserAvatar` (solo, après V0)

### Task 1.1 : Enrichissement API composant + migration des 5 sites d'appel existants + tests RTL

**Files:**

- Modify: `apps/web/src/components/UserAvatar.tsx`
- Create: `apps/web/src/components/__tests__/UserAvatar.test.tsx`
- Modify: `apps/web/app/[locale]/profile/page.tsx:159,378,396-399`
- Modify: `apps/web/src/components/planning/UserRow.tsx:61-66`
- Modify: `apps/web/src/components/MainLayout.tsx:191`

**Remappage des tailles (ancien → nouveau, taille visuelle identique) :**

| Ancien | Pixels | Nouveau |
| ------ | ------ | ------- |
| `sm`   | 40     | `md`    |
| `md`   | 48     | `lg`    |
| `lg`   | 96     | `xl`    |

Nouvelles valeurs introduites : `xs=20`, `xl=96`.

**Dispatch prompt (Agent, `model: "sonnet"`):**

````
You are Wave 1 of the avatar unification refactor. Context: backlog/refactor-avatar/SPEC D'IMPLÉMENTATION — Unification des composants Avatar.md §4 Vague 1. Wave 0 is already committed (lib/avatar.ts, UserSummary, avatar-presets.ts exist).

Execute the following autonomously.

1. MODIFY apps/web/src/components/UserAvatar.tsx — REPLACE the entire file with this structure (preserve the visual output exactly, but refactor):
   ```tsx
   "use client";

   import Image from "next/image";
   import { useState, type ReactNode } from "react";
   import { getGradient, getInitials } from "@/lib/avatar";
   import type { UserSummary } from "@/types";

   interface UserAvatarProps {
     user: UserSummary;
     size?: "xs" | "sm" | "md" | "lg" | "xl";
     badge?: ReactNode;
     className?: string;
   }

   const sizeMap = {
     xs: { dim: 20, text: "text-[10px] font-semibold" },
     sm: { dim: 28, text: "text-xs font-semibold" },
     md: { dim: 40, text: "text-sm font-semibold tracking-tight" },
     lg: { dim: 48, text: "text-base font-semibold tracking-tight" },
     xl: { dim: 96, text: "text-3xl font-bold tracking-tight" },
   } as const;

   function getAvatarSrc(avatarUrl: string): string {
     if (avatarUrl.startsWith("http") || avatarUrl.startsWith("/")) return avatarUrl;
     return `/${avatarUrl}`;
   }

   export function UserAvatar({ user, size = "md", badge, className = "" }: UserAvatarProps) {
     const { dim, text } = sizeMap[size];
     const style = { width: dim, height: dim };
     const fullName = `${user.firstName} ${user.lastName}`.trim();
     const [imageFailed, setImageFailed] = useState(false);

     const wrapper = (inner: ReactNode) => (
       <div
         className={`relative flex-shrink-0 ${className}`}
         style={style}
         title={fullName}
       >
         {inner}
         {badge && (
           <span className="absolute -top-0.5 -right-0.5 z-10 pointer-events-none">
             {badge}
           </span>
         )}
       </div>
     );

     if (user.avatarUrl && !imageFailed) {
       return wrapper(
         <span className="rounded-full overflow-hidden block w-full h-full">
           <Image
             src={getAvatarSrc(user.avatarUrl)}
             alt={fullName}
             width={dim}
             height={dim}
             className="w-full h-full object-cover"
             unoptimized
             onError={() => setImageFailed(true)}
           />
         </span>
       );
     }

     if (user.avatarPreset && user.avatarPreset !== "initials" && !imageFailed) {
       return wrapper(
         <span className="rounded-full overflow-hidden block w-full h-full">
           {/* eslint-disable-next-line @next/next/no-img-element */}
           <img
             src={`/avatars/${user.avatarPreset}.svg`}
             alt={fullName}
             className="w-full h-full object-cover"
             onError={() => setImageFailed(true)}
           />
         </span>
       );
     }

     const { from, to, angle } = getGradient(user);
     const initials = getInitials(user);

     return wrapper(
       <span
         className={`rounded-full flex items-center justify-center overflow-hidden text-white w-full h-full ${text}`}
         style={{
           background: `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`,
           boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
         }}
         aria-label={fullName}
       >
         <span
           aria-hidden
           className="pointer-events-none absolute inset-0 rounded-full"
           style={{
             background:
               "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.25), transparent 55%)",
           }}
         />
         <span className="relative drop-shadow-sm">{initials}</span>
       </span>
     );
   }
````

2. CREATE apps/web/src/components/**tests**/UserAvatar.test.tsx :

   ```tsx
   import { render, screen, fireEvent } from "@testing-library/react";
   import { UserAvatar } from "@/components/UserAvatar";

   const user = { id: "1", firstName: "Alice", lastName: "Martin" };

   describe("UserAvatar", () => {
     it("renders monogram when no avatarUrl nor avatarPreset", () => {
       render(<UserAvatar user={user} />);
       expect(screen.getByText("AM")).toBeInTheDocument();
     });

     it("renders image when avatarUrl is provided", () => {
       render(
         <UserAvatar
           user={{ ...user, avatarUrl: "/avatars/persona_01.svg" }}
         />,
       );
       const img = screen.getByAltText("Alice Martin");
       expect(img).toHaveAttribute(
         "src",
         expect.stringContaining("persona_01.svg"),
       );
     });

     it("renders preset when avatarPreset is provided (not initials)", () => {
       render(<UserAvatar user={{ ...user, avatarPreset: "persona_03" }} />);
       const img = screen.getByAltText("Alice Martin");
       expect(img).toHaveAttribute("src", "/avatars/persona_03.svg");
     });

     it('renders monogram when avatarPreset is "initials"', () => {
       render(<UserAvatar user={{ ...user, avatarPreset: "initials" }} />);
       expect(screen.getByText("AM")).toBeInTheDocument();
     });

     it("renders badge when provided", () => {
       render(
         <UserAvatar user={user} badge={<span data-testid="b">★</span>} />,
       );
       expect(screen.getByTestId("b")).toBeInTheDocument();
     });

     it("does not render badge when absent", () => {
       const { container } = render(<UserAvatar user={user} />);
       expect(
         container.querySelector('[class*="absolute"][class*="-top"]'),
       ).toBeNull();
     });

     it("falls back to monogram on image error", () => {
       render(<UserAvatar user={{ ...user, avatarPreset: "persona_03" }} />);
       const img = screen.getByAltText("Alice Martin");
       fireEvent.error(img);
       expect(screen.getByText("AM")).toBeInTheDocument();
     });

     it("renders title attribute with full name", () => {
       const { container } = render(<UserAvatar user={user} />);
       expect(
         container.querySelector('[title="Alice Martin"]'),
       ).toBeInTheDocument();
     });
   });
   ```

3. MODIFY apps/web/app/[locale]/profile/page.tsx — REMAP sizes at 3 callsites:
   - L.159 `size="lg"` → `size="xl"`
   - L.378 `size="lg"` → `size="xl"`
   - L.396 (inside the preset picker) `size="md"` → `size="lg"`
     Read the file first to confirm exact current text before Edit.

4. MODIFY apps/web/src/components/planning/UserRow.tsx — L.61:
   - Change `size="sm"` → `size="md"` (visual 40px preserved).
   - If an external badge element (star ⭐ management) wraps UserAvatar at L.62-66, move it into the `badge` prop of UserAvatar instead of being a sibling. Read L.55-70 first to understand the surrounding structure, then refactor.

5. MODIFY apps/web/src/components/MainLayout.tsx:191 — `size="sm"` → `size="md"`.

6. VERIFY:
   - `pnpm --filter web test -- UserAvatar.test` — 8 passing.
   - `pnpm --filter web build` — succeeds.
   - `pnpm --filter web exec tsc --noEmit` — 0 errors.
   - Manual grep check: `grep -rn 'size="sm"\|size="md"\|size="lg"' apps/web/app/[locale]/profile/page.tsx apps/web/src/components/planning/UserRow.tsx apps/web/src/components/MainLayout.tsx` — must show remapped values.

7. COMMIT:
   ```
   refactor(avatar): V1 — UserAvatar API enrichie (xs/xl, badge, onError, title) + remap des 3 callsites
   ```

Report: test output, build output, commit SHA, and a note if any callsite text was unexpected (e.g., size already different from what the spec claimed).

````

**Verification gate:**

```bash
pnpm --filter web test -- UserAvatar.test 2>&1 | tail -15        # 8 passing
pnpm --filter web exec tsc --noEmit 2>&1 | tail -5                # 0 errors
grep -c 'size="sm"' apps/web/src/components/planning/UserRow.tsx  # 0 expected
````

**Rollback:** `git revert HEAD`. V0 reste en place (utile pour toute reprise).

---

## Wave W2 — Migration frontend + types + backend (7 agents parallèles)

**Lancement :** un unique message avec 7 invocations `Agent` en parallèle. Tous avec `model: "sonnet"`. Aucun chevauchement de fichiers (cf. matrice spec §5).

### Agent V2-A — Tasks (5 sites)

**Files touched:**

- `apps/web/app/[locale]/tasks/page.tsx:611-629, 640-645`
- `apps/web/app/[locale]/tasks/[id]/page.tsx:989-1007, 1009-1014`
- `apps/web/src/components/tasks/TaskLineCard.tsx:87-106`

**Dispatch prompt:**

```
You are Wave 2 agent V2-A (Tasks). Execute autonomously per backlog/refactor-avatar/SPEC §4 Vague 2 (Teammate V2-A).

Replace inline avatar divs with <UserAvatar> in these exact files:

1. apps/web/app/[locale]/tasks/page.tsx L.611-629 (kanban multi-assignees stack):
   - Keep the outer `<div className="flex -space-x-1">` stacking wrapper.
   - Replace each `<div className="w-5 h-5 rounded-full bg-blue-600 ...">{firstName[0]}{lastName[0]}</div>` with `<UserAvatar user={assignment.user} size="xs" key={assignment.userId || idx} />`.
   - The "+N" pill at L.625-629 stays a plain <div> (not an avatar).

2. apps/web/app/[locale]/tasks/page.tsx L.640-645 (legacy single assignee):
   - Replace the inline `<div>` with `<UserAvatar user={task.assignee} size="xs" />`.

3. apps/web/app/[locale]/tasks/[id]/page.tsx L.989-1007 + 1009-1014: same pattern.

4. apps/web/src/components/tasks/TaskLineCard.tsx L.87-106: same pattern, size="xs".

Rules:
- Add `import { UserAvatar } from "@/components/UserAvatar";` at the top of each file if not already present.
- Each user object passed MUST satisfy UserSummary (id, firstName, lastName, avatarUrl?, avatarPreset?). If the local type does not expose avatarUrl/avatarPreset → append a line to MIGRATION-GAPS-V2-A.md at repo root (create if missing):
```

| apps/web/app/[locale]/tasks/page.tsx:611 | assignment.user | Task.assignees[*].user | missing avatarPreset |

```
Do NOT inline a fallback. Trust the type — V4-A fills the Prisma payload in parallel. Prefer `user satisfies UserSummary` over `user as UserSummary` when TS needs a nudge (use `as UserSummary` only if `satisfies` fails).
- Do NOT touch any other inline div with `rounded-full` that is not an avatar (badges, pills, etc.).

Verify:
- `pnpm --filter web build` succeeds (TS may still flag missing avatarPreset if local types are strict pre-V3/V4: prefer `x satisfies UserSummary`, fall back to `x as UserSummary` with a TODO comment pointing to MIGRATION-GAPS-V2-A.md if the narrower shape blocks compile).
- Git diff review: only the 5 listed callsites modified.

Commit:
```

refactor(avatar): V2-A — migrate Tasks inline avatars to UserAvatar

```

Report: commit SHA, list of MIGRATION-GAPS entries added, build output tail.
```

---

### Agent V2-B — Projects (3 sites)

**Files:** `apps/web/app/[locale]/projects/[id]/page.tsx:1517-1537, 1549-1553, 1642-1649`

**Dispatch prompt:**

```
You are Wave 2 agent V2-B (Projects). Execute per spec §4 Vague 2 (Teammate V2-B).

Modify apps/web/app/[locale]/projects/[id]/page.tsx only. Three callsites:

1. L.1517-1537 (kanban multi-assignees): keep `<div className="flex -space-x-1">` wrapper, replace each inline avatar div with `<UserAvatar user={assignment.user} size="xs" key={assignment.userId || idx} />`. The "+N" pill stays a plain div.
2. L.1549-1553 (kanban single assignee legacy): replace the inline div with `<UserAvatar user={task.assignee} size="xs" />`.
3. L.1642-1649 (onglet Équipe — 48px avatar): `<UserAvatar user={member} size="lg" />`.

Rules:
- Add `import { UserAvatar } from "@/components/UserAvatar";` at top if missing.
- Each user must satisfy UserSummary (id, firstName, lastName, avatarUrl?, avatarPreset?). If local typing is too strict → append a line to MIGRATION-GAPS-V2-B.md at repo root (create if missing):
```

| apps/web/app/[locale]/projects/[id]/page.tsx:<line> | <expression> | <source type> | missing avatarPreset |

```
Do NOT inline a fallback. Prefer `user satisfies UserSummary` over `as UserSummary`. V4-A fills the Prisma payload in parallel.
- Do NOT touch any other inline `rounded-full` div that isn't an avatar.

Verify: `pnpm --filter web build` succeeds, `git diff` shows only the 3 callsites.

Commit:
```

refactor(avatar): V2-B — migrate Projects inline avatars to UserAvatar

```

```

---

### Agent V2-C — Users + UserMultiSelect (5 sites)

**Files:**

- `apps/web/app/[locale]/users/page.tsx:704-708`
- `apps/web/app/[locale]/users/[id]/suivi/page.tsx:419-424, 459-479`
- `apps/web/src/components/UserMultiSelect.tsx:101-104, 195-199`

**Dispatch prompt:**

```
You are Wave 2 agent V2-C (Users + UserMultiSelect).

Size mapping per spec §4 V2-C:
- users/page.tsx L.704-708 (table row 40px) → `<UserAvatar user={user} size="md" />`.
- users/[id]/suivi/page.tsx L.419-424 (purple header, previously 96px) → `<UserAvatar user={user} size="xl" />` — purple background removed; gradient hash replaces it.
- users/[id]/suivi/page.tsx L.459-479 (gray dropdown entries) → `<UserAvatar user={entry.user} size="md" />`. Read L.455-485 first to confirm the exact shape.
- UserMultiSelect.tsx L.101-104 (selected chip, 20px) → `<UserAvatar user={selectedUser} size="xs" />`.
- UserMultiSelect.tsx L.195-199 (dropdown option, 28px) → `<UserAvatar user={option} size="sm" />`.

Rules:
- Add `import { UserAvatar } from "@/components/UserAvatar";` at top of each file if missing.
- Each user must satisfy UserSummary. If not → append to MIGRATION-GAPS-V2-C.md at repo root (create if missing):
```

| <file>:<line> | <expression> | <source type> | missing avatarPreset |

```
- Prefer `user satisfies UserSummary` over `as UserSummary`.
- Do NOT inline fallbacks. Do NOT touch non-avatar `rounded-full` divs.

Verify: `pnpm --filter web build` succeeds, grep of firstName[0] should drop for these files.

Commit:
```

refactor(avatar): V2-C — migrate Users + UserMultiSelect inline avatars

```

```

---

### Agent V3 — Types `User`-like → `UserSummary`

**Files:** `apps/web/src/types/index.ts` + `apps/web/src/services/users.service.ts:203-211`

**Dispatch prompt:**

```
You are Wave 2 agent V3 (Types migration).

In apps/web/src/types/index.ts, for each of these inline user-like shapes, replace with `UserSummary` (imported locally, already defined by V0). If the original had extra props (e.g., `email?`), use an intersection `UserSummary & { email?: string; ... }`. DO NOT rename the host interfaces.

1. `Project.createdBy` (L.236-241)
2. `Project.manager` (L.242-246)
3. `Project.sponsor` (L.247-251)
4. `Leave.validator` (L.636-641) — conserve `email?`
5. `Leave.validatedBy` (L.642-647)
6. `Holiday.createdBy` (L.805-809)
7. `SchoolVacation.createdBy` (L.874-878)
8. `ThirdParty.createdBy` (L.532-537) — conserve `email?`
9. `TeleworkRecurringRule.user` (L.690)
10. `TeleworkRecurringRule.createdBy` (L.691)

IMPORTANT — line numbers may have drifted since spec writing. BEFORE each edit:
- Read the file section, locate the interface by name (Project, Leave, etc.), identify the `createdBy` / `manager` / etc. property.
- Apply the replacement in place.

In apps/web/src/services/users.service.ts L.203-211 (`UserPresenceItem`): add `avatarPreset?: string | null;` to the existing interface. Do NOT remove `avatarUrl` (already present).

DO NOT touch:
- `AuthUserDisplay` (already complete).
- Standalone `User` (already complete).
- Any other interface not listed above.

Verify:
- `pnpm --filter web exec tsc --noEmit` — 0 errors (type-only change should not break runtime).
- `pnpm --filter web test --passWithNoTests` — remains green.

Commit:
```

refactor(avatar): V3 — unify User-like types with UserSummary

```

```

---

### Agent V4-A — Backend: Tasks + Comments + Projects

**Files:**

- `apps/api/src/tasks/tasks.service.ts`
- `apps/api/src/comments/comments.service.ts`
- `apps/api/src/projects/projects.service.ts`

**Dispatch prompt:**

```
You are Wave 2 agent V4-A (Backend tasks/comments/projects).

Rule: wherever a Prisma `select` OR `include` returns user-like data, append `avatarUrl: true, avatarPreset: true`. NEVER widen beyond these two fields.

Target files + approximate lines (per spec §4 V4-A — re-verify by pattern matching, not blind line numbers):

- apps/api/src/tasks/tasks.service.ts: L.247-249, 260, 354, 364, 431, 443, 489-491, 505, 711-713, 722, 1013, 1023, 1078, 1106, 1116, 1582, 1592, 1644-1645, 1740-1741
- apps/api/src/comments/comments.service.ts: L.33-35, 57-59, 87-89, 116-118
- apps/api/src/projects/projects.service.ts: L.119-122, 129-131, 197-220, 274-297, 283-287, 298, 405-421, 529, 633-644

Method — for each target file:
1. Read the file once, grep for `firstName: true` or `lastName: true` within `select`/`include` blocks that return user data.
2. For each such block, add `avatarUrl: true,` and `avatarPreset: true,` after `lastName: true`.
3. If a block already has `avatarUrl: true` but not `avatarPreset: true`, add only the missing one.
4. Preserve all surrounding properties verbatim (id, email, role, etc.).

DO NOT:
- Add fields other than avatarUrl + avatarPreset.
- Modify test files (.spec.ts). If a spec file fixture breaks because it asserts exhaustive user shape, update the fixture to include the 2 new fields — no other changes.
- Introduce new helper functions.

Verify:
- `pnpm --filter api test --run` — all tests pass.
- `pnpm --filter api build` — succeeds.
- `pnpm --filter api exec tsc --noEmit` — 0 errors.

Commit:
```

refactor(avatar): V4-A — API tasks/comments/projects Prisma selects → avatarUrl+avatarPreset

```

```

---

### Agent V4-B — Backend: Leaves + Time-tracking + Users

**Files:**

- `apps/api/src/leaves/leaves.service.ts`
- `apps/api/src/time-tracking/time-tracking.service.ts`
- `apps/api/src/users/users.service.ts`

**Dispatch prompt:**

```
You are Wave 2 agent V4-B (Backend leaves/time-tracking/users).

Rule: wherever a Prisma `select` OR `include` returns user-like data, append `avatarUrl: true, avatarPreset: true`. NEVER widen beyond these two fields.

Method — for each target file:
1. Read the file once, grep for `firstName: true` or `lastName: true` within select/include blocks that return user data.
2. For each such block, add `avatarUrl: true,` and `avatarPreset: true,` after `lastName: true`.
3. If a block already has `avatarUrl: true` but not `avatarPreset: true`, add only the missing one.
4. Preserve all surrounding properties verbatim (id, email, role, etc.).

DO NOT add fields beyond avatarUrl+avatarPreset. DO NOT modify test files unless a fixture asserts exhaustive user shape — in that case, add only the 2 new fields, no other changes.

Targets per spec §4 V4-B:

- apps/api/src/leaves/leaves.service.ts: L.423-440, 576-605, 664-687, 737-760, 783-792, 830-841, 860-884, 905-949, 1090-1106, 1273-1290, 1344-1361, 1416+
- apps/api/src/time-tracking/time-tracking.service.ts: L.145, 155, 305, 315, 344, 354, 455, 465, 524, 657, 660, 682
- apps/api/src/users/users.service.ts: L.221 (create return), 349 (findOne), 530 (update return), 1246, 1342 (presence) — `avatarUrl` is likely already present; ADD `avatarPreset: true` where missing.

Special care for users.service.ts: it is the source of UserPresenceItem — V2-D/V4 rely on it returning avatarPreset. Confirm both presence query sites (L.1246, 1342) return avatarPreset.

Verify:
- `pnpm --filter api test --run` — all tests pass.
- `pnpm --filter api build` — succeeds.
- `pnpm --filter api exec tsc --noEmit` — 0 errors.

Commit message:
```

refactor(avatar): V4-B — API leaves/time-tracking/users Prisma selects → avatarPreset

```

```

---

### Agent V4-C — Backend: Events + Skills + Departments + Services

**Files:**

- `apps/api/src/events/events.service.ts`
- `apps/api/src/skills/skills.service.ts`
- `apps/api/src/departments/departments.service.ts`
- `apps/api/src/services/services.service.ts`

**Dispatch prompt:**

```
You are Wave 2 agent V4-C (Backend events/skills/departments/services).

Rule: avatarUrl + avatarPreset additions only. Wherever a Prisma select/include returns user-like data (detect by presence of `firstName: true` or `lastName: true`), append `avatarUrl: true, avatarPreset: true`. If one is already present, add only the missing one. Preserve all surrounding properties verbatim. DO NOT widen beyond these two fields.

Targets per spec §4 V4-C:
- events.service.ts: L.137-140, 147-151, 268-270, 279, 313, 325, 456-458, 467, 543-547, 557, 625-631, 641
- skills.service.ts: L.113, 377-378, 480-481, 484
- departments.service.ts: L.127
- services.service.ts: L.166

Verify:
- `pnpm --filter api test --run` — all tests pass.
- `pnpm --filter api build` — succeeds.
- `pnpm --filter api exec tsc --noEmit` — 0 errors.

Commit:
```

refactor(avatar): V4-C — API events/skills/departments/services Prisma selects → avatarUrl+avatarPreset

```

```

---

### W2 Verification gate (orchestrator, after 7 agents return)

```bash
cd /home/alex/Documents/REPO/ORCHESTRA
pnpm --filter web exec tsc --noEmit 2>&1 | tail -10    # 0 errors
pnpm --filter api exec tsc --noEmit 2>&1 | tail -10    # 0 errors
pnpm --filter web build 2>&1 | tail -20                # success
pnpm --filter api build 2>&1 | tail -10                # success
pnpm --filter api test --run 2>&1 | tail -10           # all green
cat MIGRATION-GAPS-V2-*.md 2>/dev/null || echo "no gaps"  # review per-agent gap files
git log --oneline -7                                    # 7 V2-*/V3/V4-* commits
```

**Rollback W2:** `git revert <V4-C> <V4-B> <V4-A> <V3> <V2-C> <V2-B> <V2-A>` (reverse order). V0/V1 restent en place.

---

## Wave W3 — PresenceDialog + Gantt (2 agents parallèles)

Dépend de V4-A (Gantt task payload) + V4-B (UserPresenceItem).

### Agent V2-D — Events + Skills + Milestones + PresenceDialog

**Files:**

- `apps/web/app/[locale]/events/page.tsx:435-450`
- `apps/web/src/components/SkillsMatrix.tsx:790-812`
- `apps/web/src/components/MilestoneCard.tsx:220-230`
- `apps/web/src/components/PresenceDialog.tsx` (suppression `UserPresenceCard`)

**Dispatch prompt:**

```
You are Wave 3 agent V2-D. Wave 2 backend payloads are now in place (V4-B added avatarPreset to UserPresenceItem).

Execute per spec §4 V2-D:

1. events/page.tsx L.435-450: stack de participants → UserAvatar size="sm" each.
2. SkillsMatrix.tsx L.790-812: colonne sticky user → UserAvatar size="sm".
3. MilestoneCard.tsx L.220-230: stack contributeurs → UserAvatar size="sm".
4. PresenceDialog.tsx L.13-41: REMOVE the `UserPresenceCard` private component entirely. Inline its layout (text adjacent to avatar) using `<UserAvatar user={user} size="md" />`. If UserPresenceCard is exported and imported elsewhere, update the import sites.

Import UserAvatar if not already imported. Use UserSummary-compatible user object (prefer `satisfies UserSummary` over `as UserSummary`). If a user object is still missing avatarPreset, append to MIGRATION-GAPS-V2-D.md at repo root — but this should NOT happen given V4-B has passed.

Verify:
- pnpm --filter web build succeeds.
- pnpm --filter web exec tsc --noEmit → 0 errors.
- grep -n "UserPresenceCard" apps/web/src → 0 matches.

Commit:
```

refactor(avatar): V2-D — migrate Events/Skills/Milestones + remove UserPresenceCard

```

```

---

### Agent V2-E — Gantt (2 composants privés)

**Files:**

- `apps/web/src/components/gantt/GanttBase.tsx:83-101` (remove `AvatarCircle`)
- `apps/web/src/components/gantt/GanttTooltip.tsx:49-71` (remove `Avatar`)

**Dispatch prompt:**

```
You are Wave 3 agent V2-E (Gantt). V4-A backend payloads for tasks now include avatarUrl+avatarPreset.

Execute per spec §4 V2-E:

1. GanttBase.tsx:
   - DELETE the `AvatarCircle` private component (L.83-101).
   - At the usage site (L.551), replace with `<UserAvatar user={...} size="sm" />`. The `color` prop becomes obsolete — drop it.
   - Verify the task payload provides firstName/lastName/avatarUrl/avatarPreset. If missing, write to MIGRATION-GAPS-V2-E.md (should NOT happen post V4-A).

2. GanttTooltip.tsx:
   - DELETE the `Avatar` private component (L.49-71).
   - Replace usages at L.151 and L.187 with `<UserAvatar size="xs" user={...} />`.

CRITICAL — do NOT touch:
- Bézier rendering logic.
- Capsules / dependencies / groupBy logic.
- Any other Gantt file.

Import UserAvatar at top of each file.

Verify:
- pnpm --filter web build succeeds.
- pnpm --filter web exec tsc --noEmit → 0 errors.
- grep -n "AvatarCircle\|function Avatar\b" apps/web/src/components/gantt/ → 0 matches.

Commit:
```

refactor(avatar): V2-E — Gantt private avatar components replaced with UserAvatar

```

```

---

### W3 Verification gate

```bash
pnpm --filter web build 2>&1 | tail -20
pnpm --filter web exec tsc --noEmit 2>&1 | tail -5
grep -rn "UserPresenceCard\|AvatarCircle" apps/web/src 2>&1 | grep -v __tests__  # 0 matches
git log --oneline -2  # V2-D + V2-E commits
```

**Rollback W3:** `git revert <V2-E> <V2-D>`. W0/W1/W2 inchangées.

---

## Wave V5 — Intégration finale + nettoyages (solo)

### Task V5.1 : Vérifications + cleanup morts + E2E screenshots

**Files:**

- Modify: `apps/web/src/lib/planning-utils.ts` (suppression `colors.avatar`)
- Modify: `apps/web/app/[locale]/profile/page.tsx:17-20` (suppression duplication `PERSONA_PRESETS`)
- Delete: `MIGRATION-GAPS-V2-*.md` (5 fichiers potentiels, si toutes lacunes résolues)
- Create: `.claude-screenshots/avatar-unification/*.png` (8 zones)

**Dispatch prompt:**

````
You are Wave V5. All migrations (V0/V1/W2/W3) committed. Finalize.

1. Consolidate MIGRATION-GAPS-V2-*.md files (up to 5: V2-A, V2-B, V2-C, V2-D, V2-E):
   - `ls MIGRATION-GAPS-V2-*.md 2>/dev/null`
   - For each file present, review every entry and verify by reading the cited files/lines that the V4 backend enrichment now supplies avatarUrl + avatarPreset.
   - If all entries resolved → `rm MIGRATION-GAPS-V2-*.md`.
   - If any entry is unresolved → STOP and report which file/line. Do not proceed.

2. Nettoyage `colors.avatar` mort:
   - Read apps/web/src/lib/planning-utils.ts, locate the `getGroupColors` (or equivalent) function returning an object with `avatar` key.
   - grep -rn 'colors\.avatar\|\.avatar\s*[=:]' apps/web | grep -v UserAvatar | grep -v avatar.ts → confirm 0 consumer outside this file.
   - Remove the `avatar` property from all return statements in planning-utils.ts.

3. Nettoyage duplication PERSONA_PRESETS dans profile/page.tsx:
   - L.17-20: replace the inline `const PERSONA_PRESETS = Array.from(...)` with `import { PERSONA_PRESETS } from "@/constants/avatar-presets";`.
   - Keep the `INITIALS_PRESET` constant unchanged.

4. E2E Playwright screenshots — 8 zones, before/after:
   - Zones: Planning, Users, Dashboard, Projects, Tasks, Events, Skills, Milestones.
   - BEFORE screenshots already exist? If `.claude-screenshots/avatar-unification/*-before.png` is empty, skip BEFORE (this is a refactor, not a rollback-gated change). AFTER screenshots are mandatory.
   - Command template:
     ```
     npx playwright test --project=admin --grep "@avatar-screenshots" --headed
     ```
     If no such Playwright suite exists, write a minimal script in `e2e/tests/avatar-screenshots.spec.ts` that navigates to each of the 8 routes (authed as admin via storage state) and saves a screenshot to `.claude-screenshots/avatar-unification/{zone}-after.png`. Use existing auth fixture (playwright/.auth/admin.json).
   - Commit the screenshots.

5. Run FULL verification:
   - `pnpm --filter web build` — success.
   - `pnpm --filter web test` — all green.
   - `pnpm --filter api test --run` — all green.
   - `grep -rn 'firstName\[0\]\|lastName\[0\]' apps/web/src apps/web/app` — must only show `apps/web/src/lib/avatar.ts` and optionally `apps/web/src/components/UserAvatar.tsx`.

Commit (can be 2 commits if separating cleanup from screenshots):
````

refactor(avatar): V5 — cleanup colors.avatar dead code + dedupe PERSONA_PRESETS
chore(avatar): V5 — E2E screenshots for 8 functional zones

```

Report: screenshot paths, final grep output, any MIGRATION-GAPS issue found.
```

**Verification gate:**

```bash
pnpm --filter web test 2>&1 | tail -10
pnpm --filter api test --run 2>&1 | tail -10
grep -rn 'firstName\[0\]\|lastName\[0\]' apps/web/src apps/web/app
ls .claude-screenshots/avatar-unification/*.png 2>&1 | wc -l  # ≥ 8
```

---

## Wave V6 — Assets legacy + source unique API + E2E smoke (solo)

### Task V6.1 : Alignement DTO API + suppression 10 SVG + SQL livrable + E2E @smoke

**Files:**

- Modify: `apps/api/src/users/dto/avatar-preset.dto.ts`
- Delete: `apps/web/public/avatars/avatar_01.svg` à `avatar_10.svg`
- Create: `MIGRATION-SQL-AVATAR-LEGACY.sql` (racine)
- Create: `e2e/tests/avatar-unification.spec.ts`

**Dispatch prompt:**

````
You are Wave V6 — final. All migrations validated. Do the housekeeping.

1. Align apps/api/src/users/dto/avatar-preset.dto.ts with the web-side source.
   Since apps/api does NOT import from packages/types (verified 2026-04-22):
   - Keep the current duplicated `PERSONA_PRESETS` literal in the DTO.
   - Add at the top, above the PERSONA_PRESETS declaration, this comment:
     ```ts
     // KEEP IN SYNC WITH apps/web/src/constants/avatar-presets.ts
     ```
   - Confirm the 48-item array is byte-identical to apps/web/src/constants/avatar-presets.ts generation logic.

2. Delete 10 legacy assets:
   ```bash
   rm apps/web/public/avatars/avatar_0{1..9}.svg apps/web/public/avatars/avatar_10.svg
````

Verify no code references them:

```bash
grep -rn "avatar_0" apps/ packages/ 2>&1 | grep -v node_modules | grep -v ".next" | grep -v "migration-sql"
```

Expected: 0 hits. If any hit, STOP and report.

3. Create /home/alex/Documents/REPO/ORCHESTRA/MIGRATION-SQL-AVATAR-LEGACY.sql (root):

   ```sql
   -- Avatar unification — cleanup legacy presets (prod)
   -- Execution manuelle par admin DB requise. NE PAS exécuter automatiquement.

   -- Step 1 — inventory (read-only):
   SELECT COUNT(*) AS legacy_users, "avatarPreset"
   FROM users
   WHERE "avatarPreset" LIKE 'avatar_%'
   GROUP BY "avatarPreset";

   -- Step 2 — remediation (only if Step 1 returns >0 rows):
   -- UPDATE users SET "avatarPreset" = NULL WHERE "avatarPreset" LIKE 'avatar_%';
   -- (uncomment to execute)
   ```

4. Create e2e/tests/avatar-unification.spec.ts with @smoke tag:

   ```ts
   import { test, expect } from "@playwright/test";

   test.describe("@smoke Avatar unification", () => {
     test("avatar visible on /users first row", async ({ page }) => {
       await page.goto("/users");
       await expect(
         page.locator("table tbody tr").first().locator("[title]"),
       ).toBeVisible();
     });

     test("avatar visible in task assignees stack", async ({ page }) => {
       await page.goto("/tasks");
       await expect(
         page.locator(".flex.-space-x-1 [title]").first(),
       ).toBeVisible();
     });
   });
   ```

   Use the admin storage state (playwright.config.ts existing project "admin" already sets it).

5. Run full E2E smoke:

   ```bash
   pnpm run test:e2e -- --grep "@smoke"
   ```

   Expected: all pass.

6. Final verification — the DoD checklist (spec §7):
   - pnpm --filter web test + api test green.
   - pnpm -w run build succeeds.
   - @smoke green.
   - Screenshots present.
   - MIGRATION-GAPS-V2-\*.md absents (tous supprimés par V5).
   - Grep firstName[0]|lastName[0] limited to lib/avatar.ts + UserAvatar.tsx.
   - Grep rounded-full on apps/web: no avatar-inline match.
   - avatar_0\*.svg deleted.
   - MIGRATION-SQL-AVATAR-LEGACY.sql present.

Commit (2 separate commits):

```
refactor(avatar): V6 — DTO keep-in-sync + delete 10 legacy SVG
test(avatar): V6 — E2E @smoke avatar-unification + SQL migration livrable
```

Report: E2E output, final DoD checklist status.

```

---

## Définition de Done (récap spec §7)

- [ ] `pnpm --filter web test` + `pnpm --filter api test --run` verts
- [ ] `pnpm -w run build` succeeds
- [ ] `pnpm run test:e2e -- --grep "@smoke"` green
- [ ] `.claude-screenshots/avatar-unification/` complete (8 zones after, before optional)
- [ ] `MIGRATION-GAPS-V2-*.md` absents (tous gaps résolus par V4, nettoyés en V5)
- [ ] `grep -rn 'firstName\[0\]\|lastName\[0\]' apps/web/` → seulement `avatar.ts` + `UserAvatar.tsx`
- [ ] `grep -rn 'rounded-full' apps/web/` → aucun avatar inline restant (badges/pills non-avatar OK)
- [ ] `apps/web/public/avatars/avatar_0*.svg` supprimés (10 fichiers)
- [ ] `MIGRATION-SQL-AVATAR-LEGACY.sql` présent à la racine, non exécuté
- [ ] PR ouverte sur `feature/avatar-unification`, revue manuelle Alexandre avant merge

## Hors scope (spec §8, rappel)

- Endpoints upload `/users/me/avatar*` — intacts.
- Logique Gantt (Bézier, capsules, groupBy) — intacte.
- Renommage `UserAvatar` — API enrichie uniquement, pas de rupture.
- Migration DB des legacy presets — livrable SQL manuel.

## Execution Handoff

Plan sauvegardé dans `docs/superpowers/plans/2026-04-22-avatar-unification.md`.

Ta demande explicite : *"réalisation complète et autonome en recourant le plus utilement possible aux sub-agents"*. → **Option recommandée pré-sélectionnée : Subagent-Driven**.

### Option 1 — Subagent-Driven (recommandée, ton choix par défaut)

Orchestrateur (moi, Opus 4.7) dispatche un agent frais `model: "sonnet"` par wave, review two-stage entre waves :

| Wave | Agents | Parallélisme | Objet |
|---|---|---|---|
| V0 | 1 | solo | Fondations (lib/avatar, UserSummary, constants) |
| V1 | 1 | solo | UserAvatar enrichi + 5 callsites historiques + 8 tests RTL |
| W2 | 7 | **parallèle** | V2-A, V2-B, V2-C (frontend) + V3 (types) + V4-A, V4-B, V4-C (backend) |
| W3 | 2 | **parallèle** | V2-D (Presence/Events/Skills/Milestones) + V2-E (Gantt) |
| V5 | 1 | solo | Cleanup + E2E screenshots 8 zones |
| V6 | 1 | solo | DTO sync + suppression 10 SVG + SQL livrable + @smoke |

Total : **13 dispatches**, dont 9 parallélisables (W2+W3). Temps de mur estimé : ~90-120 min selon vitesse Sonnet, avec revue entre chaque wave.

### Option 2 — Inline execution (fallback)

Exécution séquentielle dans la session courante via `superpowers:executing-plans`, checkpoints entre waves. Utiliser si tu veux garder le contrôle pas-à-pas ou si la parallélisation pose problème.

---

**Valide "option 1" ou "vas-y" pour que je lance le dispatch V0. "option 2" si tu préfères le mode inline. Sinon précise.**
```
