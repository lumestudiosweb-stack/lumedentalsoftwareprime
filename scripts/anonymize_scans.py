#!/usr/bin/env python3
"""
anonymize_scans.py
==================

Run this ON THE DENTIST'S PC, BEFORE any scan files leave her machine.

It renames every .stl / .ply / .obj in SRC_DIR to a stable anonymous ID
(e.g. patient_priya_2024-03-15.stl -> scan_0007_a3f8c1.stl). The original
filename is recorded in a private manifest.csv which is the ONLY way to
map an anonymous ID back to a patient. Keep that CSV offline on an
encrypted USB / encrypted folder. Never share it. Never upload it.

Usage:
    1. Edit SRC_DIR and PRIVATE_MAP_PATH below to match your machine.
    2. Run: python anonymize_scans.py
    3. The files in SRC_DIR are renamed in place.
    4. The mapping is saved to PRIVATE_MAP_PATH.

Once renamed, the dentist uploads SRC_DIR to a shared Google Drive
folder OR directly to Cloudflare R2. The original patient names never
leave her PC.

Requires only Python 3 standard library — no pip install needed.
"""

import os
import hashlib
import csv
import sys

# ── EDIT THESE TO MATCH YOUR MACHINE ──────────────────────────────────
SRC_DIR          = r"C:\helios_export"            # folder of scans to anonymize
PRIVATE_MAP_PATH = r"C:\lume_private\manifest.csv"  # KEEP OFFLINE
DRY_RUN          = False                          # set True to preview without renaming
# ──────────────────────────────────────────────────────────────────────

SUPPORTED_EXT = ('.stl', '.ply', '.obj')


def hash_short(s: str, n: int = 6) -> str:
    return hashlib.sha256(s.encode('utf-8')).hexdigest()[:n]


def main():
    if not os.path.isdir(SRC_DIR):
        print(f"ERROR: SRC_DIR does not exist: {SRC_DIR}")
        sys.exit(1)

    os.makedirs(os.path.dirname(PRIVATE_MAP_PATH), exist_ok=True)

    # Sort so the same input directory always produces the same anonymous IDs
    files = sorted(
        f for f in os.listdir(SRC_DIR)
        if f.lower().endswith(SUPPORTED_EXT) and not f.startswith('scan_')
    )

    if not files:
        print(f"No .stl/.ply/.obj files found to rename in {SRC_DIR}")
        sys.exit(0)

    print(f"Found {len(files)} files to anonymize in {SRC_DIR}")
    if DRY_RUN:
        print("(DRY_RUN=True — nothing will actually be renamed)\n")

    mapping = []
    for i, original in enumerate(files):
        ext = os.path.splitext(original)[1].lower()
        new_name = f"scan_{i:04d}_{hash_short(original)}{ext}"
        src_path = os.path.join(SRC_DIR, original)
        dst_path = os.path.join(SRC_DIR, new_name)

        print(f"  {original}  ->  {new_name}")
        if not DRY_RUN:
            os.rename(src_path, dst_path)
        mapping.append((original, new_name))

    if not DRY_RUN:
        with open(PRIVATE_MAP_PATH, 'w', newline='', encoding='utf-8') as fp:
            w = csv.writer(fp)
            w.writerow(['original_filename', 'anonymous_id'])
            for o, n in mapping:
                w.writerow([o, n])
        print(f"\n✓ Renamed {len(mapping)} files")
        print(f"✓ Wrote private mapping to: {PRIVATE_MAP_PATH}")
        print("\n⚠ Keep manifest.csv OFFLINE. It's the only way to reverse the anonymization.")
        print("⚠ Do not commit manifest.csv. Do not upload it anywhere.")
    else:
        print(f"\n(Dry run complete. Set DRY_RUN=False to actually rename.)")


if __name__ == '__main__':
    main()
