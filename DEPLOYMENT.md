# Guide de Déploiement Docker - ORCHESTR'A

Ce guide permet de déployer ORCHESTR'A sur un serveur en production avec Docker Compose.

## Prérequis

- **Docker** >= 24.0
- **Docker Compose** >= 2.20
- **Git**
- Un serveur avec au minimum :
  - 2 CPU
  - 4 Go RAM
  - 20 Go d'espace disque

## Déploiement rapide (5 minutes)

### 1. Cloner le repository

```bash
git clone https://github.com/ElegAlex/Orchestr-A.git
cd Orchestr-A
```

### 2. Configurer l'environnement

```bash
cp .env.production.example .env.production
```

Éditer `.env.production` et remplacer les valeurs :

```bash
# OBLIGATOIRE - Sécurité
DATABASE_PASSWORD=VotreMotDePassePostgres123!
REDIS_PASSWORD=VotreMotDePasseRedis456!
JWT_SECRET=$(openssl rand -base64 64)

# OBLIGATOIRE - Domaine
CORS_ORIGIN=https://votredomaine.com
```

### 3. Lancer l'application

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### 4. Initialiser la base de données

```bash
# Exécuter les migrations
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# (Optionnel) Seed avec données de démo
docker compose -f docker-compose.prod.yml exec api npx prisma db seed
```

### 5. Accéder à l'application

- **Application** : http://votre-serveur:3000
- **API** : http://votre-serveur:4000/api
- **Compte admin** : `admin@orchestr-a.internal` / `admin123`

⚠️ **Changez le mot de passe admin après la première connexion !**

---

## Configuration avancée

### Ports par défaut

| Service    | Port  | Variable         |
|------------|-------|------------------|
| Frontend   | 3000  | -                |
| API        | 4000  | API_PORT         |
| PostgreSQL | 5432  | DATABASE_PORT    |
| Redis      | 6379  | REDIS_PORT       |
| Nginx      | 80/443| -                |

### Reverse Proxy avec SSL (recommandé)

Le fichier `nginx/nginx.conf` est inclus. Pour HTTPS :

```bash
# Générer des certificats avec Let's Encrypt
certbot certonly --standalone -d votredomaine.com
cp /etc/letsencrypt/live/votredomaine.com/fullchain.pem nginx/ssl/orchestr-a.crt
cp /etc/letsencrypt/live/votredomaine.com/privkey.pem nginx/ssl/orchestr-a.key

# Démarrer avec Nginx
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### Variables d'environnement complètes

| Variable | Description | Obligatoire |
|----------|-------------|-------------|
| `DATABASE_PASSWORD` | Mot de passe PostgreSQL | ✅ |
| `REDIS_PASSWORD` | Mot de passe Redis | ✅ |
| `JWT_SECRET` | Secret JWT (min 32 chars) | ✅ |
| `CORS_ORIGIN` | Domaines autorisés | ✅ |
| `DATABASE_NAME` | Nom de la BDD | Non (défaut: orchestr_a_prod) |
| `DATABASE_USER` | Utilisateur PostgreSQL | Non (défaut: postgres) |
| `JWT_EXPIRES_IN` | Durée tokens | Non (défaut: 7d) |
| `SWAGGER_ENABLED` | Activer Swagger | Non (défaut: false) |

---

## Commandes utiles

### Gestion des conteneurs

```bash
# Démarrer
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# Arrêter
docker compose -f docker-compose.prod.yml down

# Voir les logs
docker compose -f docker-compose.prod.yml logs -f

# Logs d'un service spécifique
docker compose -f docker-compose.prod.yml logs -f api

# Redémarrer un service
docker compose -f docker-compose.prod.yml restart api

# État des services
docker compose -f docker-compose.prod.yml ps
```

### Base de données

```bash
# Migrations
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# Accès PostgreSQL
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -d orchestr_a_prod

# Backup
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres orchestr_a_prod > backup_$(date +%Y%m%d).sql

# Restore
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d orchestr_a_prod
```

### Mise à jour

```bash
# Pull les dernières modifications
git pull origin master

# Rebuild et redémarrer
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Appliquer les migrations
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

---

## Monitoring

### Health checks

- **API** : `GET http://localhost:4000/api/health`
- **Frontend** : `GET http://localhost:3000`

```bash
# Vérifier l'état
curl http://localhost:4000/api/health
```

### Ressources

```bash
docker stats
```

---

## Dépannage

### L'API ne démarre pas

```bash
docker compose -f docker-compose.prod.yml logs api
```

### Erreurs de connexion BDD

1. Vérifier `DATABASE_PASSWORD` dans `.env.production`
2. Vérifier que PostgreSQL est healthy : `docker compose -f docker-compose.prod.yml ps`

### Réinitialiser complètement

⚠️ **ATTENTION : Perte de toutes les données !**

```bash
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

---

## Checklist sécurité production

- [ ] Mots de passe forts (DATABASE_PASSWORD, REDIS_PASSWORD, JWT_SECRET)
- [ ] HTTPS activé avec certificats valides
- [ ] Firewall configuré (ports 80/443 uniquement)
- [ ] `SWAGGER_ENABLED=false`
- [ ] Mot de passe admin changé
- [ ] Sauvegardes automatiques configurées

---

## Support

Issues : https://github.com/ElegAlex/Orchestr-A/issues
