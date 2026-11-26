# Changelog — co-op fork of `opencourier-request-web`

This fork adapts [Princeton-HCI/opencourier-request-web](https://github.com/Princeton-HCI/opencourier-request-web)
for a Greek workers' cooperative. In this fork, request-web is the **restaurant portal**,
where a signed-in restaurant places delivery requests.

Everything below sits on top of upstream `main` on the branch `fix/partial-address-form`
(63 commits, 26 July to 2 November 2026). Each entry names its commit, and the commit message
has the full reasoning and verification notes.

---
Scope row 172 (a single order left taken but not accepted is completed or given back) needed only the server's new sentences here, copied word for word on the branch `fix/claimed-single-swept` and merged in on 26 November: `ACCEPTED_ALONE_BY_SWEEP`, `ACCEPT_GIVEN_BACK` and its reasons (`enum.acceptGivenBackReason`), in English and Greek. Row 163's test compares them with the backend's.

Scope row 169 (the portal's edit keeps the tip as it is) was built on the branch `fix/edit-keeps-tip` and merged in on 25 November, in the unattended run, after its backend half. The Edit dialog has no tip box, yet every save sent `tipByCustomer: 0`, so an order whose tip the restaurant's own system had set through the API lost it on any portal edit made before a rider held the order. The tip is rider pay. The edit now leaves the tip out, and the server keeps a left out tip as it is (decision 169.1; `db52d6d`, rebased as `ce68bcd`). Tests by agy (`9f63b93`, 1305 pass: the real update hook's body has no tip key; sending 0 or null fails them). Checked on dev: an API tip of 300 cents survived a notes only save in the portal, with no second `TIP_CHANGED` line.

Scope row 163 (every copied server sentence is checked against the backend) is tests only, written by agy on the branch `test/server-copies-checked` and merged in on 25 November. `src/i18n/translationsParity.test.ts` loads the backend's `en.ts`, `el.ts` and `event-messages.ts` from the sibling folder and compares every server group, English and Greek, and the event codes, both ways and word for word, so a copy that drifts from the backend fails the suite (`fbc04ca`, follow up `7fd4122`). The two copies' headers now name the test (`a462e2f`). It compares with whatever the backend folder has checked out. With no backend folder beside the repo it skips with a warning; `REQUIRE_BACKEND=1` turns that into a failure; a backend with a file missing fails, naming it. 1296 pass; every put back repeated by hand; reviewed by Fable.

Scope row 168 (the portal's edit keeps the order's times as they are) was built on the branch `fix/edit-keeps-times` and merged in on 25 November, in the unattended run, with its backend half. The Edit dialog cut each stored time to the minute and read it back as browser time, so every save moved the times by Athens's offset, and it invented a deadline (now plus one hour) where none was set. Now the boxes show the stored times in browser time, a box the restaurant leaves alone is left out of the request (the server keeps the time; decision 168.2), a changed box sends its time, a cleared one sends no time, and a half typed time refuses the save ("A time is not finished. Complete it or clear it." / its Greek). The ready time is never sent (`4826925`, `fa0a10f`). Tests by agy (`e93ec30`, `b30fae0` and after, 1271 pass; Athens zone pinned; put backs by hand); a notes only save on dev left every time unchanged to the second.

Scope row 165 (after a refused edit, the portal shows the order as it is now) was built on the branch `fix/edit-refusal-reload` and merged in on 25 November, in the unattended run. When the server refused a restaurant's edit, the Edit dialog showed the message but kept the restaurant's own values, so a second save sent the same stale edit. The dialog moved to `src/modules/edit/EditDeliveryDialog.tsx` (no test may sit under `src/pages`). On one of the three edit refusals (`PARTNER_EDIT_ORDER_ENDED`, `PARTNER_EDIT_POINT_HELD`, `PARTNER_EDIT_CHANGED`) it reads the order again, fills every box from it and says "The boxes now show the order as it is." / "Τα πεδία δείχνουν τώρα την παραγγελία όπως είναι."; the next save sends the order's current id, point and ready time; Save waits for the reread; any other failure keeps the typed values (`b0c8d8d`, review fix `8afbb8f`). The orders list is read again when the dialog closes. Tests by agy (`9ac0267`, `a350943`, 1249 pass; nine put backs by hand), checked on dev in both languages, reviewed by Fable. The dialog has no tip or drop off point box, so those are not shown.

Scope row 161 (the partner edit's status check is a conditional write) needed only the server's new refusal here: `PARTNER_EDIT_CHANGED`, "This order just changed. Look again before you save.", is copied word for word in English and Greek (`41af3a8`, merged in on 25 November), so the edit dialog can show it in the restaurant's language. Compared with the backend's by script; translation tests pass (73).

Scope row 160 (a restaurant's tip change is on the record) needed only the server's new sentence here: `TIP_CHANGED_BY_RESTAURANT` is copied word for word in English and Greek, together with rows 146 and 149's `ADD_ON_JOINED` and `ADD_ON_LEFT`, which this copy had missed, so both files match the backend's again (`53ac454`, merged in on 25 November). The portal shows no event lines yet; the copy keeps the files equal. Suite: 1232 pass.

Scope rows 151, 152 and 153, built in the unattended run of 24 November and merged in that night:
- **Failures the server never answered show the page's own sentence (row 151).** No connection, an error answer with no words in it, the proxy's 502 and the backend's catch all 500 now get the code `NO_ANSWER`, and every page shows its own sentence in the restaurant's language instead of "Request failed (HTTP 500)" or "Backend unreachable." (`ed11323`, review fix `e87dcd0`).
- **A restaurant resets its own password by email (row 153).** "Forgot your password?" on the sign in card asks for a code by email, then takes the 6 digit code and a new password, checked on the page first, then says to sign in again, and when the API key was switched off, to ask the co-op for a new one. Two server routes forward the calls to the backend, so the browser talks only to its own origin; no cookie is set. Run end to end on dev through Mailpit (`34da3f9`, review fix `deab9b8`).
- Tests for both by agy (`2f4106b`). Row 152's two partner edit refusals are copied word for word into the server template files (`b98411e`).
Each row was reviewed by Fable; the findings that held were fixed.

Scope row 140 (the drop off business name in offers) was built on the branch `fix/business-name-not-customer` and merged in on 24 November, with its backend half. When a restaurant left the business field empty, this app used to send the customer's name as the drop off business name, and riders' offers carried it before they accepted. Now an order sends only a business name the restaurant typed (trimmed), else an empty one; a new leg from the Retry carries only the source order's own business name, and never an older order's copied customer name. The order page falls back to the customer's name with `||`, so an empty business name never shows a blank heading (`d4e101a`, review nits `3151759`; tests by agy, `54a9850`). Reviewed by Fable; the findings that held were fixed.

Scope row 128 (auto accept takes stacked pairs) needed only the server's new event wording here: `ACCEPTED_TOGETHER_AUTOMATICALLY` is copied word for word in English and Greek, and the unused `STACK_NOT_AUTOMATIC` is deleted (`97632b5`, merged 23 November).

Scope row 133 (request-web's last lint warnings) was built on the branch `chore/lint-leftovers` and merged in on 23 November. The ready controls' effect now names the three ready fields it follows, so lint has no hook warning left; it still runs at the same moments and keeps a tap's answer until the page's copy changes. The lint limit drops to 2 warnings (the two logo images), and `@tanstack/react-table`, unused since row 129, is removed (`ba57789`, review fix `eae3705`; tests by agy, `384e5d1`). Reviewed by Fable; the findings that held were fixed.

Scope row 129 (lint and a hard coded text check) was built on the branch `chore/request-web-lint` and merged in on 23 November. request-web had no ESLint at all; now `yarn lint` runs Next's `next/core-web-vitals` set plus `i18next/no-literal-string`, so a sentence written between JSX tags fails lint (and `next build`) and belongs in the i18n files instead; tests are exempt. Its first run found 43 hard coded texts, all in upstream components and Storybook stories nothing imports, which were deleted. Three hooks that left out `t` now take it, so a message worded after a language switch follows the new language; the warning baseline is 3 (`689b23f`, review fixes `e0be78d`; guard test by agy, `4ad029d`). Reviewed by Fable; the findings that held were fixed.


## Security

### Partner credential moved out of the browser (Unit 3b) — `202f7ba`
- **Before:** a partner API key was compiled into the browser bundle through
  `NEXT_PUBLIC_MANUAL_REQUEST_API_KEY` and kept in `localStorage`. Anyone with devtools
  could copy it and submit deliveries as that restaurant.
- **After:** the browser never holds a credential.
  - Next.js route handlers under `src/pages/api/partner-auth/` handle login, session and
    logout, and set an **httpOnly** `oc_partner_session` cookie.
  - `src/pages/api/partner-proxy/[...path].ts` attaches the bearer token on the server.
  - The browser only ever talks to its own origin. The `/backend-api` rewrite is deleted.
- The API-key path was removed outright, not kept as a fallback. The "Sign Up" button went
  too, since the backend endpoint was removed (backend `ed3b762`).
- ⚠ The old key is still in this repo's upstream history, and `local.env` still carries
  upstream's Google Maps key. **Both need rotating**; deleting the lines doesn't undo the
  leak.

### Session cookie lifetime — `8859acf`
- The cookie's `Max-Age` was about 100 years for a token that lasts 36.5 days. The
  backend's `expiresIn` is in milliseconds, but `Max-Age` is in seconds. The value is now
  converted and floored so the cookie can never outlive its token.

## Added

On 2 November rows 29, 32, 31 and 28 were merged in. The GA rows (29 and 32) have the entries
below; rows 31 and 28 are recorded in the workspace's scope and walkthroughs.

### Greek interface (scope row 47, spec 0054, Beta) and its loose ends (scope row 124)
Built on `feat/greek-interface` and `fix/greek-loose-ends` and merged on 23 November, with the backend, adminweb and
courier app halves.
- The portal is in Greek by default with English available: i18next 25 and react-i18next 15, the language kept in the
  `oc_lang` cookie and read on the server, so the first render is already in it (a broken cookie reads as Greek), and a
  ΕΛ / EN switch in the header and on the sign in. `<html lang>` and the map's zoom tooltips follow it. `7fa4245` to
  `2e7d331`, `61a8363`, `df5d69e`
- Every word on the order form, the order page, the history, legs and cancel dialogs, saved customers, availability, the
  record, ready times, complaints, product reports and chat moved into `el` and `en` files. Dates and times in Athens
  time and the 24 hour clock in both languages, money `1.234,56 €` or `€1,234.56`, km and minutes with the language's
  decimal mark, so the wait record reads "0,3 λεπτά" (`2362ad6`). The order page shows a Greek address in Greek order;
  a typed address is sent exactly as before (`cf270ea`).
- Signed in, the switch also saves to the restaurant's account (`PUT partner/v1/auth/language`, through the partner
  proxy), and sign in follows the account's language, as admin does. `47bf80d`, `452d77f`
- Row 124: server refusals (with their numbers and times), the dispatch stop banner and the not accepting line read in
  the restaurant's language, from a copy of the backend's templates (`serverEn.ts`, `serverEl.ts`) and adminweb's
  renderer. An error with no code keeps its own message as before, a timeout reads the portal's own sentence in either
  language, and a sentence that cannot be worded falls back to the server's English instead of breaking the page.
  `6ca0033`, `e96abcb`, `24e61e1`
- Review fixes: the red cancel button reads Ακύρωση, messages kept on screen are translated when shown, "στη 01:05" at
  one o'clock and "στις" otherwise. `b30df78`, `c2b44fe`, `bfb67c8`; tests by agy, `75a364a`, `4c4aac4`, `8aba6c7`,
  `d78a8f1`, `158bdaf`. Reviewed by Fable (row 47) and a fresh Opus session (row 124).
- Still open: the three copies of the server's templates (backend, adminweb, here) are not checked against each other,
  other uncoded failures ("Backend unreachable.") still show developer English, and the Greek waits for a Greek
  speaking member's check before go live (scope row 127).

### Fixes from the cross family review of rows 79, 10 and 11
The cross family review (agy, `/crosscheck review`) that rows 79, 10 and 11 owed was given on 22 November;
its fixes were built on `fix/agy-owed-reviews` and merged the same day. Rows 79 and 11 needed no change here.
- Row 10: on an order page, "+ minutes" sent each other leg the ready time the page last read, so a
  second tap before the page read the legs again sent an old time, and the legs' times drifted apart
  (a leg rider who came early waited, charged to the restaurant). The controls now keep each leg's
  answer and send it while the page still shows the time it showed at that tap; on a leg's page the
  ready buttons wait until the order's legs were read once (a line says so meanwhile). `4a7dfbf`
- Row 10: the order page reads the other legs again every 30 s while the tab is visible, so another
  leg's new status and rider show without a reload. `8212a02`
- Row 10: an order card in the history with a leg missing from its list (on another page of it, or
  never sent) no longer offers Cancel all or the ready buttons, which acted on the legs shown only and
  left a live leg to be dispatched; it links to the order page, which reads every leg. `43c44f7`;
  tests by agy, `d3d38e3`.

### Complaints about a rider (scope row 83, spec 0052, Beta)
Built on `feat/complaints` and merged on 22 November, with the backend, adminweb and courier app halves.
- A delivered or cancelled order's page has a complaint section under Courier: the restaurant files a
  complaint about the order's rider (a category from pills and a few lines, text only), sees each of its
  complaints with its status and, once decided or withdrawn, the outcome. The rider's reply is never
  shown to the restaurant, and the file button hides while one of its complaints on the order is open.
- Refusals show the server's own sentence and other failures the section's (`restaurantErrorText`, now
  shared with the order page); after a failed send the list is read again, since the complaint may have
  been stored. `fce45db`, `4716b3c`, review fixes `9d58701`, `312869d`; tests by agy, `a8fb3e7`, `cfca04c`.

### Split at pickup (scope row 11, spec 0047, GA)
- A rider who finds an order does not fit one box asks dispatch to split it at the restaurant. The
  order then says "Split at pickup, now in 2 deliveries" (on its page under "Leg 1 of 2", on the
  history's order card), and an order the rider had to leave unsplit says "Cancelled: didn't fit one
  box, send it again with the right sizes", on its own row and on its leg's line in an order card.
  The wording lives in one function, `splitOutcomeLine`. The charge a split brings shows on the
  admin statement, not here. `6393b56`, review fixes `ef59186`; tests by a Fable subagent while agy
  was out of quota, `64ce36f`, `4232e37`. Owes a cross family review once agy is back.
- What a split costs the restaurant (operator, decision 11.10): one line under the split line says
  each extra box a rider takes is charged at its rider's pay (and the split wait when the co-op pays
  waits) on the co-op's statement, the customer paying nothing more; a leg the split made says why it
  has no cost, and once ended states the rule (nothing charged if no rider had accepted it).
  `splitChargeNote`. `881c6a7`, review fixes `5aca1a8`; tests by a Fable subagent, `ca70d0b`.

### Multi leg orders (scope row 10, spec 0046, GA)
- The order form asks "How many boxes?" (1 to 4) and a size for each box. Above one box it asks a
  price per box, shows the order total large with "2 deliveries × 3,56 € = 7,12 €" (a line per leg
  when the prices differ), and sends the boxes as separate deliveries ("legs"), leg 1 first, sharing
  the first quote's id as the order reference; the order total goes on leg 1 only. Each leg has its
  own rider and its own full pay. `785548a`
- A leg that could not be sent stops the sending with the backend's reason; the order page lists every
  leg with its status and rider, says which was never sent, and offers its size, a fresh price and
  Retry (not once the rest of the order was cancelled). Cancel all asks once who wanted it and cancels
  each leg through the usual cancellation. The history shows an order's legs in one card. Food ready and
  "+ minutes" apply to every open leg. Review fixes `0d13d59`; tests by a Fable subagent while agy was
  out of quota (`6565f6f`, `19bcf3d`). Owes a cross family review once agy is back.

### Box size on the order form (scope row 9, spec 0043, GA)
- The order form's size row is now "Box size": nothing is chosen when it opens, Get price
  refuses with "Choose the box size" until the restaurant picks Small, Medium or Large, and a
  line under the pills says what each means. The size goes to the backend as `boxSize` with
  the delivery, never with the price request. `4ec676a`
- Review blocker, fixed before merge: `mapDeliveryInputForPartner` rebuilds the partner body
  field by field and dropped `boxSize`, so every order would have arrived as an assumed Medium.
  Checked live by sending a Large order from the form. `0bdaaeb` (tests by agy `ce0085c`, `03b9552`)

### Message Dispatch (scope row 111, spec 0034)
Built on `feat/chat` and merged on 18 November, with the backend, adminweb and courier app halves.
- A Message Dispatch button in the signed in header opens a side sheet with the restaurant's one conversation with the co-op's dispatch, through the app's own proxy: the browser holds no credential.
- It asks every 5 s while open and every 30 s while closed, only in a visible tab. A dot says dispatch wrote something new, worked out in this browser for each restaurant.
- Dispatch shows as "Dispatch"; the restaurant's own messages say "read" once dispatch opened them. A message not sent stays, even with the sheet closed, with "Not sent, tap to retry" and the backend's reason when it was refused. Older messages show their date, and a tagged message its order code.
- 735 tests pass; put backs by hand. Reviewed by Fable; every finding ruled and fixed. Decisions 111.4, 111.10, 111.14, 111.15.

### Report a product (scope row 15, spec 0032)
Built on `feat/product-reports` and merged on 9 November, with the backend, adminweb and courier app halves.
- A delivered order's page has Report a product: wrong or missing, the item or something else, and a note.
- 683 tests pass; put backs by hand. Reviewed by Fable.

### Your record (scope row 25, spec 0030): `cfd0a5d` to `390ee2a`
Built on `feat/wait-record` and merged on 9 November, with the backend and adminweb halves.
- My Orders shows the restaurant's own record over 7, 30 or 90 days. The figures name no rider.
- 653 tests pass; put backs by hand. Reviewed by Fable.

### Busy mode and pause (scope row 34, spec 0029): `a8d8b33` to `ac15a88`
Built on the branch `feat/busy-pause` and merged on 9 November, with the backend and adminweb halves.
- **A strip on New Delivery and My Orders.** Busy +5 to +30, Pause for 15 minutes to 2 hours, Stop busy and Resume.
- **While paused or disabled** the form asks for no price and says why, in the server's words. While busy, it says how many minutes the order gains.
- 636 tests pass; put backs by hand. Reviewed by Fable and agy.

### Ready times the restaurant keeps true (scope row 21, spec 0023): `0ca9c07` to `e2cb60e`
Built on the branch `feat/ready-signals` and merged on 9 November, with the backend, adminweb and courier app halves.
- **The order form.** "Ready in" starts on the restaurant's usual prep time.
- **My Orders and the order page.** The ready line with +5, +10, +15 and Food ready until pickup.
- The edit dialog no longer moves the ready time. 596 tests pass; put backs by hand. Reviewed by Fable and agy.

### Optional item lines, each markable as a drink or a side (scope row 103, spec 0028): `ec009aa` to `232985b`
Built on the branch `feat/item-kinds` and merged on 3 November, with the backend and courier app halves.
- **The form.** A collapsed "Add items (optional)" between Size and Order total: a name, a quantity stepper,
  and Drink and Side toggles. With no lines the order sends today's single Package item byte for byte.
- **The price.** Items never drop a price. Send reads them live and checks them without waiting, so the
  second Send guard holds.
- **The order page.** It shows each item's mark.
- Tests by a fresh Claude subagent while agy was out of quota: 519 pass; put back by hand. Reviewed by Fable
  (the label fix in `232985b`).

### "Pin moved by a rider" on a saved customer (scope row 99, from spec 0016): `ab9b33d`, `eeb88ea`
Built on the branch `feat/pin-corrections-shown` and merged on 3 November, with the backend half.
- When a rider at the door moved a saved customer's pin, the Customers page card says "Pin moved by a
  rider on 03/11/2026, 14:32" (Athens time). The mark stays until the restaurant edits the customer to a
  different point; an order never clears it (decision 99.1).
- 5 tests by a fresh Claude subagent while agy was out of quota (462 pass); put back by hand. Reviewed by Fable.

### Cancel asks first, and asks who wants it (scope row 32, spec 0015): `1ce1a4f`, `3059a66`
Needs the backend's row 32.
- Both Cancel buttons open a dialog first: "We need to cancel it" or "The customer asked to
  cancel". Before this, one tap cancelled. The restaurant is charged for its own cancellations,
  and the rider who was on the job is paid by the co-op's rule.
- Tests by agy (`3059a66`): 383 pass; every put the bug back check repeated by hand.

### Dispatch stop banner on the order page (scope row 29, spec 0014): `72782f2` to `ff950bc`
Needs the backend's row 29.
- "No delivery right now" with the backend's sentence while a stop is on, and "Delivery stops
  soon" when one starts within 12 hours. It is read through the partner proxy when the page opens
  and every minute while the tab is visible. If the read fails it shows nothing; a quote is
  refused with the same sentence anyway.
- Tests by agy (`132b6fd`): 365 pass; every put the bug back check repeated by hand.

### Touch friendly order form (scope row 27, spec 0006): `78ffec0` to `d0157ea`
Built on the branch `feat/touch-friendly-order-form` and merged on 27 October. The New Delivery page is
rebuilt for a phone or tablet held in one hand. A repeat order is now: pick the customer, tap when it is
ready, type the total, Get price, Send order.
- **One short column** at phone width, one centered column from 768 px. Every control is at least 48 px
  and every text input uses 16 px text, so phones do not zoom in. The fields the co-op does not use are
  gone (state, ZIP, country, business name, package type and description, special instructions, pickup
  notes, the deadlines); the pickup is one "From:" line from the restaurant's profile.
- **Ready in** is a row of pills (Now, 10, 15, 20, 30 min) and **Size** a row of pills with Small chosen.
  The ready time is fixed at Get price and the delivery sends the same one the price was made for.
- **Order total** is required (0 allowed), typed as "12,50" or "12.50", up to 1000 €, and sent in whole
  cents (1250) on the quote and the delivery, as the backend keeps money. Before, every order went out with 0.
- **Floor and doorbell** and **Note for the rider** now reach the rider: they are sent as one text in
  `dropoffSellerNotes` (the rider app) and `dropoffNotes` (admin). Before, the rider never saw them.
- **Address**: one search box that prefers results near the restaurant (about 15 km, not bounded), with
  the street in Greek order ("Iasonos 12"), an 8 s timeout, and a "Can't find it? Type it" fallback whose
  Town starts as the restaurant's own.
- **A picked saved customer** becomes one short card with Edit and Change.
- **Get price and Send order** are one button in a bar fixed under the thumb on phones. The price, ETA,
  distance, the address it was priced for and "valid until" show above it. Any change drops the price;
  an expired price asks for a new one; errors show in plain words in the bar.
- The status page's "Back to request form" link is a **New order** button.
- **Fixes found by review and browser checks before the merge** (`19eed92`, `e03d0bc`): saved customer
  options could not be tapped at all (a `data-[disabled]` selector matched cmdk's `data-disabled="false"`,
  which also affected row 26's picker); Get price stayed live during the address lookup; a failed lookup
  showed the browser's own error text; a refused search showed nothing; after Change, and then after
  Clear, the old street could be priced with nothing on show.
- Tests by agy (349 pass), each important one shown to fail with its bug put back.

### Saved customers for restaurants (scope row 26, spec 0005): `81fddc2` to `f14d9b5`
Built on the branch `feat/saved-customers` and merged on 26 October, together with the backend and
adminweb halves of the row. A restaurant no longer retypes a regular customer: it saves them once,
with their agreement, and picks them on the next order.
- **A Customers page** (a third header link): the restaurant's saved customers, most recently used
  first, 20 at a time with Show more and "N of M". The search waits 300 ms and needs 2 characters,
  and only the latest search's answer is shown. Add and Edit open a dialog with Name, Phone, the
  address (the order form's address search, in a new compact mode) and Notes for the rider; Save
  looks a typed address up first, so a customer always has a map point. Delete asks first.
- **A Saved customer picker on New Delivery**, above the drop off fields. Picking a customer (click,
  or the arrow keys and Enter) fills the recipient, phone, address with its map point, floor and
  notes, and becomes "Saved customer: <name>" with Change. A screen reader hears the pick and the
  change, and focus moves to what replaced the control that had it.
- **"Save this customer for next time (they agreed)"**, a tick at the end of the drop off card, with
  how long an unused customer is kept (the co-op's setting, read through a new server route,
  `/api/partner-metadata`, that passes on only that number). The save runs after the order is
  confirmed, from the details the order was sent with. If it fails, the order stands and the status
  page says why with a short code in its address (`?customerSave=clash`), never a customer's detail.
- **A picked customer stays editable.** Editing the street, city or zip after a pick makes Get
  Estimate look the address up again, so the quote never carries the old point or the old text
  (`9c0310b`). The address lookup now gives up after 8 s (`acafc1e`).
- Each card's Edit button is named for its customer ("Edit Maria P."), as Delete already was, so a
  screen reader tells the cards apart (found at the row's verify).
- "Unit / Apt" is now "Floor or flat"; the form's state is optional and its country defaults to
  `GR`; the header's links stay on one line (on a phone the row scrolls sideways inside the header).
- Fixed along the way: the partner proxy forwarded `{}` as the body of every `DELETE` and bodyless
  `POST`, because Next.js turns no body into `{}`. It now forwards a body only for `POST`, `PATCH`
  and `PUT`, and only a real one (`81fddc2`).
- Tests: 115 new (`b8e0af0`, `f14d9b5`, and one for the Edit name), 280 in all; 45 checked by hand by putting their bug back.
  Reviewed by Fable and by agy; every finding ruled in `docs/reviews/2026-10-26-*saved-customers*`.

### Order form scoped to the signed-in restaurant (Unit 4) — `f8f4232`, `69960e3`
- The form loads `GET /api/partner/v1/partner/profile` and shows the restaurant's name,
  phone and pickup address as plain text, not editable inputs. Only a co-op admin can
  change them.
- If the restaurant has no address on file, the form says so and won't submit.
- Pickup values in both payloads are read from the profile, not from form state. This
  avoids sending placeholder values in the moment before the form fills in.
- "My Orders" lists the backend's partner-scoped deliveries without re-filtering them in
  the browser.
- A comment marks where the form schema and the usability check must stay in sync. The
  form is only reset for profiles that pass the check.

### Testing
- Added Jest and React Testing Library via `next/jest` (run with
  `node node_modules/.bin/jest`). The suite has grown to 86 tests. `6f8cf6e`

### Sign in and the page frame, after the redesign (row 92) — `0b09369`, `6fe1ddf`, `8acef14`, `f5177a8`
- Every page sits in one frame: a sticky 56px header (app icon, New Delivery, My Orders with
  the current page marked, Sign Out) over one centered column, at most 768px wide. A skip
  link moves keyboard focus straight to the page.
- Signing in is a gate in that frame, not a card on the order page. A signed out visit to
  any address shows the sign in there, and after signing in you stay on that address; Sign
  Out keeps it too.
- The sign in follows the admin sign in board: a card with the co-op mark, Email and
  Password fields and a full width button. A failed attempt shows an Alert in plain words
  chosen from the HTTP status (wrong details, too many tries, server down, empty fields);
  the backend's own text and the status code are never shown. `loginPartner` now keeps the
  status on the error it throws.
- New `Field` component from the design system. Phones first: no page scrolls sideways at
  320px.
- Tests: 20 more, written by agy (165 in all), including the old order page sign in tests,
  moved out of `src/pages`. `5d28624`, `ca25102`

### The OpenCourier design system (row 64) — `ba8fbf8`, `7ee4c4c`, `94670e3`
- The colours and corner radius come from the co-op's design system
  (`opencourier-design-system/tokens/tokens.json`): the `:root` theme in `globals.css`
  and the Tailwind config. Light theme only, still Tailwind 3.
- Button, Badge and Alert have the OpenCourier variants (`success`, `warning`, `info`).
- New `StatusBadge`, `Spinner` and `DetailList` components. Every delivery status shows
  through `StatusBadge` with a readable name ("Dropped Off", not `DROPPED_OFF`); it replaces
  `statusVariant()`, lucide's loader and the status page's `DetailGrid`.
- Icons come from Phosphor (`@phosphor-icons/react` 2.1.10) instead of `lucide-react`.
  Icons are hidden from screen readers by default; the spinner and the toast close button
  carry their own names, and the address search's clear button is named too.
- Money, dates and distances use Greek formats and the Athens time zone
  (`src/utils/format.ts`, a 24 hour clock).
- The browser tab and phone home screen show the app icon (`favicon.ico`, `icon-192.png`,
  `apple-touch-icon.png`).
- On a phone, a long delivery id wraps instead of pushing the status badge out of its card.
- Tests: 59 more, written by agy (145 in all). They check the theme against `tokens.json`,
  every status label, that no lucide import comes back, and the Greek formats; the theme and
  status tests skip cleanly when the design system or backend folder is not beside this
  repo. `d07e1f2`, `7ffe3ea`, `7a036c8`

### The order code on the order's page (row 19, spec 0021) — `4eb433a`, `f6ef38c`
- The order's status page shows "Order code #k3x9qz" big above the full id. That's the last 6
  characters of the delivery id, the same code the rider's app shows when collecting, so staff can
  match the bag at a glance.
- Tests by agy (`f6ef38c`): 457 pass; 2 checked by hand. Reviewed by Fable (approve with nits).

## Fixed

- **The default delivery deadline was in the past.** `toISOString()` converted to UTC,
  but `datetime-local` reads local time, so in Athens the default came out as now minus
  two hours. It is now built from local time. `6d43ea3`
- **Partial addresses no longer throw** while the user is still typing.
  `buildManualRequestFormattedAddress` accepts optional fields. `1d465ae`

## Removed

- The "save pickup as default" `localStorage` feature (`manualRequestDefaultPickup.ts`).
  Pickup now comes from the server. `f8f4232`
- The env var that named a single partner. The session cookie now determines the
  restaurant. `f8f4232`
- Browser env vars `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_MANUAL_REQUEST_BASE_PATH`,
  `..._AUTH_MODE`, `..._DEFAULT_PARTNER_ID` and `..._API_KEY`. `MANUAL_REQUEST_BASE_PATH`
  is now server-side only. `202f7ba`
- `package-lock.json` (this repo uses Yarn 1). `1d465ae`

## Housekeeping

- Ignored pipeline artifacts (`.aiflow/`, `plan.md`). `2d78cd7`
- `.run-dev.sh`, a local Node 20 helper that is only useful on the author's machine.
  `1d465ae`
- `AGENTS.md`, context for AI coding tools that points at the co-op workspace rulebook, and a
  `CLAUDE.md` that imports it.

---

## Known open items

- Rotate the leaked partner API key and the Google Maps key, and remove the Maps key from
  the tracked `local.env`.
- The customer search sends its words in the query string to this app's own proxy. Nothing here
  logs it, but a reverse proxy put in front of request-web in production would, unless told not
  to for `/api/partner-proxy/customers` (scope row 45, production hosting).
