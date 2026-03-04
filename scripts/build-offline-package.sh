#!/bin/bash
set -euo pipefail
VERSION="${1:-latest}"
IMAGE_TAG="latest"
PACKAGE_NAME="orchestr-a-offline-${VERSION}"
WORK_DIR="/tmp/${PACKAGE_NAME}"

echo "=== Building offline package: ${PACKAGE_NAME} ==="

# 1. Pull de l'image all-in-one depuis GHCR (toujours le tag latest)
echo "[1/4] Pull de l'image..."
docker pull ghcr.io/elegalex/orchestr-a:${IMAGE_TAG}

# 2. Retag en local
echo "[2/4] Retag en local..."
docker tag ghcr.io/elegalex/orchestr-a:${IMAGE_TAG} orchestr-a:local

# 3. Export de l'image
echo "[3/4] Export de l'image..."
mkdir -p ${WORK_DIR}/images
docker save orchestr-a:local -o ${WORK_DIR}/images/orchestr-a.tar

# 4. Copie des fichiers de déploiement
echo "[4/4] Packaging..."
cp docker-compose.offline.yml ${WORK_DIR}/docker-compose.yml
cp install-offline.sh         ${WORK_DIR}/install.sh
chmod +x ${WORK_DIR}/install.sh

# 5. Création de l'archive
cd /tmp
tar czf ${PACKAGE_NAME}.tar.gz ${PACKAGE_NAME}/

echo ""
echo "Package créé : /tmp/${PACKAGE_NAME}.tar.gz"
sha256sum /tmp/${PACKAGE_NAME}.tar.gz
