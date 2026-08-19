/* Renders data/menu.json into the menu + order pages.
 *
 * Prefers the live POS catalog when the ordering Worker is configured, and
 * falls back to the bundled JSON otherwise, so the menu always renders.
 */

window.NowhereMenu = (function () {
  "use strict";

  var CURRENCY = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

  function money(n) {
    return CURRENCY.format(n);
  }

  /* Build a DOM node instead of assembling HTML strings — menu text comes from
   * a data file and (later) the POS, so it must never be interpolated as markup. */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") node.className = attrs[k];
      else if (k === "text") node.textContent = attrs[k];
      else if (attrs[k] != null) node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  var TAG_LABELS = {
    "gluten-free": { label: "Gluten-Free", cls: "tag-gf" },
    "vegetarian": { label: "Vegetarian", cls: "tag-veg" },
    "vegan": { label: "Vegan", cls: "tag-v" },
    "spicy": { label: "Spicy", cls: "tag-spicy" },
    "signature": { label: "Signature", cls: "tag-gf" }
  };

  function renderTags(tags) {
    if (!tags || !tags.length) return null;
    return el(
      "ul",
      { class: "tags" },
      tags.map(function (t) {
        var meta = TAG_LABELS[t] || { label: t, cls: "" };
        return el("li", { class: "tag " + meta.cls, text: meta.label });
      })
    );
  }

  /* Price display. A null price is shown honestly as "Price TBC" rather than
   * as $0.00 or a guess. */
  function renderPrice(variants) {
    if (!variants || !variants.length) return null;

    if (variants.length === 1) {
      var p = variants[0].price;
      return p == null
        ? el("span", { class: "tbc", text: "Price TBC" })
        : el("span", { class: "menu-item-price", text: money(p) });
    }

    return el(
      "ul",
      { class: "price-list" },
      variants.map(function (v) {
        var li = el("li", {});
        li.appendChild(document.createTextNode(v.name + " "));
        li.appendChild(
          v.price == null
            ? el("span", { class: "tbc", text: "TBC" })
            : el("b", { text: money(v.price) })
        );
        return li;
      })
    );
  }

  function renderItem(item, opts) {
    var head = el("div", { class: "menu-item-head" }, [
      el("h3", { class: "menu-item-name", text: item.name })
    ]);

    var single = item.variants && item.variants.length === 1;
    if (single) head.appendChild(renderPrice(item.variants));

    var children = [head];
    if (item.description) {
      children.push(el("p", { class: "menu-item-desc", text: item.description }));
    }
    if (!single) {
      children.push(renderPrice(item.variants));
    }
    var tags = renderTags(item.tags);
    if (tags) children.push(tags);

    // The order page adds an "Add to order" control; the menu page doesn't.
    if (opts && opts.orderable && item.variants) {
      var orderable = item.variants.some(function (v) { return v.price != null; });
      children.push(buildAddControl(item, orderable));
    }

    return el("article", { class: "menu-item", "data-item-id": item.id }, children);
  }

  function buildAddControl(item, orderable) {
    var wrap = el("div", { class: "btn-row" });

    if (!orderable) {
      wrap.appendChild(
        el("span", { class: "tbc", text: "Not yet orderable online" })
      );
      return wrap;
    }

    var select = null;
    if (item.variants.length > 1) {
      select = el("select", {
        class: "variant-select",
        "aria-label": "Size for " + item.name
      });
      item.variants.forEach(function (v) {
        if (v.price == null) return;
        var o = el("option", { value: v.id, text: v.name + " — " + money(v.price) });
        select.appendChild(o);
      });
      wrap.appendChild(select);
    }

    var btn = el("button", {
      type: "button",
      class: "btn btn-primary btn-sm",
      text: "Add to order"
    });
    btn.addEventListener("click", function () {
      var vid = select ? select.value : item.variants[0].id;
      var variant = item.variants.filter(function (v) { return v.id === vid; })[0];
      window.NowhereCart.add({
        itemId: item.id,
        name: item.name,
        variantId: variant.id,
        variantName: variant.name,
        price: variant.price,
        posId: item.posId || null
      });
      // Confirm the action for screen readers and sighted users alike.
      var live = document.getElementById("cart-status");
      if (live) live.textContent = item.name + " added to your order.";
    });
    wrap.appendChild(btn);

    return wrap;
  }

  function renderCategory(cat, opts) {
    var items = (cat.items || []).filter(function (i) {
      if (!opts || !opts.locationId) return true;
      return !i.availableAt || i.availableAt.indexOf(opts.locationId) !== -1;
    });
    if (!items.length) return null;

    var orderable = !!(opts && opts.orderable) && cat.orderableOnline !== false;

    var children = [el("h2", { id: "cat-" + cat.id, text: cat.name })];
    if (cat.note) children.push(el("p", { class: "section-note", text: cat.note }));
    if (opts && opts.orderable && cat.orderableOnline === false) {
      children.push(
        el("p", { class: "notice", text: "Bar service is in-house only — pull up a stool." })
      );
    }
    children.push(
      el(
        "div",
        { class: "menu-grid" },
        items.map(function (i) { return renderItem(i, { orderable: orderable }); })
      )
    );

    return el("section", { class: "menu-section", "aria-labelledby": "cat-" + cat.id }, children);
  }

  function renderNav(cats, container) {
    if (!container) return;
    container.textContent = "";
    cats.forEach(function (c) {
      container.appendChild(el("a", { href: "#cat-" + c.id, text: c.name }));
    });
  }

  function render(data, opts) {
    var root = document.getElementById(opts.mount);
    if (!root) return;
    root.textContent = "";

    var cats = (data.categories || [])
      .map(function (c) { return { cat: c, node: renderCategory(c, opts) }; })
      .filter(function (x) { return x.node; });

    renderNav(cats.map(function (x) { return x.cat; }), document.getElementById(opts.navMount));

    cats.forEach(function (x) { root.appendChild(x.node); });

    // Surface the provisional-pricing caveat only while prices are provisional.
    var anyTbc = (data.categories || []).some(function (c) {
      return (c.items || []).some(function (i) {
        return (i.variants || []).some(function (v) { return v.price == null; });
      });
    });
    var banner = document.getElementById("price-notice");
    if (banner) banner.hidden = !anyTbc;
  }

  function load(opts) {
    return fetch(opts.src || "data/menu.json", { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("Could not load the menu (" + r.status + ")");
        return r.json();
      })
      .then(function (data) {
        render(data, opts);
        return data;
      })
      .catch(function (err) {
        var root = document.getElementById(opts.mount);
        if (root) {
          root.textContent = "";
          root.appendChild(
            el("p", {
              class: "notice",
              text: "We couldn't load the menu right now. Please call us — Keystone 970-485-6974, Copper 970-475-4373."
            })
          );
        }
        throw err;
      });
  }

  return { load: load, render: render, money: money };
})();
