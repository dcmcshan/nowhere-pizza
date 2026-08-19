/**
 * Nowhere Pizza & Pub — ordering proxy.
 *
 * The website is a public static site on GitHub Pages, so it cannot hold the
 * Genius POS API key. This Worker is the only thing that ever sees it: the
 * browser calls the Worker, the Worker calls Genius.
 *
 * Endpoints
 *   GET  /menu?location=<id>    live catalog for a location
 *   GET  /status?location=<id>  is the store accepting online orders
 *   POST /quote                 server-authoritative pricing for a basket
 *   POST /orders                place an order (Idempotency-Key honoured)
 *   POST /contact               forward a contact-form message
 *
 * Secrets (set with `wrangler secret put <NAME>` — never in wrangler.toml):
 *   GENIUS_API_KEY       issued by your Genius POS representative
 *   GENIUS_API_BASE      e.g. https://api.genius-pos.us/v1  (CONFIRM with rep)
 *   GENIUS_LOCATION_KEYSTONE / GENIUS_LOCATION_COPPER  per-store POS ids
 *   CONTACT_WEBHOOK_URL  optional; where contact-form messages are forwarded
 *
 * NOTE: the exact Genius request/response shapes below are placeholders based
 * on their published integration description. Genius issues API keys and docs
 * through your POS representative — reconcile `toGeniusOrder` and
 * `fromGeniusMenu` against the real spec before going live. Everything else
 * (CORS, validation, idempotency, price re-checking) is spec-independent.
 */

const ALLOWED_ORIGINS = [
  "https://nowhere-pizza.com",
  "https://www.nowhere-pizza.com",
  "http://localhost:8080",
  "http://127.0.0.1:8080"
];

const LOCATIONS = ["keystone", "copper"];

/* --------------------------------------------------------------------- CORS */

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(origin)
    }
  });
}

function fail(code, message, status, origin) {
  return json({ code, message }, status, origin);
}

/* ---------------------------------------------------------------- helpers */

function locationKey(env, locationId) {
  const map = {
    keystone: env.GENIUS_LOCATION_KEYSTONE,
    copper: env.GENIUS_LOCATION_COPPER
  };
  return map[locationId] || null;
}

async function genius(env, path, init) {
  if (!env.GENIUS_API_KEY || !env.GENIUS_API_BASE) {
    throw Object.assign(new Error("Genius POS is not configured."), { code: "NOT_CONFIGURED" });
  }

  const res = await fetch(env.GENIUS_API_BASE.replace(/\/$/, "") + path, {
    ...init,
    headers: {
      // Genius issues a bearer-style API key via your POS rep. If your account
      // uses a different header (e.g. `X-API-Key`), change it here only.
      Authorization: `Bearer ${env.GENIUS_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init && init.headers)
    }
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON upstream */ }

  if (!res.ok) {
    throw Object.assign(new Error((data && data.message) || `Genius responded ${res.status}`), {
      code: "UPSTREAM_" + res.status,
      status: res.status
    });
  }
  return data;
}

/* Never echo an upstream error body to the browser — it can leak account
   identifiers and internal detail. Log it, return something generic. */
function safeError(err, origin) {
  console.error("genius error", err.code, err.message);
  if (err.code === "NOT_CONFIGURED") {
    return fail("NOT_CONFIGURED", "Online ordering isn't switched on yet.", 503, origin);
  }
  return fail("UPSTREAM", "We couldn't reach the kitchen. Please call us.", 502, origin);
}

/* ------------------------------------------------------------- validation */

function validateOrder(body) {
  if (!body || typeof body !== "object") return "Malformed request.";
  if (!LOCATIONS.includes(body.locationId)) return "Unknown location.";
  if (!Array.isArray(body.items) || body.items.length === 0) return "Your order is empty.";
  if (body.items.length > 50) return "That's too many items for one online order — please call us.";

  const c = body.customer || {};
  if (!c.name || String(c.name).trim().length < 2) return "We need a name for the order.";
  if (!c.phone || String(c.phone).replace(/\D/g, "").length < 10) return "We need a valid phone number.";
  if (c.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) return "That email doesn't look right.";

  for (const item of body.items) {
    if (!item.itemId) return "An item in your order is missing an id.";
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
      return "Item quantities must be between 1 and 20.";
    }
  }
  return null;
}

/* ------------------------------------------------------------- translation */

/* Genius catalog -> the shape data/menu.json uses, so the front end renders
   live POS data through exactly the same code path as the bundled file. */
function fromGeniusMenu(payload) {
  const categories = (payload?.categories || []).map((c) => ({
    id: String(c.id),
    name: c.name,
    note: c.description || null,
    items: (c.items || []).map((i) => ({
      id: String(i.id),
      posId: String(i.id),
      name: i.name,
      description: i.description || null,
      tags: i.tags || [],
      variants: (i.variants || [{ id: "std", name: "Each", price: i.price }]).map((v) => ({
        id: String(v.id),
        name: v.name,
        // Genius returns minor units; the site works in dollars.
        price: typeof v.priceCents === "number" ? v.priceCents / 100 : v.price ?? null
      }))
    }))
  }));

  return { currency: payload?.currency || "USD", priceStatus: "live", categories };
}

function toGeniusOrder(body, env) {
  return {
    locationId: locationKey(env, body.locationId),
    orderType: body.fulfillment === "delivery" ? "DELIVERY" : "PICKUP",
    source: "WEB",
    customer: {
      name: body.customer.name,
      phone: body.customer.phone,
      email: body.customer.email || undefined
    },
    notes: body.notes || undefined,
    items: body.items.map((i) => ({
      itemId: i.posId || i.itemId,
      variantId: i.variantId || undefined,
      quantity: i.quantity,
      modifiers: (i.modifiers || []).map((m) => ({ modifierId: m.id, quantity: m.qty || 1 }))
    }))
  };
}

/* ------------------------------------------------------------------ routes */

async function handleMenu(url, env, origin) {
  const loc = url.searchParams.get("location");
  if (!LOCATIONS.includes(loc)) return fail("BAD_LOCATION", "Unknown location.", 400, origin);

  const data = await genius(env, `/locations/${locationKey(env, loc)}/menu`, { method: "GET" });
  return json(fromGeniusMenu(data), 200, origin);
}

async function handleStatus(url, env, origin) {
  const loc = url.searchParams.get("location");
  if (!LOCATIONS.includes(loc)) return fail("BAD_LOCATION", "Unknown location.", 400, origin);

  const data = await genius(env, `/locations/${locationKey(env, loc)}/status`, { method: "GET" });
  return json(
    {
      acceptingOrders: !!data?.acceptingOrders,
      etaMinutes: data?.prepTimeMinutes ?? null,
      message: data?.message || null
    },
    200,
    origin
  );
}

async function handleQuote(request, env, origin) {
  const body = await request.json().catch(() => null);
  const bad = validateOrder(body);
  if (bad) return fail("INVALID", bad, 400, origin);

  const data = await genius(env, "/orders/quote", {
    method: "POST",
    body: JSON.stringify(toGeniusOrder(body, env))
  });

  return json(
    {
      subtotalCents: data?.subtotalCents ?? null,
      taxCents: data?.taxCents ?? null,
      totalCents: data?.totalCents ?? null,
      etaMinutes: data?.etaMinutes ?? null
    },
    200,
    origin
  );
}

async function handleOrder(request, env, ctx, origin) {
  const body = await request.json().catch(() => null);
  const bad = validateOrder(body);
  if (bad) return fail("INVALID", bad, 400, origin);

  const idem = request.headers.get("Idempotency-Key");

  // Replay protection. A retry (or a double-tap on a flaky mountain
  // connection) must return the original order, not create a second one.
  if (idem && env.ORDERS) {
    const prior = await env.ORDERS.get("idem:" + idem);
    if (prior) return json(JSON.parse(prior), 200, origin);
  }

  const data = await genius(env, "/orders", {
    method: "POST",
    headers: idem ? { "Idempotency-Key": idem } : {},
    body: JSON.stringify(toGeniusOrder(body, env))
  });

  const result = {
    orderId: data?.orderNumber || data?.id || null,
    status: data?.status || "RECEIVED",
    etaMinutes: data?.etaMinutes ?? null,
    totalCents: data?.totalCents ?? null
  };

  if (idem && env.ORDERS) {
    ctx.waitUntil(env.ORDERS.put("idem:" + idem, JSON.stringify(result), { expirationTtl: 86400 }));
  }

  return json(result, 201, origin);
}

async function handleContact(request, env, origin) {
  const body = await request.json().catch(() => null);
  if (!body || !body.name || !body.email || !body.message) {
    return fail("INVALID", "Please fill in your name, email and message.", 400, origin);
  }
  if (String(body.message).length > 5000) {
    return fail("INVALID", "That message is too long.", 400, origin);
  }
  if (!env.CONTACT_WEBHOOK_URL) {
    return fail("NOT_CONFIGURED", "The contact form isn't connected yet.", 503, origin);
  }

  await fetch(env.CONTACT_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "nowhere-pizza.com",
      name: body.name,
      email: body.email,
      phone: body.phone || null,
      subject: body.subject || "Website enquiry",
      message: body.message
    })
  });

  return json({ ok: true }, 200, origin);
}

/* ------------------------------------------------------------ rate limiting */

/* Crude per-IP throttle so nobody can hammer the POS through this Worker.
   Requires the RATELIMIT KV namespace; skipped when it isn't bound. */
async function rateLimited(request, env) {
  if (!env.RATELIMIT) return false;

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `rl:${ip}`;
  const count = parseInt((await env.RATELIMIT.get(key)) || "0", 10);

  if (count >= 60) return true;
  await env.RATELIMIT.put(key, String(count + 1), { expirationTtl: 60 });
  return false;
}

/* -------------------------------------------------------------------- entry */

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Reject cross-site callers outright rather than relying on the browser
    // to enforce the CORS response.
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return fail("FORBIDDEN", "Not allowed.", 403, origin);
    }

    if (await rateLimited(request, env)) {
      return fail("RATE_LIMITED", "Too many requests — please slow down.", 429, origin);
    }

    try {
      if (request.method === "GET" && url.pathname === "/menu") return await handleMenu(url, env, origin);
      if (request.method === "GET" && url.pathname === "/status") return await handleStatus(url, env, origin);
      if (request.method === "POST" && url.pathname === "/quote") return await handleQuote(request, env, origin);
      if (request.method === "POST" && url.pathname === "/orders") return await handleOrder(request, env, ctx, origin);
      if (request.method === "POST" && url.pathname === "/contact") return await handleContact(request, env, origin);

      if (url.pathname === "/health") return json({ ok: true }, 200, origin);

      return fail("NOT_FOUND", "No such endpoint.", 404, origin);
    } catch (err) {
      return safeError(err, origin);
    }
  }
};
