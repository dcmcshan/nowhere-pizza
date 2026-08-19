# Genius POS integration

## Why there is a Worker

GitHub Pages serves static files from a public repository. Anything the browser
can read, anyone can read — so the Genius API key **cannot** live in this repo
or in any file the site serves. If it did, it would be extractable from
`view-source` within seconds of going live.

So the browser never talks to Genius. It talks to a small Cloudflare Worker
(`worker/`), and the Worker holds the key:

```
browser ──▶ Worker (holds GENIUS_API_KEY) ──▶ Genius POS API
```

The Worker also does the things a browser must never be trusted with: it
re-prices the basket server-side, enforces idempotency so a double-tap can't
produce two pizzas, rate-limits per IP, and refuses cross-origin callers.

## What to ask your Genius representative for

Genius issues API keys through your POS rep rather than a self-serve portal.
Ask for:

1. **An API key** for the online-ordering / third-party integration API.
2. **The API base URL** for your account (production, and a sandbox if they
   have one).
3. **The location ids** for the Keystone and Copper stores.
4. **The API documentation** — specifically the request/response shapes for:
   - fetching the menu/item catalog for a location
   - fetching store status (are we accepting online orders, current prep time)
   - submitting an order
   - whether they support an `Idempotency-Key` header
5. **Whether the key is sent as `Authorization: Bearer …` or a custom header**
   such as `X-API-Key`.

> The Worker is written against the shapes described in Genius's public
> integration material, which is not a substitute for the real spec. The two
> functions to reconcile once you have the docs are `fromGeniusMenu` and
> `toGeniusOrder` in `worker/src/index.js` — both are isolated and commented
> for exactly this reason. Everything around them (CORS, validation,
> idempotency, rate limiting, error masking) is spec-independent and will not
> need to change.

## Deploying the Worker

```bash
cd worker
npm install
```

Create the KV namespaces used for idempotency and rate limiting:

```bash
npx wrangler kv namespace create ORDERS
npx wrangler kv namespace create RATELIMIT
```

Paste the returned ids into `wrangler.toml` and uncomment those blocks.

Set the secrets — these are stored by Cloudflare, never in the repo:

```bash
npx wrangler secret put GENIUS_API_KEY
npx wrangler secret put GENIUS_API_BASE
npx wrangler secret put GENIUS_LOCATION_KEYSTONE
npx wrangler secret put GENIUS_LOCATION_COPPER
```

Deploy:

```bash
npx wrangler deploy
```

Then point the site at it by setting `orderApiBase` in
[`assets/js/config.js`](../assets/js/config.js):

```js
orderApiBase: "https://nowhere-order.<your-subdomain>.workers.dev",
```

That value is public and is *supposed* to be — it is just a URL. The key stays
in Cloudflare.

## Local development

```bash
cd worker
cp .dev.vars.example .dev.vars   # .dev.vars is gitignored
# fill in the values, then:
npm run dev
```

Serve the site alongside it and set `orderApiBase` to
`http://127.0.0.1:8787`. `http://localhost:8080` is already in the Worker's
CORS allowlist.

## Demo mode

While `orderApiBase` is empty the site runs in demo mode deliberately: the menu
renders, the cart works, totals calculate, and checkout stops at a clearly
labelled notice telling the customer to phone the order in. Nothing silently
pretends to have placed an order.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/menu?location=<id>` | Live catalog for a location |
| `GET` | `/status?location=<id>` | Accepting orders? Current prep time |
| `POST` | `/quote` | Server-authoritative pricing for a basket |
| `POST` | `/orders` | Place an order (honours `Idempotency-Key`) |
| `POST` | `/contact` | Forward a contact-form message |
| `GET` | `/health` | Liveness check |

## Before you take real orders

- [ ] Reconcile `toGeniusOrder` / `fromGeniusMenu` against the real API docs.
- [ ] Place a test order end to end and confirm it prints in the kitchen.
- [ ] Confirm what happens when the store is **closed** — the site should
      refuse the order, not queue it for a kitchen nobody is standing in.
- [ ] Decide whether prices come from `data/menu.json` or from the POS. Once
      the POS is authoritative, `data/menu.json` becomes a fallback only, and
      you should stop hand-editing prices in it.
- [ ] Confirm the tax rate and set `estimatedTaxRate` in `config.js`.
- [ ] Turn on `wrangler tail` for the first day and watch for upstream errors.
