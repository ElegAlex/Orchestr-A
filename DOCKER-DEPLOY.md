# Deploiement Docker - ORCHESTR'A

Guide de deploiement Docker simplifie pour ORCHESTR'A en production.

## Prerequis

- **Docker Engine** >= 24.0
- **Docker Compose** >= v2.0
- **Git**
- 4 Go RAM minimum
- Ports 80/443 disponibles

### Verifier les prerequis

```bash
docker --version          # Docker version 24.x+
docker compose version    # Docker Compose v2.x+
git --version
```

## Installation en 3 etapes

### Etape 1 : Cloner le repository

```bash
git clone https://github.com/ElegAlex/Orchestr-A.git
cd Orchestr-A
```

### Etape 2 : Generer la configuration

```bash
./scripts/init-env.sh
```

Ce script :
- Genere automatiquement les secrets (DATABASE_PASSWORD, REDIS_PASSWORD, JWT_SECRET)
- Cree le fichier `.env.production`

### Etape 3 : Configurer et deployer

```bash
# Modifier CORS_ORIGIN avec votre domaine ou IP
nano .env.production

# Exemple : remplacer https://your-domain.com par http://VOTRE_IP
# ou par https://votre-domaine.com si vous avez un domaine

# Lancer le deploiement
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

Le premier deploiement prend environ 2-5 minutes (build des images).

## Verification

### Statut des services

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Tous les services doivent etre `(healthy)` :
- `orchestr-a-postgres-prod` - Base de donnees
- `orchestr-a-redis-prod` - Cache
- `orchestr-a-api-prod` - API NestJS
- `orchestr-a-web-prod` - Frontend Next.js
- `orchestr-a-nginx-prod` - Reverse proxy

### Tests de sante

```bash
# API
curl http://localhost/api/health
# Reponse attendue : {"status":"ok","timestamp":"...","uptime":...}

# Frontend
curl -I http://localhost/
# Reponse attendue : HTTP/1.1 200 OK
```

## Logs et debugging

```bash
# Tous les logs
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f

# Logs d'un service specifique
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f api
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f web
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f nginx
```

## Mise a jour

```bash
cd /opt/orchestra  # ou votre repertoire d'installation

# Recuperer les mises a jour
git pull origin master

# Rebuild et redeploy
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

## Arret et redemarrage

```bash
# Arreter tous les services
docker compose --env-file .env.production -f docker-compose.prod.yml down

# Redemarrer tous les services
docker compose --env-file .env.production -f docker-compose.prod.yml up -d

# Redemarrer un service specifique
docker compose --env-file .env.production -f docker-compose.prod.yml restart api
```

## Configuration SSL/HTTPS (optionnel)

Si vous avez un nom de domaine, suivez ces etapes pour activer HTTPS avec Let's Encrypt.

### Etape 1 : Configurer le domaine

```bash
# Editer .env.production pour utiliser votre domaine
nano .env.production
# Modifier CORS_ORIGIN=https://votre-domaine.com
```

### Etape 2 : Mettre a jour nginx.conf

```bash
# Remplacer orchestr-a.com par votre domaine
sed -i 's/orchestr-a.com/votre-domaine.com/g' nginx/nginx.conf
```

### Etape 3 : Obtenir les certificats SSL

```bash
# Arreter nginx si en cours d'execution (libere le port 80)
docker compose --env-file .env.production -f docker-compose.prod.yml stop nginx 2>/dev/null || true

# Obtenir le certificat via Docker (remplacez les valeurs)
docker run --rm \
  -v orchestr-a-certbot-certs:/etc/letsencrypt \
  -v orchestr-a-certbot-www:/var/www/certbot \
  -p 80:80 \
  certbot/certbot certonly \
  --standalone \
  --preferred-challenges http \
  -d votre-domaine.com \
  -d www.votre-domaine.com \
  --email votre-email@example.com \
  --agree-tos \
  --non-interactive
```

### Etape 4 : Demarrer les services

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

Les certificats sont automatiquement renouveles par le conteneur certbot.

## Backup de la base de donnees

```bash
# Backup manuel
docker exec orchestr-a-postgres-prod pg_dump -U orchestr_a orchestr_a_prod > backup_$(date +%Y%m%d).sql

# Ou utiliser le script fourni
./scripts/backup-database.sh
```

## Connexion par defaut

Apres le premier deploiement :

- **URL** : http://VOTRE_IP ou https://votre-domaine.com
- **Login** : `admin`
- **Mot de passe** : `admin123`

**IMPORTANT** : Changez ce mot de passe immediatement apres la premiere connexion !

## Depannage

### L'API ne demarre pas

```bash
# Verifier les logs
docker compose --env-file .env.production -f docker-compose.prod.yml logs api

# Verifier que PostgreSQL est accessible
docker exec orchestr-a-api-prod nc -z postgres 5432
```

### Erreur de connexion a la base de donnees

```bash
# Verifier les variables d'environnement
docker compose --env-file .env.production -f docker-compose.prod.yml config | grep DATABASE

# Verifier que PostgreSQL est en bonne sante
docker compose --env-file .env.production -f docker-compose.prod.yml ps postgres
```

### Le frontend affiche des erreurs CORS

Verifiez que `CORS_ORIGIN` dans `.env.production` correspond exactement a l'URL utilisee pour acceder a l'application (protocole, domaine et port inclus).

### Reinitialisation complete

```bash
# Arreter et supprimer tous les conteneurs et volumes
docker compose --env-file .env.production -f docker-compose.prod.yml down -v

# Supprimer les images buildees
docker rmi orchestra-api orchestra-web

# Recommencer le deploiement
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

## Architecture des conteneurs

```
                         +--------------+
                         |    nginx     |
                         | (80 + 443)   |
                         +------+-------+
                                |
                 +--------------+--------------+
                 |                             |
         +-------v-------+             +-------v-------+
         |     web       |             |     api       |
         | (Next.js:3000)|             | (NestJS:4000) |
         +---------------+             +-------+-------+
                                               |
                               +---------------+---------------+
                               |                               |
                       +-------v-------+               +-------v-------+
                       |   postgres    |               |     redis     |
                       |  (port 5432)  |               |  (port 6379)  |
                       +---------------+               +---------------+

         +---------------+
         |    certbot    |  <-- Renouvellement automatique SSL
         +---------------+
```

## Support

En cas de probleme :
1. Consultez les logs : `docker compose logs -f`
2. Verifiez les issues GitHub : https://github.com/ElegAlex/Orchestr-A/issues
3. Creez une nouvelle issue si necessaire
