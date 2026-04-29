# Gas Safety Records

A zero-backend web app for creating, editing, and exporting UK gas
installation safety records. Two cert templates included:

- **Landlord / Homeowner Gas Safety Record** — HH Plumbing & Gas style,
  black + yellow theme, editable logo, defects table, 5 pipework checks,
  16-column appliance table with CO alarm sub-row.
- **Non-Domestic Gas Installation Safety Record** — neutral B&W theme,
  meter and pipework check lists, declaration text.

Both cert types share a multi-template dashboard (search, type filter,
JSON import/export, delete) with records stored in browser localStorage
and exportable as JSON.

## Running locally

```bash
python3 -m http.server 8000
# open <http://localhost:8000>
