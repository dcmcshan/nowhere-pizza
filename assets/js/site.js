/* Shared site behaviour: mobile nav, active-link marking, footer year. */

(function () {
  "use strict";

  /* ------------------------------------------------------------ mobile nav */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });

    // Close on Escape, and return focus to the button so keyboard users
    // don't get stranded inside a hidden panel.
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  /* -------------------------------------------------- mark the current page */
  var here = location.pathname.replace(/\/index\.html$/, "/").replace(/\.html$/, "");
  document.querySelectorAll(".site-nav a[href]").forEach(function (a) {
    var target = a.getAttribute("href").replace(/\.html$/, "").replace(/^\.\//, "/");
    if (target === here || (target === "/index" && here === "/")) {
      a.setAttribute("aria-current", "page");
    }
  });

  /* ------------------------------------------------------------ footer year */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
