# 📦 Migration Ramage — TOUT ce qu'il faut, au même endroit

> Migration de l'instance VPS actuelle d'**Orchestr'A** vers **Ramage** (réseau interne
> Assurance Maladie, **air-gap**, OS PLC AlmaLinux 8.6). Ce dossier rassemble **l'intégralité
> des livrables**. Données prod incluses, **à jour du 2026-06-12**.
>
> ⚠️ **Ce dossier est volontairement HORS Git** (sauf ce README) : il contient ~4 Go de
> binaires **et l'archive de données prod avec ses secrets**. Ne jamais le committer.

---

## La migration = remettre DEUX choses

| Pièce | Quoi | Où ici | À remettre |
|---|---|---|---|
| **1** | **Paquet de déploiement** (sans secret) — 908 Mo | `1-paquet-deploiement/livraison-orchestra-cnam.tar.gz` | à l'équipe infra, par tout canal |
| **2** | **Archive de données** (base + uploads + **secrets**) — 4,2 Mo, snapshot du **12/06 10:51** | `2-archive-donnees-SECRETS/orchestra-snapshot-20260612T085110Z.tar.gz` (+ `.sha256`) | **séparément, par canal sécurisé** |

C'est tout. Le reste de ce dossier est du confort (mail prérédigé, démo).

---

## Contenu détaillé

```
migration_ramage/
├── 1-paquet-deploiement/
│   ├── livraison-orchestra-cnam.tar.gz    ← LE livrable infra (908 Mo)
│   └── livraison-orchestra-cnam/          ← le même, déplié (pour consultation)
│       ├── README-LIVRAISON.md            ← point d'entrée de l'équipe infra
│       ├── app/        (image all-in-one PG18 + compose offline + install)
│       ├── docker-rpms/ (Docker pour Alma 8.6, 188 RPM, installable air-gap)
│       ├── scripts/    (orchestra-restore.sh — restauration VÉRIFIÉE zéro-perte)
│       ├── docs/       (00-GUIDE didactique, RUNBOOK jour J, CONCEPTION)
│       └── CHECKSUMS.txt (sha256 des 200 fichiers)
├── 2-archive-donnees-SECRETS/             ← ⚠️ contient AUDIT_HASH_KEY + JWT_SECRET
│   ├── orchestra-snapshot-20260612T085110Z.tar.gz
│   └── orchestra-snapshot-20260612T085110Z.tar.gz.sha256
├── 3-mail-remise/
│   └── mail-remise-infra.md               ← mail prérédigé (2 liens à compléter)
└── 4-bundle-demo/                          ← OPTIONNEL (démonstration)
    └── plc-orchestra-simulation.tar.gz    ← Orchestr'A-dans-le-PLC en 1 commande (2,9 Go)
```

---

## Jour J — déroulé (détail : `docs/RUNBOOK.md` du paquet)

1. **Infra CNAM** : PLC importé dans leur vSphere + disque data dédié (~10 Go+).
2. Installer **Docker** depuis `docker-rpms/` (dépôt local + `module_hotfixes`, cf. RUNBOOK §A6).
3. `docker load` de l'image + `docker compose -f docker-compose.offline.yml up -d`.
4. **Rafraîchir les données** (si la bascule n'est pas le 12/06) — une commande, lecture
   seule, sur le VPS actuel :
   ```bash
   ./scripts/orchestra/orchestra-backup.sh --config orchestra.conf --yes
   ```
   → produit un `orchestra-snapshot-<date>.tar.gz` frais qui remplace celui du dossier 2.
5. **Restaurer** : `orchestra-restore.sh --config orchestra.conf <archive>` → comptages +
   empreinte d'audit + migrations **IDENTIQUES** exigés ; tout écart = **No-Go**, app à l'arrêt.
6. Exposition interne (DNS, TLS/AC interne, reverse-proxy) — périmètre CNAM.
7. **Rollback** : la prod VPS actuelle reste intacte et en service tant que la bascule
   n'est pas validée — c'est le filet de secours.

## Vérifier l'intégrité de l'archive de données

```bash
cd 2-archive-donnees-SECRETS
echo "$(cat orchestra-snapshot-20260612T085110Z.tar.gz.sha256)  orchestra-snapshot-20260612T085110Z.tar.gz" | sha256sum -c
```

## Ce qui a été PROUVÉ (banc d'essai, 2026-06-08/09)

- Docker s'installe et tourne **dans le vrai PLC durci** (hors-ligne).
- L'all-in-one démarre ; **restauration zéro-perte vérifiée** (45 tables, audit bit-à-bit).
- Fonctionnement **air-gap** prouvé. Mécanisme **rejoué avec succès le 12/06** (ce snapshot).

## Statut & restes (côté CNAM)

Import OVF dans **leur** vSphere, réseau interne, décision Secure Boot (boot validé en
SB-OFF). Tout le reste est dans ce dossier. Référence complète : `docs/migration-cnam/`
du dépôt et PlumeNote → Orchestr'A → *Migration Ramage* (PRO00…PRO05).
