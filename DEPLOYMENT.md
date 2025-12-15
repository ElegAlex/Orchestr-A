# 🚀 Guide de Déploiement en Production - ORCHESTR'A V2

Ce guide vous accompagne dans le déploiement de l'application ORCHESTR'A V2 en production.

## 📋 Prérequis

### Logiciels requis

- **Docker** ≥ 24.0
- **Docker Compose** ≥ 2.20
- **Git** ≥ 2.40
- **pnpm** ≥ 9.15.0

### Matériel recommandé

- **CPU**: 4 cores minimum (8 cores recommandé)
- **RAM**: 8 GB minimum (16 GB recommandé)
- **Stockage**: 50 GB minimum (SSD recommandé)
- **Réseau**: Connexion stable avec bande passante suffisante

## 🛠️ Préparation

### 1. Cloner le dépôt

```bash
git clone https://github.com/votre-org/orchestr-a-refonte.git
cd orchestr-a-refonte
```

### 2. Configuration des variables d'environnement

Copier le template de configuration :

```bash
cp .env.production.example .env.production
```

Éditer `.env.production` avec vos valeurs :

```bash
nano .env.production
```

**⚠️ IMPORTANT** : Configurez impérativement les secrets suivants :

- `DATABASE_PASSWORD` : Mot de passe PostgreSQL fort (min 20 caractères)
- `REDIS_PASSWORD` : Mot de passe Redis fort (min 20 caractères)
- `JWT_SECRET` : Secret JWT fort (min 32 caractères)
- `CORS_ORIGIN` : URL de votre domaine de production

**Génération de secrets sécurisés** :

```bash
# Générer DATABASE_PASSWORD
openssl rand -base64 32

# Générer REDIS_PASSWORD
openssl rand -base64 32

# Générer JWT_SECRET
openssl rand -base64 64
```

### 3. Vérifier la configuration

Assurez-vous que tous les champs critiques sont remplis :

```bash
grep -E "CHANGE_ME|your_" .env.production
```

Si cette commande retourne des résultats, vous n'avez pas fini la configuration !

## 🚀 Déploiement Automatique

### Méthode recommandée : Script automatisé

Exécutez simplement :

```bash
./deploy-production.sh
```

Le script va automatiquement :

1. ✅ Vérifier les prérequis
2. ✅ Valider la configuration `.env.production`
3. ✅ Sauvegarder la base de données existante (si applicable)
4. ✅ Construire l'image Docker de l'API
5. ✅ Démarrer PostgreSQL et Redis
6. ✅ Exécuter les migrations Prisma
7. ✅ Démarrer l'API
8. ✅ Proposer d'exécuter le seed de données initiales
9. ✅ Proposer de démarrer Nginx (reverse proxy)

### Suivi des logs en temps réel

```bash
docker-compose -f docker-compose.prod.yml logs -f
```

## 🐳 Déploiement Manuel (Étape par étape)

Si vous préférez exécuter manuellement :

### 1. Build de l'image API

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.production build api
```

### 2. Démarrer les services de base

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d postgres redis
```

Attendre 10-15 secondes pour le démarrage complet.

### 3. Exécuter les migrations Prisma

```bash
# Génération du client Prisma
docker-compose -f docker-compose.prod.yml run --rm api sh -c "cd /app/packages/database && pnpm run db:generate"

# Application des migrations
docker-compose -f docker-compose.prod.yml run --rm api sh -c "cd /app/packages/database && pnpm run db:migrate:deploy"
```

### 4. Démarrer l'API

```bash
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d api
```

### 5. Seed des données initiales (optionnel)

```bash
docker-compose -f docker-compose.prod.yml run --rm api sh -c "cd /app/packages/database && pnpm run db:seed"
```

### 6. Vérifier le déploiement

```bash
curl http://localhost:4000/health
```

Réponse attendue : `{"status":"ok"}`

## 📊 Vérification du déploiement

### Vérifier les services

```bash
docker-compose -f docker-compose.prod.yml ps
```

Tous les services doivent être "Up" avec "(healthy)".

### Tester l'API

```bash
# Health check
curl http://localhost:4000/health

# Version de l'API
curl http://localhost:4000/api

# Swagger (si activé)
open http://localhost:4000/api
```

### Vérifier les logs

```bash
# Tous les services
docker-compose -f docker-compose.prod.yml logs

# API uniquement
docker-compose -f docker-compose.prod.yml logs api

# PostgreSQL
docker-compose -f docker-compose.prod.yml logs postgres

# Redis
docker-compose -f docker-compose.prod.yml logs redis
```

## 🔧 Commandes Utiles

### Gestion des services

```bash
# Arrêter tous les services
docker-compose -f docker-compose.prod.yml down

# Redémarrer l'API
docker-compose -f docker-compose.prod.yml restart api

# Reconstruire l'API (après modifications du code)
docker-compose -f docker-compose.prod.yml build api
docker-compose -f docker-compose.prod.yml up -d api
```

### Gestion de la base de données

```bash
# Sauvegarde manuelle
docker exec orchestr-a-postgres-prod pg_dump -U postgres orchestr_a_prod > backup_$(date +%Y%m%d_%H%M%S).sql

# Restauration depuis une sauvegarde
docker exec -i orchestr-a-postgres-prod psql -U postgres orchestr_a_prod < backup_20250507_120000.sql

# Accéder à la console PostgreSQL
docker exec -it orchestr-a-postgres-prod psql -U postgres -d orchestr_a_prod

# Prisma Studio (interface graphique)
docker-compose -f docker-compose.prod.yml run --rm api sh -c "cd /app/packages/database && pnpm run db:studio"
```

### Monitoring

```bash
# Utilisation des ressources en temps réel
docker stats

# Espace disque utilisé par Docker
docker system df

# Nettoyer les images inutilisées
docker system prune -a
```

## 🔐 Sécurité en Production

### Checklist de sécurité

- [ ] `.env.production` n'est PAS commité dans Git
- [ ] Tous les secrets ont été changés des valeurs par défaut
- [ ] CORS_ORIGIN est configuré avec votre domaine de production
- [ ] SWAGGER_ENABLED est sur `false` en production
- [ ] Firewall configuré pour limiter l'accès aux ports
- [ ] HTTPS activé avec certificats SSL/TLS valides
- [ ] Sauvegardes automatiques configurées
- [ ] Monitoring et alertes configurés
- [ ] Rate limiting activé (THROTTLE_TTL, THROTTLE_LIMIT)
- [ ] Logs centralisés et analysés régulièrement

### Configuration du firewall (exemple UFW)

```bash
# Autoriser SSH
sudo ufw allow 22/tcp

# Autoriser HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Bloquer l'accès direct à PostgreSQL et Redis depuis l'extérieur
# (ils sont accessibles uniquement via le réseau Docker interne)

# Activer le firewall
sudo ufw enable
```

### Configurer HTTPS avec Let's Encrypt

1. Créer le répertoire de configuration Nginx :

```bash
mkdir -p nginx
```

2. Créer `nginx/nginx.conf` avec la configuration SSL

3. Obtenir les certificats avec Certbot :

```bash
sudo certbot certonly --standalone -d votredomaine.com
```

4. Copier les certificats dans `nginx/ssl/`

5. Démarrer Nginx :

```bash
docker-compose -f docker-compose.prod.yml up -d nginx
```

## 📈 Mise à jour de l'application

### Processus de mise à jour

```bash
# 1. Sauvegarder la base de données
docker exec orchestr-a-postgres-prod pg_dump -U postgres orchestr_a_prod > backup_avant_maj_$(date +%Y%m%d).sql

# 2. Récupérer les dernières modifications
git pull origin main

# 3. Reconstruire l'image
docker-compose -f docker-compose.prod.yml build api

# 4. Appliquer les nouvelles migrations
docker-compose -f docker-compose.prod.yml run --rm api sh -c "cd /app/packages/database && pnpm run db:migrate:deploy"

# 5. Redémarrer l'API
docker-compose -f docker-compose.prod.yml up -d api

# 6. Vérifier le health check
curl http://localhost:4000/health
```

## 🐛 Dépannage

### L'API ne démarre pas

```bash
# Vérifier les logs
docker-compose -f docker-compose.prod.yml logs api

# Erreur de connexion à PostgreSQL ?
docker-compose -f docker-compose.prod.yml logs postgres

# Vérifier que la base est accessible
docker exec -it orchestr-a-postgres-prod psql -U postgres -d orchestr_a_prod -c "SELECT 1;"
```

### Migrations Prisma échouent

```bash
# Vérifier l'état des migrations
docker-compose -f docker-compose.prod.yml run --rm api sh -c "cd /app/packages/database && pnpm run db:generate && npx prisma migrate status"

# Forcer la synchronisation (⚠️ ATTENTION : destructif)
docker-compose -f docker-compose.prod.yml run --rm api sh -c "cd /app/packages/database && npx prisma migrate reset --force"
```

### Performance dégradée

```bash
# Vérifier l'utilisation des ressources
docker stats

# Augmenter les limites de ressources dans docker-compose.prod.yml
# Redémarrer les services
docker-compose -f docker-compose.prod.yml restart
```

## 📞 Support

En cas de problème :

1. Consultez les logs : `docker-compose -f docker-compose.prod.yml logs`
2. Vérifiez la configuration : `cat .env.production`
3. Testez le health check : `curl http://localhost:4000/health`
4. Contactez l'équipe de support avec les logs complets

---

**🎉 Félicitations !** Votre application ORCHESTR'A V2 est maintenant déployée en production.
