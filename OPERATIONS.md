# 🛠️ GUIDE DES OPÉRATIONS - ORCHESTR'A V2

Guide rapide pour les opérations courantes en production.

---

## 🚀 Démarrage

```bash
# Démarrer tous les services
docker compose --env-file .env.production -f docker-compose.prod.yml up -d

# Vérifier que tous les services sont démarrés
docker ps --filter "name=orchestr-a"

# Attendre 30-45 secondes que tous les healthchecks passent au vert

# Vérifier la santé
./scripts/health-check.sh
```

**Accès** :
- 🌐 Frontend : http://localhost ou http://localhost:3000
- 🔌 API : http://localhost:3001/api
- 🏥 Health : http://localhost:3001/api/health

**Identifiants par défaut** :
- Login : `admin`
- Mot de passe : `admin123`
- ⚠️ **À changer en production !**

---

## 🛑 Arrêt

```bash
# Arrêt gracieux de tous les services
docker compose -f docker-compose.prod.yml down

# Arrêt avec suppression des volumes (⚠️ DANGER : perte de données)
docker compose -f docker-compose.prod.yml down -v
```

---

## 🔄 Redémarrage

```bash
# Redémarrer tous les services
docker compose -f docker-compose.prod.yml restart

# Redémarrer un service spécifique
docker compose -f docker-compose.prod.yml restart api
docker compose -f docker-compose.prod.yml restart web
docker compose -f docker-compose.prod.yml restart postgres
```

---

## 📊 Monitoring

### Health Check Complet
```bash
./scripts/health-check.sh
```

### Logs en Temps Réel
```bash
# Tous les services
docker compose -f docker-compose.prod.yml logs -f

# Service spécifique
docker logs orchestr-a-api-prod -f --tail 50
docker logs orchestr-a-web-prod -f --tail 50
docker logs orchestr-a-postgres-prod -f --tail 50
docker logs orchestr-a-nginx-prod -f --tail 50
```

### Statistiques des Ressources
```bash
# En temps réel
docker stats

# Espace disque
docker system df

# Services ORCHESTR'A uniquement
docker stats --no-stream --filter "name=orchestr-a"
```

---

## 💾 Sauvegardes

### Créer une Sauvegarde
```bash
./scripts/backup-database.sh
```
📁 Sauvegarde créée dans : `./backups/orchestr-a-backup-YYYYMMDD_HHMMSS.sql.gz`

### Restaurer une Sauvegarde
```bash
# Lister les sauvegardes disponibles
ls -lh backups/*.sql.gz

# Restaurer (⚠️ écrase la base actuelle)
./scripts/restore-database.sh backups/orchestr-a-backup-20251120_113414.sql.gz
```

### Automatiser les Sauvegardes (Cron)
```bash
# Éditer le crontab
crontab -e

# Ajouter cette ligne (sauvegarde quotidienne à 2h du matin)
0 2 * * * cd /home/alex/Documents/Repository/orchestr-a-refonte && ./scripts/backup-database.sh >> /var/log/orchestr-a-backup.log 2>&1
```

---

## 🔧 Maintenance

### Mettre à Jour l'Application

```bash
# 1. Sauvegarder la base de données
./scripts/backup-database.sh

# 2. Récupérer les dernières modifications
git pull origin master

# 3. Reconstruire les images
docker compose -f docker-compose.prod.yml build api web

# 4. Appliquer les migrations (si nécessaire)
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api sh -c "cd /app/packages/database && pnpm run db:migrate:deploy"

# 5. Redémarrer les services
docker compose -f docker-compose.prod.yml up -d

# 6. Vérifier la santé
./scripts/health-check.sh
```

### Nettoyage Docker

```bash
# Supprimer les images inutilisées
docker image prune -a

# Supprimer tous les éléments inutilisés (images, conteneurs, volumes)
docker system prune -a --volumes

# ⚠️ ATTENTION : ceci supprimera TOUS les volumes Docker non utilisés
```

### Consulter la Base de Données

```bash
# Console PostgreSQL interactive
docker exec -it orchestr-a-postgres-prod psql -U postgres -d orchestr_a_prod

# Commandes SQL utiles :
# \dt          - Lister les tables
# \d users     - Décrire la table users
# \q           - Quitter

# Prisma Studio (interface graphique)
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api sh -c "cd /app/packages/database && pnpm run db:studio"
# Accès : http://localhost:5555
```

---

## 🐛 Dépannage

### Service ne démarre pas

```bash
# Vérifier les logs
docker compose -f docker-compose.prod.yml logs <service>

# Exemples de problèmes courants :

# API ne démarre pas → Vérifier DATABASE_URL
docker logs orchestr-a-api-prod --tail 50

# PostgreSQL ne démarre pas → Vérifier les volumes
docker volume ls | grep orchestr-a

# Frontend ne charge pas → Vérifier NEXT_PUBLIC_API_URL
docker logs orchestr-a-web-prod --tail 50
```

### Erreur d'authentification

```bash
# Vérifier le mot de passe admin en base
docker exec orchestr-a-postgres-prod psql -U postgres -d orchestr_a_prod -c "SELECT login, email FROM users WHERE login = 'admin';"

# Réinitialiser le mot de passe admin (admin123)
docker exec orchestr-a-postgres-prod psql -U postgres -d orchestr_a_prod -c "UPDATE users SET \"passwordHash\" = '\$2b\$12\$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG' WHERE login = 'admin';"
```

### Base de données corrompue

```bash
# Restaurer depuis la dernière sauvegarde
./scripts/restore-database.sh backups/orchestr-a-backup-YYYYMMDD_HHMMSS.sql.gz

# Si aucune sauvegarde disponible, réinitialiser complètement
docker compose -f docker-compose.prod.yml down -v
docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres redis
sleep 10
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api sh -c "cd /app/packages/database && pnpm run db:migrate:deploy && pnpm run db:seed"
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

### Performance dégradée

```bash
# Vérifier l'utilisation des ressources
docker stats

# Redémarrer les services
docker compose -f docker-compose.prod.yml restart

# Nettoyer les logs volumineux
docker compose -f docker-compose.prod.yml logs --tail 0 -f > /dev/null &

# Vider le cache Redis
docker exec orchestr-a-redis-prod redis-cli -a "${REDIS_PASSWORD}" FLUSHALL
```

---

## 📞 Checklist de Production

### Avant le Déploiement
- [ ] `.env.production` configuré avec des secrets forts
- [ ] `CORS_ORIGIN` configuré avec le domaine de production
- [ ] `SWAGGER_ENABLED=false`
- [ ] Certificats SSL/TLS prêts
- [ ] Firewall configuré (ports 80, 443 ouverts)
- [ ] Sauvegarde automatique configurée (cron)
- [ ] Monitoring configuré (Sentry, logs)

### Après le Déploiement
- [ ] `./scripts/health-check.sh` passe avec succès
- [ ] Test de login avec un utilisateur admin
- [ ] Création d'un projet test
- [ ] Création d'une tâche test
- [ ] Première sauvegarde effectuée
- [ ] Logs vérifiés (pas d'erreurs critiques)
- [ ] Performance testée (< 200ms de response time)

### Maintenance Régulière
- [ ] Vérifier les logs quotidiennement
- [ ] Vérifier les sauvegardes hebdomadaires
- [ ] Mettre à jour les dépendances mensuellement
- [ ] Audit de sécurité trimestriel
- [ ] Nettoyage Docker mensuel

---

## 🆘 Contacts d'Urgence

En cas de problème critique en production :

1. **Vérifier les logs** : `docker compose -f docker-compose.prod.yml logs`
2. **Exécuter le health check** : `./scripts/health-check.sh`
3. **Redémarrer les services** : `docker compose -f docker-compose.prod.yml restart`
4. **Restaurer une sauvegarde** : `./scripts/restore-database.sh`
5. **Contacter l'équipe DevOps** : [à définir]

---

## 📚 Documentation Complète

- [README.md](./README.md) - Vue d'ensemble du projet
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Guide de déploiement détaillé
- [RAPPORT-DEPLOIEMENT-PRODUCTION.md](./RAPPORT-DEPLOIEMENT-PRODUCTION.md) - Rapport complet
- [STATUS-SUMMARY.md](./STATUS-SUMMARY.md) - État du projet
- [STACK-TECHNIQUE.md](./STACK-TECHNIQUE.md) - Architecture technique

---

**Version** : 1.0
**Dernière mise à jour** : 20/11/2025
