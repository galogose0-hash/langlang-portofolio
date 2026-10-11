(function () {
  "use strict";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  var header = document.getElementById("header");
  var navShell = document.getElementById("navShell");
  var menuBtn = document.getElementById("menuBtn");
  var menuIcon = document.getElementById("menuIcon");
  var mobileMenu = document.getElementById("mobileMenu");

  /* ============ 1. MOBILE DRAWER MENU ============ */
  function setMenu(open) {
    mobileMenu.classList.toggle("open", open);
    mobileMenu.classList.toggle("mt-2", open);
    menuIcon.className = open ? "fa-solid fa-xmark text-base" : "fa-solid fa-bars text-base";
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  menuBtn.addEventListener("click", function () {
    setMenu(!mobileMenu.classList.contains("open"));
  });
  mobileMenu.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () { setMenu(false); });
  });
  document.addEventListener("click", function (e) {
    if (!mobileMenu.classList.contains("open")) return;
    if (mobileMenu.contains(e.target) || menuBtn.contains(e.target)) return;
    setMenu(false);
  });

  /* ============ 2. SMOOTH SCROLLING (with header offset) ============ */
  function smoothScrollTo(hash) {
    var target = document.querySelector(hash);
    if (!target) return;
    var offset = header.offsetHeight + 12;
    var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: top < 0 ? 0 : top, behavior: reduceMotion ? "auto" : "smooth" });
  }
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (e) {
      var hash = link.getAttribute("href");
      if (hash === "#" || hash.length < 2) return;
      if (link.hasAttribute("data-contact-open")) return;
      if (!document.querySelector(hash)) return;
      e.preventDefault();
      setMenu(false);
      smoothScrollTo(hash);
      if (history.replaceState) history.replaceState(null, "", hash);
    });
  });

  /* ============ 3. SCROLL STATE: navbar, progress, back-to-top ============ */
  var progress = document.getElementById("scrollProgress");
  var toTop = document.getElementById("toTop");
  function onScroll() {
    var y = window.scrollY;
    var scrolled = y > 24;
    header.classList.toggle("bg-cream/85", scrolled);
    header.classList.toggle("backdrop-blur-md", scrolled);
    header.classList.toggle("shadow-soft", scrolled);
    navShell.classList.toggle("py-2", scrolled);
    navShell.classList.toggle("py-4", !scrolled);

    var max = document.documentElement.scrollHeight - window.innerHeight;
    var ratio = max > 0 ? Math.min(y / max, 1) : 0;
    if (progress) progress.style.transform = "scaleX(" + ratio + ")";
    if (toTop) toTop.classList.toggle("show", y > 500);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  if (toTop) {
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  /* ============ 4. SCROLL REVEAL ============ */
  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach(function (el) { revealObserver.observe(el); });

  /* ============ 5. ACTIVE NAV LINK ============ */
  var links = document.querySelectorAll("[data-link]");
  var sections = [];
  links.forEach(function (link) {
    var target = document.querySelector(link.getAttribute("href"));
    if (target) sections.push({ link: link, target: target });
  });
  var navObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        links.forEach(function (l) { l.classList.remove("bg-white", "text-ink", "shadow-soft"); });
        var match = sections.find(function (s) { return s.target === entry.target; });
        if (match) match.link.classList.add("bg-white", "text-ink", "shadow-soft");
      }
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach(function (s) { navObserver.observe(s.target); });

  /* ============ 6. COUNT-UP STATS ============ */
  var counters = document.querySelectorAll("[data-count]");
  var countObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      var end = parseInt(el.getAttribute("data-count"), 10) || 0;
      var suffix = el.textContent.replace(/[0-9]/g, "") || "";
      if (reduceMotion) { el.textContent = end + suffix; countObserver.unobserve(el); return; }
      var start = null, dur = 1400;
      function step(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(eased * end) + suffix;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
      countObserver.unobserve(el);
    });
  }, { threshold: 0.5 });
  counters.forEach(function (el) { countObserver.observe(el); });

  /* ============ 7. INTERACTIVE TILT CARDS ============ */
  if (finePointer && !reduceMotion) {
    document.querySelectorAll(".tilt").forEach(function (card) {
      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = "perspective(900px) rotateY(" + (px * 9) + "deg) rotateX(" + (-py * 9) + "deg) translateY(-6px)";
      });
      card.addEventListener("mouseleave", function () { card.style.transform = ""; });
    });

    /* ============ 8. MAGNETIC BUTTONS ============ */
    document.querySelectorAll(".magnetic").forEach(function (btn) {
      btn.addEventListener("mousemove", function (e) {
        var r = btn.getBoundingClientRect();
        var x = e.clientX - r.left - r.width / 2;
        var y = e.clientY - r.top - r.height / 2;
        btn.style.transform = "translate(" + (x * 0.25) + "px," + (y * 0.35) + "px)";
      });
      btn.addEventListener("mouseleave", function () { btn.style.transform = ""; });
    });

    /* ============ 9. HERO PARALLAX BADGES ============ */
    var parallaxEls = document.querySelectorAll("[data-parallax]");
    var hero = document.getElementById("home");
    if (hero) {
      hero.addEventListener("mousemove", function (e) {
        var r = hero.getBoundingClientRect();
        var cx = e.clientX - r.left - r.width / 2;
        var cy = e.clientY - r.top - r.height / 2;
        parallaxEls.forEach(function (el) {
          var d = parseFloat(el.getAttribute("data-parallax")) / 10;
          el.style.transform = "translate(" + (cx * d * 0.02) + "px," + (cy * d * 0.02) + "px)";
        });
      });
    }

    /* ============ 10. CURSOR GLOW ============ */
    var glow = document.getElementById("cursorGlow");
    if (glow) {
      var gx = 0, gy = 0, tx = 0, ty = 0;
      document.addEventListener("mousemove", function (e) {
        document.body.classList.add("has-cursor");
        tx = e.clientX; ty = e.clientY;
      });
      (function follow() {
        gx += (tx - gx) * 0.12;
        gy += (ty - gy) * 0.12;
        glow.style.transform = "translate(" + gx + "px," + gy + "px) translate(-50%,-50%)";
        requestAnimationFrame(follow);
      })();
      document.addEventListener("mouseleave", function () { document.body.classList.remove("has-cursor"); });
    }
  }

  /* ============ 11. TESTIMONIAL CAROUSEL ============ */
  var track = document.getElementById("testiTrack");
  var prevBtn = document.getElementById("testiPrev");
  var nextBtn = document.getElementById("testiNext");
  if (track && prevBtn && nextBtn) {
    function scrollTrack(dir) {
      var card = track.querySelector("article");
      var amount = card ? card.offsetWidth + 24 : track.clientWidth * 0.85;
      track.scrollBy({ left: dir * amount, behavior: reduceMotion ? "auto" : "smooth" });
    }
    prevBtn.addEventListener("click", function () { scrollTrack(-1); });
    nextBtn.addEventListener("click", function () { scrollTrack(1); });
  }

  /* ============ 12. VIDEO LIGHTBOX ============ */
  var vModal = document.getElementById("introModal");
  var video = document.getElementById("introVideo");
  var vOpen = document.getElementById("watchIntro");
  var vClose = document.getElementById("introClose");
  function openVideo() {
    vModal.classList.remove("hidden");
    vModal.classList.add("flex");
    document.body.style.overflow = "hidden";
  }
  function closeVideo() {
    vModal.classList.add("hidden");
    vModal.classList.remove("flex");
    if (video) video.pause();
    if (!contactEl.classList.contains("open")) document.body.style.overflow = "";
  }
  if (vOpen && vModal && vClose) {
    vOpen.addEventListener("click", openVideo);
    vClose.addEventListener("click", closeVideo);
    vModal.addEventListener("click", function (e) { if (e.target === vModal) closeVideo(); });
  }

  /* ============ 13. CONTACT MODAL ============ */
  var contactEl = document.getElementById("contactModal");
  var contactPanel = document.getElementById("contactPanel");
  var contactClose = document.getElementById("contactClose");
  var contactDone = document.getElementById("contactDone");
  var contactBackdrop = document.getElementById("contactBackdrop");
  var contactForm = document.getElementById("contactForm");
  var contactSuccess = document.getElementById("contactSuccess");
  var formError = document.getElementById("formError");
  var lastFocused = null;

  function openContact() {
    lastFocused = document.activeElement;
    contactEl.classList.add("open");
    contactForm.classList.remove("hidden");
    contactSuccess.classList.add("hidden");
    contactSuccess.classList.remove("flex");
    formError.classList.add("hidden");
    document.body.style.overflow = "hidden";
    setMenu(false);
    setTimeout(function () {
      var first = document.getElementById("cName");
      if (first) first.focus();
    }, 320);
  }
  function closeContact() {
    contactEl.classList.remove("open");
    if (!vModal || vModal.classList.contains("hidden")) document.body.style.overflow = "";
    if (lastFocused && lastFocused.focus) lastFocused.focus();
    setTimeout(function () { contactForm.reset(); }, 350);
  }
  document.querySelectorAll("[data-contact-open]").forEach(function (btn) {
    btn.addEventListener("click", function (e) { e.preventDefault(); openContact(); });
  });
  if (contactClose) contactClose.addEventListener("click", closeContact);
  if (contactDone) contactDone.addEventListener("click", closeContact);
  if (contactBackdrop) contactBackdrop.addEventListener("click", closeContact);

  if (contactForm) {
    var formErrorDefault = formError.textContent;
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = document.getElementById("cName").value.trim();
      var email = document.getElementById("cEmail").value.trim();
      var msg = document.getElementById("cMessage").value.trim();
      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!name || !emailOk || !msg) {
        formError.textContent = formErrorDefault;
        formError.classList.remove("hidden");
        return;
      }
      formError.classList.add("hidden");
      var label = document.getElementById("submitLabel");
      var submitBtn = contactForm.querySelector('button[type="submit"]');
      label.textContent = "Sending...";
      if (submitBtn) submitBtn.disabled = true;

      fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(contactForm)
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data && data.success) {
            contactForm.classList.add("hidden");
            contactSuccess.classList.remove("hidden");
            contactSuccess.classList.add("flex");
          } else {
            throw new Error((data && data.message) || "Failed to send");
          }
        })
        .catch(function () {
          formError.textContent = "Sorry, something went wrong. Please email langlangsyaban2@gmail.com directly.";
          formError.classList.remove("hidden");
        })
        .finally(function () {
          label.textContent = "Send Message";
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* ============ 14. DAY / NIGHT THEME ============ */
  var themeToggle = document.getElementById("themeToggle");
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var moonIcon = document.querySelector('[data-theme-icon="moon"]');
  var sunIcon = document.querySelector('[data-theme-icon="sun"]');

  function syncThemeIcons(dark) {
    if (moonIcon) moonIcon.classList.toggle("hidden", dark);
    if (sunIcon) sunIcon.classList.toggle("hidden", !dark);
    if (themeToggle) themeToggle.setAttribute("aria-pressed", dark ? "true" : "false");
    if (themeMeta) themeMeta.setAttribute("content", dark ? "#12151A" : "#FBF9F5");
  }
  function applyTheme(dark, persist) {
    document.documentElement.classList.toggle("dark", dark);
    if (persist) { try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch (e) {} }
    syncThemeIcons(dark);
  }
  syncThemeIcons(document.documentElement.classList.contains("dark"));
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      applyTheme(!document.documentElement.classList.contains("dark"), true);
    });
  }
  var systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  if (systemTheme.addEventListener) {
    systemTheme.addEventListener("change", function (e) {
      var saved = null;
      try { saved = localStorage.getItem("theme"); } catch (err) {}
      if (!saved) applyTheme(e.matches, false);
    });
  }

  /* ============ 15. GLOBAL ESCAPE ============ */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (contactEl.classList.contains("open")) closeContact();
    if (vModal && !vModal.classList.contains("hidden")) closeVideo();
  });
})();
