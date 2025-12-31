# Changelog - ORCHESTR'A V2

## [2.2.0] - 2025-11-08

### Ajouté

#### Diagramme de Gantt pour les projets

- Installation de la librairie `@rsagiev/gantt-task-react-19`
- Création du composant `GanttChart` (`apps/web/src/components/GanttChart.tsx`)
  - Affichage des tâches et jalons sur une timeline interactive
  - Groupement automatique des tâches sous leurs jalons respectifs
  - Sélecteur de vue: Jour/Semaine/Mois
  - Code couleur par statut:
    - DONE: vert (#10b981)
    - IN_PROGRESS: orange (#f59e0b)
    - BLOCKED: rouge (#ef4444)
    - Défaut: bleu (#3b82f6)
  - Gestion des tâches sans jalon (affichées à la fin)
  - Dynamic import pour optimisation (client-side only)
- Ajout d'un nouvel onglet "📊 Gantt" dans la page détail projet
- Création du fichier CSS personnalisé `apps/web/src/gantt-custom.css` pour améliorer la lisibilité du texte

#### Gestion des membres d'équipe projet - Suppression

- Bouton de suppression avec icône corbeille pour chaque membre
- Confirmation avant suppression
- Rechargement automatique des données après suppression
- Mise à jour du service `projects.service.ts` (méthode `removeMember`)

### Modifié

#### API - Gestion des membres projet

**Fichier**: `apps/api/src/projects/dto/add-member.dto.ts`

Extension du DTO avec champs optionnels:

- `allocation?: number` - Pourcentage d'allocation (0-100) avec validation
- `startDate?: string` - Date de début dans le projet (ISO 8601)
- `endDate?: string` - Date de fin dans le projet (ISO 8601)

**Fichier**: `apps/api/src/projects/projects.service.ts`

Méthode `addMember` mise à jour pour gérer les nouveaux champs:

```typescript
const member = await this.prisma.projectMember.create({
  data: {
    projectId,
    userId,
    role: role || 'Membre',
    ...(allocation !== undefined && { allocation }),
    ...(startDate && { startDate: new Date(startDate) }),
    ...(endDate && { endDate: new Date(endDate) }),
  },
  include: { user: { select: {...} } },
});
```

#### Frontend - Interface d'ajout de membre projet

**Fichier**: `apps/web/app/projects/[id]/page.tsx`

- Remplacement du champ texte libre "Rôle" par un menu déroulant avec 17 rôles prédéfinis:
  - **Direction**: Sponsor, Chef de projet
  - **Technique**: Responsable technique, Architecte, Tech Lead
  - **Développement**: Développeur Senior, Développeur, Développeur Junior
  - **Opérations**: DevOps
  - **Qualité**: QA Lead, Testeur
  - **Design**: UX/UI Designer
  - **Produit**: Product Owner, Scrum Master, Analyste métier
  - **Autres**: Membre, Observateur

- Amélioration de la lisibilité avec `text-gray-900` pour tous les labels et textes

### Corrigé

- Erreur HTTP 400 lors de l'ajout de membres (champs `allocation`, `startDate`, `endDate` manquants dans le DTO)
- Problème de lisibilité dans les modales (texte gris trop clair)
- Problème de lisibilité dans le diagramme de Gantt (texte trop clair)
  - Solution: CSS personnalisé avec `!important` pour forcer `color: #111827` (gray-900)
  - Sélecteurs ciblant tous les éléments texte et SVG de la librairie Gantt

### Technique

- Utilisation de `dynamic(() => import('@/components/GanttChart'), { ssr: false })` pour le composant Gantt
- CSS avec `!important` pour surcharger les styles de la librairie tierce
- Rebuild Docker avec `--no-cache` pour forcer la prise en compte des modifications CSS
- Validation des dates et allocation côté backend avec class-validator

### Fichiers modifiés (Backend)

1. `apps/api/src/projects/dto/add-member.dto.ts`
2. `apps/api/src/projects/projects.service.ts`

### Fichiers modifiés/créés (Frontend)

1. `apps/web/app/projects/[id]/page.tsx` - Ajout onglet Gantt, suppression membres, rôles prédéfinis
2. `apps/web/src/components/GanttChart.tsx` - Nouveau composant
3. `apps/web/src/gantt-custom.css` - Nouveau fichier CSS
4. `apps/web/package.json` - Ajout de @rsagiev/gantt-task-react-19

---

## [2.1.0] - 2025-11-08

### Feature: Affectation multi-services pour les utilisateurs

#### Problématique

Auparavant, un utilisateur ne pouvait être affecté qu'à un seul service. Cette limitation ne correspondait pas aux besoins réels où un utilisateur peut travailler sur plusieurs services simultanément.

#### Solution implémentée

Migration d'une relation one-to-many vers many-to-many entre User et Service via une table de jonction `UserService`.

---

## Modifications Backend (API)

### 1. Schéma de base de données (Prisma)

**Fichier**: `packages/database/prisma/schema.prisma`

#### Modifications du modèle User

- **Supprimé**:
  - Champ `serviceId?: String`
  - Relation `service?: Service`

- **Ajouté**:
  - Relation `userServices: UserService[]`

#### Nouveau modèle UserService (table de jonction)

```prisma
model UserService {
  id        String   @id @default(uuid())
  userId    String
  serviceId String
  createdAt DateTime @default(now())

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  service Service @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  @@unique([userId, serviceId])
  @@map("user_services")
}
```

#### Modifications du modèle Service

- **Supprimé**: Relation `users: User[]`
- **Ajouté**: Relation `userServices: UserService[]`

### 2. DTOs (Data Transfer Objects)

#### CreateUserDto et UpdateUserDto

**Fichier**: `apps/api/src/users/dto/create-user.dto.ts`

**Avant**:

```typescript
@IsOptional()
@IsString()
serviceId?: string;
```

**Après**:

```typescript
@IsOptional()
@IsArray()
@IsUUID('4', { each: true })
serviceIds?: string[];
```

#### RegisterDto

**Fichier**: `apps/api/src/auth/dto/register.dto.ts`

Même modification: `serviceId` → `serviceIds[]`

### 3. Services modifiés

#### UsersService (`apps/api/src/users/users.service.ts`)

**Méthode create()**:

- Validation de tous les services fournis
- Création de l'utilisateur sans serviceId
- Création des associations UserService avec `createMany()`

```typescript
// Créer les associations de services
if (createUserDto.serviceIds && createUserDto.serviceIds.length > 0) {
  await this.prisma.userService.createMany({
    data: createUserDto.serviceIds.map((serviceId) => ({
      userId: user.id,
      serviceId,
    })),
  });
}
```

**Méthode update()**:

- Suppression de toutes les associations existantes
- Création des nouvelles associations

```typescript
// Mettre à jour les services si fournis
if (updateUserDto.serviceIds !== undefined) {
  await this.prisma.userService.deleteMany({
    where: { userId: id },
  });

  if (updateUserDto.serviceIds.length > 0) {
    await this.prisma.userService.createMany({
      data: updateUserDto.serviceIds.map((serviceId) => ({
        userId: id,
        serviceId,
      })),
    });
  }
}
```

**Méthode getUsersByService()**:

```typescript
where: {
  userServices: {
    some: {
      serviceId,
    },
  },
}
```

**Toutes les requêtes**:

- Remplacement de `serviceId: true` par `userServices: { select: { service: {...} } }`

#### ServicesService (`apps/api/src/services/services.service.ts`)

- Comptage via `_count.userServices` au lieu de `_count.users`
- Statistiques calculées à partir de `userServices.map(us => us.user)`

#### Autres services mis à jour

- **auth.service.ts**: Support des serviceIds multiples dans l'inscription
- **departments.service.ts**: Statistiques via userServices
- **skills.service.ts**: Requêtes utilisateurs via userServices
- **telework.service.ts**: Requêtes utilisateurs via userServices
- **leaves.service.ts**: Requêtes utilisateurs via userServices
- **jwt.strategy.ts**: Suppression de serviceId de la validation

---

## Modifications Frontend (Web)

### 1. Types TypeScript

**Fichier**: `apps/web/src/types/index.ts`

#### Nouveau type

```typescript
export interface UserService {
  service: Service;
}
```

#### Modification de l'interface User

**Avant**:

```typescript
interface User {
  // ...
  serviceId?: string;
  service?: Service;
}
```

**Après**:

```typescript
interface User {
  // ...
  userServices?: UserService[];
}
```

#### Modification de RegisterDto

```typescript
serviceIds?: string[];  // au lieu de serviceId?: string
```

### 2. Page Utilisateurs

**Fichier**: `apps/web/app/users/page.tsx`

#### État du formulaire

```typescript
const [formData, setFormData] = useState({
  // ...
  serviceIds: [] as string[], // Array au lieu de string
});
```

#### Fonction de sélection multiple

```typescript
const toggleService = (serviceId: string) => {
  setFormData((prev) => ({
    ...prev,
    serviceIds: prev.serviceIds.includes(serviceId)
      ? prev.serviceIds.filter((id) => id !== serviceId)
      : [...prev.serviceIds, serviceId],
  }));
};
```

#### Interface de sélection (Checkboxes)

Remplacement du `<select>` par une liste de checkboxes:

```tsx
<div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3">
  {services
    .filter((service) => service.departmentId === formData.departmentId)
    .map((service) => (
      <label
        key={service.id}
        className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
      >
        <input
          type="checkbox"
          checked={formData.serviceIds.includes(service.id)}
          onChange={() => toggleService(service.id)}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <span className="text-sm text-gray-900">{service.name}</span>
      </label>
    ))}
</div>
```

#### Affichage des services (Badges)

Dans le tableau:

```tsx
{
  user.userServices && user.userServices.length > 0 && (
    <div className="mt-1 flex flex-wrap gap-1">
      {user.userServices.map((us) => (
        <span
          key={us.service.id}
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
        >
          {us.service.name}
        </span>
      ))}
    </div>
  );
}
```

#### Gestion de l'édition

```typescript
const openEditModal = (user: User) => {
  setEditingUser(user);
  setFormData({
    // ...
    serviceIds: user.userServices?.map((us) => us.service.id) || [],
  });
  setShowEditModal(true);
};
```

### 3. Page Profil

**Fichier**: `apps/web/app/profile/page.tsx`

Affichage des services multiples:

```tsx
{
  user.userServices && user.userServices.length > 0 && (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Services
      </label>
      <div className="flex flex-wrap gap-2">
        {user.userServices.map((us) => (
          <span
            key={us.service.id}
            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
          >
            {us.service.name}
          </span>
        ))}
      </div>
    </div>
  );
}
```

### 4. Amélioration du contraste (Skills page)

**Fichier**: `apps/web/app/skills/page.tsx`

Ajout de `text-gray-900` à tous les champs de formulaire dans les modals pour améliorer la lisibilité.

---

## Migration de la base de données

### Commande exécutée

```bash
docker exec orchestr-a-api-prod sh -c "cd packages/database && npx prisma db push"
```

### Changements appliqués

1. Création de la table `user_services`
2. Suppression de la colonne `serviceId` de la table `users`
3. Ajout des contraintes:
   - Foreign key `userId` → `users.id` (CASCADE on delete)
   - Foreign key `serviceId` → `services.id` (CASCADE on delete)
   - Unique constraint sur `(userId, serviceId)`

---

## Tests effectués

### Fonctionnalités validées

- ✅ Création d'un utilisateur avec plusieurs services
- ✅ Modification des services d'un utilisateur (ajout/suppression)
- ✅ Affichage des services multiples dans le tableau utilisateurs
- ✅ Affichage des services multiples dans le profil utilisateur
- ✅ Validation backend des services (vérification d'existence)
- ✅ Suppression en cascade des associations lors de la suppression d'un utilisateur
- ✅ Suppression en cascade des associations lors de la suppression d'un service

### Builds

- ✅ API: Build réussi sans erreur TypeScript
- ✅ Web: Build réussi sans erreur TypeScript
- ✅ Déploiement Docker: Conteneurs démarrés avec succès

---

## Impact sur les fonctionnalités existantes

### Compatibilité ascendante

⚠️ **Breaking change**: Cette modification nécessite une migration de données.

Si vous aviez des utilisateurs avec un `serviceId` dans l'ancienne version:

1. Les données de `serviceId` seront perdues lors du `db push`
2. Il faudra manuellement réaffecter les utilisateurs à leurs services

### Migration de données (si nécessaire)

Si vous avez des données en production, exécutez ce script SQL AVANT le `db push`:

```sql
-- Créer la table de jonction
CREATE TABLE user_services (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT user_services_userId_fkey FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT user_services_serviceId_fkey FOREIGN KEY ("serviceId") REFERENCES services(id) ON DELETE CASCADE,
  UNIQUE ("userId", "serviceId")
);

-- Migrer les données existantes
INSERT INTO user_services (id, "userId", "serviceId", "createdAt")
SELECT gen_random_uuid(), id, "serviceId", NOW()
FROM users
WHERE "serviceId" IS NOT NULL;

-- Puis lancer: npx prisma db push
```

---

## Fichiers modifiés

### Backend (17 fichiers)

1. `packages/database/prisma/schema.prisma`
2. `apps/api/src/auth/auth.service.ts`
3. `apps/api/src/auth/dto/register.dto.ts`
4. `apps/api/src/auth/strategies/jwt.strategy.ts`
5. `apps/api/src/departments/departments.service.ts`
6. `apps/api/src/leaves/leaves.service.ts`
7. `apps/api/src/services/services.service.ts`
8. `apps/api/src/skills/skills.service.ts`
9. `apps/api/src/telework/telework.service.ts`
10. `apps/api/src/users/dto/create-user.dto.ts`
11. `apps/api/src/users/dto/update-user.dto.ts`
12. `apps/api/src/users/users.service.ts`

### Frontend (4 fichiers)

1. `apps/web/src/types/index.ts`
2. `apps/web/app/users/page.tsx`
3. `apps/web/app/profile/page.tsx`
4. `apps/web/app/skills/page.tsx` (amélioration du contraste)

---

## Notes techniques

### Performance

- Les associations UserService sont chargées via `select` imbriqués (pas de N+1 queries)
- Index automatique sur `userId` et `serviceId` via Prisma
- Contrainte unique empêche les doublons

### Sécurité

- Validation des UUIDs avec `@IsUUID('4', { each: true })`
- Vérification de l'existence de tous les services avant création
- Suppression en cascade protège l'intégrité référentielle

### UX/UI

- Interface checkboxes pour sélection intuitive
- Badges colorés pour visualisation rapide
- Message d'aide si aucun département sélectionné
- Scroll vertical si beaucoup de services

---

## Améliorations futures possibles

1. **Pagination des services** dans le modal si nombre très élevé
2. **Filtre/recherche** dans la liste des services
3. **Rôles par service** (membre, responsable, etc.)
4. **Date de début/fin** d'affectation à un service
5. **Pourcentage d'allocation** par service
6. **Historique** des affectations

---

## Auteur

Implémenté par Claude (Anthropic) le 08/11/2025
Version: ORCHESTR'A V2.1.0
