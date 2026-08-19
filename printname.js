(function () {
  "use strict";

  // While the print dialog is open, swap the page URL and title for
  // business-friendly ones so Safari's printed footer reads
  // ".../HH-Plumbing-and-Gas-<serial>" instead of
  // ".../landlord.html?id=rec_...", and the saved PDF gets a proper
  // filename. Restored the moment the dialog closes.

  var BUSINESS = "HH Plumbing and Gas";

  var CONFIGS = {
    landlord: { name: "Landlord Homeowner Gas Safety Record", serial: 'input[name="serialNumber"]' },
    record:   { name: "Non Domestic Gas Safety Record",       serial: '[name="serialNumber"]' },
    drainage: { name: "Drainage Pressure Test Certificate",   serial: '[name="testNumber"]' }
  };

  function currentConfig() {
    var cls = document.body.classList;
    if (cls.contains("landlord")) return CONFIGS.landlord;
    if (cls.contains("record")) return CONFIGS.record;
    if (cls.contains("drainage")) return CONFIGS.drainage;
    return null;
  }

  var saved = null;

  function prettify() {
    var cfg = currentConfig();
    if (!cfg || saved) return;
    var serialEl = document.querySelector(cfg.serial);
    var serial = serialEl && serialEl.value ? serialEl.value.trim() : "";

    saved = {
      url: window.location.pathname + window.location.search,
      title: document.title
    };

    document.title = BUSINESS + " - " + cfg.name + (serial ? " " + serial : "");

    var slug = (BUSINESS + (serial ? " " + serial : ""))
      .replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
    var base = window.location.pathname.split("/").slice(0, -1).join("/");
    try { window.history.replaceState({}, "", base + "/" + slug); } catch (e) {}
  }

  function restore() {
    if (!saved) return;
    try { window.history.replaceState({}, "", saved.url); } catch (e) {}
    document.title = saved.title;
    saved = null;
  }

  window.addEventListener("beforeprint", prettify);
  window.addEventListener("afterprint", restore);
})();
