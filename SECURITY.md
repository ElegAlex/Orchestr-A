# Security Policy

## Versions supportées

| Version | Supportée |
| ------- | --------- |
| 2.x     | Oui       |
| < 2.0   | Non       |

## Signaler une vulnérabilité

**Ne signalez PAS les vulnérabilités via les Issues publiques.**

Envoyez un email à **security@orchestr-a.dev** avec :

- Description de la vulnérabilité
- Étapes pour reproduire
- Impact potentiel
- Suggestion de correction (si possible)

Vous recevrez une réponse sous 48h. Les vulnérabilités confirmées seront corrigées en priorité et créditées dans le changelog.

## Bonnes pratiques de déploiement

- Changez **impérativement** les identifiants par défaut (`admin` / `admin123`)
- Utilisez des secrets forts (min 32 caractères pour JWT_SECRET)
- Activez HTTPS en production
- Restreignez CORS_ORIGIN à votre domaine
- Configurez le rate limiting via THROTTLE_LIMIT et THROTTLE_TTL
