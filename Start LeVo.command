#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo 'Cần cài Node.js 24: https://nodejs.org/'
  echo 'Cài xong, mở lại Start LeVo.command.'
  read -r '?Nhấn Enter để đóng.'
  exit 1
fi
node scripts/start.mjs --open
