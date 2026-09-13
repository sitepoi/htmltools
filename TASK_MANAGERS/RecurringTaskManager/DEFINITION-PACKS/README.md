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
      "title": "Daily walkthrough",
      "category": "maintenance",
      "taskType": "regular",
      "frequency": "daily",
      "priority": "high",
      "note": "Optional guidance text.",
      "timeEstimate": "30 min",
      "steps": ["First step", "Second step"]
    }
  ]
}
```

### Definition fields

- `title` (required) - task name.
- `category` - must match a category id in the pack (or leave empty for Uncategorized).
- `taskType` - `regular` (recurring) or `adHoc` (one-off with `dueDate`).
- `frequency` - `daily`, `weekly`, `biweekly`, `monthly`, `quarterly`, `yearly`.
  - `weekly` and `biweekly` use `dayOfWeek`: 0 = Monday ... 6 = Sunday.
  - `monthly` and `quarterly` use `dayOfMonth`: 1-31.
  - `yearly` uses `monthOfYear` (1-12) and `dayOfMonth` (1-31).
- `priority` - `low`, `medium`, `high`, `urgent`.
- `note` - guidance shown with the task.
- `timeEstimate` - optional time hint.
- `steps` - up to 12 checklist steps, checked per occurrence.
- `dueDate` - for ad-hoc tasks, `YYYY-MM-DD`.

`year` is optional in the pack - the import dialog always offers a year and the pack value is used only as a fallback.

## Packs in this folder

- `bookkeeping.json` - the default bookkeeper pack (24 tasks, 13 categories).
- `facility-ops.json` - building operations, safety systems and compliance.
- `restaurant-ops.json` - food service opening, closing, safety and licenses.
- `property-management.json` - rent collection, maintenance, inspections and leases.

## Making your own pack

Export from the tool, edit the JSON, and save it in this folder under a descriptive name. Keep the `schemaVersion` field set to `bkt-pack-v1`.
