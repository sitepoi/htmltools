# SHIP → Application Store CMS Integration Plan

**Status: PLANNED - the bundle is prepared, but no CMS communication is made yet.**
The SHIP process (see `publish-rules.txt`, trigger word **SHIP**) currently
ends at Phase 7 (commit + push). Phase 8 prepares a handoff bundle that the
application store CMS will consume once its import API exists.

## 1. What SHIP produces for the CMS (one bundle per tool)

`npm run ship:cms -- <ToolName>` (or `--all`) writes `ship-out/<ToolName>/`:

| Bundle file | Goes into | CMS object |
| --- | --- | --- |
| `webpage-export.html` | Website application | The related webpage object of this tool's product page (public site) |
| `help.html` | Correct application | The user help object of this tool's app |
| `presentation.html` | Correct application | The presentation (marketing deck) object |
| `updates.html` | Correct application | The update history object |
| `social.html` | Correct application | The social share kit object (one set per SHIP) |
| `code/<ToolName>.html` `.css` `.js` `test-harness.html` | Html tool library | The tool library folder/object of this tool |
| `manifest.json` | - | The exact target per file (object type, object id, field, create vs update) |

## 2. What we need from the CMS team (open questions)

1. **Object types + fields.** For each of the 6 targets above: the exact
   `mainObjectType` name and which FIELD holds the HTML (the website page
   uses the webpage content tool; help/presentation/updates/social are
   expected to be `html-*` or document fields). We also need to know
   whether each is `productData.data_categoriesBased` or a flat field.
2. **Folder convention.** The html tool library stores tools in folders
   (one folder per tool). Which folder id/path does this tool's folder
   map to, and do code files go to the folder as separate objects or as
   one object with html/css/js fields?
3. **Create vs update rules.** Stable ids so a re-SHIP of the same tool
   UPDATES instead of duplicating. We propose: id = tool name slug
   (`personal-tax-preparation`), one object per target per tool.
4. **Versions.** Should each SHIP create a new version object of the
   documents (for rollback), or overwrite? We propose overwrite for docs
   + version stamp inside `updates.html`/`ssot.html`.
5. **API surface.** Options, in our order of preference:
   a. an internal **SHIP Console app** inside the CMS (html-listing-tool)
      that reads the `ship-out/` bundle and calls the existing
      `requestObjects` SDK (no new server work),
   b. a REST import endpoint with a service account token,
   c. manual import UI where the user pastes the bundle files.
6. **Permissions.** A dedicated role (e.g. `app-publisher`) allowed to
   create/update tool-library objects and doc objects, never to delete.
7. **Images.** Screenshots should upload to the CMS media library; the
   doc HTML references `screenshots/<file>` relatively. We need either
   a media upload endpoint or a convention (same folder as the object).

## 3. What is already prepared (no CMS calls)

- `scripts/ship-cms.js` - builds the bundle and the `manifest.json` from
  `ship-cms.config.json`. It NEVER contacts the CMS.
- `ship-cms.config.json` - the mapping template; fill the object types
  and per-tool ids as soon as the CMS team answers the questions above.
- The docs themselves are already the exact content that will go into
  the CMS (webpage export is self-contained; help/presentation/updates/
  social are standalone HTML).

## 4. End-to-end SHIP once the CMS API exists

1. User says **SHIP**.
2. Phases 0-7 run as today (docs + code committed and pushed).
3. Phase 8 builds the bundle and uploads each file to its CMS target
   (create on first SHIP, update afterwards).
4. The report lists every CMS target written and the tool library folder
   touched.

## 5. Non-goals / protection

- The CMS handoff never exposes the source to public pages: the website
  receives only `webpage-export.html` (screenshots + public design
  system). Tool code goes ONLY to the html tool library, which serves
  the sandboxed app behind the CMS's own access control.
