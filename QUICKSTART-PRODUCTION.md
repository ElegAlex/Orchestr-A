# ⚡ DÉMARRAGE RAPIDE - ORCHESTR'A V2 PRODUCTION

Guide ultra-rapide pour démarrer l'application en production.

---

## 🚀 Démarrage en 3 Commandes

```bash
# 1. Démarrer tous les services
docker compose --env-file .env.production -f docker-compose.prod.yml up -d

# 2. Attendre 30 secondes (temps de démarrage)
sleep 30

# 3. Vérifier la santé
./scripts/health-check.sh
```

**C'est tout !** L'application est maintenant disponible.

---

## 🌐 Accès

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost | Interface principale via Nginx |
| **Frontend Direct** | http://localhost:3000 | Accès direct Next.js |
| **API** | http://localhost:3001/api | API REST Backend |
| **Health Check** | http://localhost:3001/api/health | Vérification API |

---

## 🔑 Identifiants par Défaut

**Administrateur** :
- Login : `admin`
- Mot de passe : `admin123`
- Rôle : ADMIN

⚠️ **Important** : Changez ce mot de passe en production !

---

## 📊 Commandes Essentielles

### Monitoring
```bash
# Santé complète
./scripts/health-check.sh

# État des services
docker ps --filter "name=orchestr-a"

# Logs en temps réel
docker compose -f docker-compose.prod.yml logs -f
```

### Sauvegardes
```bash
# Créer une sauvegarde
./scripts/backup-database.sh

# Restaurer une sauvegarde
./scripts/restore-database.sh backups/orchestr-a-backup-YYYYMMDD_HHMMSS.sql.gz
```

### Redémarrage
```bash
# Redémarrer tout
docker compose -f docker-compose.prod.yml restart

# Redémarrer un service
docker compose -f docker-compose.prod.yml restart api
```

### Arrêt
```bash
# Arrêt gracieux
docker compose -f docker-compose.prod.yml down
```

---

## 🐛 Dépannage Rapide

**Problème** : Service ne démarre pas
```bash
docker compose -f docker-compose.prod.yml logs <service>
```

**Problème** : Erreur d'authentification
```bash
# Réinitialiser le mot de passe admin
docker exec orchestr-a-postgres-prod psql -U postgres -d orchestr_a_prod -c "UPDATE users SET \"passwordHash\" = '\$2b\$12\$vI3W06KqOPjBiGN8qXDBIuiSsdM1KyN2UJJAUkk400Da2YqETfPsG' WHERE login = 'admin';"
```

**Problème** : Performance dégradée
```bash
docker compose -f docker-compose.prod.yml restart
```

---

## 📚 Documentation Complète

- **Opérations quotidiennes** : [OPERATIONS.md](./OPERATIONS.md)
- **Rapport de déploiement** : [RAPPORT-DEPLOIEMENT-PRODUCTION.md](./RAPPORT-DEPLOIEMENT-PRODUCTION.md)
- **Guide complet** : [DEPLOYMENT.md](./DEPLOYMENT.md)
- **README** : [README.md](./README.md)

---

## ✅ Checklist de Démarrage

- [ ] Tous les services démarrés (5/5)
- [ ] Health check passe avec succès
- [ ] Frontend accessible
- [ ] API répond
- [ ] Login admin fonctionne
- [ ] Première sauvegarde créée

---

**🎉 Bonne utilisation d'ORCHESTR'A V2 !**
