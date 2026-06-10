# Reconstruire le bundle « PLC-Orchestr'A en boîte »

Procédure pour régénérer la **simulation transportable** (Orchestr'A dans l'OS PLC, données
restaurées, air-gap). 100 % local, sur une machine avec `qemu-kvm`, `guestfs-tools`
(`virt-customize`/`guestfish`), `docker`, et `xorriso` (ou `genisoimage`).

Les scripts de ce dossier (`firstboot-provision.sh`, `run-plc.sh`, `README.md`) sont la
partie versionnée ; les images (`*.qcow2`, `*.iso`, `*.tar.gz`) ne sont **jamais** committées
(volumineuses + contiennent des données prod/secrets).

## Entrées
- **OVF PLC** : `PLC_ALMA_LINUX_8-6/ovf-plc8-almalinux86*.{ovf,vmdk}` (image AlmaLinux 8.6 durcie CNAM).
- **Image all-in-one** : `docker build -f docker/all-in-one/Dockerfile -t orchestr-a:local .` puis `docker save orchestr-a:local | gzip > orchestr-a-local.tar.gz`.
- **RPM Docker Alma 8** : `dnf download --resolve --alldeps --destdir=docker-rpms docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin` puis `createrepo_c docker-rpms` (cf. runbook §A6).
- **Sauvegarde Orchestr'A** (avec secrets) : `scripts/orchestra/orchestra-backup.sh` → `backup.tar.gz` (+ `.sha256`).

## Étapes
1. **OVF → qcow2** : `qemu-img convert -p -O qcow2 …ovf-plc8-almalinux86-1.vmdk plc8.qcow2`
2. **Mot de passe root** (test) : `virt-customize -a plc8.qcow2 --root-password password:XXX --selinux-relabel`
3. **Bundle ISO9660** (image + repo RPM + backup + `scripts/orchestra/{orchestra-lib,orchestra-restore}.sh` + `orchestra.conf` + `docker-compose.offline.yml` + `aio.env`) :
   `xorriso -as mkisofs -R -J -V BANCESSAI -o scratch.iso bundle-dir/`
4. **Disque data vierge** : `qemu-img create -f qcow2 docker-data.qcow2 12G`
5. **Injecter le provisionnement** : `cp plc8.qcow2 plc8-orchestra.qcow2 && virt-customize -a plc8-orchestra.qcow2 --firstboot firstboot-provision.sh --selinux-relabel`
6. **Booter une fois** : `plc8-orchestra.qcow2` (sda) + `scratch.iso` (sdb) + `docker-data.qcow2` (sdc), `q35` + **OVMF SB-OFF**, **disque SATA** (`ich9-ahci`/`ide-hd`), **sans réseau** → provisionne puis arrêt propre.
7. **Packager** : `plc8-orchestra.qcow2` + `docker-data.qcow2` + `OVMF_CODE.fd`/`OVMF_VARS.fd` + `run-plc.sh` + `README.md`.

## Findings (contraintes apprises du banc d'essai)
- **Disque SATA obligatoire** : pas de pilote virtio dans l'initramfs du PLC (virtio → « cannot open root device »).
- **Bundle en ISO9660** : un fs (xfs/ext4) créé sur poste récent (Fedora) n'est PAS montable par le noyau 4.18 du PLC.
- **Docker** : installer via **dépôt local** + `--setopt=<repo>.module_hotfixes=true` (4 deps modulaires : container-selinux, fuse-overlayfs, slirp4netns, libslirp). Ne PAS faire `dnf install ./*.rpm` (upgraderait le socle).
- **Stockage** : `/var` = 2 Go et VG quasi plein (~740 Mo libres) → **disque data dédié** pour le data-root Docker (`/etc/docker/daemon.json`).
- **SELinux** du PLC = `permissive` (favorable à Docker, 0 AVC).
- **Secure Boot** : boot validé **SB-OFF** ; SB strict échoue sur NX (MAJ shim≥15.6/grub2 côté CNAM).
- **Hyperviseur** : ici **KVM** ; la cible CNAM est **vSphere** (import OVF natif) — phase 2.
