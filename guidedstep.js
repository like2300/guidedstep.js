/**
 * GuidedStep JS - Bibliothèque de tutoriels guidés
 * Version 2.4.0 — Cible visible + Bouton flottant de relance (gs-player)
 */

(function (window) {
  "use strict";

  const defaults = {
    persist: true,
    storageKey: "gs_state",
    autoScroll: true,
    scrollBehavior: "smooth",
    overlayMode: "color",
    overlayBlur: 8,
    theme: {
      primaryColor: "#141414",
      borderRadius: "12px",
      overlayColor: "rgba(253, 253, 252, 0.85)",
      overlayTint: "rgba(0, 0, 0, 0.28)",
    },
    onStart: null,
    onComplete: null,
    onSkip: null,
    onElementMissing: null,
  };

  let config = {};
  let steps = [];
  let currentStep = 0;
  let isActive = false;
  let missingCount = 0;

  let overlay = null;
  let cut = null;
  let card = null;
  let progressBar = null;
  let currentHighlightedEl = null;

  // NOUVEAU : Référence au bouton flottant
  let fab = null;

  let actionTarget = null;
  let actionHandler = null;
  let resizeObserver = null;
  let scrollRaf = 0;
  let positionToken = 0;

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const reducedMotion = () =>
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── 01 · Initialisation & Parsing robuste ───────────────────────────── */

  function init(options = {}) {
    config = {
      ...defaults,
      ...options,
      theme: { ...defaults.theme, ...options.theme },
    };

    if (config.persist) {
      const saved = parseInt(localStorage.getItem(config.storageKey), 10);
      if (!isNaN(saved) && saved >= 0 && saved < steps.length)
        currentStep = saved;
    }

    parseSteps();
    applyTheme();
    initFab(); // NOUVEAU : Vérifie et crée le bouton flottant si nécessaire
    return GuidedStep;
  }

  // NOUVEAU : Création du bouton flottant si gs-player="true" est sur le body
  function initFab() {
    if (document.body.getAttribute("gs-player") === "true" && !fab) {
      fab = document.createElement("button");
      fab.className = "guidedstep-fab";
      fab.innerHTML = `
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 5v14l11-7z"/>
        </svg>
        <span>Revoir le guide</span>
      `;
      fab.setAttribute("aria-label", "Revoir le guide interactif");
      fab.addEventListener("click", () => {
        GuidedStep.restart();
      });
      document.body.appendChild(fab);
    }
  }

  function applyTheme() {
    const root = document.documentElement;
    const t = config.theme;
    const blur = config.overlayMode === "blur";
    root.style.setProperty("--guidedstep-primary", t.primaryColor);
    root.style.setProperty("--gs-accent", t.primaryColor);
    root.style.setProperty("--guidedstep-radius", t.borderRadius);
    root.style.setProperty("--guidedstep-overlay", t.overlayColor);
    root.style.setProperty("--gs-veil", blur ? t.overlayTint : t.overlayColor);
    const px = Math.max(0, parseFloat(config.overlayBlur) || 8);
    root.style.setProperty("--gs-overlay-blur", `${px}px`);
  }

  function parseSteps() {
    steps = [];
    document.querySelectorAll("[gs-step]").forEach((el) => {
      let pos = (el.getAttribute("gs-position") || "auto").trim().toLowerCase();
      if (!["top", "bottom", "left", "right", "auto"].includes(pos))
        pos = "auto";

      let transition = (el.getAttribute("gs-transition") || "auto")
        .trim()
        .toLowerCase();
      if (!["top", "bottom", "left", "right", "auto"].includes(transition))
        transition = "auto";

      steps.push({
        index: parseInt(el.getAttribute("gs-step"), 10) || 0,
        element: el,
        selector: getSelector(el),
        title: el.getAttribute("gs-title") || "",
        content: el.getAttribute("gs-content") || "",
        position: pos,
        transition: transition,
        action: el.getAttribute("gs-action") || "next",
      });
    });
    steps.sort((a, b) => a.index - b.index);
  }

  function getSelector(el) {
    if (el.id) return `#${el.id}`;
    const cls = el.getAttribute("class");
    if (cls && cls.trim()) {
      const firstClass = cls.trim().split(/\s+/)[0];
      return `${el.tagName.toLowerCase()}.${firstClass}`;
    }
    return el.tagName.toLowerCase();
  }

  /* ── 02 · Démarrage / arrêt ──────────────────────────────────────────── */

  function start(stepIndex = 0) {
    if (steps.length === 0) return console.warn("GuidedStep: Aucune étape");
    if (isActive) return goTo(stepIndex);

    currentStep = clamp(stepIndex, 0, steps.length - 1);
    missingCount = 0;
    isActive = true;
    document.body.classList.add("guidedstep-active"); // Masque le FAB via CSS

    createOverlay();
    requestAnimationFrame(
      () => overlay && overlay.classList.add("guidedstep-overlay--active"),
    );

    showStep(currentStep);
    if (typeof config.onStart === "function")
      config.onStart(currentStep, steps);
    saveState();
  }

  function createOverlay() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "guidedstep-overlay";
    if (config.overlayMode === "blur")
      overlay.classList.add("guidedstep-overlay--blur");
    cut = document.createElement("div");
    cut.className = "guidedstep-overlay-cut";
    overlay.appendChild(cut);
    document.body.appendChild(overlay);

    window.addEventListener("scroll", onViewportChange, { passive: true });
    window.addEventListener("resize", onViewportChange);
  }

  function onViewportChange() {
    if (!isActive) return;
    if (scrollRaf) cancelAnimationFrame(scrollRaf);
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      reposition();
    });
  }

  function reposition() {
    if (!isActive || !card) return;
    const step = steps[currentStep];
    const el = step && step.element;
    if (!el || !document.contains(el)) return;

    updateCut(el);
    positionCard(el, step.position);
  }

  /* ── 03 · Affichage d'une étape ──────────────────────────────────────── */

  function showStep(index) {
    if (index < 0 || index >= steps.length) return complete();
    currentStep = index;
    const step = steps[index];

    const targetEl =
      step.element && document.contains(step.element)
        ? step.element
        : document.querySelector(step.selector);

    if (!targetEl || !isElementVisible(targetEl)) {
      handleMissingElement(step, index);
      return;
    }

    if (!card) createCard();
    cleanupAction();

    positionToken++;
    revealAndRender(step, targetEl, positionToken);

    missingCount = 0;
    saveState();
  }

  function createCard() {
    card = document.createElement("div");
    card.className = "guidedstep-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", "guidedstep-title");

    card.innerHTML = `
      <span class="guidedstep-progressbar" style="width:0%"></span>
      <div class="guidedstep-card-body">
        <div class="guidedstep-card-meta" data-step="1">Étape 1/1</div>
        <h3 class="guidedstep-card-title" id="guidedstep-title"></h3>
        <div class="guidedstep-card-text" aria-live="polite"></div>
      </div>
      <div class="guidedstep-actions">
        <button class="guidedstep-btn guidedstep-btn-prev" aria-label="Précédent">← Retour</button>
        <div class="guidedstep-spacer"></div>
        <button class="guidedstep-btn guidedstep-btn-skip" aria-label="Passer">Passer</button>
        <button class="guidedstep-btn guidedstep-btn-next" aria-label="Suivant">Suivant →</button>
      </div>
    `;

    progressBar = card.querySelector(".guidedstep-progressbar");
    card.querySelector(".guidedstep-btn-next").addEventListener("click", next);
    card.querySelector(".guidedstep-btn-prev").addEventListener("click", prev);
    card.querySelector(".guidedstep-btn-skip").addEventListener("click", skip);

    document.addEventListener("keydown", handleKeydown);
    document.body.appendChild(card);
  }

  function updateCard(step) {
    const title = card.querySelector(".guidedstep-card-title");
    const text = card.querySelector(".guidedstep-card-text");
    const meta = card.querySelector(".guidedstep-card-meta");
    const prevBtn = card.querySelector(".guidedstep-btn-prev");
    const nextBtn = card.querySelector(".guidedstep-btn-next");

    title.textContent = step.title;
    text.innerHTML = `<p>${step.content}</p>`;

    meta.textContent = `Étape ${currentStep + 1}/${steps.length}`;
    meta.setAttribute("data-step", currentStep + 1);

    prevBtn.style.visibility = currentStep > 0 ? "visible" : "hidden";
    nextBtn.textContent =
      currentStep < steps.length - 1 ? "Suivant" : "Terminer";

    const primaryBtn = card.querySelector(".guidedstep-btn-next");
    if (primaryBtn)
      setTimeout(() => primaryBtn.focus({ preventScroll: true }), 100);
  }

  /* ── 04 · Positionnement (gs-position respecté) ──────────────────────── */

  function positionCard(targetEl, preferredPosition, animate = false) {
    const rect = targetEl.getBoundingClientRect();
    const gap = 24;
    const margin = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const cardW =
      card.offsetWidth > 0 ? card.offsetWidth : Math.min(360, vw - 2 * margin);
    const cardH = card.offsetHeight > 0 ? card.offsetHeight : 200;

    const space = {
      top: rect.top - margin,
      bottom: vh - rect.bottom - margin,
      left: rect.left - margin,
      right: vw - rect.right - margin,
    };

    let pos = preferredPosition;
    if (pos === "auto") pos = resolveAuto(space, cardW, cardH, vw, vh, gap);
    pos = forceFit(pos, space, cardW, cardH, gap);

    const cx = clamp(rect.left + rect.width / 2, margin, vw - margin);
    const cy = clamp(rect.top + rect.height / 2, margin, vh - margin);

    let cardTop, cardLeft;

    switch (pos) {
      case "top":
        cardTop = clamp(
          rect.top - cardH - gap,
          margin,
          Math.max(margin, vh - cardH - margin),
        );
        cardLeft = clamp(
          cx - cardW / 2,
          margin,
          Math.max(margin, vw - cardW - margin),
        );
        break;
      case "bottom":
        cardTop = clamp(
          rect.bottom + gap,
          margin,
          Math.max(margin, vh - cardH - margin),
        );
        cardLeft = clamp(
          cx - cardW / 2,
          margin,
          Math.max(margin, vw - cardW - margin),
        );
        break;
      case "left":
        cardTop = clamp(
          cy - cardH / 2,
          margin,
          Math.max(margin, vh - cardH - margin),
        );
        cardLeft = clamp(
          rect.left - cardW - gap,
          margin,
          Math.max(margin, vw - cardW - margin),
        );
        break;
      case "right":
        cardTop = clamp(
          cy - cardH / 2,
          margin,
          Math.max(margin, vh - cardH - margin),
        );
        cardLeft = clamp(
          rect.right + gap,
          margin,
          Math.max(margin, vw - cardW - margin),
        );
        break;
    }

    card.style.left = `${Math.round(cardLeft)}px`;
    card.style.top = `${Math.round(cardTop)}px`;
    card.setAttribute("data-placement", pos);

    return pos;
  }

  function resolveAuto(space, cardW, cardH, vw, vh, gap) {
    const margin = 16;
    const canTop = space.top >= cardH + gap && vw >= cardW + 2 * margin;
    const canBottom = space.bottom >= cardH + gap && vw >= cardW + 2 * margin;
    const canLeft = space.left >= cardW + gap && vh >= cardH + 2 * margin;
    const canRight = space.right >= cardW + gap && vh >= cardH + 2 * margin;

    const candidates = [];
    if (canBottom) candidates.push({ p: "bottom", s: space.bottom });
    if (canTop) candidates.push({ p: "top", s: space.top });
    if (canRight) candidates.push({ p: "right", s: space.right });
    if (canLeft) candidates.push({ p: "left", s: space.left });

    if (candidates.length) candidates.sort((a, b) => b.s - a.s);
    if (candidates.length) return candidates[0].p;

    return ["bottom", "top", "right", "left"].sort(
      (a, b) => space[b] - space[a],
    )[0];
  }

  function forceFit(pos, space, cardW, cardH, gap) {
    if (
      pos === "bottom" &&
      space.bottom < cardH + gap &&
      space.top > space.bottom
    )
      return "top";
    if (pos === "top" && space.top < cardH + gap && space.bottom > space.top)
      return "bottom";
    if (pos === "left" && space.left < cardW + gap && space.right > space.left)
      return "right";
    if (
      pos === "right" &&
      space.right < cardW + gap &&
      space.left > space.right
    )
      return "left";
    return pos;
  }

  function updateCut(targetEl) {
    if (!cut) return;
    const rect = targetEl.getBoundingClientRect();
    cut.style.width = `${rect.width}px`;
    cut.style.height = `${rect.height}px`;
    cut.style.top = `${rect.top}px`;
    cut.style.left = `${rect.left}px`;

    const br = parseFloat(window.getComputedStyle(targetEl).borderRadius);
    cut.style.borderRadius = br > 0 ? `${Math.min(br, 12)}px` : "8px";
  }

  /* ── 05 · Gestion de la surbrillance de la cible (Anti-Flou) ─────────── */

  function highlightElement(el) {
    if (!el) return;
    if (!el.hasAttribute("data-gs-orig-pos")) {
      const computed = window.getComputedStyle(el);
      const safePos =
        computed.position === "static" ? "relative" : computed.position;
      el.setAttribute("data-gs-orig-pos", safePos);
      el.setAttribute("data-gs-orig-zindex", computed.zIndex);
      el.setAttribute("data-gs-orig-transition", computed.transition);
    }

    el.style.position = el.getAttribute("data-gs-orig-pos");
    el.style.zIndex = "99999";
    el.style.transition = "none";
  }

  function unhighlightElement(el) {
    if (!el || !el.hasAttribute("data-gs-orig-pos")) return;

    const origPos = el.getAttribute("data-gs-orig-pos");
    el.style.position = origPos === "static" ? "" : origPos;
    el.style.zIndex = el.getAttribute("data-gs-orig-zindex");
    el.style.transition = el.getAttribute("data-gs-orig-transition");

    el.removeAttribute("data-gs-orig-pos");
    el.removeAttribute("data-gs-orig-zindex");
    el.removeAttribute("data-gs-orig-transition");
  }

  /* ── 06 · Observateurs & Actions ─────────────────────────────────────── */

  function setupObservers(targetEl) {
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = new ResizeObserver(onViewportChange);
    resizeObserver.observe(targetEl);
    resizeObserver.observe(document.documentElement);
  }

  function setupAction(step, targetEl) {
    if (step.action !== "click") return;
    actionTarget = targetEl;
    actionHandler = () => next();
    targetEl.addEventListener("click", actionHandler, { once: true });
  }

  function cleanupAction() {
    if (actionTarget && actionHandler)
      actionTarget.removeEventListener("click", actionHandler);
    actionTarget = actionHandler = null;
  }

  function updateProgress() {
    if (progressBar)
      progressBar.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
  }

  /* ── 07 · Navigation & Utilitaires ───────────────────────────────────── */

  function next() {
    currentStep < steps.length - 1 ? showStep(currentStep + 1) : complete();
  }
  function prev() {
    if (currentStep > 0) showStep(currentStep - 1);
  }
  function goTo(index) {
    if (!isActive) start(index);
    else showStep(clamp(index, 0, steps.length - 1));
  }

  function skip() {
    const idx = currentStep;
    teardown();
    if (config.persist) localStorage.removeItem(config.storageKey);
    if (typeof config.onSkip === "function") config.onSkip(idx, steps);
  }

  function complete() {
    teardown();
    if (config.persist) localStorage.removeItem(config.storageKey);
    if (typeof config.onComplete === "function") config.onComplete(steps);
  }

  function handleMissingElement(step, index) {
    missingCount++;
    if (missingCount >= steps.length) return teardown();
    if (
      typeof config.onElementMissing === "function" &&
      config.onElementMissing(step, steps) === false
    )
      return teardown();
    next();
  }

  function isElementVisible(el) {
    const s = window.getComputedStyle(el);
    return (
      s.display !== "none" &&
      s.visibility !== "hidden" &&
      parseFloat(s.opacity) > 0 &&
      el.getClientRects().length > 0
    );
  }

  /* ── 08 · Défilement automatique & rendu différé ─────────────────────── */

  function revealAndRender(step, targetEl, token) {
    if (!config.autoScroll || isElementInView(targetEl)) {
      renderStep(step, targetEl);
      return;
    }

    const behavior = reducedMotion() ? "auto" : config.scrollBehavior;
    performScroll(targetEl, behavior);

    if (behavior === "auto") {
      renderStep(step, targetEl);
      return;
    }

    requestAnimationFrame(() => {
      waitForScroll(targetEl, () => {
        if (token !== positionToken || !isActive) return;
        const el =
          step.element && document.contains(step.element)
            ? step.element
            : document.querySelector(step.selector);
        if (!el || !isElementVisible(el)) return;
        renderStep(step, el);
      });
    });
  }

  function renderStep(step, targetEl) {
    if (currentHighlightedEl && currentHighlightedEl !== targetEl) {
      unhighlightElement(currentHighlightedEl);
    }
    currentHighlightedEl = targetEl;
    highlightElement(targetEl);

    updateCard(step);
    updateCut(targetEl);
    const pos = positionCard(targetEl, step.position, true);
    animateCard(step, pos);
    updateProgress();
    setupObservers(targetEl);
    setupAction(step, targetEl);
  }

  function animateCard(step, pos) {
    if (!card) return;
    const dir = step.transition === "auto" ? pos : step.transition;
    ["top", "bottom", "left", "right"].forEach((d) =>
      card.classList.remove(`guidedstep-card--${d}`),
    );
    void card.offsetWidth;
    card.classList.add(`guidedstep-card--${dir}`);
  }

  function performScroll(el, behavior) {
    const smooth = behavior === "smooth";
    getScrollParents(el).forEach((p) => {
      if (p === window) return;
      const pr = p.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      const dy = er.top + er.height / 2 - (pr.top + pr.height / 2);
      const dx = er.left + er.width / 2 - (pr.left + pr.width / 2);

      if (smooth) {
        try {
          p.scrollBy({ top: dy, left: dx, behavior: "smooth" });
        } catch (e) {
          p.scrollTop += dy;
          p.scrollLeft += dx;
        }
      } else {
        p.scrollTop += dy;
        p.scrollLeft += dx;
      }
    });
    el.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      block: "center",
      inline: "nearest",
    });
  }

  function getScrollParents(el) {
    const parents = [];
    let node = el.parentElement;
    while (node) {
      const o =
        window.getComputedStyle(node).overflowY +
        window.getComputedStyle(node).overflowX;
      if (/(auto|scroll|overlay)/.test(o)) parents.push(node);
      node = node.parentElement;
    }
    parents.push(window);
    return parents;
  }

  function isElementInView(el) {
    const r = el.getBoundingClientRect();
    if (
      r.top < 0 ||
      r.left < 0 ||
      r.bottom > window.innerHeight ||
      r.right > window.innerWidth
    )
      return false;

    for (const p of getScrollParents(el)) {
      if (p === window) continue;
      const pr = p.getBoundingClientRect();
      const prl = pr.left + (p.clientLeft || 0);
      const prt = pr.top + (p.clientTop || 0);
      const prr = prl + p.clientWidth;
      const prb = prt + p.clientHeight;
      if (r.top < prt || r.left < prl || r.bottom > prb || r.right > prr)
        return false;
    }
    return true;
  }

  function waitForScroll(targetEl, cb) {
    const parents = getScrollParents(targetEl);
    const scrollPositions = () =>
      parents
        .map((p) =>
          p === window
            ? `${window.scrollX},${window.scrollY}`
            : `${p.scrollLeft},${p.scrollTop}`,
        )
        .join("|");

    let last = scrollPositions();
    let stableFrames = 0;
    let done = false;
    let raf = 0;
    const timer = setTimeout(finish, 700);

    function finish() {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      cb();
    }
    function tick() {
      if (done) return;
      const snap = scrollPositions();
      if (snap === last) {
        stableFrames++;
        if (stableFrames >= 2) return finish();
      } else {
        stableFrames = 0;
        last = snap;
      }
      raf = requestAnimationFrame(tick);
    }
    tick();
  }

  function teardown() {
    isActive = false;
    document.body.classList.remove("guidedstep-active"); // Réaffiche le FAB via CSS
    if (scrollRaf) cancelAnimationFrame(scrollRaf);
    window.removeEventListener("scroll", onViewportChange);
    window.removeEventListener("resize", onViewportChange);
    document.removeEventListener("keydown", handleKeydown);
    if (resizeObserver) resizeObserver.disconnect();
    cleanupAction();

    if (currentHighlightedEl) {
      unhighlightElement(currentHighlightedEl);
      currentHighlightedEl = null;
    }

    [overlay, card].forEach((el) => el && el.remove());
    overlay = cut = card = progressBar = null;
  }

  function handleKeydown(e) {
    if (!isActive) return;
    if (e.key === "Escape") skip();
    else if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    }
  }

  function saveState() {
    if (config.persist && isActive)
      localStorage.setItem(config.storageKey, String(currentStep));
  }

  const GuidedStep = {
    init,
    start,
    stop: skip,
    restart: () => {
      skip();
      setTimeout(() => start(0), 120);
    },
    next,
    prev,
    skip,
    goTo,
    parseSteps,
    isActive: () => isActive,
    getCurrentStep: () => currentStep,
    getSteps: () => steps,
  };

  window.GuidedStep = GuidedStep;
})(window);
