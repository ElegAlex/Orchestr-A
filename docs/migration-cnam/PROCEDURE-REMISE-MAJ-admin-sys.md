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

## 5. Instance courante — MAJ du 2026-06-23 (commit `8e3e19e2`)

| Champ | Valeur |
|---|---|
| Commit `master` | `8e3e19e223e9baebd39ce5ea1c931d2982b43048` |
| Paquet | `migration_ramage/5-maj-T0-8e3e19e2/livraison-orchestra-cnam-maj-8e3e19e2.tar.gz` (652 Mo) |
| **Sceau sha256** | `5162d92727cf924e80f2bf842688bd610d90dc966e2c2c57de3a11bd19fd11e3` |
| Image | `orchestr-a:local` (`sha256:e7a5e449e8c672b7ca8acfcb4323ff148e96fc86cd45cb7c0d490c22c1d7ea60`) |
| Palier | **T0** — 81/81 migrations (migrate-at-boot = no-op) |

**Remédiations embarquées :**
- `7e853107` — jours de planning visibles : corrige le **400** à la sauvegarde
  (whitelist `planning.schoolVacationZone`) + endpoint `GET /settings/public` →
  la config d'affichage **globale** parvient à **tous les rôles** (plus seulement
  ceux ayant `settings:read`).
- `8e3e19e2` — robustesse : la page Paramètres n'envoie plus que les **clés
  modifiées** → immunise contre les lignes orphelines (ex. `planning.lateThresholdDays`).

**Smoke métier spécifique à vérifier après MAJ :**
1. Un compte **sans** `settings:read` (CONTRIBUTEUR / OBSERVATEUR) voit bien les
   jours configurés (et plus seulement Lun–Ven).
2. En **admin** : modifier puis **sauvegarder** les jours affichés → **succès**
   (plus d'erreur 400).

**Validation faite côté dépôt :** build vert + tests (API settings 48/48, suites web OK),
fix validé en **pré-prod réel** (VPS 92.222.35.25, données prod), **image smoke-testée**
(boot healthy, `/api/health`=200, `/api/settings/public`=401 = route présente,
81 migrations appliquées sur base vierge), sceau calculé et vérifié.
