# PLC-Orchestr'A — Simulation transportable

Simulation **autoportante** d'Orchestr'A tournant dans l'**OS PLC
Assurance Maladie** (AlmaLinux 8.6 durci), avec les **données de prod restaurées**, en
**air-gap**. Conçue pour être copiée sur n'importe quelle machine et démarrée en une commande.

## Lancer
Pré-requis : une machine Linux avec **qemu-kvm** + accès `/dev/kvm`.
```bash
./run-plc.sh
```
Puis ouvrir **http://localhost:8088** (compter ~1-2 min après le boot, le temps que Docker
relance l'all-in-one). Quitter qemu : **Ctrl-A puis X**.

## Ce que c'est
- **OS** : l'image PLC AlmaLinux 8.6 réelle (scellée). Mot de passe `root` = `BancEssaiOrchestr'A2026`
  (posé sur la copie pour les tests ; l'image scellée d'origine côté CNAM n'est pas modifiée).
- **App** : all-in-one PG18 (PostgreSQL + Redis + API + Web + nginx), **redémarrée
  automatiquement** par Docker à chaque boot (`restart: unless-stopped`).
- **Données** : prod restaurée (zéro-perte vérifié). **Login = identifiants de la prod**.
- **Réseau** : air-gap (`restrict=on`) — le guest ne peut PAS sortir sur Internet ; seul le
  port `8088` est exposé à l'hôte.

## Contenu du bundle
| Fichier | Rôle |
|---|---|
| `plc8-orchestra.qcow2` | Le PLC provisionné (Docker installé + configuré) |
| `docker-data.qcow2` | **Persistant** : image all-in-one + volume avec les données |
| `OVMF_CODE.fd` / `OVMF_VARS.fd` | Firmware UEFI (autonome) |
| `run-plc.sh` / `README.md` | Lanceur + doc |

## Limites (honnêteté)
Simulation **fidèle de l'OS + appli + données + air-gap**. Mais l'**hyperviseur est KVM**,
pas le **vSphere** de la CNAM : l'import OVF natif dans leur vSphere reste **leur** étape
(phase 2). Démarrage en **Secure Boot OFF** (le PLC bootе SB-ON après MAJ shim/grub côté CNAM).

## Réinitialiser l'état
Tout l'état vit dans `docker-data.qcow2`. Pour repartir d'un état « prod fraîche », remplacer
ce fichier par une copie de l'original (garder une copie de référence avant de tester).
