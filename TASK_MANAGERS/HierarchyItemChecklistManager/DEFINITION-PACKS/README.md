# Definition Packs

A definition pack is a ready-made setup for **HierarchyItemChecklistManager**: the words and icons the tool should use for its levels, the standard tasks to auto-create, and an optional sample tree to start from.

## Pack schema

| Field | Required | Type | Meaning |
| --- | --- | --- | --- |
| `pack` | yes | string | Stable identifier, lowercase, no spaces (used as the file name). |
| `name` | yes | string | Human-readable name shown when picking a pack. |
| `description` | yes | string | One or two sentences describing who the pack is for. |
| `version` | yes | number | Pack version, starts at 1. |
| `tool` | yes | string | Must be `HierarchyItemChecklistManager`. |
| `terminology` | optional | object | Labels and icons for the four levels. Missing or empty values fall back to the defaults below. |
| `standardTasks` | yes | array of strings | Tasks auto-created under every new unit (min 1 item). |
| `sampleTree` | optional | array | Starter content to import. |

### `terminology` keys

| Key | Default | Meaning |
| --- | --- | --- |
| `section` | `Section` | Top-level folder label |
| `subsection` | `Sub-section` | Nested folder label |
| `lesson` | `Lesson` | Checklist unit label |
| `task` | `Task` | Smallest item label |
| `sectionIcon` | `📁` | Top folder icon |
| `subsectionIcon` | `📂` | Nested folder icon |
| `lessonIcon` | `📖` | Unit icon |

Labels are cut to 40 characters, icons to 4 characters.

### `sampleTree` nodes

Each node: `{ "id": optional, "title": required, "children": optional }`. The tool generates an id when one is missing. Extra fields from a saved record (`status`, `due`, `memberId`, `notes`) may be present when a pack is exported from real data; `sampleTree` here keeps starter content clean.

## Packs

- **curriculum.json** - Curriculum Production (Education). Sections and sub-sections for courses and units, lessons as units, standard tasks: Lesson plan, Worksheet, Quiz, Answer key. Sample tree: a Grade 7 Science program.
- **franchise-rollout.json** - Franchise Rollout (Business). Regions and cities as folders, stores as units, standard steps: Lease signed, Permits, Hiring, Training, Fixtures, Soft open, Grand opening. Sample tree: two regions with three stores.
- **hr-onboarding.json** - HR Onboarding (Human Resources). Departments and roles as folders, new hires as units, standard steps: Offer letter, Contract signed, Equipment, Accounts, Day-one plan, Buddy assigned, First-week check-in. Sample tree: two departments with three hires.
- **tool-versioning.json** - Tool Version Tracking (Software). Workspace folders and tools as the hierarchy, each version as the unit, with the four standard deliverables every version ships: Code the version, Help document, Marketing content, Development plan for next version. Sample tree: two categories with three tools.

## Import

Open the tool's **📥 Import pack** button, paste a pack's JSON (or open one of the files above and copy its content) and click Import.

- The pack replaces the current tree, the standard-task template and the terminology (labels and icons) - undoable with the toolbar undo button.
- When the program is not empty, the Import button asks for a second confirmation before replacing anything.
- A missing or empty `sampleTree` only applies terminology and standard tasks.
- When the program is empty, the pack's `name` becomes the program title.
- Only leaf nodes keep imported `status` / `due` / `memberId` / `notes`; container statuses stay derived from their children.
