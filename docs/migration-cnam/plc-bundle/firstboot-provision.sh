#!/bin/bash
# =============================================================================
# firstboot-provision.sh — PROVISIONNEMENT UNIQUE du bundle transportable PLC-OFS.
# Exécuté 1 seule fois dans le PLC. Installe Docker (data-root sur disque data
# PERSISTANT + entrée fstab), charge l'image, up + restore, active l'auto-
# démarrage, puis ARRÊT PROPRE. L'état (image + volume + données) persiste sur le
# disque data ; aux reboots suivants l'appli redémarre seule (sans ISO).
# =============================================================================
set +e
exec > /root/provision.log 2>&1
echo "=== PROVISIONNEMENT PLC-OFS — $(date -u) ==="
echo "OS: $(cat /etc/redhat-release 2>/dev/null) | SELinux: $(getenforce 2>/dev/null)"

echo "--- [0] disque data Docker (vierge -> xfs LABEL=DOCKERDATA + fstab) ---"
DATADEV=""
for d in /dev/sd?; do [ "$d" = /dev/sda ] && continue; [ -z "$(blkid -p -s TYPE -o value "$d" 2>/dev/null)" ] && { DATADEV="$d"; break; }; done
[ -z "$DATADEV" ] && DATADEV=/dev/sdc
echo "  data disk: $DATADEV"
mkfs.xfs -f -L DOCKERDATA "$DATADEV"
mkdir -p /var/lib/docker-data
grep -q DOCKERDATA /etc/fstab || echo 'LABEL=DOCKERDATA /var/lib/docker-data xfs defaults,nofail 0 0' >> /etc/fstab
mount /var/lib/docker-data 2>/dev/null || mount "$DATADEV" /var/lib/docker-data
mkdir -p /etc/docker; printf '{ "data-root": "/var/lib/docker-data" }\n' > /etc/docker/daemon.json
echo "  $(findmnt -no SOURCE,TARGET,SIZE /var/lib/docker-data) | fstab: $(grep DOCKERDATA /etc/fstab)"

echo "--- [1] bundle ISO (lecture seule, uniquement pour le provisionnement) ---"
mkdir -p /mnt/iso
ISODEV="$(blkid -t TYPE=iso9660 -o device 2>/dev/null | head -1)"; [ -z "$ISODEV" ] && ISODEV=/dev/sdb
mount -o ro "$ISODEV" /mnt/iso
B=/mnt/iso
[ -f "$B/orchestr-a-local.tar.gz" ] || { echo "!!! BUNDLE ABSENT"; blkid; echo PROVISION_FAIL; sync; systemctl poweroff; }

echo "--- [2] install Docker (activé au boot) ---"
dnf -y install --repofrompath="be,file://$B/docker-rpms" --repo=be --nogpgcheck --setopt=be.module_hotfixes=true \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin 2>&1 | tail -6
systemctl enable --now docker 2>&1 | tail -2
sleep 6
docker info 2>/dev/null | grep -E 'Server Version|Docker Root Dir' | sed 's/^/  /'
docker info >/dev/null 2>&1 && echo "  DOCKER_OK" || { echo "  DOCKER_FAIL"; systemctl status docker --no-pager -l | tail -20; }

echo "--- [3] docker load image all-in-one ---"
gunzip -c "$B"/orchestr-a-local.tar.gz | docker load 2>&1 | tail -2

echo "--- [4] compose up (compose + env COPIÉS sur le PLC ; restart=unless-stopped) ---"
mkdir -p /opt/ofs
cp "$B"/docker-compose.offline.yml /opt/ofs/docker-compose.yml
cp "$B"/aio.env /opt/ofs/.env
docker compose -f /opt/ofs/docker-compose.yml --env-file /opt/ofs/.env up -d 2>&1 | tail -4
echo "  init 75s…"; sleep 75; docker ps --format '  {{.Names}} {{.Status}}'

echo "--- [5] restore + preuve zéro-perte ---"
cd "$B"/ofs
bash ofs-restore.sh --config "$B"/ofs/ofs.conf --allow-migrate "$B"/backup.tar.gz 2>&1 | tail -20

echo "--- [6] vérif finale ---"
sleep 12
echo "  /api/health: $(curl -s -m 8 -o /dev/null -w '%{http_code}' http://127.0.0.1:8088/api/health)"
echo -n "  users="; docker exec orchestr-a-orchestr-a-1 gosu postgres psql -d orchestr_a -tAc "SELECT count(*) FROM users" 2>&1
echo "  docker enabled: $(systemctl is-enabled docker)"
echo "  restart policy : $(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' orchestr-a-orchestr-a-1 2>&1)"
umount /mnt/iso 2>/dev/null

echo "=== PROVISION_DONE — arrêt propre (état persistant sur le disque data) ==="
sync; sleep 3
systemctl poweroff
