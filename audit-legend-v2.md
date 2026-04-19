# Audit — Refonte Légende Planning V2

> Audit exhaustif produit en Phase 0 de la SPEC. Aucune ligne de code n'est écrite tant que ce document n'est pas validé.
> Date : 2026-04-19 — branche : `master` — commit HEAD : `20151d5`.

---

## §1.1 — Composant légende actuel

**Chemin** : `apps/web/src/components/planning/PlanningView.tsx` — bloc `{showLegend && (…)}` **lignes 611-672**.

**Structure (JSX simplifié)** :

```tsx
{showLegend && (
  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
    <h3 className="text-sm font-semibold text-gray-900 mb-3">
      {t("legend.title")}  // "Légende"
    </h3>
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
      {/* 13 items inline : <div className="flex items-center space-x-2"><span>...</span><span>label</span></div> */}
    </div>
  </div>
)}
```

La barre est rendue **sous** la `<PlanningGrid>` (ligne 600) et reste visible en permanence quand `showLegend === true` (défaut `true` côté page `/planning`).

**Source des éléments visuels** : **définition inline** dans le JSX (pas de fichier de constantes dédié). Les icônes de statut sont toutefois déjà centralisées via `getStatusIcon()` dans `apps/web/src/lib/planning-utils.ts:137-150`.

### Table des 13 items

| # | Libellé rendu | i18n key | Source visuelle | Source technique |
|---|---|---|---|---|
| 1 | À faire | `common.taskStatus.TODO` | `○` (texte inline) | `getStatusIcon(TaskStatus.TODO)` — `planning-utils.ts:139` |
| 2 | En cours | `common.taskStatus.IN_PROGRESS` | `◐` (texte inline) | `getStatusIcon(TaskStatus.IN_PROGRESS)` — `planning-utils.ts:141` |
| 3 | En revue | `common.taskStatus.IN_REVIEW` | `◕` (texte inline) | `getStatusIcon(TaskStatus.IN_REVIEW)` — `planning-utils.ts:143` |
| 4 | Terminé | `common.taskStatus.DONE` | `●` (texte inline) | `getStatusIcon(TaskStatus.DONE)` — `planning-utils.ts:145` |
| 5 | Bloqué | `common.taskStatus.BLOCKED` | `⊗` (texte inline) | `getStatusIcon(TaskStatus.BLOCKED)` — `planning-utils.ts:147` |
| 6 | Tâche projet | `planning.legend.projectTask` | `<span class="inline-block w-3 h-3 bg-blue-500 rounded"></span>` | Tailwind inline (`bg-blue-500`) |
| 7 | Tâche sans projet | `planning.legend.orphanTask` | `<span class="inline-block w-3 h-3 bg-slate-400 rounded"></span>` | Tailwind inline (`bg-slate-400`) |
| 8 | Télétravail | `planning.legend.telework` | `🏠` (emoji) | Emoji inline |
| 9 | Bureau | `planning.legend.office` | `🏢` (emoji) | Emoji inline |
| 10 | Congé validé | `planning.legend.leaveValidated` | `🌴` (emoji) | Emoji inline (défaut) — en cellule : `leave.leaveType.icon ?? "🌴"` (DayCell.tsx:58) |
| 11 | Congé en attente | `planning.legend.leavePending` | `🌴?` avec `opacity-60` | Emoji inline |
| 12 | Événement | `planning.legend.event` | `📅` (emoji) | Emoji inline |
| 13 | Intervention ext. | `planning.legend.externalIntervention` | `<span class="inline-block w-3 h-3 bg-red-500 rounded"></span>` | Tailwind inline (`bg-red-500`) |

---

## §1.2 — Mapping légende ↔ conditions de rendu dans les cellules

Toutes les cellules jour sont rendues par **un seul composant** : `apps/web/src/components/planning/DayCell.tsx`.

| Libellé légende | Prédicat technique | Fichier / lignes du rendu conditionnel |
|---|---|---|
| À faire | `task.status === TaskStatus.TODO` dans `cell.tasks.map(...)` | `DayCell.tsx:217` (mois, icône centrale) ; `DayCell.tsx:228` (semaine, icône dans flex) |
| En cours | `task.status === TaskStatus.IN_PROGRESS` | idem (via `getStatusIcon`) |
| En revue | `task.status === TaskStatus.IN_REVIEW` | idem |
| Terminé | `task.status === TaskStatus.DONE` | idem |
| Bloqué | `task.status === TaskStatus.BLOCKED` | idem |
| Tâche projet | `task.projectId != null` (calculé par `const isOrphan = !task.projectId` → `!isOrphan`) | `DayCell.tsx:194-267` — la tâche est rendue avec `getPriorityColor(task.priority)` quand elle a un projet |
| Tâche sans projet | `!task.projectId` | `DayCell.tsx:199-204` — classe `bg-slate-100 text-slate-800 border-slate-400` ; ligne 235 masque la pastille de statut pour les orphelines |
| Télétravail | `cell.isTelework && !hasLeave && !cell.isHoliday && !cell.isExternalIntervention` | Deux rendus : (a) **background orange** `DayCell.tsx:146-154` (z-0) ; (b) **icône `🏠`** via le toggle `DayCell.tsx:160-177` (avec permission) ou lecture seule `DayCell.tsx:179-191` |
| Bureau | `!cell.isTelework && canToggleTelework && !hasLeave && !cell.isHoliday && !hasAllDayEvent` | `DayCell.tsx:171` — l'icône `🏢` s'affiche **uniquement** dans le bouton toggle de l'utilisateur qui peut basculer TT. Il n'y a **aucun background** associé. |
| Congé validé | `hasLeave && leave.status !== "PENDING"` (donc APPROVED) | `DayCell.tsx:97-135` — overlay plein z-10 avec `borderStyle: "solid"` et alpha plus opaque (`${leaveColor}4D`) |
| Congé en attente | `hasLeave && leave.status === "PENDING"` | `DayCell.tsx:97-135` — mêmes coordonnées, `borderStyle: "dashed"` + alpha réduit (`${leaveColor}26`) |
| Événement | `cell.events.map(...)` avec `!event.isExternalIntervention` ET `!hasLeave && !cell.isHoliday` | `DayCell.tsx:326-377` — border + bg purple, icône `📅` |
| Intervention ext. | `cell.isExternalIntervention` (cellule) **ET/OU** `task.isExternalIntervention`, `event.isExternalIntervention`, `predefinedTask.isExternalIntervention` | Trois lieux : (a) **background rouge cellule** `DayCell.tsx:137-143` (z-0) ; (b) **tâche rouge** `DayCell.tsx:200-201` (`bg-red-100 border-red-400`) ; (c) **événement rouge** `DayCell.tsx:330-335` ; (d) **predefined-task rouge** `DayCell.tsx:274, 280-284, 287, 291` |

**Notes importantes pour l'implémentation** :

1. Le `leaveType.icon` et `leaveType.color` peuvent être customisés en DB (`leave.leaveType.icon`, `leave.leaveType.color` — DayCell.tsx:58-59). Le filtre masque l'overlay **quelle que soit l'icône custom**.
2. Les congés **masquent** les tâches/events en les rendant invisibles via la condition `!hasLeave` (DayCell.tsx:160, 194, 270, 327). Si on masque "Congé validé", les tâches sous-jacentes deviennent visibles — comportement normal et souhaité.
3. "Intervention ext." a **4 points de rendu** : cellule globale + 3 types d'entités enfants. Le filtre doit s'appliquer à tous les 4.

---

## §1.3 — Architecture de rendu des cellules du planning

**Un seul composant de cellule** : `apps/web/src/components/planning/DayCell.tsx`.

Il est instancié par `UserRow.tsx:82-102` dans `apps/web/src/components/planning/UserRow.tsx`, lui-même instancié par `CollapsibleServiceSection` dans `PlanningGrid.tsx:89-110`.

### Composition des overlays

Racine `<div class="relative overflow-hidden …">` (DayCell.tsx:74), puis empilage :

| Couche | Élément | z-index | Condition | Type de nœud |
|---|---|---|---|---|
| Background cellule | `bgClass` inline (rouge férié, bleu today, gris spécial) | 0 (par défaut) | `cell.isHoliday \|\| isToday \|\| cell.isSpecialDay` | Classe sur la racine |
| Background External Intervention | `<div class="absolute inset-0 z-0 bg-red-100/40 …">` | 0 | `cell.isExternalIntervention && !hasLeave && !cell.isHoliday` | Nœud dédié (DayCell.tsx:138-143) |
| Background Télétravail | `<div class="absolute inset-0 z-0 bg-orange-100/40 …">` | 0 | `cell.isTelework && !hasLeave && !cell.isHoliday && !cell.isExternalIntervention` | Nœud dédié (DayCell.tsx:146-154) |
| Overlay Holiday | `<div class="absolute inset-0 … z-10 bg-red-100/80 …">` | 10 | `cell.isHoliday && !hasLeave` | Nœud dédié (DayCell.tsx:81-95) — **hors périmètre légende** |
| Overlay Leave | `<div class="absolute inset-0 … z-10 border-2" style={backgroundColor...}>` | 10 | `hasLeave` | Nœud dédié (DayCell.tsx:98-134) |
| Contenu principal | `<div class="relative z-10 space-y-1 …">` avec toggle TT, tasks, predefined-tasks, events | 10 | toujours rendu, enfants conditionnels | Nœud dédié (DayCell.tsx:156-378) |
| └ Toggle Télétravail (bouton `🏠`/`🏢`) | `<button …>` | — | `!hasLeave && !cell.isHoliday && !hasAllDayEvent && canToggleTelework` | Branche ternaire sur `cell.isTelework` (DayCell.tsx:160-177) |
| └ Tasks (`.map`) | `<div draggable …>` par tâche | — | `!hasLeave && !cell.isHoliday && !hasAllDayEvent` | Liste (DayCell.tsx:194-267) |
| └ Predefined Tasks (`.map`) | `<div …>` par assignation | — | `!hasLeave && !cell.isHoliday && !hasAllDayEvent` | Liste (DayCell.tsx:270-311) |
| └ Events (`.map`) | `<div …>` par événement | — | `!hasLeave && !cell.isHoliday` | Liste (DayCell.tsx:327-377) |

### Séparabilité des overlays (décision tranchée)

| Overlay légende | Séparable individuellement ? | Mécanisme |
|---|---|---|
| Statuts tâches (5) | ✅ Oui | Filtrer le `cell.tasks.map(...)` sur `task.status` avant rendu |
| Tâche projet | ✅ Oui | Filtrer le `map` sur `task.projectId != null` |
| Tâche sans projet | ✅ Oui | Filtrer le `map` sur `!task.projectId` |
| Télétravail | ✅ Oui | Conditionner le nœud `bg-orange-100/40` (ligne 146) ET l'icône `🏠` du toggle (ligne 171/185) |
| Bureau | ✅ Oui | Conditionner l'icône `🏢` du toggle (ligne 171) — ne s'affiche déjà que quand TT=OFF ; masquer "Bureau" = rendre `<span></span>` à la place |
| Congé validé | ✅ Oui | Conditionner l'overlay leave sur `isPending === false` avant rendu |
| Congé en attente | ✅ Oui | Conditionner l'overlay leave sur `isPending === true` avant rendu |
| Événement | ✅ Oui | Filtrer `cell.events.map(...)` sur `!event.isExternalIntervention` |
| Intervention ext. | ✅ Oui (4 points) | Conditionner : (a) background cellule L138, (b) style rouge de la tâche L200-201, (c) style rouge de l'event L330-335, (d) style rouge du predefined-task L274+280-284 |

**Conclusion** : tous les overlays du périmètre légende sont séparables individuellement **sans aucun refactor structurel**. Pas de nœud monolithique bloquant.

**Risque 2 (spec §5) : NON applicable** — aucun refactor lourd requis.

---

## §1.4 — Store `planningView.store.ts`

**Chemin** : `apps/web/src/stores/planningView.store.ts` — 119 lignes.

### Contenu intégral

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PlanningViewState {
  collapsedServices: Record<string, boolean>;
  selectedServices: string[];
  hasInitializedServices: boolean;

  toggleService: (serviceId: string) => void;
  collapseService: (serviceId: string) => void;
  expandService: (serviceId: string) => void;
  collapseAll: (serviceIds: string[]) => void;
  expandAll: () => void;
  isCollapsed: (serviceId: string) => boolean;
  setSelectedServices: (serviceIds: string[]) => void;
  initializeServicesIfNeeded: (availableServiceIds: string[]) => void;
}

export const usePlanningViewStore = create<PlanningViewState>()(
  persist(
    (set, get) => ({
      collapsedServices: {},
      selectedServices: [],
      hasInitializedServices: false,

      setSelectedServices: (serviceIds) => {
        set({ selectedServices: serviceIds, hasInitializedServices: true });
      },
      initializeServicesIfNeeded: (availableServiceIds) => {
        if (get().hasInitializedServices) return;
        if (availableServiceIds.length === 0) return;
        set({ selectedServices: availableServiceIds, hasInitializedServices: true });
      },
      toggleService: (serviceId) => {
        set((state) => ({
          collapsedServices: { ...state.collapsedServices, [serviceId]: !state.collapsedServices[serviceId] },
        }));
      },
      collapseService: (serviceId) => { set((state) => ({ collapsedServices: { ...state.collapsedServices, [serviceId]: true } })); },
      expandService:   (serviceId) => { set((state) => ({ collapsedServices: { ...state.collapsedServices, [serviceId]: false } })); },
      collapseAll: (serviceIds) => {
        const allCollapsed: Record<string, boolean> = {};
        serviceIds.forEach((id) => { allCollapsed[id] = true; });
        set({ collapsedServices: allCollapsed });
      },
      expandAll: () => { set({ collapsedServices: {} }); },
      isCollapsed: (serviceId) => get().collapsedServices[serviceId] ?? false,
    }),
    {
      name: "orchestra-planning-view",
      partialize: (state) => ({
        collapsedServices: state.collapsedServices,
        selectedServices: state.selectedServices,
        hasInitializedServices: state.hasInitializedServices,
      }),
    },
  ),
);
```

### Pattern identifié

- **Style** : state **flat + actions inline** dans le `create(…)`, **pas de slices**.
- **Middleware utilisé** : `persist` de `zustand/middleware` avec `name: "orchestra-planning-view"` et `partialize` explicite.
- **Nom exact du hook exporté** : `usePlanningViewStore`.
- **Convention de nommage des actions** : camelCase, **verbe+objet** (`toggleService`, `collapseService`, `expandAll`, `setSelectedServices`, `isCollapsed`…).
- **Conventions internes** : accès state via `get()`, immutabilité par spread operator, pas de devtools, pas de subscribeWithSelector.

### Décision tranchée — extension pour les filtres légende

1. **Ajouter** un champ flat `legendFilters: Record<LegendItemKey, boolean>` au state (ou 13 booléens individuels — retenir `Record` pour la concision, typé strictement).
2. **Ajouter** deux actions camelCase : `toggleLegendFilter(key: LegendItemKey)` et `resetLegendFilters()`.
3. **Clé `LegendItemKey`** : union de 13 chaînes stables, ex. `"todo" | "inProgress" | "inReview" | "done" | "blocked" | "projectTask" | "orphanTask" | "telework" | "office" | "leaveValidated" | "leavePending" | "event" | "externalIntervention"`.
4. **Defaults** : les 13 clés à `true` dans la valeur initiale du state (hardcodé dans `create(…)`).
5. **Persist** : ajouter `legendFilters` au state mais l'**exclure** du `partialize`. → reset au reload = session-only (conforme §2.1).
6. **Selectors granulaires** pour les cellules : `const showTodo = usePlanningViewStore(s => s.legendFilters.todo)`. Cela permet à chaque `DayCell` de ne re-render que si son filtre lu change (conforme §2.4).

La règle « pas de `persist` middleware » de §2.1 se traduit ici par « pas de persistance de ce champ », pas par « ne pas utiliser le middleware existant » — le middleware reste nécessaire pour `collapsedServices`/`selectedServices`.

---

## §1.5 — Header de la page planning

### Localisation réelle

Le « header » de `/planning` **n'est pas dans la page `page.tsx`** : `apps/web/app/[locale]/planning/page.tsx` (18 lignes) ne fait qu'instancier `<PlanningView showLegend={true} …/>` dans `<MainLayout>`.

Le vrai header est **dans `PlanningView.tsx` lignes 218-352**, dans le bloc `{/* Header */}`.

### Structure (extrait JSX condensé)

```tsx
{/* Header */}
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-bold text-gray-900">{title || t("title")}</h1>
    <p className="text-gray-600 mt-1">{/* dates */}</p>
  </div>
  {showControls && (
    <div className="flex items-center space-x-4">
      {/* Bouton Créer dropdown — lines 244-289 */}
      <div className="relative" ref={createMenuRef}>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2">
          <span>+</span><span>{t("create")}</span><svg.../>
        </button>
        {showCreateMenu && (<div className="absolute …">...</div>)}
      </div>
      {/* Toggle Semaine/Mois — lines 290-311 */}
      <div className="flex bg-gray-100 rounded-lg p-1">
        <button ...>{t("week")}</button>
        <button ...>{t("month")}</button>
      </div>
      {/* Nav < Aujourd'hui > — lines 312-349 */}
      <button className="p-2 hover:bg-gray-100 rounded-lg transition">←</button>
      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">{t("today")}</button>
      <button className="p-2 hover:bg-gray-100 rounded-lg transition">→</button>
    </div>
  )}
</div>
```

### Emplacement proposé pour le trigger popover

**Recommandation** : insérer le trigger **à la fin du flex du header** (après le bouton `→`, dans la rangée `showControls` ligne 349), **séparé visuellement** par un espace ou un petit séparateur.

**Justification** :
- Le header est une rangée de contrôles globaux ; la légende est un contrôle d'affichage → elle appartient à la même rangée.
- Le placer à droite (après navigation date) évite de pousser les contrôles principaux et garde un œil sur un emplacement « périphérique » typique de ce type de fonctionnalité (cf. Gantt, Notion, Google Calendar).
- Alternative possible : juste après le toggle Semaine/Mois (ligne 311), mais risque de casser le rythme visuel centré sur la navigation date.

### Pattern de bouton à réutiliser

Trois styles de bouton présents dans le header :

| Style | Exemple | Classes | Usage |
|---|---|---|---|
| Primaire bleu | « Créer », « Aujourd'hui » | `bg-blue-600 text-white rounded-lg hover:bg-blue-700 px-4 py-2` | Action principale |
| Neutre carré | `←`, `→` | `p-2 hover:bg-gray-100 rounded-lg transition` | Navigation |
| Toggle segment | « Semaine / Mois » | `bg-gray-100 rounded-lg p-1` + enfants `bg-white shadow-sm` quand actif | État binaire |

Le bouton « Légende » doit être **neutre** (pas une action primaire) mais inclure icône **+ label** pour l'affordance. Proposition : style « neutre étendu » — `px-3 py-2 hover:bg-gray-100 rounded-lg transition text-sm text-gray-700 flex items-center space-x-2`. Ce pattern est cohérent avec les boutons « Replier/Déplier » existants (ligne 531-574 : `px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 … flex items-center gap-1`).

**Icône suggérée** : emoji `🎨` ou caractère `≡` si on veut rester cohérent avec l'usage Unicode/emoji du header actuel (le projet n'utilise pas `lucide-react` dans le dossier `planning/` — cf. §1.6).

**Libellé** : `t("legend.title")` → « Légende » (déjà présent dans `apps/web/messages/fr/planning.json:50`).

---

## §1.6 — Radix Popover

### Vérification de présence

```text
apps/web/package.json (dependencies) :
  @radix-ui/react-avatar         ^1.1.11
  @radix-ui/react-dialog         ^1.1.15
  @radix-ui/react-dropdown-menu  ^2.1.16
  @radix-ui/react-label          ^2.1.8
  @radix-ui/react-select         ^2.2.6
  @radix-ui/react-slot           ^1.2.4
  @radix-ui/react-tabs           ^1.1.13
```

**`@radix-ui/react-popover` : ABSENT.**

### Usages Radix dans le code

```text
$ grep -r "@radix-ui" apps/web/src → 0 résultat
$ grep -r "@radix-ui" apps/web     → 1 résultat (package.json uniquement)
```

**Aucune utilisation réelle** des paquets Radix déclarés. Le projet a les dépendances mais ne s'en sert pas — les dropdowns existants (PlanningView.tsx : `showCreateMenu`, `showServiceDropdown`, `showDisplayDropdown`) sont **hand-rolled** avec `useState` + `useRef` + `useEffect(click-outside)`.

### Wrapper shadcn/ui local

```text
packages/ui/index.ts : export {};   (strictement vide)
packages/ui/package.json : pas de dépendances utiles
apps/web/src/components/ui/ : n'existe pas
```

**Aucun wrapper shadcn/ui local disponible.**

### Décision tranchée

Deux options, à arbitrer par l'utilisateur :

- **Option 1 (recommandée, conforme spec)** : installer `@radix-ui/react-popover` (via `pnpm --filter web add @radix-ui/react-popover`) et l'utiliser directement sans wrapper shadcn. Coût : 1 dépendance + quelques lignes de styles Tailwind pour le contenu. Bénéfice : accessibilité (focus trap, gestion clavier, positioning) gratuite, conforme à la spec §1.6.
- **Option 2 (fallback si refus install)** : répliquer le pattern hand-rolled existant (cf. `showDisplayDropdown`, PlanningView.tsx lignes 452-527) pour rester cohérent avec le reste du fichier. Coût : 0 dépendance ; inconvénient : perd l'accessibilité Radix (gestion Échap, focus, positionnement viewport-aware).

**Recommandation** : **Option 1**. La spec demande explicitement Radix Popover, le projet a déjà d'autres paquets `@radix-ui` en dépendance (cohérent écosystème), et la dette d'accessibilité ne mérite pas d'être reproduite sur ce nouveau composant.

### Pattern de référence (à défaut d'usage Radix existant)

Le pattern hand-rolled le plus proche sémantiquement est le dropdown « Affichage » de PlanningView.tsx (lignes 452-527) — panneau avec titre section, liste d'items à checkbox + icône + label, footer avec boutons rapides « Tout / Aucun ». C'est **exactement** la structure demandée pour le popover légende. Le nouveau composant peut **s'en inspirer visuellement** tout en utilisant Radix pour le comportement.

---

## §1.7 — Sémantique du filtrage par cellule

### Option A vs Option B

**Option A — masquer overlays individuels** : toggler un filtre retire uniquement l'élément visuel correspondant, la cellule et ses autres overlays restent rendus.

**Option B — masquer la cellule entière** : toggler un filtre fait disparaître la cellule si son type principal correspond.

### Décision : Option A

**Faisabilité technique** : confirmée par §1.3 (tous les overlays sont séparables). Aucun refactor requis.

**Justification sémantique** :
- Les filtres légende servent à **réduire le bruit visuel**, pas à recomposer la grille. La grille doit rester stable pour la lecture (alignement jours, cohérence des colonnes).
- Un utilisateur qui masque « Télétravail » veut cacher l'icône `🏠` + le background orange, **pas faire disparaître toute la cellule** (qui contient peut-être une tâche importante).
- Sur une cellule combinant TT + tâche projet, masquer « Télétravail » doit garder la tâche visible — c'est le **Smoke test D** de §6 de la spec, qui impose implicitement l'Option A.

### Cas particuliers

1. **Congés** : l'overlay congé (z-10) **masque** actuellement les tâches sous-jacentes via le prédicat `!hasLeave`. Si on masque « Congé validé », l'overlay disparaît et les tâches/events sous-jacents redeviennent visibles — **comportement souhaité** (et cohérent avec l'intention utilisateur « je ne veux plus voir les absences »).
2. **« Bureau »** : l'icône `🏢` ne s'affiche que quand l'utilisateur a la permission toggle TT ET que TT=OFF. Masquer « Bureau » = cacher l'icône `🏢` (le bouton reste cliquable pour les utilisateurs ayant la permission, seul le glyphe change). Pour préserver la fonctionnalité toggle, on rendra un `<span></span>` vide à la place ; la cible de clic reste intacte.
3. **« Intervention ext. »** : 4 points de rendu (cf. §1.2). Le filtre conditionne les 4 à la fois.
4. **« Tâche projet » vs « Tâche sans projet »** : si l'utilisateur désactive les deux, aucune tâche n'est rendue (comportement attendu et naturel).
5. **Statuts de tâches** : si l'utilisateur désactive les 5, aucune tâche non plus — un statut est obligatoire par ressource.

### Matrice de rendu (résumé)

| Filtre OFF | Effet dans `DayCell` |
|---|---|
| todo | Skip `task` si `status === TODO` |
| inProgress | Skip `task` si `status === IN_PROGRESS` |
| inReview | Skip `task` si `status === IN_REVIEW` |
| done | Skip `task` si `status === DONE` |
| blocked | Skip `task` si `status === BLOCKED` |
| projectTask | Skip `task` si `projectId != null` |
| orphanTask | Skip `task` si `!projectId` |
| telework | Skip background orange L146 + icône `🏠` L171/185 |
| office | Remplacer glyphe `🏢` par `""` L171 |
| leaveValidated | Skip overlay leave si `!isPending` |
| leavePending | Skip overlay leave si `isPending` |
| event | Skip `event` si `!event.isExternalIntervention` |
| externalIntervention | Skip background rouge cellule L138 + style rouge de tasks/events/predefined (remplacer par style standard) |

---

## Synthèse — Matrice de conflits (confirmée)

La spec §3 liste 4 teammates. Paths réels vérifiés :

| Teammate | Domaine | Fichier(s) exact(s) | Type | Conflit ? |
|---|---|---|---|---|
| A | Store | `apps/web/src/stores/planningView.store.ts` | Extension (ajout champs + actions) | — |
| B | Popover | **création** `apps/web/src/components/planning/LegendFilterPopover.tsx` (nom proposé) | Création + lecture des actions de A | — |
| C | Header + suppression légende | `apps/web/src/components/planning/PlanningView.tsx` (header L218-352 + suppression bloc légende L611-672) | Modification | — |
| D | Cellules | `apps/web/src/components/planning/DayCell.tsx` | Ajout selectors + rendus conditionnels | — |

**Vérification non-conflit** :

- C (PlanningView.tsx) ≠ D (DayCell.tsx) → **OK, fichiers distincts**.
- C (PlanningView.tsx) ≠ A (planningView.store.ts) → **OK**.
- B (LegendFilterPopover.tsx **nouveau**) ≠ autres → **OK**.
- La matrice §3 de la spec s'applique telle quelle. **Pas de fusion nécessaire**.

**Ordre de dépendance**:
1. Vague 0 (A) → store étendu
2. Vague 1 (B + D en parallèle) → consomment A
3. Vague 2 (C) → intègre B dans le header, supprime l'ancien bloc

---

## Dépendances supplémentaires à installer

- `pnpm --filter web add @radix-ui/react-popover` (§1.6, option 1 recommandée)

Aucune autre dépendance nouvelle. Aucune migration DB. Aucun endpoint API. Aucun guard touché.

---

## Risques — synthèse et statut

| # | Risque | Statut |
|---|---|---|
| 1 | Sémantique filtrage cellule | **TRANCHÉ** — Option A (§1.7) |
| 2 | Overlays non séparables | **NON applicable** — tous séparables (§1.3) |
| 3 | Viewport étroit (popover <640px) | À surveiller au smoke test V2 ; fallback Dialog possible mais non préemptif |
| 4 | Performance toggle | Mitigation = selectors granulaires (§2.4) ; validation au smoke test |
| 5 | RBAC / sécurité | Aucun — scope 100% frontend |
| 6 | Code mort après suppression | À vérifier en Vague 2 via `grep` final pour `legend.title`, `legend.projectTask`, `legend.orphanTask`, `legend.leave`, `legend.leaveValidated`, `legend.leavePending`, `legend.telework`, `legend.office`, `legend.event`, `legend.externalIntervention` (confirmer qu'ils sont **réutilisés par le popover** avant suppression) + `showLegend` prop dans PlanningView |

Note sur Risque 6 : la prop `showLegend` de `PlanningView` est utilisée dans `app/[locale]/planning/page.tsx:13`. Après suppression du bloc légende, la prop devient inutile — il faut soit (a) la supprimer complètement, soit (b) la garder pour rétrocompat. Proposition : **la supprimer** (règle CLAUDE.md : « Avoid backwards-compatibility hacks »).

---

## Prêt pour Vague 0 ?

**OUI**, sous réserve de validation utilisateur :

1. Choix Radix Popover vs hand-rolled (§1.6) — recommandation Option 1 (installer `@radix-ui/react-popover`).
2. Emplacement trigger (§1.5) — proposition : fin du flex header, après `→`.
3. Suppression de `showLegend` prop (§Risque 6) — proposition : oui, supprimer.

**Commande d'install préalable à la Vague 1** :
```bash
pnpm --filter web add @radix-ui/react-popover
```

---

**STOP.** En attente de validation explicite de l'utilisateur avant de démarrer la Vague 0.
