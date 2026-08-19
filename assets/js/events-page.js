/* Events page: rendered from data/locations.json so a schedule change is a
   one-line data edit rather than an HTML edit in two places. */

(function () {
  "use strict";

  var DAY_ORDER = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "class") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function whenLabel(ev, loc) {
    var bits = [];
    if (ev.day) bits.push("Every " + ev.day);
    if (ev.timeLabel) bits.push(ev.timeLabel);
    bits.push(loc.shortName);
    return bits.join(" · ");
  }

  function card(ev, loc) {
    var children = [
      el("p", { class: "section-label", text: whenLabel(ev, loc) }),
      el("h2", { text: ev.name })
    ];
    if (ev.description) children.push(el("p", { text: ev.description }));

    var row = el("div", { class: "btn-row" }, [
      el("a", {
        class: "btn btn-ghost btn-sm",
        href: loc.phoneHref,
        text: "Call " + loc.shortName + " · " + loc.phone
      })
    ]);
    children.push(row);

    return el("article", { class: "frame card" }, children);
  }

  /* Sort by weekday so the page reads like a week, with undated things last. */
  function sortKey(entry) {
    var i = DAY_ORDER.indexOf(entry.ev.day);
    return i === -1 ? 99 : i;
  }

  function render(data) {
    var root = document.getElementById("events-root");
    if (!root) return;

    var entries = [];
    (data.locations || []).forEach(function (loc) {
      (loc.recurring || []).forEach(function (ev) {
        entries.push({ ev: ev, loc: loc });
      });
    });

    entries.sort(function (a, b) { return sortKey(a) - sortKey(b); });

    root.textContent = "";
    var grid = el("div", { class: "grid grid-2" });
    entries.forEach(function (e) { grid.appendChild(card(e.ev, e.loc)); });
    root.appendChild(grid);
    root.setAttribute("aria-busy", "false");
  }

  fetch("data/locations.json", { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(render)
    .catch(function () {
      var root = document.getElementById("events-root");
      if (!root) return;
      root.setAttribute("aria-busy", "false");
      root.textContent = "";
      root.appendChild(
        el("p", {
          class: "notice",
          text:
            "We couldn't load the schedule right now. Call Copper at 970-475-4373 " +
            "or Keystone at 970-485-6974 and we'll tell you what's on."
        })
      );
    });
})();
