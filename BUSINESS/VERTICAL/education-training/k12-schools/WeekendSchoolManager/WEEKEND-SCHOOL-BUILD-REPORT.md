# Weekend School - Build Report

Version 1.1 - 2026-10-05

Consolidated from the verified CMS application reference (`cms-application-system.html`
section 15) and the user's decisions:

1. Teachers ARE real CMS users (teacherUserId = getUser().id; ACL keys use the teacher's email).
2. Lesson and attendance permissions are CMS-enforced with per-lesson subfolders (the strict option).

---

## 1. What we build

ONE CMS application (`weekendSchool`) containing 9 record kinds (categories +
field groups), 10 html tools, and one folder tree per school year with
per-lesson permission subfolders. Everything is browseable and reportable
from one place, and every record is one Firestore document well under 1 MB.

## 2. Applications needed: exactly ONE

| Setting | Value |
|---|---|
| Application id (`cmsObjectType` = `mainObjectType`) | `weekendSchool` |
| Name | Weekend School |
| permissionSystem | `'folder'` |
| rules.publicAccess | `'no'` (objects route to `om_private_objects`) |
| managers | principal email(s) - once; folder-mode fallback makes them manager everywhere |
| subModules | data on; content/other/seo off |
| listingTool | T3 Weekend School Console, mode `replace-listings`, allowObjectCRUD yes, allowedObjectTypes viewer on `weekendSchool` |

No other applications are needed.

## 3. Design plane: categories, field groups, tools

| Category | Field group | html-tool field id | Tool | Who uses it |
|---|---|---|---|---|
| cat-school-settings | fg-school-settings | `schoolSetup` | T1 SchoolSetup | principal |
| cat-lesson | fg-lesson | `lessonBoard` | T5 LessonBoard | principal + lesson teacher |
| cat-prospect | fg-prospect-board | `prospectBoard` | T2 ProspectBoard | principal |
| cat-student | fg-student | `studentRecord` | T4 StudentRecord | principal (edit) + teacher (view) |
| cat-parent-contact | fg-parent-contact | `parentContact` | T4C ParentContact | principal |
| cat-attendance | fg-attendance | `attendanceRecord` | T6 AttendanceRecord | principal + lesson teacher |
| cat-progress | fg-progress | `lessonProgress` | T7 LessonProgress | principal + lesson teacher |
| cat-payment | fg-payment-ledger | `paymentLedger` | T8 PaymentLedger | principal |
| cat-communication | fg-communication-board + fg-communication-log | `communicationBoard`, `communicationLog` | T9 CommunicationBoard (+ T4 writes logs) | principal |

Every field group contains exactly ONE html-tool field. The field's stored
JSON IS the record (schemas in WEEKEND-SCHOOL-APP-PLAN.md section 3).

## 4. The 10 html tools

| # | Tool | Kind | Placed on | Key params / settings | Reuses from the prototype |
|---|---|---|---|---|---|
| T1 | SchoolSetup | html-tool field | settings object in 0-Setup | `yearFoldersJson` (folder id map); allowRequestSave | Settings page logic |
| T2 | ProspectBoard | html-tool field | prospect board object in 1-Prospects | - | new |
| T3 | Weekend School Console | app listingTool | application | viewer role; tabs Students / Attendance / Payments / Reports | Students list, attendance board, payments summary, reports builders |
| T4 | StudentRecord | html-tool field | each student object in 2-Students | allowUpload; allowSendEmail | student modal + drawer overview + documents |
| T4C | ParentContact | html-tool field | each contact object in 8-ParentContacts | - | parent fields from student modal |
| T5 | LessonBoard | html-tool field | each lesson object in 1-Lessons | allowRequestSave | attendance board UI |
| T6 | AttendanceRecord | html-tool field | each attendance object in 3-Attendance/<lesson> | allowUpload; allowRequestSave | attendance grid, mark all, complete |
| T7 | LessonProgress | html-tool field | each progress object in 4-Progress/<lesson> | allowUpload; allowSendEmail | progress cards + message dialog |
| T8 | PaymentLedger | html-tool field | each ledger object in 5-Payments | allowExportPdf; allowSendEmail | payments page + debt list |
| T9 | CommunicationBoard | html-tool field | board object in 6-Communication | allowSendEmail | communication page |
| T10 | SchoolReports | Reports tab of T3 today | moves to app-menu tab when the CMS report host (D-RPTL) ships | allowExportPdf | reports page |

Tool field settings (all tools): `allowObjectCRUD: 'yes'` +
`allowedObjectTypes: [{mainObjectType: 'weekendSchool', role: 'editor',
scope: 'shared'}]` - role `'viewer'` for T3 only. `targetCollection` is
omitted so the app's private routing applies.

## 4.1 Build status (2026-10-05)

| # | Tool | Status |
|---|---|---|
| T1 | SchoolSetup | BUILT 2026-10-03; updated 2026-10-04 (base definition: school contact, one-time fees with scope, attendance policy, classes, teachers, calendar) |
| T2 | ProspectBoard | BUILT 2026-10-03; CRM upgrade 2026-10-04/05 (4 tabs, CMS team, gated call rounds, communication log, decision semantics Registered / Not registering / Waiting, three Distribution sub-tabs) |
| T3 | Weekend School Console | BUILT 2026-10-03; updated 2026-10-05 (enrollment strip + ENROLLMENT report section, data-act button wiring fix, schema-aligned sample) |
| T4 | StudentRecord | BUILT 2026-10-03 |
| T4C | ParentContact | TO DEVELOP - Phase 2 polish |
| T5 | LessonBoard | TO DEVELOP - Phase 3 |
| T6 | AttendanceRecord | TO DEVELOP - Phase 3 (class + support modes, attendance policy, absence call checklist) |
| T7 | LessonProgress | TO DEVELOP - Phase 3 |
| T8 | PaymentLedger | TO DEVELOP - Phase 4 (payment plan, one-time fees, reports, reminders) |
| T9 | CommunicationBoard | TO DEVELOP - Phase 4 |
| T10 | SchoolReports | Lives as the T3 Reports tab today; moves to an app-menu tab when the CMS report host (D-RPTL) ships |

## 5. Runtime plane: folder tree per year

Imported once per year by the admin (hierarchy JSON import; subfolders give
per-lesson ACL enforcement):

```
2026-2027
|-- 0-Setup            cat-school-settings
|-- 1-Lessons          cat-lesson
|-- 1-Prospects        cat-prospect
|-- 2-Students         cat-student
|-- 3-Attendance       cat-attendance
|   |-- Quran Reading        (one subfolder per lesson)
|   |-- Islamic Studies
|   |-- ...
|-- 4-Progress         cat-progress
|   |-- Quran Reading        (same lesson subfolder names)
|   |-- Islamic Studies
|-- 5-Payments         cat-payment
|-- 6-Communication    cat-communication
|-- 8-ParentContacts   cat-parent-contact
```

### Permission matrix (folder mode)

| Folder | Principal | Teacher |
|---|---|---|
| 0-Setup | manager (fallback) | no access |
| 1-Lessons | manager | viewer |
| 1-Prospects | manager | no access |
| 2-Students | manager | viewer |
| 3-Attendance/<their lesson> | manager | editor |
| 3-Attendance/<other lessons> | manager | no access |
| 4-Progress/<their lesson> | manager | editor |
| 4-Progress/<other lessons> | manager | no access |
| 5-Payments | manager | no access |
| 6-Communication | manager | no access |
| 8-ParentContacts | manager | no access |

Teachers are real CMS users: folder permission keys are their email
(encoded - every @ and . becomes _). A teacher physically cannot read or
write another lesson's records - the CMS rejects the queries.

## 6. Folder id plumbing (how tools find target folders)

- Tools cannot list folders (`requestFolders` is listing-tool-only), so ids
  flow through data:
  1. Admin pastes the year's folder id map into T1's `yearFoldersJson` param
     (one JSON block, once per year).
  2. T1 stores it as `folderMap` in the settings object and embeds it into
     every lesson object it creates.
  3. Lesson creation: the principal also enters `attendanceFolderId` and
     `progressFolderId` (the lesson's two subfolder ids from the import
     result) - two ids per lesson, one-time.
  4. T5/T6/T7 read those ids from the lesson object and always pass
     explicit `typeId` on `requestObjects('create')`.

## 7. Setup steps (admin, in order)

1. Create the application `weekendSchool` (table in section 2).
2. Create the 9 categories and field groups; assign one html-tool field per
   field group.
3. Build the 10 tools in the Tool Builder and assign them to their fields;
   set each field's settings (allowObjectCRUD + allowedObjectTypes, and the
   extras in section 4).
4. Set T3 as the application's listingTool.
5. Import the year folder tree (section 5) including per-lesson subfolders.
6. Set folder ACLs (section 5 matrix) for every teacher.
7. Create the settings object in 0-Setup; in T1 paste `yearFoldersJson` and
   create the lesson objects (with the two subfolder ids each).
8. Done - start using the console.

## 8. Build order

| Phase | Deliverables |
|---|---|
| 0 Platform setup | app + categories + field groups + tools registered + year tree + ACLs (admin, guided by section 7) |
| 1 Foundation | DONE 2026-10-04 - T1 SchoolSetup, T4 StudentRecord, T4C ParentContact, T3 Console (Students tab) |
| 2 CRM | DONE 2026-10-05 - T2 ProspectBoard + convert-to-student batch (student + ledger + comm-log + contact); CRM upgrade with tabs, rounds, communication log and decision semantics |
| 3 Teaching day | T5 LessonBoard, T6 AttendanceRecord (class + support), T7 LessonProgress |
| 4 Money + parents | T8 PaymentLedger, T9 CommunicationBoard |
| 5 Oversight | T3 Attendance, Payments, Reports tabs + text/CSV/HTML export |
| 6 Hardening | role walkthroughs, 1 MB size audit, year rollover test |

The current all-in-one `WeekendSchoolManager` keeps running until Phase 3;
its UI code is reused per tool (section 4) and data is migrated via T1's
import (section 11 of the plan).

## 9. Numbers

- ~338 objects per year at your scale (20 students, 5 lessons, 30 days);
  largest folder ~150 objects - client-side filtering stays fast.
- ~4,000 writes and ~10,000 reads per year - trivially inside the free
  Firestore quota. Every object is well under the 1 MB document limit.

## 10. What we need from you

1. Approve this structure, then (after the admin creates the app and
   imports the tree) provide the folder id map for `yearFoldersJson`.
2. Remaining decisions: support lesson granularity (per subject or per
   teacher), office assistant role now or later, one-time fees in the same
   entries list or separate, checklist scoring (states or percent).
