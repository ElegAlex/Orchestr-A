# Spec — Module Clients V1

**Date** : 2026-04-23
**Auteur** : Alexandre BERGE
**Statut** : Ratifié, prêt pour Phase 0

---

## 1. Contexte et objectif

Ajouter à Orchestr'A la notion de **Client** d'un projet : l'entité bénéficiaire pour laquelle le projet est réalisé. Dans le contexte CPAM 92, un client est typiquement un service interne (DSI, Direction Santé…) ou une personne interne.

Distinct du tiers : le tiers est réalisateur (intégré à l'équipe, saisit du temps, génère un coût), le client est commanditaire (pas d'équipe, pas de saisie de temps, consolide le « pour qui on travaille »).

## 2. Décisions ratifiées

| # | Décision |
|---|---|
| 1 | Entité `Client` autonome (pas de lien structuré vers `User` ni `Service`) |
| 2 | Relation N:M avec `Project`, sans notion de client principal |
| 3 | Coexistence libre tiers ↔ clients sur un même projet |
| 4 | Module inclut référentiel CRUD + vue projets par client + consolidation heures + exports |
| 5 | CRUD : ADMIN + RESPONSABLE ; attribution projet : ADMIN + RESPONSABLE + MANAGER + CHEF DE PROJET |
| 6 | Client affiché sur fiche projet, liste projets, exports PDF/Excel, Portfolio Gantt |
| 7 | Modèle minimal : `name` + `isActive` uniquement (pas de `description`) |
| 8 | `hoursLoggedTotal` = somme totale des `TimeEntry.hours` (interne + tiers) |

## 3. Phase 0 — Audit préalable (bloquant)

Avant toute implémentation, Claude Code doit produire `docs/superpowers/audits/2026-04-23-clients-audit.md` répondant à :

1. **Convention permissions** : `.` ou `:` dans `packages/rbac/atomic-permissions.ts` ? Listing exact des codes existants `third_parties.*` ou `third_parties:*`.
2. **Mapping rôles métier ↔ RBAC** : à quels rôles RBAC modernes (`ADMIN`, `ADMIN_DELEGATED`, `PORTFOLIO_MANAGER`, `MANAGER`, `MANAGER_PROJECT_FOCUS`, `PROJECT_LEAD`, `PROJECT_LEAD_JUNIOR`, etc.) correspondent les appellations métier :
   - **RESPONSABLE** → ?
   - **CHEF DE PROJET** → ?
3. **Pattern module `third-parties`** : liste exhaustive des fichiers (controller, service, DTO, specs, modals, composants), structure des computed flags (`canEdit`, `canDelete`), implémentation `deletion-impact`, pattern `assertExistsAndActive`.
4. **Sidebar** : `MainLayout.tsx` — icônes déjà utilisées, conventions de position, icône suggérée pour « Clients » distincte de celle de « Tiers ».
5. **Seed RBAC** : comportement exact de `seedPermissionsAndRoles`, risque de silent skip sur les `role_permissions` (référence mémoire `project_rbac_seed_silent_skip`), procédure de vérification post-seed.
6. **i18n** : fichiers de locale fr/en utilisés, clés existantes pour Tiers (`thirdParties.*`), pattern à cloner.
7. **ExportService** : localisation du service d'export PDF/Excel projets, signature, pattern d'ajout de colonne.
8. **PortfolioGantt** : localisation de `GanttPortfolioRow`, structure actuelle du tooltip, point d'insertion pour `clientName`.

Livrable validé par Alexandre avant Wave 1.

## 4. Modèle de données (Prisma)

```prisma
model Client {
  id        String   @id @default(uuid())
  name      String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  projects  ProjectClient[]
  @@map("clients")
}

model ProjectClient {
  projectId String
  clientId  String
  createdAt DateTime @default(now())
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  client    Client  @relation(fields: [clientId], references: [id], onDelete: Cascade)
  @@id([projectId, clientId])
  @@map("project_clients")
}
```

Ajout sur `Project` : `clients ProjectClient[]`.

## 5. API (NestJS)

Module `apps/api/src/clients/`.

| Méthode | Route | Permission | Description |
|---|---|---|---|
| POST | `/clients` | `clients:create` | Créer |
| GET | `/clients` | `clients:read` | Liste paginée (`search`, `isActive`, `page`, `limit`) |
| GET | `/clients/:id` | `clients:read` | Détail |
| GET | `/clients/:id/projects` | `clients:read` + `projects:read` | Liste projets + synthèse heures |
| GET | `/clients/:id/deletion-impact` | `clients:delete` | Compte projets rattachés |
| PATCH | `/clients/:id` | `clients:update` | MAJ (dont `isActive`) |
| DELETE | `/clients/:id` | `clients:delete` | Hard delete (refus si projets rattachés) |
| GET | `/projects/:projectId/clients` | `clients:read` | Liste clients d'un projet |
| POST | `/projects/:projectId/clients` | `clients:assign_to_project` | Rattacher |
| DELETE | `/projects/:projectId/clients/:clientId` | `clients:assign_to_project` | Détacher |

**Enrichissements existants** :
- `GET /projects` et `GET /projects/:id` : inclure `clients: {id, name}[]`
- `GET /projects?clients=uuid1,uuid2` : filtre OR (projet contient au moins un des clients)

**Computed flags** : réponses liste clients incluent `canEdit`, `canDelete` calculés côté API (pattern module `third-parties`).

La convention `:` ou `.` des codes de permission sera alignée sur l'existant après Phase 0.

## 6. RBAC (packages/rbac)

5 nouvelles permissions atomiques : `clients:read`, `clients:create`, `clients:update`, `clients:delete`, `clients:assign_to_project`.

Composée `CLIENTS_CRUD` = les 5.

Distribution dans les templates :

| Template | Permissions |
|---|---|
| ADMIN, ADMIN_DELEGATED, PORTFOLIO_MANAGER | `CLIENTS_CRUD` (tout) |
| MANAGER, MANAGER_PROJECT_FOCUS, PROJECT_LEAD, PROJECT_LEAD_JUNIOR | `clients:read` + `clients:assign_to_project` |
| THIRD_PARTY_MANAGER, TECHNICAL_LEAD, PROJECT_CONTRIBUTOR, PROJECT_CONTRIBUTOR_LIGHT, FUNCTIONAL_REFERENT, CONTROLLER, OBSERVER_FULL, OBSERVER_PROJECTS_ONLY, EXTERNAL_PRESTATAIRE | `clients:read` |

**Validation post-seed** : requête SQL vérifiant que `role_permissions` contient bien les lignes attendues pour chaque template. Silent skip = bug.

## 7. Frontend (Next.js)

**Service Axios** : `apps/web/src/services/clients.service.ts` (clone `third-parties.service.ts`).

**Pages** :
- `apps/web/app/[locale]/clients/page.tsx` — liste : search, toggle inactifs, bouton créer, CRUD inline, bouton « Exporter PDF/Excel »
- `apps/web/app/[locale]/clients/[id]/page.tsx` — 2 onglets :
  - **Infos** : nom, statut, dates, actions (éditer, archiver, supprimer avec confirmation si projets rattachés)
  - **Projets** : bandeau synthèse (Nb projets actifs/total, Budget cumulé h, Saisi h, Écart h) + tableau projets (nom, statut, manager, dates, charge saisie)

**Composants** (`apps/web/src/components/clients/`) :
- `ClientModal.tsx` — create/edit
- `ClientDeleteConfirmModal.tsx` — confirmation + `deletion-impact`
- `ClientSelector.tsx` — multi-select pour attacher à un projet (pattern `UserMultiSelect`)

**Fiche projet** : nouvel onglet `"clients"` inséré après `"thirdParties"` dans `apps/web/app/[locale]/projects/[id]/page.tsx`, pattern lazy load + `hasPermission`.

**Liste projets** :
- Dropdown multi-select « Clients » (source `GET /clients?isActive=true`), URL sync `?clients=...`
- Tag coloré sur chaque carte projet affichant les clients rattachés (truncate au 2ᵉ)

**Menu principal** : entrée « Clients » à côté de « Tiers », icône à confirmer en Phase 0, gate `clients:read`.

**i18n** : clés `clients.*` à ajouter dans fr.json et en.json (pattern `thirdParties.*`).

## 8. Exports

- `ExportService.exportToPDF` / `exportToExcel` projets : ajout colonne « Clients » (liste jointe par `, `)
- Page Clients : bouton « Exporter » → PDF (liste clients) + Excel (feuille Clients + feuille Projets par client)
- `PortfolioGantt` : `clientName` dans `GanttPortfolioRow`, affichage dans tooltip

## 9. Synthèse heures (onglet Projets de la fiche client)

Calcul API dans `GET /clients/:id/projects` :

```typescript
{
  projects: [{ id, name, status, manager, startDate, endDate, budgetHours, hoursLogged }],
  summary: {
    projectsActive: number,
    projectsTotal: number,
    budgetHoursTotal: number,   // Σ budgetHours des projets du client
    hoursLoggedTotal: number,   // Σ TimeEntry.hours sur ces projets (interne + tiers)
    varianceHours: number,      // budgetHoursTotal - hoursLoggedTotal
  }
}
```

Pas de cache dédié V1 — requête Prisma avec `aggregate`. Si perf problème → ajouter Redis en V2.

## 10. Tests

- **Backend** (Vitest, `apps/api/src/clients/*.spec.ts`) : controller + service (CRUD + assign + deletion-impact + summary). Couverture exigée : 100% sur `grouping.ts` équivalent s'il y en a, ≥ 90% lignes ailleurs.
- **Frontend** (Vitest, `clients.service.test.ts`, composants)
- **E2E** (Playwright, `e2e/clients.spec.ts`) : enregistrement dans `permission-matrix.ts` pour les 6 rôles test (admin/responsable/manager/référent/contributeur/observateur). Vérifier 403 vs 2xx sur chaque endpoint.

## 11. Seed

Enregistrer les 5 nouvelles permissions dans `atomic-permissions.ts` + leur distribution dans les templates. Le seed idempotent doit :
- créer les 5 `permissions` si absentes
- insérer les `role_permissions` manquantes sans dupliquer l'existant
- logger explicitement chaque insertion effective

**Vérification obligatoire post-seed** (référence mémoire `project_rbac_seed_silent_skip`) :

```sql
SELECT COUNT(*) FROM permissions WHERE code LIKE 'clients%';  -- attendu : 5
SELECT COUNT(*) FROM role_permissions rp
  JOIN permissions p ON rp.permission_id = p.id
  WHERE p.code LIKE 'clients%';  -- attendu : somme des distributions template
```

## 12. Hors scope V1 (explicite)

- Notion de coût € (pas de `hourlyRate` → reste en heures)
- Champ `description` sur Client (demandé, refusé)
- Contacts multiples, adresse, SIRET, logo, code métier
- Lien structuré `User ↔ Client` ou `Service ↔ Client`
- Client « principal » sur un projet
- Dashboard/analytics global « par client » (hors page fiche client)

## 13. Plan d'exécution par vagues

| Wave | Périmètre | Parallélisme | Dépendance |
|---|---|---|---|
| 0 | Audit Claude Code → `clients-audit.md` | Solo | — |
| 1 | Migration Prisma + seed RBAC idempotent | Solo (`schema.prisma` + `seed.ts`) | W0 validé |
| 2 | Backend : module `clients` (A) + extensions `projects` DTO/filter (B) | 2 agents si `projects.service.ts` séparable, sinon solo | W1 |
| 3 | Frontend référentiel pages+composants (A) + intégrations fiche projet/liste/ClientSelector (B) | 2 agents | W2 |
| 4 | Exports (ExportService + PortfolioGantt tooltip) | Solo | W2, W3 |
| 5 | E2E Playwright + `permission-matrix.ts` mise à jour | Solo | W4 |

## 14. Matrice de conflits fichiers

| Fichier | W1 | W2-A | W2-B | W3-A | W3-B | W4 | W5 |
|---|---|---|---|---|---|---|---|
| `schema.prisma` | ✏️ | | | | | | |
| `seed.ts`, `atomic-permissions.ts` | ✏️ | | | | | | |
| `apps/api/src/clients/*` | | ✏️ | | | | | |
| `apps/api/src/projects/projects.service.ts` | | | ✏️ | | | | |
| `apps/api/src/projects/dto/*` | | | ✏️ | | | | |
| `apps/web/app/[locale]/clients/*` | | | | ✏️ | | | |
| `apps/web/src/components/clients/*` | | | | ✏️ | | | |
| `apps/web/src/services/clients.service.ts` | | | | ✏️ | | | |
| `apps/web/app/[locale]/projects/[id]/page.tsx` | | | | | ✏️ | | |
| `apps/web/app/[locale]/projects/page.tsx` (liste) | | | | | ✏️ | | |
| `MainLayout.tsx` | | | | | ✏️ | | |
| `ExportService.ts`, `PortfolioGantt` | | | | | | ✏️ | |
| `e2e/clients.spec.ts`, `permission-matrix.ts` | | | | | | | ✏️ |

Locales fr.json / en.json : touchées en W3-A (à arbitrer sinon merge conflict W3-A ↔ W3-B).

---

**Livrable attendu** : `docs/superpowers/specs/2026-04-23-clients-module-design.md`, ce document.

**Prochaine étape** : déclenchement Phase 0 par Alexandre.
