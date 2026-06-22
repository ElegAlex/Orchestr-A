# Note de release — paquet MAJ Orchestr'A → Ramage

> À joindre à CHAQUE paquet de MAJ. Remplit le contrat entre le dépôt (build) et l'opérateur PLC (apply).
> L'application se fait selon `2026-06-22-RUNBOOK-MAJ-PROD-Ramage.md`, palier indiqué ci-dessous.

## Identité du paquet

| Champ | Valeur |
|---|---|
| Version / date | `vX.Y` — `AAAA-MM-JJ` |
| Commit `master` | `<sha40>` |
| Fichier paquet | `livraison-orchestra-cnam.tar.gz` |
| **Sceau sha256** | `<sha256 du .tar.gz>` |
| Image incluse | `orchestr-a:local` (`<sha image>`) |

## Palier d'impact données

> Cocher UN seul. En cas de doute → T2.

- [ ] **T0 — code seul** (aucune migration `prisma/migrations/`)
- [ ] **T1 — migration additive** (table/colonne nullable, index, default ; aucune perte possible)
- [ ] **T2 — migration destructive / transformante** (drop/rename, backfill, changement de type) → **répétition sur copie obligatoire**

## Migrations Prisma incluses (vs le commit actuellement en prod)

```
<lister les dossiers prisma/migrations/ ajoutés depuis la prod, ex. 20260622_xxx>
(aucune si T0)
```

## Remédiations / évolutions embarquées

| ID | Résumé (1 ligne) | Palier |
|---|---|---|
| `<COR-/SEC-/…>` | … | T0/T1/T2 |

## Instructions d'application

- Palier : **T_** → suivre le **§4._** du runbook.
- Backup-first **obligatoire** (§4.1). Conserver l'image N-1 (§4.2).
- Vérification attendue (§4.6) : `/api/health` = ok, migrations appliquées = celles listées ci-dessus, smoke métier OK.
- **Contrôles métier spécifiques** (T2) : `<quoi vérifier sur les données transformées>`.

## Rollback prévu

- T0 : re-tag image N-1.
- T1/T2 : restaurer le backup pré-MAJ (§4.7).

## Validation pré-transfert (côté dépôt)

- [ ] build vert + tests/E2E
- [ ] sceau sha256 calculé et reporté ci-dessus
- [ ] palier revu (migration-safety)
- [ ] paquet smoke-testé (idéalement déroulé au banc cible)

Contact build : `<…>` — Opérateur PLC : `<…>`
