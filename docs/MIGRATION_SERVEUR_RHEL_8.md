# Migration de serveur Orchestr'A (Image All-in-One)

Guide complet pour migrer une instance Orchestr'A vers un nouveau serveur en preservant toutes les donnees (base PostgreSQL, uploads, configuration).

| Information       | Valeur                                                    |
| ----------------- | --------------------------------------------------------- |
| **Architecture**  | Image all-in-one `ghcr.io/elegalex/orchestr-a:latest`     |
| **Volume unique** | `orchestr-a-data:/data` (PostgreSQL, Redis, uploads)      |
| **Methode**       | pg_dump/pg_restore + copie des uploads + package offline  |
| **Revision**      | 2026-03-11 — Integre les retours terrain CPAM 92 (RHEL 8) |

---

## Table des matieres

- [1. Pre-requis](#1-pre-requis)
- [2. Vue d'ensemble](#2-vue-densemble)
- [3. Concepts cles](#3-concepts-cles)
- [4. Phase 1 — Sauvegarde sur l'ancien serveur](#4-phase-1--sauvegarde-sur-lancien-serveur)
- [5. Phase 2 — Transfert vers le nouveau serveur](#5-phase-2--transfert-vers-le-nouveau-serveur)
- [6. Phase 3 — Installation sur le nouveau serveur](#6-phase-3--installation-sur-le-nouveau-serveur)
- [7. Phase 4 — Restauration des donnees](#7-phase-4--restauration-des-donnees)
- [8. Phase 5 — Verification](#8-phase-5--verification)
- [9. Phase 6 — Basculement](#9-phase-6--basculement)
- [10. Rollback — Retour arriere](#10-rollback--retour-arriere)
- [11. Depannage](#11-depannage)
- [Annexe A : Architecture interne](#annexe-a--architecture-interne-de-limage-all-in-one)
- [Annexe B : Specificites RHEL / SELinux](#annexe-b--specificites-rhel--selinux)
- [Annexe C : Script fix-restore.sh (reference)](#annexe-c--script-fix-restoresh-reference)
- [Annexe D : Checklist imprimable](#annexe-d--checklist-imprimable)

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
- Si RHEL/CentOS : lire l'[Annexe B](#annexe-b--specificites-rhel--selinux) avant de commencer

### Poste de travail (optionnel)

Si le transfert direct entre serveurs n'est pas possible, un poste intermediaire avec `scp`/`rsync` peut servir de relais. Pour les environnements air-gapped, prevoir un support USB.

---

## 2. Vue d'ensemble

```
┌──────────────────────┐                     ┌──────────────────────┐
│   ANCIEN SERVEUR     │                     │   NOUVEAU SERVEUR    │
│                      │                     │                      │
│  1. pg_dump ──────── │ ── 4. Transfert ──► │  5. install.sh       │
│  2. tar uploads      │    (scp/usb)        │  6. pg_restore       │
│  3. copie .env       │                     │  7. fix ownership    │
│                      │                     │  8. copie uploads    │
│                      │                     │  9. verification     │
└──────────────────────┘                     └──────────────────────┘
                                                       │
                                             10. Basculement DNS/IP
```

**Temps estime** : 30-90 minutes selon la taille de la base et la bande passante.

**Indisponibilite** : limitee au temps entre l'arret de l'ancien serveur et la fin de la verification sur le nouveau (~5-15 minutes si tout est pre-prepare).

---

## 3. Concepts cles

Avant de commencer, il est important de comprendre trois aspects techniques qui impactent directement la procedure de restauration.

### 3.1 Deux utilisateurs PostgreSQL distincts

L'image all-in-one utilise deux utilisateurs PostgreSQL :

| Utilisateur  | Role                                                        |
| ------------ | ----------------------------------------------------------- |
| `postgres`   | Superuser systeme. Utilise pour pg_dump et pg_restore.      |
| `orchestr_a` | Utilisateur applicatif. Utilise par Prisma et l'API NestJS. |

**Consequence** : apres un `pg_restore -U postgres`, tous les objets restaures (tables, enums, sequences) appartiennent a `postgres`. L'application, qui se connecte en tant que `orchestr_a`, ne peut pas y acceder. Il faut donc **transferer la propriete** de tous les objets a `orchestr_a` apres chaque restauration. Cette etape est integree dans la procedure ci-dessous.

### 3.2 PostgreSQL 16 et le schema public

Depuis PostgreSQL 15, le schema `public` n'accorde plus automatiquement les droits `USAGE` et `CREATE` aux utilisateurs non-proprietaires. Apres un `DROP SCHEMA public CASCADE; CREATE SCHEMA public`, l'utilisateur `orchestr_a` perd tout acces aux tables — meme si elles existent. PostgreSQL retourne alors `relation "xxx" does not exist` (pas `permission denied`), ce qui est trompeur.

### 3.3 Comportement de l'entrypoint au demarrage

A chaque demarrage du conteneur, l'entrypoint execute la sequence suivante :

1. Teste l'existence de `/data/postgresql/PG_VERSION`
2. Si absent → **PREMIERE INSTALLATION** : `initdb` cree un cluster vide
3. Si present → **MISE A JOUR** : backup pre-migration, puis `prisma migrate deploy`
4. `prisma migrate deploy` applique les migrations manquantes sans toucher aux donnees existantes
5. Si la base est vide (0 utilisateurs) → creation de l'admin par defaut

**Important** : l'entrypoint inclut un bloc defensif qui corrige automatiquement les droits du schema `public` pour `orchestr_a` avant de lancer les migrations. Si une restauration a ete effectuee correctement avec la bonne procedure, le redemarrage du conteneur devrait fonctionner sans intervention.

---

## 4. Phase 1 — Sauvegarde sur l'ancien serveur

> Toutes les commandes de cette section sont executees sur **l'ancien serveur**.

### 4.1 Identifier le conteneur

```bash
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
```

Reperer le nom du conteneur Orchestr'A. Exemples courants :

| Nom possible              | Contexte                    |
| ------------------------- | --------------------------- |
| `orchestr-a-orchestr-a-1` | Installe via docker compose |
| `orchestr-a`              | Installe via docker run     |

```bash
# Definir une variable pour simplifier les commandes
CONTAINER="orchestr-a-orchestr-a-1"
```

### 4.2 Sauvegarder la base de donnees

Le format custom est recommande (compresse, restauration selective, gestion des dependances).

```bash
# Creer le dump au format custom
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

### 4.3 Verifier l'integrite du dump

```bash
# Lister le contenu du dump
docker exec $CONTAINER pg_restore \
  --list /tmp/orchestr-a-backup.dump | head -30

# Compter les tables dans le dump
docker exec $CONTAINER pg_restore \
  --list /tmp/orchestr-a-backup.dump | grep "TABLE" | wc -l

# Comparer avec les tables en base
docker exec $CONTAINER psql -U postgres -d orchestr_a \
  -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';"
```

Le nombre doit correspondre. Le schema contient environ 25 tables.

### 4.4 Sauvegarder les uploads

```bash
# Verifier s'il y a des uploads
docker exec $CONTAINER ls -la /data/uploads/ 2>/dev/null || echo "Pas de dossier uploads"

# Si le dossier existe et contient des fichiers :
docker exec $CONTAINER tar czf /tmp/uploads-backup.tar.gz -C /data/uploads . 2>/dev/null
docker cp $CONTAINER:/tmp/uploads-backup.tar.gz ./uploads-backup.tar.gz 2>/dev/null
ls -lh uploads-backup.tar.gz 2>/dev/null || echo "Pas d'uploads a sauvegarder"
```

### 4.5 Sauvegarder la configuration

```bash
# Methode universelle : extraire les variables d'environnement du conteneur
docker inspect $CONTAINER \
  --format '{{range .Config.Env}}{{println .}}{{end}}' > env-backup-full.txt
```

Variables critiques a conserver :

| Variable            | Importance | Raison                                              |
| ------------------- | ---------- | --------------------------------------------------- |
| `JWT_SECRET`        | Critique   | Si change, tous les utilisateurs seront deconnectes |
| `POSTGRES_PASSWORD` | Important  | Utilise en interne par le conteneur                 |
| `REDIS_PASSWORD`    | Important  | Utilise en interne par le conteneur                 |
| `HTTP_PORT`         | Mineur     | Port d'ecoute (defaut : 80)                         |

### 4.6 Recapitulatif des fichiers sauvegardes

```bash
ls -lh orchestr-a-backup.dump uploads-backup.tar.gz env-backup-full.txt 2>/dev/null
```

| Fichier                  | Obligatoire | Contenu                   |
| ------------------------ | ----------- | ------------------------- |
| `orchestr-a-backup.dump` | Oui         | Base de donnees complete  |
| `uploads-backup.tar.gz`  | Si existant | Fichiers uploades         |
| `env-backup-full.txt`    | Recommande  | Variables d'environnement |

---

## 5. Phase 2 — Transfert vers le nouveau serveur

### Transfert direct entre serveurs

```bash
scp orchestr-a-backup.dump user@NOUVEAU_SERVEUR:/tmp/
scp uploads-backup.tar.gz user@NOUVEAU_SERVEUR:/tmp/ 2>/dev/null
scp env-backup-full.txt user@NOUVEAU_SERVEUR:/tmp/
```

### Transfert via package offline (serveur sans internet)

```bash
# Preparer tous les fichiers sur un support USB ou un partage
# Inclure : le package offline, le dump, les uploads, l'env
```

### Verification du transfert

```bash
# Sur le nouveau serveur
ls -lh /tmp/orchestr-a-backup.dump /tmp/uploads-backup.tar.gz /tmp/env-backup-full.txt 2>/dev/null
```

---

## 6. Phase 3 — Installation sur le nouveau serveur

> Toutes les commandes de cette section sont executees sur **le nouveau serveur**.

### 6.1 Methode A : Package offline (sans internet)

```bash
cd /tmp
tar xzf orchestr-a-offline-*.tar.gz
cd orchestr-a-offline-*
sudo bash install.sh
```

Le script verifie Docker, charge l'image, genere les secrets, demarre le conteneur et attend qu'il soit healthy.

> A cette etape, le conteneur tourne avec une base **vierge** (seed par defaut). La restauration se fait a l'etape suivante.

### 6.2 Methode B : Pull direct depuis GHCR (avec internet)

```bash
sudo mkdir -p /opt/orchestr-a
cd /opt/orchestr-a

# Telecharger le compose
curl -fsSL https://raw.githubusercontent.com/ElegAlex/Orchestr-A/master/docker-compose.offline.yml \
  -o docker-compose.yml

# Telecharger l'image
docker pull ghcr.io/elegalex/orchestr-a:latest
docker tag ghcr.io/elegalex/orchestr-a:latest orchestr-a:local

# Generer le fichier .env
cat > .env << 'ENVEOF'
POSTGRES_PASSWORD=CHANGEZ_MOI_32_CARACTERES
REDIS_PASSWORD=CHANGEZ_MOI_32_CARACTERES
JWT_SECRET=CHANGEZ_MOI_64_CARACTERES_MINIMUM
HTTP_PORT=80
ENVEOF

# Demarrer
docker compose up -d

# Attendre que le service soit healthy (~60-90s)
echo "Attente du demarrage..."
until docker compose ps | grep -q "healthy"; do sleep 5; done
echo "Service pret."
```

---

## 7. Phase 4 — Restauration des donnees

> **IMPORTANT** : Le conteneur doit etre en cours d'execution (`healthy`) avant de restaurer.

### 7.1 Identifier le conteneur

```bash
CONTAINER=$(docker ps --format '{{.Names}}' | grep orchestr-a)
echo "Conteneur cible : $CONTAINER"
```

### 7.2 Arreter le conteneur

La restauration se fait dans un conteneur temporaire, pas dans le conteneur en cours d'execution. Cela evite les conflits entre Prisma/l'API et le restore.

```bash
docker stop $CONTAINER
```

### 7.3 Copier les fichiers dans le volume de donnees

> **RHEL/SELinux** : Ne pas utiliser de bind mounts (`-v /chemin:/chemin`). SELinux bloque l'acces aux fichiers montes depuis l'hote. Utiliser `docker cp` vers le volume existant.

```bash
# Copier le dump dans le volume /data du conteneur
docker cp /tmp/orchestr-a-backup.dump $CONTAINER:/data/restore-dump.dump

# Verifier
docker run --rm --entrypoint bash --volumes-from $CONTAINER orchestr-a:local \
  -c "ls -lh /data/restore-dump.dump"
```

### 7.4 Restaurer via un conteneur temporaire

Le conteneur temporaire accede au volume `/data` du conteneur principal, demarre PostgreSQL, effectue la restauration et corrige les droits.

```bash
docker run --rm \
  --name orchestr-a-restore-temp \
  --entrypoint bash \
  --volumes-from $CONTAINER \
  orchestr-a:local \
  -c '
set -e
PG_VERSION=$(cat /tmp/pg_version)

echo "=== Demarrage PostgreSQL ==="
chown -R postgres:postgres /data/postgresql /run/postgresql
gosu postgres /usr/lib/postgresql/$PG_VERSION/bin/pg_ctl \
  -D /data/postgresql -w start -o "-c listen_addresses=localhost"

echo "=== Nettoyage du schema ==="
gosu postgres psql -d orchestr_a -c "DROP SCHEMA public CASCADE;"
gosu postgres psql -d orchestr_a -c "CREATE SCHEMA public;"
gosu postgres psql -d orchestr_a -c "GRANT ALL ON SCHEMA public TO postgres;"

echo "=== Restauration du dump ==="
gosu postgres pg_restore \
  -U postgres \
  -d orchestr_a \
  --no-owner \
  --no-privileges \
  --verbose \
  /data/restore-dump.dump 2>&1 | tail -20

echo "=== Transfert de propriete a orchestr_a ==="
gosu postgres psql -d orchestr_a -c "ALTER SCHEMA public OWNER TO orchestr_a;"
gosu postgres psql -d orchestr_a -c "GRANT ALL ON SCHEMA public TO orchestr_a;"
gosu postgres psql -d orchestr_a -c "GRANT USAGE ON SCHEMA public TO PUBLIC;"

gosu postgres psql -d orchestr_a -c "
  DO \$\$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = '"'"'public'"'"' LOOP
      EXECUTE '"'"'ALTER TABLE public.'"'"' || quote_ident(r.tablename) || '"'"' OWNER TO orchestr_a'"'"';
    END LOOP;
  END \$\$;
"

gosu postgres psql -d orchestr_a -c "
  DO \$\$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT typname FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE n.nspname = '"'"'public'"'"' AND t.typtype = '"'"'e'"'"' LOOP
      EXECUTE '"'"'ALTER TYPE public.'"'"' || quote_ident(r.typname) || '"'"' OWNER TO orchestr_a'"'"';
    END LOOP;
  END \$\$;
"

gosu postgres psql -d orchestr_a -c "
  DO \$\$ DECLARE r RECORD; BEGIN
    FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = '"'"'public'"'"' LOOP
      EXECUTE '"'"'ALTER SEQUENCE public.'"'"' || quote_ident(r.sequencename) || '"'"' OWNER TO orchestr_a'"'"';
    END LOOP;
  END \$\$;
"

gosu postgres psql -d orchestr_a -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO orchestr_a;"
gosu postgres psql -d orchestr_a -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO orchestr_a;"
gosu postgres psql -d orchestr_a -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

echo "=== Verification en tant que orchestr_a ==="
PGPASSWORD=orchestr_a psql -U orchestr_a -h localhost -d orchestr_a -c \
  "SELECT '"'"'users'"'"' AS t, count(*) FROM users
   UNION ALL SELECT '"'"'projects'"'"', count(*) FROM projects
   UNION ALL SELECT '"'"'tasks'"'"', count(*) FROM tasks;"

echo "=== Nettoyage ==="
rm -f /data/restore-dump.dump

echo "=== Arret PostgreSQL ==="
gosu postgres /usr/lib/postgresql/$PG_VERSION/bin/pg_ctl -D /data/postgresql -w stop
echo "=== RESTAURATION TERMINEE ==="
'
```

**Points importants :**

- `--entrypoint bash` est obligatoire pour bypasser l'entrypoint de l'image
- Pas de `--clean` ni `--if-exists` dans pg_restore (le schema est deja vide)
- Le transfert de propriete couvre : schema, tables, enums, sequences
- La verification se fait en tant que `orchestr_a` (pas `postgres`) pour confirmer que Prisma fonctionnera
- On ne peut PAS utiliser `REASSIGN OWNED BY postgres TO orchestr_a` car postgres possede des objets systeme non transferables

#### Alternative : utiliser le script fix-restore.sh

Pour une execution plus robuste avec verifications a chaque etape, utilisez le script `fix-restore.sh` fourni en [Annexe C](#annexe-c--script-fix-restoresh-reference). Il effectue exactement les memes operations avec gestion d'erreurs, messages de progression et possibilite de re-execution.

```bash
# Copier les deux fichiers sur le serveur
scp fix-restore.sh fix-restore.sql user@SERVEUR:/docker/backup/

# Executer
cd /docker/backup
bash fix-restore.sh
```

### 7.5 Redemarrer le conteneur

```bash
docker start $CONTAINER

# Suivre les logs
docker logs -f $CONTAINER
```

L'entrypoint detectera une installation existante (MISE A JOUR), fera un backup pre-migration, appliquera les migrations Prisma manquantes (sans toucher aux donnees), puis demarrera les 5 services.

Vous devriez voir dans les logs :

```
▶ Installation existante detectee — mode MISE A JOUR
  ✓ Backup cree : /data/backup_pre_migration_...
  ✓ Migration terminee. X nouvelle(s) migration(s) appliquee(s).
  ✓ Orchestr'A — Demarrage des services...
  success: postgresql entered RUNNING state
  success: redis entered RUNNING state
  success: api entered RUNNING state
  success: web entered RUNNING state
  success: nginx entered RUNNING state
```

### 7.6 Restaurer les uploads

```bash
# Si le backup d'uploads existe :
docker cp /tmp/uploads-backup.tar.gz $CONTAINER:/tmp/uploads-backup.tar.gz

docker exec $CONTAINER bash -c "
  mkdir -p /data/uploads
  tar xzf /tmp/uploads-backup.tar.gz -C /data/uploads
  chown -R root:root /data/uploads
  rm /tmp/uploads-backup.tar.gz
"

docker exec $CONTAINER ls -la /data/uploads/
```

### 7.7 Restaurer la configuration .env

Pour conserver les sessions utilisateur, restaurer le `JWT_SECRET` :

```bash
# Extraire le JWT_SECRET de l'ancien .env
OLD_JWT=$(grep "JWT_SECRET" /tmp/env-backup-full.txt | head -1 | cut -d= -f2)
echo "Ancien JWT_SECRET : ${OLD_JWT:0:8}... (tronque)"

# Remplacer dans le .env actuel
ENV_FILE="/chemin/vers/votre/.env"
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${OLD_JWT}|" "$ENV_FILE"

# Redemarrer pour prendre en compte
docker compose down && docker compose up -d
```

> Si vous ne restaurez pas le `JWT_SECRET`, les utilisateurs devront simplement se reconnecter. Ce n'est pas bloquant.

---

## 8. Phase 5 — Verification

### Tests automatiques

```bash
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

# 4. Comptage donnees
if [ -n "$TOKEN" ]; then
  echo -n "4. Donnees presentes : "
  CONTAINER=$(docker ps --format '{{.Names}}' | grep orchestr-a)
  USERS=$(docker exec $CONTAINER psql -U postgres -d orchestr_a -tAc "SELECT count(*) FROM users;")
  PROJECTS=$(docker exec $CONTAINER psql -U postgres -d orchestr_a -tAc "SELECT count(*) FROM projects;")
  TASKS=$(docker exec $CONTAINER psql -U postgres -d orchestr_a -tAc "SELECT count(*) FROM tasks;")
  echo "$USERS utilisateurs, $PROJECTS projets, $TASKS taches"
fi

# 5. Etat du conteneur
echo -n "5. Conteneur : "
docker ps --format '{{.Names}} {{.Status}}' | grep orchestr-a

echo "=== Fin de la verification ==="
```

### Tests manuels recommandes

| Test                              | Comment verifier                               |
| --------------------------------- | ---------------------------------------------- |
| Connexion avec un compte existant | Se connecter via le navigateur                 |
| Navigation dans les projets       | Ouvrir un projet existant, verifier les taches |
| Consultation du planning          | Page planning, verifier les affectations       |
| Upload d'un fichier               | Tester l'upload d'un document                  |
| Acces depuis l'exterieur          | Acceder via l'IP publique ou le nom de domaine |

---

## 9. Phase 6 — Basculement

### Si migration avec changement d'IP (DNS)

```bash
# 1. Reduire le TTL DNS a 300s au moins 24h AVANT la migration
# 2. Arreter l'ancien serveur
ssh user@ANCIEN_SERVEUR "docker compose down"
# 3. Mettre a jour l'enregistrement DNS vers la nouvelle IP
# 4. Verifier la propagation
dig +short votre-domaine.fr
# 5. Attendre la propagation complete (~5-30 min avec TTL 300s)
```

### Si migration avec meme IP

```bash
# 1. Arreter l'ancien serveur
ssh user@ANCIEN_SERVEUR "docker compose down"
# 2. Le nouveau serveur prend automatiquement le relais
```

### Post-basculement : configurer le backup automatique

```bash
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
find "$BACKUP_DIR" -name "*.dump" -mtime +30 -delete
echo "$(date) — Backup OK : $FILENAME ($(du -h $BACKUP_DIR/$FILENAME | cut -f1))"
SCRIPT
chmod +x /opt/orchestr-a/backup-cron.sh

# Ajouter au cron (backup quotidien a 2h du matin)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/orchestr-a/backup-cron.sh >> /var/log/orchestr-a-backup.log 2>&1") | crontab -
```

---

## 10. Rollback — Retour arriere

```bash
# 1. Arreter le nouveau serveur
ssh user@NOUVEAU_SERVEUR "docker compose down"
# 2. Redemarrer l'ancien serveur
ssh user@ANCIEN_SERVEUR "docker compose up -d"
# 3. Si DNS modifie : remettre l'ancienne IP
# 4. Verifier que l'ancien serveur repond
curl -sf http://ANCIEN_SERVEUR/api/health
```

> Conservez l'ancien serveur fonctionnel pendant **au moins 7 jours** apres la migration.

---

## 11. Depannage

### Le conteneur ne demarre pas

```bash
docker compose logs --tail=50
docker compose ps
docker inspect $CONTAINER --format '{{.State.Health.Status}}'
```

### Erreur pg_restore : "relation already exists" ou "cannot drop constraint"

C'est le probleme le plus frequent. Il survient quand la base cible contient des tables plus recentes (creees par les migrations Prisma) qui ne sont pas dans le dump. La solution est de vider completement le schema avant le restore :

```bash
# 1. Vider le schema (supprime TOUT y compris les tables hors dump)
docker exec $CONTAINER psql -U postgres -d orchestr_a -c "
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;
  GRANT ALL ON SCHEMA public TO postgres;
"

# 2. Restaurer SANS --clean (le schema est deja vide)
docker exec $CONTAINER pg_restore \
  -U postgres \
  -d orchestr_a \
  --no-owner \
  --no-privileges \
  --verbose \
  /tmp/orchestr-a-backup.dump
```

> **Ne JAMAIS utiliser `--clean --if-exists`** pour le restore. Ces options tentent de supprimer les objets un par un et echouent sur les dependances croisees entre tables du dump et tables hors dump.

### Erreur : "relation \_prisma_migrations does not exist"

Cette erreur signifie que l'utilisateur `orchestr_a` (utilise par Prisma) n'a pas acces au schema `public`. La cause est un pg_restore execute avec `-U postgres` sans transfert de propriete ensuite.

**Diagnostic :**

```bash
# Verifier le proprietaire du schema public
docker exec $CONTAINER psql -U postgres -d orchestr_a -c \
  "SELECT nspname, nspowner::regrole FROM pg_namespace WHERE nspname = 'public';"

# Si owner = postgres, c'est le probleme. Corriger :
docker exec $CONTAINER psql -U postgres -d orchestr_a -c "
  ALTER SCHEMA public OWNER TO orchestr_a;
  GRANT ALL ON SCHEMA public TO orchestr_a;
  GRANT USAGE ON SCHEMA public TO PUBLIC;
"
```

**Correction complete (si les tables aussi appartiennent a postgres) :**

```bash
# Creer un fichier SQL de correction
cat > /tmp/fix-ownership.sql << 'SQL'
ALTER SCHEMA public OWNER TO orchestr_a;
GRANT ALL ON SCHEMA public TO orchestr_a;
GRANT USAGE ON SCHEMA public TO PUBLIC;

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' OWNER TO orchestr_a';
  END LOOP;
END $$;

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT typname FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public' AND t.typtype = 'e' LOOP
    EXECUTE 'ALTER TYPE public.' || quote_ident(r.typname) || ' OWNER TO orchestr_a';
  END LOOP;
END $$;

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
    EXECUTE 'ALTER SEQUENCE public.' || quote_ident(r.sequencename) || ' OWNER TO orchestr_a';
  END LOOP;
END $$;

GRANT ALL ON ALL TABLES IN SCHEMA public TO orchestr_a;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO orchestr_a;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
SQL

# Executer (cat | psql pour eviter les problemes SELinux avec -f)
cat /tmp/fix-ownership.sql | docker exec -i $CONTAINER psql -U postgres -d orchestr_a

# Redemarrer le conteneur
docker restart $CONTAINER
```

> **Ne PAS utiliser `REASSIGN OWNED BY postgres TO orchestr_a`** — cette commande echoue car `postgres` possede des objets systeme non transferables.

### Erreur : "Permission denied" lors du pg_restore ou psql -f

Sur RHEL/CentOS avec SELinux en mode enforcing, les fichiers montes via `-v` (bind mount) ou ouverts via `psql -f` sont bloques par le contexte de securite.

**Solutions :**

- Utiliser `docker cp` au lieu de `-v` pour copier les fichiers dans le volume
- Utiliser `cat fichier | psql` au lieu de `psql -f fichier`

Voir l'[Annexe B](#annexe-b--specificites-rhel--selinux) pour les details.

### Erreur pg_restore : "database orchestr_a does not exist"

La base n'a pas ete creee par le seed initial :

```bash
docker exec $CONTAINER psql -U postgres -c "
  CREATE USER orchestr_a WITH PASSWORD 'orchestr_a';
  CREATE DATABASE orchestr_a OWNER orchestr_a;
"
```

### L'API demarre mais les donnees sont vides

Le seed a recree les donnees par defaut. Le pg_restore n'a pas ete execute ou a echoue. Verifier :

```bash
# Si 1 seul utilisateur (admin), le restore n'a pas marche
docker exec $CONTAINER psql -U postgres -d orchestr_a -tAc "SELECT count(*) FROM users;"
```

Relancer la restauration depuis la [section 7.4](#74-restaurer-via-un-conteneur-temporaire).

### Les sessions utilisateur sont invalides apres migration

Le `JWT_SECRET` a change. Restaurer l'ancien secret (voir [section 7.7](#77-restaurer-la-configuration-env)) ou demander aux utilisateurs de se reconnecter.

### Le port 80 est deja utilise

```bash
sudo ss -tlnp | grep :80
# Option 1 : arreter le service en conflit
sudo systemctl stop nginx && sudo systemctl disable nginx
# Option 2 : utiliser un autre port dans le .env
sed -i 's/HTTP_PORT=80/HTTP_PORT=8080/' .env
docker compose down && docker compose up -d
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
│    ┌────▼───┐ ┌──▼───┐ ┌──▼──┐ ┌──▼─────┐ ┌──────────┐ │
│    │ nginx  │ │ api  │ │ web │ │postgres│ │  redis   │ │
│    │  :80   │ │:4000 │ │:3001│ │  :5432 │ │  :6379   │ │
│    └────────┘ └──────┘ └─────┘ └────────┘ └──────────┘ │
│                                                          │
│  Volume /data :                                          │
│  ├── postgresql/   ← donnees PostgreSQL (PG_VERSION)     │
│  ├── redis/        ← persistence Redis (AOF)             │
│  ├── uploads/      ← fichiers uploades (avatars, docs)   │
│  └── .jwt_secret   ← secret JWT persiste                 │
└──────────────────────────────────────────────────────────┘
```

| Composant  | Port interne | Role                          |
| ---------- | ------------ | ----------------------------- |
| nginx      | 80           | Reverse proxy, point d'entree |
| api        | 4000         | Backend NestJS + Prisma       |
| web        | 3001         | Frontend Next.js              |
| postgresql | 5432         | Base de donnees (localhost)   |
| redis      | 6379         | Cache et sessions             |

**Entrypoint** (`/entrypoint.sh`) :

1. Detecte premiere installation vs mise a jour (`/data/postgresql/PG_VERSION`)
2. Gere le `JWT_SECRET` (env > fichier persiste > generation auto)
3. Initialise ou demarre PostgreSQL
4. Cree la base et l'utilisateur `orchestr_a` si besoin
5. Corrige les droits du schema public (bloc defensif)
6. Execute `prisma migrate deploy` (migrations incrementales)
7. Cree l'admin par defaut si la base est vide
8. Lance supervisord (5 services)

---

## Annexe B : Specificites RHEL / SELinux

Sur Red Hat Enterprise Linux (et CentOS/AlmaLinux/Rocky), SELinux est en mode `enforcing` par defaut. Cela impacte plusieurs operations Docker.

### Problemes connus et solutions

| Probleme                                                      | Cause SELinux                                                                   | Solution                                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `Permission denied` sur un fichier monte avec `-v`            | Le fichier a un contexte SELinux incompatible avec le conteneur                 | Utiliser `docker cp` vers le volume au lieu de `-v` bind mount                       |
| `psql -f /chemin/fichier.sql` echoue avec `Permission denied` | `gosu postgres` change l'utilisateur mais le contexte SELinux bloque la lecture | Utiliser `cat fichier.sql \| gosu postgres psql` (cat tourne en root)                |
| Le conteneur temporaire ne peut pas lire le dump              | Meme cause que le premier point                                                 | Copier le dump dans `/data/` via `docker cp` avant de lancer le conteneur temporaire |

### Regles generales pour RHEL

1. **Ne jamais utiliser `-v` pour monter des fichiers de l'hote** dans un conteneur de restauration. Toujours copier avec `docker cp` dans un volume Docker existant.
2. **Ne jamais utiliser `psql -f`** sur un fichier copie dans le conteneur. Toujours utiliser `cat fichier | psql`.
3. **Les volumes Docker nommes** (`orchestr-a-data:/data`) fonctionnent sans probleme — SELinux ne bloque que les bind mounts.
4. **`docker cp`** fonctionne car il copie les octets dans le filesystem du conteneur, pas un montage.

### Verifier le mode SELinux

```bash
getenforce
# Enforcing = SELinux actif (defaut RHEL)
# Permissive = SELinux en mode log-only
# Disabled = SELinux desactive
```

> **Ne desactivez pas SELinux** pour contourner les problemes. Les solutions ci-dessus fonctionnent sans compromettre la securite du serveur.

---

## Annexe C : Script fix-restore.sh (reference)

Pour les cas ou la restauration doit etre refaite (erreur, dump plus recent, etc.), un script automatise est disponible. Il effectue toutes les operations de la section 7 avec gestion d'erreurs et verifications a chaque etape.

### Fichiers necessaires

| Fichier           | Role                                                                      |
| ----------------- | ------------------------------------------------------------------------- |
| `fix-restore.sh`  | Script principal — stoppe, restaure, corrige les droits, verifie, relance |
| `fix-restore.sql` | Commandes SQL de correction des droits, appele par le .sh                 |

### Variables configurables (en haut du .sh)

| Variable      | Defaut                                           | Description                  |
| ------------- | ------------------------------------------------ | ---------------------------- |
| `CONTAINER`   | `orchestr-a-orchestr-a-1`                        | Nom du conteneur (docker ps) |
| `DUMP_PATH`   | `/docker/backup/orchestr-a-backup-06032026.dump` | Chemin du dump sur l'hote    |
| `IMAGE`       | `orchestr-a:local`                               | Image Docker a utiliser      |
| `COMPOSE_DIR` | `/docker/orchestr-a-v3-06032026`                 | Repertoire du compose        |

### Utilisation

```bash
# Placer les deux fichiers dans le meme repertoire
cd /docker/backup
bash fix-restore.sh
```

### Ce que fait le script

1. **Etape 0** — Verifie les prerequis (docker, conteneur, dump, image, SQL)
2. **Etape 1** — Stoppe le conteneur
3. **Etape 1b** — Copie le dump et le SQL dans le volume `/data` via `docker cp`
4. **Etape 2** — Lance un conteneur temporaire (`--entrypoint bash`, `--volumes-from`)
   - Demarre PostgreSQL sur le cluster existant
   - Vide le schema public (`DROP SCHEMA CASCADE`)
   - Restaure le dump (`pg_restore` sans `--clean`)
   - Verifie le nombre de tables creees
   - Execute `fix-restore.sql` (transfert de propriete a `orchestr_a`)
   - Verifie que `orchestr_a` voit les tables (test decisif)
   - Arrete PostgreSQL proprement
5. **Etape 3** — Relance le conteneur et attend le healthcheck
6. **Etape 4** — Affiche les logs et l'etat final

Le script est **re-executable** : en cas d'echec, il peut etre relance sans risque.

---

## Annexe D : Checklist imprimable

### Pre-migration

- [ ] Nouveau serveur provisionne avec Docker installe
- [ ] Acces SSH aux deux serveurs verifie
- [ ] Espace disque suffisant (>5 Go)
- [ ] Si RHEL : Annexe B lue et comprise
- [ ] TTL DNS reduit a 300s (si changement d'IP, 24h avant)
- [ ] Fenetre de maintenance communiquee aux utilisateurs

### Sauvegarde (ancien serveur)

- [ ] `pg_dump --format=custom` execute avec succes
- [ ] Integrite du dump verifiee (nombre de tables)
- [ ] Uploads sauvegardes (si applicable)
- [ ] Variables d'environnement sauvegardees (`JWT_SECRET`)
- [ ] Taille des fichiers de sauvegarde notee : **\_\_\_\_**

### Transfert

- [ ] Dump transfere sur le nouveau serveur
- [ ] Uploads transferes (si applicable)
- [ ] Fichier env transfere
- [ ] Package offline transfere (si methode offline)
- [ ] `fix-restore.sh` et `fix-restore.sql` transferes

### Installation (nouveau serveur)

- [ ] Image Docker chargee et taggee `orchestr-a:local`
- [ ] Conteneur demarre et healthy (avant restore)
- [ ] Conteneur stoppe avant restauration
- [ ] Restore execute via conteneur temporaire (section 7.4)
- [ ] Ownership transfere a `orchestr_a` (verification en tant que orchestr_a)
- [ ] Conteneur relance, healthcheck OK
- [ ] Migrations Prisma appliquees (logs du conteneur)
- [ ] Uploads restaures (si applicable)
- [ ] `JWT_SECRET` restaure (si souhaite)

### Verification

- [ ] Health check API : OK
- [ ] Frontend accessible : OK
- [ ] Connexion admin : OK
- [ ] Nombre d'utilisateurs coherent : **\_\_\_\_**
- [ ] Nombre de projets coherent : **\_\_\_\_**
- [ ] Nombre de taches coherent : **\_\_\_\_**
- [ ] Navigation fonctionnelle
- [ ] Acces depuis l'exterieur : OK

### Basculement

- [ ] Ancien serveur arrete
- [ ] DNS mis a jour (si applicable)
- [ ] Backup cron configure sur le nouveau serveur
- [ ] Ancien serveur conserve (decomissionner apres 7 jours)
