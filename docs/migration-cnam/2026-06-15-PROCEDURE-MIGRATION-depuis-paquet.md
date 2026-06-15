# Procédure de migration Orchestr'A → Ramage — à partir des paquets

> **Public** : l'admin qui déroule la migration. Aucune connaissance du projet supposée. **Périmètre** : **uniquement** la mise en service de l'application à partir des 2 paquets, sur la VM PLC (AlmaLinux 8.6) **avec Docker déjà installé**. **Ce n'est PAS** le README de livraison (qui explique TOUT, y compris la conversion OVF, le boot KVM, le Secure Boot, le banc d'essai…). Ici on **saute** ces étapes : elles sont faites ou hors de ton périmètre (voir §6). **Règle d'or** : la conservation des données (zéro perte) prime sur tout. Le script de restauration **refuse de redémarrer l'app** si la moindre donnée diffère.

---

## 0. Ce dont tu pars (état initial)

| # | Pièce | Fichier | Où |
|---|---|---|---|
| 1 | **Paquet de déploiement** (image + scripts, sans secret) | `livraison-orchestra-cnam.tar.gz` (908 Mo) | sur la VM |
| 2 | **Archive de données** (base + uploads + **secrets**) | `orchestra-snapshot-20260612T085110Z.tar.gz` (+ `.sha256`) | transmise **à part**, canal sécurisé |

+ une **VM PLC** avec **Docker + Docker Compose v2** déjà installés et actifs (`docker version` et `docker compose version` répondent), et un **disque data dédié** pour `/var/lib/docker-data` (l'image fait ~3 Go).

---

## 1. Le principe — à lire d'abord (5 lignes)

- On **ne migre PAS** le vieux Docker du cloud. On part d'une **image neuve** + un **volume vierge** + une **restauration logique** (`pg_restore`) des données. ⇒ **zéro miette** des anciennes versions par construction : l'instance Ramage ne contient QUE les données restaurées.
- On procède **comme en prod, en 2 temps** :
  - **Phase 1 — Recette** (répétition à blanc) : on déroule TOUT une fois, on vérifie, on **chronomètre**, on **fige**. Aucun impact utilisateur (le cloud tourne toujours).
  - **Phase 2 — Bascule** (mise en service réelle) : on **arrête les utilisateurs côté cloud**, on rejoue exactement la même chose avec la donnée finale, on bascule le trafic.
- **Filet de secours** : le cloud actuel reste **intact et en service** tant que la bascule n'est pas validée. Rien n'est destructif.

> ℹ️ **La « sauvegarde » dont parle le README, c'est sur le CLOUD (la source), pas sur ta VM.** Elle est **déjà faite** : c'est le paquet n°2. Tu n'y retouches **que** si tu veux rafraîchir la donnée le jour J (§4, étape B2). Sur ta VM cible, tu ne sauvegardes rien : tu restaures.

---

## 2. Préparation (une seule fois)

```bash
# 1. Vérifier l'intégrité de l'archive de données (paquet 2) AVANT toute chose
echo "$(cat orchestra-snapshot-20260612T085110Z.tar.gz.sha256)  orchestra-snapshot-20260612T085110Z.tar.gz" | sha256sum -c
#   -> doit afficher : ... OK

# 2. Décompresser le paquet de déploiement (paquet 1)
tar xzf livraison-orchestra-cnam.tar.gz
cd livraison-orchestra-cnam        # contient app/  scripts/  docs/  docker-rpms/
```

> **Si `docker` n'était PAS installé** sur la VM (cas où on ne réutilise pas une VM déjà prête) : voir l'**Annexe A** en fin de document. Sinon, passe directement à la Phase 1.

---

## 3. PHASE 1 — Recette (répétition à blanc, AUCUN impact utilisateur)

### 3.1 Charger l'image applicative

```bash
gunzip -c app/orchestr-a-local.tar.gz | docker load
docker image ls | grep orchestr-a        # -> orchestr-a   local
```

### 3.2 Récupérer les 2 secrets de la SOURCE (depuis l'archive de données)

Sur une **restauration**, deux secrets doivent être **identiques à la source**, sinon : l'historique d'audit devient incohérent et **l'API redémarre en boucle**.

```bash
# Extraire l'archive de données dans un dossier de travail
mkdir -p /tmp/snap && tar xzf <chemin>/orchestra-snapshot-20260612T085110Z.tar.gz -C /tmp/snap
# Lire les 2 valeurs à reporter dans le .env (ne pas les divulguer ailleurs) :
grep -E '^(AUDIT_HASH_KEY|JWT_SECRET)=' /tmp/snap/orchestra-snapshot-*/secrets.env
```

### 3.3 Écrire le fichier `.env` de l'application

```bash
cd app
cp .env.example .env
$EDITOR .env
```

Remplir ainsi (modèle complet — adapte les valeurs marquées 👉) :

```ini
POSTGRES_PASSWORD=<choisir un mot de passe ≥16 — À NOTER, réutilisé à l'étape 3.5>
REDIS_PASSWORD=<choisir un mot de passe>
JWT_SECRET=<👉 valeur lue à l'étape 3.2 (secrets.env)>
AUDIT_HASH_KEY=<👉 valeur lue à l'étape 3.2 (secrets.env)>
METRICS_TOKEN=<openssl rand -hex 32>
RBAC_GUARD_MODE=enforce
ALLOWED_ORIGINS=http://localhost           # en recette ; en prod : https://<hostname-interne>
HTTP_PORT=80
```

> ⚠️ **Les 2 valeurs `JWT_SECRET` et `AUDIT_HASH_KEY` viennent de l'archive (étape 3.2), pas d'un tirage aléatoire.** Ne lance **pas** `install-offline.sh` : il regénère des secrets aléatoires (bon pour une install vierge, **faux pour une restauration**).

### 3.4 Démarrer le conteneur (il crée une base VIDE)

```bash
docker compose -f docker-compose.offline.yml --env-file .env up -d
docker compose -f docker-compose.offline.yml ps      # -> état "running"/"health: starting"
```

### 3.5 Configurer le mécanisme de restauration

```bash
cd ../scripts
cp orchestra.conf.example orchestra.conf
$EDITOR orchestra.conf
```

Pour une restauration sur la cible, la **seule** valeur à ajuster est le mot de passe du rôle, qui **doit être IDENTIQUE** au `POSTGRES_PASSWORD` choisi en 3.3 :

```ini
ORCHESTRA_AIO_CONTAINER="orchestr-a"          # (défaut OK)
ORCHESTRA_AIO_IMAGE="orchestr-a:local"        # (défaut OK)
ORCHESTRA_AIO_DB="orchestr_a"                 # (défaut OK)
ORCHESTRA_AIO_RUNTIME_ROLE="orchestr_a"       # (défaut OK)
ORCHESTRA_AIO_RUNTIME_PASSWORD="<= le MÊME que POSTGRES_PASSWORD de l'étape 3.3>"
```

> Les champs `ORCHESTRA_SRC_*` (source) ne servent **qu'à `orchestra-backup.sh`** ; pour une restauration tu peux les ignorer.

### 3.6 Restaurer les données + PREUVE de zéro-perte

```bash
./orchestra-restore.sh --config orchestra.conf <chemin>/orchestra-snapshot-20260612T085110Z.tar.gz
```

Le script, dans l'ordre : vérifie le sha256 de l'archive → **garde-fou de parité des migrations** (l'image doit correspondre aux données) → restaure la base + les uploads dans un conteneur temporaire (app à l'arrêt) → **recompte chaque table + recalcule l'empreinte de la chaîne d'audit + compare les migrations** au manifeste → **tout écart = ÉCHEC, app laissée à l'arrêt** → ne redémarre QUE si tout est prouvé identique, puis attend `healthy`.

Attendu en fin d'exécution :
```
✓ Comptages par table IDENTIQUES (source ↔ restauré)
✓ Empreinte chaîne d'audit IDENTIQUE
✓ Migrations appliquées IDENTIQUES
════ RESTAURATION VÉRIFIÉE ET APPLICATION SAINE ════
```

### 3.7 Smoke-test applicatif

```bash
curl -s http://localhost/api/health          # -> {"status":"ok"}
```
Puis ouvre l'appli dans un navigateur et connecte-toi avec un compte témoin (les comptes sont ceux de la prod — l'admin habituel fonctionne). Vérifie : connexion OK, données présentes (projets/tâches/utilisateurs), une page ou deux.

### 3.8 Figer la recette

- **Chronomètre** le temps total des étapes 3.1 → 3.7. C'est ta **durée de fenêtre de bascule**.
- Note tout point d'adaptation rencontré (et remonte-le-moi : on ajuste avant la vraie bascule).
- **Recette validée** = tout vert + appli OK. Tu sais maintenant combien de temps ça prend et que ça marche **sur cette VM**.

---

## 4. PHASE 2 — Bascule réelle (mise en service)

> On rejoue à l'identique, mais avec la donnée **finale** et l'arrêt des utilisateurs.

**B1 — Annonce + gel.** Informer les utilisateurs ; **arrêter l'usage côté cloud** (lecture seule, ou maintenance). Objectif : plus aucune écriture sur le cloud pendant la bascule.

**B2 — Donnée à jour ? (Go/No-Go).**
- Si **personne n'a écrit depuis le 12/06**, le snapshot du paquet 2 **est** la donnée finale → rien à faire, on réutilise l'archive existante.
- Sinon, **rafraîchir** : sur le **cloud** (la source), une commande **en lecture seule** produit un snapshot frais (cf. `scripts/orchestra/orchestra-backup.sh` côté source) ; on transfère ce nouveau `.tar.gz` (+ `.sha256`) et on l'utilisera à la place à l'étape B4.

**B3 — Repartir propre sur la VM** (efface la recette pour ne garder AUCUNE miette) :
```bash
cd app
docker compose -f docker-compose.offline.yml --env-file .env down -v   # supprime le volume de recette
docker compose -f docker-compose.offline.yml --env-file .env up -d      # volume vierge
```

**B4 — Restaurer + preuve** (identique à 3.6, avec l'archive finale) :
```bash
cd ../scripts
./orchestra-restore.sh --config orchestra.conf <chemin>/<archive finale>.tar.gz
```
→ **Go** seulement si « comptages + empreinte d'audit + migrations IDENTIQUES ». Tout écart = **No-Go** (l'app reste à l'arrêt, on investigue).

**B5 — Smoke** : `/api/health` 200 + connexion d'un compte témoin (comme 3.7).

**B6 — Bascule du trafic** vers l'instance interne (DNS / reverse-proxy / TLS de l'AC interne). *Périmètre infra CNAM* — hors de ce script.

**B7 — Rollback** : tant que B6 n'est pas validé, le cloud n'a pas été touché (le backup est en lecture seule) → on repointe simplement le trafic vers le cloud. Une fois validé et stable, le contenu de l'ancienne VM cloud peut être abandonné.

---

## 5. Dépannage minimal

| Symptôme | Cause la plus probable | Action |
|---|---|---|
| Le conteneur **redémarre en boucle** | `AUDIT_HASH_KEY`/`METRICS_TOKEN` absents ou faux dans `.env` | `docker logs --tail 50 orchestr-a` ; vérifier les 2 secrets (étape 3.2/3.3) |
| L'API monte mais **ne lit pas la base** après restore | `POSTGRES_PASSWORD` (.env) ≠ `ORCHESTRA_AIO_RUNTIME_PASSWORD` (orchestra.conf) | aligner les deux (étape 3.5), relancer la restore |
| Restore : « **image trop ancienne** » | l'image livrée est antérieure aux données | ne pas forcer ; me remonter le message (il faut une image au commit ≥ source) |
| Restore : « migrations NON présentes dans les données » | image **plus récente** que les données | montée de version contrôlée : relancer avec `--allow-migrate` **seulement si décidé** (cf. Annexe B) |
| `Permission denied` au montage `/restore` (conteneur temporaire) | **SELinux enforcing** bloque le bind-mount `-v` (vécu en mars 2026) | le PLC cible est en **permissive** → OK. Sinon : `sudo setenforce 0` le temps du restore (puis `setenforce 1`), **ou** ajouter `,z` aux deux `-v` du script (`-v "$SNAP:/restore:ro,z"`) |
| `/api/health` ne répond pas | démarrage long (jusqu'à ~90 s) | attendre, puis `docker compose -f docker-compose.offline.yml logs -f` |

---

## 6. Ce que tu peux IGNORER dans le README / RUNBOOK

Ces sections existent pour la traçabilité complète et le banc d'essai ; **elles ne font pas partie de ta procédure** dans ce cas (VM déjà prête, Docker déjà là) :

- Conversion **OVF → qcow2**, démarrage **KVM**, **Secure Boot / NX**, disque **SATA** (RUNBOOK §A3–A5).
- **Banc d'essai** et preuves de faisabilité (déjà validées : 2026-06-08/09).
- Partie « architecture prod actuelle » / historique d'hébergement du README.
- `install-offline.sh` (génère des secrets aléatoires → **inadapté à une restauration**).

---

## Annexe A — Si Docker n'est PAS installé (sinon ignorer)

À faire **dans la VM**, hors-ligne, depuis le paquet (`docker-rpms/` fourni). **Ne PAS** faire `dnf install ./*.rpm` (cela mettrait à jour le socle durci du PLC). On passe par un **dépôt local** + `module_hotfixes` (4 dépendances modulaires) :

```bash
sudo dnf install -y --repofrompath="be,file://$PWD/docker-rpms" --repo=be \
  --nogpgcheck --setopt=be.module_hotfixes=true \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Data-root sur le disque data dédié (le /var du PLC = 2 Go, non extensible) :
sudo mkfs.xfs -f /dev/sdX && sudo mkdir -p /var/lib/docker-data && sudo mount /dev/sdX /var/lib/docker-data
echo '{ "data-root": "/var/lib/docker-data" }' | sudo tee /etc/docker/daemon.json
sudo systemctl enable --now docker
docker version && docker compose version      # -> Docker 26.1.3, compose v2
```
(Pense à pérenniser le montage dans `/etc/fstab`.) Détails : RUNBOOK §A6.

---

## Annexe B — Les pièges de la 1ʳᵉ session d'hébergement (mars 2026) sont déjà neutralisés

> Contexte : la toute première mise en service (mars 2026, bac à sable) a demandé **3 jours d'allers-retours** pour réussir **une seule** restauration. Le script `orchestra-restore.sh` de ton paquet est la **version durcie** de ce qui a fini par marcher (il descend directement du `fix-restore.sh` de mars). Chaque échec d'alors est désormais évité **par conception** — tu n'as donc plus à les corriger à la main :

| Échec de mars 2026 | Pourquoi | Pris en charge par le script actuel |
|---|---|---|
| `pg_restore --clean` : « cannot drop … users_pkey », **18 erreurs**, users doublés | la base cible avait déjà booté → Prisma y avait créé des tables plus récentes (`events`, `event_participants`) absentes du dump ; `--clean` ne savait pas les supprimer | **`DROP SCHEMA public CASCADE`** sur un volume **vierge** + `pg_restore` **sans** `--clean`. Plus aucune collision. |
| `relation "_prisma_migrations" does not exist` au redémarrage | restore fait **en tant que `postgres`** → tables possédées par postgres ; l'app se connecte en `orchestr_a` qui ne « voit » rien (PG renvoie « does not exist », trompeur) | **restore fait directement EN TANT QUE `orchestr_a`** (`pg_restore --role`, schéma créé `AUTHORIZATION orchestr_a`). Le bon propriétaire dès le départ. |
| `REASSIGN OWNED BY postgres` échoue (objets système non transférables) | transfert de propriété en masse impossible | on **ne réassigne pas** : on restaure sous le bon rôle d'emblée. |
| le correctif « ne s'exécute jamais » | `docker run` **sans `--entrypoint`** → l'entrypoint de l'image tournait à la place du script | le conteneur temporaire est lancé avec **`--entrypoint bash`**. |
| `Permission denied` sur les fichiers montés (`-v`) | **SELinux** (host RHEL *enforcing*) bloque les bind-mounts hôte | le PLC cible est en **permissive** (validé) → non bloquant. Sinon : voir §5 (ligne SELinux). |
| **8 migrations** appliquées au 1ᵉʳ démarrage | image plus récente que le dump | **normal et sûr** : l'entrypoint joue `prisma migrate deploy` **sans toucher aux données**. Le garde-fou de parité te prévient *avant* (cf. §5). |

**Preuve que ça aboutit (situation ACTUELLE, pas mars)** : le **paquet actuel** (PG18, données du **12/06**) a été validé **zéro-perte** au banc d'essai (2026-06-08/09) puis **rejoué le 12/06** sur le snapshot livré — comptages par table + empreinte de chaîne d'audit + migrations **IDENTIQUES**, app `healthy`, air-gap prouvé. État réellement restauré aujourd'hui : **41 users / 41 projets / 327 tâches / 1042 sous-tâches / 219 audit_logs** (empreinte d'audit `16c239e6…`). Surtout : `orchestra-restore.sh` **re-prouve le zéro-perte à CHAQUE exécution** (comparaison stricte au manifeste, refus de démarrer en cas d'écart) — la preuve est donc **rejouée chez toi**, elle ne dépend pas d'un run passé. *(Mars 2026, à titre purement historique : 44/21/185 sous PG16 — autres données, autre version PostgreSQL.)*
