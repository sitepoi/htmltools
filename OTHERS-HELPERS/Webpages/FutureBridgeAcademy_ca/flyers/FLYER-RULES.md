# Flyer ruleset - one sheet, print-safe

Derived from the work on `volunteers-flyer-onepage.html`. Applies to the main volunteer flyer and to every role flyer in `roles/`.

Read this before editing any flyer. Every rule below exists because something broke without it.

---

## 1. Scope and source of truth

| File | Role |
|---|---|
| `volunteers-flyer-onepage.html` | One-sheet poster (main flyer). Current reference implementation. |
| `volunteers-flyer.html` | Two-page poster. Build source: `build-role-flyers.js` lifts its `<style>` and export script into every role flyer. |
| `roles/role-*.html` | Generated role flyers. Never hand-edit; rebuild. |
| `build-role-flyers.js` | Generator. Run it bare, never through a pipe. |

**Rule 1.1** - A style change that must reach role flyers has to land in the file the builder reads (`volunteers-flyer.html`), or the builder must be repointed. Editing only the one-pager does not propagate.

**Rule 1.2** - If a role flyer is hand-fixed in `roles/`, the next build erases it. Fix the generator or the source CSS instead.

---

## 2. The two sheets

Both formats live in one file, switched by `data-format` on `<html>`.

| Format | Page size | CSS px at 96 dpi | Media box in the PDF | Content budget |
|---|---|---|---|---|
| Desktop | 210 x 297 mm | 794 x 1122.5 | `594.96 x 841.92` | 1122 px hard ceiling |
| Mobile | 105 x 230 mm | 397 x 869 | `298.08 x 652.08` | 869 px hard ceiling |

**Rule 2.1** - `@page` is set from JavaScript, not from a media query:

```js
pageStyle.textContent = isMobile
  ? '@page { size: 105mm 230mm; margin: 0; }'
  : '@page { size: A4; margin: 0; }';
```

**Rule 2.2** - `.page` carries `page-break-after: auto` in print, otherwise Chrome adds a trailing blank sheet after the last page.

**Rule 2.3** - Budget first, cut second. Measure the sheet, then decide what to drop. Never let content spill and hope the viewer clips it nicely.

---

## 3. Print rules that cannot be skipped

**Rule 3.1 - Never rely on a translucent gradient over a photo.**
WhatsApp Web and Google Docs preview do not paint the alpha-gradient stack Chrome writes for a CSS overlay; the copy ends up sitting on the bare photo. In `@media print`, drop the wash and darken the bitmap instead:

```css
@media print {
  .hero-wash  { display: none !important; }
  .hero-photo { filter: brightness(0.38) saturate(0.9) contrast(1.08); }
}
```

Check: the PDF should contain one rasterised hero image and no shading patterns for it.

**Rule 3.2 - No shadows in print.** `*, *::before, *::after { box-shadow: none !important; }` - mobile PDF viewers paint a blurred shadow as a solid grey box.

**Rule 3.3 - `overflow: hidden` on `.page` hides overflow silently.** It does not warn you. A clipping bug looks like a design decision. Always render at exact size (section 8).

**Rule 3.4 - Do not hand-tune `min-height: calc(230mm - NNNpx)`.** Those magic constants break the moment a font or a line changes. Use a flex column with one growing block:

```css
html[data-format="mobile"] .page {
  display: flex; flex-direction: column;
  height: auto; overflow: visible;
  min-height: 229.8mm;          /* full sheet minus a hair, so rounding cannot spill */
}
html[data-format="mobile"] .page > .foot-one { flex: 1 0 auto; align-content: space-between; }
html[data-format="mobile"] .foot-one { margin-top: 0; }   /* so the slack goes to the footer, not a margin */
```

Result: the dark footer bar always ends exactly at the paper edge, in any viewer's text metrics. This is the fix for "white strip under the footer".

**Rule 3.5** - Full-bleed for the narrow sheet: `.flyer { display: block; width: 100%; max-width: none; padding: 0; }`, `.page { width: 100%; }`. Any inset leaves a white sliver on the right edge.

---

## 4. Hero

**Rule 4.1 - Order is fixed:** label pill -> two-line headline -> short lede -> one primary button -> optional corner ribbon.

| Element | Desktop | Mobile |
|---|---|---|
| Label pill | 11 px, uppercase, `letter-spacing .16em`, white bg, navy text, orange dot | 10.5 px |
| Headline line 1 | 34-36 px, white | 26 px |
| Headline line 2 | same size, gold `#FFD23F` | 26 px |
| Lede | 14 px, max 42-44ch, 1-2 lines | 13 px |
| Primary button | gold bg, navy text, 15 px, radius 12 | 15 px, full width row |
| Secondary button | ghost outline | hidden (the roles list follows) |

**Rule 4.2 - The headline answers three questions in this order:** what this is, what you do, what you get. Example: `Help students in many ways.` / `Earn volunteer hours + certificate.`

**Rule 4.3 - One colour means one action.** The label pill is white, never gold. Gold is reserved for the apply button and the benefit line. Two gold buttons make the reader guess.

**Rule 4.4 - Keep the word "volunteer" in the first screen** - in the pill, not buried in body copy.

**Rule 4.5 - Do not promise a schedule the programme does not have.** "One hour a week" in the top bar reads as a contract; the roles are flexible. Use a mood line instead ("Be the change").

**Rule 4.6 - Photo brief:** students in the grade 6-12 range, faces lit and legible, subject in the right half, serviceable dark area on the left for the copy. Grade-appropriate faces matter: primary-school children misrepresent a secondary programme.

**Rule 4.7 - `object-position` X does nothing when the photo is wider than the band** (cover then fills the width exactly and only crops vertically). To move the subject right, widen the image and anchor it left:

```css
.hero-photo { position: absolute; top: 0; left: 0; width: 110%; height: 100%; object-fit: cover; object-position: 50% 38%; }
```

**Rule 4.8** - The corner ribbon overlaps faces easily. Shrink it, or drop it on the narrow sheet (`.ribbon { display: none; }`) - the "Open now" tape below already carries the message.

---

## 5. Default block order

Desktop sheet (top to bottom):

1. Brand bar - white logo, right tag
2. Hero - photo, pill, headline, lede, CTA, ribbon
3. Colour slash
4. Roles list - tape label, `Ten roles. Pick one.`, rows, footer line
5. Reasons - three medallions
6. Ticket - "Apply in 3 minutes"
7. Footer - FBVN lockup, copyright, contact, apply button

Phone sheet: same order minus the reasons band and minus the ticket (the footer carries the apply action). Those two blocks are the designated sacrifice - cut them first, never the roles list or the hero.

---

## 6. The roles list

**Rule 6.1** - One row per role: `[number] name [time pill] [arrow]`.

**Rule 6.2** - Two columns on A4, one column on mobile, and the time pill stays visible on both - it is the single most consulted fact.

**Rule 6.3** - The arrow (`a.role::after { content: "\2192"; }`) signals "there is a job description behind this". Drop it on mobile only to save width.

**Rule 6.4** - Number badges cycle three gradients so the list does not read as a table: orange-gold, navy-blue, teal-green.

**Rule 6.5** - Highlight the roles needed most with a cream background plus an inset gold bar, and say so in the tape label.

**Rule 6.6** - Close the list with one line that answers "how much time": *Most roles start at one hour a week. Open anywhere in Canada - every role has a job description online.*

---

## 7. Type, colour, footer

**Rule 7.1** - Brand tokens only: `#FF6B35` primary, `#004E89` secondary, `#FFD23F` accent, `#06D6A0` teal, navy `#00365F` deep.

**Rule 7.2** - Footer is a single dark bar: `FBVN / FUTURE BRIDGE VOLUNTEER NETWORK` lockup, copyright, contact mail, apply button. On mobile it becomes a two-row grid (lockup + apply, then the contact lines).

**Rule 7.3** - The footer is the last block and the one that absorbs leftover height (Rule 3.4). Never put decorative content below it.

**Rule 7.4** - The contact mail is one unbreakable token, so the meta column needs `flex: 1 1 200px; min-width: 0` and `overflow-wrap: anywhere` on its lines. Without it the address runs under the apply pill on the A4 bar and is silently cut at the sheet edge.

---

## 8. Quality gate - run before every hand-off

1. **Page count and size**

```
msedge --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf=out.pdf "file:///...?format=mobile"
grep -a -o "/Count [0-9]*" out.pdf
grep -a -o "/MediaBox \[[^]]*\]" out.pdf
```

Expected: desktop `Count 1`, box `594.96 x 841.92`; mobile `Count 1`, box `298.08 x 652.08`.

2. **No clipping** - flatten the print CSS into normal CSS, open it at exactly `794x1123` (desktop) and inside a `397x869` iframe with `scrolling="no"` (mobile), screenshot, and look at the bottom edge. The footer must touch the paper edge.

3. **Text metrics caveat** - an iframe with a visible scrollbar is ~15 px narrower than the printed sheet; measurements taken there lie. Always `scrolling="no"`.

4. **Node caveat** - helper scripts must run bare. Piping or redirecting stdout aborts them with `stdout is not a tty`.

5. **Viewer check** - open the exported PDF where it will actually be viewed (WhatsApp Web, phone mail) before calling it done. That is how the missing hero wash was found.

---

## 9. Role flyer blueprint

One role per flyer, **one sheet per format** - the same decision the one-page volunteer poster forced. A second sheet is only worth it if it adds a fact the first one cannot carry; repeating the apply action is not such a fact.

| Slot | Content | Constraint |
|---|---|---|
| Brand bar | logo + `Volunteer role` | fixed |
| Hero pill | `Volunteer role` (gold kicker is acceptable here) | fixed |
| Headline | role name | 40 px desktop, 26 px mobile, one line if possible |
| Lede | what the volunteer actually does, one sentence | max 34 words |
| Hours | `Hours agreed with the programme lead` chip | must match the roles list |
| Buttons | `Apply for this role` (gold) + `Full role details` (ghost) | ghost hidden on mobile |
| Ribbon | `Open now` | hidden on mobile |
| Block 1 | **What you would actually do** - three items, one verb each | 3 items, not 4 |
| Block 2 | **You would be good at this if** - two bullets | 2 items |
| Block 3 | **What you leave with** - 4 compact cards, small uppercase label | label is one line; no display heading |
| Closing bar | `foot-one`: FBVN lockup, copyright + contact, gold `Apply online` | last block, dark, flush with the paper edge |

**Rule 9.1** - Every role flyer must carry the same four proof items as the main flyer. Consistency across the set is the point of a set.

**Rule 9.2** - The hours chip on the flyer and the time pill in the main flyer's list must say the same thing. One source (`ROLES` in the builder), never two.

**Rule 9.3** - Role copy is task-shaped, not quality-shaped. "Set the tasks so finished is obvious" beats "be a great mentor".

**Rule 9.4** - Apply Rules 3.1, 3.4 and 4.7 to role flyers too. They were learned on the main flyer but the same viewers open the role PDFs.

**Rule 9.5** - After any build, run the section 8 gate on at least one desktop role flyer and one mobile role flyer, plus `roles/index.html` for broken links.

**Rule 9.6 - blocks that did not earn a place on the second sheet** (all removed; do not bring them back without a new argument):

| Removed block | Why it went |
|---|---|
| Second brand bar on sheet 2 | page furniture, not information |
| `Apply in 3 minutes` ticket | repeated the hero button 300 px later |
| Five-step `How to join` strip | process detail, not a reason to apply; lives on the website |
| Giant gold `Apply for <role>` block | third copy of the same action |
| Display heading `Proof you can hand to anyone.` | proof cards read fine under one small label |

**Rule 9.7 - the sheet must be measured, not eyeballed.** Desktop: `.page { display:flex; flex-direction:column; justify-content:space-between }` so leftover height becomes even gaps instead of one white hole above the footer. Mobile: `min-height: 229mm` on `.page` with the closing bar last, so the bar sits on the paper edge.

**Rule 9.8 - audit forced page breaks after merging sheets.** A leftover `page-break-before: always` on a block that used to open sheet 2 keeps producing a second page even when the content fits. Grep the print block for `break-before` / `page-break-before` and reset every block to `auto` before blaming the height.

**Rule 9.9 - phone sheet height budget** (397 x 869 px, measured on the built set): brand bar 50, hero 242-267 (267 when the role name needs two lines), slash 19, what-you-do 230, who-fits 64-84 (84 when the two bullets do not share a row), proof 158, closing bar 79 = 838-863. Spare height 6-31 px. When a block is added, something of equal height leaves first.

**Rule 9.10 - verify the whole set, not one flyer.** The builder writes all ten files at once, but copy length differs per role, so page count and spare height must be measured for every file in both formats before the set is called done.

---

## 10. Change checklist

Before shipping a flyer edit:

- [ ] Both formats still export as exactly one page, correct media box
- [ ] No `page-break-before: always` / `break-before: page` left over from an older multi-sheet layout
- [ ] Footer touches the bottom edge on the narrow sheet
- [ ] Nothing clipped at the bottom of the desktop sheet, no white hole above the footer
- [ ] Hero readable in a strict PDF viewer (no reliance on alpha gradients)
- [ ] Pill white, gold reserved for the action
- [ ] Photo subject right of the copy, age-appropriate
- [ ] Every block on the sheet answers "what would I do" or "what do I get"; nothing merely repeats the apply button
- [ ] Time facts identical across flyer, list and website
- [ ] If shared CSS changed: role flyers rebuilt and spot-checked
