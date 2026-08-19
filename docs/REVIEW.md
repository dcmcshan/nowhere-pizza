# Critical review — nowhere-pizza.com

Review of the live Wix site (August 2026) and of the replacement built in this
repo. Findings are ordered by how much money they cost.

Legend: **[FIXED]** done in this repo · **[NEEDS YOU]** blocked on information
only the business has · **[OPEN]** still to do.

---

## 1. Content defects on the live site

### 1.1 The menu page was never edited — it is Wix demo content **[FIXED]**

`nowhere-pizza.com/menu` was publishing the Wix restaurant template's sample
data, live, to customers:

> Bread & dips $4.50 · Green salad $3.50 · **Tuna sashimi** $4.50 · **Tofu
> skewers** $7.50 · Sticky date & ice cream $7.00 · Lemon meringue pie $5.50 ·
> Chocolate mousse · Carrot cake · **Wine — choice of red, white or rosé —
> $2.00**

A pizza pub in Summit County is not selling tuna sashimi, and it is certainly
not selling a glass of wine for two dollars. Only two items on that page were
real: Hawaiian Luau and Buffalo vs Chicken — and Buffalo vs Chicken, a pizza,
was filed under **Drinks**.

This is the single most damaging thing on the site. It tells a first-time
visitor that nobody is minding the shop, and it is the page they go to before
deciding whether to drive over.

*Fixed:* the menu is now driven by `data/menu.json` and contains only real
items. See §4 — it needs your prices.

### 1.2 The three menu buttons on the homepage all went to the wrong place **[FIXED]**

"Keystone Menu", "Copper Menu" and "Freedom Menu" were presented as three
distinct menus. All three linked to `/copper`, and one had no link at all.
Nobody could reach a menu from the homepage.

### 1.3 The "Karaoke in Copper" link sent customers to a lift-ticket checkout **[FIXED]**

The homepage's karaoke/open-mic promo linked to:

```
coppercolorado.com/tickets-passes/lift-tickets/tickets/?gclsrc=aw.ds&gad_source=1
&gad_campaignid=14301889346&gbraid=…&gclid=…
```

That is Copper Mountain's paid-search landing page, complete with someone
else's Google Ads click ID. A customer looking for open mic night was being
handed to the resort's ticket funnel. Now points to `events.html`.

### 1.4 More unedited template text on the Keystone page **[FIXED]**

Under the heading "Location in Keystone":

> "This is the space to describe the product. Write a short overview that
> includes important features, pricing and other relevant info for a potential
> buyer. Consider adding an image or video to show off the product…"

### 1.5 A broken app embed on both location pages **[FIXED]**

Both `/games-1` (Keystone) and `/copper` rendered **"Application is no longer
available"** where a Wix app used to be. Two of your most important pages had a
visible error message on them.

### 1.6 Copy errors **[FIXED]**

- "Open 2023, the is the place to be in Copper" → *"Open since 2023."*
- "Amazing pizza, over looking a beautiful lake Keystone." → rewritten.
- "the Hippy Mountain has a **fallowing**" → *following*.
- "Introducing our pizza to Copper and its been a lot of fun" → *it's*.

### 1.7 The gluten-free badge was a watermarked stock image **[FIXED]**

The "GLUTEN FREE" graphic carried a visible `cleanpng` watermark tiled across
it — an unlicensed asset, shipped to production. Removed; dietary information
is now typographic.

---

## 2. Usability

### 2.1 There was no way to order anything **[FIXED]**

The old site had no online ordering, no delivery links, and no ordering
integration of any kind. Every order had to be a phone call, and the phone
numbers were the only transactional element on the site.

### 2.2 No hours. Anywhere. **[NEEDS YOU]**

Neither location published opening hours. For a restaurant this is close to the
worst possible omission — "are they open right now" is the single most common
question a restaurant website is asked, and yours never answered it.

**I have deliberately not invented hours.** Guessed hours send people up a
mountain pass to a locked door, which is worse than no hours. Every location
currently renders *"Call for today's hours."*

To fix: fill in `hours` in `data/locations.json` (24h, `America/Denver`). The
structure is already in place, including seasonal null days.

### 2.3 No street addresses **[NEEDS YOU]**

Same story — "on the lake" and "beside the 10 Mile River" are charming and
useless to a car. Map links currently fall back to a Google Maps *search* for
the business name, which mostly works but is not a pin.

Fill `streetAddress` / `postalCode` in `data/locations.json`; the JSON-LD in
each page picks them up automatically and that is what feeds Google's local
results.

### 2.4 The mobile cart had no feedback **[FIXED]**

In the first build of the order page, the cart panel sat **4,589px down a
6,583px page** on a 375px viewport. You tapped "Add to order" and nothing
visibly happened. Now a docked bar shows a running count and total and jumps to
the cart. Verified: *4 items · $72.00 · View order*, pinned to the viewport.

### 2.5 Tap targets below the 44px minimum **[FIXED]**

Quantity steppers were 32px; footer links were 20px tall. Both now clear 44px —
this matters more than usual for a business whose customers are wearing ski
gloves.

### 2.6 "Not orderable online" was a dead end **[FIXED]**

Because most items have no price yet, 8 of 12 showed a flat "Not yet orderable
online" label — a dead stop with nowhere to go. Now reads **"Phone orders
only"** with a call button for whichever store the customer selected.

### 2.7 Nav had no Menu and no Order **[FIXED]**

The old nav was just `KEYSTONE · COPPER · Message Us`. The two things customers
actually want — the menu and a way to order — were not in it. Both now are, and
"Order Online" is styled as the primary action.

---

## 3. The rest

### Accessibility **[FIXED]**
Skip link, visible focus rings on every interactive element, one `h1` per page
with no heading-level jumps (verified), labelled form controls, `aria-live`
announcements when items are added, `prefers-reduced-motion` honoured, and
decorative images given empty `alt` while meaningful ones are described.

### Performance **[FIXED]**
The old site shipped **1.36 MB of HTML on the homepage alone** plus roughly
11 MB of unoptimised photography — several images were straight 4032px iPhone
originals. Now: static HTML, no framework, WebP throughout, ~1.3 MB of imagery
total. EXIF was stripped in the process, which also removed **GPS coordinates
embedded in the staff iPhone photos**.

### SEO **[FIXED]**
The old pages had a title and an `og:title` and essentially nothing else — no
meta description, no canonical, no structured data. Now: descriptions and
canonicals per page, Open Graph with a real 1200×630 card, `Restaurant`
JSON-LD for both locations, `sitemap.xml`, `robots.txt`, and redirect stubs so
the old Wix URLs keep working.

### Privacy **[OPEN]**
The old privacy policy was Wix boilerplate. Rewritten to describe what this
site actually does. **It still needs your registered business name and a
postal address for data requests, and a lawyer's eye on Colorado Privacy Act
duties** before you rely on it.

---

## 4. What I need from you

Ordered by impact.

1. **Prices.** Only one item on the whole menu has a confirmed price
   (Buffalo vs Chicken, $18 / $29 — taken from the old site). Everything else
   renders "Price TBC". Search `data/menu.json` for `null`.
   *Until this is filled in, "Order Online" can sell exactly one pizza.*

2. **Opening hours** for both locations — see §2.2.

3. **Street addresses** for both locations — see §2.3.

4. **The real menus.** I drafted from what the old site actually named
   (Bacon Bourbon, Hippy Mountain, Hawaiian Luau, Buffalo vs Chicken, the
   Freedom gluten-free line, wings, salads, mules, absinthe). Items I described
   from marketing copy rather than from a real menu are flagged
   `"needsReview": true` — please correct the descriptions and tell me what is
   missing entirely.

5. **Genius POS credentials.** API key, API base URL, and the per-store
   location ids. See `docs/GENIUS-POS.md`.

6. **Decisions I made for you, that you should confirm:**
   - Delivery is **off**. The old site never claimed you deliver.
   - Payment is taken **at the counter**, not online.
   - Tax display is **off** until you confirm the Summit County rate.

---

## 5. Things I would do next

- **Photography.** You have one good pizza photo and it is a Buffalo vs
  Chicken. The Bacon Bourbon and Hippy Mountain are the two pies you sell on,
  and neither has a picture.
- **A real events feed.** Events are hardcoded. If open mic moves for a week,
  someone has to edit HTML.
- **Google Business Profile.** Almost certainly a bigger lever on covers than
  anything on this website. Hours, photos and menu link, on both locations.
- **Kill the Wix subscription** — but only after cutover is confirmed. See
  `docs/CUTOVER.md`.
