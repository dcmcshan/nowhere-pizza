/* Order page controller: location switch, cart rendering, checkout. */

(function () {
  "use strict";

  var cart = window.NowhereCart;
  var money = window.NowhereMenu.money;

  var locationSelect = document.getElementById("location-select");
  var linesEl = document.getElementById("cart-lines");
  var emptyEl = document.getElementById("cart-empty");
  var totalsEl = document.getElementById("cart-totals");
  var formEl = document.getElementById("checkout-form");
  var clearBtn = document.getElementById("clear-cart");
  var statusEl = document.getElementById("checkout-status");
  var noticeEl = document.getElementById("order-notice");

  /* ------------------------------------------- demo mode / availability */
  var live = window.Genius && window.Genius.available();

  if (!live && noticeEl) {
    noticeEl.innerHTML =
      '<div class="notice"><p><strong>Online ordering isn\'t switched on yet.</strong> ' +
      "You can build your order here and we'll show you a summary to read down the phone — " +
      'call Keystone on <a href="tel:+19704856974">970-485-6974</a> or Copper on ' +
      '<a href="tel:+19704754373">970-475-4373</a>.</p></div>';
  }

  /* ------------------------------------------------------------ location */
  var initial = cart.state.locationId || "keystone";
  if (locationSelect) {
    locationSelect.value = initial;
    locationSelect.addEventListener("change", function () {
      cart.setLocation(locationSelect.value);
      loadMenu(locationSelect.value);
    });
  }
  cart.setLocation(initial);

  function loadMenu(locationId) {
    var root = document.getElementById("menu-root");
    if (root) root.setAttribute("aria-busy", "true");
    window.NowhereMenu.load({
      src: "data/menu.json",
      mount: "menu-root",
      navMount: "menu-nav",
      orderable: true,
      locationId: locationId
    }).finally(function () {
      if (root) root.setAttribute("aria-busy", "false");
    });
  }
  loadMenu(initial);

  /* ---------------------------------------------------------- cart render */
  function render(state) {
    if (!linesEl) return;

    linesEl.textContent = "";

    state.lines.forEach(function (line) {
      var li = document.createElement("li");
      li.className = "cart-line";

      var name = document.createElement("div");
      name.className = "cart-line-name";
      name.textContent = line.name;
      li.appendChild(name);

      var price = document.createElement("div");
      price.className = "cart-line-price";
      price.textContent = money(line.price * line.qty);
      li.appendChild(price);

      var meta = document.createElement("div");
      meta.className = "cart-line-meta";
      meta.textContent = line.variantName + " · " + money(line.price) + " each";
      li.appendChild(meta);

      // Quantity stepper
      var qty = document.createElement("div");
      qty.className = "qty";
      qty.style.gridColumn = "1 / -1";

      var minus = document.createElement("button");
      minus.type = "button";
      minus.textContent = "−";
      minus.setAttribute("aria-label", "Remove one " + line.name);
      minus.addEventListener("click", function () { cart.setQty(line.key, line.qty - 1); });

      var out = document.createElement("output");
      out.textContent = String(line.qty);
      out.setAttribute("aria-label", "Quantity of " + line.name);

      var plus = document.createElement("button");
      plus.type = "button";
      plus.textContent = "+";
      plus.setAttribute("aria-label", "Add one " + line.name);
      plus.addEventListener("click", function () { cart.setQty(line.key, line.qty + 1); });

      qty.appendChild(minus);
      qty.appendChild(out);
      qty.appendChild(plus);
      li.appendChild(qty);

      linesEl.appendChild(li);
    });

    var has = state.lines.length > 0;
    if (emptyEl) emptyEl.hidden = has;
    if (formEl) formEl.hidden = !has;
    if (clearBtn) clearBtn.hidden = !has;

    renderTotals();
    renderOrderBar(has);
  }

  /* Docked mobile summary — see .order-bar in styles.css. */
  function renderOrderBar(has) {
    var bar = document.getElementById("order-bar");
    if (!bar) return;

    bar.classList.toggle("is-visible", has);
    document.body.classList.toggle("has-order-bar", has);
    if (!has) return;

    var n = cart.count();
    bar.querySelector(".order-bar-count").textContent =
      n + (n === 1 ? " item" : " items");
    bar.querySelector(".order-bar-total").textContent = money(cart.totals().total);
  }

  function renderTotals() {
    if (!totalsEl) return;
    totalsEl.textContent = "";
    if (!cart.state.lines.length) return;

    var t = cart.totals();

    totalsEl.appendChild(row("Subtotal", money(t.subtotal)));
    if (t.tax != null) totalsEl.appendChild(row("Estimated tax", money(t.tax)));
    totalsEl.appendChild(row("Total", money(t.total), "total"));

    if (t.tax == null) {
      var note = document.createElement("li");
      note.style.fontSize = "0.8rem";
      note.textContent = "Tax is added at the counter.";
      totalsEl.appendChild(note);
    }
  }

  function row(label, value, cls) {
    var li = document.createElement("li");
    if (cls) li.className = cls;
    var a = document.createElement("span");
    a.textContent = label;
    var b = document.createElement("span");
    b.textContent = value;
    li.appendChild(a);
    li.appendChild(b);
    return li;
  }

  cart.subscribe(render);

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      cart.clear();
      if (statusEl) { statusEl.textContent = "Order cleared."; statusEl.className = "status-msg"; }
    });
  }

  /* ------------------------------------------------------------ checkout */
  if (formEl) {
    formEl.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!statusEl) return;

      var name = document.getElementById("cust-name");
      var phone = document.getElementById("cust-phone");
      var notes = document.getElementById("cust-notes");

      // Validate before doing anything else, and move focus to the first
      // problem so keyboard and screen-reader users land on it.
      if (!name.value.trim()) return fail("Please tell us your name.", name);
      if (!phone.value.trim()) return fail("Please give us a mobile number.", phone);

      var btn = document.getElementById("checkout-btn");
      btn.disabled = true;
      btn.textContent = "Sending…";
      statusEl.className = "status-msg";
      statusEl.textContent = "Sending your order to the kitchen…";

      cart
        .checkout({
          name: name.value.trim(),
          phone: phone.value.trim(),
          notes: notes.value.trim() || null,
          fulfillment: "pickup"
        })
        .then(function (res) {
          statusEl.className = "status-msg is-ok";
          statusEl.textContent =
            "Order " + (res.orderId || "") + " is in. " +
            (res.etaMinutes ? "Ready in about " + res.etaMinutes + " minutes." : "We'll call you when it's ready.");
          formEl.reset();
        })
        .catch(function (err) {
          statusEl.className = "status-msg is-error";
          if (err.code === "NOT_CONFIGURED") {
            statusEl.textContent =
              "Online ordering isn't live yet — please call Keystone 970-485-6974 or Copper 970-475-4373 " +
              "and read them your order above.";
          } else {
            statusEl.textContent =
              (err.message || "Something went wrong.") +
              " Please call us — Keystone 970-485-6974, Copper 970-475-4373.";
          }
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = "Place order";
        });
    });
  }

  function fail(msg, field) {
    statusEl.className = "status-msg is-error";
    statusEl.textContent = msg;
    if (field) field.focus();
  }
})();
