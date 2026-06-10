#!/usr/bin/env bash
# =============================================================================
# orchestra-restore.sh — Restauration VÉRIFIÉE d'Orchestr'A dans l'image all-in-one
# =============================================================================
# Évolution paramétrée et durcie de scripts/fix-restore.sh. Étapes :
#   0. vérifie l'intégrité de l'archive (sha256) + extrait ;
#   1. GARDE-FOU migrations : le jeu de migrations de l'IMAGE cible doit
#      correspondre à celui des données sauvegardées (sinon `migrate deploy`
#      s'appliquerait par-dessus les données restaurées => dérive/échec) ;
#   2. restaure la base (pg_restore --no-owner) via un conteneur temporaire,
#      corrige les droits, restaure les uploads (+ vérif sha256 par fichier) ;
#   3. PREUVE DE NON-PERTE : recompte tables + empreinte d'audit + migrations
#      sur la base restaurée et compare au manifeste. TOUT écart = ÉCHEC, AVANT
#      remise en service ;
#   4. ne redémarre l'application que si tout est vérifié.
#
# Usage : ./orchestra-restore.sh [--config orchestra.conf] [--allow-migrate] [--yes] <archive.tar.gz>
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=orchestra-lib.sh
. "$SCRIPT_DIR/orchestra-lib.sh"

CONFIG="$SCRIPT_DIR/orchestra.conf"
ALLOW_MIGRATE=0
ASSUME_YES_CLI=0
ARCHIVE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --config) CONFIG="$2"; shift 2 ;;
    --allow-migrate) ALLOW_MIGRATE=1; shift ;;
    --yes|-y) ASSUME_YES_CLI=1; shift ;;
    -*) orchestra_die "argument inconnu : $1" ;;
    *) ARCHIVE="$1"; shift ;;
  esac
done

[ -n "$ARCHIVE" ] || orchestra_die "usage : ./orchestra-restore.sh [--config orchestra.conf] [--allow-migrate] [--yes] <archive.tar.gz>"
[ -f "$ARCHIVE" ] || orchestra_die "archive introuvable : $ARCHIVE"

orchestra_require_cmd docker
orchestra_require_cmd sha256sum
orchestra_load_config "$CONFIG"
[ "${ORCHESTRA_ASSUME_YES:-0}" = "1" ] && ASSUME_YES_CLI=1

# ─── 0) Intégrité de l'archive + extraction ─────────────────────────────────
orchestra_step "0/4 — Vérification de l'archive"
if [ -f "${ARCHIVE}.sha256" ]; then
  EXPECTED="$(cat "${ARCHIVE}.sha256")"
  ACTUAL="$(orchestra_sha256 "$ARCHIVE")"
  [ "$EXPECTED" = "$ACTUAL" ] || orchestra_die "sha256 de l'archive NON conforme (corruption / altération)"
  orchestra_ok "sha256 archive conforme"
else
  orchestra_warn "Pas de fichier .sha256 à côté de l'archive — intégrité de transport non vérifiée"
fi

TMP="$(mktemp -d /tmp/orchestra-restore.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
tar xzf "$ARCHIVE" -C "$TMP"
SNAP="$(find "$TMP" -maxdepth 1 -type d -name 'orchestra-snapshot-*' | head -1)"
[ -n "$SNAP" ] && [ -d "$SNAP" ] || orchestra_die "contenu d'archive inattendu (dossier orchestra-snapshot-* absent)"
MANIFEST="$SNAP/MANIFEST.json"
[ -f "$MANIFEST" ] || orchestra_die "MANIFEST.json absent de l'archive"

json_sha() { grep -o "\"$1\"[[:space:]]*:[[:space:]]*\"[0-9a-f]*\"" "$MANIFEST" | head -1 | sed 's/.*"\([0-9a-f]*\)"$/\1/'; }
# Vérif sha256 des artefacts internes vs manifeste.
for f in db.dump uploads.tgz; do
  want="$(json_sha "$f")"
  have="$(orchestra_sha256 "$SNAP/$f")"
  [ -n "$want" ] && [ "$want" = "$have" ] || orchestra_die "sha256 de $f non conforme au manifeste"
done
orchestra_ok "Empreintes internes conformes (db.dump, uploads.tgz)"

BUNDLE_MIGRATIONS="$(cat "$SNAP/migrations.txt")"
orchestra_ok "Données : $(grep -c . "$SNAP/counts.txt") tables, audit=$(cat "$SNAP/audit.fingerprint")"

# ─── 1) GARDE-FOU migrations : image cible vs données ───────────────────────
orchestra_step "1/4 — Garde-fou : parité des migrations (image cible ↔ données)"
docker image inspect "$ORCHESTRA_AIO_IMAGE" >/dev/null 2>&1 || orchestra_die "image cible introuvable : $ORCHESTRA_AIO_IMAGE"
IMAGE_MIGRATIONS="$(docker run --rm --entrypoint sh "$ORCHESTRA_AIO_IMAGE" -c \
  'ls -1 /app/packages/database/prisma/migrations 2>/dev/null | grep -v "migration_lock.toml" | LC_ALL=C sort | paste -sd, -' || true)"

# Normalisation en ensembles triés.
to_set() { printf '%s' "$1" | tr ',' '\n' | sed '/^$/d;/^NONE$/d;/^NO_MIGRATIONS_TABLE$/d' | LC_ALL=C sort -u; }
DATA_SET="$(to_set "$BUNDLE_MIGRATIONS")"
IMG_SET="$(to_set "$IMAGE_MIGRATIONS")"

MISSING_IN_IMAGE="$(comm -23 <(printf '%s\n' "$DATA_SET") <(printf '%s\n' "$IMG_SET") || true)"
EXTRA_IN_IMAGE="$(comm -13 <(printf '%s\n' "$DATA_SET") <(printf '%s\n' "$IMG_SET") || true)"

if [ -n "$MISSING_IN_IMAGE" ]; then
  orchestra_err "L'image cible est PLUS ANCIENNE que les données : migrations présentes dans les données mais absentes de l'image :"
  printf '      %s\n' $MISSING_IN_IMAGE
  orchestra_die "image trop ancienne — reconstruire l'image au commit ≥ celui de la source"
fi
if [ -n "$EXTRA_IN_IMAGE" ]; then
  orchestra_warn "L'image contient des migrations NON présentes dans les données (image plus récente) :"
  printf '      %s\n' $EXTRA_IN_IMAGE
  orchestra_warn "Au redémarrage, l'entrypoint lancera 'prisma migrate deploy' PAR-DESSUS les données restaurées."
  if [ "$ALLOW_MIGRATE" != "1" ]; then
    orchestra_die "refus par défaut. Relancer avec --allow-migrate pour autoriser cette montée de version contrôlée."
  fi
  orchestra_warn "--allow-migrate fourni : montée de version autorisée explicitement."
else
  orchestra_ok "Parité exacte des migrations (image ↔ données)"
fi

# ─── Préparation des artefacts SQL canoniques pour le conteneur temporaire ──
# La SQL provient de orchestra-lib.sh (source unique). On l'écrit dans le snapshot
# (monté en lecture seule) pour que le conteneur la calcule à l'identique.
orchestra_sql_table_counts       > "$SNAP/_verify_counts.sql"
orchestra_sql_audit_fingerprint  > "$SNAP/_verify_audit.sql"
orchestra_sql_migrations_applied > "$SNAP/_verify_migrations.sql"

VERIFY_OUT="$TMP/verifyout"; mkdir -p "$VERIFY_OUT"

# Script exécuté DANS le conteneur temporaire (statique, paramétré par env).
cat > "$SNAP/_inner.sh" <<'INNER'
#!/usr/bin/env bash
set -euo pipefail
PG_VERSION="$(cat /tmp/pg_version)"
BIN="/usr/lib/postgresql/${PG_VERSION}/bin"
say() { echo "    [inner] $1"; }

# Init du cluster si volume vierge (mirroir de l'entrypoint all-in-one).
if [ ! -f /data/postgresql/PG_VERSION ]; then
  say "cluster absent -> initdb (PG ${PG_VERSION})"
  mkdir -p /data/postgresql && chown -R postgres:postgres /data/postgresql
  gosu postgres "${BIN}/initdb" -D /data/postgresql --encoding=UTF8 --locale=C.UTF-8
  cat >> /data/postgresql/pg_hba.conf <<HBA
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
HBA
  printf "listen_addresses = 'localhost'\nmax_connections = 100\nshared_buffers = 128MB\n" >> /data/postgresql/postgresql.conf
fi
chown -R postgres:postgres /data/postgresql /run/postgresql

say "démarrage PostgreSQL"
gosu postgres "${BIN}/pg_ctl" -D /data/postgresql -w start -o "-c listen_addresses=localhost"

# Rôle runtime = propriétaire + SUPERUSER (modèle mono-rôle, identique à la prod
# où `orchestr_a` est lui-même superuser). On restaure EN TANT QUE ce rôle
# (pg_restore --role) : les objets lui appartiennent directement, l'extension
# uuid-ossp se recrée, et on évite REASSIGN OWNED BY postgres (qui échoue sur les
# objets système pinned au superuser bootstrap).
gosu postgres psql -v ON_ERROR_STOP=1 -tAc \
  "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${ORCHESTRA_ROLE}') THEN CREATE ROLE ${ORCHESTRA_ROLE} LOGIN SUPERUSER PASSWORD '${ORCHESTRA_ROLE_PW}'; ELSE ALTER ROLE ${ORCHESTRA_ROLE} LOGIN SUPERUSER PASSWORD '${ORCHESTRA_ROLE_PW}'; END IF; END \$\$;"
if ! gosu postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${ORCHESTRA_DB}'" | grep -q 1; then
  say "création de la base ${ORCHESTRA_DB}"
  gosu postgres createdb -O "${ORCHESTRA_ROLE}" "${ORCHESTRA_DB}"
fi

say "remise à zéro du schéma public (propriété ${ORCHESTRA_ROLE})"
gosu postgres psql -v ON_ERROR_STOP=1 -d "${ORCHESTRA_DB}" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public AUTHORIZATION ${ORCHESTRA_ROLE}; GRANT USAGE ON SCHEMA public TO PUBLIC;"

say "restauration du dump en tant que ${ORCHESTRA_ROLE} (pg_restore --role)"
set +e
gosu postgres pg_restore --role="${ORCHESTRA_ROLE}" -d "${ORCHESTRA_DB}" --no-owner --no-privileges --single-transaction /restore/db.dump 2>&1 | tail -5
RC=${PIPESTATUS[0]}
set -e
# 0 = succès, 1 = warnings tolérables ; >1 = échec.
[ "$RC" -le 1 ] || { echo "    [inner] ÉCHEC pg_restore (code $RC)"; gosu postgres "${BIN}/pg_ctl" -D /data/postgresql -w stop; exit 1; }

say "finitions (uuid-ossp + USAGE public)"
gosu postgres psql -v ON_ERROR_STOP=1 -d "${ORCHESTRA_DB}" -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"; GRANT USAGE ON SCHEMA public TO PUBLIC;"

say "restauration des uploads + vérif sha256 par fichier"
rm -rf /data/uploads && mkdir -p /data/uploads
tar xzf /restore/uploads.tgz -C /data/uploads
( cd /data/uploads && sha256sum -c /restore/uploads.sha256 ) >/dev/null || { echo "    [inner] ÉCHEC vérif uploads"; gosu postgres "${BIN}/pg_ctl" -D /data/postgresql -w stop; exit 1; }
chown -R orchestr-a:orchestr-a /data/uploads

say "collecte des empreintes sur la base RESTAURÉE"
gosu postgres psql -d "${ORCHESTRA_DB}" -tAqf /restore/_verify_counts.sql      > /verifyout/counts.txt
gosu postgres psql -d "${ORCHESTRA_DB}" -tAqf /restore/_verify_audit.sql       > /verifyout/audit.fingerprint
gosu postgres psql -d "${ORCHESTRA_DB}" -tAqf /restore/_verify_migrations.sql  > /verifyout/migrations.txt

say "test décisif : lecture en tant que ${ORCHESTRA_ROLE} (rôle Prisma)"
U=$(PGPASSWORD="${ORCHESTRA_ROLE_PW}" psql -U "${ORCHESTRA_ROLE}" -h localhost -d "${ORCHESTRA_DB}" -tAc "SELECT count(*) FROM users" 2>&1)
echo "$U" | grep -qE '^[0-9]+$' || { echo "    [inner] ÉCHEC : ${ORCHESTRA_ROLE} ne lit pas users ($U)"; gosu postgres "${BIN}/pg_ctl" -D /data/postgresql -w stop; exit 1; }
say "${ORCHESTRA_ROLE} voit ${U} utilisateur(s)"

gosu postgres "${BIN}/pg_ctl" -D /data/postgresql -w stop
say "PostgreSQL arrêté proprement"
INNER
chmod +x "$SNAP/_inner.sh"

# ─── 2) Restauration via conteneur temporaire ───────────────────────────────
orchestra_step "2/4 — Restauration (conteneur temporaire, application à l'arrêt)"
orchestra_container_exists "$ORCHESTRA_AIO_CONTAINER" \
  || orchestra_die "conteneur all-in-one '$ORCHESTRA_AIO_CONTAINER' inexistant. Créez-le d'abord : docker compose -f docker-compose.offline.yml up -d"

if docker ps --format '{{.Names}}' | grep -qx "$ORCHESTRA_AIO_CONTAINER"; then
  docker stop "$ORCHESTRA_AIO_CONTAINER" >/dev/null && orchestra_ok "Conteneur '$ORCHESTRA_AIO_CONTAINER' arrêté"
fi

docker run --rm \
  --name orchestra-restore-temp \
  --entrypoint bash \
  --volumes-from "$ORCHESTRA_AIO_CONTAINER" \
  -e ORCHESTRA_DB="$ORCHESTRA_AIO_DB" \
  -e ORCHESTRA_ROLE="$ORCHESTRA_AIO_RUNTIME_ROLE" \
  -e ORCHESTRA_ROLE_PW="$ORCHESTRA_AIO_RUNTIME_PASSWORD" \
  -v "$SNAP:/restore:ro" \
  -v "$VERIFY_OUT:/verifyout" \
  "$ORCHESTRA_AIO_IMAGE" \
  /restore/_inner.sh \
  || orchestra_die "le conteneur temporaire de restauration a échoué — application NON redémarrée"

# ─── 3) PREUVE DE NON-PERTE : comparaison stricte au manifeste ──────────────
orchestra_step "3/4 — Vérification d'intégrité (zéro perte)"
FAIL=0
if diff -q "$SNAP/counts.txt" "$VERIFY_OUT/counts.txt" >/dev/null; then
  orchestra_ok "Comptages par table IDENTIQUES (source ↔ restauré)"
else
  orchestra_err "ÉCART de comptage par table :"; diff "$SNAP/counts.txt" "$VERIFY_OUT/counts.txt" | sed 's/^/      /' || true; FAIL=1
fi
if [ "$(cat "$SNAP/audit.fingerprint")" = "$(cat "$VERIFY_OUT/audit.fingerprint")" ]; then
  orchestra_ok "Empreinte chaîne d'audit IDENTIQUE => audit_logs restauré à l'identique"
else
  orchestra_err "Empreinte d'audit DIFFÉRENTE (source=$(cat "$SNAP/audit.fingerprint") restauré=$(cat "$VERIFY_OUT/audit.fingerprint"))"; FAIL=1
fi
if [ "$(cat "$SNAP/migrations.txt")" = "$(cat "$VERIFY_OUT/migrations.txt")" ]; then
  orchestra_ok "Migrations appliquées IDENTIQUES"
else
  orchestra_warn "Migrations différentes après restauration (attendu si --allow-migrate)."
fi
[ "$FAIL" = "0" ] || orchestra_die "INTÉGRITÉ NON PROUVÉE — application laissée à l'arrêt. Investiguer avant toute remise en service."

# Secrets : reporter dans le volume + instruire (jamais injecté en aveugle).
if [ -f "$SNAP/secrets.env" ]; then
  orchestra_warn "secrets.env présent dans l'archive : assurez-vous que le .env de l'all-in-one porte"
  orchestra_warn "le MÊME AUDIT_HASH_KEY (sinon crash-loop / audit incohérent). Voir le runbook."
fi

# ─── 4) Redémarrage applicatif + santé ──────────────────────────────────────
orchestra_step "4/4 — Redémarrage de l'application"
docker start "$ORCHESTRA_AIO_CONTAINER" >/dev/null
orchestra_ok "Conteneur '$ORCHESTRA_AIO_CONTAINER' relancé — attente du health check…"
HEALTHY=0
for i in $(seq 1 24); do
  sleep 5
  ST="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}nohc{{end}}' "$ORCHESTRA_AIO_CONTAINER" 2>/dev/null || echo inconnu)"
  RUN="$(docker inspect --format='{{.State.Running}}' "$ORCHESTRA_AIO_CONTAINER" 2>/dev/null || echo false)"
  if [ "$ST" = "healthy" ]; then HEALTHY=1; orchestra_ok "[$i/24] HEALTHY"; break; fi
  [ "$RUN" = "false" ] && orchestra_warn "[$i/24] conteneur arrêté — il redémarre peut-être (vérifier AUDIT_HASH_KEY)" || echo "    [$i/24] status=$ST"
done

if [ "$HEALTHY" = "1" ]; then
  printf "\n${C_GREEN}════ RESTAURATION VÉRIFIÉE ET APPLICATION SAINE ════${C_NC}\n"
else
  orchestra_warn "Le conteneur n'est pas 'healthy' dans le délai. Données VÉRIFIÉES OK ; investiguer le démarrage applicatif :"
  orchestra_warn "  docker logs --tail 50 $ORCHESTRA_AIO_CONTAINER   (souvent : AUDIT_HASH_KEY/METRICS_TOKEN manquants dans le .env)"
fi
