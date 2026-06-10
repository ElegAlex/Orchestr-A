# `scripts/orchestra/` — Mécanisme rejouable de sauvegarde/restauration Orchestr'A

Outil **paramétré, idempotent et vérifiable** de capture/restauration des données
d'Orchestr'A. Conçu pour être **rejoué à l'identique** : il sert au
banc d'essai PLC air-gap *aujourd'hui* et à la **bascule réseau Assurance Maladie**
le jour J. On ne change que `orchestra.conf`, jamais les scripts.

> Spec & contexte : `docs/migration-cnam/2026-06-08-banc-essai-plc-airgap-et-migration-design.md`

## Fichiers

| Fichier | Rôle |
|---|---|
| `orchestra-lib.sh` | Fonctions partagées + **SQL de vérification canonique** (source unique) |
| `orchestra-backup.sh` | Sauvegarde **à chaud** (sans arrêt) : dump DB + uploads + secrets + manifeste |
| `orchestra-restore.sh` | Restauration **vérifiée** dans l'image all-in-one PG18 (toute non-perte prouvée) |
| `orchestra.conf.example` | Modèle de configuration (copier en `orchestra.conf`) |

## Utilisation

```bash
cd scripts/orchestra
cp orchestra.conf.example orchestra.conf && $EDITOR orchestra.conf

# Sauvegarde (LECTURE SEULE sur la source ; demande confirmation)
./orchestra-backup.sh --config orchestra.conf

# Restauration dans l'all-in-one (créer le conteneur cible d'abord)
#   docker compose -f ../../docker-compose.offline.yml up -d
./orchestra-restore.sh --config orchestra.conf ../../backups-orchestra/orchestra-snapshot-<UTC>.tar.gz
```

## Garanties de non-perte (intégrées)

1. **Dump cohérent** sans arrêt (snapshot MVCC), `--no-owner --no-privileges`
   (insensible au décalage de rôles `app_user`/`postgres` → `orchestr_a`).
2. **Empreinte par fichier** des uploads (pas seulement le sha256 du tar).
3. **Garde-fou migrations** : la restauration refuse une image cible plus ancienne,
   et n'autorise une image plus récente (qui déclencherait `migrate deploy`) qu'avec
   `--allow-migrate`.
4. **Preuve avant remise en service** : comptage par table + empreinte de la chaîne
   d'audit + migrations, comparés au manifeste. **Tout écart laisse l'app à l'arrêt.**

## Prérequis cible

L'image all-in-one **doit être en PostgreSQL 18** (cf. patch
`docker/all-in-one/Dockerfile`) car la source est en PG18 et un dump 18→16 est un
downgrade non supporté. Le `.env` de l'all-in-one **doit** porter `AUDIT_HASH_KEY`
et `METRICS_TOKEN` (sinon l'API ne démarre pas) — sur une restauration,
`AUDIT_HASH_KEY` doit **égaler** celui de la source.

## Limite assumée

Les scripts **ne lisent jamais** `.env.production`. Les secrets (`AUDIT_HASH_KEY`,
`JWT_SECRET`) sont fournis par l'opérateur via `orchestra.conf` (ou renseignés à la main).
