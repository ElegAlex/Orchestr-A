# RUNBOOK — Banc d'essai PLC air-gap & Dossier de migration Assurance Maladie

> **Public** : opérateur d'exploitation (autre que l'auteur). Aucune connaissance préalable
> du projet supposée — les termes techniques sont définis au §0 (glossaire).
> **Statut** : Partie A (banc d'essai) **validée le 2026-06-08** (preuve zéro-perte +
> application saine). Partie B (jour J) = procédure prête, valeurs CNAM à confirmer.
> **Règle d'or** : la **conservation des données (zéro perte)** prime sur tout.
> **Spec/conception** : `docs/migration-cnam/2026-06-08-banc-essai-plc-airgap-et-migration-design.md`.

---

## 0. Glossaire (à lire une fois)

| Terme | Définition |
|---|---|
| **Orchestr'A** | L'application (= Orchestr'A), conteneurisée. |
| **PLC** | L'OS durci fourni par l'Assurance Maladie : **AlmaLinux 8.6**, livré en **appliance VMware OVF**. |
| **OVF / VMDK** | Format d'**appliance** virtuelle / de **disque** virtuel VMware. |
| **KVM / qcow2 / OVMF** | Virtualisation native Linux / format de disque qemu / firmware **UEFI** virtuel. |
| **Air-gap** | Isolation totale d'Internet. Les fichiers entrent par transfert hors-ligne, jamais par téléchargement. |
| **All-in-one** | Toute l'appli (PostgreSQL + Redis + API + Web + nginx) dans **un seul conteneur**, état dans **un seul volume `/data`**. |
| **PG / PostgreSQL** | Le moteur de base de données. Versions majeures (16, 17, **18**). On restaure dans une version **≥** l'origine, **jamais inférieure**. |
| **pg_dump / pg_restore** | Outils de sauvegarde/restauration logique d'une base PostgreSQL. |
| **Empreinte de chaîne d'audit** | `md5` de la concaténation ordonnée des hash de `audit_logs`. Si identique avant/après, l'audit est restauré **bit-à-bit**. |

---

## PARTIE A — Banc d'essai (reproduire la prod CNAM sur le VPS)

### Architecture cible

```
VPS (OS actuel CONSERVÉ, non reformaté)
└── KVM/libvirt — réseau ISOLÉ (aucune sortie Internet)
    └── Invité = PLC AlmaLinux 8.6  (OVF → qcow2, démarrage UEFI, disque SATA)
        └── Docker Engine + compose v2  (RPM hors-ligne, cf. §A6)
            └── docker-compose.offline.yml  →  orchestr-a:local (all-in-one, PG18)
                └── volume /data  ← bloc consolidé (DB + Redis + uploads + secret)
```

### A0. Pré-requis de l'hôte
- CPU avec virtualisation imbriquée exposée : `grep -Ec 'vmx|svm' /proc/cpuinfo` > 0 **et** `/dev/kvm` présent. *(Vérifié sur le VPS prod : OK — 4 vCPU, ~5 Go RAM libres, ~51 Go disque.)*
- Paquets : `qemu-kvm`/`qemu-system-x86_64`, `qemu-img`, `libvirt`/`virt-install`, `edk2-ovmf` (firmware UEFI). *(Présents sur le poste de validation ; sur le VPS, à installer depuis les dépôts de l'hôte — hors PLC.)*
- Les fichiers OVF du PLC : `ovf-plc8-almalinux86.ovf`, `…-1.vmdk`, `…-2.nvram` (dépôt `PLC_ALMA_LINUX_8-6/`).

### A1. ⚠️ FILET DE SÉCURITÉ AVANT TOUT — sauvegarde des données
Même si **le banc d'essai est non destructif** (l'OS du VPS reste, le PLC tourne en invité), on capture une sauvegarde vérifiée **avant** toute manipulation, avec l'outil rejouable :

```bash
cd scripts/orchestra
cp orchestra.conf.example orchestra.conf      # adapter si besoin (valeurs prod par défaut)
./orchestra-backup.sh --config orchestra.conf # LECTURE SEULE sur la base ; archive horodatée
```
Pousser l'archive **hors du VPS** (NAS interne via `ORCHESTRA_NAS_DEST`). *Critère : archive + `.sha256` présents hors-disque.*

### A2. (Optionnel) Snapshot fournisseur du VPS
Si l'hébergeur le permet, prendre un snapshot complet du VPS — rollback ultime.

### A3. Conversion de l'appliance OVF → qcow2  *(validé)*
```bash
qemu-img convert -p -O qcow2 \
  PLC_ALMA_LINUX_8-6/ovf-plc8-almalinux86-1.vmdk  ~/plc/plc8.qcow2
qemu-img info ~/plc/plc8.qcow2     # contrôle
```

### A4. Démarrer le PLC en invité KVM  *(validé — contraintes FERMES)*
**⚠️ Disque en bus SATA/AHCI obligatoire** : l'initramfs du PLC n'embarque **pas** de pilote virtio (`virtio_blk`/`virtio_scsi` absents) → un disque virtio donne « cannot open root device ». Utiliser `ich9-ahci` (ou pvscsi).

**Secure Boot** : le démarrage strict échoue sur `PageFaultExitBoot: NX not clean` (shim 15.4 + GRUB2 2.02 trop anciens — **pas** un rejet de certificat). Deux options :
- **court terme** : démarrer **SB désactivé** (firmware `OVMF_CODE.fd`) ;
- **conformité** : mettre à jour `shim` (≥15.6) + `grub2` (≥2.02-142.el8) dans le qcow2, **ou** politique NX permissive côté OVMF hôte.

Démarrage validé (SB-OFF, SATA), console série :
```bash
cp /usr/share/edk2/ovmf/OVMF_VARS.fd ~/plc/OVMF_VARS.fd
qemu-system-x86_64 -name plc8 -machine q35 -enable-kvm -m 3072 -smp 2 \
  -drive if=pflash,format=raw,readonly=on,file=/usr/share/edk2/ovmf/OVMF_CODE.fd \
  -drive if=pflash,format=raw,file=~/plc/OVMF_VARS.fd \
  -device ich9-ahci,id=ahci0 \
  -drive if=none,id=disk0,format=qcow2,file=~/plc/plc8.qcow2 \
  -device ide-hd,bus=ahci0.0,drive=disk0 \
  -device e1000,netdev=net0 -netdev user,id=net0 \
  -nographic -serial mon:stdio -no-reboot
```
> Pour la cible définitive, préférer **libvirt/virt-install** (machine `q35`, firmware UEFI, disque **SATA**, réseau **isolé** host-only) pour un invité persistant et géré.

Attendu : `plc86-AlmaLinux login:` (Alma 8.6, kernel 4.18). **Identifiants du PLC : À CONFIRMER avec l'équipe CNAM.**

### A5. Couper Internet (air-gap simulé)
Mettre l'invité sur un **réseau libvirt isolé** (pas de NAT/route sortante). Vérification au §A8.

### A6. Installer Docker dans le PLC (hors-ligne)  *(VALIDÉ 2026-06-09)*
Le PLC n'embarque pas de runtime conteneur. Préparer le bundle RPM Alma 8.6 en **dépôt
local** — ne PAS faire `dnf install ./*.rpm` (ça upgraderait le socle durci du PLC : glibc,
systemd, selinux-policy…). Laisser dnf calculer le **delta** :
```bash
# Machine connectée : résoudre + télécharger, puis indexer en dépôt
dnf download --resolve --alldeps --destdir=./docker-rpms \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
createrepo_c ./docker-rpms
# Dans le PLC (hors-ligne) — dépôt local + module_hotfixes (4 deps sont MODULAIRES :
# container-selinux, fuse-overlayfs, slirp4netns, libslirp) :
sudo dnf install -y --repofrompath="be,file:///CHEMIN/docker-rpms" --repo=be \
  --nogpgcheck --setopt=be.module_hotfixes=true \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
# Data-root sur un disque DÉDIÉ : le LV /var du PLC = 2 Go et le VG est quasi plein
# (~740 Mo libres) => /var NON extensible ; l'image fait ~3 Go.
sudo mkfs.xfs -f /dev/sdX && sudo mkdir -p /var/lib/docker-data && sudo mount /dev/sdX /var/lib/docker-data
echo '{ "data-root": "/var/lib/docker-data" }' | sudo tee /etc/docker/daemon.json
sudo systemctl enable --now docker   # => Docker 26.1.3, overlay2, OK (SELinux permissive, 0 AVC)
```
> **Validé en local** : Docker tourne dans le PLC, all-in-one restauré + servi, air-gap prouvé.
> **À CONFIRMER CNAM** : fournir un **disque/volume data dédié (~10 Go+)** ; résoudre les RPM
> contre le dépôt **8.6 réel** ; livrer le bundle en **ISO9660** (un fs créé sur poste récent
> n'est pas montable par le noyau 4.18 du PLC).

### A7. Déposer l'image all-in-one et démarrer  *(validé)*
L'image se construit sur une machine **connectée** puis se transfère hors-ligne (`docker save`/`load`) — aucune image tirée d'un registre au runtime.

```bash
# Machine connectée : build + export
docker build -f docker/all-in-one/Dockerfile -t orchestr-a:local .
docker save orchestr-a:local | gzip > orchestr-a-local.tar.gz   # ~3 Go -> ~1 Go

# Dans le PLC (hors-ligne) : import
gunzip -c orchestr-a-local.tar.gz | docker load

# .env : secrets OBLIGATOIRES (sinon l'API ne démarre pas) — cf. install-offline.sh
#   POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET(>=32),
#   AUDIT_HASH_KEY(>=32), METRICS_TOKEN, RBAC_GUARD_MODE=enforce, HTTP_PORT
docker compose -f docker-compose.offline.yml --env-file .env up -d
```
> ⚠️ Sur une **restauration de données existantes**, `AUDIT_HASH_KEY` doit **égaler** celui de la source (cohérence de l'audit). Pour une install neuve, `install-offline.sh` les génère.

### A8. Restaurer les données + PREUVE de zéro-perte  *(validé)*
```bash
cd scripts/orchestra
./orchestra-restore.sh --config orchestra.conf  /chemin/orchestra-snapshot-<UTC>.tar.gz
```
Le script : vérifie l'archive → **garde-fou de parité des migrations** (image ↔ données) →
restaure (en tant que `orchestr_a`) → **compare comptages par table + empreinte de chaîne
d'audit + migrations au manifeste** → **tout écart laisse l'app à l'arrêt** → ne redémarre
que si tout est prouvé identique.

### A9. Prouver le fonctionnement hors-ligne (air-gap)
```bash
# Depuis l'invité PLC : toute sortie doit ÉCHOUER…
curl -m 5 https://github.com   # => doit échouer (timeout/refus)
# …et l'application doit fonctionner quand même :
curl -s http://127.0.0.1:<HTTP_PORT>/api/health   # => {"status":"ok"}
```

### A10. Definition of Done du banc d'essai
- [x] **Zéro perte vérifiée** — comptages + empreinte d'audit identiques *(validé 2026-06-08 : 45 tables, audit `7463aa07…`)*. **(critère premier)**
- [x] App **saine** : `/api/health` → 200 ; sert les données prod *(41 users / 40 projets / 323 tâches / 174 audit_logs)*.
- [x] `/data` = unique porteur d'état (bloc consolidé).
- [x] Mécanisme **rejouable** (2 exécutions → même résultat vérifié).
- [ ] **Air-gap prouvé** (§A9) — à exécuter dans l'invité PLC une fois Docker installé (A6).
- [ ] Rollback testé (cf. §C).

---

## PARTIE B — Dossier de migration Assurance Maladie (jour J, phase 2)

**Le mécanisme `scripts/orchestra/` est l'outil réutilisé à l'identique.** On ne change que la
config. Tout fait propre au réseau interne est marqué **`À CONFIRMER CNAM`**.

### B1. Pré-vol (J-7 à J-1)
- [ ] Hôte cible interne prêt : `À CONFIRMER CNAM` (specs CPU/RAM/disque, hyperviseur, accès).
- [ ] Bundle livré et chargé hors-ligne : image `orchestr-a:local` (`docker load`), RPM Docker (si besoin).
- [ ] `orchestra.conf` cible renseignée ; `AUDIT_HASH_KEY`/`JWT_SECRET` de la source obtenus (opérateur).
- [ ] **R4 — re-vérifier la version PG réelle de la prod** : `docker exec <pg> postgres --version`. La cible all-in-one doit être **≥** (elle est en 18 ; la source est en 18 → OK).
- [ ] Fenêtre de bascule + plan de communication validés. `À CONFIRMER CNAM`.

### B2. Bascule (jour J) — séquence Go/No-Go
1. **Backup de l'état réel** au moment de la bascule : `./orchestra-backup.sh` (à chaud, lecture seule). → **Go** si archive + `.sha256` OK, sinon **No-Go**.
2. **Transfert** de l'archive vers la cible interne (hors-ligne / canal autorisé). → **Go** si `sha256sum -c` OK.
3. **Restauration vérifiée** : `./orchestra-restore.sh --config orchestra.conf <archive>`. → **Go** seulement si « comptages + empreinte d'audit + migrations IDENTIQUES » ; **tout écart = No-Go** (l'app reste à l'arrêt).
4. **Smoke applicatif** : `/api/health` 200 + connexion d'un compte témoin. → **Go/No-Go**.
5. **Bascule du trafic** vers l'instance interne. `À CONFIRMER CNAM` (DNS/reverse-proxy interne).

### B3. Definition of Done jour J
- [ ] **Zéro perte vérifiée** (critère premier) : rapport d'intégrité de `orchestra-restore.sh` tout vert.
- [ ] App saine sur le réseau interne, compte témoin OK.
- [ ] Chaîne d'audit valide (empreinte identique).
- [ ] Sauvegarde de bascule archivée hors-ligne (rollback possible).

---

## PARTIE C — Rollback

- **Banc d'essai** : non destructif. En cas d'échec, supprimer l'invité KVM (`virsh destroy/undefine --nvram`) — la prod n'est jamais touchée. Filet : snapshot VPS (§A2) + archive `orchestra-snapshot-*` hors-disque.
- **Jour J** : si un critère No-Go tombe **avant** la bascule du trafic, on n'a rien coupé — on investigue, on rejoue. Si après, repointer le trafic vers la source, qui n'a pas été modifiée (backup = lecture seule), puis restaurer l'archive de bascule au besoin.
- **Données** : `orchestra-restore.sh` rejoue une archive antérieure validée ; chaque restauration re-prouve l'intégrité avant remise en service.

---

## PARTIE D — Points ouverts traçés

| # | Sujet | État |
|---|---|---|
| R2 | RPM Docker offline Alma 8.6 | À préparer (§A6) ; Docker probablement absent du PLC |
| R3 | Secure Boot strict | Mitigeable (MAJ shim/grub2 ou OVMF NX) ; banc actuel = SB-OFF |
| — | Identifiants du PLC | **À CONFIRMER CNAM** |
| — | Hôte cible interne + réseau + AC/certs internes | **À CONFIRMER CNAM** |
| — | Versions RPM exactes vs image 8.6 figée | **À CONFIRMER** (résoudre contre dépôt 8.6) |
