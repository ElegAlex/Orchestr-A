# Déploiement Orchestr-A sur VPS OVH

## Informations serveur

| Élément           | Valeur                                      |
| ----------------- | ------------------------------------------- |
| VPS               | vps-69b63bbf.vps.ovh.net                    |
| IPv4              | 92.222.35.25                                |
| IPv6              | 2001:41d0:404:200::42a                      |
| Domaine           | orchestr-a.com (DNS configuré ✓)            |
| OS                | Debian 12 - Docker (image OVH préinstallée) |
| Utilisateur SSH   | debian (pas root)                           |
| Mot de passe      | Serveur2025abc                              |

> **Note importante** : L'image OVH "Debian 12 - Docker" crée un utilisateur `debian` avec sudo, pas `root` directement.

## Informations projet

| Élément | Valeur |
|---------|--------|
| Repo local | `/home/alex/Documents/REPO/ORCHESTRA/` |
| GitHub | https://github.com/ElegAlex/Orchestr-A |
| Stack | Monorepo pnpm + Turborepo |
| Backend | NestJS 11 + Fastify 5 + Prisma 6 |
| Frontend | Next.js 16 + React 19 |
| BDD | PostgreSQL 18 + Redis 7.4 |
| Infra | Docker (PostgreSQL/Redis) + systemd (API/Web) + Nginx |

## Architecture déployée

```
┌─────────────────────────────────────────────────────────────┐
│                         NGINX (80/443)                       │
│                    Reverse Proxy + SSL                       │
└─────────────────────┬───────────────────┬───────────────────┘
                      │                   │
              /api/*  │                   │  /*
                      ▼                   ▼
         ┌────────────────────┐  ┌────────────────────┐
         │   API NestJS       │  │  Frontend Next.js  │
         │   (systemd:4000)   │  │  (systemd:3000)    │
         └─────────┬──────────┘  └────────────────────┘
                   │
         ┌─────────┴──────────┐
         ▼                    ▼
┌─────────────────┐  ┌─────────────────┐
│   PostgreSQL    │  │     Redis       │
│  (Docker:5432)  │  │  (Docker:6379)  │
└─────────────────┘  └─────────────────┘
```

---

## ÉTAPE 0 : Réinstallation VPS (si nécessaire)

Dans l'interface OVH (https://www.ovh.com/manager/) :

1. Bare Metal Cloud > VPS > `vps-69b63bbf.vps.ovh.net`
2. Onglet "Accueil" > "Réinstaller mon VPS"
3. Choisir **Debian 12 - Docker**
4. **Noter le mot de passe fourni par OVH**
5. Attendre ~5 minutes

---

## ÉTAPE 1 : Première connexion SSH

### 1.1 Connexion et changement de mot de passe

```bash
ssh debian@92.222.35.25
```

> **Attention** : OVH force un changement de mot de passe à la première connexion.
> Entrez l'ancien mot de passe OVH, puis votre nouveau mot de passe deux fois.

### 1.2 Supprimer l'ancienne empreinte SSH (si réinstallation)

Si vous avez l'erreur "REMOTE HOST IDENTIFICATION HAS CHANGED", exécutez d'abord :

```bash
ssh-keygen -f ~/.ssh/known_hosts -R 92.222.35.25
```

### 1.3 Installation de rsync sur le serveur

```bash
sudo apt update && sudo apt install -y rsync git curl
```

---

## ÉTAPE 2 : Déploiement du code

### Option A : Via rsync (recommandé - depuis la machine locale)

```bash
# Synchroniser le code local vers le VPS
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.next' \
  --exclude 'dist' \
  --exclude '.env' \
  --exclude '.turbo' \
  /home/alex/Documents/REPO/ORCHESTRA/ \
  debian@92.222.35.25:/tmp/orchestra-deploy/

# Déplacer vers /opt/orchestra
ssh debian@92.222.35.25 "sudo rm -rf /opt/orchestra && sudo mv /tmp/orchestra-deploy /opt/orchestra && sudo chown -R debian:debian /opt/orchestra"
```

### Option B : Via git clone (sur le serveur)

```bash
ssh debian@92.222.35.25 "sudo git clone https://github.com/ElegAlex/Orchestr-A.git /opt/orchestra && sudo chown -R debian:debian /opt/orchestra"
```

---

## ÉTAPE 3 : Configuration de l'environnement

### 3.1 Créer le fichier .env

```bash
ssh debian@92.222.35.25 << 'ENDSSH'
cd /opt/orchestra

# Générer les secrets
DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)
JWT_SECRET=$(openssl rand -base64 48)

cat > .env << EOF
# === BASE DE DONNEES ===
DATABASE_URL="postgresql://orchestr_a:${DB_PASSWORD}@localhost:5432/orchestr_a_prod"
POSTGRES_USER=orchestr_a
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_DB=orchestr_a_prod
POSTGRES_PORT=5432

# === REDIS ===
REDIS_URL="redis://localhost:6379"
REDIS_PORT=6379

# === SECURITE ===
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=8h

# === API ===
API_PORT=4000
API_PREFIX=/api
NODE_ENV=production
SWAGGER_ENABLED=false
ALLOWED_ORIGINS=https://orchestr-a.com

# === FRONTEND ===
NEXT_PUBLIC_API_URL=https://orchestr-a.com/api
PORT=3000

# === LOGS ===
LOG_LEVEL=info
EOF

chmod 600 .env
ln -sf /opt/orchestra/.env /opt/orchestra/packages/database/.env

echo "Mot de passe BDD: ${DB_PASSWORD}"
echo "JWT Secret: ${JWT_SECRET}"
ENDSSH
```

### 3.2 Démarrer PostgreSQL et Redis

```bash
ssh debian@92.222.35.25 "cd /opt/orchestra && sudo docker compose up -d"
```

Vérifier que les containers sont healthy :

```bash
ssh debian@92.222.35.25 "sudo docker ps"
```

---

## ÉTAPE 4 : Installation et build

### 4.1 Installer les dépendances système

```bash
ssh debian@92.222.35.25 << 'ENDSSH'
# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs

# pnpm
sudo npm install -g pnpm@9

# Nginx
sudo apt install -y nginx
sudo systemctl enable nginx
ENDSSH
```

### 4.2 Installer les dépendances Node.js

```bash
ssh debian@92.222.35.25 "cd /opt/orchestra && pnpm install"
```

### 4.3 Migrations et seed

```bash
ssh debian@92.222.35.25 << 'ENDSSH'
cd /opt/orchestra/packages/database
pnpm run db:generate
pnpm run db:migrate:deploy
pnpm run db:seed
ENDSSH
```

### 4.4 Build de l'application

```bash
ssh debian@92.222.35.25 "cd /opt/orchestra && pnpm run build"
```

### 4.5 Copier les fichiers statiques Next.js (IMPORTANT)

Next.js standalone ne copie pas automatiquement les assets. Cette étape est **obligatoire** :

```bash
ssh debian@92.222.35.25 << 'ENDSSH'
cd /opt/orchestra/apps/web
cp -r .next/static .next/standalone/apps/web/.next/static
cp -r public .next/standalone/apps/web/public 2>/dev/null || true
ENDSSH
```

> **Note** : Sans cette copie, les fichiers CSS/JS retournent une erreur 404 ou un mauvais MIME type.

---

## ÉTAPE 5 : Configuration des services systemd

### 5.1 Créer le service API

```bash
ssh debian@92.222.35.25 << 'ENDSSH'
sudo tee /etc/systemd/system/orchestr-a-api.service > /dev/null << 'EOF'
[Unit]
Description=ORCHESTR'A API (NestJS)
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=debian
WorkingDirectory=/opt/orchestra/apps/api
ExecStart=/usr/bin/node dist/src/main.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/opt/orchestra/.env

[Install]
WantedBy=multi-user.target
EOF
ENDSSH
```

> **Note** : Le chemin est `dist/src/main.js` (pas `dist/main.js`) car NestJS place les fichiers compilés dans `dist/src/`.

### 5.2 Créer le service Frontend

```bash
ssh debian@92.222.35.25 << 'ENDSSH'
sudo tee /etc/systemd/system/orchestr-a-web.service > /dev/null << 'EOF'
[Unit]
Description=ORCHESTR'A Frontend (Next.js)
After=network.target orchestr-a-api.service

[Service]
Type=simple
User=debian
WorkingDirectory=/opt/orchestra/apps/web/.next/standalone/apps/web
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/opt/orchestra/.env

[Install]
WantedBy=multi-user.target
EOF
ENDSSH
```

> **Note** : Le `WorkingDirectory` doit pointer vers le dossier standalone pour que Next.js trouve les fichiers statiques.

### 5.3 Activer et démarrer les services

```bash
ssh debian@92.222.35.25 << 'ENDSSH'
sudo systemctl daemon-reload
sudo systemctl enable orchestr-a-api orchestr-a-web
sudo systemctl start orchestr-a-api
sleep 5
sudo systemctl start orchestr-a-web
ENDSSH
```

---

## ÉTAPE 6 : Configuration Nginx

### 6.1 Créer la configuration

```bash
ssh debian@92.222.35.25 << 'ENDSSH'
sudo tee /etc/nginx/sites-available/orchestr-a > /dev/null << 'EOF'
upstream api_backend {
    server 127.0.0.1:4000;
    keepalive 32;
}

upstream frontend_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name orchestr-a.com www.orchestr-a.com;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    access_log /var/log/nginx/orchestr-a-access.log;
    error_log /var/log/nginx/orchestr-a-error.log;

    location /api {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 300s;
    }

    location / {
        proxy_pass http://frontend_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /health {
        access_log off;
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/orchestr-a /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
ENDSSH
```

### 6.2 Configurer SSL avec Let's Encrypt

```bash
ssh debian@92.222.35.25 << 'ENDSSH'
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d orchestr-a.com -d www.orchestr-a.com --non-interactive --agree-tos --email admin@orchestr-a.com --redirect
ENDSSH
```

---

## ÉTAPE 7 : Configuration du firewall

```bash
ssh debian@92.222.35.25 << 'ENDSSH'
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw --force enable
ENDSSH
```

---

## Vérification du déploiement

```bash
# Status des services
ssh debian@92.222.35.25 "sudo systemctl status orchestr-a-api orchestr-a-web --no-pager"

# Containers Docker
ssh debian@92.222.35.25 "sudo docker ps"

# Test API
ssh debian@92.222.35.25 "curl -s http://localhost:4000/api/health"

# Test HTTPS
curl -I https://orchestr-a.com
```

---

## Commandes de maintenance

### Mise à jour du code (depuis la machine locale)

```bash
# Sync et rebuild
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude '.next' --exclude 'dist' --exclude '.env' --exclude '.turbo' \
  /home/alex/Documents/REPO/ORCHESTRA/ \
  debian@92.222.35.25:/opt/orchestra/

# Rebuild et copie des assets statiques
ssh debian@92.222.35.25 << 'ENDSSH'
cd /opt/orchestra
pnpm install
pnpm run build
cd apps/web
cp -r .next/static .next/standalone/apps/web/.next/static
cp -r public .next/standalone/apps/web/public 2>/dev/null || true
sudo systemctl restart orchestr-a-api orchestr-a-web
ENDSSH
```

### Voir les logs

```bash
# Logs API
ssh debian@92.222.35.25 "sudo journalctl -u orchestr-a-api -f"

# Logs Frontend
ssh debian@92.222.35.25 "sudo journalctl -u orchestr-a-web -f"

# Logs Nginx
ssh debian@92.222.35.25 "sudo tail -f /var/log/nginx/orchestr-a-*.log"
```

### Gestion des services

```bash
# Redémarrer
ssh debian@92.222.35.25 "sudo systemctl restart orchestr-a-api orchestr-a-web"

# Arrêter
ssh debian@92.222.35.25 "sudo systemctl stop orchestr-a-api orchestr-a-web"

# Démarrer
ssh debian@92.222.35.25 "sudo systemctl start orchestr-a-api orchestr-a-web"
```

### Docker (PostgreSQL + Redis)

```bash
# Status
ssh debian@92.222.35.25 "sudo docker ps"

# Logs
ssh debian@92.222.35.25 "sudo docker logs orchestr-a-db -f"
ssh debian@92.222.35.25 "sudo docker logs orchestr-a-redis -f"

# Redémarrer
ssh debian@92.222.35.25 "sudo docker restart orchestr-a-db orchestr-a-redis"
```

### Backup base de données

```bash
ssh debian@92.222.35.25 "sudo docker exec orchestr-a-db pg_dump -U orchestr_a orchestr_a_prod > /opt/orchestra/backups/backup-\$(date +%Y%m%d-%H%M%S).sql"
```

### Migrations Prisma

```bash
ssh debian@92.222.35.25 "cd /opt/orchestra/packages/database && pnpm run db:migrate:deploy"
```

---

## Fichiers importants

| Fichier | Description |
|---------|-------------|
| `/opt/orchestra/.env` | Configuration environnement |
| `/etc/systemd/system/orchestr-a-api.service` | Service API |
| `/etc/systemd/system/orchestr-a-web.service` | Service Web |
| `/etc/nginx/sites-available/orchestr-a` | Config Nginx |
| `/var/log/nginx/orchestr-a-*.log` | Logs Nginx |

---

## Identifiants par défaut

- **Email** : `admin@orchestr-a.internal`
- **Mot de passe** : `admin123`

**Changer ce mot de passe immédiatement en production !**

---

## Dépannage

### L'API ne démarre pas

```bash
ssh debian@92.222.35.25 "sudo journalctl -u orchestr-a-api -n 50 --no-pager"
```

Erreurs courantes :
- `Cannot find module dist/main.js` → Le chemin correct est `dist/src/main.js`
- `ECONNREFUSED` sur PostgreSQL → Vérifier que le container Docker est running

### Le Frontend ne démarre pas

```bash
ssh debian@92.222.35.25 "sudo journalctl -u orchestr-a-web -n 50 --no-pager"
```

### Les fichiers CSS/JS retournent 404 ou mauvais MIME type

Ce problème survient si les fichiers statiques n'ont pas été copiés après le build :

```bash
ssh debian@92.222.35.25 << 'ENDSSH'
cd /opt/orchestra/apps/web
cp -r .next/static .next/standalone/apps/web/.next/static
cp -r public .next/standalone/apps/web/public 2>/dev/null || true
sudo systemctl restart orchestr-a-web
ENDSSH
```

Vérifier également que le `WorkingDirectory` du service pointe vers `/opt/orchestra/apps/web/.next/standalone/apps/web` (pas `/opt/orchestra/apps/web`).

### Nginx ne répond pas

```bash
ssh debian@92.222.35.25 "sudo nginx -t && sudo systemctl status nginx"
```

### Reset complet

```bash
ssh debian@92.222.35.25 << 'ENDSSH'
sudo systemctl stop orchestr-a-api orchestr-a-web
sudo docker restart orchestr-a-db orchestr-a-redis
sleep 5
sudo systemctl start orchestr-a-api orchestr-a-web
ENDSSH
```
