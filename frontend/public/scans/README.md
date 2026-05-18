# Scan Library

This folder holds the **public manifest** for anonymized real-patient intraoral
scans used by the Scan Library feature in the app.

The actual `.stl` / `.ply` / `.obj` mesh files are **NOT stored here** — they
live in Cloudflare R2 (or any other static host) and are referenced by URL.

## Files in this folder

- **`manifest.json`** — the list of scans the app should show. Committed
  to git. Contains only URLs and benign metadata — no patient data.
- **`README.md`** — this file.

## How to add scans

### 1. Anonymize on the source machine (the dentist's PC)

Patient names / DOBs must never leave the dentist's PC. Run the
`anonymize.py` script (see project root `/scripts/anonymize_scans.py`)
locally before uploading anything.

The script renames `patient_pratiksha_2024-03-15.stl` →
`scan_0007_a3f8c1.stl`. It also writes a `manifest.csv` that maps anonymous
IDs back to original filenames. **Keep `manifest.csv` offline, on an
encrypted drive. Never commit it. Never upload it to any cloud.**

### 2. Upload anonymized files to Cloudflare R2

- Sign up free at https://dash.cloudflare.com → R2 Object Storage
- Create a bucket called `lume-scans`
- Enable public access (Settings → Public access → Allow)
- Upload anonymized scans via the web UI for a handful, or via `rclone`
  for hundreds:

  ```bash
  rclone copy ./lume_scans r2:lume-scans --progress
  ```

### 3. Add entries to `manifest.json`

For each uploaded scan add an entry like:

```json
{
  "id": "scan_0007",
  "url": "https://pub-abc123.r2.dev/scan_0007_a3f8c1.stl",
  "format": "stl",
  "arch": "upper",
  "label": "Upper arch — adult dentition",
  "addedAt": "2026-05-23"
}
```

### Schema

| Field        | Type     | Required | Notes                                                  |
|--------------|----------|----------|--------------------------------------------------------|
| `id`         | string   | yes      | Anonymous ID. Must NOT contain patient info.           |
| `url`        | string   | yes      | Public URL to the mesh file.                           |
| `format`     | string   | yes      | One of `stl`, `ply`, `obj`.                            |
| `arch`       | string   | yes      | `upper`, `lower`, `full`, or `unknown`.                |
| `label`      | string   | no       | Human-readable label for the library card.             |
| `addedAt`    | string   | no       | ISO date (`YYYY-MM-DD`) when added.                    |
| `vertexCount`| number   | no       | If known; helps with "scan quality" sorting.           |
| `qualityNote`| string   | no       | Optional: `excellent` / `good` / `low` / `incomplete`. |

The app gracefully ignores entries it doesn't understand and skips
unreachable URLs at runtime — so a partially-malformed manifest will
not crash the Scan Library.

## Privacy reminders

- ❌ Do not put patient names anywhere in `id`, `label`, or filenames
- ❌ Do not commit `manifest.csv` (the de-anonymization map)
- ❌ Do not enable public R2 access without a data-sharing agreement
  with the source clinic
- ✅ Do strip EXIF / file-comment metadata before upload (STL has none;
  PLY can have header comments — clean those)
- ✅ Do get explicit patient consent or rely on the DPDP Act 2023's
  "fully de-identified data" exemption — check with a lawyer if unsure
