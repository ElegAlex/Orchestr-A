# 🚀 GETTING STARTED - ORCHESTR'A V2

Guide de démarrage rapide pour le développement.

## ✅ Prérequis installés

- ✅ Node.js v24.11.0 (compatible, recommandé v22+)
- ✅ pnpm 9.15.9
- ✅ Docker & Docker Compose

## 📦 Structure du projet initialisé

```
orchestr-a-v2/
├── apps/
│   ├── api/              ✅ Backend NestJS + Fastify
│   ├── web/              ✅ Frontend Next.js 15 + React 19
│   └── docs/             📝 À créer (Docusaurus)
├── packages/
│   ├── database/         ✅ Prisma + PostgreSQL 18
│   ├── types/            ✅ Types TypeScript partagés
│   ├── ui/               ✅ Composants UI
│   ├── config/           ✅ Configurations
│   └── utils/            ✅ Utilities
├── infrastructure/
│   └── docker/           ✅ PostgreSQL + Redis
├── .env.example          ✅ Variables d'environnement
├── .env                  ✅ Configuration locale
├── docker-compose.yml    ✅ Services Docker
├── turbo.json            ✅ Configuration Turborepo
└── README.md             ✅ Documentation
```

## 🎯 Prochaines étapes

### 1. Démarrer les services Docker

```bash
pnpm run docker:dev
```

Cela démarre :

- 🐘 **PostgreSQL 18** sur port 5432
- 🔴 **Redis 7.4** sur port 6379

### 2. Exécuter les migrations Prisma

```bash
pnpm run db:migrate
```

Cela crée les tables dans PostgreSQL selon le schéma `packages/database/prisma/schema.prisma`.

### 3. Seed la base de données

```bash
pnpm run db:seed
```

Cela crée :

- 👤 Un utilisateur admin : `admin@orchestr-a.internal` / `admin123`
- 🏢 Un département de test
- 🎯 Un projet de test

### 4. Démarrer l'application

```bash
pnpm run dev
```

Cela démarre en mode watch :

- 🔌 **API Backend** : http://localhost:3001
- 🌐 **Frontend Web** : http://localhost:3000

## 🔧 Configuration Backend (NestJS + Fastify)

### Modifier le main.ts pour utiliser Fastify

Le fichier `apps/api/src/main.ts` doit être modifié :

```typescript
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  app.setGlobalPrefix("api");

  await app.listen(3001, "0.0.0.0");
  console.log(`🚀 API listening on http://localhost:3001/api`);
}
bootstrap();
```

### Ajouter Swagger (documentation API)

Dans `apps/api/src/main.ts` :

```typescript
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

// ... dans bootstrap()
const config = new DocumentBuilder()
  .setTitle("ORCHESTR'A V2 API")
  .setDescription("API de gestion de projets et RH")
  .setVersion("2.0.0")
  .addBearerAuth()
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup("api/docs", app, document);
```

Swagger sera disponible sur : http://localhost:3001/api/docs

## 🎨 Configuration Frontend (Next.js)

### Configurer l'API client

Créer `apps/web/lib/api.ts` :

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export async function fetchApi(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}
```

### Installer les dépendances UI

Les packages nécessaires sont déjà dans `apps/web/package.json`, mais vous devrez ajouter :

```bash
cd apps/web
pnpm add @tanstack/react-query zustand
pnpm add @rsagiev/gantt-task-react-19
pnpm add recharts react-big-calendar
pnpm add @dnd-kit/core @dnd-kit/sortable
```

## 📊 Utiliser Prisma Studio

Pour explorer/modifier la base de données graphiquement :

```bash
pnpm run db:studio
```

Cela ouvre : http://localhost:5555

## 🐛 Debugging

### Backend

```bash
cd apps/api
pnpm run start:debug
```

Puis dans VS Code, F5 ou connecter le debugger sur le port 9229.

### Frontend

Utiliser les React DevTools dans Chrome/Firefox.

### Base de données

```bash
# Se connecter à PostgreSQL
docker exec -it orchestr-a-db psql -U orchestr_a -d orchestr_a_v2

# Lister les tables
\dt

# Quitter
\q
```

## 📝 Développement recommandé

### Workflow suggéré

1. **Créer une branche**

   ```bash
   git checkout -b feature/nom-fonctionnalite
   ```

2. **Développer dans l'ordre**
   - 📋 Schéma Prisma (`packages/database/prisma/schema.prisma`)
   - 🔄 Migrations : `pnpm run db:migrate`
   - 🔌 Backend : Créer modules/services/controllers NestJS
   - 🎨 Frontend : Créer pages/composants Next.js
   - 🧪 Tests : Ajouter tests unitaires et E2E

3. **Tester**

   ```bash
   pnpm run test
   pnpm run lint
   ```

4. **Commit**
   ```bash
   git add .
   git commit -m "feat: description de la fonctionnalité"
   ```

### Structure des modules NestJS

Pour chaque domaine fonctionnel :

```
apps/api/src/projects/
├── projects.module.ts
├── projects.controller.ts
├── projects.service.ts
├── dto/
│   ├── create-project.dto.ts
│   └── update-project.dto.ts
├── entities/
│   └── project.entity.ts
└── projects.controller.spec.ts
```

### Structure des pages Next.js

```
apps/web/app/
├── (auth)/              # Route group authentification
│   ├── login/
│   │   └── page.tsx
│   └── layout.tsx
├── (dashboard)/         # Route group application
│   ├── layout.tsx       # Layout avec sidebar
│   ├── projects/
│   │   ├── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   └── dashboard/
│       └── page.tsx
└── layout.tsx           # Root layout
```

## 🔐 Authentification

### Backend (à implémenter)

1. Créer le module auth :

   ```bash
   cd apps/api
   pnpm nest g module auth
   pnpm nest g service auth
   pnpm nest g controller auth
   ```

2. Implémenter JWT Strategy
3. Guards pour protéger les routes
4. Décorateurs personnalisés (@CurrentUser)

### Frontend (à implémenter)

1. Créer un AuthContext
2. Stocker le token JWT (localStorage ou cookies)
3. Middleware Next.js pour protection des routes
4. Refresh token automatique

## 📚 Ressources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Turborepo Documentation](https://turbo.build/repo/docs)

## ⚠️ Notes importantes

### Peer Dependencies Warnings

Lors de l'installation, vous verrez des warnings sur les peer dependencies de NestJS. Ces packages attendent @nestjs/common v8-10 mais nous utilisons v11. **Ces warnings ne sont pas bloquants** et seront corrigés dans les prochaines versions des packages ou peuvent être ignorés avec `--force` si nécessaire.

### PostgreSQL 18

Nous utilisons PostgreSQL 18 (dernière version, septembre 2025) qui apporte :

- Performances I/O 3x plus rapides
- Support OAuth 2.0 natif
- Colonnes générées virtuelles
- uuidv7() pour meilleures performances

### Prisma 6.16

Prisma 6.16 utilise le nouveau Query Compiler Rust-free :

- Bundle 90% plus léger
- Queries 3.4x plus rapides
- Multi-schema en GA

## 🎉 Prêt à développer !

Vous avez maintenant tout ce qu'il faut pour commencer à développer ORCHESTR'A V2.

**Bon développement ! 🚀**

---

**Questions ou problèmes ?**
Consultez [README.md](./README.md) ou [STACK-TECHNIQUE.md](./STACK-TECHNIQUE.md)
