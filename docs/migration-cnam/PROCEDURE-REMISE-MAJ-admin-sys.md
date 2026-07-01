# Procédure de remise d'une MAJ Orchestr'A à l'admin sys (Ramage, air-gap)

> **Objet** : ce qu'on **remet concrètement** à l'admin sys du PLC Ramage pour
> appliquer une mise à jour de code sur l'instance **déjà en service**, et la
> procédure d'application côté admin.
> **Complément** de `2026-06-22-RUNBOOK-MAJ-PROD-Ramage.md` (le runbook = la
> référence technique détaillée ; ce document = la **fiche de remise** + le bloc
> prêt à exécuter). Pour produire le paquet côté dépôt : §3 du runbook.
> **Périmètre type** : palier **T0** (code seul, aucune migration). T1/T2 : voir
> §4.4 / §4.5 du runbook (le geste diffère).

---

## 1. Ce qu'on remet à l'admin (2 fichiers)

Sur clé USB / canal interne, depuis `migration_ramage/<dossier-MAJ>/` :

| Fichier | Rôle |
|---|---|
| `livraison-orchestra-cnam-maj-<sha>.tar.gz` | le paquet (image all-in-one + compose + scripts + runbook + note de release) |
| `livraison-orchestra-cnam-maj-<sha>.tar.gz.sha256` | le **sceau** à vérifier avant tout |

Le paquet est **autonome** : il embarque sa `NOTE-DE-RELEASE.md` (palier déclaré)
et le runbook dans `docs/`. Rien d'autre à fournir.

---

## 2. Pré-requis CRITIQUE — le `.env`

> ⚠️ **On réutilise le `.env` EXISTANT de la prod (vrais secrets).** Ne **jamais**
> régénérer `JWT_SECRET` ni `AUDIT_HASH_KEY` : un changement invalide toutes les
> sessions **et** casse la cohérence de la chaîne d'audit (l'API peut crash-loop).
> Le `.env.example` du paquet est un **modèle** (première installation), **pas** à
> utiliser pour une MAJ.

En T0, **seule l'image change**. Le `docker-compose.offline.yml` et le `.env`
en place sur Ramage sont inchangés → on recharge l'image et on recrée le conteneur
depuis le dossier de déploiement existant.

---

## 3. Procédure d'application (palier T0)

```bash
# 0. Vérifier le sceau, puis extraire
cd /docker/livraisons
sha256sum -c livraison-orchestra-cnam-maj-<sha>.tar.gz.sha256   # → Réussi
tar xzf livraison-orchestra-cnam-maj-<sha>.tar.gz

# 1. Garder l'image actuelle pour rollback (AVANT de charger la nouvelle)
docker tag orchestr-a:local orchestr-a:prev-$(date +%Y%m%d) || true

# 2. Backup-first OBLIGATOIRE (base live + uploads) — mode all-in-one
docker exec orchestr-a sh -c 'pg_dump -U orchestr_a -Fc --no-owner --no-privileges -d orchestr_a' \
  > /docker/livraisons/backup-pre-maj-$(date -u +%Y%m%dT%H%M%SZ).dump
docker exec orchestr-a sh -c 'cd /data/uploads && tar czf - .' \
  > /docker/livraisons/uploads-pre-maj-$(date -u +%Y%m%dT%H%M%SZ).tgz

# 3. Charger la NOUVELLE image
gunzip -c livraison-orchestra-cnam-maj-<sha>/app/orchestr-a-local.tar.gz | docker load

# 4. Recréer le conteneur — depuis le dossier de déploiement EXISTANT
#    (celui qui a déjà docker-compose.offline.yml + .env aux vrais secrets)
cd <DOSSIER_DEPLOIEMENT_ACTUEL>
docker compose -f docker-compose.offline.yml --env-file .env up -d   # surtout PAS -v (le volume orchestr-a-data est conservé)
```

### Vérification (les 3 paliers)
```bash
curl -s http://localhost:3000/api/health             # {"status":"ok"}  (port interne derrière Apache)
docker logs --tail 30 orchestr-a | grep -i migrat    # T0 : "0 nouvelle migration"
```
Puis **smoke métier** via `http://orchestra.cpam-hauts-de-seine.ramage` : connexion +
1–2 pages clés. Vérifier les remédiations annoncées dans la note de release.

### Rollback T0 (si besoin)
```bash
docker tag orchestr-a:prev-$(date +%Y%m%d) orchestr-a:local
cd <DOSSIER_DEPLOIEMENT_ACTUEL> && docker compose -f docker-compose.offline.yml --env-file .env up -d
```
> T0 = aucun changement de schéma → pas de restauration de données nécessaire.
> Le backup du §2 reste le filet ultime (et est **obligatoire** pour T1/T2, cf. runbook §4.7).

---

## 4. Deux détails à confirmer avec l'admin

- `<DOSSIER_DEPLOIEMENT_ACTUEL>` = là où tournent déjà le `docker-compose.offline.yml`
  **et** le `.env` (vrais secrets) sur Ramage — c'est **ce `.env`-là** qu'on réutilise.
- Port interne `3000` (derrière Apache httpd) : à ajuster si leur `HTTP_PORT` diffère.

---

## 5. Instance courante — MAJ du 2026-07-01 (commit `3a35e55b`)

| Champ | Valeur |
|---|---|
| Commit | `3a35e55b` (sur `master`) — code packagé ; doc §5 à `master` HEAD |
| Paquet | `migration_ramage/6-maj-T0-3a35e55b/livraison-orchestra-cnam-maj-3a35e55b.tar.gz` (623 Mo) |
| **Sceau sha256** | `21c13572b5853ea40fe2b3c77416d193c28b80a022f2ece88770e100670cee74` |
| Image | `orchestr-a:local` (`sha256:6ab0a601ce612e7e18dcd8e17290c8201a1b3e79a865facae46d9966246035e1`) |
| Palier | **T0** — 81/81 migrations (migrate-at-boot = no-op) |

**Remédiations embarquées :**
- `COR-070` — bouton **« Présence »** (dashboard) → « Erreur lors du chargement des
  données » : la requête SQL de `GET /users/presence` utilisait des identifiants
  snake_case non quotés alors que les colonnes sont camelCase → **500**. Colonnes
  re-quotées (`u."firstName"`…).
- `COR-071` — vues **planning** : afficher **1, 2 ou 3 zones** de vacances scolaires.
  Le réglage `planning.schoolVacationZone` devient une **liste** de zones pilotant
  l'affichage **et** l'import Open Data ; une ligne de bannière par zone (couleur
  distincte). Rétro-compat de la valeur scalaire prod `'C'` (aucune migration).

**Smoke métier spécifique à vérifier après MAJ :**
1. **COR-070** — Dashboard → **« Présence »** : le dialog s'ouvre **sans** erreur ;
   les 4 onglets (Sur site / Télétravail / Absents / Externes) sont peuplés.
2. **COR-071** — Paramètres → **Vacances scolaires** : cocher 2 puis 3 zones →
   **enregistrer** (succès) ; l'import Open Data importe **chaque** zone ; **Planning** :
   une ligne de bannière **par zone**, couleur distincte ; décocher une zone la masque
   (données conservées). Instance legacy `'C'` → affichée `['C']` (Zone C).

**Validation faite côté dépôt :** build API vert + **suite API complète 2454/2454**,
typecheck web 0 erreur (fichiers sources), **intégration Postgres réel 6/6**
(COR-070 présence ×2 avec RED/GREEN prouvé — SQLSTATE 42703 ; COR-071 filtre de zone ×4),
**image smoke-testée** (boot healthy, `/api/health`=200, 81 migrations appliquées sur base
vierge, `app_settings['planning.schoolVacationZone']` seedé à `["C"]`, API restarts=0),
sceau calculé et **vérifié** (`sha256sum -c` = OK).
