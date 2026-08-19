/* Genius POS client (browser side).
 *
 * This never talks to Genius directly — a public static site cannot hold an
 * API key. Every call goes to the Cloudflare Worker in worker/, which attaches
 * the key server-side and forwards to Genius.
 *
 * If `orderApiBase` is empty the client reports itself unavailable and the
 * ordering UI falls back to DEMO MODE (build a cart, then phone it in).
 */

window.Genius = (function () {
  "use strict";

  var cfg = window.NOWHERE_CONFIG || {};
  var base = (cfg.orderApiBase || "").replace(/\/$/, "");

  function available() {
    return base !== "";
  }

  function request(path, options) {
    if (!available()) {
      return Promise.reject(
        Object.assign(new Error("Ordering is not connected yet."), { code: "NOT_CONFIGURED" })
      );
    }

    var opts = options || {};
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, opts.timeout || 15000);

    return fetch(base + path, {
      method: opts.method || "GET",
      headers: Object.assign({ "Content-Type": "application/json" }, opts.headers),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { /* non-JSON body */ }

          if (!res.ok) {
            var err = new Error((data && data.message) || "Request failed (" + res.status + ")");
            err.status = res.status;
            err.code = (data && data.code) || "HTTP_" + res.status;
            throw err;
          }
          return data;
        });
      })
      .catch(function (err) {
        if (err.name === "AbortError") {
          throw Object.assign(new Error("The kitchen took too long to answer."), { code: "TIMEOUT" });
        }
        throw err;
      })
      .finally(function () { clearTimeout(timer); });
  }

  return {
    available: available,

    /* Live menu + prices straight from the POS catalog. Falls back to the
     * bundled data/menu.json when ordering isn't connected. */
    getMenu: function (locationId) {
      return request("/menu?location=" + encodeURIComponent(locationId));
    },

    /* Is this location currently accepting online orders? */
    getStatus: function (locationId) {
      return request("/status?location=" + encodeURIComponent(locationId));
    },

    /* Server-side price/tax calculation before the customer commits. Never
     * trust the browser's arithmetic for the real total. */
    quote: function (order) {
      return request("/quote", { method: "POST", body: order });
    },

    /* Submit the order. Returns { orderId, status, etaMinutes, payment }.
     * `idempotencyKey` makes a retry safe — a double-tap must not produce
     * two pizzas. */
    submitOrder: function (order, idempotencyKey) {
      return request("/orders", {
        method: "POST",
        body: order,
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
        timeout: 30000
      });
    }
  };
})();
