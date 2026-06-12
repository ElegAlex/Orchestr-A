# Validation de l'ARTEFACT « livraison-orchestra-cnam » (2026-06-12)

## Pourquoi ce document

Le 2026-06-12, le banc d'essai OpsTracker a révélé que le paquet de livraison Orchestr'A
assemblé les 9-10/06 était **défectueux** : `docker-rpms/` sans métadonnées `repodata/`
(copié depuis le dossier de téléchargement brut, alors que le banc d'essai PLC avait
utilisé une AUTRE copie du dépôt, elle complète). `dnf` aurait échoué chez l'infra CNAM
à l'étape A6 du runbook. **Le banc d'essai avait validé le processus, pas l'artefact.**

Correctif : `repodata/` éprouvé recopié (correspondance vérifiée par checksums sur les
188 RPM), `CHECKSUMS.txt` régénéré (207), tar.gz reconstruit, clé USB recopiée et
revérifiée (207/207 sur la clé).

## Validation de l'artefact corrigé — banc PLC du 2026-06-12

ISO assemblé **exclusivement depuis le paquet de livraison** (son image
`orchestr-a-local.tar.gz`, SON `docker-rpms/` corrigé, SES scripts, SON compose) +
snapshot prod du 12/06 (`orchestra-snapshot-20260612T085110Z`, 41 users) + secrets prod.
Firstboot : le script éprouvé du dépôt, inchangé. VM : PLC AlmaLinux 8.6, SATA, OVMF
SB-OFF, **sans réseau**.

| Étape (sources = le paquet) | Résultat |
|---|---|
| Docker installé depuis **le `docker-rpms/` du paquet** | ✅ `DOCKER_OK`, Server 26.1.3 |
| `docker load` de **l'image du paquet** | ✅ `orchestr-a:local` |
| compose up (compose du paquet) | ✅ |
| `orchestra-restore.sh` (script du paquet) sur snapshot prod 12/06 | ✅ bannière `════ RESTAURATION VÉRIFIÉE ET APPLICATION SAINE ════` |
| `/api/health` | ✅ 200 |
| Données | ✅ `users=41` (= prod) |
| Auto-démarrage | ✅ `docker enabled` + `unless-stopped` |
| Boot de contrôle à froid (air-gap, sans ISO) | ✅ `/api/health` 200, app auto-redémarrée |

### Nature des preuves (honnêteté méthodologique)

- **Directes** : DOCKER_OK depuis le dépôt du paquet, bannière de restauration, health 200,
  `users=41`, auto-restart au boot de contrôle.
- **Par construction** : les lignes « ✓ Comptages/Empreinte IDENTIQUES » ont été tronquées
  du journal (le firstboot limitait la sortie du restore à `tail -20` ; corrigé en
  `tail -60`). La bannière `RESTAURATION VÉRIFIÉE` ne s'imprime toutefois **que** si
  `FAIL=0` — tout écart de comptage ou d'empreinte d'audit déclenche
  `ÉCHEC : INTÉGRITÉ NON PROUVÉE` et l'app reste à l'arrêt (cf. `orchestra-restore.sh`
  §3/4). Bannière présente ⟹ comptages et audit identiques.

## Sceau de l'artefact validé

```
livraison-orchestra-cnam.tar.gz
sha256 = 26a888d6e3bcbf5419e093b8863de6e3bc9a7717c07083f274148daaa98cf5b9
```

**Toute remise à l'infra doit porter ce sha256.** Si le paquet est modifié (même un
fichier de doc), il doit être **re-validé en tant qu'artefact** avant remise.

## Leçon (désormais règle)

1. « Prêt » = **l'artefact final testé fonctionnellement**, pas le processus validé avec
   d'autres copies. Le banc et l'assemblage doivent partir des **mêmes fichiers**.
2. Contrôle minimal avant toute remise : `docker-rpms/repodata/repomd.xml` présent,
   image chargeable, scripts `bash -n`, sha256 de l'archive de données.
3. Un défaut découvert dans un livrable déjà remis/copié s'annonce **en première ligne,
   comme seul sujet du message** — jamais au fil d'un rapport de succès.
