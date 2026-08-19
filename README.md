# nowhere-pizza.com

Static site for **Nowhere Pizza & Pub** — Keystone and Copper Mountain,
Colorado — with online ordering through Genius POS.

**Live (preview):** https://dcmcshan.github.io/nowhere-pizza/
**Production domain:** `nowhere-pizza.com` — not yet cut over, see
[`docs/CUTOVER.md`](docs/CUTOVER.md).

Replaces a Wix site. What was wrong with that one, and what still needs your
input, is in [`docs/REVIEW.md`](docs/REVIEW.md) — **start there**.

---

## Layout

```
index.html  menu.html  order.html  keystone.html  copper.html
events.html absinthe.html contact.html careers.html privacy.html 404.html
games-1.html … privacy-policy.html   redirect stubs for old Wix URLs

assets/css/styles.css      design system (one file, no build step)
assets/js/
  site.js                  nav, active link, footer year
  config.js                public config — NO SECRETS
  genius.js                POS client (talks to the Worker, never to Genius)
  menu.js                  renders data/menu.json
  cart.js                  cart state, integer-cent maths, checkout
  menu-page.js             menu page controller
  order-page.js            order page controller
  contact-page.js          contact form
data/
  menu.json                menu source of truth
  locations.json           locations, hours, recurring events
worker/                    Cloudflare Worker holding the Genius API key
docs/                      REVIEW · GENIUS-POS · CUTOVER
```

No build step, no dependencies, no framework. Edit a file, commit, it deploys.

## Local preview

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080. `http://localhost:8080` is already in the
Worker's CORS allowlist for testing the ordering flow.

## Editing the menu

Everything lives in [`data/menu.json`](data/menu.json).

- `"price": null` renders as **Price TBC** on the site and makes the item
  phone-order-only. This is deliberate — the site never invents a price.
- `"needsReview": true` marks a description I drafted from old marketing copy
  rather than from a real menu. Correct these.
- `availableAt` controls which store an item appears for.
- `orderableOnline: false` on a category (the bar) hides its add buttons.

## Online ordering

The site works without it — demo mode lets customers build an order and phone
it in. To switch it on, deploy the Worker and set `orderApiBase` in
`assets/js/config.js`. Full instructions:
[`docs/GENIUS-POS.md`](docs/GENIUS-POS.md).

## Secrets

There are none in this repo, and there must never be. GitHub Pages serves this
repo publicly. The Genius API key lives only in Cloudflare's secret store.
`.gitignore` covers `.env` and `worker/.dev.vars`.

## Deployment

Push to `main`. GitHub Pages builds from the repo root.
