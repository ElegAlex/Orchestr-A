# Contributing to Orchestr'A

Merci de votre intérêt pour Orchestr'A !

## Comment contribuer

### Signaler un bug

1. Vérifiez que le bug n'a pas déjà été signalé dans les [Issues](https://github.com/ElegAlex/Orchestr-A/issues)
2. Créez une issue avec :
   - Description claire du bug
   - Étapes pour reproduire
   - Comportement attendu vs observé
   - Environnement (OS, Node.js, Docker, navigateur)

### Proposer une fonctionnalité

1. Ouvrez une issue avec le label `enhancement`
2. Décrivez le besoin métier et la solution envisagée
3. Attendez la validation avant de coder

### Soumettre du code

1. Forkez le repo
2. Créez une branche (`git checkout -b feature/ma-fonctionnalite`)
3. Respectez les conventions du projet :
   - TypeScript strict
   - ESLint + Prettier (lancez `pnpm run lint` et `pnpm run format`)
   - Tests unitaires pour toute nouvelle logique
4. Commitez avec des messages conventionnels (`feat:`, `fix:`, `docs:`, `chore:`)
5. Ouvrez une Pull Request vers `master`

### Prérequis de développement

- Node.js >= 22.0.0
- pnpm 9.x
- Docker & Docker Compose v2+

### Lancer le projet en local

```bash
git clone https://github.com/ElegAlex/Orchestr-A.git
cd Orchestr-A
pnpm install
pnpm run docker:dev    # PostgreSQL + Redis
pnpm run db:migrate
pnpm run db:seed
pnpm run dev
```

## Code de conduite

Ce projet adhère au [Contributor Covenant](CODE_OF_CONDUCT.md). En participant, vous vous engagez à respecter ses termes.
