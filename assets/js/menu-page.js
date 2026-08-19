/* Menu page controller: render the menu, then keep the sticky section nav in
   sync with what's on screen. */

(function () {
  "use strict";

  var root = document.getElementById("menu-root");

  window.NowhereMenu.load({
    src: "data/menu.json",
    mount: "menu-root",
    navMount: "menu-nav",
    orderable: false
  })
    .then(function () {
      if (root) root.setAttribute("aria-busy", "false");
      trackActiveSection();
    })
    .catch(function () {
      if (root) root.setAttribute("aria-busy", "false");
    });

  /* Highlight the section currently in view in the sticky nav. */
  function trackActiveSection() {
    var links = Array.prototype.slice.call(document.querySelectorAll("#menu-nav a"));
    var sections = links
      .map(function (a) { return document.querySelector(a.getAttribute("href")); })
      .filter(Boolean);

    if (!sections.length || !("IntersectionObserver" in window)) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          links.forEach(function (a) {
            a.classList.toggle("is-active", a.getAttribute("href") === "#" + entry.target.id);
          });
        });
      },
      // Trip when a heading reaches the band just under the sticky headers.
      { rootMargin: "-25% 0px -70% 0px" }
    );

    sections.forEach(function (s) { observer.observe(s); });
  }
})();
