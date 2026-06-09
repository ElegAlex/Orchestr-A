# Banc d'essai PLC air-gap & migration Assurance Maladie — Design / Spec

> **Statut** : design validé sur les grandes lignes (en attente de relecture).
> **Date** : 2026-06-08.
> **Auteur** : conception assistée (Claude) — relecture humaine requise avant exécution.
> **Périmètre d'exécution de la phase de conception** : LOCAL UNIQUEMENT. Aucune action
> destructive ni déploiement contre la prod sans feu vert explicite, par tâche.

---

## 1. Objectif

Transformer le VPS de préproduction en **réplique fidèle de l'environnement cible CNAM**
(OS PLC Assurance Maladie AlmaLinux 8.6, conditions **air-gapped**), y faire tourner
**OFS Tracker** (= l'application Orchestr'A) via un docker-compose autonome, et **valider
que l'hébergement embarque la base de données en un seul bloc consolidé et reproductible**.

**Contrainte n°1, au-dessus de tout : conservation des données — zéro perte.** Elle
s'applique deux fois :
1. **Maintenant** — préserver les données lors de la mise en place du banc d'essai.
2. **Phase 2 (jour J)** — reprendre les données *au moment exact* de la bascule vers le
   réseau interne Assurance Maladie.

→ Conséquence de conception : le mécanisme de sauvegarde/restauration n'est **pas** un
script jetable mais un **outil fiable, paramétré, idempotent et REJOUABLE à l'identique**.
La vérification d'intégrité automatisée *est* la preuve de non-perte.

La **phase 2 (mise en œuvre de la bascule réseau)** est **hors périmètre d'exécution** ici ;
elle est en revanche **entièrement documentée** (voir §10) comme finalité du projet.

---

## 2. Faits établis (vérifiés, ne pas re-supposer)

### 2.1 OS PLC (dépôt local `/home/alex/Documents/REPO/PLC_ALMA_LINUX_8-6`)
[FAIT — vérifié sur fichiers]
- **Appliance VMware OVF**, pas un kickstart : `ovf-plc8-almalinux86.ovf` +
  `ovf-plc8-almalinux86-1.vmdk` (1,5 Go, `streamOptimized`) + `*.nvram` + manifeste `.mf`.
- Firmware **EFI + Secure Boot activé**, matériel `vmx-14`, contrôleur **pvscsi**,
  carte réseau **VmxNet3**, **disque 26 Go** (27 917 287 424 octets), RHEL8/Alma 8.6.
- C'est un **OS-hôte scellé** : OFS Tracker y tourne **en Docker**, pas en natif.

### 2.2 VPS source (prod `92.222.35.25` / `/opt/orchestra`) — inspection lecture seule 2026-06-08
[FAIT — vérifié en lecture seule]
| Élément | Valeur | Conséquence |
|---|---|---|
| Virtualisation imbriquée | `vmx`×8, `/dev/kvm` présent | Le PLC peut tourner en **KVM** sur le VPS (non destructif) |
| Ressources | 4 vCPU, ~5 Go RAM libres, ~51 Go disque libres (/ = 74 Go) | Suffisant pour un invité PLC |
| **PostgreSQL** | **18.3** (`postgres:18-alpine`) | La cible all-in-one DOIT être en **PG18** (cf. §6) |
| Données | **DB ≈ 48 Mo + uploads ≈ 3,8 Mo ≈ 52 Mo** | Sauvegarde à chaud quasi instantanée ; fenêtre d'incohérence ~nulle |
| Rôles DB | `app_user` (runtime) / `postgres` (owner/migration) | Décalage avec l'all-in-one (rôle unique `orchestr_a`) → neutraliser à la sauvegarde |
| Secrets sensibles | `JWT_SECRET`, **`AUDIT_HASH_KEY`** | Font partie des « données » (cf. §5.2) |
| Résidus | 2 conteneurs `orchestra-api-run-*` (Up 2–5 sem.) | Cruft `docker compose run`, à nettoyer, non bloquant |

### 2.3 Acquis applicatifs déjà présents dans le dépôt (à RÉUTILISER, ne pas recréer)
[FAIT — vérifié sur fichiers]
- **Bulle air-gap** : `docker-compose.offline.yml` → image **all-in-one** `orchestr-a:local`
  (Postgres + Redis + API + Web + nginx + supervisor dans **1 conteneur**, **1 volume
  `/data`**), packagée par `scripts/build-offline-package.sh` (`docker save` → `.tar.gz`),
  installée par `install-offline.sh` (`docker load` → secrets → `up`).
- **Consolidation `/data` confirmée** : `docker/all-in-one/entrypoint.sh` lie
  `/app/uploads → /data/uploads` (l. 218-227) ; avec `/data/postgresql`, `/data/redis`,
  `/data/.jwt_secret`, **`/data` est bien le bloc consolidé unique**.
- **Backup/restore existant** : `scripts/backup-database.sh` (pg_dump + gzip + rétention)
  et `scripts/restore-database.sh` (gunzip + psql). **Limites** : DB seule, **aucune
  vérification d'intégrité**, non paramétré pour le jour J. → base à étendre, pas à jeter.
- **Audit scellé** : `audit_logs` utilise un schéma de hash double (segment scellé
  SQL-canonique + `computeRowHash` TS). **Ne jamais réimplémenter le hash** ; réutiliser
  les scripts de vérification existants.

---

## 3. Décisions validées (avec l'opérateur, 2026-06-08)

| # | Décision | Choix retenu |
|---|---|---|
| D1 | Forme cible dans le PLC | **Image all-in-one** (1 conteneur, `/data` unique) |
| D2 | Source des données | **VPS prod `92.222.35.25` / `/opt/orchestra`** (PostgreSQL 18.3) |
| D3 | Stratégie PLC | **VM imbriquée KVM** sur le VPS (**non destructif** — l'OS du VPS reste) |
| D4 | Cohérence de sauvegarde | **À chaud, sans arrêt applicatif** (justifié : ~52 Mo de données) |

---

## 4. Architecture du banc d'essai

```
VPS 92.222.35.25  ─ OS actuel CONSERVÉ (host, NON reformaté) ───────────────┐
   └── KVM / libvirt                                                         │
        └── réseau libvirt ISOLÉ (aucune route sortante = air-gap simulé)    │
             └── Invité = PLC AlmaLinux 8.6  (OVF → VMDK converti en qcow2)   │
                  └── Docker Engine + compose v2  (RPM du PLC / side-load)    │
                       └── docker-compose.offline.yml                        │
                            └── orchestr-a:local (all-in-one, PG18 ✏️)        │
                                 └── volume /data  ← LE bloc consolidé        │
   transfert host→invité du paquet offline via canal isolé (9p / ISO / scp)  ┘
```

**Air-gap** = absence d'**Internet** ; le transfert host→invité sur un réseau *isolé*
(host-only) est autorisé et reproduit la « bulle » réelle. Aucune image n'est tirée d'un
registre au runtime (`pull_policy: never`, images chargées via `docker load`).

---

## 5. Périmètre des données

### 5.1 À préserver (le « bloc » zéro-perte)
- **Base PostgreSQL** (dump logique) — la donnée métier.
- **Uploads** (`/app/uploads` ↔ volume `orchestr-a-api-uploads-prod`) — fichiers utilisateurs.
- **Secrets** : `JWT_SECRET`, `AUDIT_HASH_KEY` (cf. 5.2).

### 5.2 Pourquoi les secrets sont « de la donnée »
[INFÉRENCE EXPERTE — corrige un risque d'intégrité silencieux]
Le journal `audit_logs` est scellé par HMAC dérivé d'`AUDIT_HASH_KEY`. **Restaurer la base
avec une clé différente casse la vérification de la chaîne d'audit** (les hash stockés ne
correspondent plus). `AUDIT_HASH_KEY` (et `JWT_SECRET`) doivent donc **voyager avec les
données**. Ils sont **fournis/confirmés par l'opérateur** ; la conception **ne lit pas
`.env.production`** d'elle-même.

### 5.3 Exclus du périmètre (anti-sur-ingénierie, justifié)
- **Redis** : cache régénérable (RBAC résolu compile-time, compteurs de throttling). On le
  vide/reconstruit au lieu de le restaurer.
- **Certbot / certificats** : Let's Encrypt du domaine public — inutiles dans la bulle
  interne (hostname + AC internes différents).
- **Logs** (`api_logs`, `nginx_logs`) : non nécessaires à la continuité.

---

## 6. Prérequis « code » : aligner l'all-in-one sur PostgreSQL 18

[FAIT — risque confirmé] La prod est en **PG18**. L'image all-in-one installe le
PostgreSQL **par défaut d'Ubuntu 24.04** (= PG16 [INFÉRENCE]). Or **une restauration
logique d'un dump PG18 dans un PG16 est un downgrade non supporté → échec → perte**, et
ce serait **invisible** sur une préprod déjà en 16 (faux vert).

**Correctif** : modifier `docker/all-in-one/Dockerfile` pour installer **PostgreSQL 18**
depuis le dépôt **PGDG** (au lieu du paquet `postgresql` d'Ubuntu), puis reconstruire et
ré-exporter l'image. Règle générale : **la version PG de la cible ≥ version PG de la
source**, idéalement **identique**.

---

## 7. Le mécanisme rejouable (cœur du livrable)

Un **couple de scripts paramétrés** par un fichier de configuration (qui désigne les noms
de conteneurs / DB / volumes / chemins). **Le même outil sert maintenant ET au jour J** :
on ne change que la config.

### 7.1 `ofs-backup.sh` (à chaud, contre la source)
1. **DB** : `pg_dump -Fc --no-owner --no-privileges` →
   - format `custom` (compressé, restaurable sélectivement),
   - `--no-owner --no-privileges` **neutralise les rôles** (résout `app_user`/`postgres`
     → `orchestr_a`),
   - cohérent par nature (snapshot MVCC) → **aucun arrêt**.
2. **Uploads** : archive `tar` du volume uploads (lecture seule).
3. **Secrets** : capture de `JWT_SECRET` + `AUDIT_HASH_KEY` (**fournis par l'opérateur**).
4. **Manifeste d'intégrité** `MANIFEST.json` : horodatage UTC, hôte source, **version PG**,
   tailles, **sha256** de chaque artefact, **comptage par table** (`COUNT(*)` ordonné +
   `n_live_tup`), état `_prisma_migrations`, version applicative (`RELEASE_SHA`).
5. **Archive unique** `ofs-snapshot-<UTC>.tar.gz` + sha256, **poussée HORS du VPS** vers un
   **NAS interne maîtrisé** (droits d'accès restreints ; **pas de chiffrement d'archive** —
   protection assurée par le contrôle d'accès du NAS + permissions FS `600`) ; rétention
   paramétrable.

### 7.2 `ofs-restore.sh` (contre la cible all-in-one)
1. Vérifie sha256 de l'archive + cohérence du `MANIFEST.json`.
2. `pg_restore --clean --if-exists --no-owner --no-privileges` du dump.
3. Restaure les uploads dans le volume cible.
4. Réinjecte les secrets ; ré-applique les droits cibles (l'entrypoint all-in-one fait déjà
   `ALTER SCHEMA public OWNER TO orchestr_a` — idempotent).
5. **Re-vérification (preuve de non-perte)** : recompte les tables, recalcule les checksums,
   **re-vérifie la chaîne d'audit** (réutilise l'outil existant) → **tout écart = ÉCHEC =
   abandon** avant remise en service.
6. Redémarre l'appli, contrôle `/api/health` + **smoke fonctionnel** (login).

### 7.3 Option « ceinture-et-bretelles » (recommandée, coût négligeable)
Vu les ~52 Mo, ajouter en doublon un **tar physique de `/data`** (cible all-in-one, à froid
optionnel) à côté du dump logique. Marge zéro-perte maximale pour un surcoût quasi nul.

---

## 8. Vérification d'intégrité & Definition of Done

Le banc d'essai est « DONE » si **et seulement si** :
- [ ] **Zéro perte vérifiée** : comptage par table source == cible, sha256 conformes,
      chaîne d'audit valide après restauration. **(critère premier)**
- [ ] L'application démarre dans le PLC, `/api/health` OK, login OK.
- [ ] **Air-gap prouvé** : depuis l'invité PLC, toute sortie Internet échoue (test egress),
      et l'appli fonctionne quand même.
- [ ] `/data` est l'unique porteur d'état (DB + uploads + secret) — bloc consolidé.
- [ ] Le couple backup/restore est **rejouable** (2 exécutions → même résultat vérifié).
- [ ] Rollback testé (cf. §9).

---

## 8bis. Résultats de validation (2026-06-08)

Mécanisme exécuté de bout en bout : **sauvegarde de la VRAIE prod → restauration dans
l'all-in-one PG18 local → preuve de non-perte.**

**Backup prod (lecture seule)** — `ofs-snapshot-20260608T140155Z` :
- PostgreSQL **18.3**, connexion rôle `orchestr_a` (socket `trust`). ⚠️ Le superuser/propriétaire
  prod s'appelle **`orchestr_a`, PAS `postgres`** (`DATABASE_USER` surchargé dans `.env.production`) —
  paramétré via `OFS_SRC_PG_SUPERUSER`.
- dump 560 Ko, **45 tables**, **8 uploads** (3,7 Mo), empreinte d'audit `7463aa07…`,
  release `30511717` ; archive 4,2 Mo, sha256 vérifié, rapatriée.

**Restauration + vérification** :
- archive conforme, **parité migrations exacte**, restauration EN TANT QUE `orchestr_a`
  (superuser ; modèle mono-rôle = prod), uploads vérifiés fichier par fichier ;
- **PREUVE ZÉRO-PERTE** : comptages par table **IDENTIQUES** (45 tables) ; empreinte de
  chaîne d'audit **IDENTIQUE** (`audit_logs` restauré bit-à-bit) ; migrations **IDENTIQUES** ;
  le rôle Prisma `orchestr_a` lit **41 utilisateurs** dans la base restaurée.

**Démonstration applicative complète** : après les 4 correctifs ci-dessous, l'all-in-one PG18
démarre **`healthy`** (api+web+nginx+postgres+redis RUNNING), `GET /api/health` → `200
{"status":"ok"}`, et sert les données prod restaurées (41 users, 40 projets, 323 tâches,
174 audit_logs). **DoD §8 atteint** (zéro perte vérifiée + app saine).

### Validation IN-PLC (2026-06-09) — banc d'essai dans le vrai PLC, air-gappé
Exécuté DANS un invité KVM du PLC AlmaLinux 8.6 (SB-OFF, SATA, **aucun réseau**), bundle
livré par ISO9660 + disque data dédié :
- **Docker 26.1.3 installé + actif dans le PLC durci** (overlay2, cgroup v1, **aucun AVC
  SELinux**) → **R2 levé : Docker tourne dans le PLC** (SELinux `permissive`).
- **Restore + PREUVE ZÉRO-PERTE à l'intérieur du PLC** : comptages + empreinte d'audit +
  migrations IDENTIQUES ; `orchestr_a` lit 41 users ; `/api/health` → 200 ; **egress bloqué**
  (air-gap prouvé). DoD air-gap §8 atteint.

**Findings de déploiement (À TRANSMETTRE infra CNAM)** :
1. **Stockage** : LV du PLC petits (`/var` 2 Go, `/opt` 123 Mo) **et VG quasi plein
   (~740 Mo libres)** → `/var` NON extensible. → **prévoir un disque/volume data dédié
   (~10 Go+)** pour le data-root Docker (`/etc/docker/daemon.json`).
2. **Modularité** : `container-selinux`, `fuse-overlayfs`, `slirp4netns`, `libslirp` sont
   des paquets modulaires → install hors-ligne avec `--setopt=<repo>.module_hotfixes=true`.
3. **fs cross-distro** : un fs créé sur poste récent (Fedora) n'est PAS montable par le
   noyau 4.18 du PLC → livrer le bundle en **ISO9660**, et formater tout disque data
   **par le PLC lui-même**.

**4 bugs de bit-rot de l'all-in-one découverts et corrigés grâce au banc d'essai** (sans eux
l'image ne build/boot pas) :
1. `docker/all-in-one/Dockerfile` — chemin bcrypt figé `5.1.1` → résolution dynamique (lockfile en 6.0.0).
2. `docker-compose.offline.yml` + `install-offline.sh` — `AUDIT_HASH_KEY`/`METRICS_TOKEN`
   manquants (API crash-loop : substitution supervisord).
3. `docker/all-in-one/entrypoint.sh` — `DATABASE_MIGRATION_URL` manquant (schema.prisma `directUrl` → P1012).
4. `docker/all-in-one/Dockerfile` — package workspace `rbac` non copié au runtime
   (`Cannot find module 'rbac'`) ; aligné sur `apps/api/Dockerfile`.

## 9. Rollback

- **Banc d'essai** (non destructif par conception) : l'OS du VPS et ses données restent en
  place ; en cas d'échec, on **supprime l'invité KVM** — la prod n'est jamais touchée.
- **Filet supplémentaire** : **snapshot fournisseur du VPS** avant de commencer (à
  confirmer selon l'offre), + archive `ofs-snapshot-*` hors-VPS conservée.
- **Données** : `ofs-restore.sh` rejoue une archive antérieure validée si besoin.

---

## 10. Phase 2 — Dossier de migration Assurance Maladie (livrable final didactique)

**Finalité du projet.** Document autoportant permettant de **valider et exécuter la bascule
réelle** vers le réseau interne, par un opérateur autre que l'auteur. Contenu :

1. **Mécanisme prouvé** : référence au banc d'essai + **preuve de non-perte** (rapports
   d'intégrité).
2. **Runbook jour J pas-à-pas** : pré-requis, fenêtre, commandes exactes, **points de
   contrôle Go/No-Go**, rollback.
3. **Definition of Done jour J** (critère premier : zéro perte vérifiée).
4. **Pédagogie** : schémas, **glossaire** (PG, air-gap, OVF, KVM…), « pourquoi » de chaque
   étape, pré-requis matériels/réseau.
5. **Champs balisés `À CONFIRMER AVEC L'ÉQUIPE CNAM`** pour tout fait propre au réseau
   interne (specs hôte cible, contraintes réseau, AC/certificats internes, processus de
   change). **Non inventés** : le *processus* et l'*outil* sont complets et testés ; les
   *valeurs* internes se renseignent le moment venu.

---

## 11. Livrables (ordre de production)

1. **Ce spec** (présent document).
2. `scripts/ofs-backup.sh` + `scripts/ofs-restore.sh` + fichier de config exemple
   (paramétrés, idempotents, vérification d'intégrité).
3. **Patch PG18** de `docker/all-in-one/Dockerfile` + reconstruction/`docker save`.
4. **Runbook banc d'essai** : import OVF→KVM (conversion qcow2, OVMF/SecureBoot), réseau
   isolé, `docker load`, restore + vérification, test air-gap.
5. **Dossier de migration CNAM** (phase 2, §10) — livrable final didactique.

---

## 12. Risques & points ouverts (à lever pendant l'exécution)

| # | Risque / inconnue | Traitement |
|---|---|---|
| R1 | Boot du PLC en KVM | **VALIDÉ (2026-06-08)** : boote jusqu'au login (Alma 8.6, kernel 4.18.0-372) ; conversion `qemu-img -O qcow2` OK. ⚠️ **Disque en SATA/AHCI (`ich9-ahci`) ou pvscsi OBLIGATOIRE** — pas de pilote virtio dans l'initramfs (virtio-blk/scsi → « cannot open root device »). Machine `q35` + OVMF |
| R2 | Docker dans le PLC durci | **RÉSOLU/VALIDÉ (2026-06-09)** : absent à l'origine, mais **install offline (RPM Alma 8.6 en dépôt local + `module_hotfixes=true`) ET run PROUVÉS dans le PLC** (Docker 26.1.3, overlay2, cgroup v1, 0 AVC sous SELinux permissive). Requiert un **disque data dédié** (`/var` 2 Go trop petit, VG quasi plein) |
| R3 | Secure Boot strict | **Échoue sous OVMF strict mais MITIGEABLE (2026-06-08)** — PAS un rejet de certificat (shim Alma enrôlé, CA MS tierce, aucun « Access Denied ») : c'est un `PageFaultExitBoot: NX not clean` (shim 15.4 + GRUB2 2.02 antérieurs au durcissement NX). Fix : MAJ shim≥15.6 + grub2≥2.02-142.el8 dans le qcow2, OU politique `PcdDxeNxMemoryProtectionPolicy` permissive côté OVMF hôte. Boot fonctionnel actuel = SB-OFF |
| R4 | Source réelle jour J en version PG > cible | Règle §6 : cible ≥ source ; figer la version |
| R5 | RAM invité serrée (~5 Go libres) | Allouer ~3 Go à l'invité ; surveiller |
| R6 | Destination des sauvegardes hors-VPS | **Décidé** : **NAS interne** maîtrisé, droits restreints, **sans chiffrement d'archive** (protection = contrôle d'accès NAS + permissions FS `600`) |

---

## 13. Glossaire (extrait — sera étoffé dans le dossier final)

- **PG / PostgreSQL** : moteur de base de données. Versions majeures (16, 17, **18**). On
  restaure dans une version **≥** celle d'origine, jamais inférieure.
- **Air-gap** : isolation totale d'Internet. Les transferts se font hors-ligne (fichiers).
- **OVF / VMDK** : format d'**appliance** et de **disque** virtuels VMware.
- **KVM / qcow2 / OVMF** : virtualisation Linux / format de disque / firmware UEFI virtuel.
- **All-in-one** : toute l'appli dans **un** conteneur, état dans **un** volume `/data`.
