-- =============================================================================
-- fix-restore.sql — Correction des droits apres pg_restore -U postgres
-- =============================================================================
-- Contexte : pg_restore avec -U postgres --no-owner rend postgres proprietaire
-- de tous les objets. Sur PG 15+, l'utilisateur orchestr_a perd l'acces au
-- schema public et Prisma echoue avec "relation does not exist".
--
-- Ce script est execute par fix-restore.sh via : psql -U postgres -d orchestr_a -f fix-restore.sql
-- =============================================================================

-- Etape 1 : S'assurer que l'utilisateur orchestr_a existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'orchestr_a') THEN
        CREATE USER orchestr_a WITH PASSWORD 'orchestr_a';
        RAISE NOTICE 'Utilisateur orchestr_a cree';
    ELSE
        RAISE NOTICE 'Utilisateur orchestr_a existe deja';
    END IF;
END
$$;

-- Etape 2 : Transferer la propriete de TOUS les objets de postgres vers orchestr_a
-- Couvre : schemas, tables, sequences, types (enums), fonctions, vues
-- Ne touche PAS aux extensions (uuid-ossp reste a postgres, c'est normal)
REASSIGN OWNED BY postgres TO orchestr_a;

-- Etape 3 : Rendre postgres proprietaire du schema pg_catalog et information_schema
-- REASSIGN a aussi transfere ces schemas systeme, il faut les remettre
ALTER SCHEMA pg_catalog OWNER TO postgres;
ALTER SCHEMA information_schema OWNER TO postgres;

-- Etape 4 : Accorder les droits sur le schema public (protection PG 15+)
GRANT ALL ON SCHEMA public TO orchestr_a;
GRANT USAGE ON SCHEMA public TO PUBLIC;

-- Etape 5 : Accorder les droits sur la base elle-meme
GRANT ALL PRIVILEGES ON DATABASE orchestr_a TO orchestr_a;

-- Etape 6 : S'assurer que l'extension uuid-ossp est disponible
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Etape 7 : Remettre l'extension uuid-ossp a postgres (bonne pratique)
-- Les extensions doivent appartenir a un superuser
ALTER EXTENSION "uuid-ossp" UPDATE;
