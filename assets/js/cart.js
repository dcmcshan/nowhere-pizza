/* Cart state + checkout.
 *
 * Money note: all arithmetic is done in integer cents. Doing it in floats
 * makes 18.10 + 29.10 land on 47.199999999999996, which then renders as the
 * wrong total. The browser total is an ESTIMATE only — the authoritative
 * figure comes back from the POS via the Worker's /quote and /orders calls.
 */

window.NowhereCart = (function () {
  "use strict";

  var STORAGE_KEY = "nowhere.cart.v1";
  var cfg = window.NOWHERE_CONFIG || {};
  var money = window.NowhereMenu ? window.NowhereMenu.money : function (n) { return "$" + n.toFixed(2); };

  var state = { locationId: null, lines: [] };
  var listeners = [];

  /* ------------------------------------------------------------ persistence */
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.lines)) state = parsed;
      }
    } catch (e) {
      // Private browsing or corrupted payload — start clean rather than crash.
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* storage unavailable; cart stays in-memory for this visit */ }
  }

  function emit() {
    save();
    listeners.forEach(function (fn) { fn(state); });
  }

  /* ------------------------------------------------------------------ money */
  function toCents(dollars) { return Math.round(dollars * 100); }
  function toDollars(cents) { return cents / 100; }

  function lineCents(line) { return toCents(line.price) * line.qty; }

  function totals() {
    var subtotal = state.lines.reduce(function (sum, l) { return sum + lineCents(l); }, 0);
    var taxRate = cfg.estimatedTaxRate;
    var tax = taxRate ? Math.round(subtotal * taxRate) : null;
    return {
      subtotalCents: subtotal,
      taxCents: tax,
      totalCents: subtotal + (tax || 0),
      subtotal: toDollars(subtotal),
      tax: tax == null ? null : toDollars(tax),
      total: toDollars(subtotal + (tax || 0))
    };
  }

  /* ----------------------------------------------------------------- mutate */
  function keyOf(entry) {
    return entry.itemId + "::" + entry.variantId + "::" + JSON.stringify(entry.modifiers || []);
  }

  function add(entry) {
    var key = keyOf(entry);
    var existing = state.lines.filter(function (l) { return l.key === key; })[0];
    if (existing) {
      existing.qty += 1;
    } else {
      state.lines.push({
        key: key,
        itemId: entry.itemId,
        posId: entry.posId || null,
        name: entry.name,
        variantId: entry.variantId,
        variantName: entry.variantName,
        modifiers: entry.modifiers || [],
        price: entry.price,
        qty: 1
      });
    }
    emit();
  }

  function setQty(key, qty) {
    if (qty <= 0) return remove(key);
    state.lines.forEach(function (l) { if (l.key === key) l.qty = qty; });
    emit();
  }

  function remove(key) {
    state.lines = state.lines.filter(function (l) { return l.key !== key; });
    emit();
  }

  function clear() {
    state.lines = [];
    emit();
  }

  function count() {
    return state.lines.reduce(function (n, l) { return n + l.qty; }, 0);
  }

  function setLocation(id) {
    if (state.locationId && state.locationId !== id && state.lines.length) {
      // Prices and availability differ per location — don't silently carry a
      // cart across the pass.
      state.lines = [];
    }
    state.locationId = id;
    emit();
  }

  /* --------------------------------------------------------------- checkout */
  function buildOrder(customer) {
    return {
      locationId: state.locationId,
      fulfillment: customer.fulfillment || "pickup",
      customer: {
        name: customer.name,
        phone: customer.phone,
        email: customer.email || null
      },
      notes: customer.notes || null,
      items: state.lines.map(function (l) {
        return {
          posId: l.posId,
          itemId: l.itemId,
          variantId: l.variantId,
          modifiers: l.modifiers,
          quantity: l.qty,
          // Sent for cross-checking only. The POS re-prices server-side; if the
          // two disagree the Worker rejects the order rather than guessing.
          expectedUnitPriceCents: toCents(l.price)
        };
      }),
      clientTotals: totals()
    };
  }

  /* A stable key per checkout attempt so a retry (or an impatient double-tap)
   * can't create a second order. Regenerated only after a success or a reset. */
  var idemKey = null;
  function idempotencyKey() {
    if (!idemKey) {
      idemKey = (crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + "-" + Math.random().toString(16).slice(2));
    }
    return idemKey;
  }
  function resetIdempotency() { idemKey = null; }

  function checkout(customer) {
    if (!state.lines.length) {
      return Promise.reject(Object.assign(new Error("Your order is empty."), { code: "EMPTY" }));
    }
    if (!window.Genius || !window.Genius.available()) {
      return Promise.reject(
        Object.assign(new Error("Online ordering isn't switched on yet."), { code: "NOT_CONFIGURED" })
      );
    }
    return window.Genius.submitOrder(buildOrder(customer), idempotencyKey()).then(function (res) {
      clear();
      resetIdempotency();
      return res;
    });
  }

  load();

  return {
    get state() { return state; },
    subscribe: function (fn) { listeners.push(fn); fn(state); },
    add: add,
    setQty: setQty,
    remove: remove,
    clear: clear,
    count: count,
    totals: totals,
    setLocation: setLocation,
    buildOrder: buildOrder,
    checkout: checkout,
    money: money
  };
})();
