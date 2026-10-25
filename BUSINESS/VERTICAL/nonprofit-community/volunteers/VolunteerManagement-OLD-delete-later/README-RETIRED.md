# VolunteerManagement - RETIRED

This folder is kept only as a reference while its remaining behaviour is moved into the two live tools.
It is expected to be **deleted**. Do not add features or fixes here.

| Replaced by | Folder |
| --- | --- |
| Volunteer portal (hours, certificate, applications) | `../VolunteerProfile/` |
| Event manager (requests, roles, tasks, hours approval, messages, report) | `../EventVolunteerManager/` |

## What is NOT carried over

- CSV bulk import of volunteers: the CMS imports objects, so the tool does not need it.

## What still has no home (decide before deleting)

- Batch approval of all pending hours for one event (per-line approval exists in `EventVolunteerManager`).
- Sending the certificate by email (creation and PDF export exist in `VolunteerProfile`).

## Retired CMS object types

These types are used only by this tool and disappear with it:

- `vm-event-applications-uniconbaseapps`
- `vm-event-hours-uniconbaseapps`

The live tools use `volunteer-registry-uniconbaseapps`, `vm-events-uniconbaseapps`,
`vm-event-memberships-uniconbaseapps`, `vm-event-tasks-uniconbaseapps` and `vm-event-messages-uniconbaseapps`.
