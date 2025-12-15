# 🚀 DÉMARRER ORCHESTR'A V2

## Option 1 : Démarrage complet (Backend + Frontend)

### Terminal 1 : Backend

```bash
# À la racine du projet
cd apps/api
pnpm run dev
```

✅ Backend démarré sur : http://localhost:3001
✅ API disponible sur : http://localhost:3001/api
✅ Swagger docs : http://localhost:3001/api/docs

### Terminal 2 : Frontend

```bash
# À la racine du projet
cd apps/web
pnpm run dev
```

✅ Frontend démarré sur : http://localhost:3000

---

## Option 2 : Démarrage depuis la racine (avec Turborepo)

### Terminal unique

```bash
# À la racine du projet
pnpm run dev
```

Cela démarre **backend ET frontend** en parallèle.

---

## Première utilisation

### 1. Base de données

Si la base de données est vide :

```bash
# Créer les tables
cd packages/database
pnpm run migrate

# Insérer des données de test
pnpm run seed
```

### 2. Créer un utilisateur

**Via l'interface :**
1. Aller sur http://localhost:3000
2. Cliquer sur "S'inscrire"
3. Remplir le formulaire
4. Se connecter

**Via l'API (Swagger) :**
1. Aller sur http://localhost:3001/api/docs
2. POST `/auth/register`
3. Body :
```json
{
  "email": "admin@example.com",
  "login": "admin",
  "password": "admin123",
  "firstName": "Admin",
  "lastName": "User"
}
```

### 3. Tester l'application

Voir le fichier `apps/web/TESTING-GUIDE.md` pour les scénarios de test complets.

---

## URLs importantes

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | Application React |
| **Backend API** | http://localhost:3001/api | API REST |
| **Swagger Docs** | http://localhost:3001/api/docs | Documentation API |
| **Health Check** | http://localhost:3001/api/health | Status API |
| **PostgreSQL** | localhost:5432 | Base de données |
| **Redis** | localhost:6379 | Cache (si utilisé) |

---

## Utilisateurs de test (après seed)

| Login | Password | Rôle |
|-------|----------|------|
| admin | admin123 | ADMIN |
| manager | manager123 | MANAGER |
| user | user123 | CONTRIBUTEUR |

---

## Problèmes courants

### Backend ne démarre pas

**Erreur : "Cannot connect to database"**
```bash
# Démarrer Docker
pnpm run docker:dev

# Ou redémarrer PostgreSQL
docker-compose restart postgres
```

**Erreur : "Port 3001 already in use"**
```bash
# Trouver le processus
lsof -i :3001

# Tuer le processus
kill -9 <PID>
```

### Frontend ne démarre pas

**Erreur : "Module not found"**
```bash
cd apps/web
pnpm install
```

**Erreur : "Port 3000 already in use"**
```bash
# Utiliser un autre port
PORT=3001 pnpm run dev
```

### Base de données vide

```bash
cd packages/database
pnpm run db:reset  # Reset + migrate + seed
```

### JWT token expiré

- Se déconnecter
- Se reconnecter
- Le token sera rafraîchi automatiquement

---

## Arrêter l'application

### Arrêter un service

Dans le terminal correspondant : `Ctrl + C`

### Arrêter Docker

```bash
pnpm run docker:down
```

### Arrêter tout

```bash
# Dans chaque terminal
Ctrl + C

# Puis arrêter Docker
pnpm run docker:down
```

---

## Mode Production

### Build

```bash
# Backend
cd apps/api
pnpm run build

# Frontend
cd apps/web
pnpm run build
```

### Démarrer

```bash
# Backend
cd apps/api
pnpm run start:prod

# Frontend
cd apps/web
pnpm run start
```

---

## Support

**Logs Backend :** `apps/api/logs/`
**Logs Frontend :** Console navigateur (F12)

Pour tout problème, vérifier :
1. Docker est démarré (`docker ps`)
2. PostgreSQL fonctionne (`psql -U postgres`)
3. Variables d'environnement (.env files)
4. Logs dans les terminaux
