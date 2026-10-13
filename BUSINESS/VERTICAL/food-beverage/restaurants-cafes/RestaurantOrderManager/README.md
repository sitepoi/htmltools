# RestaurantOrderManager

Manager-facing detail view of ONE restaurant order record. It is a CMS
html-tool (type 1, object-level interface) that runs inside the sandboxed
CMS iframe with the `window.tool` postMessage SDK.

- Application: `restaurant-order-manager-uniconbaseapps`
- Order object type: `restaurant-orders`
- Folder in the repo hierarchy: `BUSINESS/VERTICAL/food-beverage/restaurants-cafes/RestaurantOrderManager/`
  (taxonomy code `B-V-02-a`, "Restaurants & Cafes")
- Build: see `TOOL_BUILD` in `app/RestaurantOrderManager.js`

## Files

| File | Purpose |
| --- | --- |
| `app/RestaurantOrderManager.html` | body markup only, no html/head/style/script tags |
| `app/RestaurantOrderManager.css` | stylesheet rules only |
| `app/RestaurantOrderManager.js` | tool code, entry point `tool.onReady`, no page-load listeners |
| `app/test-harness.html` | standalone harness with a mock `window.tool` SDK |

## How it reads and writes

- Reads the opened order record through the CMS tool SDK only:
  the `onReady` second argument, `tool.getFields()` and `tool.onFieldsChange()`.
  It accepts the sibling field values as flat keys, or nested under
  `productData.data_categoriesBased` / `objectData.data_categoriesBased` / `data`.
- Writes status changes through the CMS-native field editing API:
  `tool.setFields()` (preferred) or `tool.setField()`, followed by
  `tool.requestSave()` when the host enables it.
- Optional fallback (off by default, `allowObjectWriteFallback = yes`):
  `tool.requestObjects('update', ...)` when the field editor is unavailable.
- No direct database, REST or external network calls are made from the sandbox.

## Type uses (declare these in the consuming app config)

| cmsObjectType | Intent | Notes |
| --- | --- | --- |
| `restaurant-orders` | read | the parent record this tool is placed on |
| `restaurant-orders` | update | writes `status`, `statusChangedAt`, `internalNote` (only when the fallback param is enabled) |

The primary write path (`tool.setField` / `tool.setFields`) needs no
`allowedObjectTypes` entry. Only the optional fallback needs
`settings.allowObjectCRUD: 'yes'` plus an
`allowedObjectTypes` entry for `restaurant-orders` (role `editor`).

## Required CMS configuration (owned by the order application, not by this tool)

1. Operation `create-order` on `restaurant-orders`:
   - `operationId`: `create-order`
   - permission: anonymous callers allowed (`roles: []`) because visitors order without login
   - `transaction: true`
   - one write: `targetType: restaurant-orders`, `mode: create`, mapping the widget payload fields into the order record fields
2. Default value of the order `status` field: `new`.

This tool does not create orders and does not call that operation. It only
displays and advances an existing order.

## Order field contract (same names as the widget payload)

`orderNumber`, `placedAt`, `channel`, `customer`, `address`,
`customAddressFields`, `tableNumber`, `deliveryZone`, `scheduledFor`,
`paymentMethod`, `paymentDetails`, `lines`, `totals`

Management fields:
`status` (`new`, `accepted`, `in-preparation`, `ready`, `completed`, `declined`, `cancelled`, default `new`),
`statusChangedAt`, `internalNote`

## Parameters

| Param | Type | Default | Severity | Purpose |
| --- | --- | --- | --- | --- |
| `newOrderWarningMinutes` | number | `10` | goodToHave | warning banner when an order stays `new` longer than this |
| `restaurantTimezone` | text | empty | goodToHave | IANA timezone for displayed times |
| `currencyCode` | text | empty | goodToHave | ISO currency code for money formatting |
| `ordersObjectType` | text | `restaurant-orders` | optional | type used by the write fallback |
| `allowObjectWriteFallback` | toggle | `no` | optional | allow the requestObjects write fallback |

## Test harness

Open `app/test-harness.html` directly. The mock SDK stores the order record in
`localStorage` and simulates `setField` / `setFields`, roles and read-only mode.

QA query parameters:

- `?sample=1` seed a sample order
- `?role=admin|editor|viewer|none` pick the session role
- `?ro=1` read-only mode
- `?warn=5` override the new-order warning minutes
- `?tz=Europe/Istanbul` `?currency=TRY` override the timezone and currency
- `?auto=apply` click the primary status button shortly after boot
- `?auto=note` type a note and save it
- `?measure=1` write viewport and ticket widths into the document title

## Privacy

Customer card data is never displayed. If `paymentDetails.card` exists, only
the brand, the last 4 digits and the expiry are shown. The full number and the
CVC are ignored.
