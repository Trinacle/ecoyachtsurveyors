/* ============================================================
   Eco Yacht Surveyors — Site JS
   Theme toggle · mobile nav · scroll reveal · parallax ·
   counters · FAQ accordion · header scroll · form validation
   ============================================================ */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Theme ---------- */
  var THEME_KEY = "ecoys-theme";

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#08111d" : "#fffbf0");
    var og = document.querySelector('meta[property="og:image"]');
    // keep og image stable
  }

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (saved === "dark" || saved === "light") {
      applyTheme(saved);
    } else {
      var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyTheme(prefersDark ? "dark" : "light");
    }
  }
  initTheme();
  // apply immediately to avoid FOUC — also re-run on DOMContentLoaded for safety
  document.addEventListener("DOMContentLoaded", initTheme);

  function toggleTheme() {
    var current = root.getAttribute("data-theme") || "light";
    var next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  }

  document.addEventListener("DOMContentLoaded", function () {
    /* Theme buttons */
    var togglers = document.querySelectorAll("[data-theme-toggle]");
    togglers.forEach(function (t) {
      t.addEventListener("click", toggleTheme);
      t.setAttribute("aria-label", "Toggle dark and light theme");
    });

    /* Header scrolled state */
    var header = document.querySelector(".site-header");
    function onScrollHeader() {
      if (!header) return;
      if (window.scrollY > 24) header.classList.add("scrolled");
      else header.classList.remove("scrolled");
    }
    onScrollHeader();
    window.addEventListener("scroll", onScrollHeader, { passive: true });

    /* Mobile menu */
    var toggle = document.querySelector(".nav-toggle");
    var menu = document.querySelector(".mobile-menu");
    if (toggle && menu) {
      function setMenu(open) {
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        menu.classList.toggle("open", open);
        document.body.style.overflow = open ? "hidden" : "";
      }
      toggle.addEventListener("click", function () {
        setMenu(menu.classList.contains("open") ? false : true);
      });
      menu.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () { setMenu(false); });
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && menu.classList.contains("open")) setMenu(false);
      });
    }

    /* Scroll reveal */
    var revealEls = document.querySelectorAll("[data-reveal], .clip-reveal");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealEls.forEach(function (el) { el.classList.add("in"); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
      revealEls.forEach(function (el) { io.observe(el); });
    }

    /* Counters */
    var counters = document.querySelectorAll("[data-count]");
    if (counters.length) {
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          var target = parseFloat(el.getAttribute("data-count"));
          var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
          var dur = parseInt(el.getAttribute("data-dur") || "1800", 10);
          if (reduceMotion) { el.textContent = target.toFixed(decimals); cio.unobserve(el); return; }
          var start = null;
          function step(ts) {
            if (!start) start = ts;
            var p = Math.min((ts - start) / dur, 1);
            var eased = 1 - Math.pow(1 - p, 3);
            el.textContent = (target * eased).toFixed(decimals);
            if (p < 1) requestAnimationFrame(step);
            else el.textContent = target.toFixed(decimals);
          }
          requestAnimationFrame(step);
          cio.unobserve(el);
        });
      }, { threshold: 0.5 });
      counters.forEach(function (c) { cio.observe(c); });
    }

    /* Parallax */
    if (!reduceMotion && window.matchMedia("(pointer: fine)").matches) {
      var pxLayers = document.querySelectorAll("[data-parallax]");
      var ticking = false;
      function pxUpdate() {
        var vh = window.innerHeight;
        pxLayers.forEach(function (layer) {
          var speed = parseFloat(layer.getAttribute("data-parallax")) || 0.2;
          var rect = layer.getBoundingClientRect();
          if (rect.bottom < -200 || rect.top > vh + 200) return;
          var center = rect.top + rect.height / 2 - vh / 2;
          var shift = (-center * speed) / 10;
          layer.style.transform = "translate3d(0," + shift.toFixed(1) + "px,0)";
        });
        ticking = false;
      }
      window.addEventListener("scroll", function () {
        if (!ticking) { window.requestAnimationFrame(pxUpdate); ticking = true; }
      }, { passive: true });
      pxUpdate();
    }

    /* FAQ accordion */
    document.querySelectorAll(".faq-q").forEach(function (q) {
      q.addEventListener("click", function () {
        var expanded = q.getAttribute("aria-expanded") === "true";
        // optional single-open: close siblings in same list
        var group = q.closest(".faq-list");
        if (group) {
          group.querySelectorAll(".faq-q").forEach(function (sib) {
            if (sib !== q) {
              sib.setAttribute("aria-expanded", "false");
              var pa = document.getElementById(sib.getAttribute("aria-controls"));
              if (pa) pa.style.maxHeight = null;
            }
          });
        }
        q.setAttribute("aria-expanded", expanded ? "false" : "true");
        var panel = document.getElementById(q.getAttribute("aria-controls"));
        if (panel) panel.style.maxHeight = expanded ? null : panel.scrollHeight + "px";
      });
    });

    /* Contact form validation -> Twenty CRM placeholder */
    var form = document.getElementById("lead-form");
    if (form) {
      var status = document.getElementById("form-status");
      function showError(field, msg) {
        var wrap = field.closest(".field");
        var err = wrap ? wrap.querySelector(".error") : null;
        if (err) err.textContent = msg;
        field.setAttribute("aria-invalid", msg ? "true" : "false");
      }
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var valid = true;
        var required = form.querySelectorAll("[data-required]");
        required.forEach(function (field) {
          var val = (field.value || "").trim();
          var msg = "";
          if (!val) {
            msg = "This field is required.";
          } else if (field.type === "email") {
            var ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
            if (!ok) msg = "Please enter a valid email address.";
          } else if (field.type === "tel") {
            if (val.replace(/[^0-9]/g, "").length < 10) msg = "Please enter a valid phone number.";
          }
          showError(field, msg);
          if (msg) valid = false;
        });
        if (!valid) {
          var firstErr = form.querySelector('[aria-invalid="true"]');
          if (firstErr) firstErr.focus();
          return;
        }
        var btn = form.querySelector("[type=submit]");
        if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = "Sending…"; }

        /* POST to our server-side handler (/api/contact), which forwards the
           lead to the office inbox via SparkPost. Falls back to mailto if the
           API is unavailable (e.g. when previewing without the Node server). */
        var payload = {
          first_name: (form.querySelector("#fname")||{}).value || "",
          last_name:  (form.querySelector("#lname")||{}).value || "",
          email:      (form.querySelector("#email")||{}).value || "",
          phone:      (form.querySelector("#phone")||{}).value || "",
          service:    (form.querySelector("#service")||{}).value || "",
          vessel:     (form.querySelector("#vessel")||{}).value || "",
          loa:        (form.querySelector("#loa")||{}).value || "",
          location:   (form.querySelector("#location")||{}).value || "",
          message:    (form.querySelector("#message")||{}).value || "",
          source:     "ecoyachtsurveyors.com/contact"
        };
        fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).then(function (res) {
          if (!res.ok) throw new Error("Bad response");
          return res.json();
        }).then(function () {
          onSuccess();
        }).catch(function () {
          /* Fallback: open the user's mail client so the lead is never lost */
          var subject = encodeURIComponent("Survey request — " + payload.first_name + " " + payload.last_name);
          var body = encodeURIComponent(
            "Name: " + payload.first_name + " " + payload.last_name + "\n" +
            "Email: " + payload.email + "\n" +
            "Phone: " + payload.phone + "\n" +
            "Service: " + payload.service + "\n" +
            "Vessel: " + payload.vessel + "\n" +
            "LOA: " + payload.loa + "\n" +
            "Location: " + payload.location + "\n\n" +
            payload.message
          );
          window.location.href = "mailto:admin@ecoyachtsurveyors.com?subject=" + subject + "&body=" + body;
          onSuccess();
        });

        function onSuccess() {
          form.reset();
          required.forEach(function (f) { showError(f, ""); });
          if (status) { status.classList.add("show"); status.setAttribute("tabindex", "-1"); status.focus(); }
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
          if (window.dataLayer) window.dataLayer.push({ event: "lead_submit", service: payload.service || "contact" });
        }
      });
      form.querySelectorAll("[data-required]").forEach(function (field) {
        field.addEventListener("input", function () { showError(field, ""); });
      });
    }

    /* Footer year */
    var yr = document.querySelectorAll("[data-year]");
    yr.forEach(function (el) { el.textContent = new Date().getFullYear(); });

    /* Subtle tilt on hero (desktop, fine pointer) */
    if (!reduceMotion && window.matchMedia("(pointer: fine)").matches) {
      var hero = document.querySelector(".hero");
      var heroMedia = document.querySelector(".hero-media img");
      if (hero && heroMedia) {
        hero.addEventListener("mousemove", function (e) {
          var r = hero.getBoundingClientRect();
          var x = (e.clientX - r.left) / r.width - 0.5;
          var y = (e.clientY - r.top) / r.height - 0.5;
          heroMedia.style.transform = "scale(1.06) translate(" + (x * -14).toFixed(1) + "px," + (y * -10).toFixed(1) + "px)";
        });
        hero.addEventListener("mouseleave", function () { heroMedia.style.transform = ""; });
      }
    }
  });
})();
