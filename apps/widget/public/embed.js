/*
 * Booking Widget embed script (ADR-0004 / issue #9).
 *
 * This file is served verbatim as a static asset at a single, always-latest
 * URL — it is NOT built/bundled from TypeScript. It has to run, unmodified,
 * on an arbitrary third-party host page whose stack we don't control, so it
 * deliberately avoids `import`/`export`, any framework assumption, and any
 * dependency on this repo's own tooling. A classic (non-module) <script> tag
 * is the contract; `document.currentScript` only resolves correctly while
 * the script is executing synchronously for the first time, so all config
 * reading happens once, up front, in init().
 *
 * Pure helpers (buildDrawerSrc, readConfig) are exposed on
 * `window.Platform.__internal` ONLY so apps/widget/test/embed/embed.test.ts
 * can exercise this exact file's logic via a vm sandbox without needing a
 * real DOM — they are not part of the documented public API
 * (window.Platform.open/close are).
 */
(function () {
  "use strict";

  var STYLE_ID = "platform-widget-styles";
  var STYLES =
    "#platform-widget-trigger{position:fixed;bottom:24px;right:24px;z-index:2147483000;" +
    "padding:14px 22px;border-radius:999px;border:none;background:#111;color:#fff;" +
    "font:600 15px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);}" +
    "#platform-widget-trigger:hover{opacity:.9;}" +
    "#platform-widget-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.4);" +
    "z-index:2147483001;opacity:0;pointer-events:none;transition:opacity .2s ease;}" +
    "#platform-widget-backdrop.pw-open{opacity:1;pointer-events:auto;}" +
    "#platform-widget-drawer{position:fixed;top:0;right:0;bottom:0;width:35vw;" +
    "background:#fff;z-index:2147483002;box-shadow:-8px 0 24px rgba(0,0,0,.2);" +
    "transform:translateX(100%);transition:transform .25s ease;display:flex;" +
    "flex-direction:column;}" +
    "#platform-widget-drawer.pw-open{transform:translateX(0);}" +
    "#platform-widget-drawer iframe{flex:1;width:100%;height:100%;border:none;}" +
    "#platform-widget-spinner{position:absolute;inset:0;display:flex;" +
    "align-items:center;justify-content:center;background:#fff;}" +
    "#platform-widget-spinner .pw-spin{width:32px;height:32px;border-radius:50%;" +
    "border:3px solid #ddd;border-top-color:#111;animation:pw-spin .8s linear infinite;}" +
    "@keyframes pw-spin{to{transform:rotate(360deg);}}" +
    // Mobile full-screen takeover (issue #12). Breakpoint: 768px, matching
    // this repo's existing Tailwind `md` cutoff (min-width: 768px) used
    // elsewhere in apps/admin/apps/widget — "mobile" is anything below it.
    // Below the breakpoint, the drawer covers the entire viewport (no
    // visible side-panel edge) and the backdrop's dimming is explicitly
    // zeroed out rather than relied upon to be occluded — the host page
    // behind it is already fully covered, but a once-off future stacking
    // change (e.g. from #10/#11's work on the same file) shouldn't be able
    // to make a dim backdrop reappear here as a side effect.
    "@media (max-width:767px){" +
    "#platform-widget-drawer{left:0;width:100%;box-shadow:none;}" +
    "#platform-widget-backdrop.pw-open{opacity:0;pointer-events:none;}" +
    "}";

  function injectStyles(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    var style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STYLES;
    doc.head.appendChild(style);
  }

  // Pure — builds the iframe `src` for the drawer route, against the
  // widget's own origin (not the host page's). Query params, not a path
  // segment (e.g. /drawer?tenant=dentdi, not /dentdi/drawer) — chosen for
  // this one ephemeral, never-bookmarked route; the standalone
  // cancel/reschedule pages (a later ticket) use a path segment instead,
  // since those ARE meant to be shared/bookmarked links.
  function buildDrawerSrc(widgetOrigin, tenantSlug, locale) {
    var src = widgetOrigin + "/drawer?tenant=" + encodeURIComponent(tenantSlug);
    if (locale) src += "&locale=" + encodeURIComponent(locale);
    return src;
  }

  // Pure — reads this embed's own config off a <script>-like element's
  // `dataset`. Tolerates a missing/null element so it's safe to call before
  // confirming `document.currentScript` resolved.
  function readConfig(scriptEl) {
    var ds = (scriptEl && scriptEl.dataset) || {};
    return {
      tenant: ds.tenant || null,
      locale: ds.locale || null,
      hideDefaultButton: ds.hideDefaultButton !== undefined,
    };
  }

  // Derives the widget's own deployed origin from this script's own `src`
  // attribute, so the same embed.js works against dev/staging/prod without
  // a hardcoded URL baked in at write time.
  function widgetOriginFrom(scriptEl) {
    if (!scriptEl || !scriptEl.src) return "";
    try {
      return new URL(scriptEl.src, window.location.href).origin;
    } catch (e) {
      return "";
    }
  }

  function createTrigger(doc, onClick) {
    var button = doc.createElement("button");
    button.id = "platform-widget-trigger";
    button.type = "button";
    button.textContent = "Book Now";
    button.addEventListener("click", onClick);
    doc.body.appendChild(button);
    return button;
  }

  function createDrawerChrome(doc) {
    var backdrop = doc.createElement("div");
    backdrop.id = "platform-widget-backdrop";

    var drawer = doc.createElement("div");
    drawer.id = "platform-widget-drawer";

    var spinner = doc.createElement("div");
    spinner.id = "platform-widget-spinner";
    var spin = doc.createElement("div");
    spin.className = "pw-spin";
    spinner.appendChild(spin);
    drawer.appendChild(spinner);

    doc.body.appendChild(backdrop);
    doc.body.appendChild(drawer);

    return { backdrop: backdrop, drawer: drawer, spinner: spinner };
  }

  function init() {
    var doc = document;
    var scriptEl = doc.currentScript;
    var config = readConfig(scriptEl);

    if (!config.tenant) {
      console.error(
        "[Platform widget] embed.js requires a data-tenant attribute on its own <script> tag — the widget will not render.",
      );
      return;
    }

    var widgetOrigin = widgetOriginFrom(scriptEl);
    injectStyles(doc);

    // Lazy iframe mount: nothing beyond the trigger exists in the DOM
    // until the first open() call. Once created, the backdrop/drawer/
    // iframe are reused (shown/hidden) on subsequent opens rather than
    // recreated, so the drawer's own in-progress state survives a close.
    var chrome = null;
    var iframeEl = null;
    var isOpen = false;

    function ensureChrome() {
      if (chrome) return chrome;
      chrome = createDrawerChrome(doc);
      chrome.backdrop.addEventListener("click", close);
      return chrome;
    }

    function open() {
      var c = ensureChrome();
      if (!iframeEl) {
        var showSpinner = c.spinner;
        showSpinner.style.display = "flex";

        iframeEl = doc.createElement("iframe");
        iframeEl.src = buildDrawerSrc(widgetOrigin, config.tenant, config.locale);
        iframeEl.title = "Booking";
        iframeEl.onload = function () {
          showSpinner.style.display = "none";
        };
        c.drawer.appendChild(iframeEl);
      }
      c.backdrop.className = "pw-open";
      c.drawer.className = "pw-open";
      isOpen = true;
    }

    function close() {
      if (!chrome) return;
      chrome.backdrop.className = "";
      chrome.drawer.className = "";
      isOpen = false;
    }

    // The drawer's own in-content close button (DrawerContent.tsx) runs
    // inside the iframe, a different window from this one — it can't call
    // close() directly, so it posts a message instead (see
    // src/lib/close-widget.ts). Matters most on mobile: the full-screen
    // takeover has its backdrop dimming/click-to-close explicitly zeroed
    // out (see the mobile breakpoint CSS above), so without this the
    // drawer had no way to be dismissed at all below that breakpoint.
    // Guarded on event.source being our own iframe's window, not just the
    // message shape, so an unrelated postMessage elsewhere on the host
    // page's origin can't trigger a close.
    window.addEventListener("message", function (event) {
      if (!iframeEl || event.source !== iframeEl.contentWindow) return;
      var data = event.data;
      if (data && data.source === "platform-widget" && data.type === "close") {
        close();
      }
    });

    if (!config.hideDefaultButton) {
      createTrigger(doc, open);
    }

    var bookTriggers = doc.querySelectorAll("[data-platform-book]");
    for (var i = 0; i < bookTriggers.length; i++) {
      bookTriggers[i].addEventListener("click", open);
    }

    window.Platform = window.Platform || {};
    window.Platform.open = open;
    window.Platform.close = close;
    window.Platform.isOpen = function () {
      return isOpen;
    };
  }

  // Internal-only exposure for the vitest seam — see the file header.
  window.Platform = window.Platform || {};
  window.Platform.__internal = { buildDrawerSrc: buildDrawerSrc, readConfig: readConfig };

  init();
})();
