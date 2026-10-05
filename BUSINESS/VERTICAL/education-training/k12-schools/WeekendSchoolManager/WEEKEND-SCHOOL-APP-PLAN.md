# Weekend School - One-Application Architecture Plan

Version 2.0 - 2026-10-03

Basis: `cms-application-system.html` section 15 - verified Q&A against the
platform's tool host, object storage and permission code (2026-10-03).

Binding vocabulary: **Application = cmsObjectType = mainObjectType** (one
registry entry). **Object categories** = schema layers with `fieldGroups[]`.
**Field groups** = form sections whose fields are html-tools (the only field
type we build). **Folders** = runtime containers in `om_object_types` with
categories and permissions. **Objects** = records in `om_objects` /
`om_private_objects` with `productData.data_categoriesBased`. All school
record data is stored as the JSON value of ONE html-tool field per object -
so the tool IS the form for its record kind.

---

## 1. The decision: ONE application, many html tools

One tool holding everything hits three walls:

1. **The 1 MB Firestore limit.** Attendance + progress + payments + proof
   image metadata for ~100 students over a year is fine, but growth, long
   notes and many records make one document fragile.
2. **Permissions.** A principal sees everything; a teacher must only touch
   their own lesson. Folder-level ACLs give that isolation cleanly.
3. **Object model.** One CMS object per record (one per lesson, one per
   student, one attendance record per lesson per day) makes folders,
   permissions and reports work naturally.

Result: one application with 10 html tools, each doing one job, talking to
each other through `tool.requestObjects(...)`. Verified facts that shape
everything below:

- The app's own id works in `allowedObjectTypes` - a tool can query, create
  and update objects of its own application scoped by `typeId` (nothing is
  implicit; the own app id must be listed).
- `requestObjects('create')` takes `{mainObjectType, typeId?, name,
  productData}` - NO categories parameter. The new object inherits the
  FOLDER's categories at render time. Always pass `typeId` explicitly.
- Query returns DIRECT objects of the folder only; server-side
  filters/sort/limit/offset are NOT implemented yet (planned D-LIST-03) -
  filter and page client-side, and keep folders small.
- An application has exactly ONE `listingTool` slot. One tool gets it
  (T3 Weekend School Console); everything else is an html-tool field.
- There is NO per-field role visibility. Parent contact data lives in its
  own principal-only folder, not as fields on the student form.
- Tools do NOT create folders - the admin does (Object Manager, hierarchy
  JSON import, or API v2). Tools only create objects inside folders.

---

## 2. Roles and what each can do

| Capability | Principal | Teacher |
|---|---|---|
| School setup + lesson definitions | Full | No access |
| Prospect CRM | Full | No access |
| Student registration + documents | Full | View identity and health only |
| Parent contact data (phone/email/address) | Full | No access - CMS-level, not just hidden |
| Attendance | All lessons | Own lesson only - CMS-enforced per-lesson folders |
| Lesson progress | All students | Own lesson only - CMS-enforced per-lesson folders |
| Communication board + absence calls | Full | No access |
| Payments | Full | No access |
| Reports | All lessons | Own lesson only |

How this is enforced (verified against the CMS permission code):

- The app runs with `permissionSystem: 'folder'`.
- Principal = the app's `managers[]` array, set ONCE. In folder mode the
  app arrays are the FALLBACK: when a folder has no permission entry for a
  user, the user falls back to the app arrays. So the principal is manager
  on every folder without being added anywhere.
- Teacher = folder permission entries ONLY: viewer on `1-Lessons`, viewer
  on `2-Students`, editor on `3-Attendance/<their lesson>`, editor on
  `4-Progress/<their lesson>` (per-lesson subfolders, section 7). Every
  other folder has no entry for teachers, and teachers are not in the app
  arrays, so the fallback gives them nothing - those folders are
  inaccessible at the CMS level.
- Teachers ARE real CMS users: `teacherUserId` = `getUser().id` and the
  folder ACL entries use the teacher's email (encoded key).
- There is NO per-field or per-field-group role visibility (verified). That
  is why parent contacts live in their own folder (section 3.5).
- Tools additionally gate buttons with `tool.getUser().roles` for
  convenience. That is never the security boundary - Firestore security
  rules on the acting user's session are, narrowed by the tool allowlist
  and the folder/object permission maps.

---

## 3. Data dictionary - categories, field groups, and what each tool stores

ONE application, id `weekendSchool`. In the App Designer the app owns the
categories below; each category references field groups; each field group
contains exactly ONE html-tool field. The field id is the storage key under
`productData.data_categoriesBased` and its value is that tool's JSON - the
whole record. "Record kind" below = category + field group + tool + JSON
schema.

| Category | Field group (one html-tool field) | Objects live in |
|---|---|---|
| cat-school-settings | fg-school-settings (`schoolSetup` - T1) | 0-Setup |
| cat-lesson | fg-lesson (`lessonBoard` - T5) | 1-Lessons |
| cat-prospect | fg-prospect-board (`prospectBoard` - T2) | 1-Prospects |
| cat-student | fg-student (`studentRecord` - T4) | 2-Students |
| cat-parent-contact | fg-parent-contact (`parentContact` - T4C) | 8-ParentContacts |
| cat-attendance | fg-attendance (`attendanceRecord` - T6) | 3-Attendance |
| cat-progress | fg-progress (`lessonProgress` - T7) | 4-Progress |
| cat-payment | fg-payment-ledger (`paymentLedger` - T8) | 5-Payments |
| cat-communication | fg-communication-board (`communicationBoard` - T9) and fg-communication-log (`communicationLog` - written by T4/T9) | 6-Communication |

### 3.1 School settings (`schoolSetup`, one object per year, principal only)

    { schoolName, schoolYear, currency, paymentDueDay,
      attendanceRule(all|first|firstAndAfternoon|custom), classGroups[] (legacy migration source),
      paymentBrackets[{id,name,monthlyFee,discountedFee}],
      schoolContact{address, phone, website, principalName, principalEmail},
      schoolFees{oneTimeFees[{id,name,amount,scope: school|class, classId}]},
      attendancePolicy{lateAfterMin, absenceCallAfter},
      classes[{id,name,teacherUserId,teacherName}],
      teachers[{id,name,email}],
      schoolCalendar{firstDay, excludedDates[], schoolDays[]},
      folderMap: { settings, lessons, prospects, students, attendance,
                   progress, payments, contacts, communication },
      seeded }

`folderMap` holds the folder ids of the current year. T1 embeds it into
every lesson object it creates, so teacher tools find target folders without
needing folder listing APIs. T1 gets the ids once per year from the Folders
tab (suggested ids = school-slug + school-year + folder suffix).

One-time fees (2026-10-04): `schoolFees.oneTimeFees` covers registration and
annual fees at school scope plus class-level fees (e.g. a class trip fee)
via `scope: 'class'` + `classId`. Event-based fees (trips, events) are a
SEPARATE tool's subject (agreed 2026-10-04) - they grow over time and the
event tool manages its own payments.

Attendance policy (2026-10-04): `attendancePolicy` holds the late threshold
(minutes after lesson start = Late) and the absence call rule (how many
absences flag a parent call). T6 applies it, and T6 carries a checklist to
track that absence calls were actually done.

### 3.2 Lesson (`lessonBoard`, one object per lesson per year)

The lesson definition AND the teacher's day board live in one value:

    { name, lessonType: class|support, dayOfWeek, startTime, durationMin,
      classGroupIds[], teacherUserId, teacherName, room,
      progressChecklist: [{id, label, kind: checkbox|note}],
      attendanceFolderId, progressFolderId,
      folderMap, active, schoolYear }

`attendanceFolderId` and `progressFolderId` point at this lesson's own
subfolders of 3-Attendance and 4-Progress. T1 fills them when the lesson is
created (the principal pastes the two ids from the hierarchy import
result); T5/T6/T7 read them to create records in the right subfolder.

### 3.3 Prospect board (`prospectBoard`, one object per year, principal only)

    { prospects: [{id, childName, parentName, parentPhone, parentEmail,
      source, interestedLessons, status, nextCallDate, lastCallNote, notes[]}],
      callLog: [{date, prospectId, outcome, by}] }

~0.8 KB per prospect - one object fits ~1000 prospects within 1 MB (the tool
shows a live size meter and warns at 800 KB; beyond that, section 10).

### 3.4 Student (`studentRecord`, one object per student per year)

    { firstName, lastName, gender, dateOfBirth, classGroupId,
      status: active|paused|left, startDate, photoConsent,
      emergencyContactName, emergencyContactPhone, emergencyContactRelation,
      allergies, healthNotes, pickupAuthorizedNames, pickupNotes,
      documents: [{id, name, url, kind, uploadedAt, uploadedBy}],
      registeredYear }

~2 KB. Parent phone/email/address are NOT here (section 3.5).

### 3.5 Parent contact (`parentContact`, one object per student, principal only)

    { studentId, studentName, parentName, parentRelation, parentPhone,
      parentEmail, secondParentName, secondParentPhone, address }

Lives in `8-ParentContacts`, a folder with NO teacher permission entries.
Teachers are not in the app arrays either, so the fallback grants nothing -
contact data is inaccessible to teachers at the CMS level, not just hidden
in the UI. T8 and T9 read it for payment reminders and absence calls
(principal only). Teacher messaging is copy-only (section 4, T7).

### 3.6 Attendance (`attendanceRecord`, one object per lesson per school day)

    { lessonDate, lessonId, lessonName, lessonType,
      teacherUserId, teacherName,
      entries: [{studentId, studentName, mark: P|A|L|E, note, proofImages[]}],
      completedAt, completedBy }

Class of 20 ~0.6 KB; one support session ~0.3 KB. ONE record kind handles
both styles: class lessons store the whole class grid; support lessons store
one entry per pulled student session.

### 3.7 Progress (`lessonProgress`, one object per student per lesson per year)

    { studentId, studentName, lessonId, lessonName,
      checklist: [{itemId, label, kind, state, note, updatedAt}],
      activityLog: [{date, note, proofImages[], by}], notes }

Checklist is copied from the lesson definition at creation. ~0.5 KB +
2-4 KB/year of activity. Well under 1 MB.

### 3.8 Payment ledger (`paymentLedger`, one object per student per year)

    { studentId, studentName, schoolYear,
      entries: [{id, month, amount, dueDate,
                 status: unpaid|paid|partial|late|exempt, paidDate, note}] }

Monthly installments and one-time fees use the same list. ~1 KB/year.

### 3.9 Communication (`communicationBoard` and `communicationLog`)

    communicationBoard (one object per year):
      { groupMessages: [{id, date, language, title, text}],
        suggestions: [{id, date, from, text, status, followUp}] }

    communicationLog (one object per student):
      { studentId, oneOnOne: [{date, channel, summary}],
        absenceCalls: [{date, reason, outcome}] }

### 3.10 Shared conventions for every record kind (verified)

- Create: `requestObjects('create', {mainObjectType: 'weekendSchool', typeId,
  name, productData: {data_categoriesBased: {<fieldId>: json}}})` - ALWAYS
  pass `typeId`; there is no categories parameter; the object inherits the
  folder's categories at render time.
- Read: `object.productData.data_categoriesBased.<fieldId>`.
- Update: partial update + CAS (`baseVersion`); on conflict reload and retry.
  `batch` (max 500, atomic) has no CAS and carries no categories either.
- `allowedObjectTypes` per tool: ONE entry
  `{mainObjectType: 'weekendSchool', role: viewer|editor, scope: 'shared'}`
  (targetCollection omitted - the app's private routing applies).
- Proof images: `requestUpload(...)` then store URLs only. Never base64.
- Every tool stamps who/when inside its own JSON.
- Size meters inside tools warn at 800 KB and block at ~950 KB.

---

## 4. Tool catalog

All tools are html-tool fields in the field groups of section 3, except T3
which occupies the app's single `listingTool` slot. Every tool lists
`{mainObjectType: 'weekendSchool', role: ..., scope: 'shared'}` in its
`allowedObjectTypes` (role is the CAP; the acting user's own permissions are
the final gate).

### T1 - SchoolSetup (html-tool field `schoolSetup`, cat-school-settings)
- Placed on: the settings object in `0-Setup` (principal only).
- Owns: settings JSON incl. `folderMap`; creates lesson objects in
  `1-Lessons` (each gets name, teacher, checklist and a copy of folderMap);
  year rollover = paste the new year's `yearFoldersJson` param, then "Start
  new year" creates the settings object and copies lesson objects into the
  new year's folders.
- Param: `yearFoldersJson` (JSON map of the 9 folder ids).
- Role: editor. Principal only (folder ACL).
- **Built (2026-10-03 / updated 2026-10-04)**: reusable tool `k12-schools/SchoolSetup/app/SchoolSetup.{html,css,js}` + test-harness. Generic name, generic params (`appObjectType` default `weekendSchool`, plus `schoolName`/`currency` seeds). Tabbed UI: Overview (profile + school contact), Payments (currency, due day, one-time fees at school/class level, brackets with monthlyFee + discountedFee), Lessons (subjects with levels + attendance rule + attendance policy), Classes (student groups with homeroom teacher), Teachers (name + email directory), Calendar (explicit schoolDays list), Folders (suggested ids + confirm-on-change + copy/paste). Year rollover and legacy import were removed on user request (2026-10-03) - they return as mature features later.

### T2 - ProspectBoard (field `prospectBoard`, cat-prospect)
- Placed on: the prospect board object in `1-Prospects` (principal only).
- CRM pipeline + call log. **Convert to student** runs one atomic `batch`:
  create student (2-Students) + ledger (5-Payments) + communication log
  (6-Communication) + parent contact (8-ParentContacts), then stamps the
  prospect `enrolled`. Folder ids come from the settings object's folderMap
  (found by querying the app and matching `recordKind: 'schoolSettings'`).
- Role: editor.
- **Built (2026-10-03)**: reusable tool `k12-schools/ProspectBoard/app/ProspectBoard.{html,css,js}` + test-harness. Params: `appObjectType`, `folderMapJson` fallback.

### T3 - Weekend School Console (THE app listingTool, mode 'replace-listings')
- One listingTool slot exists per app, so this ONE tool is the school
  console. Tabs: **Students** (search, class group, status, live aggregates),
  **Attendance** (day board across all lessons: not started / N of M marked
  / completed + who entered), **Payments** (waiting list + month totals),
  **Reports** (weekly + monthly report text, CSV + HTML export, PDF via
  `requestExportPdf` when available).
- Read-only: viewer role. Drill-down via `tool.openObjectDetail(mainObjectType,
  objectId)` opens the student / attendance / ledger object with its tool.
- Has `requestFolders`, `getAppContext`, `openObjectInShell`.
- Teacher sees only their own lessons in Attendance and Reports (UI filter
  on teacherUserId). Principal sees everything.
- T10 = the Reports tab today; when the CMS report host screen (D-RPTL)
  ships, the same report code moves to an app-menu tab without redesign.
- **Built (2026-10-03)**: reusable tool `k12-schools/SchoolConsole/app/SchoolConsole.{html,css,js}` + test-harness. TYPE 3 listing tool, mode `replace-listings`. Params: `appObjectType`, `folderMapJson` fallback, `attendanceFolderIds` fallback. Attendance subfolders are discovered with `requestFolders` (parentId = year attendance folder); reports tab builds weekly attendance + payment summary text with copy/download.

### T4 - StudentRecord (field `studentRecord`, cat-student)
- Placed on: each student object in `2-Students`.
- Owns identity/health/documents JSON. For the PRINCIPAL it also reads and
  writes the student's communication log (objects in 6-Communication) and
  shows the parent contact summary. Teachers get viewer on 2-Students only;
  their queries to contacts/communication folders are denied by ACL, so T4
  hides those sections and stays read-only for them.
- Role: editor in the allowlist; effective access is per-user.
- **Built (2026-10-03)**: reusable tool `k12-schools/StudentRecord/app/StudentRecord.{html,css,js}` + test-harness. Params: `appObjectType`, `communicationFolderId` fallback. Cross records read via query-all (ACL-limited); communication tab writes the comm log object with CAS (create on first entry). Documents support `requestUpload` with a URL fallback.

### T4C - ParentContact (field `parentContact`, cat-parent-contact)
- Placed on: each parent contact object in `8-ParentContacts` (principal
  only). Simple form for parent phone/email/address. Kept separate from T4
  because there is no per-field role visibility - separation by folder is
  the only CMS-level way to hide contacts from teachers.
- Role: editor.

### T5 - LessonBoard (field `lessonBoard`, cat-lesson)
- Placed on: each lesson object in `1-Lessons`. Value = lesson definition +
  folderMap copy.
- Principal view: edit definition (name, times, class groups, teacher,
  progress checklist).
- Teacher view: day board for THIS lesson - lists this lesson's attendance
  records (query the lesson's attendance subfolder via
  `attendanceFolderId`, filter by date client-side), **New day record**
  button creates the attendance object into that subfolder (explicit
  typeId), then `openObjectDetail` to T6. Also opens/creates per-student
  progress objects in the lesson's progress subfolder.
- Role: editor in the allowlist; the subfolder ACLs (section 7) give the
  lesson's teacher editor access there, and the principal manager access.

### T6 - AttendanceRecord (field `attendanceRecord`, cat-attendance)
- Placed on: each attendance object in `3-Attendance/<lesson>` (the
  lesson's own subfolder).
- Class mode: student x mark grid (P/A/L/E), Mark All, teacher stamp
  (auto from getUser), Mark Complete with the 24-hour rule; optional
  `objectStatus: 'readonly'` after completion (blocks saving even for
  managers until unlocked).
- Support mode: pull a student, record mark + note + proof images, session
  list.
- **Attendance policy (2026-10-04)**: T6 reads `attendancePolicy` from the
  settings object - `lateAfterMin` decides when a student is marked Late
  instead of Present, and `absenceCallAfter` flags a parent call after that
  many absences. **Absence call checklist**: T6 (or T9's absence list)
  carries a checklist so the principal can verify that every flagged
  absence call was actually made and follow up on the ones that were not.
- Edit gate: only the record's teacherUserId or the principal (UI gate).
- Role: editor in the allowlist.

### T7 - LessonProgress (field `lessonProgress`, cat-progress)
- Placed on: each progress object in `4-Progress/<lesson>` (one per
  student per lesson). Checklist (copied from lesson definition at
  creation), activity log with proof uploads, notes, message dialog.
- Messaging: Copy text / Copy as image always work; **Send Email is
  principal-only** because the teacher cannot read parent-contact objects
  (ACL). Teachers copy the message and send it from their own phone.
- Role: editor in the allowlist.

### T8 - PaymentLedger (field `paymentLedger`, cat-payment)
- Placed on: each ledger object in `5-Payments` (principal only).
- **THE payment plan tool (noted 2026-10-04).** SchoolSetup holds only the
  fee DEFINITIONS; the ledger carries each student's actual PAYMENT PLAN:
  - Monthly installments generated from the student's payment bracket
    (amount + monthly due day from the settings).
  - One-time fees from `schoolFees.oneTimeFees`: school-level fees apply to
    every student; class-level fees apply to the students of that class.
  - Event-based fees handed over from the future event tool (section 10).
  - Track each entry: mark paid / partial / late with a paid date, overdue
    badges, one-time fee additions.
  - **Reports**: per-student payment report, per-fee-type totals (monthly vs
    one-time vs event), per-class totals and per-event totals (when the
    event tool exists). Export text / CSV / PDF.
  - Reminders (copy) and receipts via `requestExportPdf`; parent contact
    read from 8-ParentContacts.
- Role: editor in the allowlist.

### T9 - CommunicationBoard (field `communicationBoard`, cat-communication)
- Placed on: the board object in `6-Communication` (principal only).
- Weekly group messages EN/TR with copy buttons, suggestions/complaints
  follow-up. Same-day absence call list reads attendance records and writes
  calls into the per-student communication logs.
- Role: editor in the allowlist.

### T10 - SchoolReports
- Not a separate app-level tool today: the CMS has one listingTool slot and
  the report host screen (D-RPTL) is not built yet. Reports run as the T3
  Reports tab (client-side aggregation over the year's folders, exported as
  text/CSV/HTML). Section 10 describes the move to an app-menu tab.

---

## 5. Lesson model, one-on-one support, proof images

- **Lesson = object** in `1-Lessons`. The lesson definition AND the
  teacher's day board live in the same tool value (T5), so the teacher's
  daily entry point is: open their lesson object -> the board lists the
  lesson's days -> open or create a day record.
- **Checklist per lesson.** The lesson value defines `progressChecklist`;
  T7 copies it into each progress object at creation. Editing the lesson
  checklist later affects only new progress objects (or the tool offers
  "apply to existing").
- **Class vs support attendance.**
  - Class lesson: one attendance object per lesson per school day; entries
    = the whole class grid.
  - Support lesson (one-on-one): same record kind. The support teacher pulls
    students one by one; each session = one entry with mark, note and proof
    images. Students never pulled are simply not in the record.
- **Proof images.** All lesson proof (student work photos) is uploaded via
  `requestUpload` and stored as URLs on attendance entries and progress
  activity items. Never base64.
- **Teacher isolation mechanics (CMS-enforced).** Each lesson has its own
  subfolders `3-Attendance/<lesson>` and `4-Progress/<lesson>`. The
  subfolder ACL grants the lesson's teacher editor and the principal
  manager (fallback). A teacher physically cannot read or write another
  lesson's attendance or progress records - the CMS rejects the queries.
  Tools still filter by `teacherUserId` for display convenience only.

---

## 6. Integration matrix

Rows = tools, columns = record kinds. R = read, W = write, C = create, - = none.

| Tool | settings | lesson | prospect | student | contact | attendance | progress | ledger | comm-board | comm-log |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 SchoolSetup | W | C/W | - | - | - | - | - | - | - | - |
| T2 ProspectBoard | R | - | W | C | C | - | - | C | - | C |
| T3 Console | R | R | - | R | - | R | R | R | - | R |
| T4 StudentRecord | R | - | - | W | R | R | R | - | - | R/W |
| T4C ParentContact | - | - | - | R | W | - | - | - | - | - |
| T5 LessonBoard | - | W | - | R | - | C/R | C/R | - | - | - |
| T6 AttendanceRecord | - | R | - | R | - | W | - | - | - | - |
| T7 LessonProgress | - | R | - | R | - | - | W | - | - | - |
| T8 PaymentLedger | R | - | - | R | R | - | - | W | - | - |
| T9 CommunicationBoard | R | - | - | R | - | R | - | - | W | W |

Key flows:
1. Prospect converts to student: T2 batch-creates student + ledger +
   comm-log + parent contact (all with explicit typeIds from folderMap).
2. Enrollment: T1/T4 assign class group; lesson coverage comes from
   lesson.classGroupIds.
3. Teacher day: open the lesson object (T5 board) > New day record
   (created in 3-Attendance) > mark in T6.
4. Teacher support day: same flow; T6 runs in support mode > pull student >
   mark + activity + proof.
5. Progress: T5 opens/creates the per-student progress object > T7 ticks
   checklist, logs activity with photos, copies a parent message.
6. Payments: principal opens a ledger from the console > T8 checks months,
   adds fees, sends reminders (parent contact read from 8-ParentContacts).
7. Reports: the console's Reports tab aggregates by querying the year's
   folders and filters client-side.

---

## 7. CMS setup checklist

1. Create ONE application in App Designer:
   - id `weekendSchool`, name "Weekend School"
   - `permissionSystem: 'folder'`
   - `rules.publicAccess: 'no'` (objects route to `om_private_objects`)
   - `managers[]` = the principal's email(s) - the folder-mode fallback
     makes them managers on every folder
   - `subModules`: data on; content/other/seo off; opening module = data
2. Create the categories and field groups of section 3 (one html-tool field
   per field group), build the tools in the Tool Builder, assign each tool
   to its field. Per field settings: `allowObjectCRUD: 'yes'` +
   `allowedObjectTypes: [{mainObjectType: 'weekendSchool', role: 'editor',
   scope: 'shared'}]` (role 'viewer' for T3). Add `allowRequestSave` (T1,
   T5, T6, T7, T8), `allowUpload` (T4, T6, T7), `allowSendEmail` (T4, T7,
   T8, T3), `allowExportPdf` (T8, T3).
3. Set T3 as the application's `listingTool` (the single slot):
   `{ toolId, mode: 'replace-listings', params: {}, allowObjectCRUD: 'yes',
   allowedObjectTypes: [{mainObjectType: 'weekendSchool', role: 'viewer',
   scope: 'shared'}] }`.
4. Year tree - import once per year (Object Manager hierarchy JSON import;
   folder categories bind each folder to its record kind). Attendance and
   Progress get ONE subfolder per lesson so folder ACLs enforce per-lesson
   access:

   ```
   { "name": "2026-2027", "children": [
     { "name": "0-Setup",          "categories": ["cat-school-settings"] },
     { "name": "1-Lessons",        "categories": ["cat-lesson"] },
     { "name": "1-Prospects",      "categories": ["cat-prospect"] },
     { "name": "2-Students",       "categories": ["cat-student"] },
     { "name": "3-Attendance",     "categories": ["cat-attendance"], "children": [
       { "name": "Quran Reading" },
       { "name": "Islamic Studies" }
     ]},
     { "name": "4-Progress",       "categories": ["cat-progress"], "children": [
       { "name": "Quran Reading" },
       { "name": "Islamic Studies" }
     ]},
     { "name": "5-Payments",       "categories": ["cat-payment"] },
     { "name": "6-Communication",  "categories": ["cat-communication"] },
     { "name": "8-ParentContacts", "categories": ["cat-parent-contact"] }
   ] }
   ```

   Tools never create folders; adding a lesson later = the admin adds its
   two subfolders (or reruns the import). The principal then enters the two
   subfolder ids in T1 when creating the lesson object.
5. Folder permissions (teacher entries only):
   - viewer on `1-Lessons` and `2-Students`
   - editor on `3-Attendance/<their lesson>` and `4-Progress/<their lesson>`
   - no entries anywhere else (fallback to app arrays = nothing for
     teachers)
   Principal: nothing to do - `managers[]` covers all folders.
6. First run: create the settings object (Object Manager > 0-Setup), open
   T1, paste `yearFoldersJson` (folder id map from the import result), then
   T1 seeds defaults and creates the lesson objects.
7. Year rollover: import the next year's tree, update `yearFoldersJson`,
   run "Start new year" in T1 (creates settings + copies lessons). Old
   year stays as history. Categories, field groups, tools and permissions
   are registered once.

---

## 8. How the tools communicate (folder and object level) - verified

There is no tool-to-tool channel and none is needed: all tools are clients
of one database, the CMS object store. Everything below is verified against
the tool host implementation (2026-10-03).

1. **Own-app access.** `requestObjects` works for the app a tool is embedded
   in. `allowedObjectTypes` is matched purely by `mainObjectType` - list
   `weekendSchool` itself (role viewer or editor, scope shared). Nothing is
   implicit; the own app id must appear in the list.
2. **Addressing.** `mainObjectType` (the one app) + `typeId` (folder) +
   `objectId` (record). Query `{mainObjectType, typeId?}` returns DIRECT
   objects of that folder only (no descendants). Omitting typeId queries
   the whole app - T2/T8/T9 use that to find the settings object and its
   `folderMap`. Server-side filters/sort/limit/offset are NOT implemented
   yet (D-LIST-03) - sort and filter client-side; folders stay small
   (max ~150 objects per year).
3. **Create.** `{mainObjectType, typeId, name, productData}` - there is NO
   categories parameter; the new object inherits the FOLDER's categories at
   render time. Always pass `typeId` explicitly (without it the host picks
   the app's first folder or auto-creates a "Default" folder).
4. **Update.** Partial update + compare-and-set on `baseVersion`; on
   conflict the save is rejected - reload and retry. `batch` (max 500,
   atomic) has no CAS.
5. **A field tool knows where it is.** The onReady second argument and
   `getFields()` return the whole parent object document incl. `typeId` and
   `cmsObjectType` - a tool reads its own record's JSON from
   `productData.data_categoriesBased.<its field id>` and its own folder from
   `typeId`. Cross-folder target ids come from the settings object's
   `folderMap`, which T1 embeds into every lesson object.
6. **Cross-record reads.** A tool reads any folder its allowlist covers,
   gated by the acting user's permissions. Teacher tools querying
   8-ParentContacts or 6-Communication are denied by ACL and must degrade
   gracefully (hide the section).
7. **Navigation.** `tool.openObjectDetail(mainObjectType, objectId)` opens
   another object with its tool. T3 and T5 use it for drill-down;
   app-level listing tools additionally get `requestFolders`,
   `getAppContext`, `openObjectInShell`.
8. **Permissions travel with every call.** The acting user's Firestore
   session and security rules are the final gate, narrowed by the tool's
   allowlist role and the folder/object permission maps. `getUser().roles`
   already merges effective object-level roles - use it for UI gating only.
9. **Private routing.** The app runs `publicAccess: 'no'`, so objects land
   in `om_private_objects`; `allowedObjectTypes` entries omit
   `targetCollection` so the app's own routing applies.
10. **Reports aggregate by querying.** T3's Reports tab runs one query per
    year folder, filters client-side by date and lesson, builds the report
    body in memory and never stores it. A complete monthly report reads
    ~340 small objects in a few queries - milliseconds.

Summary: categories = forms, folders = the year structure, tools = views
and forms over the object store. Data written by one tool is immediately
visible to every other authorized tool - one copy of the data, in the CMS.

---

## 9. Build phases

- **Phase 0 - Platform setup** (admin, guided by section 7): application +
  categories + field groups + year tree import + tool registration + T1
  first run.
- **Phase 1 - Foundation**: T1 SchoolSetup, T4 StudentRecord, T4C
  ParentContact, T3 Console (Students tab).
- **Phase 2 - CRM**: T2 ProspectBoard + convert-to-student batch.
- **Phase 3 - Teaching day**: T5 LessonBoard, T6 AttendanceRecord (class +
  support modes), T7 LessonProgress.
- **Phase 4 - Money + parents**: T8 PaymentLedger, T9 CommunicationBoard.
- **Phase 5 - Oversight**: T3 Attendance, Payments and Reports tabs with
  text/CSV/HTML export (and PDF where available).
- **Phase 6 - Hardening**: role walkthroughs (principal/teacher on every
  tool), 1 MB size audit, year rollover test.

Each phase ends with a working, shippable slice. The current all-in-one
`WeekendSchoolManager` keeps running until Phase 3, then data is migrated
(section 11) and it is retired.

---

## 10. Future flexibility (why this design scales)

- New record kind = new category + field group + tool + folder. Existing
  tools stay untouched (the matrix stays valid).
- Prospect board too big: move prospects to per-prospect objects in the
  same folder; the console lists them.
- Bus routing, exams, events, QR check-in: new categories + tools + folders.
- Event-based fees (trips, events): a separate event tool with its own
  participant list and payment tracking (agreed 2026-10-04) - SchoolSetup
  keeps only recurring + school/class one-time fee definitions.
- Office assistant role: folder editor entries on 5-Payments / 1-Prospects
  only.
- Multi-school: one app per school; the folder-per-year pattern repeats.
- Per-lesson isolation is the default (section 5): every lesson has its own
  attendance and progress subfolders with folder ACLs, so teacher access is
  CMS-enforced. The simpler variant (one shared 3-Attendance folder with
  UI-level filtering only) remains possible for a very small, fully trusted
  staff: drop the subfolders and grant editor on the parent folders.
- Reports: when the CMS report host screen (D-RPTL) ships, the T3 Reports
  tab code moves to an app-menu tab unchanged; the listing-tool slot stays
  with the console.
- Year rollover: old year folders stay archived; a new year = new tree +
  `yearFoldersJson` update (section 7).
- AI later: `requestAI` for report summaries and follow-up drafts.

---

## 11. Migration from the current WeekendSchoolManager

1. In the current tool: Settings > Export All Data (JSON).
2. In T1: an "Import from old tool" action pastes the JSON and runs
   batches of creates: settings update, one lesson object per
   `school.lessons`, one student object per student, one parent-contact
   object per student, one ledger per student (from paymentEntries), one
   progress object per student x lesson (from quranReading/
   quranMemorization/progressNotes), attendance objects per Sunday x lesson
   (from attendanceByDate), one communication log per student.
3. Verify with the T3 console, then archive the old tool folder.

---

## 12. Document count per year

Worked example with your numbers: **20 students, 5 lessons per school day,
1 school day per week, ~30 school days per year.**

| Record kind (category) | Rule | Documents per year | Notes |
|---|---|---|---|
| school settings | 1 per year | **1** | |
| lesson | 1 per lesson per year | **5** | defined once, used all year |
| prospect board | 1 | **1** | all prospects in one CRM board |
| student | 1 per student per year | **20** | |
| parent contact | 1 per student | **20** | principal-only folder |
| attendance | 1 per lesson per school day | **150** | 5 lessons x 30 days |
| progress | 1 per student per lesson per year | **100** | 20 students x 5 lessons |
| payment ledger | 1 per student per year | **20** | |
| communication log | 1 per student | **20** | |
| communication board | 1 | **1** | |
| **Total** | | **~338 documents per year** | |

Rules to remember:

- Attendance is the only kind that grows with TIME (150 per year here).
  Progress grows with students x lessons (100). Everything else is tiny.
- One-on-one support sessions live INSIDE the support lesson's daily
  attendance record (each pulled student = one entry), so they add ZERO
  extra documents. Only if the school defines support lessons in ADDITION
  to the 5 daily lessons does the count grow by 30 per extra support lesson.
- A year rollover creates the next year's objects; old ones are archived
  by folder. No document ever accumulates years of history.
- One folder holds max ~150 objects per year (3-Attendance), so
  client-side filtering stays fast until server-side filters (D-LIST-03)
  arrive.

Growth check (same 5 lessons, 30 days):

| Students | attendance | progress | student | contact | ledger | comm-log | lessons | settings/boards | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| 20 | 150 | 100 | 20 | 20 | 20 | 20 | 5 | 3 | **~338** |
| 50 | 150 | 250 | 50 | 50 | 50 | 50 | 5 | 3 | **~558** |
| 100 | 150 | 500 | 100 | 100 | 100 | 100 | 5 | 3 | **~1058** |

Storage impact: every document is well under the 1 MB limit (largest is a
progress record at ~2-4 KB after a full year). ~1000 documents at ~1 KB
average is about 1 MB of total Firestore storage - inside the free tier
(1 GiB). No per-document limit is ever at risk.

Rough annual operation counts (Firestore free tier is 20K writes and 50K
reads per DAY - trivially inside quota):

- Attendance updates: ~150 (once per lesson per day)
- Progress updates: ~3,000 (100 records x 30 days, teachers tick checklists)
- Ledger updates: ~240 (20 students x 12 months)
- Communication log updates: ~600 (20 students x 30 weeks)
- Total writes per year: **~4,000**, total reads per year: **~10,000**
  (boards and reports query each folder on load)



## 13. Decisions (resolved by the CMS reference) and remaining questions

Resolved - verified Q&A (section 15 of the CMS application reference):

1. ONE application - tools reach their own app through the allowlist.
2. Create has no categories parameter - objects inherit the folder's
   categories at render; tools always pass typeId.
3. Multiple categories per folder/object and multiple html-tool fields per
   field group are both allowed.
4. No per-field role visibility - parent contacts live in the
   principal-only 8-ParentContacts folder.
5. ONE listingTool slot per app - T3 console holds it; reports are its tab
   until the report host screen ships.
6. Queries return direct folder objects only; filter/sort/paginate
   client-side; folders kept small.
7. Folders are created by the admin (Object Manager / hierarchy import /
   API v2), never by tools.
8. In folder mode app roles are the fallback - the principal sits in
   `managers[]` once and is manager everywhere.
9. `rules.publicAccess: 'no'` - all objects live in `om_private_objects`.

Answered (2026-10-03):

1. Teachers ARE real CMS users - `teacherUserId` = `getUser().id`; folder
   ACL entries use the teacher's email (encoded key).
2. Attendance/lesson permissions = per-lesson subfolders with folder ACLs
   (CMS-enforced) - sections 5 and 7.

Answered (2026-10-04):

3. One-time fees: a single `schoolFees.oneTimeFees` list with a scope -
   `school` (every student, e.g. registration fee) or `class` + `classId`
   (one class, e.g. class trip fee). Stored in the settings object; T8
   applies them to ledgers.
4. Event-based fees (trips, events, fundraisers): SEPARATE tool's subject
   (agreed 2026-10-04). They grow over time with their own participants
   and payment statuses - a future event tool manages its own payments;
   SchoolSetup holds only the recurring + one-time fee definitions above.
5. Attendance policy + absence calls: `attendancePolicy` lives in the
   settings object (late threshold + absence call rule). The attendance
   tool applies it and carries a checklist to track that absence calls
   were done properly (section T6).
6. Base school definition: school contact block, one-time fees and
   attendance policy are implemented in T1 (2026-10-04). Remaining
   candidates (document checklist defaults, grading scale, languages) are
   logged as tasks in the SchoolSetup SSOT (group G-SSU-BASE).

Remaining questions for you:

1. Support lessons: one support lesson object per subject or one per
   teacher? Do support teachers also take class lessons?
2. Office assistant role from day one (payments/prospects editor), or
   principal-only for now?
3. One-time fees: same entries list with a note (assumed), or a separate
   list?
4. Checklist scoring: states (done/partial/none) or a percentage?
