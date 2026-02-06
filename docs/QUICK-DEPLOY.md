# Orchestr-A — Déploiement rapide

Déployez Orchestr-A en quelques minutes avec des images Docker pré-buildées.

## Option 1 : Image All-in-One (Recommandé)

La méthode la plus simple : une seule image Docker contenant tout (PostgreSQL, Redis, API, Web, Nginx).

### Démarrage en une commande

```bash
docker run -d \
  --name orchestr-a \
  -p 3000:3000 \
  -v orchestr-a-data:/data \
  ghcr.io/elegalex/orchestr-a:latest
```

**C'est tout !** L'application sera disponible sur http://localhost:3000 après ~60 secondes.

### Identifiants par défaut

| Service     | URL                            | Identifiants                      |
| ----------- | ------------------------------ | --------------------------------- |
| Application | http://localhost:3000          | admin@orchestr-a.local / admin123 |
| API         | http://localhost:3000/api      | -                                 |
| Swagger     | http://localhost:3000/api/docs | -                                 |

### Options de configuration

```bash
# Avec JWT personnalisé (recommandé en production)
docker run -d \
  --name orchestr-a \
  -p 3000:3000 \
  -v orchestr-a-data:/data \
  -e JWT_SECRET="votre-secret-de-64-caracteres-minimum-tres-securise" \
  ghcr.io/elegalex/orchestr-a:latest

# Exposer sur un autre port
docker run -d \
  --name orchestr-a \
  -p 8080:3000 \
  -v orchestr-a-data:/data \
  ghcr.io/elegalex/orchestr-a:latest
```

### Commandes utiles (All-in-One)

| Action                      | Commande                                                   |
| --------------------------- | ---------------------------------------------------------- |
| Voir les logs               | `docker logs -f orchestr-a`                                |
| Arrêter                     | `docker stop orchestr-a`                                   |
| Redémarrer                  | `docker restart orchestr-a`                                |
| Supprimer (garder données)  | `docker rm orchestr-a`                                     |
| Supprimer tout              | `docker rm orchestr-a && docker volume rm orchestr-a-data` |
| Voir le statut des services | `docker exec orchestr-a supervisorctl status`              |

### Architecture All-in-One

```
┌─────────────────────────────────────────────────────────┐
│              orchestr-a:latest (image unique)           │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │                  supervisord                     │   │
│  └─────────┬───────┬───────┬───────┬───────────────┘   │
│            │       │       │       │                    │
│       ┌────▼──┐ ┌──▼───┐ ┌─▼──┐ ┌──▼─────┐             │
│       │ nginx │ │ api  │ │ web│ │postgres│             │
│       │ :3000 │ │ :4000│ │:3001│ │ :5432 │             │
│       └───────┘ └──────┘ └────┘ └────────┘             │
│                                    │                    │
│                              ┌─────▼─────┐              │
│                              │   redis   │              │
│                              │   :6379   │              │
│                              └───────────┘              │
│                                                         │
│  Volume persistant: /data                               │
└─────────────────────────────────────────────────────────┘
```

---

## Option 2 : Docker Compose (Multi-services)

Pour plus de contrôle et de flexibilité (scaling, configuration avancée).

### Installation en une commande

```bash
curl -fsSL https://raw.githubusercontent.com/ElegAlex/Orchestr-A/master/install.sh | bash
```

Le script :

1. Vérifie les prérequis (Docker, Docker Compose)
2. Crée un répertoire `orchestr-a`
3. Télécharge la configuration
4. Génère des secrets sécurisés automatiquement
5. Télécharge et démarre les services

### Installation manuelle

### Prérequis

- Docker 20.10+
- Docker Compose v2+
- 2 Go RAM minimum
- Ports 3000 et 4000 disponibles

### Étapes

1. **Créer un répertoire**

```bash
mkdir orchestr-a && cd orchestr-a
```

2. **Télécharger le docker-compose**

```bash
curl -fsSL https://raw.githubusercontent.com/ElegAlex/Orchestr-A/master/docker-compose.standalone.yml -o docker-compose.yml
```

3. **Créer le fichier .env**

```bash
cat > .env << 'EOF'
# Base de données
POSTGRES_USER=orchestr_a
POSTGRES_PASSWORD=CHANGEZ_MOI_32_CARACTERES_MIN
POSTGRES_DB=orchestr_a

# Redis
REDIS_PASSWORD=CHANGEZ_MOI_32_CARACTERES_MIN

# JWT (très important, minimum 32 caractères)
JWT_SECRET=CHANGEZ_MOI_64_CARACTERES_MIN_TRES_IMPORTANT

# URLs
CORS_ORIGIN=http://localhost:3000

# Version des images
VERSION=latest
GITHUB_OWNER=elegalex
EOF
```

4. **Démarrer**

```bash
docker compose pull
docker compose up -d
```

## Accès

| Service      | URL                              | Identifiants     |
| ------------ | -------------------------------- | ---------------- |
| Application  | http://localhost:3000            | admin / admin123 |
| API          | http://localhost:4000            | -                |
| Health check | http://localhost:4000/api/health | -                |

## Configuration avancée

### Changer les ports

```bash
# Dans .env
API_PORT=8080
WEB_PORT=8000
```

### Utiliser une version spécifique

```bash
# Dans .env
VERSION=1.0.0
```

### Déploiement avec domaine personnalisé

Pour un déploiement en production avec un domaine personnalisé, utilisez `docker-compose.prod.yml` qui inclut nginx et la gestion SSL avec certbot.

```bash
# Dans .env
CORS_ORIGIN=https://orchestr-a.example.com
```

## Commandes utiles

| Action            | Commande                                         |
| ----------------- | ------------------------------------------------ |
| Voir les logs     | `docker compose logs -f`                         |
| Logs d'un service | `docker compose logs -f api`                     |
| Redémarrer        | `docker compose restart`                         |
| Arrêter           | `docker compose down`                            |
| Mise à jour       | `docker compose pull && docker compose up -d`    |
| Reset complet     | `docker compose down -v && docker compose up -d` |

## Sauvegarde

### Backup de la base de données

```bash
docker compose exec postgres pg_dump -U orchestr_a orchestr_a > backup.sql
```

### Restauration

```bash
docker compose exec -T postgres psql -U orchestr_a orchestr_a < backup.sql
```

## Dépannage

### L'API ne démarre pas

```bash
# Vérifier les logs
docker compose logs api

# Vérifier que PostgreSQL est prêt
docker compose exec postgres pg_isready
```

### Erreur de connexion à la base

Vérifiez que `POSTGRES_PASSWORD` dans `.env` ne contient pas de caractères spéciaux problématiques (`` ` ``, `!`, `$`, etc.).

### Réinitialiser les données

```bash
docker compose down -v
docker compose up -d
```

### L'application ne charge pas

1. Vérifiez que l'API est accessible : `curl http://localhost:4000/api/health`
2. Vérifiez les logs du frontend : `docker compose logs web`
3. Assurez-vous que les ports 3000 et 4000 ne sont pas utilisés par d'autres services

## Architecture

```
┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│  Web (3000) │
└─────────────┘     └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  API (4000) │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
       ┌─────────────┐          ┌─────────────┐
       │  PostgreSQL │          │    Redis    │
       └─────────────┘          └─────────────┘
```

## Mise à jour

Pour mettre à jour vers la dernière version :

```bash
docker compose pull
docker compose up -d
```

Pour une version spécifique, modifiez `VERSION` dans `.env` puis :

```bash
docker compose pull
docker compose up -d
```
