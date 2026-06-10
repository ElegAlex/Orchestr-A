#!/usr/bin/env bash
# =============================================================================
# run-plc.sh — Lance la simulation Orchestr'A dans l'OS PLC (air-gap, tout-en-un).
# Pré-requis sur l'hôte : qemu-kvm (qemu-system-x86_64) + accès /dev/kvm.
# Usage : ./run-plc.sh           (quitter qemu : Ctrl-A puis X)
# App   : http://localhost:8088  (~1-2 min après le boot, le temps que Docker
#         redémarre l'all-in-one). Le guest est air-gappé (restrict=on) : il ne
#         peut PAS sortir ; seul le port 8088 est exposé à l'hôte.
# =============================================================================
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-8088}"; RAM="${RAM:-6144}"

OVMF_CODE="$HERE/OVMF_CODE.fd"; [ -f "$OVMF_CODE" ] || OVMF_CODE=/usr/share/edk2/ovmf/OVMF_CODE.fd
# VARS de travail = copie jetable (le bundle reste réutilisable tel quel)
cp -f "$HERE/OVMF_VARS.fd" "$HERE/.OVMF_VARS_run.fd"

echo "PLC-Orchestr'A — démarrage…"
echo "  -> App : http://localhost:$PORT  (patiente ~1-2 min après le login PLC)"
echo "  -> Quitter qemu : Ctrl-A puis X"
exec qemu-system-x86_64 -name plc-orchestra -machine q35 -enable-kvm -m "$RAM" -smp 2 \
  -drive if=pflash,format=raw,readonly=on,file="$OVMF_CODE" \
  -drive if=pflash,format=raw,file="$HERE/.OVMF_VARS_run.fd" \
  -device ich9-ahci,id=ahci0 \
  -drive if=none,id=d0,format=qcow2,file="$HERE/plc8-orchestra.qcow2"    -device ide-hd,bus=ahci0.0,drive=d0 \
  -drive if=none,id=d1,format=qcow2,file="$HERE/docker-data.qcow2" -device ide-hd,bus=ahci0.1,drive=d1 \
  -netdev "user,id=n0,restrict=on,hostfwd=tcp:127.0.0.1:$PORT-:8088" -device e1000,netdev=n0 \
  -nographic
