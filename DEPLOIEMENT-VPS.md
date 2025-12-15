# Guide de Deploiement VPS - ORCHESTR'A

Ce guide detaille le deploiement d'ORCHESTR'A sur un VPS standard (OVH, Scaleway, DigitalOcean, etc.) pour valider la configuration avant deploiement sur l'infrastructure CNAM.

## Pre-requis

### Configuration minimale du VPS

| Ressource | Minimum | Recommande |
|-----------|---------|------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 Go | 8 Go |
| Stockage | 20 Go SSD | 50 Go SSD |
| OS | Ubuntu 22.04+ ou Debian 11+ | Ubuntu 24.04 LTS |

### Acces requis

- Acces SSH root ou utilisateur avec sudo
- Ports 80 et 443 ouverts
- (Optionnel) Nom de domaine pointe vers l'IP du VPS

---

## Methode 1 : Deploiement automatique (Recommande)

### Etape unique

```bash
# Se connecter au VPS
ssh root@<IP_VPS>

# Telecharger et executer le script
curl -fsSL https://raw.githubusercontent.com/DRSM_IDF/ORCHESTRA/main/scripts/deploy-vps.sh -o deploy.sh
chmod +x deploy.sh

# Deploiement simple (sans SSL)
./deploy.sh

# Deploiement avec domaine et SSL
./deploy.sh --domain orchestr-a.mondomaine.fr --enable-ssl
```

### Options du script

| Option | Description | Exemple |
|--------|-------------|---------|
| `--domain` | Nom de domaine | `--domain app.example.com` |
| `--enable-ssl` | Activer Let's Encrypt | `--enable-ssl` |
| `--repo` | URL du depot Git | `--repo https://github.com/user/repo.git` |
| `--db-password` | Mot de passe PostgreSQL | `--db-password MonMdp123!` |
| `--jwt-secret` | Secret JWT | `--jwt-secret MaCleSecrete...` |
| `--skip-deps` | Ne pas installer les dependances | `--skip-deps` |
| `--api-port` | Port de l'API | `--api-port 4000` |
| `--frontend-port` | Port du frontend | `--frontend-port 3000` |

### Exemples de deploiement

```bash
# Deploiement minimal pour test
./deploy.sh

# Deploiement production avec SSL
./deploy.sh --domain orchestr-a.mondomaine.fr --enable-ssl

# Deploiement avec parametres personnalises
./deploy.sh \
  --domain orchestr-a.mondomaine.fr \
  --enable-ssl \
  --db-password "MonMotDePasseSecurise123!" \
  --api-port 4000 \
  --frontend-port 3000
```

---

## Methode 2 : Deploiement manuel

### 1. Preparation du serveur

```bash
# Mise a jour du systeme
apt update && apt upgrade -y

# Installation des dependances
apt install -y curl wget git build-essential ca-certificates gnupg ufw

# Installation de Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Installation de Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Installation de pnpm
npm install -g pnpm@9

# Installation de Nginx
apt install -y nginx
systemctl enable nginx
```

### 2. Clonage du projet

```bash
cd /opt
git clone https://gitlab.ersm-idf.cnamts.fr/DRSM_IDF/ORCHESTRA.git
cd ORCHESTRA
```

### 3. Configuration de l'environnement

```bash
# Copier le template
cp .env.production.example .env

# Editer le fichier
vi .env
```

Variables obligatoires a configurer :

```env
# Base de donnees
DATABASE_URL="postgresql://orchestr_a:VOTRE_MOT_DE_PASSE@localhost:5432/orchestr_a_prod"
POSTGRES_USER=orchestr_a
POSTGRES_PASSWORD=VOTRE_MOT_DE_PASSE
POSTGRES_DB=orchestr_a_prod

# Securite
JWT_SECRET=VOTRE_CLE_SECRETE_MIN_32_CARACTERES

# URLs (adapter selon votre domaine)
NEXT_PUBLIC_API_URL=https://votredomaine.fr/api
ALLOWED_ORIGINS=https://votredomaine.fr

# Ports
API_PORT=4000
PORT=3000

# Production
NODE_ENV=production
SWAGGER_ENABLED=false
```

### 4. Installation et build

```bash
# Installer les dependances
pnpm install

# Demarrer les services Docker (PostgreSQL, Redis)
docker compose up -d

# Attendre le demarrage
sleep 10

# Generer le client Prisma
cd packages/database
pnpm run db:generate

# Executer les migrations
pnpm run db:migrate:deploy

# Charger les donnees initiales
pnpm run db:seed

# Build de l'application
cd ../..
pnpm run build
```

### 5. Configuration systemd

Creer `/etc/systemd/system/orchestr-a-api.service` :

```ini
[Unit]
Description=ORCHESTR'A API
After=network.target docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ORCHESTRA/apps/api
ExecStart=/usr/bin/node dist/main.js
Restart=on-failure
EnvironmentFile=/opt/ORCHESTRA/.env

[Install]
WantedBy=multi-user.target
```

Creer `/etc/systemd/system/orchestr-a-web.service` :

```ini
[Unit]
Description=ORCHESTR'A Frontend
After=network.target orchestr-a-api.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ORCHESTRA/apps/web
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=on-failure
Environment=PORT=3000
EnvironmentFile=/opt/ORCHESTRA/.env

[Install]
WantedBy=multi-user.target
```

Activer et demarrer :

```bash
systemctl daemon-reload
systemctl enable orchestr-a-api orchestr-a-web
systemctl start orchestr-a-api
systemctl start orchestr-a-web
```

### 6. Configuration Nginx

Creer `/etc/nginx/sites-available/orchestr-a` :

```nginx
upstream api_backend {
    server 127.0.0.1:4000;
}

upstream frontend_backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name votredomaine.fr;

    location /api {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://frontend_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Activer :

```bash
ln -s /etc/nginx/sites-available/orchestr-a /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

### 7. Configuration SSL (optionnel)

```bash
# Avec le script fourni
./scripts/configure-ssl.sh --domain votredomaine.fr

# Ou manuellement avec certbot
apt install -y certbot python3-certbot-nginx
certbot --nginx -d votredomaine.fr --non-interactive --agree-tos --email admin@votredomaine.fr
```

---

## Verification du deploiement

### Tests de base

```bash
# Verifier les services
systemctl status orchestr-a-api
systemctl status orchestr-a-web
systemctl status nginx

# Verifier Docker
docker ps

# Tester l'API
curl http://localhost:4000/api/health

# Tester le frontend
curl http://localhost:3000
```

### Tests depuis l'exterieur

```bash
# Sans SSL
curl http://<IP_VPS>/api/health

# Avec SSL
curl https://votredomaine.fr/api/health
```

### Connexion a l'application

1. Ouvrir `http://<IP_VPS>` ou `https://votredomaine.fr`
2. Se connecter avec :
   - **Login** : `admin`
   - **Mot de passe** : `admin123`
3. **IMPORTANT** : Changer le mot de passe immediatement

---

## Commandes de maintenance

| Action | Commande |
|--------|----------|
| Voir logs API | `journalctl -u orchestr-a-api -f` |
| Voir logs Frontend | `journalctl -u orchestr-a-web -f` |
| Redemarrer API | `systemctl restart orchestr-a-api` |
| Redemarrer Frontend | `systemctl restart orchestr-a-web` |
| Redemarrer tout | `systemctl restart orchestr-a-*` |
| Status complet | `systemctl status orchestr-a-*` |
| Logs Docker | `docker compose logs -f` |
| Backup BDD | `docker exec orchestr-a-db pg_dump -U orchestr_a orchestr_a_prod > backup.sql` |

---

## Mise a jour de l'application

```bash
cd /opt/ORCHESTRA

# Arreter les services
systemctl stop orchestr-a-api orchestr-a-web

# Recuperer les mises a jour
git pull

# Reinstaller les dependances
pnpm install

# Executer les migrations
cd packages/database
pnpm run db:migrate:deploy
cd ../..

# Rebuild
pnpm run build

# Redemarrer
systemctl start orchestr-a-api
systemctl start orchestr-a-web
```

---

## Depannage

### L'API ne demarre pas

```bash
# Verifier les logs
journalctl -u orchestr-a-api -n 50 --no-pager

# Verifier la connexion PostgreSQL
docker exec orchestr-a-db psql -U orchestr_a -d orchestr_a_prod -c "SELECT 1"

# Verifier les variables d'environnement
cat /opt/ORCHESTRA/.env
```

### Le frontend affiche une page blanche

```bash
# Verifier les logs
journalctl -u orchestr-a-web -n 50 --no-pager

# Verifier que le build existe
ls -la /opt/ORCHESTRA/apps/web/.next/standalone/
```

### Erreur 502 Bad Gateway

```bash
# Verifier que les services sont actifs
systemctl status orchestr-a-api
systemctl status orchestr-a-web

# Verifier Nginx
nginx -t
tail -f /var/log/nginx/orchestr-a-error.log
```

### Probleme de certificat SSL

```bash
# Verifier le certificat
certbot certificates

# Renouveler manuellement
certbot renew --dry-run
certbot renew
```

---

## Checklist de validation

Apres deploiement, verifier :

- [ ] L'API repond sur `/api/health`
- [ ] Le frontend s'affiche correctement
- [ ] La connexion admin fonctionne
- [ ] Le mot de passe admin a ete change
- [ ] Les services redemarrent apres reboot (`systemctl enable`)
- [ ] Le pare-feu est configure (ports 22, 80, 443 uniquement)
- [ ] Les sauvegardes sont configurees
- [ ] SSL est actif (si domaine configure)
- [ ] Les logs sont accessibles

---

## Fichiers de reference

| Fichier | Description |
|---------|-------------|
| `scripts/deploy-vps.sh` | Script de deploiement automatique |
| `scripts/configure-ssl.sh` | Configuration SSL separee |
| `scripts/pre-deploy-check.sh` | Verification pre-deploiement |
| `NOTE-HEBERGEMENT-CNAM.md` | Documentation CNAM specifique |
| `CHECKLIST-SYNC-SERVEUR.md` | Checklist de synchronisation |

---

*Document genere le 12/12/2025*
