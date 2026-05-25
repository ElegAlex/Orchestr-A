# Visualisation des vacances scolaires dans le planning

**Date :** 2026-04-09
**Statut :** Approuvé

## Objectif

Afficher les périodes de vacances scolaires sous forme de bandeau horizontal dans les vues planning (semaine et mois), afin de permettre aux responsables d'anticiper les périodes de sous-effectif. Une seule zone scolaire est configurée globalement pour la collectivité.

## Modèle de données

### Nouveau modèle Prisma : `SchoolVacation`

```prisma
enum SchoolVacationZone {
  A
  B
  C
}

enum SchoolVacationSource {
  IMPORT
  MANUAL
}

model SchoolVacation {
  id          String                @id @default(cuid())
  name        String                @db.VarChar(100)   // "Vacances de Printemps"
  startDate   DateTime              @db.Date
  endDate     DateTime              @db.Date
  zone        SchoolVacationZone
  year        Int                   // Année scolaire (2025 = 2025-2026)
  source      SchoolVacationSource  @default(MANUAL)
  createdById String
  createdAt   DateTime              @default(now())
  updatedAt   DateTime              @updatedAt

  createdBy   User                  @relation(fields: [createdById], references: [id])

  @@unique([name, zone, year])
}
```

### Nouveau setting global

Clé : `planning.schoolVacationZone`
Valeurs : `"A"`, `"B"`, `"C"`
Défaut : `"C"` (zone la plus courante en Île-de-France)

Ajouté dans `DEFAULT_SETTINGS` du store `settings.store.ts`.

## Backend — Module `school-vacations`

### Endpoints

| Méthode  | Route                      | Description                     | Permission                |
| -------- | -------------------------- | ------------------------------- | ------------------------- |
| `GET`    | `/school-vacations`        | Liste (filtrable par `year`)    | Authentifié               |
| `GET`    | `/school-vacations/range`  | Par plage `startDate`/`endDate` | Authentifié               |
| `GET`    | `/school-vacations/:id`    | Détail                          | Authentifié               |
| `POST`   | `/school-vacations`        | Création manuelle               | `school-vacations:create` |
| `PATCH`  | `/school-vacations/:id`    | Modification                    | `school-vacations:update` |
| `DELETE` | `/school-vacations/:id`    | Suppression                     | `school-vacations:delete` |
| `POST`   | `/school-vacations/import` | Import open data                | `school-vacations:create` |

### Permissions RBAC

- **ADMIN, RESPONSABLE** : CRUD complet + import
- **Tous les rôles** : lecture (GET)

### Import open data

L'endpoint `POST /school-vacations/import` :

1. Lit le setting `planning.schoolVacationZone` pour déterminer la zone
2. Accepte un paramètre `year` (année scolaire)
3. Appelle l'API `data.education.gouv.fr` — dataset `fr-en-calendrier-scolaire`
4. Filtre sur la zone et l'année scolaire
5. Upsert les périodes (contrainte unique `name + zone + year`)
6. Marque les périodes importées avec `source: IMPORT`
7. Retourne le nombre de périodes créées/mises à jour

Pattern identique à `importFrenchHolidays` dans le module holidays.

### DTOs

**CreateSchoolVacationDto :**

- `name` : string, required, max 100 chars
- `startDate` : date ISO, required
- `endDate` : date ISO, required, >= startDate
- `zone` : SchoolVacationZone, optional (défaut : zone du setting global)
- `year` : number, required

**UpdateSchoolVacationDto :** Partial de CreateSchoolVacationDto

**ImportSchoolVacationDto :**

- `year` : number, required

**SchoolVacationRangeQueryDto :**

- `startDate` : date ISO, required
- `endDate` : date ISO, required

## Frontend — Affichage planning

### Service API

Nouveau fichier `services/school-vacations.service.ts` :

```typescript
schoolVacationsService = {
  getAll(year?: number)
  getByRange(startDate: string, endDate: string)
  getById(id: string)
  create(data: CreateSchoolVacationDto)
  update(id: string, data: UpdateSchoolVacationDto)
  delete(id: string)
  import(year: number)
}
```

### Hook `usePlanningData`

Ajout d'une query `schoolVacationsService.getByRange()` en parallèle des queries existantes (holidays, leaves, tasks, events). Expose un nouveau champ :

```typescript
schoolVacations: Array<{
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
}>;
```

### Bandeau dans `PlanningGrid`

Inséré entre le header des jours (sticky top) et la première section de service.

Pour chaque période de vacances chevauchant les jours affichés :

- **Positionnement** : `gridColumn` calculé du premier au dernier jour visible de la période (colonne 2 à N+1, la colonne 1 étant la colonne "Ressource")
- **Style** :
  - Fond dégradé : `linear-gradient(90deg, #dbeafe, #bfdbfe)`
  - Bordure basse : `2px solid #3b82f6`
  - Texte : `#1e40af`, centré, semibold
- **Contenu adaptatif** :
  - Vue semaine : `"🏖️ Vacances de Printemps — Zone C"` (~24px de haut)
  - Vue mois : `"🏖️ Printemps"` (~18px de haut)
- **Comportement** : purement informatif, pas d'interaction (ni clic, ni tooltip)
- **Toujours visible** : pas de toggle de masquage

Si plusieurs périodes chevauchent la vue (cas rare, transition entre deux périodes), chacune a son propre bandeau sur la même ligne, côte à côte.

### Aucune modification de `DayCell`

Le bandeau est un élément séparé au-dessus des lignes agents. Les cellules individuelles ne changent pas.

## Frontend — Administration

### Panneau dans Settings

Nouveau panneau "Vacances scolaires" dans la page Settings existante, à côté du panneau Holidays :

- **Sélecteur de zone** : dropdown A/B/C, met à jour `planning.schoolVacationZone`
- **Bouton "Importer"** : appelle `POST /school-vacations/import` avec l'année scolaire courante (et la suivante si disponible depuis l'open data)
- **Tableau des périodes** : colonnes Nom, Dates (début — fin), Source (badge "Import"/"Manuel"), Actions
- **Actions** : Modifier (ouvre modal), Supprimer (confirmation)
- **Bouton "Ajouter"** : création manuelle via modal

Modal de création/édition : mêmes patterns que `HolidayModal` — champs nom, date début, date fin, année scolaire.

## Hors scope

- Multi-zones (afficher A, B et C simultanément)
- Toggle de masquage du bandeau dans les filtres planning
- Interaction clic/tooltip sur le bandeau
- Configuration de la zone par agent individuel
- Modification de DayCell (pas de teinte de fond sur les colonnes)
