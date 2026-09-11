#!/usr/bin/env bash
# Membuat file ZIP berisi seluruh isi website ini (semua halaman, gaya, gambar,
# dan konfigurasi) supaya bisa diunduh, disimpan, atau dipindahkan.
#
# Cara pakai:  bash scripts/export-zip.sh
# Hasil:       maujajan-website.zip di folder utama proyek
set -euo pipefail

cd "$(dirname "$0")/.."
OUT="maujajan-website.zip"
rm -f "$OUT"

EXCLUDES=(
  "node_modules/*" ".git/*" "dist/*" ".output/*" ".nitro/*"
  ".tanstack/*" ".vinxi/*" "$OUT"
)

if command -v zip >/dev/null 2>&1; then
  args=()
  for e in "${EXCLUDES[@]}"; do args+=(-x "$e"); done
  zip -rq "$OUT" . "${args[@]}"
elif command -v git >/dev/null 2>&1 && [ -d .git ]; then
  git archive --format=zip -o "$OUT" HEAD
else
  echo "Tidak menemukan perintah 'zip' maupun 'git'. Pasang salah satunya lalu ulangi." >&2
  exit 1
fi

echo "Selesai: $OUT"
