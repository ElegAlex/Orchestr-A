# Note d'accompagnement pour l'hebergement
## Application ORCHESTR'A V2

**Version** : 2.0.0
**Date** : Decembre 2025
**Destinataire** : Equipe hebergement / Infrastructure
**Emetteur** : Direction Regionale du Service Medical Ile-de-France (DRSM IDF)

---

## 1. Presentation de l'application

**ORCHESTR'A** est une application web de gestion de projets et de ressources humaines destinee aux collectivites territoriales et services de l'Assurance Maladie.

### Fonctionnalites principales

- Gestion de projets et suivi des taches
- Gestion des conges et absences
- Suivi du teletravail
- Gestion des competences
- Tableau de bord analytique
- Suivi du temps de travail

### Architecture technique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Frontend | Next.js (React) | 16.x |
| Backend API | NestJS (Node.js) | 11.x |
| Base de donnees | PostgreSQL | 18.x |
| Cache | Redis | 7.4.x |
| ORM | Prisma | 6.x |
| Conteneurisation | Docker / Docker Compose | 24.x+ |

---

## 2. Prerequisites serveur

### 2.1 Configuration materielle minimale

| Ressource | Minimum | Recommande |
|-----------|---------|------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 Go | 8 Go |
| Stockage | 20 Go SSD | 50 Go SSD |
| OS | Debian 11+ / Ubuntu 22.04+ / RHEL 8+ | - |

### 2.2 Logiciels requis

| Logiciel | Version minimale | Verification |
|----------|------------------|--------------|
| Node.js | 22.x | `node --version` |
| pnpm | 9.x | `pnpm --version` |
| Docker | 24.x | `docker --version` |
| Docker Compose | 2.x (plugin) | `docker compose version` |
| Git | 2.x | `git --version` |

### 2.3 Installation des prerequisites (si necessaire)

```bash
# Node.js via nvm (recommande)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22

# pnpm
npm install -g pnpm@9

# Docker (Debian/Ubuntu)
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
```

---

## 3. Configuration reseau

### 3.1 Ports utilises

| Service | Port interne | Port expose | Protocole | Description |
|---------|--------------|-------------|-----------|-------------|
| API NestJS | 4000 | Configurable | HTTP/HTTPS | Backend REST API |
| Frontend Next.js | 3000 | Configurable | HTTP/HTTPS | Interface utilisateur |
| PostgreSQL | 5432 | 5432 (local) | TCP | Base de donnees |
| Redis | 6379 | 6379 (local) | TCP | Cache applicatif |
| Nginx (optionnel) | 80/443 | 80/443 | HTTP/HTTPS | Reverse proxy |

### 3.2 Configuration proxy (environnement CNAM)

En environnement Assurance Maladie, la configuration du proxy est necessaire pour que Docker puisse telecharger les images depuis les registres externes.

**Creer le fichier de configuration systemd pour Docker :**

```bash
mkdir -p /etc/systemd/system/docker.service.d
cat > /etc/systemd/system/docker.service.d/http-proxy.conf << 'EOF'
[Service]
Environment="HTTP_PROXY=http://<ADRESSE_PROXY>:<PORT_PROXY>"
Environment="HTTPS_PROXY=http://<ADRESSE_PROXY>:<PORT_PROXY>"
Environment="NO_PROXY=localhost,127.0.0.1,host.docker.internal,.cnamts.fr,.ramage"
EOF

# Recharger la configuration
systemctl daemon-reload
systemctl restart docker
```

> **Note** : Remplacer `<ADRESSE_PROXY>` et `<PORT_PROXY>` par les valeurs fournies par l'equipe reseau locale.

### 3.3 Flux reseau requis

| Source | Destination | Port | Usage |
|--------|-------------|------|-------|
| Serveur | registry-1.docker.io | 443 | Telechargement images Docker |
| Serveur | registry.npmjs.org | 443 | Telechargement packages npm |
| Utilisateurs | Serveur | 80/443 | Acces application |
| Serveur | Serveur SMTP (si configure) | 25/587 | Envoi notifications email |

---

## 4. Procedure d'installation

### 4.1 Recuperation du code source

```bash
# Depuis le depot GitLab CNAM
cd /opt
git clone https://gitlab.ersm-idf.cnamts.fr/DRSM_IDF/ORCHESTRA.git
cd ORCHESTRA
```

### 4.2 Configuration de l'environnement

**Creer le fichier `.env` a la racine du projet :**

```bash
cp .env.production.example .env
vi .env
```

**Variables a configurer obligatoirement :**

```env
# === BASE DE DONNEES ===
DATABASE_URL="postgresql://<UTILISATEUR>:<MOT_DE_PASSE>@localhost:5432/<NOM_BDD>"
POSTGRES_USER=<UTILISATEUR>
POSTGRES_PASSWORD=<MOT_DE_PASSE>
POSTGRES_DB=<NOM_BDD>

# === SECURITE ===
JWT_SECRET=<CLE_SECRETE_MIN_32_CARACTERES>
JWT_EXPIRES_IN=8h

# === API ===
API_PORT=4000
NODE_ENV=production
SWAGGER_ENABLED=false

# === FRONTEND ===
NEXT_PUBLIC_API_URL=https://<NOM_DOMAINE>/api

# === CORS ===
ALLOWED_ORIGINS=https://<NOM_DOMAINE>
```

> **IMPORTANT** :
> - Generer un `JWT_SECRET` robuste : `openssl rand -base64 48`
> - Ne jamais commiter le fichier `.env` dans Git
> - Utiliser des mots de passe forts pour la base de donnees

### 4.3 Demarrage des services

```bash
# 1. Installer les dependances
pnpm install

# 2. Demarrer les conteneurs Docker (PostgreSQL, Redis)
docker compose up -d

# 3. Verifier que les conteneurs sont operationnels
docker ps

# 4. Executer les migrations de base de donnees
cd packages/database
pnpm run db:migrate:deploy
pnpm run db:generate

# 5. (Optionnel) Charger les donnees initiales
pnpm run db:seed

# 6. Revenir a la racine et construire l'application
cd ../..
pnpm run build

# 7. Demarrer l'application
pnpm run start
```

### 4.4 Verification du deploiement

```bash
# Verifier l'API
curl http://localhost:4000/api/health

# Verifier le frontend
curl http://localhost:3000
```

---

## 5. Configuration reverse proxy (Nginx)

Pour un deploiement en production, il est recommande d'utiliser un reverse proxy.

**Exemple de configuration Nginx :**

```nginx
server {
    listen 80;
    server_name <NOM_DOMAINE>;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name <NOM_DOMAINE>;

    ssl_certificate /etc/nginx/ssl/orchestr-a.crt;
    ssl_certificate_key /etc/nginx/ssl/orchestr-a.key;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API
    location /api {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 6. Maintenance et exploitation

### 6.1 Commandes utiles

| Action | Commande |
|--------|----------|
| Voir les logs API | `docker compose logs -f api` |
| Voir les logs complets | `docker compose logs -f` |
| Redemarrer l'API | `docker compose restart api` |
| Arreter tous les services | `docker compose down` |
| Sauvegarder la BDD | `docker exec orchestr-a-db pg_dump -U <USER> <BDD> > backup.sql` |
| Restaurer la BDD | `docker exec -i orchestr-a-db psql -U <USER> <BDD> < backup.sql` |

### 6.2 Sauvegardes

Un script de sauvegarde automatique est fourni :

```bash
# Sauvegarde manuelle
./scripts/backup-database.sh

# Configuration cron (quotidien a 2h)
./scripts/setup-cron-backup.sh
```

Les sauvegardes sont stockees dans le repertoire `./backups/` avec une retention de 5 jours.

### 6.3 Verification pre-deploiement

Un script de verification est disponible :

```bash
pnpm run pre-deploy
```

Ce script verifie :
- Les prerequisites systeme (Node.js, pnpm, Docker)
- La presence et validite des fichiers de configuration
- L'etat des conteneurs Docker
- La configuration de la base de donnees

---

## 7. Comptes utilisateurs par defaut

Apres le seed initial, un compte administrateur est cree :

| Champ | Valeur |
|-------|--------|
| Login | `admin` |
| Mot de passe | `admin123` |
| Email | `admin@orchestr-a.internal` |
| Role | `ADMIN` |

> **IMPORTANT** : Modifier le mot de passe administrateur immediatement apres la premiere connexion.

---

## 8. Securite

### 8.1 Recommandations

- [ ] Modifier le mot de passe admin par defaut
- [ ] Configurer HTTPS avec certificats valides
- [ ] Restreindre l'acces aux ports PostgreSQL et Redis (localhost uniquement)
- [ ] Configurer un pare-feu (ufw/firewalld)
- [ ] Activer les logs d'acces
- [ ] Mettre en place une politique de sauvegarde

### 8.2 Fichiers sensibles (ne pas commiter)

```
.env
.env.production
*.key
*.pem
backups/
```

---

## 9. Support et contacts

| Type | Contact |
|------|---------|
| Depot source | https://gitlab.ersm-idf.cnamts.fr/DRSM_IDF/ORCHESTRA |
| Documentation technique | `./INDEX-DOCUMENTATION.md` |
| Guide de deploiement | `./DEPLOYMENT.md` |
| Equipe projet | DRSM Ile-de-France |

---

## 10. Historique des versions

| Version | Date | Modifications |
|---------|------|---------------|
| 2.0.0 | Decembre 2025 | Version initiale monorepo (NestJS + Next.js) |

---

*Document genere le 12/12/2025*
