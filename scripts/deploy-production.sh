#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/home/peterdsp/magnetio-recovery}"
MEDIA_MOUNT="${MEDIA_MOUNT:-/mnt/media}"

if [ "$DEPLOY_PATH" != "/home/peterdsp/magnetio-recovery" ]; then
  echo "Refusing unexpected deployment path: $DEPLOY_PATH" >&2
  exit 1
fi

cd "$DEPLOY_PATH"

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i 's#https://your-domain.example#https://magnetio.peterdsp.dev#' .env
  echo "Created .env from .env.example."
fi

docker_ready=false
if command -v findmnt >/dev/null 2>&1 && command -v docker >/dev/null 2>&1; then
  configured_source="$(findmnt --fstab -rn -T "$MEDIA_MOUNT" -o SOURCE 2>/dev/null || true)"
  source_present=false
  case "$configured_source" in
    UUID=*) [ -e "/dev/disk/by-uuid/${configured_source#UUID=}" ] && source_present=true ;;
    /dev/*) [ -b "$configured_source" ] && source_present=true ;;
  esac

  if [ "$source_present" = true ]; then
    timeout 35 ls -A "$MEDIA_MOUNT" >/dev/null 2>&1 || true
    media_fstype="$(findmnt -rn -T "$MEDIA_MOUNT" -o FSTYPE 2>/dev/null || true)"
  else
    media_fstype=""
  fi

  # The autofs placeholder exists even while the actual disk is absent.
  if [ -n "$media_fstype" ] && [ "$media_fstype" != "autofs" ]; then
    sudo systemctl start docker.service 2>/dev/null || true
    if docker info >/dev/null 2>&1; then
      docker_ready=true
    fi
  fi
fi

if [ "$docker_ready" = true ]; then
  echo "Persistent media storage is available; deploying with Docker Compose."
  sudo systemctl stop magnetio-addon.service magnetio-scraper.service 2>/dev/null || true
  if ! docker compose up -d --build --remove-orphans; then
    sudo systemctl start magnetio-scraper.service magnetio-addon.service 2>/dev/null || true
    exit 1
  fi
  sudo systemctl disable magnetio-addon.service magnetio-scraper.service 2>/dev/null || true
  docker compose ps
else
  echo "Persistent media storage is unavailable; deploying native fallback on the SD card."

  npm --prefix scraper ci --omit=dev
  # The addon lock carries overrides for legacy torrent-stream transitive
  # dependencies; npm 10 validates that lock differently from npm 11.
  npm --prefix addon install --omit=dev

  sudo install -m 0644 deploy/systemd/magnetio-scraper.service /etc/systemd/system/magnetio-scraper.service
  sudo install -m 0644 deploy/systemd/magnetio-addon.service /etc/systemd/system/magnetio-addon.service
  sudo systemctl daemon-reload
  sudo systemctl enable --now magnetio-scraper.service
  sudo systemctl enable --now magnetio-addon.service
fi

curl --fail --retry 12 --retry-delay 5 --retry-connrefused http://127.0.0.1:8080/health
curl --fail --retry 12 --retry-delay 5 --retry-connrefused http://127.0.0.1:7000/health
