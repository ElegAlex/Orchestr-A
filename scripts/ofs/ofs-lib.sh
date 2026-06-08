#!/usr/bin/env bash
# =============================================================================
# ofs-lib.sh — Fonctions partagées du mécanisme de sauvegarde/restauration OFS
# =============================================================================
# Sourcé par ofs-backup.sh ET ofs-restore.sh. NE PAS exécuter directement.
#
# Règle d'or (cf. revue de conception) : la SQL de vérification d'intégrité est
# définie ICI, une seule fois, pour que la sauvegarde et la restauration la
# calculent à l'identique. Toute divergence d'ordre / de délimiteur produirait
# de faux écarts (ou pire, de fausses correspondances) et ruinerait la preuve
# de non-perte.
# =============================================================================

# --- Sortie / logs -----------------------------------------------------------
if [ -t 1 ]; then
  C_RED='\033[0;31m'; C_GREEN='\033[0;32m'; C_YEL='\033[1;33m'; C_BLUE='\033[0;34m'; C_NC='\033[0m'
else
  C_RED=''; C_GREEN=''; C_YEL=''; C_BLUE=''; C_NC=''
fi
ofs_step() { printf "\n${C_BLUE}▶ %s${C_NC}\n" "$1"; }
ofs_ok()   { printf "  ${C_GREEN}✓ %s${C_NC}\n" "$1"; }
ofs_warn() { printf "  ${C_YEL}⚠ %s${C_NC}\n" "$1"; }
ofs_err()  { printf "  ${C_RED}✗ %s${C_NC}\n" "$1" >&2; }
ofs_die()  { printf "\n${C_RED}════ ÉCHEC : %s ════${C_NC}\n" "$1" >&2; exit 1; }

# --- Prérequis ---------------------------------------------------------------
ofs_require_cmd() { command -v "$1" >/dev/null 2>&1 || ofs_die "commande requise absente : $1"; }

ofs_require_container_running() {
  local c="$1"
  docker ps --format '{{.Names}}' | grep -qx "$c" \
    || ofs_die "conteneur '$c' introuvable ou non démarré (docker ps)"
}

ofs_container_exists() { docker ps -a --format '{{.Names}}' | grep -qx "$1"; }

# --- Chargement de configuration --------------------------------------------
ofs_load_config() {
  local cfg="$1"
  [ -f "$cfg" ] || ofs_die "fichier de configuration introuvable : $cfg"
  # shellcheck disable=SC1090
  . "$cfg"
}

# --- Accès psql dans un conteneur, en tant que <role> via le socket local ----
# Le rôle propriétaire/superuser de la SOURCE n'est pas forcément "postgres"
# (en prod c'est `orchestr_a`) : il est passé en paramètre. Sur un socket en
# `trust` (cas prod), aucun mot de passe n'est requis. Si le socket exige un mot
# de passe, fournir OFS_SRC_PG_PASSWORD dans la config (jamais lu de .env.production).
ofs_psql() {
  # usage: ofs_psql <container> <db> <role> <sql>
  local c="$1" db="$2" role="$3" sql="$4"
  if [ -n "${OFS_SRC_PG_PASSWORD:-}" ]; then
    docker exec -i -e PGPASSWORD="$OFS_SRC_PG_PASSWORD" "$c" psql -U "$role" -d "$db" -tAqc "$sql"
  else
    docker exec -i "$c" psql -U "$role" -d "$db" -tAqc "$sql"
  fi
}

# =============================================================================
# SQL CANONIQUE DE VÉRIFICATION — source unique de vérité (cf. règle d'or)
# =============================================================================

# Comptage de TOUTES les tables de base du schéma public, en une requête
# déterministe (ordre par nom). Sortie : lignes "table_name|n".
ofs_sql_table_counts() {
  cat <<'SQL'
SELECT table_name || '|' ||
       (xpath('/row/c/text()',
              query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name),
                           false, true, '')))[1]::text::bigint
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
SQL
}

# Empreinte de la chaîne d'audit : md5 de la concaténation ordonnée des rowHash,
# dans l'ORDRE CANONIQUE de la chaîne ("createdAt", id) — identique à
# apps/api/src/audit/recompute-chain.ts. Si l'empreinte source == cible, toutes
# les lignes audit_logs ont été restaurées à l'identique => chaîne intacte, SANS
# réimplémenter le hash. 'NO_AUDIT_TABLE' si la table n'existe pas.
ofs_sql_audit_fingerprint() {
  cat <<'SQL'
SELECT CASE WHEN to_regclass('public.audit_logs') IS NULL
            THEN 'NO_AUDIT_TABLE'
            ELSE coalesce((SELECT md5(string_agg("rowHash", '|' ORDER BY "createdAt", id))
                           FROM audit_logs), 'EMPTY')
       END;
SQL
}

# Liste CSV triée des migrations Prisma APPLIQUÉES (finished_at non nul).
ofs_sql_migrations_applied() {
  cat <<'SQL'
SELECT CASE WHEN to_regclass('public._prisma_migrations') IS NULL
            THEN 'NO_MIGRATIONS_TABLE'
            ELSE coalesce((SELECT string_agg(migration_name, ',' ORDER BY migration_name)
                           FROM _prisma_migrations WHERE finished_at IS NOT NULL), 'NONE')
       END;
SQL
}

# --- Collecte des 3 artefacts de vérification dans un répertoire -------------
# Écrit <dir>/counts.txt, <dir>/audit.fingerprint, <dir>/migrations.txt
ofs_collect_verification() {
  # usage: ofs_collect_verification <container> <db> <role> <dir>
  local c="$1" db="$2" role="$3" dir="$4"
  mkdir -p "$dir"
  ofs_psql "$c" "$db" "$role" "$(ofs_sql_table_counts)"       > "$dir/counts.txt"
  ofs_psql "$c" "$db" "$role" "$(ofs_sql_audit_fingerprint)"  > "$dir/audit.fingerprint"
  ofs_psql "$c" "$db" "$role" "$(ofs_sql_migrations_applied)" > "$dir/migrations.txt"
}

# --- Hash --------------------------------------------------------------------
ofs_sha256() { sha256sum "$1" | awk '{print $1}'; }

# Horodatage UTC déterministe (le jour J doit être en UTC — prod est en UTC).
ofs_utc_stamp() { date -u +%Y%m%dT%H%M%SZ; }
