/* Public, non-secret front-end configuration.
 *
 * NOTHING SECRET GOES IN THIS FILE. It is served to every visitor of a public
 * GitHub Pages site. The Genius POS API key lives only in the Cloudflare
 * Worker's secret store (see worker/README.md); the browser only ever talks
 * to the Worker, never to Genius directly.
 */

window.NOWHERE_CONFIG = {
  /* Base URL of the ordering proxy Worker.
   * Empty string => ordering runs in DEMO MODE: the cart works end to end but
   * checkout stops at a clearly-labelled notice instead of sending an order.
   * Set this once the Worker is deployed, e.g.
   *   "https://nowhere-order.<your-subdomain>.workers.dev"
   * or a custom route such as "https://order.nowhere-pizza.com". */
  orderApiBase: "",

  /* Order types the site offers. Delivery is off until someone confirms
   * Nowhere actually delivers — the old site never claimed it did. */
  fulfillment: {
    pickup: true,
    delivery: false
  },

  /* Tax is calculated by the POS at checkout; this is display-only so the
   * customer sees an estimate before submitting. Set to null to hide the
   * estimated-tax line entirely. Summit County CO combined rate — CONFIRM. */
  estimatedTaxRate: null,

  /* Minutes to quote for pickup readiness. Display-only. */
  pickupEtaMinutes: 25
};
