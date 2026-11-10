# Definition Packs

JSON starter packs for the recurring task manager. Import one to set up a segment in seconds: categories, task definitions, schedules, notes and step checklists.

## How to import

1. Open the tool as an administrator.
2. Go to the **Task Definitions** tab.
3. Click **Import Definitions**.
4. Choose a `.json` file from this folder (or paste its content into the box).
5. Set the **Year** you are starting (defaults to the current year).
6. Keep **Start fresh** checked for a new year or a new segment - it clears old status history, conversations and requests. Uncheck it only when you want to swap definitions while keeping history.
7. Press **Import** and confirm.

## How to export (or start a new year)

1. Go to the **Task Definitions** tab and click **Export Definitions**.
2. Copy the JSON or download the `.json` file.
3. Import it into a fresh tool instance with the next year number - this is the supported flow for starting a new year, since each instance manages exactly one year.

## Managing categories in the tool

Categories are no longer JSON-only. As an administrator open **Task Definitions → Categories** to add, rename or delete categories right in the UI. Deleting a category moves its tasks to Uncategorized. Changes are saved with the tool data - no import needed.

## Pack schema (`bkt-pack-v1`)

```json
{
  "schemaVersion": "bkt-pack-v1",
  "name": "My segment",
  "description": "Optional description shown in the import confirmation.",
  "year": 2026,
  "categories": [
    { "id": "maintenance", "label": "Preventive Maintenance" }
  ],
  "definitions": [
    {
      "title": "Weekly inspection",
      "category": "maintenance",
      "taskType": "regular",
      "frequency": "weekly",
      "daysOfWeek": [0, 3],
      "priority": "high",
      "note": "Optional guidance text.",
      "timeEstimate": "30 min",
      "steps": ["First step", "Second step"],
      "items": ["Building A", "Building B"]
    }
  ]
}
```

### Definition fields

- `title` (required) - task name.
- `category` - must match a category id in the pack (or leave empty for Uncategorized).
- `taskType` - `regular` (recurring) or `adHoc` (one-off with `dueDate`).
- `frequency` - `daily`, `weekly`, `biweekly`, `monthly`, `quarterly`, `yearly`.
  - `weekly` and `biweekly` use `daysOfWeek`: an array of weekdays, 0 = Monday ... 6 = Sunday. One entry = once per week; several entries = several times per week (e.g. `[0, 3]` = Monday and Thursday). The single `dayOfWeek` field is still accepted for older packs.
  - `monthly` and `quarterly` use `daysOfMonth`: an array of days, 1-31 (e.g. `[1, 15]` = twice per month). The single `dayOfMonth` field is still accepted.
  - `yearly` uses `monthOfYear` (1-12) and `dayOfMonth` (1-31).
- `priority` - `low`, `medium`, `high`, `urgent`.
- `note` - guidance shown with the task.
- `timeEstimate` - optional time hint.
- `steps` - up to 12 checklist steps, checked per occurrence.
- `items` - up to 60 named items or payees (e.g. houses, students, staff). Each occurrence gets its own item checklist, so one monthly task can track many payments without creating one task per person.
- `dueDate` - for ad-hoc tasks, `YYYY-MM-DD`.

`year` is optional in the pack - the import dialog always offers a year and the pack value is used only as a fallback.

## Packs in this folder

All 16 packs are ready and import cleanly (validated against the tool's import parser):

- `bookkeeping.json` - the default bookkeeper pack (24 tasks, 13 categories).
- `facility-ops.json` - building operations, safety systems and compliance.
- `restaurant-ops.json` - food service opening, closing, safety and licenses.
- `property-management.json` - rent collection, maintenance, inspections and leases.
- `compliance-safety.json` - compliance and safety officers: walkthroughs, training, permits, drills.
- `healthcare-clinic.json` - clinic administration: sterilization logs, equipment, supplies, licenses.
- `accounting-firm.json` - accounting practice: client filings, payroll runs, trust account, tax season.
- `law-firm.json` - legal practice: court deadlines, limitation periods, trust accounting, compliance.
- `nonprofit-operations.json` - churches, charities and associations: governance, fundraising, grants, volunteers.
- `human-resources.json` - HR and people operations: payroll, onboarding, reviews, compliance, benefits.
- `education-administration.json` - schools and academies: terms, exams, accreditation, safety.
- `transport-logistics.json` - fleets and transport: inspections, maintenance, driver compliance, registrations.
- `agriculture-farming.json` - farms: livestock, crops, equipment, chemical compliance, insurance.
- `retail-store.json` - retail: opening and closing checklists, stock, shrink review, licenses.
- `small-business.json` - small business owners: finances, tax obligations, marketing, operations.
- `personal-household.json` - personal use: chores, home maintenance, bills, health, yearly obligations.

Each pack has its own categories, so importing one fully re-skins the tool for that segment.

## Making your own pack

Export from the tool, edit the JSON, and save it in this folder under a descriptive name. Keep the `schemaVersion` field set to `bkt-pack-v1`.
