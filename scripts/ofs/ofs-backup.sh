#!/usr/bin/env bash
# =============================================================================
# ofs-backup.sh — Sauvegarde À CHAUD, cohérente et vérifiable d'OFS Tracker
# =============================================================================
# Capture, sans arrêt applicatif :
#   1. la base PostgreSQL (pg_dump -Fc, cohérent par snapshot MVCC) ;
#   2. les fichiers uploadés (+ empreinte sha256 PAR FICHIER) ;
#   3. les secrets d'intégrité (si fournis par l'opérateur) ;
#   4. un manifeste d'intégrité (comptages par table, empreinte de chaîne
#      d'audit, liste des migrations) -> la preuve de non-perte.
# Produit une archive horodatée (UTC) + sha256, poussée vers un NAS interne.
#
# REJOUABLE À L'IDENTIQUE : même script, même config, pour le jour J.
# LECTURE SEULE sur la source : aucune écriture dans la base sauvegardée.
#
# Usage : ./ofs-backup.sh [--config ofs.conf] [--yes]
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ofs-lib.sh
. "$SCRIPT_DIR/ofs-lib.sh"

CONFIG="$SCRIPT_DIR/ofs.conf"
ASSUME_YES_CLI=0
while [ $# -gt 0 ]; do
  case "$1" in
    --config) CONFIG="$2"; shift 2 ;;
    --yes|-y) ASSUME_YES_CLI=1; shift ;;
    *) ofs_die "argument inconnu : $1" ;;
  esac
done

ofs_require_cmd docker
ofs_require_cmd sha256sum
ofs_load_config "$CONFIG"
[ "${OFS_ASSUME_YES:-0}" = "1" ] && ASSUME_YES_CLI=1
OFS_SRC_PG_SUPERUSER="${OFS_SRC_PG_SUPERUSER:-postgres}"   # rôle propriétaire de la base source

# ─── Garde-fou : on s'apprête à interroger la SOURCE (potentiellement la prod) ─
ofs_step "Sauvegarde OFS Tracker — source : conteneur '${OFS_SRC_PG_CONTAINER}' / base '${OFS_SRC_PG_DB}'"
ofs_warn "Opération LECTURE SEULE (pg_dump + comptages). Aucune écriture sur la source."
if [ "$ASSUME_YES_CLI" != "1" ]; then
  printf "  Confirmer la connexion à la source ? Taper OUI : "
  read -r ans
  [ "$ans" = "OUI" ] || ofs_die "annulé par l'opérateur"
fi

ofs_require_container_running "$OFS_SRC_PG_CONTAINER"

STAMP="$(ofs_utc_stamp)"
WORK="${OFS_OUTPUT_DIR%/}/ofs-snapshot-${STAMP}"
mkdir -p "$WORK"
ofs_ok "Répertoire de travail : $WORK"

# ─── 1) Dump base (cohérent, sans arrêt) ────────────────────────────────────
ofs_step "1/5 — Dump PostgreSQL (format custom, rôles neutralisés)"
PG_FULL_VERSION="$(docker exec "$OFS_SRC_PG_CONTAINER" postgres --version | awk '{print $3}')"
PG_MAJOR="${PG_FULL_VERSION%%.*}"
ofs_ok "PostgreSQL source : $PG_FULL_VERSION (majeur $PG_MAJOR)"

# pg_dump en tant que rôle propriétaire, via le socket local (trust en prod).
# OFS_SRC_PG_PASSWORD ne sert que si le socket exige un mot de passe.
ofs_ok "Rôle de connexion source : $OFS_SRC_PG_SUPERUSER"
if [ -n "${OFS_SRC_PG_PASSWORD:-}" ]; then
  docker exec -i -e PGPASSWORD="$OFS_SRC_PG_PASSWORD" "$OFS_SRC_PG_CONTAINER" \
    pg_dump -U "$OFS_SRC_PG_SUPERUSER" -Fc --no-owner --no-privileges -d "$OFS_SRC_PG_DB" > "$WORK/db.dump"
else
  docker exec -i "$OFS_SRC_PG_CONTAINER" \
    pg_dump -U "$OFS_SRC_PG_SUPERUSER" -Fc --no-owner --no-privileges -d "$OFS_SRC_PG_DB" > "$WORK/db.dump"
fi
[ -s "$WORK/db.dump" ] || ofs_die "le dump est vide"
ofs_ok "Dump : $(du -h "$WORK/db.dump" | cut -f1)"

# ─── 2) Artefacts de vérification (comptages, audit, migrations) ────────────
ofs_step "2/5 — Empreintes d'intégrité (source de vérité de la non-perte)"
ofs_collect_verification "$OFS_SRC_PG_CONTAINER" "$OFS_SRC_PG_DB" "$OFS_SRC_PG_SUPERUSER" "$WORK"
N_TABLES="$(wc -l < "$WORK/counts.txt" | tr -d ' ')"
ofs_ok "Comptages capturés : $N_TABLES tables"
ofs_ok "Empreinte chaîne d'audit : $(cat "$WORK/audit.fingerprint")"

# ─── 3) Uploads + empreinte PAR FICHIER ─────────────────────────────────────
ofs_step "3/5 — Fichiers uploadés (+ sha256 par fichier)"
UPLOADS_STAMP="$(ofs_utc_stamp)"
# Conteneur éphémère en lecture seule sur le volume source.
docker run --rm -v "${OFS_SRC_UPLOADS_VOLUME}:/src:ro" -v "$WORK:/out" alpine:3 \
  sh -c 'cd /src && tar czf /out/uploads.tgz . && find . -type f | LC_ALL=C sort | xargs -r sha256sum > /out/uploads.sha256'
N_FILES="$(wc -l < "$WORK/uploads.sha256" | tr -d ' ')"
ofs_ok "Uploads : $N_FILES fichier(s), archive $(du -h "$WORK/uploads.tgz" | cut -f1)"

# ─── 4) Secrets (uniquement si fournis par l'opérateur) ─────────────────────
ofs_step "4/5 — Secrets d'intégrité"
SECRETS_CAPTURED="false"
if [ -n "${OFS_AUDIT_HASH_KEY:-}" ] || [ -n "${OFS_JWT_SECRET:-}" ]; then
  umask 077
  {
    echo "# Généré par ofs-backup.sh — NE PAS committer. Permissions 600."
    [ -n "${OFS_AUDIT_HASH_KEY:-}" ] && echo "AUDIT_HASH_KEY=${OFS_AUDIT_HASH_KEY}"
    [ -n "${OFS_JWT_SECRET:-}" ]     && echo "JWT_SECRET=${OFS_JWT_SECRET}"
  } > "$WORK/secrets.env"
  chmod 600 "$WORK/secrets.env"
  SECRETS_CAPTURED="true"
  ofs_ok "Secrets capturés dans secrets.env (600)"
else
  ofs_warn "Aucun secret fourni (OFS_AUDIT_HASH_KEY/OFS_JWT_SECRET vides)."
  ofs_warn "=> à renseigner MANUELLEMENT dans le .env de l'all-in-one avant restauration,"
  ofs_warn "   faute de quoi l'API ne démarrera pas / l'audit deviendra incohérent."
fi

# ─── 5) Manifeste + archive + sha256 + push NAS + rétention ─────────────────
ofs_step "5/5 — Manifeste, archive, empreinte"
RELEASE_SHA="unknown"
if [ -n "${OFS_SRC_API_CONTAINER:-}" ] && ofs_container_exists "$OFS_SRC_API_CONTAINER"; then
  RELEASE_SHA="$(docker exec "$OFS_SRC_API_CONTAINER" printenv RELEASE_SHA 2>/dev/null || echo unknown)"
fi

cat > "$WORK/MANIFEST.json" <<JSON
{
  "tool": "ofs-backup.sh",
  "schema": 1,
  "db_snapshot_utc": "${STAMP}",
  "uploads_snapshot_utc": "${UPLOADS_STAMP}",
  "source_pg_container": "${OFS_SRC_PG_CONTAINER}",
  "source_pg_database": "${OFS_SRC_PG_DB}",
  "source_pg_version": "${PG_FULL_VERSION}",
  "source_pg_major": "${PG_MAJOR}",
  "release_sha": "${RELEASE_SHA}",
  "table_count": ${N_TABLES},
  "uploads_file_count": ${N_FILES},
  "secrets_captured": ${SECRETS_CAPTURED},
  "audit_fingerprint": "$(cat "$WORK/audit.fingerprint")",
  "sha256": {
    "db.dump": "$(ofs_sha256 "$WORK/db.dump")",
    "uploads.tgz": "$(ofs_sha256 "$WORK/uploads.tgz")",
    "uploads.sha256": "$(ofs_sha256 "$WORK/uploads.sha256")",
    "counts.txt": "$(ofs_sha256 "$WORK/counts.txt")",
    "migrations.txt": "$(ofs_sha256 "$WORK/migrations.txt")"
  }
}
JSON
ofs_ok "Manifeste écrit (release ${RELEASE_SHA})"

ARCHIVE="${OFS_OUTPUT_DIR%/}/ofs-snapshot-${STAMP}.tar.gz"
tar czf "$ARCHIVE" -C "$(dirname "$WORK")" "$(basename "$WORK")"
ofs_sha256 "$ARCHIVE" > "${ARCHIVE}.sha256"
ofs_ok "Archive : $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"
ofs_ok "Empreinte : $(cat "${ARCHIVE}.sha256")"

# Le répertoire de travail décompressé n'est plus utile (tout est dans l'archive).
rm -rf "$WORK"

# Push hors-machine (NAS interne) — rsync si dispo, sinon scp.
if [ -n "${OFS_NAS_DEST:-}" ]; then
  ofs_step "Transfert vers le NAS interne : ${OFS_NAS_DEST}"
  if command -v rsync >/dev/null 2>&1; then
    rsync -av "$ARCHIVE" "${ARCHIVE}.sha256" "${OFS_NAS_DEST%/}/" && ofs_ok "Copié (rsync)"
  else
    scp "$ARCHIVE" "${ARCHIVE}.sha256" "${OFS_NAS_DEST%/}/" && ofs_ok "Copié (scp)"
  fi
else
  ofs_warn "OFS_NAS_DEST vide : archive conservée en local uniquement ($ARCHIVE)."
fi

# Rétention locale.
if [ "${OFS_RETENTION:-0}" -gt 0 ] 2>/dev/null; then
  mapfile -t OLD < <(ls -1t "${OFS_OUTPUT_DIR%/}"/ofs-snapshot-*.tar.gz 2>/dev/null | tail -n +"$((OFS_RETENTION + 1))")
  for f in "${OLD[@]:-}"; do [ -n "$f" ] && rm -f "$f" "${f}.sha256" && ofs_warn "Purge rétention : $(basename "$f")"; done
fi

printf "\n${C_GREEN}════ SAUVEGARDE TERMINÉE ════${C_NC}\n"
printf "Archive : %s\n" "$ARCHIVE"
printf "Restaurer avec : ./ofs-restore.sh --config %s %s\n" "$CONFIG" "$ARCHIVE"
