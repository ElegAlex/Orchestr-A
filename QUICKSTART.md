# ⚡ QUICKSTART - ORCHESTR'A V2

> Démarrage rapide de l'application en production

## 🚀 Démarrer l'Application

```bash
cd /home/alex/Documents/Repository/orchestr-a-refonte
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

⏱️ **Temps de démarrage**: ~30 secondes

## 🌐 Accès

| Service | URL | Credentials |
|---------|-----|-------------|
| **Application** | http://localhost | - |
| **API** | http://localhost:3001/api | - |
| **Login** | http://localhost/login | admin / admin123 |

## ✅ Vérifier l'État

```bash
# Health check complet
bash scripts/health-check.sh

# État des conteneurs
docker ps --filter "name=orchestr-a"

# Logs en temps réel
docker logs orchestr-a-api-prod -f
docker logs orchestr-a-web-prod -f
```

## 🔄 Commandes Utiles

```bash
# Arrêter
docker compose --env-file .env.production -f docker-compose.prod.yml down

# Redémarrer
docker compose --env-file .env.production -f docker-compose.prod.yml restart

# Backup
bash scripts/backup-database.sh

# Rebuild complet
docker compose --env-file .env.production -f docker-compose.prod.yml down
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

## 📚 Documentation Complète

- **[PRODUCTION-DEPLOYMENT-GUIDE.md](./PRODUCTION-DEPLOYMENT-GUIDE.md)** - Guide de déploiement complet
- **[DEPLOIEMENT-FINALISE.md](./DEPLOIEMENT-FINALISE.md)** - Rapport de déploiement
- **[STATUS-SUMMARY.md](./STATUS-SUMMARY.md)** - État du projet

## 🆘 Support

En cas de problème, consulter la section **Dépannage** du guide de déploiement.

---

✅ **Application opérationnelle et prête à l'emploi**
