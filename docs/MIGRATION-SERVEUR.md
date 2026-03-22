# Migration de serveur Orchestr'A (Image All-in-One)

Guide complet pour migrer une instance Orchestr'A vers un nouveau serveur en preservant toutes les donnees (base PostgreSQL, uploads, configuration).

| Information       | Valeur                                                   |
| ----------------- | -------------------------------------------------------- |
| **Architecture**  | Image all-in-one `ghcr.io/elegalex/orchestr-a:latest`    |
| **Volume unique** | `orchestr-a-data:/data` (PostgreSQL, Redis, uploads)     |
| **Methode**       | pg_dump/pg_restore + copie des uploads + package offline |
| **Date**          | 2026-03-05                                               |

---

## Table des matieres

- [1. Pre-requis](#1-pre-requis)
- [2. Vue d'ensemble](#2-vue-densemble)
- [3. Phase 1 — Sauvegarde sur l'ancien serveur](#3-phase-1--sauvegarde-sur-lancien-serveur)
  - [3.1 Identifier le conteneur](#31-identifier-le-conteneur)
  - [3.2 Sauvegarder la base de donnees](#32-sauvegarder-la-base-de-donnees)
  - [3.3 Verifier l'integrite du dump](#33-verifier-lintegrite-du-dump)
  - [3.4 Sauvegarder les uploads](#34-sauvegarder-les-uploads)
  - [3.5 Sauvegarder la configuration](#35-sauvegarder-la-configuration)
- [4. Phase 2 — Transfert vers le nouveau serveur](#4-phase-2--transfert-vers-le-nouveau-serveur)
- [5. Phase 3 — Installation sur le nouveau serveur](#5-phase-3--installation-sur-le-nouveau-serveur)
  - [5.1 Methode A : Package offline (sans internet)](#51-methode-a--package-offline-sans-internet)
  - [5.2 Methode B : Pull direct depuis GHCR (avec internet)](#52-methode-b--pull-direct-depuis-ghcr-avec-internet)
- [6. Phase 4 — Restauration des donnees](#6-phase-4--restauration-des-donnees)
  - [6.1 Restaurer la base de donnees](#61-restaurer-la-base-de-donnees)
  - [6.2 Restaurer les uploads](#62-restaurer-les-uploads)
  - [6.3 Restaurer la configuration .env](#63-restaurer-la-configuration-env)
- [7. Phase 5 — Verification](#7-phase-5--verification)
- [8. Phase 6 — Basculement](#8-phase-6--basculement)
- [9. Rollback — Retour arriere](#9-rollback--retour-arriere)
- [10. Depannage](#10-depannage)
- [Annexe A : Architecture interne de l'image all-in-one](#annexe-a--architecture-interne-de-limage-all-in-one)
- [Annexe B : Checklist imprimable](#annexe-b--checklist-imprimable)

---

## 1. Pre-requis

### Ancien serveur

- Acces SSH avec droits `sudo` (ou root)
- Docker installe et conteneur Orchestr'A en cours d'execution
- Espace disque suffisant pour le dump (~2x la taille de la base)

### Nouveau serveur

- Acces SSH avec droits `sudo` (ou root)
- Docker Engine 20.10+ et Docker Compose v2+ installes
- Espace disque : au minimum 5 Go libres (image ~1.8 Go + donnees)
- Ports 80 (et 443 si HTTPS) disponibles

### Poste de travail (optionnel)

Si le transfert direct entre serveurs n'est pas possible, un poste intermediaire avec `scp`/`rsync` peut servir de relais.

---

## 2. Vue d'ensemble

```
┌──────────────────────┐                     ┌──────────────────────┐
│   ANCIEN SERVEUR     │                     │   NOUVEAU SERVEUR    │
│                      │                     │                      │
│  1. pg_dump ──────── │ ── 4. Transfert ──► │  5. install.sh       │
│  2. tar uploads      │    (scp/rsync)      │  6. pg_restore       │
│  3. copie .env       │                     │  7. copie uploads    │
│                      │                     │  8. verification     │
└──────────────────────┘                     └──────────────────────┘
                                                       │
                                              9. Basculement DNS/IP
```

**Temps estime** : 30-90 minutes selon la taille de la base et la bande passante.

**Indisponibilite** : limitee au temps entre l'arret de l'ancien serveur et la fin de la verification sur le nouveau (~5-15 minutes si tout est pre-prepare).

---

## 3. Phase 1 — Sauvegarde sur l'ancien serveur

> Toutes les commandes de cette section sont executees sur **l'ancien serveur**.

### 3.1 Identifier le conteneur

```bash
# Lister les conteneurs en cours
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
```

Reperer le nom du conteneur Orchestr'A. Exemples courants :

| Nom possible              | Contexte                    |
| ------------------------- | --------------------------- |
| `orchestr-a-orchestr-a-1` | Installe via docker compose |
| `orchestr-a`              | Installe via docker run     |

Dans la suite du document, remplacer `CONTAINER` par le nom reel de votre conteneur.

```bash
# Definir une variable pour simplifier les commandes
CONTAINER="orchestr-a-orchestr-a-1"
```

### 3.2 Sauvegarder la base de donnees

L'image all-in-one embarque PostgreSQL avec l'utilisateur `postgres` et la base `orchestr_a`.

#### Methode recommandee : format custom (compresse, restauration selective possible)

```bash
# Creer le dump au format custom (compresse nativement)
docker exec $CONTAINER pg_dump \
  -U postgres \
  -d orchestr_a \
  --format=custom \
  --verbose \
  -f /tmp/orchestr-a-backup.dump

# Copier le dump depuis le conteneur vers l'hote
docker cp $CONTAINER:/tmp/orchestr-a-backup.dump ./orchestr-a-backup.dump

# Verifier la taille
ls -lh orchestr-a-backup.dump
```

#### Methode alternative : format SQL (lisible, mais plus volumineux)

```bash
docker exec $CONTAINER pg_dump \
  -U postgres \
  -d orchestr_a \
  --format=plain \
  > orchestr-a-backup.sql

# Comprimer pour le transfert
gzip orchestr-a-backup.sql
```

> Le format custom (`--format=custom`) est recommande car il est compresse, supporte la restauration selective (par table), et gere les dependances automatiquement.

### 3.3 Verifier l'integrite du dump

```bash
# Pour un dump au format custom : lister le contenu
docker exec $CONTAINER pg_restore \
  --list /tmp/orchestr-a-backup.dump | head -30

# Verifier le nombre de tables
docker exec $CONTAINER pg_restore \
  --list /tmp/orchestr-a-backup.dump | grep "TABLE" | wc -l

# Comparer avec le nombre de tables en base
docker exec $CONTAINER psql -U postgres -d orchestr_a \
  -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

Le nombre de tables doit correspondre. A la date de redaction, le schema Prisma contient environ 20-25 tables.

### 3.4 Sauvegarder les uploads

Les fichiers uploades (avatars, documents) sont stockes dans `/data/uploads` a l'interieur du conteneur.

```bash
# Verifier s'il y a des uploads
docker exec $CONTAINER ls -la /data/uploads/ 2>/dev/null || echo "Pas de dossier uploads"

# Si le dossier existe et contient des fichiers :
docker exec $CONTAINER tar czf /tmp/uploads-backup.tar.gz -C /data/uploads . 2>/dev/null

# Copier sur l'hote
docker cp $CONTAINER:/tmp/uploads-backup.tar.gz ./uploads-backup.tar.gz 2>/dev/null

# Verifier
ls -lh uploads-backup.tar.gz 2>/dev/null || echo "Pas d'uploads a sauvegarder"
```

> Si le dossier `/data/uploads` n'existe pas ou est vide, c'est normal pour une instance sans documents uploades. Passez a l'etape suivante.

### 3.5 Sauvegarder la configuration

```bash
# Sauvegarder le fichier .env (contient les secrets)
# Trouver l'emplacement du .env utilise par docker compose
# Generalement dans le meme repertoire que le docker-compose.yml

# Si installe via le package offline :
cp /opt/orchestr-a/.env ./env-backup
# ou
cp $(docker inspect $CONTAINER --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -oP 'JWT_SECRET=\K.*' > /dev/null && pwd)/.env ./env-backup 2>/dev/null

# Methode universelle : extraire les variables d'environnement du conteneur
docker inspect $CONTAINER --format '{{range .Config.Env}}{{println .}}{{end}}' > env-backup-full.txt
```

Les variables critiques a conserver sont :

| Variable            | Importance | Raison                                                        |
| ------------------- | ---------- | ------------------------------------------------------------- |
| `JWT_SECRET`        | Critique   | Si change, tous les utilisateurs connectes seront deconnectes |
| `POSTGRES_PASSWORD` | Important  | Utilise en interne par le conteneur                           |
| `REDIS_PASSWORD`    | Important  | Utilise en interne par le conteneur                           |
| `HTTP_PORT`         | Mineur     | Port d'ecoute (defaut: 80)                                    |

> **Le `JWT_SECRET` est la variable la plus importante.** Si vous la conservez, les sessions utilisateur resteront valides apres la migration. Si vous la perdez, les utilisateurs devront simplement se reconnecter.

### Recapitulatif des fichiers sauvegardes

```bash
ls -lh orchestr-a-backup.dump uploads-backup.tar.gz env-backup-full.txt 2>/dev/null
```

Vous devez avoir au minimum :

| Fichier                  | Obligatoire | Contenu                   |
| ------------------------ | ----------- | ------------------------- |
| `orchestr-a-backup.dump` | Oui         | Base de donnees complete  |
| `uploads-backup.tar.gz`  | Si existant | Fichiers uploades         |
| `env-backup-full.txt`    | Recommande  | Variables d'environnement |

---

## 4. Phase 2 — Transfert vers le nouveau serveur

### Transfert direct entre serveurs (recommande)

```bash
# Depuis l'ancien serveur vers le nouveau
scp orchestr-a-backup.dump user@NOUVEAU_SERVEUR:/tmp/
scp uploads-backup.tar.gz user@NOUVEAU_SERVEUR:/tmp/ 2>/dev/null
scp env-backup-full.txt user@NOUVEAU_SERVEUR:/tmp/
```

### Transfert via le package offline (si le nouveau serveur n'a pas internet)

```bash
# Depuis votre poste de travail, transferer aussi le package offline
scp /tmp/orchestr-a-offline-v2.3.8.tar.gz user@NOUVEAU_SERVEUR:/tmp/
```

### Transfert via poste intermediaire

```bash
# Poste de travail : recuperer depuis l'ancien serveur
scp user@ANCIEN_SERVEUR:~/orchestr-a-backup.dump ./
scp user@ANCIEN_SERVEUR:~/uploads-backup.tar.gz ./ 2>/dev/null
scp user@ANCIEN_SERVEUR:~/env-backup-full.txt ./

# Poste de travail : envoyer vers le nouveau serveur
scp orchestr-a-backup.dump user@NOUVEAU_SERVEUR:/tmp/
scp uploads-backup.tar.gz user@NOUVEAU_SERVEUR:/tmp/ 2>/dev/null
scp env-backup-full.txt user@NOUVEAU_SERVEUR:/tmp/
```

### Verification du transfert

```bash
# Sur le nouveau serveur : verifier que les fichiers sont arrives
ssh user@NOUVEAU_SERVEUR "ls -lh /tmp/orchestr-a-backup.dump /tmp/uploads-backup.tar.gz /tmp/env-backup-full.txt 2>/dev/null"
```

---

## 5. Phase 3 — Installation sur le nouveau serveur

> Toutes les commandes de cette section sont executees sur **le nouveau serveur**.

### 5.1 Methode A : Package offline (sans internet)

Utilisez cette methode si le nouveau serveur n'a pas acces a internet ou a un debit limite.

```bash
# 1. Extraire le package
cd /tmp
tar xzf orchestr-a-offline-v2.3.8.tar.gz
cd orchestr-a-offline-v2.3.8

# 2. Lancer l'installation
sudo bash install.sh
```

Le script :

1. Verifie Docker et Docker Compose v2
2. Charge l'image Docker depuis l'archive (~1.8 Go)
3. Genere des secrets securises dans un fichier `.env`
4. Demarre le conteneur
5. Attend que le service soit healthy

> A cette etape, le conteneur tourne avec une base **vierge** (seed par defaut avec admin/admin123). La restauration des donnees se fait a l'etape suivante.

### 5.2 Methode B : Pull direct depuis GHCR (avec internet)

```bash
# 1. Creer le repertoire d'installation
sudo mkdir -p /opt/orchestr-a
cd /opt/orchestr-a

# 2. Telecharger les fichiers de deploiement
curl -fsSL https://raw.githubusercontent.com/ElegAlex/Orchestr-A/master/docker-compose.offline.yml \
  -o docker-compose.yml

# 3. Telecharger l'image
docker pull ghcr.io/elegalex/orchestr-a:latest
docker tag ghcr.io/elegalex/orchestr-a:latest orchestr-a:local

# 4. Generer le fichier .env
cat > .env << 'ENVEOF'
POSTGRES_PASSWORD=CHANGEZ_MOI_32_CARACTERES
REDIS_PASSWORD=CHANGEZ_MOI_32_CARACTERES
JWT_SECRET=CHANGEZ_MOI_64_CARACTERES_MINIMUM_TRES_SECURISE
HTTP_PORT=80
ENVEOF

# 5. Demarrer
docker compose up -d

# 6. Attendre que le service soit healthy (~60-90s)
echo "Attente du demarrage..."
until docker compose ps | grep -q "healthy"; do sleep 5; done
echo "Service pret."
```

---

## 6. Phase 4 — Restauration des donnees

> **Important** : Le conteneur doit etre en cours d'execution (`healthy`) avant de restaurer. La restauration remplace les donnees du seed par vos donnees de production.

### 6.1 Restaurer la base de donnees

```bash
# Identifier le conteneur (ajuster le nom si necessaire)
CONTAINER=$(docker ps --format '{{.Names}}' | grep orchestr-a)
echo "Conteneur cible : $CONTAINER"

# Copier le dump dans le conteneur
docker cp /tmp/orchestr-a-backup.dump $CONTAINER:/tmp/orchestr-a-backup.dump

# Restaurer la base (--clean supprime les donnees existantes avant import)
docker exec $CONTAINER pg_restore \
  -U postgres \
  -d orchestr_a \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --verbose \
  /tmp/orchestr-a-backup.dump
```

**Comprendre les options :**

| Option            | Effet                                                 |
| ----------------- | ----------------------------------------------------- |
| `--clean`         | Supprime les objets existants avant de les recreer    |
| `--if-exists`     | Evite les erreurs si un objet n'existe pas encore     |
| `--no-owner`      | Ignore les proprietaires d'origine (utilise postgres) |
| `--no-privileges` | Ignore les privileges d'origine                       |
| `--verbose`       | Affiche la progression                                |

> **Warnings attendus** : Des messages comme `role "xxx" does not exist` sont normaux et sans consequence. Seuls les messages `ERROR` indiquent un probleme reel.

#### Si vous avez un dump SQL (format plain) :

```bash
# Copier le dump dans le conteneur
docker cp /tmp/orchestr-a-backup.sql.gz $CONTAINER:/tmp/orchestr-a-backup.sql.gz

# Decompresser et restaurer
docker exec $CONTAINER bash -c \
  "gunzip -c /tmp/orchestr-a-backup.sql.gz | psql -U postgres -d orchestr_a"
```

#### Verifier la restauration

```bash
# Compter les utilisateurs
docker exec $CONTAINER psql -U postgres -d orchestr_a \
  -c "SELECT count(*) AS nb_users FROM \"User\";"

# Compter les projets
docker exec $CONTAINER psql -U postgres -d orchestr_a \
  -c "SELECT count(*) AS nb_projects FROM \"Project\";"

# Lister les tables et leur nombre de lignes
docker exec $CONTAINER psql -U postgres -d orchestr_a -c "
SELECT schemaname, relname AS table, n_live_tup AS rows
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;"
```

Comparez ces chiffres avec ceux de l'ancien serveur pour valider la coherence.

### 6.2 Restaurer les uploads

```bash
# Verifier si le backup d'uploads existe
ls -lh /tmp/uploads-backup.tar.gz 2>/dev/null || echo "Pas de backup uploads — skip"

# Si le fichier existe :
docker cp /tmp/uploads-backup.tar.gz $CONTAINER:/tmp/uploads-backup.tar.gz

# Restaurer dans /data/uploads
docker exec $CONTAINER bash -c "
  mkdir -p /data/uploads
  tar xzf /tmp/uploads-backup.tar.gz -C /data/uploads
  chown -R root:root /data/uploads
"

# Verifier
docker exec $CONTAINER ls -la /data/uploads/
```

### 6.3 Restaurer la configuration .env

Si vous souhaitez conserver le meme `JWT_SECRET` (pour que les sessions utilisateur restent valides) :

```bash
# Extraire le JWT_SECRET de l'ancien .env
OLD_JWT=$(grep "JWT_SECRET" /tmp/env-backup-full.txt | head -1 | cut -d= -f2)
echo "Ancien JWT_SECRET : ${OLD_JWT:0:8}... (tronque)"

# Trouver le .env actuel
# Si installe via package offline :
ENV_FILE="/tmp/orchestr-a-offline-v2.3.8/.env"
# Si installe via methode B :
ENV_FILE="/opt/orchestr-a/.env"

# Remplacer le JWT_SECRET
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${OLD_JWT}|" "$ENV_FILE"

# Redemarrer le conteneur pour prendre en compte le nouveau secret
cd $(dirname "$ENV_FILE")
docker compose down
docker compose up -d
```

> Si vous ne restaurez pas le `JWT_SECRET`, les utilisateurs devront simplement se reconnecter. Ce n'est pas bloquant.

---

## 7. Phase 5 — Verification

### Tests automatiques

```bash
# Definir l'URL de test (adapter si port different)
BASE_URL="http://localhost"

echo "=== Verification post-migration ==="

# 1. Health check API
echo -n "1. Health check API : "
curl -sf "$BASE_URL/api/health" && echo " OK" || echo " ECHEC"

# 2. Frontend accessible
echo -n "2. Frontend : "
HTTP_CODE=$(curl -sf -o /dev/null -w '%{http_code}' "$BASE_URL")
[ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "307" ] && echo "OK ($HTTP_CODE)" || echo "ECHEC ($HTTP_CODE)"

# 3. Connexion admin
echo -n "3. Connexion admin : "
TOKEN=$(curl -sf -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"login":"admin","password":"admin123"}' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
[ -n "$TOKEN" ] && echo "OK (token obtenu)" || echo "ECHEC (verifier mot de passe)"

# 4. Comptage donnees (si token obtenu)
if [ -n "$TOKEN" ]; then
  echo -n "4. Donnees presentes : "
  CONTAINER=$(docker ps --format '{{.Names}}' | grep orchestr-a)
  USERS=$(docker exec $CONTAINER psql -U postgres -d orchestr_a -t -c "SELECT count(*) FROM \"User\";")
  PROJECTS=$(docker exec $CONTAINER psql -U postgres -d orchestr_a -t -c "SELECT count(*) FROM \"Project\";" 2>/dev/null)
  echo "$USERS utilisateurs, $PROJECTS projets"
fi

# 5. Etat du conteneur
echo -n "5. Conteneur : "
docker ps --format '{{.Names}} {{.Status}}' | grep orchestr-a

echo "=== Fin de la verification ==="
```

### Tests manuels recommandes

| Test                                | Comment verifier                               |
| ----------------------------------- | ---------------------------------------------- |
| Connexion avec un compte existant   | Se connecter via le navigateur                 |
| Navigation dans les projets         | Ouvrir un projet existant, verifier les taches |
| Consultation du planning            | Page planning, verifier les affectations       |
| Upload d'un fichier (si applicable) | Tester l'upload d'un document                  |
| Acces depuis l'exterieur            | Acceder via l'IP publique ou le nom de domaine |

---

## 8. Phase 6 — Basculement

### Si migration avec changement d'IP (DNS)

```bash
# 1. Reduire le TTL DNS a 300s au moins 24h AVANT la migration
# (a faire via votre registrar/hebergeur DNS)

# 2. Sur l'ancien serveur : arreter le service
ssh user@ANCIEN_SERVEUR "docker compose down"

# 3. Mettre a jour l'enregistrement DNS vers la nouvelle IP
# (via l'interface de votre registrar)

# 4. Verifier la propagation
dig +short votre-domaine.fr
# Doit retourner la nouvelle IP

# 5. Attendre la propagation complete (~5-30 min avec TTL 300s)
```

### Si migration avec meme IP (remplacement de serveur)

```bash
# 1. Sur l'ancien serveur : arreter le service
ssh user@ANCIEN_SERVEUR "docker compose down"

# 2. Le nouveau serveur prend automatiquement le relais
#    (meme IP, meme port)
```

### Post-basculement

```bash
# Sur le nouveau serveur :

# Configurer le backup automatique (cron)
CONTAINER=$(docker ps --format '{{.Names}}' | grep orchestr-a)
cat > /opt/orchestr-a/backup-cron.sh << 'SCRIPT'
#!/bin/bash
set -euo pipefail
CONTAINER=$(docker ps --format '{{.Names}}' | grep orchestr-a)
BACKUP_DIR="/opt/orchestr-a/backups"
mkdir -p "$BACKUP_DIR"
FILENAME="orchestr-a-backup-$(date +%Y%m%d_%H%M%S).dump"
docker exec $CONTAINER pg_dump -U postgres -d orchestr_a --format=custom -f /tmp/$FILENAME
docker cp $CONTAINER:/tmp/$FILENAME $BACKUP_DIR/$FILENAME
docker exec $CONTAINER rm /tmp/$FILENAME
# Retention 30 jours
find "$BACKUP_DIR" -name "*.dump" -mtime +30 -delete
echo "$(date) — Backup OK : $FILENAME ($(du -h $BACKUP_DIR/$FILENAME | cut -f1))"
SCRIPT
chmod +x /opt/orchestr-a/backup-cron.sh

# Ajouter au cron (backup quotidien a 2h du matin)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/orchestr-a/backup-cron.sh >> /var/log/orchestr-a-backup.log 2>&1") | crontab -

# Verifier
crontab -l | grep orchestr-a
```

---

## 9. Rollback — Retour arriere

En cas de probleme sur le nouveau serveur, revenir a l'ancien :

```bash
# 1. Arreter le nouveau serveur
ssh user@NOUVEAU_SERVEUR "docker compose down"

# 2. Redemarrer l'ancien serveur
ssh user@ANCIEN_SERVEUR "docker compose up -d"

# 3. Si DNS modifie : remettre l'ancienne IP
# 4. Verifier que l'ancien serveur repond
curl -sf http://ANCIEN_SERVEUR/api/health
```

> Conservez l'ancien serveur fonctionnel pendant **au moins 7 jours** apres la migration avant de le decommissionner.

---

## 10. Depannage

### Le conteneur ne demarre pas

```bash
# Voir les logs
docker compose logs --tail=50

# Verifier l'etat
docker compose ps
docker inspect $CONTAINER --format '{{.State.Health.Status}}'
```

### Erreur pg_restore : "database orchestr_a does not exist"

La base n'a pas ete creee par le seed initial. Creer la base manuellement :

```bash
docker exec $CONTAINER psql -U postgres -c "CREATE DATABASE orchestr_a;"
# Puis relancer le pg_restore
```

### Erreur pg_restore : "relation already exists"

Normal avec `--clean`. Le restore tente de supprimer puis recreer. Si les erreurs persistent :

```bash
# Option nucleaire : vider completement la base avant restore
docker exec $CONTAINER psql -U postgres -d orchestr_a -c "
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;
  GRANT ALL ON SCHEMA public TO postgres;
  GRANT ALL ON SCHEMA public TO orchestr_a;
  GRANT USAGE ON SCHEMA public TO PUBLIC;
"

# Puis relancer le pg_restore SANS --clean
docker exec $CONTAINER pg_restore \
  -U postgres \
  -d orchestr_a \
  --no-owner \
  --no-privileges \
  --verbose \
  /tmp/orchestr-a-backup.dump

# IMPORTANT : Apres le restore, transferer la propriete des objets a orchestr_a
# (Prisma se connecte en tant que orchestr_a, pas postgres)
docker exec $CONTAINER psql -U postgres -d orchestr_a -c "
  REASSIGN OWNED BY postgres TO orchestr_a;
  ALTER SCHEMA pg_catalog OWNER TO postgres;
  ALTER SCHEMA information_schema OWNER TO postgres;
  GRANT ALL ON SCHEMA public TO orchestr_a;
  GRANT USAGE ON SCHEMA public TO PUBLIC;
"
```

> **IMPORTANT** : Sur PostgreSQL 15+, le schema `public` ne donne plus automatiquement
> les droits USAGE/CREATE aux utilisateurs non-proprietaires. Le `GRANT` a `orchestr_a`
> est obligatoire sinon Prisma echouera avec `relation "xxx" does not exist`.

### L'API demarre mais les donnees sont vides

Le seed a recree les donnees par defaut. Cela signifie que le `pg_restore` n'a pas ete execute ou a echoue silencieusement. Verifier :

```bash
# Compter les utilisateurs — si 1 seul (admin), le restore n'a pas marche
docker exec $CONTAINER psql -U postgres -d orchestr_a \
  -c "SELECT count(*) FROM \"User\";"

# Relancer le restore
docker exec $CONTAINER pg_restore \
  -U postgres -d orchestr_a \
  --clean --if-exists --no-owner --no-privileges \
  /tmp/orchestr-a-backup.dump
```

### Les sessions utilisateur sont invalides apres migration

Le `JWT_SECRET` a change. Deux options :

1. **Restaurer l'ancien secret** (voir [section 6.3](#63-restaurer-la-configuration-env))
2. **Demander aux utilisateurs de se reconnecter** (aucune action technique requise)

### Le port 80 est deja utilise

```bash
# Identifier le processus
sudo ss -tlnp | grep :80

# Option 1 : arreter le service en conflit (ex: apache/nginx natif)
sudo systemctl stop nginx
sudo systemctl disable nginx

# Option 2 : utiliser un autre port
# Modifier HTTP_PORT dans le .env
sed -i 's/HTTP_PORT=80/HTTP_PORT=8080/' .env
docker compose down && docker compose up -d
```

### Espace disque insuffisant

```bash
# Verifier l'espace
df -h /

# Nettoyer Docker (images/volumes orphelins)
docker system prune -a --volumes

# Verifier la taille du volume de donnees
docker system df -v | grep orchestr-a
```

---

## Annexe A : Architecture interne de l'image all-in-one

```
┌──────────────────────────────────────────────────────────┐
│              orchestr-a:local (image unique)              │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │                   supervisord                      │  │
│  └──────┬────────┬────────┬────────┬──────────────────┘  │
│         │        │        │        │                      │
│    ┌────▼───┐ ┌──▼───┐ ┌──▼──┐ ┌──▼──────┐ ┌─────────┐ │
│    │ nginx  │ │ api  │ │ web │ │postgres │ │  redis  │ │
│    │  :80   │ │:4000 │ │:3001│ │  :5432  │ │  :6379  │ │
│    └────────┘ └──────┘ └─────┘ └─────────┘ └─────────┘ │
│                                                          │
│  Volume /data :                                          │
│  ├── postgresql/   ← donnees PostgreSQL                  │
│  ├── redis/        ← persistence Redis (AOF)             │
│  └── uploads/      ← fichiers uploades                   │
└──────────────────────────────────────────────────────────┘
```

| Composant  | Port interne | Role                          |
| ---------- | ------------ | ----------------------------- |
| nginx      | 80           | Reverse proxy, point d'entree |
| api        | 4000         | Backend NestJS                |
| web        | 3001         | Frontend Next.js              |
| postgresql | 5432         | Base de donnees               |
| redis      | 6379         | Cache et sessions             |

---

## Annexe B : Checklist imprimable

### Pre-migration

- [ ] Nouveau serveur provisionne avec Docker installe
- [ ] Acces SSH aux deux serveurs verifie
- [ ] Espace disque suffisant sur le nouveau serveur (>5 Go)
- [ ] TTL DNS reduit a 300s (si changement d'IP, 24h avant)
- [ ] Fenetre de maintenance communiquee aux utilisateurs

### Sauvegarde (ancien serveur)

- [ ] `pg_dump` execute avec succes
- [ ] Integrite du dump verifiee (nombre de tables)
- [ ] Uploads sauvegardes (si applicable)
- [ ] Variables d'environnement sauvegardees (`JWT_SECRET`)
- [ ] Taille des fichiers de sauvegarde notee : **\_\_\_\_**

### Transfert

- [ ] Dump transfere sur le nouveau serveur (`/tmp/`)
- [ ] Uploads transferes (si applicable)
- [ ] Fichier env transfere
- [ ] Package offline transfere (si methode offline)

### Installation (nouveau serveur)

- [ ] Image Docker chargee
- [ ] Conteneur demarre et healthy
- [ ] `pg_restore` execute avec succes
- [ ] Uploads restaures (si applicable)
- [ ] `JWT_SECRET` restaure (si souhaite)

### Verification

- [ ] Health check API : OK
- [ ] Frontend accessible : OK
- [ ] Connexion admin : OK
- [ ] Nombre d'utilisateurs coherent : **\_\_\_\_**
- [ ] Nombre de projets coherent : **\_\_\_\_**
- [ ] Navigation fonctionnelle dans l'application
- [ ] Acces depuis l'exterieur : OK

### Basculement

- [ ] Ancien serveur arrete
- [ ] DNS mis a jour (si applicable)
- [ ] Propagation DNS verifiee
- [ ] Backup cron configure sur le nouveau serveur
- [ ] Ancien serveur conserve (decomissionner apres 7 jours)
