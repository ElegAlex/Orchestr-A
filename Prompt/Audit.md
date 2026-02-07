# AUDIT PROJET — Génération Knowledge Base pour Prompt Meta

## PERSONA

Tu es un architecte logiciel senior chargé d'auditer ce projet pour générer une documentation de référence.

## OBJECTIF

Explorer exhaustivement le projet et produire un rapport structuré qui servira de **Knowledge Base** pour un prompt meta (orchestration de futures sessions de dev).

## ÉTAPES

### 1. Structure générale

```bash
# Arborescence racine
ls -la
# Structure complète (2 niveaux)
find . -maxdepth 3 -type d -not -path '*/node_modules/*' -not -path '*/.git/*' | head -100
```

Identifie :

- Type de projet (monorepo ? workspaces ?)
- Apps/packages présents
- Organisation des dossiers

### 2. Stack technique

Analyse les fichiers de config :

- `package.json` (racine + apps)
- `tsconfig.json`
- `docker-compose*.yml`
- `Dockerfile*`
- Fichiers de config (`.env.example`, `nest-cli.json`, `next.config.*`, etc.)

Produis un tableau :

| Composant | Version | Usage |
| --------- | ------- | ----- |

### 3. Architecture applicative

Pour chaque app (api, web, etc.) :

- Framework utilisé
- Structure des dossiers (controllers, services, modules, pages, components...)
- Patterns identifiés (Repository, CQRS, Clean Architecture, etc.)
- ORM/Base de données
- Authentification (JWT, sessions, etc.)

### 4. Conventions de code

Identifie :

- Conventions de nommage (fichiers, classes, fonctions)
- Structure des imports
- Gestion des erreurs
- Logging
- Tests (framework, organisation)

### 5. Routes / Endpoints

Pour l'API :

```bash
# Si NestJS, chercher les décorateurs @Controller, @Get, @Post, etc.
grep -r "@Controller\|@Get\|@Post\|@Put\|@Delete\|@Patch" apps/api/src --include="*.ts" | head -50
```

Pour le frontend :

```bash
# Structure des pages (Next.js App Router ou Pages Router ?)
ls -la apps/web/src/app 2>/dev/null || ls -la apps/web/pages 2>/dev/null
```

### 6. Modèles de données

```bash
# Prisma ?
cat prisma/schema.prisma 2>/dev/null | head -100
# TypeORM ?
find . -name "*.entity.ts" -not -path '*/node_modules/*' | head -20
```

Liste les entités principales avec leurs relations.

### 7. Scripts et workflows

```bash
# Scripts disponibles
cat package.json | jq '.scripts' 2>/dev/null
# CI/CD
ls -la .github/workflows/ 2>/dev/null
```

### 8. Points d'attention

Identifie :

- Dette technique visible
- TODOs/FIXMEs dans le code
- Incohérences éventuelles
- Dépendances obsolètes

## FORMAT DE SORTIE

Produis un document Markdown structuré ainsi :

```markdown
# KNOWLEDGE BASE — Orchestr-A

## 1. Vue d'ensemble

[Type de projet, description courte]

## 2. Stack technique

| Composant | Version | Usage |
| --------- | ------- | ----- |

## 3. Architecture

### API (apps/api)

[Structure, patterns]

### Frontend (apps/web)

[Structure, patterns]

## 4. Modèles de données

[Entités et relations]

## 5. Routes principales

### API

| Méthode | Route | Description |
| ------- | ----- | ----------- |

### Frontend

| Route | Page/Composant |
| ----- | -------------- |

## 6. Conventions

[Nommage, structure, patterns]

## 7. Scripts utiles

| Script | Usage |
| ------ | ----- |

## 8. Points d'attention

[Dette, TODOs, risques]
```

## RÉSULTAT ATTENDU

Un document **KNOWLEDGE-BASE.md** complet que je pourrai utiliser comme référence pour toutes les futures sessions de développement.

Ne fais pas d'hypothèses — base-toi uniquement sur ce que tu trouves dans le code.
