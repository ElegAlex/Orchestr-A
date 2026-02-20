# Guide de mise à jour — Orchestr'A V2

Ce guide vous accompagne pas à pas pour mettre à jour Orchestr'A sur votre serveur.
Chaque commande est expliquée avant d'être exécutée.

---

## 1. Avant de commencer

### Prérequis

- **Docker** doit être installé et démarré sur le serveur
- L'application Orchestr'A doit déjà tourner (ce guide est pour une mise à jour, pas une installation neuve)
- Vous devez être connecté au serveur avec un compte qui a les droits Docker

**Pour vérifier que Docker fonctionne**, tapez cette commande :

```bash
docker --version
```

Vous devez voir quelque chose comme :

```
Docker version 24.0.7, build afdd53b
```

Si vous obtenez une erreur "command not found", Docker n'est pas installé.

**Pour vérifier que l'application tourne**, tapez :

```bash
docker ps
```

Vous devez voir une ligne avec "orchestr-a" dans la colonne NAMES :

```
CONTAINER ID   IMAGE                                  STATUS       NAMES
a1b2c3d4e5f6   ghcr.io/elegalex/orchestr-a:latest    Up 3 days    orchestr-a
```

### Temps estimé

- Durée totale de la procédure : **10 à 15 minutes**
- Temps d'indisponibilité de l'application : **2 à 3 minutes**
  (entre l'arrêt de l'ancien container et le démarrage du nouveau)

### Ce que fait la mise à jour

1. Sauvegarde votre base de données (vos projets, utilisateurs, etc.)
2. Arrête l'application temporairement
3. Installe la nouvelle version
4. Relance l'application
5. Applique automatiquement les modifications de la base de données (migrations)

**Vos données sont conservées.** La mise à jour ne touche qu'au code de l'application.

---

## 2. Procédure de mise à jour

### Préparation

Copiez le dossier `orchestr-a-v2-update` sur votre serveur (par clé USB ou transfert réseau),
puis ouvrez un terminal dans ce dossier :

```bash
cd /chemin/vers/orchestr-a-v2-update
```

Vérifiez que les fichiers sont bien présents :

```bash
ls -la
```

Vous devez voir :

```
orchestr-a-latest.tar
update.sh
rollback.sh
verify.sh
LISEZ-MOI.txt
docs/
```

---

### Option A — Mise à jour automatique (recommandée)

Le script `update.sh` fait tout pour vous. Lancez-le avec :

```bash
bash update.sh
```

Le script va :
1. Vérifier que Docker fonctionne
2. Vérifier que l'application tourne
3. Créer un backup de votre base de données
4. Arrêter l'application
5. Charger la nouvelle version
6. Relancer l'application
7. Vérifier que tout fonctionne

**Le script vous demande confirmation avant de commencer.** Répondez "oui" pour continuer.

Sortie attendue (exemple) :

```
═══════════════════════════════════════════════════════════
  MISE À JOUR ORCHESTR'A V2
═══════════════════════════════════════════════════════════

Étape 1/6 — Vérification de Docker...
  ✓ Docker est opérationnel (version 24.0.7)

Étape 2/6 — Vérification du container actuel...
  ✓ Container 'orchestr-a' trouvé et actif

Étape 3/6 — Sauvegarde de la base de données...
  ✓ Backup créé : backup_orchestr-a_20260220_143022.sql (12 Mo)

Étape 4/6 — Préparation de la mise à jour...
  ✓ Paramètres actuels récupérés (port: 3000, volume: orchestr-a-data)
  ✓ Ancienne image taguée comme 'previous' pour rollback
  ✓ Container arrêté et supprimé (les données sont conservées dans le volume)

Étape 5/6 — Chargement de la nouvelle image...
  ✓ Nouvelle image chargée avec succès

Étape 6/6 — Lancement du nouveau container...
  ✓ Container lancé
  Vérification du démarrage (les migrations s'exécutent, patientez)...
  ... en attente (5/180s)
  ... en attente (10/180s)

═══════════════════════════════════════════════════════════

  ✓  MISE À JOUR TERMINÉE AVEC SUCCÈS !

  L'application est accessible sur :
  → http://192.168.1.100:3000

═══════════════════════════════════════════════════════════
```

---

### Option B — Mise à jour manuelle

Si vous préférez exécuter chaque étape vous-même, voici la procédure détaillée.

#### B.1 — Sauvegarder la base de données

Cette commande crée une copie de toutes vos données :

```bash
docker exec orchestr-a gosu postgres pg_dump -d orchestr_a > backup_orchestr-a_$(date +%Y%m%d_%H%M%S).sql
```

Vérifiez que le fichier existe et n'est pas vide :

```bash
ls -la backup_orchestr-a_*.sql
```

#### B.2 — Taguer l'ancienne image

Cette commande garde une copie de la version actuelle au cas où :

```bash
docker tag ghcr.io/elegalex/orchestr-a:latest ghcr.io/elegalex/orchestr-a:previous
```

#### B.3 — Arrêter le container

Cette commande arrête l'application (elle sera brièvement indisponible) :

```bash
docker stop orchestr-a
docker rm orchestr-a
```

> **Important :** vos données ne sont PAS supprimées. Elles sont stockées dans un volume Docker séparé.

#### B.4 — Charger la nouvelle image

Cette commande importe la nouvelle version depuis le fichier :

```bash
docker load -i orchestr-a-latest.tar
```

Sortie attendue :

```
Loaded image: ghcr.io/elegalex/orchestr-a:latest
```

#### B.5 — Relancer le container

Cette commande démarre l'application avec la nouvelle version :

```bash
docker run -d --name orchestr-a \
  -p 3000:3000 \
  -v orchestr-a-data:/data \
  --restart unless-stopped \
  ghcr.io/elegalex/orchestr-a:latest
```

#### B.6 — Vérifier le démarrage

Attendez 1 à 2 minutes (le temps que les migrations s'appliquent), puis :

```bash
docker logs orchestr-a --tail 20
```

Vous devez voir à la fin :

```
  ✓ Orchestr'A — Démarrage des services...
```

---

## 3. Vérification

### Vérification rapide avec le script

```bash
bash verify.sh
```

Ce script affiche l'état complet de l'application : services, base de données, espace disque.

### Vérification dans le navigateur

1. Ouvrez votre navigateur à l'adresse de votre serveur (ex : `http://192.168.1.100:3000`)
2. Connectez-vous avec vos identifiants habituels
3. Vérifiez que vos projets et données sont bien présents

### Commandes de diagnostic

**Voir l'état du container** (est-ce que l'application tourne ?) :

```bash
docker ps
```

Vous devez voir "orchestr-a" avec le statut "Up" et "(healthy)".

**Voir les logs** (utile si quelque chose ne fonctionne pas) :

```bash
docker logs orchestr-a --tail 50
```

---

## 4. En cas de problème

### Option A — Rollback automatique

Si la mise à jour a échoué et que l'application ne fonctionne plus :

```bash
bash rollback.sh
```

Ce script :
1. Remet la version précédente
2. Restaure la base de données depuis le backup
3. Vérifie que tout fonctionne

### Option B — Rollback manuel

#### Arrêter le container actuel

```bash
docker stop orchestr-a
docker rm orchestr-a
```

#### Remettre l'ancienne image

```bash
docker tag ghcr.io/elegalex/orchestr-a:previous ghcr.io/elegalex/orchestr-a:latest
```

#### Relancer

```bash
docker run -d --name orchestr-a \
  -p 3000:3000 \
  -v orchestr-a-data:/data \
  --restart unless-stopped \
  ghcr.io/elegalex/orchestr-a:latest
```

#### Restaurer la base de données

Trouvez votre fichier backup :

```bash
ls backup_orchestr-a_*.sql
```

Puis restaurez-le (remplacez le nom du fichier) :

```bash
docker exec -i orchestr-a gosu postgres psql -d orchestr_a < backup_orchestr-a_20260220_143022.sql
```

### Problèmes courants

#### "Le container ne démarre pas"

Consultez les logs pour comprendre l'erreur :

```bash
docker logs orchestr-a
```

Causes fréquentes :
- Le port 3000 est déjà utilisé par un autre programme
- Le volume de données est corrompu

#### "L'application met du temps à répondre après la mise à jour"

C'est normal. Les migrations de base de données peuvent prendre quelques minutes
lors du premier démarrage. Attendez 2-3 minutes et réessayez.

Vous pouvez suivre la progression dans les logs :

```bash
docker logs orchestr-a -f
```

(Appuyez sur Ctrl+C pour quitter l'affichage des logs)

#### "Erreur de migration"

Les migrations ont échoué. Ne paniquez pas, vos données sont sauvegardées.

1. Lancez le rollback : `bash rollback.sh`
2. Contactez le développeur avec les logs : `docker logs orchestr-a > erreur.log`

#### "Permission denied" ou erreur de droits

Votre utilisateur n'a probablement pas les droits Docker. Solutions :

```bash
# Ajouter votre utilisateur au groupe docker
sudo usermod -aG docker $USER

# Puis déconnectez-vous et reconnectez-vous, ou lancez :
newgrp docker
```

#### "Cannot connect to the Docker daemon"

Le service Docker n'est pas démarré :

```bash
sudo systemctl start docker
```

Pour qu'il démarre automatiquement au boot :

```bash
sudo systemctl enable docker
```

---

## 5. Commandes utiles (aide-mémoire)

| Je veux...                              | Je tape...                                   |
|-----------------------------------------|----------------------------------------------|
| Voir si l'app tourne                    | `docker ps`                                  |
| Voir les logs                           | `docker logs orchestr-a`                     |
| Voir les derniers logs en direct        | `docker logs orchestr-a -f --tail 50`        |
| Redémarrer l'application                | `docker restart orchestr-a`                  |
| Arrêter l'application                   | `docker stop orchestr-a`                     |
| Démarrer l'application                  | `docker start orchestr-a`                    |
| Voir l'espace disque Docker             | `docker system df`                           |
| Voir l'état des services internes       | `docker exec orchestr-a supervisorctl status` |
| Faire un backup de la base              | `docker exec orchestr-a gosu postgres pg_dump -d orchestr_a > backup.sql` |
| Vérification complète                   | `bash verify.sh`                             |

---

## 6. Contact

En cas de problème non résolu par ce guide :

**Alexandre BERGE**
- Fournissez les logs : `docker logs orchestr-a > erreur.log`
- Fournissez le résultat de : `bash verify.sh > diagnostic.txt`
