# Checklist de Synchronisation Serveur L51750100ORC

**Date de generation**: 2025-12-12
**Serveur cible**: VPS OVH (92.222.35.25)
**Projet**: Orchestr'a V2

---

## Actions a effectuer sur le serveur

### 1. Fichiers a synchroniser depuis le depot local

Les fichiers suivants doivent etre copies/mis a jour sur le serveur :

| Fichier | Action | Criticite |
|---------|--------|-----------|
| `package.json` | Mettre a jour | HAUTE |
| `docker-compose.yml` | Mettre a jour | HAUTE |
| `docker-compose.prod.yml` | Mettre a jour | HAUTE |
| `apps/api/vitest.config.ts` | Mettre a jour | HAUTE |
| `packages/database/prisma/schema.prisma` | Verifier/Restaurer | CRITIQUE |
| `scripts/pre-deploy-check.sh` | Ajouter (nouveau) | MOYENNE |

---

### 2. Corrections manuelles sur le serveur

#### 2.1 Fichier `packages/database/prisma/schema.prisma`

**CRITIQUE** : Si l'URL de la base de donnees est codee en dur, restaurer la version avec variable d'environnement.

```bash
# Sur le serveur
cd /opt/orchestra
vi packages/database/prisma/schema.prisma
```

**Remplacer** :
```prisma
datasource db {
  provider = "postgresql"
  url      = "postgresql://orchestr_a:0rch_PG_2025@localhost:5432/orchestr_a_v2"
}
```

**Par** :
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

#### 2.2 Fichier `.env` sur le serveur

Verifier que le fichier `.env` contient :

```env
DATABASE_URL="postgresql://orchestr_a:0rch_PG_2025@localhost:5432/orchestr_a_v2"
POSTGRES_USER=orchestr_a
POSTGRES_PASSWORD=0rch_PG_2025
POSTGRES_DB=orchestr_a_v2
POSTGRES_PORT=5432
```

---

#### 2.3 Fichier `apps/api/vitest.config.ts`

**CRITIQUE** : Verifier la structure `server.deps.inline` (syntaxe Vitest 4.x).

La configuration correcte est :

```typescript
export default defineConfig({
  // ... autres options
  test: {
    // ... autres options test
    server: {
      deps: {
        inline: ['database'],
      },
    },
  },
  // ...
});
```

**NE PAS UTILISER** (syntaxe deprecee Vitest < 4.x) :
```typescript
test: {
  deps: {
    inline: ['database'],
  },
}
```

---

### 3. Procedure de mise a jour complete

```bash
# 1. Se connecter au serveur
ssh debian@92.222.35.25

# 2. Aller dans le repertoire du projet
cd /opt/orchestra

# 3. Sauvegarder les fichiers modifies localement
cp .env .env.backup.$(date +%Y%m%d)
cp packages/database/prisma/schema.prisma schema.prisma.backup

# 4. Mettre a jour depuis le depot Git (si disponible)
git fetch origin
git stash  # Sauvegarder les modifications locales
git pull origin main
git stash pop  # Restaurer les modifications locales si necessaire

# OU si pas de Git, transferer les fichiers manuellement :
# scp -r ./package.json debian@92.222.35.25:/opt/orchestra/
# scp -r ./docker-compose*.yml debian@92.222.35.25:/opt/orchestra/
# scp -r ./apps/api/vitest.config.ts debian@92.222.35.25:/opt/orchestra/apps/api/
# scp -r ./scripts/pre-deploy-check.sh debian@92.222.35.25:/opt/orchestra/scripts/

# 5. Restaurer le fichier .env (NE PAS ecraser avec la version du depot)
cp .env.backup.$(date +%Y%m%d) .env

# 6. Verifier que schema.prisma utilise env("DATABASE_URL")
grep -n "url" packages/database/prisma/schema.prisma

# 7. Reinstaller les dependances
pnpm install

# 8. Executer le script de verification
pnpm run pre-deploy

# 9. Demarrer les services Docker
pnpm run docker:dev

# 10. Executer les migrations
cd packages/database
pnpm run db:migrate

# 11. Retour racine et build
cd /opt/orchestra
pnpm run build
```

---

### 4. Points de verification post-synchronisation

- [ ] `docker ps` montre PostgreSQL et Redis en status "healthy"
- [ ] `pnpm run pre-deploy` ne retourne aucune erreur
- [ ] `pnpm run build` se termine sans erreur
- [ ] `schema.prisma` utilise `env("DATABASE_URL")` (pas d'URL en dur)
- [ ] Les secrets ne sont PAS dans le code versionne

---

### 5. Rollback en cas de probleme

```bash
# Restaurer les fichiers de backup
cp .env.backup.$(date +%Y%m%d) .env
cp schema.prisma.backup packages/database/prisma/schema.prisma

# Reinstaller
pnpm install
```

---

## Notes de securite

1. **Credentials en dur** : Ne JAMAIS coder en dur les credentials dans `schema.prisma` ou tout autre fichier versionne
2. **Fichier .env** : Doit etre dans `.gitignore` et ne jamais etre commite
3. **Mots de passe** : Changer les mots de passe par defaut en production
4. **CVE mentionnees** : Les CVE-2025-67489 et CVE-2025-67779 mentionnees dans la documentation sont invalides - verifier avec `pnpm audit`

---

## Contacts

En cas de probleme :
- Documentation : `/opt/orchestra/OPERATIONS.md`
- GitHub : https://github.com/ElegAlex/Orchestr-A
