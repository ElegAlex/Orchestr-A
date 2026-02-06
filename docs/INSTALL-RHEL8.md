# Orchestr'A V2 — Guide d'installation sur RHEL 8.10

|                         |                               |
| ----------------------- | ----------------------------- |
| **Version du document** | 1.0.0                         |
| **Date**                | 2026-02-05                    |
| **Auteur**              | Equipe Orchestr'A             |
| **Application**         | Orchestr'A V2                 |
| **Cible**               | Red Hat Enterprise Linux 8.10 |

---

## Prerequis

### Materiel minimum

| Ressource | Minimum          | Recommande | Notes                           |
| --------- | ---------------- | ---------- | ------------------------------- |
| CPU       | 2 vCPU           | 4 vCPU     | Build Docker gourmand en CPU    |
| RAM       | 4 Go             | 8 Go       | PostgreSQL + Node.js + Nginx    |
| Disque    | 20 Go            | 50 Go      | Images Docker ~5 Go + donnees   |
| Reseau    | 1 Gbps           | 1 Gbps     | Acces Internet pour pull images |
| DNS       | Enregistrement A | A + AAAA   | Pointe vers l'IP du serveur     |

### Compatibilite testee

| Composant        | Version     |
| ---------------- | ----------- |
| RHEL             | 8.10        |
| Docker CE        | 27.x        |
| Docker Compose   | v2 (plugin) |
| Node.js (images) | 22-alpine   |
| PostgreSQL       | 18-alpine   |
| Redis            | 7.4-alpine  |
| Nginx            | 1.27-alpine |

---

## Table des matieres

- [1. Preparation du systeme RHEL 8.10](#1-preparation-du-systeme-rhel-810)
  - [1.1 Mise a jour du systeme](#11-mise-a-jour-du-systeme)
  - [1.2 Suppression de Podman et Buildah](#12-suppression-de-podman-et-buildah)
  - [1.3 Installation des dependances systeme](#13-installation-des-dependances-systeme)
  - [1.4 Configuration du hostname](#14-configuration-du-hostname)
  - [1.5 Configuration du pare-feu (firewalld)](#15-configuration-du-pare-feu-firewalld)
  - [1.6 Configuration de SELinux](#16-configuration-de-selinux)
  - [1.7 Synchronisation NTP](#17-synchronisation-ntp)
  - [1.8 Creation d'un utilisateur dedie](#18-creation-dun-utilisateur-dedie)
- [2. Installation de Docker CE](#2-installation-de-docker-ce)
  - [2.1 Ajout du depot Docker CE](#21-ajout-du-depot-docker-ce)
  - [2.2 Installation des paquets](#22-installation-des-paquets)
  - [2.3 Demarrage et activation du service](#23-demarrage-et-activation-du-service)
  - [2.4 Post-installation](#24-post-installation)
  - [2.5 Verification de l'installation](#25-verification-de-linstallation)
  - [2.6 Configuration du daemon Docker](#26-configuration-du-daemon-docker)
- [3. Clonage et preparation du projet](#3-clonage-et-preparation-du-projet)
  - [3.1 Clonage du depot](#31-clonage-du-depot)
  - [3.2 Arborescence du projet](#32-arborescence-du-projet)
  - [3.3 Fonctionnement des Dockerfiles](#33-fonctionnement-des-dockerfiles)
- [4. Configuration de l'environnement](#4-configuration-de-lenvironnement)
  - [4.1 Generation automatique des secrets](#41-generation-automatique-des-secrets)
  - [4.2 Reference des variables d'environnement](#42-reference-des-variables-denvironnement)
  - [4.3 Configuration manuelle](#43-configuration-manuelle)
  - [4.4 Securisation du fichier .env.production](#44-securisation-du-fichier-envproduction)
- [5. Configuration SSL / HTTPS](#5-configuration-ssl--https)
  - [5.1 Option A : Let's Encrypt avec Certbot](#51-option-a--lets-encrypt-avec-certbot)
  - [5.2 Option B : Certificat entreprise / custom](#52-option-b--certificat-entreprise--custom)
  - [5.3 Configuration Nginx](#53-configuration-nginx)
  - [5.4 Renouvellement automatique](#54-renouvellement-automatique)
- [6. Build et demarrage](#6-build-et-demarrage)
  - [6.1 Build des images Docker](#61-build-des-images-docker)
  - [6.2 Lancement de la stack](#62-lancement-de-la-stack)
  - [6.3 Architecture des services](#63-architecture-des-services)
  - [6.4 Initialisation de la base de donnees](#64-initialisation-de-la-base-de-donnees)
  - [6.5 Verification du deploiement](#65-verification-du-deploiement)
- [7. Post-installation](#7-post-installation)
  - [7.1 Changement du mot de passe admin](#71-changement-du-mot-de-passe-admin)
  - [7.2 Creation des premiers utilisateurs](#72-creation-des-premiers-utilisateurs)
  - [7.3 Checklist de premier test fonctionnel](#73-checklist-de-premier-test-fonctionnel)
- [8. Operations courantes](#8-operations-courantes)
  - [8.1 Logs](#81-logs)
  - [8.2 Redemarrage d'un service](#82-redemarrage-dun-service)
  - [8.3 Mise a jour de l'application](#83-mise-a-jour-de-lapplication)
  - [8.4 Backup de la base de donnees](#84-backup-de-la-base-de-donnees)
  - [8.5 Restauration de la base de donnees](#85-restauration-de-la-base-de-donnees)
  - [8.6 Health check](#86-health-check)
- [9. Monitoring et maintenance](#9-monitoring-et-maintenance)
  - [9.1 Surveillance de l'espace disque](#91-surveillance-de-lespace-disque)
  - [9.2 Nettoyage Docker](#92-nettoyage-docker)
  - [9.3 Rotation des logs](#93-rotation-des-logs)
  - [9.4 Surveillance des certificats SSL](#94-surveillance-des-certificats-ssl)
  - [9.5 Mises a jour de securite RHEL](#95-mises-a-jour-de-securite-rhel)
- [10. Troubleshooting](#10-troubleshooting)
- [11. Annexes](#11-annexes)
  - [11.1 Schema d'architecture reseau](#111-schema-darchitecture-reseau)
  - [11.2 Ports utilises](#112-ports-utilises)
  - [11.3 Commandes Docker utiles](#113-commandes-docker-utiles)
  - [11.4 References](#114-references)

---

## 1. Preparation du systeme RHEL 8.10

### 1.1 Mise a jour du systeme

Commencez par appliquer toutes les mises a jour de securite et paquets disponibles. Cela garantit un systeme stable et a jour avant d'installer de nouveaux logiciels.

```bash
sudo dnf update -y
```

Redemarrez si un nouveau noyau a ete installe :

```bash
sudo reboot
```

> **Pourquoi ?** Les mises a jour du noyau ne sont effectives qu'apres un redemarrage. Si `dnf update` a mis a jour des paquets `kernel-*`, le redemarrage est obligatoire.

### 1.2 Suppression de Podman et Buildah

RHEL 8 installe **Podman** et **Buildah** par defaut comme alternatives a Docker. Ces paquets entrent en conflit avec Docker CE (commandes identiques, socket incompatible). Il faut les supprimer avant d'installer Docker.

> :warning: **Piege classique RHEL 8** : si vous tentez d'installer Docker CE sans desinstaller Podman, `dnf` remontera des conflits de paquets. De plus, la commande `docker` pointerait vers Podman, ce qui cause des comportements inattendus.

```bash
# Lister les paquets Podman/Buildah installes
sudo dnf list installed | grep -E 'podman|buildah|skopeo|containers-common'

# Les supprimer (la liste peut varier selon votre installation)
sudo dnf remove -y podman buildah skopeo containers-common
```

Verifiez qu'il ne reste plus de traces :

```bash
rpm -qa | grep -E 'podman|buildah'
# Aucune ligne ne doit s'afficher
```

:white_check_mark: **Verification** : la commande `docker` ne doit pas etre trouvee (`command not found`).

### 1.3 Installation des dependances systeme

Installez les outils necessaires pour le deploiement et l'administration du serveur :

```bash
sudo dnf install -y \
  git \
  curl \
  wget \
  openssl \
  tar \
  unzip \
  bind-utils \
  yum-utils
```

| Paquet          | Usage                                                                  |
| --------------- | ---------------------------------------------------------------------- |
| `git`           | Clonage du depot Orchestr'A                                            |
| `curl` / `wget` | Telechargements et health checks                                       |
| `openssl`       | Generation de secrets et certificats                                   |
| `bind-utils`    | Commande `dig` pour verification DNS                                   |
| `yum-utils`     | Fournit `yum-config-manager` (necessaire pour ajouter le depot Docker) |

:white_check_mark: **Verification** : `git --version` et `curl --version` retournent des numeros de version.

### 1.4 Configuration du hostname

Definissez le nom d'hote de la machine. Ce nom apparaitra dans les logs et certificats.

```bash
# Remplacez par votre nom de domaine reel
sudo hostnamectl set-hostname orchestr-a.example.com

# Verifiez
hostnamectl
```

### 1.5 Configuration du pare-feu (firewalld)

RHEL 8 utilise `firewalld` pour gerer les regles de pare-feu. Il faut ouvrir les ports necessaires au fonctionnement de l'application.

```bash
# Verifier que firewalld est actif
sudo systemctl status firewalld

# Si inactif, le demarrer et l'activer au boot
sudo systemctl start firewalld
sudo systemctl enable firewalld
```

Ouvrez les ports requis :

```bash
# SSH (devrait deja etre ouvert)
sudo firewall-cmd --permanent --add-service=ssh

# HTTP (port 80) - necessaire pour ACME challenge Let's Encrypt et redirection
sudo firewall-cmd --permanent --add-service=http

# HTTPS (port 443) - trafic applicatif
sudo firewall-cmd --permanent --add-service=https

# Appliquer les changements
sudo firewall-cmd --reload
```

> :bulb: **Bonne pratique** : ne jamais exposer les ports internes PostgreSQL (5432) ou Redis (6379) vers l'exterieur. La stack Docker Compose utilise un reseau interne (`orchestr-a-network`) ; seul Nginx expose les ports 80/443.

:white_check_mark: **Verification** :

```bash
sudo firewall-cmd --list-all
# Vous devez voir : ssh, http, https dans "services"
```

### 1.6 Configuration de SELinux

SELinux (Security-Enhanced Linux) est active par defaut sur RHEL 8 en mode `enforcing`. Trois approches sont possibles :

| Mode                             | Description                                   | Recommandation                      |
| -------------------------------- | --------------------------------------------- | ----------------------------------- |
| **Enforcing** (avec ajustements) | SELinux actif, regles adaptees pour Docker    | :white_check_mark: **Recommande**   |
| **Permissive**                   | SELinux genere des alertes mais ne bloque pas | Acceptable pour un test             |
| **Disabled**                     | SELinux completement desactive                | :warning: Deconseille en production |

#### Option recommandee : Enforcing avec ajustements

Docker CE fonctionne avec SELinux en mode enforcing, a condition d'ajuster les booleens necessaires :

```bash
# Verifier le mode actuel
getenforce
# Doit afficher "Enforcing"

# Autoriser Docker a acceder au reseau et aux volumes
sudo setsebool -P container_manage_cgroup on
```

> :bulb: **Note** : Docker CE gere nativement les labels SELinux sur les conteneurs. Les volumes montes avec `:ro` ou `:rw` dans le `docker-compose.prod.yml` sont correctement etiquetes par Docker.

Si vous rencontrez des blocages lies a SELinux, vous pouvez diagnostiquer avec :

```bash
# Voir les derniers blocages SELinux
sudo ausearch -m AVC -ts recent

# Generer une politique pour autoriser l'action bloquee
sudo ausearch -m AVC -ts recent | audit2allow -M orchestr-a-docker
sudo semodule -i orchestr-a-docker.pp
```

#### Option alternative : Permissive (temporaire)

```bash
# Passer en mode permissive (temporaire, jusqu'au prochain reboot)
sudo setenforce 0

# Ou permanent (editer le fichier de configuration)
sudo sed -i 's/^SELINUX=enforcing/SELINUX=permissive/' /etc/selinux/config
```

:white_check_mark: **Verification** : `getenforce` doit retourner le mode choisi.

### 1.7 Synchronisation NTP

La synchronisation de l'horloge est essentielle pour les certificats SSL, les tokens JWT et les logs. RHEL 8 utilise **chrony** par defaut.

```bash
# Verifier que chrony est actif
sudo systemctl status chronyd

# Si inactif, le demarrer
sudo systemctl start chronyd
sudo systemctl enable chronyd

# Verifier la synchronisation
chronyc tracking
```

:white_check_mark: **Verification** : la commande `chronyc tracking` doit afficher `Leap status : Normal` et un `System time` proche de zero.

### 1.8 Creation d'un utilisateur dedie

> :warning: **Ne jamais executer Docker en tant que root de facon routiniere.** Creez un utilisateur dedie pour administrer l'application.

```bash
# Creer l'utilisateur 'orchestr-a'
sudo useradd -m -s /bin/bash orchestr-a

# Definir un mot de passe fort
sudo passwd orchestr-a

# Lui donner les droits sudo si necessaire
sudo usermod -aG wheel orchestr-a
```

> :bulb: L'ajout au groupe `docker` se fera apres l'installation de Docker (section 2.4).

Basculez sur cet utilisateur pour la suite des operations :

```bash
su - orchestr-a
```

---

## 2. Installation de Docker CE

### 2.1 Ajout du depot Docker CE

Docker CE n'est pas disponible dans les depots officiels RHEL. Il faut ajouter le depot Docker manuellement.

```bash
# Ajouter le depot Docker CE officiel
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
```

> **Pourquoi le depot CentOS ?** Docker ne fournit pas de depot specifique RHEL 8. Le depot CentOS 8 est compatible et officiellement supporte par Docker pour RHEL 8.

### 2.2 Installation des paquets

Installez Docker CE avec le plugin Compose v2 (pas la version legacy `docker-compose` v1) :

```bash
sudo dnf install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin
```

| Paquet                  | Role                                              |
| ----------------------- | ------------------------------------------------- |
| `docker-ce`             | Le moteur Docker (daemon)                         |
| `docker-ce-cli`         | Interface en ligne de commande `docker`           |
| `containerd.io`         | Runtime de conteneurs bas-niveau                  |
| `docker-buildx-plugin`  | Builder avance (multi-plateforme, cache)          |
| `docker-compose-plugin` | Plugin `docker compose` v2 (sous-commande native) |

> :warning: **Compose v2 vs v1** : le projet utilise `docker compose` (avec espace, plugin v2), pas `docker-compose` (avec tiret, binaire standalone v1 deprecie). La syntaxe est identique, seule l'invocation change.

### 2.3 Demarrage et activation du service

```bash
# Demarrer Docker immediatement
sudo systemctl start docker

# Activer le demarrage automatique au boot
sudo systemctl enable docker
```

### 2.4 Post-installation

Ajoutez votre utilisateur dedie au groupe `docker` pour eviter d'utiliser `sudo` a chaque commande Docker :

```bash
# Ajouter l'utilisateur au groupe docker
sudo usermod -aG docker orchestr-a

# IMPORTANT : deconnectez et reconnectez la session pour que le changement prenne effet
exit
su - orchestr-a
```

> **Pourquoi se reconnecter ?** Les groupes Unix ne sont lus qu'a l'ouverture de session. Sans reconnexion, la commande `docker` echouera avec `permission denied`.

### 2.5 Verification de l'installation

```bash
# Verifier que Docker fonctionne (sans sudo)
docker run --rm hello-world

# Verifier la version de Docker
docker --version
# Attendu : Docker version 27.x.x

# Verifier la version de Compose
docker compose version
# Attendu : Docker Compose version v2.x.x
```

:white_check_mark: **Verification** : le message `Hello from Docker!` doit s'afficher, confirmant que Docker peut pull une image, creer un conteneur et l'executer.

### 2.6 Configuration du daemon Docker

Configurez le daemon pour la production : rotation des logs, driver de stockage, et DNS.

```bash
sudo mkdir -p /etc/docker
```

```bash
sudo tee /etc/docker/daemon.json > /dev/null << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5"
  },
  "storage-driver": "overlay2",
  "dns": ["8.8.8.8", "8.8.4.4"],
  "live-restore": true
}
EOF
```

| Parametre                  | Explication                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `log-driver` + `log-opts`  | Limite chaque fichier de log a 50 Mo, garde 5 fichiers max par conteneur. Evite que les logs remplissent le disque. |
| `storage-driver: overlay2` | Driver de stockage recommande pour les noyaux recents (RHEL 8 inclus).                                              |
| `dns`                      | Serveurs DNS de secours. Utile si le DNS interne est lent ou instable. Adaptez selon votre infrastructure.          |
| `live-restore`             | Permet aux conteneurs de continuer a tourner pendant un redemarrage du daemon Docker.                               |

Redemarrez Docker pour appliquer :

```bash
sudo systemctl restart docker
```

:white_check_mark: **Verification** : `docker info | grep -E "Storage Driver|Logging Driver"` doit afficher `overlay2` et `json-file`.

---

## 3. Clonage et preparation du projet

### 3.1 Clonage du depot

```bash
# Se placer dans le repertoire d'installation
cd /opt

# Cloner le depot
sudo git clone https://github.com/ElegAlex/Orchestr-A.git ORCHESTRA

# Donner les droits a l'utilisateur dedie
sudo chown -R orchestr-a:orchestr-a /opt/ORCHESTRA

# Se placer dans le projet
cd /opt/ORCHESTRA
```

> :bulb: Le repertoire `/opt` est le choix standard sous Linux pour les applications tierces installees manuellement.

### 3.2 Arborescence du projet

Voici les fichiers pertinents pour le deploiement :

```
ORCHESTRA/
├── docker-compose.prod.yml          # Stack de production (5 services + certbot)
├── docker-compose.yml               # Stack de dev (PostgreSQL + Redis seulement)
├── .env.production.example          # Modele de configuration production
├── nginx/
│   └── nginx.conf                   # Configuration du reverse proxy Nginx
├── apps/
│   ├── api/
│   │   ├── Dockerfile               # Image Docker de l'API (NestJS)
│   │   └── docker-entrypoint.sh     # Script d'init (migrations + seed)
│   └── web/
│       └── Dockerfile               # Image Docker du frontend (Next.js)
├── packages/
│   └── database/
│       └── prisma/                  # Schema et migrations Prisma
├── infrastructure/
│   └── docker/
│       └── postgres/
│           └── init.sql             # Script d'initialisation PostgreSQL
├── scripts/
│   ├── init-env.sh                  # Generation automatique des secrets
│   ├── deploy-production.sh         # Script de deploiement complet
│   ├── backup-database.sh           # Sauvegarde PostgreSQL
│   ├── restore-database.sh          # Restauration PostgreSQL
│   ├── health-check.sh              # Verification de sante
│   └── configure-ssl.sh             # Configuration SSL Let's Encrypt
└── backups/                         # Repertoire des sauvegardes (cree automatiquement)
```

### 3.3 Fonctionnement des Dockerfiles

#### API (`apps/api/Dockerfile`)

L'image API est construite en **2 etapes** (multi-stage build) pour obtenir une image finale legere :

1. **Stage `builder`** : installe toutes les dependances (dev incluses), genere le client Prisma, compile le TypeScript NestJS en JavaScript.
2. **Stage `production`** : copie uniquement le code compile et les dependances de production. Installe `prisma` globalement pour les migrations au demarrage. Execute le tout sous un utilisateur non-root `nestjs`.

Au demarrage du conteneur, le script `docker-entrypoint.sh` :

- Attend que PostgreSQL soit accessible (boucle avec `nc`)
- Applique les migrations Prisma (`prisma migrate deploy`)
- Cree l'utilisateur admin par defaut s'il n'existe pas
- Lance l'application NestJS sur le port **4000**

#### Frontend (`apps/web/Dockerfile`)

L'image Web est construite en **3 etapes** :

1. **Stage `deps`** : installe les dependances et genere le client Prisma (necessaire pour les types partages).
2. **Stage `builder`** : copie les dependances, compile l'application Next.js en mode `standalone` (bundle autonome optimise).
3. **Stage `production`** : copie uniquement le build standalone, les fichiers statiques et les assets publics. Execute sous l'utilisateur non-root `nextjs`.

L'application ecoute sur le port **3000** et est demarree avec `node apps/web/server.js`.

---

## 4. Configuration de l'environnement

### 4.1 Generation automatique des secrets

Le projet fournit un script qui genere automatiquement les mots de passe et secrets. C'est la methode **recommandee**.

```bash
cd /opt/ORCHESTRA

# Rendre le script executable
chmod +x scripts/init-env.sh

# Generer le fichier .env.production avec des secrets aleatoires
./scripts/init-env.sh
```

Le script :

- Genere un mot de passe PostgreSQL de 32 caracteres aleatoires
- Genere un mot de passe Redis de 32 caracteres aleatoires
- Genere un secret JWT en base64 de 64 caracteres
- Cree le fichier `.env.production` avec ces valeurs
- Affiche un resume (secrets partiellement masques)

> :bulb: Si le fichier existe deja, le script demandera confirmation et creera une sauvegarde horodatee.

**Apres la generation, editez le fichier pour configurer votre domaine :**

```bash
vi .env.production
```

Modifiez au minimum la variable `CORS_ORIGIN` :

```bash
# Remplacez par votre domaine reel
CORS_ORIGIN=https://orchestr-a.votre-domaine.fr
```

### 4.2 Reference des variables d'environnement

Voici la liste exhaustive des variables du fichier `.env.production` :

#### Secrets (obligatoires)

| Variable            | Description                     | Exemple               |    Obligatoire     | Defaut |
| ------------------- | ------------------------------- | --------------------- | :----------------: | ------ |
| `DATABASE_PASSWORD` | Mot de passe PostgreSQL         | `aB3dEf...` (32 car.) | :white_check_mark: | —      |
| `REDIS_PASSWORD`    | Mot de passe Redis              | `xY9zWk...` (32 car.) | :white_check_mark: | —      |
| `JWT_SECRET`        | Cle de signature des tokens JWT | `base64...` (64 car.) | :white_check_mark: | —      |

#### Domaine (obligatoire)

| Variable              | Description                           | Exemple                  |    Obligatoire     | Defaut |
| --------------------- | ------------------------------------- | ------------------------ | :----------------: | ------ |
| `CORS_ORIGIN`         | URL de production pour CORS           | `https://app.company.fr` | :white_check_mark: | —      |
| `NEXT_PUBLIC_API_URL` | URL de l'API vue depuis le navigateur | `/api`                   |        Non         | `/api` |

#### Base de donnees (optionnel)

| Variable        | Description               | Exemple           | Obligatoire | Defaut            |
| --------------- | ------------------------- | ----------------- | :---------: | ----------------- |
| `DATABASE_NAME` | Nom de la base PostgreSQL | `orchestr_a_prod` |     Non     | `orchestr_a_prod` |
| `DATABASE_USER` | Utilisateur PostgreSQL    | `orchestr_a`      |     Non     | `postgres`        |

#### Authentification (optionnel)

| Variable         | Description                      | Exemple           | Obligatoire | Defaut |
| ---------------- | -------------------------------- | ----------------- | :---------: | ------ |
| `JWT_EXPIRES_IN` | Duree de validite des tokens JWT | `7d`, `8h`, `30d` |     Non     | `7d`   |

#### Securite (optionnel)

| Variable          | Description                                  | Exemple | Obligatoire | Defaut  |
| ----------------- | -------------------------------------------- | ------- | :---------: | ------- |
| `THROTTLE_LIMIT`  | Nombre max de requetes par fenetre           | `100`   |     Non     | `100`   |
| `THROTTLE_TTL`    | Duree de la fenetre de rate-limit (secondes) | `60`    |     Non     | `60`    |
| `SWAGGER_ENABLED` | Activer la documentation API Swagger         | `false` |     Non     | `false` |

#### Reseau (optionnel)

| Variable     | Description                  | Exemple | Obligatoire | Defaut |
| ------------ | ---------------------------- | ------- | :---------: | ------ |
| `HTTP_PORT`  | Port HTTP expose sur l'hote  | `80`    |     Non     | `80`   |
| `HTTPS_PORT` | Port HTTPS expose sur l'hote | `443`   |     Non     | `443`  |

#### Email (optionnel)

| Variable        | Description          | Exemple                    | Obligatoire | Defaut |
| --------------- | -------------------- | -------------------------- | :---------: | ------ |
| `SMTP_HOST`     | Serveur SMTP         | `smtp.example.com`         |     Non     | —      |
| `SMTP_PORT`     | Port SMTP            | `587`                      |     Non     | —      |
| `SMTP_USER`     | Utilisateur SMTP     | `noreply@example.com`      |     Non     | —      |
| `SMTP_PASSWORD` | Mot de passe SMTP    | `secret`                   |     Non     | —      |
| `SMTP_FROM`     | Adresse d'expediteur | `ORCHESTR'A <noreply@...>` |     Non     | —      |

#### Monitoring (optionnel)

| Variable             | Description                        | Exemple                     | Obligatoire | Defaut |
| -------------------- | ---------------------------------- | --------------------------- | :---------: | ------ |
| `SENTRY_DSN`         | DSN Sentry pour le suivi d'erreurs | `https://xxx@sentry.io/xxx` |     Non     | —      |
| `SENTRY_ENVIRONMENT` | Nom d'environnement Sentry         | `production`                |     Non     | —      |

### 4.3 Configuration manuelle

Si vous preferez ne pas utiliser le script, creez le fichier manuellement :

```bash
cd /opt/ORCHESTRA

# Copier le modele
cp .env.production.example .env.production

# Generer les secrets
DB_PASS=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 32)
REDIS_PASS=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 32)
JWT=$(openssl rand -base64 64)

echo ""
echo "Copiez ces valeurs dans .env.production :"
echo "  DATABASE_PASSWORD=$DB_PASS"
echo "  REDIS_PASSWORD=$REDIS_PASS"
echo "  JWT_SECRET=$JWT"

# Editer le fichier
vi .env.production
```

### 4.4 Securisation du fichier .env.production

Le fichier `.env.production` contient des secrets sensibles. Appliquez ces bonnes pratiques :

```bash
# Restreindre les permissions (lecture/ecriture proprietaire uniquement)
chmod 600 .env.production

# Verifier que le fichier est bien dans .gitignore
grep '.env.production' .gitignore
# Doit s'afficher ; sinon, ajoutez-le
```

> :warning: **Ne jamais commiter ce fichier dans Git.** Il contient des mots de passe et secrets en clair. Le fichier `.env.production.example` (sans les vrais secrets) sert de modele.

:white_check_mark: **Verification** : `ls -la .env.production` doit afficher `-rw-------` (permissions `600`).

---

## 5. Configuration SSL / HTTPS

L'application est concue pour fonctionner en HTTPS derriere le reverse proxy Nginx. Deux options sont possibles.

### 5.1 Option A : Let's Encrypt avec Certbot (automatique)

C'est la methode recommandee pour les serveurs accessibles depuis Internet.

**Prerequis** :

- Le domaine doit pointer vers l'IP publique du serveur (enregistrement DNS A)
- Les ports 80 et 443 doivent etre ouverts (firewalld configure en section 1.5)

#### Etape 1 : Adapter la configuration Nginx

Editez `nginx/nginx.conf` pour remplacer les `server_name` par votre domaine :

```bash
vi nginx/nginx.conf
```

Remplacez **toutes les occurrences** de `orchestr-a.com` par votre domaine reel :

```nginx
# Bloc HTTP (ligne ~91)
server_name votre-domaine.fr www.votre-domaine.fr;

# Bloc HTTPS (ligne ~109)
server_name votre-domaine.fr www.votre-domaine.fr;
```

Adaptez egalement les chemins des certificats SSL (lignes ~112-113) :

```nginx
ssl_certificate /etc/nginx/ssl/live/votre-domaine.fr/fullchain.pem;
ssl_certificate_key /etc/nginx/ssl/live/votre-domaine.fr/privkey.pem;
```

#### Etape 2 : Obtenir le certificat initial

Avant de demarrer la stack complete, obtenez un premier certificat. La stack Docker Compose inclut un service **certbot** qui s'occupe du renouvellement, mais le premier certificat doit etre obtenu manuellement :

```bash
# Demarrer uniquement Nginx en mode HTTP (sans SSL)
# Pour cela, commentez temporairement le bloc "server 443" dans nginx.conf
# ou lancez d'abord un certbot standalone :

docker run --rm -p 80:80 \
  -v orchestr-a-certbot-certs:/etc/letsencrypt \
  -v orchestr-a-certbot-www:/var/www/certbot \
  certbot/certbot certonly \
    --standalone \
    --email admin@votre-domaine.fr \
    --agree-tos \
    --no-eff-email \
    -d votre-domaine.fr \
    -d www.votre-domaine.fr
```

> :bulb: Le flag `--standalone` lance un serveur web temporaire sur le port 80 pour repondre au challenge ACME. Assurez-vous qu'aucun autre processus n'utilise le port 80 a ce moment.

:white_check_mark: **Verification** : le message `Congratulations! Your certificate and chain have been saved` confirme le succes.

#### Etape 3 : Verifier les certificats dans le volume Docker

```bash
docker run --rm -v orchestr-a-certbot-certs:/certs alpine ls /certs/live/
# Doit afficher le nom de votre domaine
```

### 5.2 Option B : Certificat entreprise / custom

Si votre organisation fournit ses propres certificats (CA interne, certificat wildcard, etc.) :

```bash
# Creer le repertoire des certificats
sudo mkdir -p /opt/ORCHESTRA/ssl

# Copier vos certificats
sudo cp votre-certificat.pem /opt/ORCHESTRA/ssl/fullchain.pem
sudo cp votre-cle-privee.pem /opt/ORCHESTRA/ssl/privkey.pem

# Restreindre les permissions
sudo chmod 600 /opt/ORCHESTRA/ssl/privkey.pem
sudo chmod 644 /opt/ORCHESTRA/ssl/fullchain.pem
```

Modifiez le `docker-compose.prod.yml` pour monter ces fichiers au lieu d'utiliser les volumes certbot :

```yaml
# Dans le service nginx, remplacez :
volumes:
  - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
  - ./ssl/fullchain.pem:/etc/nginx/ssl/live/votre-domaine.fr/fullchain.pem:ro
  - ./ssl/privkey.pem:/etc/nginx/ssl/live/votre-domaine.fr/privkey.pem:ro
  - nginx_logs_prod:/var/log/nginx
```

> :bulb: Adaptez les chemins dans `nginx.conf` en coherence avec les chemins de montage.

### 5.3 Configuration Nginx

Le fichier `nginx/nginx.conf` fait office de reverse proxy devant l'API et le frontend. Voici ce qu'il fait :

```
Navigateur → :443 (HTTPS) → Nginx → /api/*  → API (port 4000 interne)
                                   → /_next/* → Web (port 3000 interne, cache long)
                                   → /*       → Web (port 3000 interne)
         → :80  (HTTP)  → Nginx → Redirection 301 vers HTTPS
                                → /.well-known/acme-challenge/ → Certbot (ACME)
```

**Fonctionnalites incluses** :

- **Compression gzip** : JSON, CSS, JS, SVG, fonts (economie de bande passante)
- **En-tetes de securite** : `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `HSTS`
- **Rate limiting** : 10 requetes/seconde par IP sur `/api`, burst de 20
- **Cache statique** : les assets Next.js (`/_next/static`) sont caches 1 an (`immutable`)
- **WebSocket** : supporte pour les mises a jour temps reel
- **SSL moderne** : TLS 1.2 + 1.3, ciphers ECDHE, session cache 10m

### 5.4 Renouvellement automatique

La stack `docker-compose.prod.yml` inclut un service `certbot` qui tourne en arriere-plan et renouvelle automatiquement les certificats toutes les 12 heures :

```yaml
certbot:
  image: certbot/certbot:latest
  entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
```

Apres un renouvellement, rechargez Nginx pour prendre en compte le nouveau certificat :

```bash
# Recharger Nginx manuellement (ou ajouter un cron)
docker exec orchestr-a-nginx-prod nginx -s reload
```

> :bulb: **Cron de rechargement Nginx** (optionnel, pour automatiser completement) :

```bash
# Ajouter un cron qui recharge Nginx 2 fois par jour
(crontab -l 2>/dev/null; echo "0 0,12 * * * docker exec orchestr-a-nginx-prod nginx -s reload") | crontab -
```

---

## 6. Build et demarrage

### 6.1 Build des images Docker

Construisez les images API et Web depuis les sources. Cette etape compile le code TypeScript et cree les images Docker optimisees pour la production.

```bash
cd /opt/ORCHESTRA

# Build des images (peut prendre 5-10 minutes la premiere fois)
docker compose --env-file .env.production -f docker-compose.prod.yml build
```

> :bulb: **Build sans cache** : si vous rencontrez des problemes de cache apres une mise a jour, ajoutez `--no-cache` :
>
> ```bash
> docker compose --env-file .env.production -f docker-compose.prod.yml build --no-cache
> ```

### 6.2 Lancement de la stack

```bash
# Demarrer tous les services en arriere-plan
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

L'ordre de demarrage est gere automatiquement par les declarations `depends_on` et `healthcheck` :

1. **PostgreSQL** et **Redis** demarrent en premier
2. **API** attend que PostgreSQL et Redis soient `healthy`
3. **Web** attend que l'API soit `healthy`
4. **Nginx** attend que l'API et le Web soient `healthy`
5. **Certbot** demarre independamment

### 6.3 Architecture des services

```
┌─────────────────────────────────────────────────────────────────────┐
│                          HOTE RHEL 8.10                             │
│                                                                     │
│  ┌──────────────── Reseau Docker (orchestr-a-network) ───────────┐  │
│  │                                                                │  │
│  │  ┌─────────┐   ┌─────────┐   ┌──────┐   ┌──────────────────┐ │  │
│  │  │  Nginx  │──▶│   API   │──▶│ PgSQL│   │      Redis       │ │  │
│  │  │  :80    │   │  :4000  │   │ :5432│   │      :6379       │ │  │
│  │  │  :443   │──▶│         │──▶│      │   │                  │ │  │
│  │  └─────────┘   └─────────┘   └──────┘   └──────────────────┘ │  │
│  │       │                                                       │  │
│  │       │        ┌─────────┐                                    │  │
│  │       └───────▶│   Web   │   ┌─────────┐                     │  │
│  │                │  :3000  │   │ Certbot │                      │  │
│  │                └─────────┘   └─────────┘                      │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Ports exposes : 80 (HTTP) ─── 443 (HTTPS)                         │
└─────────────────────────────────────────────────────────────────────┘
```

| Service    | Image                | Role                                          | Port interne | Expose a l'hote |
| ---------- | -------------------- | --------------------------------------------- | :----------: | :-------------: |
| `postgres` | `postgres:18-alpine` | Base de donnees relationnelle                 |     5432     |       Non       |
| `redis`    | `redis:7.4-alpine`   | Cache et sessions (max 256 Mo, politique LRU) |     6379     |       Non       |
| `api`      | Build local          | API REST NestJS/Fastify                       |     4000     |       Non       |
| `web`      | Build local          | Frontend Next.js (standalone)                 |     3000     |       Non       |
| `nginx`    | `nginx:1.27-alpine`  | Reverse proxy + terminaison SSL               |   80, 443    |     **Oui**     |
| `certbot`  | `certbot/certbot`    | Renouvellement certificats Let's Encrypt      |      —       |       Non       |

**Volumes persistants** :

| Volume                          | Contenu                       |      Critique      |
| ------------------------------- | ----------------------------- | :----------------: |
| `orchestr-a-postgres-data-prod` | Donnees PostgreSQL            | :white_check_mark: |
| `orchestr-a-redis-data-prod`    | Donnees Redis (AOF)           |        Non         |
| `orchestr-a-api-logs-prod`      | Logs de l'API                 |        Non         |
| `orchestr-a-nginx-logs-prod`    | Logs Nginx                    |        Non         |
| `orchestr-a-certbot-certs`      | Certificats SSL Let's Encrypt | :white_check_mark: |
| `orchestr-a-certbot-www`        | Challenge ACME                |        Non         |

### 6.4 Initialisation de la base de donnees

L'initialisation est **automatique** au premier demarrage :

1. PostgreSQL execute `init.sql` (creation de l'extension `uuid-ossp`)
2. L'entrypoint de l'API (`docker-entrypoint.sh`) :
   - Attend que PostgreSQL soit accessible
   - Execute `prisma migrate deploy` (applique les migrations SQL)
   - Cree l'utilisateur admin par defaut via `INSERT ... ON CONFLICT DO NOTHING`

> :warning: **Identifiants admin par defaut** :
>
> - Login : `admin`
> - Mot de passe : `admin123`
> - Email : `admin@orchestr-a.internal`

Ces identifiants doivent etre changes immediatement apres le premier demarrage (voir section 7.1).

### 6.5 Verification du deploiement

Attendez 2-3 minutes que tous les services demarrent et passent les health checks, puis verifiez :

```bash
# Verifier que tous les conteneurs sont "healthy" ou "running"
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Resultat attendu (tous les services en `Up (healthy)`) :

```
NAME                         STATUS                 PORTS
orchestr-a-postgres-prod     Up (healthy)
orchestr-a-redis-prod        Up (healthy)
orchestr-a-api-prod          Up (healthy)           4000/tcp
orchestr-a-web-prod          Up (healthy)           3000/tcp
orchestr-a-nginx-prod        Up (healthy)           0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
orchestr-a-certbot-prod      Up
```

Testez les endpoints :

```bash
# Health check API (via Nginx en HTTPS)
curl -k https://localhost/api/health
# Attendu : reponse JSON avec status OK

# Test frontend (via Nginx)
curl -k -I https://localhost/
# Attendu : HTTP/2 200
```

> :bulb: Le flag `-k` desactive la verification SSL (utile si vous testez avec un certificat auto-signe ou depuis localhost).

Vous pouvez aussi utiliser le script de health check fourni :

```bash
chmod +x scripts/health-check.sh
./scripts/health-check.sh
```

:white_check_mark: **Verification** : les 5 services sont `healthy`, l'API repond sur `/api/health`, et le frontend est accessible via HTTPS.

---

## 7. Post-installation

### 7.1 Changement du mot de passe admin

> :warning: **Action obligatoire** : le mot de passe par defaut (`admin123`) doit etre change immediatement.

1. Ouvrez l'application dans votre navigateur : `https://votre-domaine.fr`
2. Connectez-vous avec :
   - **Login** : `admin`
   - **Mot de passe** : `admin123`
3. Accedez aux parametres du compte et changez le mot de passe

> :bulb: L'authentification utilise le champ **login** (pas email). Le login par defaut est `admin`, pas `admin@orchestr-a.internal`.

### 7.2 Creation des premiers utilisateurs

Depuis l'interface d'administration (compte admin), creez les comptes utilisateurs necessaires. Chaque utilisateur recoit :

- Un login unique
- Un mot de passe initial
- Un role (ADMIN, MANAGER, USER)

### 7.3 Checklist de premier test fonctionnel

- [ ] Connexion avec le compte admin fonctionne
- [ ] Mot de passe admin change
- [ ] Creation d'un utilisateur test
- [ ] Connexion avec l'utilisateur test
- [ ] Creation d'un projet
- [ ] Creation d'une tache dans le projet
- [ ] Navigation fluide sans erreurs console
- [ ] HTTPS fonctionne (cadenas dans le navigateur)
- [ ] Redirection HTTP → HTTPS fonctionne

---

## 8. Operations courantes

### 8.1 Logs

```bash
cd /opt/ORCHESTRA

# Tous les logs en temps reel
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f

# Logs d'un service specifique
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f api
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f web
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f postgres
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f nginx

# Dernières 100 lignes
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 api
```

### 8.2 Redemarrage d'un service

```bash
# Redemarrer un seul service (sans toucher aux autres)
docker compose --env-file .env.production -f docker-compose.prod.yml restart api

# Redemarrer toute la stack
docker compose --env-file .env.production -f docker-compose.prod.yml restart
```

> :bulb: Un `restart` ne reconstruit pas l'image. Si le code a change, il faut `build` puis `up` (voir section 8.3).

### 8.3 Mise a jour de l'application

Procedure pour deployer une nouvelle version :

```bash
cd /opt/ORCHESTRA

# 1. Tirer les dernieres modifications
git fetch origin
git pull origin master

# 2. Sauvegarder la base de donnees (precaution)
./scripts/backup-database.sh

# 3. Reconstruire les images
docker compose --env-file .env.production -f docker-compose.prod.yml build

# 4. Redemarrer avec les nouvelles images
docker compose --env-file .env.production -f docker-compose.prod.yml up -d

# 5. Verifier le deploiement
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

> :bulb: Les migrations Prisma sont executees automatiquement au demarrage du conteneur API. Pas d'action manuelle necessaire.

> :warning: **Interruption de service** : entre l'arret de l'ancien conteneur et le demarrage du nouveau, le service est indisponible pendant quelques secondes. Planifiez les mises a jour en heures creuses.

### 8.4 Backup de la base de donnees

Le script `scripts/backup-database.sh` effectue un dump PostgreSQL compresse :

```bash
cd /opt/ORCHESTRA
chmod +x scripts/backup-database.sh

# Lancer une sauvegarde
./scripts/backup-database.sh
```

**Ce que fait le script** :

1. Execute `pg_dump` dans le conteneur `orchestr-a-postgres-prod`
2. Sauvegarde dans `./backups/orchestr-a-backup-YYYYMMDD_HHMMSS.sql`
3. Compresse le fichier avec `gzip`
4. Supprime automatiquement les sauvegardes de plus de 30 jours

> :bulb: **Automatiser avec cron** :
>
> ```bash
> # Sauvegarde quotidienne a 2h du matin
> (crontab -l 2>/dev/null; echo "0 2 * * * cd /opt/ORCHESTRA && ./scripts/backup-database.sh >> /var/log/orchestr-a-backup.log 2>&1") | crontab -
> ```

### 8.5 Restauration de la base de donnees

> :warning: **Attention** : la restauration ecrase les donnees actuelles de la base.

```bash
cd /opt/ORCHESTRA
chmod +x scripts/restore-database.sh

# Lister les sauvegardes disponibles
ls -lh backups/

# Restaurer une sauvegarde
./scripts/restore-database.sh backups/orchestr-a-backup-20260205_020000.sql.gz
```

Le script :

1. Decompresse le fichier `.gz` si necessaire
2. Demande confirmation avant d'ecraser la base
3. Injecte le dump dans PostgreSQL via `psql`

### 8.6 Health check

```bash
cd /opt/ORCHESTRA
chmod +x scripts/health-check.sh

./scripts/health-check.sh
```

Le script verifie :

- L'etat de chaque conteneur (running + healthy)
- L'accessibilite des endpoints HTTP (API, frontend via Nginx, frontend direct)
- La connexion a PostgreSQL et compte les enregistrements (utilisateurs, projets, taches)
- L'utilisation des ressources (CPU, RAM, reseau de chaque conteneur)

---

## 9. Monitoring et maintenance

### 9.1 Surveillance de l'espace disque

Les principaux consommateurs d'espace disque sont :

| Element            | Emplacement                            | Croissance                        |
| ------------------ | -------------------------------------- | --------------------------------- |
| Donnees PostgreSQL | Volume `orchestr-a-postgres-data-prod` | Proportionnel aux donnees         |
| Images Docker      | `/var/lib/docker`                      | A chaque build                    |
| Logs Docker        | `/var/lib/docker/containers/*/`        | Continue (limitee par config)     |
| Sauvegardes        | `./backups/`                           | Quotidien (30 jours de retention) |

```bash
# Espace disque global
df -h /

# Espace utilise par Docker
docker system df

# Detail par volume
docker system df -v
```

> :bulb: Configurez une alerte si l'espace disque descend en dessous de 20% :
>
> ```bash
> # Ajouter dans le cron (verification toutes les heures)
> (crontab -l 2>/dev/null; echo '0 * * * * [ $(df / --output=pcent | tail -1 | tr -dc "0-9") -gt 80 ] && echo "ALERTE: Disque a $(df / --output=pcent | tail -1)" | mail -s "Orchestr-A: Espace disque critique" admin@example.com') | crontab -
> ```

### 9.2 Nettoyage Docker

Avec le temps, Docker accumule des images inutilisees, des conteneurs arretes et des caches de build.

```bash
# Voir ce qui peut etre nettoye
docker system df

# Nettoyer les ressources non utilisees (images pendantes, conteneurs arretes, caches)
docker system prune -f

# Nettoyage agressif (inclut les images non utilisees par un conteneur actif)
# ⚠️ A utiliser avec precaution : supprime aussi les images intermediaires de build
docker system prune -a -f
```

> :bulb: **Planifier un nettoyage mensuel** :
>
> ```bash
> (crontab -l 2>/dev/null; echo "0 3 1 * * docker system prune -f >> /var/log/docker-prune.log 2>&1") | crontab -
> ```

### 9.3 Rotation des logs

La rotation des logs est deja configuree dans `docker-compose.prod.yml` pour chaque service :

| Service    | Taille max par fichier | Fichiers conserves |
| ---------- | :--------------------: | :----------------: |
| PostgreSQL |         50 Mo          |         5          |
| Redis      |         10 Mo          |         3          |
| API        |         50 Mo          |         5          |
| Web        |         20 Mo          |         3          |
| Nginx      |         20 Mo          |         5          |

Ces limites sont aussi definies globalement dans `/etc/docker/daemon.json` (section 2.6). La configuration par service dans `docker-compose.prod.yml` a priorite.

### 9.4 Surveillance des certificats SSL

```bash
# Verifier la date d'expiration du certificat
docker run --rm -v orchestr-a-certbot-certs:/certs alpine \
  sh -c "cat /certs/live/votre-domaine.fr/fullchain.pem" | \
  openssl x509 -noout -dates

# Ou depuis l'exterieur
echo | openssl s_client -connect votre-domaine.fr:443 2>/dev/null | openssl x509 -noout -dates
```

Le service `certbot` dans la stack renouvelle automatiquement les certificats avant expiration. Verifiez ses logs si le renouvellement echoue :

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs certbot
```

### 9.5 Mises a jour de securite RHEL

Appliquez regulierement les correctifs de securite :

```bash
# Verifier les mises a jour disponibles
sudo dnf check-update

# Appliquer les mises a jour de securite uniquement
sudo dnf update --security -y

# Ou toutes les mises a jour
sudo dnf update -y
```

> :bulb: Planifiez les mises a jour systeme en dehors des heures de production. Un redemarrage peut etre necessaire apres les mises a jour du noyau.

---

## 10. Troubleshooting

|  #  | Probleme                                   | Diagnostic                                                                           | Solution                                                                                                                                                                                             |
| :-: | ------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | **Conteneur ne demarre pas**               | `docker compose -f docker-compose.prod.yml ps` montre `Exit` ou `Restarting`         | Consulter les logs : `docker compose -f docker-compose.prod.yml logs <service>`. Verifier les variables d'env requises dans `.env.production`.                                                       |
|  2  | **Erreur connexion PostgreSQL**            | L'API log `ECONNREFUSED` ou `Connection refused` sur le port 5432                    | Verifier que le conteneur PostgreSQL est `healthy` : `docker inspect orchestr-a-postgres-prod --format='{{.State.Health.Status}}'`. Verifier `DATABASE_PASSWORD` dans `.env.production`.             |
|  3  | **Erreur connexion Redis**                 | L'API log `NOAUTH` ou `ERR invalid password`                                         | Verifier que `REDIS_PASSWORD` dans `.env.production` correspond au mot de passe configure. Redemarrer Redis : `docker compose -f docker-compose.prod.yml restart redis`.                             |
|  4  | **Permission denied (SELinux)**            | `ausearch -m AVC -ts recent` montre des blocages                                     | Generer et appliquer une politique : `ausearch -m AVC -ts recent \| audit2allow -M fix && semodule -i fix.pp`. Ou passer temporairement en permissive : `setenforce 0`.                              |
|  5  | **Port deja utilise**                      | `Error starting userland proxy: listen tcp 0.0.0.0:80: bind: address already in use` | Identifier le processus : `sudo ss -tlnp \| grep :80`. Arreter le processus ou changer le port dans `.env.production` (`HTTP_PORT`, `HTTPS_PORT`).                                                   |
|  6  | **Certificat SSL expire**                  | Navigateur affiche `NET::ERR_CERT_DATE_INVALID`                                      | Verifier les logs certbot. Forcer le renouvellement : `docker compose -f docker-compose.prod.yml run --rm certbot renew --force-renewal` puis `docker exec orchestr-a-nginx-prod nginx -s reload`.   |
|  7  | **Probleme DNS**                           | `curl: (6) Could not resolve host`                                                   | Verifier la resolution : `dig votre-domaine.fr`. Verifier le DNS dans `/etc/resolv.conf` et `/etc/docker/daemon.json`.                                                                               |
|  8  | **Espace disque plein**                    | `No space left on device`                                                            | Nettoyer Docker : `docker system prune -a -f`. Supprimer les anciennes sauvegardes : `ls -la backups/`. Verifier `df -h`.                                                                            |
|  9  | **Migration Prisma echouee**               | L'API log `ERROR: migrate deploy failed`                                             | Se connecter au conteneur API : `docker exec -it orchestr-a-api-prod sh`. Verifier : `cd /app/packages/database && npx prisma migrate status`. Appliquer manuellement : `npx prisma migrate deploy`. |
| 10  | **Erreurs CORS**                           | Console navigateur : `Access-Control-Allow-Origin` manquant                          | Verifier `CORS_ORIGIN` dans `.env.production` : doit correspondre exactement a l'URL dans le navigateur (protocole + domaine, ex: `https://app.example.com`). Reconstruire et redemarrer l'API.      |
| 11  | **API Health check echoue (start_period)** | L'API affiche `unhealthy` pendant les premieres minutes                              | Normal : le `start_period` est de 90 secondes pour l'API (temps des migrations). Attendez 2-3 minutes apres le demarrage.                                                                            |
| 12  | **Conflit Podman/Docker**                  | `docker: command not found` apres installation ou comportement inattendu             | Verifier : `which docker` et `rpm -qa \| grep podman`. Desinstaller Podman (section 1.2) et reinstaller Docker CE.                                                                                   |

**Commandes de diagnostic general** :

```bash
# Etat de tous les conteneurs
docker compose --env-file .env.production -f docker-compose.prod.yml ps

# Logs complets d'un service en erreur
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=200 api

# Inspecter un conteneur (details complets)
docker inspect orchestr-a-api-prod

# Entrer dans un conteneur pour debugger
docker exec -it orchestr-a-api-prod sh

# Verifier la connectivite reseau entre conteneurs
docker exec orchestr-a-api-prod ping -c 2 postgres
docker exec orchestr-a-api-prod nc -z postgres 5432

# Verifier les variables d'environnement effectives d'un conteneur
docker exec orchestr-a-api-prod env | sort
```

---

## 11. Annexes

### 11.1 Schema d'architecture reseau

```
                    Internet
                       │
                       ▼
              ┌────────────────┐
              │   Firewalld    │
              │  Ports 80,443  │
              └───────┬────────┘
                      │
          ┌───────────▼───────────┐
          │    Nginx (nginx:1.27) │
          │                       │
          │  :80  → Redir HTTPS   │
          │  :80  → ACME challenge│
          │  :443 → SSL Termination│
          └──┬──────────────┬─────┘
             │              │
    /api/*   │              │  /*
             ▼              ▼
   ┌──────────────┐  ┌──────────────┐
   │  API NestJS  │  │  Web Next.js │
   │  :4000       │  │  :3000       │
   └──┬───────┬───┘  └──────────────┘
      │       │
      ▼       ▼
┌─────────┐ ┌──────┐
│PostgreSQL│ │Redis │
│  :5432   │ │:6379 │
└──────────┘ └──────┘

Reseau Docker interne : orchestr-a-network-prod (bridge)
Seuls les ports 80 et 443 sont exposes a l'hote.
```

### 11.2 Ports utilises

| Port | Service    |      Direction      | Protocole | Notes                    |
| :--: | ---------- | :-----------------: | :-------: | ------------------------ |
|  22  | SSH        |   Externe → Hote    |    TCP    | Administration serveur   |
|  80  | Nginx      | Externe → Conteneur |    TCP    | Redirection HTTPS + ACME |
| 443  | Nginx      | Externe → Conteneur |    TCP    | Trafic applicatif HTTPS  |
| 4000 | API        |   Interne Docker    |    TCP    | Non expose a l'hote      |
| 3000 | Web        |   Interne Docker    |    TCP    | Non expose a l'hote      |
| 5432 | PostgreSQL |   Interne Docker    |    TCP    | Non expose a l'hote      |
| 6379 | Redis      |   Interne Docker    |    TCP    | Non expose a l'hote      |

### 11.3 Commandes Docker utiles

```bash
# === GESTION DE LA STACK ===
# Alias pratique (a ajouter dans ~/.bashrc)
alias dc='docker compose --env-file .env.production -f docker-compose.prod.yml'

# Demarrer / arreter / redemarrer
dc up -d
dc down
dc restart

# Voir l'etat
dc ps

# === LOGS ===
dc logs -f              # Tous les logs en temps reel
dc logs -f api          # Logs API seulement
dc logs --tail=50 web   # 50 dernieres lignes du frontend

# === DEBUG ===
docker exec -it orchestr-a-api-prod sh       # Shell dans l'API
docker exec -it orchestr-a-postgres-prod psql -U postgres -d orchestr_a_prod  # Console PostgreSQL
docker exec -it orchestr-a-redis-prod redis-cli  # Console Redis

# === MAINTENANCE ===
docker system df         # Espace utilise par Docker
docker system prune -f   # Nettoyage
docker stats             # Ressources en temps reel (CPU, RAM, reseau)
```

### 11.4 References

- [Docker CE sur RHEL 8 - Documentation officielle](https://docs.docker.com/engine/install/rhel/)
- [Docker Compose v2 - Reference](https://docs.docker.com/compose/reference/)
- [Prisma Migrate - Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Certbot - Guide utilisateur](https://certbot.eff.org/docs/)
- [RHEL 8 - Guide d'administration systeme](https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/8/)
- [SELinux - Guide de reference](https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/8/html/using_selinux/)
- [Nginx - Documentation](https://nginx.org/en/docs/)
