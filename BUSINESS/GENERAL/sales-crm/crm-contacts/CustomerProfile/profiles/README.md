# CustomerProfile preset library

This folder contains ready-to-paste app configurations for the **CustomerProfile** html-tool.
Each JSON file is a complete `profileConfig` object. The tool stays one reusable tool;
the configuration makes it look and behave like a dedicated profile app for one use case.

Question sets are application/request-driven: the customer type only switches the
Person/Company identity fields, and any question set can be selected for any customer.
Use the preset library or the built-in `applicationType` shortcut described below.

## How to use a preset

1. Open the **CustomerProfile** html-tool settings in the UniconHub CMS.
2. Find the parameter named **App profile config** (`profileConfig`).
3. Paste the entire contents of one preset JSON file.
4. Save and open the tool.

Do not paste a preset into `profileDefinitions`. That parameter only holds question sets.
The two parameters are intentionally separate:

| Parameter | Purpose |
| --- | --- |
| `profileConfig` | Full app configuration: identity, labels, customer types/segments, allowed question sets, identity fields, status/source lists, and app-owned question-set definitions. Takes precedence over `applicationType`. |
| `applicationType` | Optional built-in shortcut: `software-sales`, `general-crm` or `customer-profile-hub`. It sets the app title, labels and default question-set catalog; it never filters by customer type. |
| `profileDefinitions` | Extra question sets shared by every record of the app, without changing the app structure. |

`profileConfig.definitions` and `profileDefinitions` are merged. A key in `profileConfig` wins when both define the same question-set key.

## Built-in application catalogs

Set `applicationType` when the app only needs a small named catalog and does not need
a full preset:

| `applicationType` | App title | Default question set | Catalog |
| --- | --- | --- | --- |
| `software-sales` | Software Sales Profile | `software-discovery` | Eight sales/request sets, including discovery, implementation, SaaS, support, procurement, renewal and stakeholders. |
| `general-crm` | Customer Profile | `customer-basics` | Every question set. |
| `customer-profile-hub` | Customer Profile Hub | `customer-basics` | Every question set. |

The picker shows the catalog, but **All question sets** always opens the full library.
Selecting a set outside the catalog is allowed; the picker reports it as an outside
selection. If `profileConfig.segments` are present, they take precedence over
`applicationType`.

## Fixed vertical app vs. generic CRM

### Fixed vertical app (recommended for a dedicated vertical)

Each segment names one or more fixed `profileKeys` and leaves `allowProfileSelection` false.

```json
{
  "key": "student",
  "name": "Student",
  "baseType": "person",
  "profileKeys": ["student-intake"],
  "allowProfileSelection": false,
  "allowFocusSelection": false,
  "allowProfileEditing": false
}
```

The tool then:

- shows only the fields in `student-intake`;
- hides the question-set picker, focus chips, library, JSON editor and share-drawer management action;
- shows the segment name, labels and identity hint from the configuration;
- keeps all answers when the user switches to another segment.

This is the correct mode for Tutor, Therapy, Law Firm, Agency, School, Vendor and similar apps.
Nothing unrelated to that customer type is shown.

### Selectable profile app (generic CRM)

A segment can let the user choose from a limited list:

```json
{
  "key": "company",
  "name": "Company",
  "baseType": "company",
  "allowedProfileKeys": ["company-basic", "company-account", "support-sla"],
  "allowProfileSelection": true,
  "allowCombinations": true,
  "allowFocusSelection": true,
  "allowProfileEditing": true
}
```

The picker only shows `allowedProfileKeys`. `allowCombinations` decides whether several
question sets can be combined. `allowProfileEditing` can stay true for a CRM admin team.

If `allowSegmentSelection` is false, the app is locked to `defaultSegmentKey` and the
segment switch is not shown. Use this for a single-purpose vertical app.

## How this maps to large CRM products

This is the same metadata-driven approach used by large CRM platforms:

- **Salesforce** record types and page layouts: one base object, different layouts per record type.
- **Dynamics 365** entity forms and views: the same entity with role-specific forms.
- **HubSpot** custom objects and properties: one contact/company record plus app-specific properties.
- **ServiceNow / case management** record types: one record table with type-specific fields and processes.

The CustomerProfile tool uses one base record (`values`, `lists`, `profileKeys`, `segmentKey`)
and app metadata. It does not fork the tool for every vertical. A separate tool should only
be created when the workflow or compliance boundary is genuinely different, for example
clinical notes, legal matter management, or finance approvals.

## Stable ids are the contract

- `segment.key` is stored on each record as `segmentKey`. Do not rename it after records exist.
- Question-set `key` is stored in `profileKeys`. Keep it stable.
- Field `id` is the answer key. Changing an id starts a new answer; old answers are preserved
  under the old id. Changing only a field label is safe.
- Section `id` is also stable; keep it unique inside its question set.

## Per-segment identity controls

Use these when a vertical should not show the full generic identity block:

| Setting | Effect |
| --- | --- |
| `labels.record` | Singular noun used in headings and defaults (Student, Client, Vendor...). |
| `nameFieldIds` | Show only selected core identity fields. Person ids: `core_firstName`, `core_lastName`, `core_preferredName`, `core_jobTitle`. Company ids: `core_legalName`, `core_tradeName`, `core_registrationNumber`, `core_taxNumber`. |
| `adminFieldIds` | Show only selected admin fields: `core_status`, `core_priority`, `core_source`, `core_owner`, `core_since`, `core_nextFollowUp`. |
| `showAdminFields` | `false` hides the admin block entirely. |
| `showTags` | `false` hides the tags editor. |
| `hiddenSectionIds` | Hide core record sections for this segment. Values: `contact`, `addresses`, `people`, `interactions`, `notes`. Basic Information always remains. |
| `statusOptions` / `sourceOptions` | Segment-specific dropdown values. |
| `identityHint` | Helper sentence under the identity heading. |
| `labels` | Override `record`, `questionSets`, `profileType`, `sections`, `form`, etc. for this segment. |

Status, priority, source and owner are generic CRM concepts. If they make no sense in a
vertical, hide them with `showAdminFields: false` or a narrow `adminFieldIds` list.

## Adding a new vertical

1. Copy `template-custom-vertical.json`.
2. Rename the app and labels.
3. Define one segment per real customer type. Start with **one** segment if the app is dedicated.
4. Put the vertical's question set in `definitions` and reference its key from `profileKeys`.
5. Keep `allowProfileSelection`, `allowFocusSelection` and `allowProfileEditing` false unless
   the app genuinely needs those controls.
6. Add the preset to `index.json` so the library stays discoverable.
7. Validate the JSON with the schema in this folder.

## Validation

The schema is `profile-config.schema.json` (JSON Schema draft-07). You can validate with any
JSON Schema validator, or by pasting the config into the tool and checking the browser console
for `[CustomerProfile] profileConfig` warnings.

Common mistakes:

- `profileKeys` references a key that is not built in and not present in `definitions`.
- A `select` or `multiselect` field has no `options` array.
- Two sections in one question set use the same `id`.
- A segment `key` contains spaces or uppercase letters; use lowercase-kebab-case.
- The config is pasted into `profileDefinitions` instead of `profileConfig`.

## Test harness and documentation

The test harness embeds the preset catalog so every preset can be loaded as the
real `profileConfig` parameter:

```text
?profilePreset=tutor-business
?profilePreset=light-crm
```

Use the **Profile preset** selector in the harness toolbar, or open the URL
directly. Rebuild the embedded catalog after changing a preset:

```text
node app/build-harness-presets.js
```

The internal docs page is built with:

```text
npm run docs:profiles -- CustomerProfile
```

It writes `docs/profiles.html` with Copy JSON buttons. The authoritative
statement of which preset an application uses is the **Profile configuration
usage** register in `docs/ssot.html` section 4.1, not the browser-local reminder
on the copy page.

## Presets

| File | Best for | Mode |
| --- | --- | --- |
| `light-crm.json` | General-purpose CRM and contacts | Selectable Person/Company/Partner |
| `customer-profile-hub.json` | Broad profile hub with many built-in question sets | Selectable |
| `tutor-business.json` | Tutoring business | Fixed Student/Guardian/Tutor/School |
| `school-training.json` | School, training centre or academy | Fixed Student/Guardian/Teacher/School |
| `therapy-practice.json` | Therapy and counselling practice | Fixed Client/Referrer/Clinic; administrative intake only |
| `law-firm.json` | Law firm client intake | Fixed Individual/Organisation/Referrer; matters stay separate |
| `agency-client.json` | Marketing or consulting agency | Fixed Client/Prospect/Supplier |
| `vendor-procurement.json` | Procurement and vendor management | Fixed Supplier/Contractor/Contact |
| `template-custom-vertical.json` | Starting point for a new vertical | Fixed one-segment template |

## Boundaries

CustomerProfile is a profile and intake layer. Keep these in their own tools/apps:

- clinical notes, diagnoses and treatment records;
- legal matter files, advice and court documents;
- financial approvals, invoices and payment credentials;
- HR disciplinary or health records.

The presets only collect the administrative profile fields needed to identify and serve the
customer. They deliberately avoid sensitive clinical, legal or financial content.
