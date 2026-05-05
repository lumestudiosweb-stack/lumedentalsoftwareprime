#!/usr/bin/env bash
# Extracts texture maps (TM=diffuse, NM=normal, AO=ambient occlusion) from
# the Sketchfab tooth zips in ~/Downloads into the matching folders under
# frontend/public/teeth/, renamed to a consistent scheme:
#   diffuse.{png,jpeg}
#   normal.png
#   ao.{png,jpeg}
#
# Idempotent — safe to re-run.
set -euo pipefail

DL="$HOME/Downloads"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEETH="$ROOT/frontend/public/teeth"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# zip basename (without .zip)  →  target folder under public/teeth
declare -A MAP=(
  ["maxillary-left-central-incisor"]="maxillary left central incisor"
  ["maxillary-lateral-incisor"]="maxillary lateral incisor"
  ["maxillary-canine"]="maxillary canine"
  ["maxillary-first-premolar"]="maxillary first premolar"
  ["maxillary-second-premolar"]="Maxillary Second Premolar"
  ["maxillary-first-molar"]="maxillary first molar"
  ["maxillary-second-molar"]="maxillary second molar"
  ["maxillary-third-molar"]="maxillary third molar"
  ["maxillary-first-molar-with-cusp-of-carabelli"]="Maxillary First Molar with Cusp of Carabelli"
  ["mandibular-left-lateral-incisor"]="mandibular left lateral incisor"
  ["mandibular-left-canine"]="mandibular left canine"
  ["mandibular-left-second-premolar"]="mandibular left second premolar"
  ["mandibular-first-molar"]="mandibular first molar"
  ["mandibular-second-molar"]="mandibular second molar"
  ["mandibular-third-molar"]="mandibular third molar"
)

# Folders that don't have their own zip and need to borrow from another:
declare -A BORROW=(
  ["mandibular left central incisor"]="mandibular-left-lateral-incisor"
  ["mandibular first premolar"]="maxillary-first-premolar"
)

extract_one () {
  local zipbase="$1"   # e.g. maxillary-first-molar
  local target="$2"    # e.g. maxillary first molar
  local zip="$DL/$zipbase.zip"
  if [[ ! -f "$zip" ]]; then
    echo "SKIP (no zip): $zipbase"
    return
  fi
  local out="$TMP/$zipbase"
  rm -rf "$out"
  mkdir -p "$out"
  unzip -oqq "$zip" -d "$out"

  local dest="$TEETH/$target"
  mkdir -p "$dest"

  # Find textures inside the extracted folder (non-recursive 'textures/' dir)
  shopt -s nullglob nocaseglob
  local diffuse="" normal="" ao=""
  for f in "$out"/textures/*; do
    case "$(basename "$f")" in
      *AO*)  ao="$f" ;;
      *NM*)  normal="$f" ;;
      *)     diffuse="${diffuse:-$f}" ;;
    esac
  done
  shopt -u nullglob nocaseglob

  if [[ -n "$diffuse" ]]; then
    local ext="${diffuse##*.}"
    cp -f "$diffuse" "$dest/diffuse.$ext"
    echo "  diffuse → $target/diffuse.$ext"
  fi
  if [[ -n "$normal" ]]; then
    local ext="${normal##*.}"
    cp -f "$normal" "$dest/normal.$ext"
    echo "  normal  → $target/normal.$ext"
  fi
  if [[ -n "$ao" ]]; then
    local ext="${ao##*.}"
    cp -f "$ao" "$dest/ao.$ext"
    echo "  ao      → $target/ao.$ext"
  fi
}

for zipbase in "${!MAP[@]}"; do
  extract_one "$zipbase" "${MAP[$zipbase]}"
done

# Borrow textures for folders without their own zip
for target in "${!BORROW[@]}"; do
  src="${BORROW[$target]}"
  echo "BORROW: $target ← $src"
  extract_one "$src" "$target"
done

echo "Done."
