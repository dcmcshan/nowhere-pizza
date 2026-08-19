/* Contact form: posts to the Worker's /contact endpoint when configured,
   and otherwise tells the visitor to phone rather than silently swallowing
   the message. */

(function () {
  "use strict";

  var form = document.getElementById("contact-form");
  var statusEl = document.getElementById("contact-status");
  if (!form || !statusEl) return;

  var cfg = window.NOWHERE_CONFIG || {};
  var base = (cfg.orderApiBase || "").replace(/\/$/, "");

  // Prefill the subject from ?subject= so the "Enquire about a party" and
  // "Job application" buttons arrive with context.
  try {
    var qs = new URLSearchParams(location.search);
    var subject = qs.get("subject");
    if (subject) {
      var field = document.getElementById("c-subject");
      if (field) field.value = subject;
    }
  } catch (e) { /* no URLSearchParams — not important enough to fail over */ }

  if (!base) {
    statusEl.className = "status-msg is-error";
    statusEl.textContent =
      "This form isn't connected yet — please call Keystone at 970-485-6974 or Copper at 970-475-4373.";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var name = document.getElementById("c-name");
    var email = document.getElementById("c-email");
    var message = document.getElementById("c-message");

    if (!name.value.trim()) return fail("Please tell us your name.", name);
    if (!email.checkValidity()) return fail("Please check your email address.", email);
    if (!message.value.trim()) return fail("Please write us a message.", message);

    if (!base) {
      return fail(
        "This form isn't connected yet — please call Keystone at 970-485-6974 or Copper at 970-475-4373.",
        null
      );
    }

    var btn = document.getElementById("contact-submit");
    btn.disabled = true;
    btn.textContent = "Sending…";
    statusEl.className = "status-msg";
    statusEl.textContent = "Sending…";

    fetch(base + "/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.value.trim(),
        email: email.value.trim(),
        phone: (document.getElementById("c-phone") || {}).value || null,
        subject: (document.getElementById("c-subject") || {}).value || null,
        message: message.value.trim()
      })
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Send failed (" + res.status + ")");
        statusEl.className = "status-msg is-ok";
        statusEl.textContent = "Thanks — we've got it and we'll get back to you.";
        form.reset();
      })
      .catch(function () {
        statusEl.className = "status-msg is-error";
        statusEl.textContent =
          "We couldn't send that. Please call Keystone at 970-485-6974 or Copper at 970-475-4373.";
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = "Send message";
      });
  });

  function fail(msg, field) {
    statusEl.className = "status-msg is-error";
    statusEl.textContent = msg;
    if (field) field.focus();
    return false;
  }
})();
