# 📘 COMMENCER ICI — Migration OFS Tracker vers le PLC Assurance Maladie

> Ce guide est le **point d'entrée**. Il explique le projet en langage simple, montre le
> flux complet, puis vous oriente vers le bon document selon votre rôle. Aucun pré-requis.

---

## 1. C'est quoi, en deux phrases ?

OFS Tracker (= l'application **Orchestr'A**) doit être hébergé sur le **réseau interne
Assurance Maladie**, **sans accès Internet** (« air-gap »), sur un **OS imposé** (le « PLC »,
une image AlmaLinux 8.6 durcie fournie par la CNAM). L'enjeu n°1 : **basculer sans perdre une
seule donnée**.

La solution : empaqueter toute l'appli dans **un seul conteneur** (« all-in-one ») avec **un
seul bloc de données** (`/data`), et un **outil de sauvegarde/restauration rejouable et
vérifié** qui prouve, chiffres à l'appui, qu'aucune donnée n'a été perdue.

---

## 2. Le flux complet (vue d'ensemble)

```
  PROD actuelle (VPS, PostgreSQL 18, en ligne)        CIBLE = PLC AlmaLinux 8.6 (air-gap)
  ┌───────────────────────────┐                       ┌────────────────────────────────────┐
  │ base + uploads + secrets   │                       │  Docker (installé hors-ligne)        │
  └─────────────┬─────────────┘                       │    └─ all-in-one PG18  →  /data       │
                │  ① ofs-backup.sh  (LECTURE SEULE)    └──────────────────▲───────────────────┘
                │     pg_dump + uploads + manifeste                       │ ③ ofs-restore.sh
                ▼     (+ secrets)                                         │    + VÉRIFICATION
        archive ofs-snapshot-*.tar.gz  ───── ② transfert hors-ligne ──────┘    zéro-perte :
                                              (canal sécurisé)                 comptages + empreinte
                                                                               d'audit + migrations
                                                                               ┌──────────────────┐
   ④ Go / No-Go : la restauration ne remet l'appli en service QUE si           │ IDENTIQUES ?      │
      « comptages + audit + migrations IDENTIQUES ». Tout écart = arrêt.        │ oui → Go / non → No-Go
                                                                               └──────────────────┘
```

**Pourquoi c'est sûr** : ① ne fait que *lire* la prod (jamais d'écriture). ③ refuse de
démarrer l'appli si la moindre table diffère. La prod reste votre **filet de secours** tant
qu'elle n'est pas décommissionnée.

---

## 3. Par où commencer, selon votre rôle

| Vous êtes… | Lisez, dans cet ordre |
|---|---|
| **Décideur / chef de projet** | Ce guide (§1-2-5-6) → c'est tout. |
| **Équipe infra (déploiement)** | `README-LIVRAISON.md` → `RUNBOOK.md` **Partie A** → §7 (troubleshooting) de ce guide. |
| **Opérateur du jour J (bascule)** | `RUNBOOK.md` **Partie B** (Go/No-Go) + **Partie C** (rollback). |
| **Reconstruire / lancer la démo** | `plc-bundle/BUILD.md` (reconstruire) · `plc-bundle/README.md` (lancer en 1 commande). |
| **Comprendre la conception** | `CONCEPTION.md` (décisions, faits validés, mécanisme). |

---

## 4. Les artefacts livrés

| Artefact | À quoi ça sert |
|---|---|
| **Paquet de livraison** (`livraison-orchestra-cnam/`) | Tout pour déployer : image, RPM Docker, scripts de restore, docs. **Sans secrets.** |
| **Archive de données** (`ofs-snapshot-*.tar.gz`) | Les données prod + uploads + secrets. **Livrée à part, canal sécurisé.** |
| **Bundle démo** (`plc-ofs-simulation.tar.gz`) | OFS-sur-PLC qui tourne en 1 commande sur une machine KVM (démonstration). |
| **Scripts `scripts/ofs/`** (dépôt) | Le mécanisme rejouable backup/restore (l'outil du jour J). |

---

## 5. Glossaire (à lire une fois)

| Terme | En clair |
|---|---|
| **PLC** | L'OS imposé par la CNAM : AlmaLinux 8.6 durci, livré en image VMware (OVF). |
| **Air-gap** | Isolation totale d'Internet : les fichiers entrent hors-ligne, jamais par téléchargement. |
| **All-in-one** | Toute l'appli (base + cache + API + Web + proxy) dans **un** conteneur, état dans **un** volume `/data`. |
| **PostgreSQL (PG)** | Le moteur de base de données. Versions majeures (16, 17, **18**). On restaure dans une version **≥** l'origine, **jamais inférieure** (prod = 18 → cible = 18). |
| **pg_dump / restore** | Sauvegarde / restauration logique d'une base. |
| **Empreinte de chaîne d'audit** | Un `md5` du journal d'audit. Identique avant/après ⇒ audit restauré **bit-à-bit**. |
| **Zéro-perte vérifiée** | Comparaison automatique comptages + empreinte d'audit + migrations, source vs cible. |
| **vSphere / KVM** | Hyperviseurs. La CNAM utilise **vSphere** ; la simulation locale utilise **KVM**. |

---

## 6. Où on en est (statut honnête)

**✅ Validé (prouvé en local, dans le vrai PLC) :**
- Docker s'installe et tourne dans le PLC durci (SELinux *permissive*, aucun blocage).
- L'all-in-one démarre ; **restauration zéro-perte prouvée** (41 users, audit identique).
- Fonctionnement **air-gappé** prouvé (l'appli répond, aucune sortie Internet).

**⏳ Reste (côté CNAM, phase 2 — dépend de *leur* environnement) :**
- Import de l'OVF dans **leur vSphere** (la simulation utilise KVM).
- Réseau interne : DNS, TLS/AC interne, reverse-proxy, firewall.
- **Secure Boot** : la simulation boote en SB-OFF ; le SB strict demande une MAJ shim/grub.

> En une phrase : le **risque n°1 (perte de données) est levé et prouvé**, l'outil et la doc
> sont prêts ; il reste l'intégration dans l'environnement interne CNAM.

---

## 7. Problèmes connus → solutions (troubleshooting)

| Symptôme | Cause | Solution |
|---|---|---|
| L'all-in-one **ne build pas** | chemin bcrypt figé / version | Corrigé (résolution dynamique). `Dockerfile` à jour. |
| L'API **crash-loop** au boot | `AUDIT_HASH_KEY`/`METRICS_TOKEN` absents, ou `DATABASE_MIGRATION_URL` manquant, ou paquet `rbac` non copié | Corrigés (compose offline + entrypoint + Dockerfile). Vérifier que le `.env` porte bien `AUDIT_HASH_KEY`. |
| **Docker ne s'installe pas** dans le PLC (« métadonnée de module ») | 4 dépendances sont des paquets **modulaires** | `dnf install … --repo=be --setopt=be.module_hotfixes=true` (cf. RUNBOOK §A6). Ne PAS faire `dnf install ./*.rpm`. |
| `docker load` **échoue (no space)** | `/var` du PLC = 2 Go et le VG est **plein** (~740 Mo libres) | **Disque/volume data dédié (~10 Go+)** + `data-root` dans `/etc/docker/daemon.json`. |
| VM **« cannot open root device »** | pas de pilote **virtio** dans l'initramfs du PLC | Présenter le disque en **SATA/AHCI** (ou pvscsi), jamais virtio. |
| **mount du bundle échoue** | un fs (xfs/ext4) créé sur poste récent n'est pas montable par le noyau 4.18 | Livrer le bundle en **ISO9660** ; formater tout disque data **par le PLC lui-même**. |
| **Secure Boot** bloque (`PageFaultExitBoot: NX`) | `shim` 15.4 + `grub2` 2.02 antérieurs au durcissement NX | Booter **SB-OFF**, ou MAJ `shim`≥15.6 + `grub2` dans l'image. PAS un rejet de certificat. |
| Restauration : **écart de comptage / app à l'arrêt** | **garde-fou zéro-perte** : les données diffèrent | Comportement **voulu**. Investiguer l'écart AVANT toute remise en service ; ne pas forcer. |
| `/api/health` pas `200` tout de suite | `start_period` du healthcheck = 90 s | Attendre 1-2 min après le boot ; l'appli se déclare *healthy* ensuite. |

---

## 8. FAQ

**La prod est-elle touchée par la migration ?**
Non. La sauvegarde est en **lecture seule** ; la restauration vise une **copie** sur une autre
machine. La prod reste intacte et sert de **rollback** tant qu'on ne la décommissionne pas.

**Le même outil sert-il pour le jour J ?**
Oui — `ofs-backup.sh` / `ofs-restore.sh` sont **rejouables à l'identique** : on ne change que
le fichier de config. La vérification zéro-perte **est** la preuve de bascule réussie.

**Faut-il vraiment livrer les secrets ?**
Oui : `AUDIT_HASH_KEY` (intégrité de l'audit) et `JWT_SECRET` (sessions) **font partie des
données**. Sans eux, l'audit devient incohérent / l'API ne démarre pas. Ils voyagent dans
l'archive de données, **par canal sécurisé séparé**.

**La simulation KVM = l'environnement CNAM ?**
Non. Elle reproduit fidèlement l'**OS + l'appli + les données + l'air-gap**, mais l'hyperviseur
est **KVM**, pas le **vSphere** CNAM. L'import OVF natif dans vSphere reste leur étape.

**Combien de temps pour démarrer la démo ?**
`./run-plc.sh` → l'appli répond sur `http://localhost:8088` en **~30 s** après le boot.
