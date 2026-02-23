-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'TECHNICIEN_SUPPORT';
ALTER TYPE "Role" ADD VALUE 'GESTIONNAIRE_PARC';
ALTER TYPE "Role" ADD VALUE 'ADMINISTRATEUR_IML';
ALTER TYPE "Role" ADD VALUE 'DEVELOPPEUR_CONCEPTEUR';
ALTER TYPE "Role" ADD VALUE 'CORRESPONDANT_FONCTIONNEL_APPLICATION';
ALTER TYPE "Role" ADD VALUE 'CHARGE_DE_MISSION';
ALTER TYPE "Role" ADD VALUE 'GESTIONNAIRE_IML';
ALTER TYPE "Role" ADD VALUE 'CONSULTANT_TECHNOLOGIE_SI';
