# Audit - Deploiement Docker All-in-One

> Date : 2026-02-17
> Scope : fichiers docker-compose, Dockerfiles, workflows CI/CD, scripts, documentation

---

## 1. Fichiers docker-compose

| Fichier                         | Usage                    | Services                                  | Mode                    |
| ------------------------------- | ------------------------ | ----------------------------------------- | ----------------------- |
| `docker-compose.yml`            | Dev local                | postgres, redis                           | Pull registry           |
| `docker-compose.prod.yml`       | Prod (build from source) | postgres, redis, api, web, nginx, certbot | Build local (api + web) |
| `docker-compose.standalone.yml` | Prod cle en main         | postgres, redis, api, web                 | Pull registry (ghcr.io) |

### docker-compose.yml (dev)

- 2 services infra : `postgres:18-alpine`, `redis:7.4-alpine`
- Ports exposes en dur (5432, 6379)
- Volumes nommes pour persistance
- Reseau bridge `orchestr-a-network`

### docker-compose.prod.yml (prod build local)

- 6 services :
  - `postgres` — `image: postgres:18-alpine`, expose interne, scram-sha-256, resource limits (2 CPU / 2G)
  - `redis` — `image: redis:7.4-alpine`, requirepass, maxmemory 256mb, limits (1 CPU / 512M)
  - `api` — **`build: ./apps/api/Dockerfile`**, expose interne :4000, healthcheck wget, limits (2 CPU / 1G)
  - `web` — **`build: ./apps/web/Dockerfile`**, expose interne :3000, `API_URL: http://api:4000`, limits (1 CPU / 512M)
  - `nginx` — `image: nginx:1.27-alpine`, ports 80/443 exposes, volumes SSL certbot
  - `certbot` — `image: certbot/certbot:latest`, renouvellement auto toutes les 12h
- Logging json-file avec rotation sur tous les services
- Depends_on avec condition: service_healthy

### docker-compose.standalone.yml (prod pre-build)

- 4 services :
  - `postgres` — `image: postgres:18-alpine`
  - `redis` — `image: redis:7.4-alpine`
  - `api` — **`image: ghcr.io/${GITHUB_OWNER:-elegalex}/orchestr-a-api:${VERSION:-latest}`**
  - `web` — **`image: ghcr.io/${GITHUB_OWNER:-elegalex}/orchestr-a-web:${VERSION:-latest}`**
- Ports api (4000) et web (3000) exposes directement (pas de nginx)
- Pas de resource limits, pas de logging configure

---

## 2. References ghcr.io/elegalex

| Fichier                                | Contexte                                                  |
| -------------------------------------- | --------------------------------------------------------- |
| `docker-compose.standalone.yml`        | Images api + web (via `$GITHUB_OWNER` default `elegalex`) |
| `docs/QUICK-DEPLOY.md`                 | Doc all-in-one `ghcr.io/elegalex/orchestr-a:latest`       |
| `README.md`                            | Meme reference all-in-one                                 |
| `.github/workflows/docker-publish.yml` | Push vers ghcr.io (3 images)                              |

### 3 images GHCR prevues

- `ghcr.io/elegalex/orchestr-a-api` — image API NestJS standalone
- `ghcr.io/elegalex/orchestr-a-web` — image Web Next.js standalone
- `ghcr.io/elegalex/orchestr-a` — image all-in-one (supervisord: postgres + redis + api + web + nginx)

---

## 3. Dockerfiles

| Dockerfile                     | Base           | Stages                                  | Contenu                                                                |
| ------------------------------ | -------------- | --------------------------------------- | ---------------------------------------------------------------------- |
| `apps/api/Dockerfile`          | node:22-alpine | 2 (builder + prod)                      | Build NestJS, prisma generate, entrypoint avec migrations auto         |
| `apps/web/Dockerfile`          | node:22-alpine | 3 (deps + builder + prod)               | Build Next.js standalone, user non-root `nextjs`                       |
| `docker/all-in-one/Dockerfile` | ubuntu:24.04   | 3 (api-builder + web-builder + runtime) | Installe postgres, redis, nginx, node, supervisor dans une seule image |

### All-in-one : fichiers de support (`docker/all-in-one/`)

- `entrypoint.sh` — init PostgreSQL, Redis, migrations Prisma, seed
- `supervisord.conf` — gestion des processus (postgres, redis, api, web, nginx)
- `nginx.conf` — reverse proxy interne (different de `nginx/nginx.conf`)
- `healthcheck.sh` — verification de sante des services internes

---

## 4. Workflows CI/CD

### docker-publish.yml

- Declenchement : tags `v*`, releases, ou workflow_dispatch
- Build et push 3 images vers ghcr.io :
  - `orchestr-a-api` (matrix: apps/api/Dockerfile)
  - `orchestr-a-web` (matrix: apps/web/Dockerfile)
  - `orchestr-a` (all-in-one: docker/all-in-one/Dockerfile)
- Plateformes : linux/amd64 + linux/arm64
- Cache GHA active

### deploy.yml

- Declenchement : apres succes de CI/CD Pipeline sur master, ou workflow_dispatch
- **Stub incomplet** : login registry commente, deploy SSH commente
- Ne fait que build local + save artifact, pas de vrai deploiement
- Mentionne port `3001` dans le health check (incorrect, devrait etre `4000`)

---

## 5. Documentation de deploiement

| Fichier                | Contenu                                                                                       | Cible             |
| ---------------------- | --------------------------------------------------------------------------------------------- | ----------------- |
| `DEPLOYMENT.md`        | Guide complet prod via `docker-compose.prod.yml` (build local), 362 lignes                    | Ops / sysadmin    |
| `docs/QUICK-DEPLOY.md` | Guide rapide : Option 1 = all-in-one `docker run`, Option 2 = `docker-compose.standalone.yml` | Utilisateur final |
| `install.sh`           | Script curl-pipe-bash : telecharge standalone compose, genere secrets, lance services         | Utilisateur final |
| `DOCKER-DEPLOY.md`     | (a verifier si doublon)                                                                       | —                 |

---

## 6. .env.production.example

4 secrets requis :

- `DATABASE_PASSWORD` (min 16 chars)
- `REDIS_PASSWORD` (min 16 chars)
- `JWT_SECRET` (min 32 chars)
- `CORS_ORIGIN` (URL domaine prod)

Defaults raisonnables pour le reste. Noms de variables coherents avec `deploy-production.sh` (qui fait `source .env.production`).

Note : les noms de variables different entre `.env.production.example` (`DATABASE_PASSWORD`, `DATABASE_NAME`, `DATABASE_USER`) et `docker-compose.standalone.yml` (`POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_USER`). C'est voulu : le standalone a ses propres conventions.

---

## 7. Scripts

| Script                         | Role                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `deploy-production.sh`         | Deploy prod complet (checks, backup, build, migrate, seed, nginx) via `docker-compose.prod.yml` |
| `scripts/deploy-production.sh` | Probablement doublon du precedent                                                               |
| `scripts/deploy-vps.sh`        | Deploy VPS                                                                                      |
| `scripts/init-env.sh`          | Generation `.env.production` avec secrets aleatoires                                            |
| `scripts/configure-ssl.sh`     | Configuration SSL/certbot                                                                       |
| `scripts/init-ssl.sh`          | Init certificats SSL                                                                            |
| `scripts/health-check.sh`      | Healthcheck des services                                                                        |
| `scripts/backup-database.sh`   | Backup PostgreSQL                                                                               |
| `scripts/restore-database.sh`  | Restore PostgreSQL                                                                              |
| `scripts/setup-cron-backup.sh` | Cron de backup auto                                                                             |
| `scripts/pre-deploy-check.sh`  | Verifications pre-deploy                                                                        |
| `scripts/orchestr-a-cli.sh`    | CLI management                                                                                  |
| `scripts/test-ci-locally.sh`   | Test CI en local                                                                                |

---

## 8. Problemes et observations

### Incoherences

1. **`deploy.yml` port 3001** — Le health check mentionne `http://your-domain:3001/health`, devrait etre `4000`. Ce workflow est un stub de toute facon.

2. **`deploy.yml` est un stub** — Login registry commente, deploy SSH commente, ne fait que build + save artifact. Pas de vrai deploiement automatise.

3. **nginx.conf hardcode `orchestr-a.com`** — Le fichier `nginx/nginx.conf` a `server_name orchestr-a.com www.orchestr-a.com` et les chemins de certificats SSL en dur. Pas parametrable via env.

4. **standalone vs all-in-one** — `docker-compose.standalone.yml` utilise 2 images separees (`orchestr-a-api` + `orchestr-a-web`) sans nginx. La doc `QUICK-DEPLOY.md` propose aussi l'image all-in-one `orchestr-a:latest` avec `docker run`, mais il n'y a pas de docker-compose pour l'all-in-one.

### Images GHCR potentiellement absentes

`docker-publish.yml` se declenche sur tags `v*` ou release. Si aucun tag n'a ete pousse, les images n'existent pas sur ghcr.io, rendant `docker-compose.standalone.yml` et `install.sh` non fonctionnels au `docker compose pull`.

### Double proxy API en prod (docker-compose.prod.yml)

Avec le nouveau route handler `app/api/[...path]/route.ts`, il y a potentiellement 2 niveaux de proxy pour `/api` :

```
nginx ──location /api──> api:4000  (direct, via nginx.conf)
nginx ──location /──> web:3000 ──route handler──> api:4000  (indirect)
```

En pratique, `nginx.conf` a un `location /api` qui proxye directement vers `api_backend` (api:4000), donc le route handler Next.js n'est pas utilise dans la config prod avec nginx. Le route handler est utile pour :

- Le mode dev (pas de nginx)
- Le mode CI (`next start` sans nginx)
- Le mode standalone (pas de nginx)

Ce n'est pas un bug, mais c'est a documenter.
