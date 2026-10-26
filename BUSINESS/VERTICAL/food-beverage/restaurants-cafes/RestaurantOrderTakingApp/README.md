# RestaurantOrderTakingApp

Kitchen-facing ACTIVE ORDERS BOARD for the restaurant order application.
It is a CMS html-LISTING tool (type 3, application level) that shows one
live board of today's orders with fast accept / advance actions.

It is the companion of `RestaurantOrderManager` (the per-record order
history/detail view). That tool shows ONE order record in full detail;
THIS tool manages the whole day of orders at once. They read and write
the same CMS order records (`restaurant-orders`).

- Application: `restaurant-order-manager-uniconbaseapps`
- Order object type: `restaurant-orders`
- Folder: `BUSINESS/VERTICAL/food-beverage/restaurants-cafes/RestaurantOrderTakingApp/`
- Build: see `TOOL_BUILD` in `app/RestaurantOrderTakingApp.js`

## Files

| File | Purpose |
| --- | --- |
| `app/RestaurantOrderTakingApp.html` | body markup only, no html/head/style/script tags |
| `app/RestaurantOrderTakingApp.css` | stylesheet rules only |
| `app/RestaurantOrderTakingApp.js` | tool code, entry point `tool.onReady`, no page-load listeners |
| `app/test-harness.html` | standalone harness with a mock `window.tool` SDK |

## What it does

- Loads ALL order records through `tool.requestObjects('query')` and keeps
  the board fresh: auto refresh on a timer (default 20s, param), a manual
  Refresh button, and a 1-second local clock for the waiting-time badges.
- Tabs with live counts: **All / New / In progress / Ready / Finished**.
- Which orders appear ("the day's orders"):
  - every ACTIVE order (new / accepted / in-preparation / ready) regardless
    of when it was placed - a stuck order from yesterday still needs the
    kitchen, and
  - today's FINISHED orders (completed / declined / cancelled), so the board
    doubles as the day's short history. Yesterday's finished orders do not
    appear.
- Sort: Longest waiting first (default), Newest first, Highest total first.
- Search across order number, customer name, phone, table number and address.
- New-order detection: when an order with status `new` appears during a
  refresh, a host toast announces it (param `newOrderNotifications`), and the
  fresh card is highlighted.
- Warning highlight: a `new` order waiting longer than
  `newOrderWarningMinutes` (default 10) gets a red border and clock.
- Order card: channel, live waiting clock, customer / table / address, order
  number, placed time, status badge, estimated ready time (when set), total.
- One-tap status actions per status:
  - `new` -> **Accept** (opens the estimate dialog) or **Decline**
  - `accepted` -> **Start prep** or **Cancel**
  - `in-preparation` -> **Mark ready** or **Cancel**
  - `ready` -> **Complete**
  - Decline/Cancel are DESTRUCTIVE and use a two-step armed confirm
    (`confirm()` is forbidden in the sandbox).
- Accept dialog: quick chips 15/30/45/60/90/120 min + custom minutes,
  a live "ACCEPT (2:58 PM)" button computed from now + the chosen minutes
  ("estimated delivery time" for delivery orders, "estimated ready time"
  otherwise), plus "Accept now" for no estimate.
- Detail view (click any card): full customer/address/payment/zone info,
  timing history, line items with modifiers and instructions, totals,
  internal note, the same actions, Call (tel:) and **Open in CMS**
  (`tool.openObjectDetail`).
- Own value stays LIGHT per listing-tool rules: `{ version, ui: { tab, sort,
  search } }` only. Order lists are never cached in the value.

## How it reads and writes

- READ: `tool.requestObjects('query', { mainObjectType: 'restaurant-orders' })`
  only. Field values are read tolerantly from `productData.data_categoriesBased`
  (or the flat bag / `objectData` / `data`), same bag-scoring reader as
  RestaurantOrderManager.
- WRITE: `tool.requestObjects('update', { mainObjectType, objectId,
  productData: { data_categoriesBased: { ... } } })`.
  - Core patch (required): `status` + `statusChangedAt`.
  - Accept also writes an OPTIONAL second update with `acceptedAt` and
    `estimatedReadyAt`; if that second write fails, the status change still
    stands (the ETA just is not stored). `estimatedReadyAt` therefore needs
    to exist as a field on the order type to persist.
- No direct database, REST or external network calls are made from the
  sandbox.

## CMS configuration required

`settings.allowObjectCRUD: 'yes'` on the html-tool field, plus an
`allowedObjectTypes` entry, for example:

```json
{
  "mainObjectType": "restaurant-orders",
  "role": "editor",
  "scope": "shared",
  "targetCollection": "public"
}
```

Without it the board shows the configuration banner and the error state with
a retry button. `scope: 'shared'` is required so the application-level tool
sees every order of the type, not only one record's instance scope.

## Order field contract

Same order fields as RestaurantOrderManager / the order widget payload:
`orderNumber`, `placedAt`, `channel`, `customer`, `address`,
`customAddressFields`, `tableNumber`, `deliveryZone`, `scheduledFor`,
`paymentMethod`, `paymentDetails`, `lines`, `totals`.

Management fields this tool writes:
`status` (`new`, `accepted`, `in-preparation`, `ready`, `completed`,
`declined`, `cancelled`), `statusChangedAt`.

Optional management fields (recommended additions to the order type so the
kitchen keeps full timing):
`acceptedAt` (timestamp, written when an order is accepted),
`estimatedReadyAt` (timestamp, written when the accept dialog has a time).

## Parameters

| Param | Type | Default | Severity | Purpose |
| --- | --- | --- | --- | --- |
| `allowObjectCRUD` | toggle | `yes` | mandatory | mirrors the field setting that enables requestObjects |
| `allowedObjectTypes` | text | empty | goodToHave | documentation only - the real setting lives in the Field Group Designer |
| `ordersObjectType` | text | `restaurant-orders` | goodToHave | object type that holds the orders |
| `autoRefreshSeconds` | number | `20` | goodToHave | poll interval; `0` turns auto refresh off |
| `newOrderNotifications` | toggle | `yes` | optional | toast when a new order arrives |
| `newOrderWarningMinutes` | number | `10` | optional | highlight new orders waiting longer than this |
| `restaurantTimezone` | text | empty | goodToHave | IANA timezone for displayed times |
| `currencyCode` | text | empty | goodToHave | ISO currency code for totals |

## Test harness

Open `app/test-harness.html` directly. The mock SDK stores order objects in
`localStorage` and simulates `query` / `get` / `update` with a ~30ms delay.

QA query parameters:

- `?sample=1` seed 11 sample orders (mix of channels, statuses, one stuck
  yesterday prep order and one yesterday finished order that must stay hidden)
- `?role=admin|editor|viewer|none` pick the session role
- `?ro=1` read-only mode
- `?nopoll=1` turn auto refresh off; `?fast=1` refresh every 3s
- `?warn=5` override the new-order warning minutes
- `?tz=Europe/Istanbul` `?currency=TRY` timezone / currency overrides
- `?detail=1` auto-open the first order card
- `?accept=1` auto-open the accept dialog for the first new order
- `?inlinejs=1` inject the SAME JS file as an inline script (the exact
  tokenization the CMS uses)
- `?crud=no` simulate missing object access (banner + error state)

## Verification

- `node --check app/RestaurantOrderTakingApp.js` (syntax)
- Node logic smoke + id/HTML cross-check + tokenizer-safety scan helpers live
  in `C:/Users/Admin/AppData/Local/Temp/roa-{smoke,check,embed}.cjs`
  (kept out of the repo, like the other tools).

## Not yet done (follow-up)

- Not registered in `UNICON-TOOLS/tools-catalog` (TOOL_IDEA_MAP,
  REPO_PUBLISH_STATE, all-tools.html) and no `docs/` set - same as its
  sibling RestaurantOrderManager. Run `npm run docs:init` and register the
  catalog entry when the tool ships.
