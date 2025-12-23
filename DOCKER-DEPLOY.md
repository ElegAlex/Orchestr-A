# Déploiement Docker - Orchestr-A

Déploiement complet avec Docker Compose en 3 étapes.

## Prérequis

- Docker 24+
- Docker Compose 2+
- Un serveur avec 2GB RAM minimum

## Déploiement rapide

### 1. Cloner et configurer

```bash
git clone https://github.com/ElegAlex/Orchestr-A.git
cd Orchestr-A

# Générer automatiquement les secrets
./scripts/init-env.sh

# Éditer le fichier généré
nano .env.production
```

**Modifier obligatoirement :**
```env
CORS_ORIGIN=https://votre-domaine.com
```

### 2. Lancer

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

### 3. Vérifier

```bash
# Status des containers
docker compose -f docker-compose.prod.yml ps

# Logs
docker compose -f docker-compose.prod.yml logs -f
```

L'application est accessible sur http://localhost (ou votre domaine).

---

## Configuration manuelle (alternative)

Si le script `init-env.sh` ne fonctionne pas :

```bash
# Copier le template
cp .env.production.example .env.production

# Générer les secrets manuellement
echo "DATABASE_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)"
echo "REDIS_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)"
echo "JWT_SECRET=$(openssl rand -base64 64)"

# Éditer et remplir les valeurs
nano .env.production
```

---

## Services déployés

| Service | Port interne | Description |
|---------|--------------|-------------|
| nginx | 80, 443 | Reverse proxy |
| web | 3000 | Frontend Next.js |
| api | 4000 | Backend NestJS |
| postgres | 5432 | Base de données |
| redis | 6379 | Cache |

---

## Identifiants par défaut

- **Email** : `admin@orchestr-a.internal`
- **Mot de passe** : `admin123`

**Changer ce mot de passe immédiatement !**

---

## SSL/HTTPS avec Let's Encrypt

Pour activer HTTPS, installez certbot sur l'hôte :

```bash
# Arrêter nginx temporairement
docker compose -f docker-compose.prod.yml stop nginx

# Obtenir le certificat
sudo apt install certbot
sudo certbot certonly --standalone -d votre-domaine.com

# Copier les certificats
sudo cp /etc/letsencrypt/live/votre-domaine.com/fullchain.pem ./nginx/ssl/
sudo cp /etc/letsencrypt/live/votre-domaine.com/privkey.pem ./nginx/ssl/

# Activer HTTPS dans nginx/nginx.conf (décommenter la section SSL)
# Puis redémarrer
docker compose -f docker-compose.prod.yml up -d nginx
```

---

## Commandes utiles

```bash
# Voir les logs d'un service
docker compose -f docker-compose.prod.yml logs -f api

# Redémarrer un service
docker compose -f docker-compose.prod.yml restart api

# Arrêter tout
docker compose -f docker-compose.prod.yml down

# Arrêter et supprimer les volumes (PERTE DE DONNÉES)
docker compose -f docker-compose.prod.yml down -v

# Reconstruire les images
docker compose -f docker-compose.prod.yml build --no-cache

# Mise à jour
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

---

## Backup de la base de données

```bash
# Créer un backup
docker exec orchestr-a-postgres-prod pg_dump -U orchestr_a orchestr_a_prod > backup.sql

# Restaurer un backup
cat backup.sql | docker exec -i orchestr-a-postgres-prod psql -U orchestr_a -d orchestr_a_prod
```

---

## Dépannage

### L'API ne démarre pas

```bash
docker compose -f docker-compose.prod.yml logs api
```

Vérifier que PostgreSQL est bien démarré et healthy.

### Erreur de connexion à la base de données

```bash
# Vérifier que postgres est healthy
docker compose -f docker-compose.prod.yml ps postgres

# Tester la connexion
docker exec -it orchestr-a-postgres-prod psql -U orchestr_a -d orchestr_a_prod
```

### Reconstruire complètement

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```
