-- Avatar unification — cleanup legacy presets (prod)
-- Execution manuelle par admin DB requise. NE PAS exécuter automatiquement.
-- Contexte: les 10 SVG legacy `avatar_01.svg..avatar_10.svg` ont été supprimés
-- en V6 du refactor avatar-unification. Les users qui ont en DB un avatarPreset
-- du format 'avatar_XX' afficheront désormais un fallback monogramme (onError de
-- UserAvatar absorbe le 404). Ce script nettoie les valeurs devenues invalides.

-- Step 1 — inventory (read-only):
SELECT COUNT(*) AS legacy_users, "avatarPreset"
FROM users
WHERE "avatarPreset" LIKE 'avatar_%'
GROUP BY "avatarPreset";

-- Step 2 — remediation (décommenter pour exécuter):
-- UPDATE users SET "avatarPreset" = NULL WHERE "avatarPreset" LIKE 'avatar_%';
