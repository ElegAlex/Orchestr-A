# Runbook — Mise à jour d'Orchestr'A en prod sur Ramage (air-gap)

> **Public** : l'admin qui applique une MAJ de code sur le PLC Ramage (AlmaLinux 8.6, air-gap, Docker, derrière Apache httpd → `127.0.0.1:3000`).
> **Périmètre** : appliquer une **évolution / remédiation de code** sur une instance **déjà en service**, en **préservant les données vivantes**. **Ce n'est PAS** la première migration (volume vierge + restore d'un snapshot) — celle-ci a sa propre procédure : `2026-06-15-PROCEDURE-MIGRATION-depuis-paquet.md`.
> **Règle d'or** : on ne **rejoue JAMAIS** un ancien snapshot sur la prod (ça écraserait les écritures). Une MAJ = **nouvelle image + migrations Prisma par-dessus les données existantes**. Et **on sauvegarde AVANT** (le filet « cloud intact » n'existe plus).

---

## 1. Modèle mental (à lire d'abord)

| | Première migration | **Mise à jour (ce runbook)** |
|---|---|---|
| Volume de données | **vierge**, on `pg_restore` un snapshot | **conservé** (les données live de Ramage) |
| Source des données | snapshot du cloud (12/06) | la prod Ramage elle-même |
| Geste DB | restauration logique | **`prisma migrate deploy`** par-dessus l'existant |
| Snapshot du 12/06 | la donnée | **interdit de le rejouer** (périmé, écraserait la prod) |
| Filet | cloud encore en ligne | **backup pris juste avant la MAJ** |

L'air-gap impose : **pas de `git pull` / pas de GHCR**. Chaque MAJ = un **paquet offline reconstruit** au nouveau commit, transféré par canal scellé, appliqué à la main.

---

## 2. Classer le changement → choisir le geste le plus léger qui reste sûr

La **note de release** du paquet (cf. `TEMPLATE-note-de-release-paquet.md`) déclare le **palier**. C'est lui qui dicte le geste.

| Palier | Nature | Présence de migration | Geste d'application |
|---|---|---|---|
| **T0 — code seul** | bugfix logique, sécu (guard / RBAC template / CSP), front, config | **aucune** (`prisma/migrations/` inchangé) | **§4.3** échange d'image en place |
| **T1 — migration additive** | nouvelle table / colonne **nullable** / index / default. Aucune perte possible | additive, non destructive | **§4.4** échange en place **+ migrate au boot** |
| **T2 — migration destructive / transformante** | drop / rename colonne, backfill, changement de type, fusion de données | destructive ou transforme des données | **§4.5** 2 temps : **répétition sur copie** → bascule |

> En cas de doute sur le palier → **traiter en T2** (le plus prudent). Un T2 mal classé en T0/T1 peut perdre des données ; l'inverse ne coûte que du temps.

---

## 3. Côté dépôt — construire le paquet de MAJ (équipe / build connecté)

À chaque release (au fil de l'eau, groupée quand pratique) :

1. Remédiations mergées sur `master`, **build vert + tests + E2E**.
2. Construire l'**image all-in-one** au commit cible et l'exporter (`app/orchestr-a-local.tar.gz`).
3. Assembler le **paquet offline** au **layout v2** : `app/` (image + `docker-compose.offline.yml` + `.env.example`), `scripts/` (`orchestra-*.sh`, `orchestra.conf.example`), `docs/`. **Sans** `install-offline.sh` (retiré).
4. **Sceller** : `sha256sum` du `.tar.gz` + rédiger la **note de release** (commit, sceau, **palier max**, migrations incluses, instructions d'apply).
5. Transférer (USB / canal sécurisé) à l'opérateur PLC.

> ⚠️ **À ré-outiller** : `scripts/build-offline-package.sh` est **l'ancien builder** (il fait `docker pull ghcr…:latest`, produit l'ancien layout `images/orchestr-a.tar` + `install.sh`, embarque `install-offline.sh`). Il **ne produit pas** le paquet v2 actuel. Tant qu'il n'est pas refait au layout v2, le paquet se reconstruit selon le procédé ayant produit le sceau `7ff6d822…` (cf. `2026-06-12-VALIDATION-ARTEFACT-paquet.md`). **Ne pas** s'appuyer aveuglément sur ce script.

---

## 4. Côté PLC Ramage — appliquer la MAJ (air-gap)

Squelette commun aux 3 paliers : **vérifier le sceau → backup-first → charger l'image (garder N-1) → appliquer selon le palier → vérifier → (rollback si besoin)**.
Dossier de travail de référence : `/docker/livraisons/`. Compte non-root (`udocker`).

### 4.0 Vérifier le sceau

```bash
cd /docker/livraisons
sha256sum livraison-orchestra-cnam.tar.gz      # doit matcher la note de release
tar xzf livraison-orchestra-cnam.tar.gz && cd livraison-orchestra-cnam
gunzip -c app/orchestr-a-local.tar.gz | docker load   # charge la NOUVELLE image orchestr-a:local
```

### 4.1 Backup-first (le filet) — OBLIGATOIRE aux 3 paliers

But : capturer la prod **vivante** avant d'y toucher. Le backup sert de **rollback** (T1/T2) et de **source de répétition** (T2).

```bash
# Dump cohérent de la base live (depuis l'all-in-one) :
docker exec orchestr-a sh -c 'pg_dump -U orchestr_a -Fc --no-owner --no-privileges -d orchestr_a' \
  > /docker/livraisons/backup-pre-maj-$(date -u +%Y%m%dT%H%M%SZ).dump
# Uploads (dans le volume unique de l'all-in-one, sous /data/uploads) :
docker exec orchestr-a sh -c 'cd /data/uploads && tar czf - .' \
  > /docker/livraisons/uploads-pre-maj-$(date -u +%Y%m%dT%H%M%SZ).tgz
```

> ⚠️ **À ré-outiller** : `scripts/orchestra/orchestra-backup.sh` vise la source **multi-conteneurs** (`ORCHESTRA_SRC_*`, volume uploads séparé) ; il ne couvre pas tel quel l'**all-in-one à volume unique** (uploads en sous-chemin `/data/uploads`). En attendant un **mode AIO**, utiliser le `docker exec` ci-dessus. Idéalement, ajouter à `orchestra-backup.sh` une cible AIO produisant la même archive vérifiable (db.dump + uploads + manifeste comptages/audit/migrations).

### 4.2 Garder l'image précédente (rollback rapide T0)

À faire **avant** que le `docker load` du §4.0 n'écrase le tag (ou retaguer l'image courante juste avant de charger) :

```bash
docker tag orchestr-a:local orchestr-a:prev-$(date +%Y%m%d) 2>/dev/null || true
docker image ls | grep orchestr-a
```

### 4.3 Palier T0 — code seul (aucune migration)

```bash
cd /docker/livraisons/livraison-orchestra-cnam/app
docker compose -f docker-compose.offline.yml --env-file .env up -d   # recrée le conteneur sur la NOUVELLE image
# le volume orchestr-a-data est CONSERVÉ (surtout PAS -v)
```
→ aller en **§4.6 (vérifier)**.

### 4.4 Palier T1 — migration additive

Identique à T0 : `up -d` recrée le conteneur ; l'**entrypoint joue `prisma migrate deploy`** au boot et applique les nouvelles migrations **sans toucher aux données**.

```bash
cd /docker/livraisons/livraison-orchestra-cnam/app
docker compose -f docker-compose.offline.yml --env-file .env up -d
docker logs -f orchestr-a   # observer "migrate deploy" : N migrations appliquées
```
→ aller en **§4.6 (vérifier)**.

### 4.5 Palier T2 — migration destructive / transformante (2 temps)

**Temps 1 — répétition sur copie (aucun impact prod).** On vérifie que la nouvelle image migre proprement une **copie** des données live, avant d'y toucher en vrai. La répétition réutilise le harnais auto-vérifiant (`orchestra-restore.sh --allow-migrate`) :

1. Empaqueter le backup du §4.1 au format attendu par le restore (archive `db.dump` + `uploads.tgz` + sha) **ou** restaurer le `db.dump` dans un **all-in-one scratch** (autre `name:` compose, autre volume).
2. `./orchestra-restore.sh --config orchestra.conf --allow-migrate <archive-du-backup-live>` sur le scratch.
3. Vérifier : `RESTAURATION VÉRIFIÉE` (zéro-perte **avant** migration) + migrations appliquées + **contrôles métier** propres aux données transformées (compter/échantillonner ce que la migration modifie).

**Temps 2 — bascule prod.** Une fois la répétition OK :

```bash
cd /docker/livraisons/livraison-orchestra-cnam/app
docker compose -f docker-compose.offline.yml --env-file .env up -d   # volume live CONSERVÉ, migrate au boot
```
→ aller en **§4.6 (vérifier)**.

### 4.6 Vérifier (aux 3 paliers)

```bash
docker compose -f docker-compose.offline.yml ps      # health: healthy (jusqu'à ~90 s)
curl -s http://localhost:3000/api/health             # {"status":"ok"}
docker logs --tail 30 orchestr-a | grep -i migrat    # migrations appliquées = celles de la note de release
```
+ **smoke métier** via le hostname Apache (`http://orchestra.cpam-hauts-de-seine.ramage`) : connexion d'un compte témoin, données présentes, 1–2 pages clés. Pour un **T2**, re-contrôler spécifiquement les données transformées.

### 4.7 Rollback

| Palier | Rollback |
|---|---|
| **T0** | re-taguer l'image N-1 et relancer : `docker tag orchestr-a:prev-<date> orchestr-a:local && docker compose -f docker-compose.offline.yml --env-file .env up -d` (aucun changement de schéma) |
| **T1 / T2** | les migrations ne se « dé-appliquent » pas → **restaurer le backup du §4.1** : `down -v` puis restaurer le `db.dump` + uploads pré-MAJ dans l'image **précédente** (`orchestr-a:prev-<date>`). C'est pourquoi le backup-first est non négociable. |

---

## 5. « Definition of Done » d'une remédiation (côté dépôt)

Une remédiation/évolution n'est **finie** que quand :

- [ ] code mergé sur `master` + **build vert + tests/E2E**
- [ ] **palier déclaré** (T0 / T1 / T2) dans la PR + **revue migration-safety** (aucun destructif non planifié ; une migration destructive = T2 assumé)
- [ ] **paquet offline reconstruit & scellé** au nouveau commit (ou embarqué dans la prochaine release groupée)
- [ ] **note de release** rédigée (cf. template) + instructions d'apply
- [ ] ce runbook relu si le palier l'exige (T2)

---

## 6. Points à outiller / À CONFIRMER (registre)

| # | Sujet | État |
|---|---|---|
| U1 | **Builder de paquet v2** : refaire `build-offline-package.sh` au layout v2 (image au commit, sans `install-offline.sh`, sceau + note de release auto) | à faire |
| U2 | **Backup mode AIO** : variante de `orchestra-backup.sh` ciblant l'all-in-one à volume unique (`/data/uploads`), produisant une archive vérifiable (comptages + audit + migrations) | à faire |
| U3 | **Qui applique** sur le PLC + fenêtre de maintenance (opérateur air-gap : Bobby Destine) | à confirmer |
| U4 | **Rétention** des backups pré-MAJ sur le PLC (combien, où) | à confirmer |
| U5 | Option : script `orchestra-update.sh` orchestrant backup → load → apply-par-palier → verify | non décidé |

---

## Annexe — voir aussi

- Première migration (amorçage) : `2026-06-15-PROCEDURE-MIGRATION-depuis-paquet.md` (+ Annexe C reverse-proxy Apache).
- Validation d'artefact / sceau : `2026-06-12-VALIDATION-ARTEFACT-paquet.md`.
- Template de note de release : `TEMPLATE-note-de-release-paquet.md`.
