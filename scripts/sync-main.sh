#!/usr/bin/env bash
#
# Synchronisiert main mit dem Produktionsbranch live. Nötig vor allem nach dem
# wöchentlichen refresh-data-Lauf, der die frischen Wochendaten (chore(data))
# direkt nach live committet – damit main nicht hinter der Produktion zurückfällt.
#
# Nutzung:  npm run sync-main   (bzw. bash scripts/sync-main.sh)
#
# Sicher: fährt nur einen Fast-Forward (main muss Vorfahr von live sein). Bei
# echter Divergenz bricht das Skript ab und weist auf den manuellen Merge hin.

set -euo pipefail

git fetch --quiet origin

main="$(git rev-parse origin/main)"
live="$(git rev-parse origin/live)"

if [ "$main" = "$live" ]; then
  echo "✓ main und live sind bereits synchron – nichts zu tun."
  exit 0
fi

ahead="$(git rev-list --count origin/main..origin/live)"
if [ "$ahead" -eq 0 ]; then
  echo "✓ live hat keine neuen Commits gegenüber main – nichts zu tun."
  exit 0
fi

echo "→ $ahead Commit(s) von live, die main fehlen:"
git log --oneline origin/main..origin/live

if ! git merge-base --is-ancestor origin/main origin/live; then
  echo ""
  echo "✗ main ist gegenüber live divergiert (eigene Commits auf main)."
  echo "  Kein Fast-Forward möglich – bitte manuell mergen:"
  echo "    git checkout main && git merge origin/live && git push origin main"
  exit 1
fi

# Fast-Forward: origin/live-Commit auf den Remote-main-Ref pushen.
git push origin "origin/live:main"
git fetch --quiet origin

# Lokalen main-Branch nachziehen (ohne die Arbeitskopie zu stören).
current="$(git rev-parse --abbrev-ref HEAD)"
if [ "$current" = "main" ]; then
  git merge --ff-only origin/main
else
  git update-ref refs/heads/main origin/main
fi

echo "✓ main per Fast-Forward auf live gebracht und gepusht."
