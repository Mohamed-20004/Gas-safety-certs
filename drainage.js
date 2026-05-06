(function () {
  "use strict";

  var STORAGE_KEY = "gsr.records.v1";
  var DENSITY_KEY = "gsr.drainage.density";
  var TYPE = "drainage-pressure-test";

  var form = document.getElementById("recordForm");
  var saveBtn = document.getElementById("saveBtn");
  var downloadBtn = document.getElementById("downloadBtn");
  var printBtn = document.getElementById("printBtn");
  var newBtn = document.getElementById("newBtn");
  var logoFileInput = document.getElementById("logoFile");
  var logoResetBtn = document.getElementById("logoReset");
  var logoImg = document.getElementById("logoImg");
  var logoDefault = document.getElementById("logoDefault");
  var logoBox = document.getElementById("logoBox");

  var state = {
    id: null, createdAt: null,
    signatures: { signature: "" },
    logoDataUrl: ""
  };
  var pads = {};

  function uid() { return "rec_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8); }
  function loadAll() {
    try { var raw = localStorage.getItem(STORAGE_KEY); var arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr : []; }
    catch (e) { return []; }
  }
  function saveAll(records) { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
  function getQueryParam(name) {
    var m = new RegExp("[?&]" + name + "=([^&]*)").exec(window.location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function setupSignaturePad(name) {
    var wrap = document.querySelector('.dr-sig-pad[data-sig="' + name + '"]');
    if (!wrap) return null;
    var canvas = wrap.querySelector("canvas");
    var placeholder = wrap.querySelector(".dr-sig-placeholder");
    var ctx = canvas.getContext("2d");
    var drawing = false, last = null, strokes = [], current = null;

    function sizeCanvas() {
      var ratio = window.devicePixelRatio || 1;
      var rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = "#000";
      redraw();
    }
    function redraw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      strokes.forEach(function (s) {
        if (s.length < 2) return;
        ctx.beginPath(); ctx.moveTo(s[0].x, s[0].y);
        for (var i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y);
        ctx.stroke();
      });
      placeholder.style.display = strokes.length ? "none" : "flex";
    }
    function pos(e) {
      var r = canvas.getBoundingClientRect();
      var cx, cy;
      if (e.touches && e.touches[0]) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
      else { cx = e.clientX; cy = e.clientY; }
      return { x: cx - r.left, y: cy - r.top };
    }
    function start(e) { e.preventDefault(); drawing = true; last = pos(e); current = [last]; }
    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      var p = pos(e);
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      current.push(p); last = p; placeholder.style.display = "none";
    }
    function end() {
      if (!drawing) return;
      drawing = false;
      if (current && current.length > 1) strokes.push(current);
      current = null;
      try { state.signatures[name] = strokes.length ? canvas.toDataURL("image/png") : ""; }
      catch (e) { state.signatures[name] = ""; }
      if (!strokes.length) placeholder.style.display = "flex";
    }
    function clear() { strokes = []; redraw(); state.signatures[name] = ""; }

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);
    canvas.addEventListener("touchcancel", end);
    window.addEventListener("resize", sizeCanvas);
    sizeCanvas();

    return {
      clear: clear,
      load: function (dataUrl) {
        strokes = [];
        if (!dataUrl) { redraw(); return; }
        var img = new Image();
        img.onload = function () {
          var r = canvas.getBoundingClientRect();
          ctx.drawImage(img, 0, 0, r.width, r.height);
          placeholder.style.display = "none";
          state.signatures[name] = dataUrl;
        };
        img.src = dataUrl;
      }
    };
  }

  function setLogoDataUrl(dataUrl) {
    state.logoDataUrl = dataUrl || "";
    if (dataUrl) {
      logoImg.src = dataUrl; logoImg.hidden = false;
      if (logoDefault) logoDefault.style.display = "none";
      logoBox.classList.add("has-logo");
    } else {
      logoImg.removeAttribute("src"); logoImg.hidden = true;
      if (logoDefault) logoDefault.style.display = "";
      logoBox.classList.remove("has-logo");
    }
  }

  function readResult() {
    var picked = form.querySelector('input[name="result"]:checked');
    return picked ? picked.value : "";
  }
  function applyResultStyling() {
    document.querySelectorAll(".dr-result-cell").forEach(function (cell) {
      var input = cell.querySelector('input[type="radio"]');
      cell.classList.toggle("active", !!(input && input.checked));
    });
  }

  function collect() {
    var data = { id: state.id || uid(), type: TYPE };
    new FormData(form).forEach(function (val, key) {
      data[key] = val;
    });
    // Checkboxes don't appear in FormData when unchecked — capture explicitly.
    Array.from(form.querySelectorAll('input[type="checkbox"]')).forEach(function (cb) {
      data[cb.name] = cb.checked;
    });
    data.result = readResult();
    data.signatures = { signature: state.signatures.signature || "" };
    data.logoDataUrl = state.logoDataUrl || "";
    data.updatedAt = new Date().toISOString();
    if (!data.createdAt) data.createdAt = state.createdAt || data.updatedAt;
    return data;
  }

  function populate(rec) {
    if (!rec) return;
    state.id = rec.id || null;
    state.createdAt = rec.createdAt || null;
    state.signatures = { signature: (rec.signatures && rec.signatures.signature) || "" };
    state.logoDataUrl = rec.logoDataUrl || "";

    Array.from(form.elements).forEach(function (el) {
      if (!el.name) return;
      if (el.type === "file") return;
      if (el.type === "checkbox") {
        el.checked = !!rec[el.name];
      } else if (el.type === "radio") {
        el.checked = (rec[el.name] === el.value);
      } else if (rec[el.name] != null) {
        el.value = rec[el.name];
      }
    });

    setLogoDataUrl(state.logoDataUrl);
    if (pads.signature) pads.signature.load(state.signatures.signature);
    applyResultStyling();
  }

  function saveToStorage() {
    var rec = collect();
    var records = loadAll();
    var idx = records.findIndex(function (r) { return r.id === rec.id; });
    if (idx >= 0) records[idx] = rec; else records.push(rec);
    saveAll(records);
    state.id = rec.id; state.createdAt = rec.createdAt;
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, "", window.location.pathname + "?id=" + encodeURIComponent(rec.id));
    }
    var orig = saveBtn.textContent;
    saveBtn.textContent = "Saved ✓"; saveBtn.disabled = true;
    setTimeout(function () { saveBtn.textContent = orig; saveBtn.disabled = false; }, 1200);
  }

  function downloadJson() {
    var rec = collect();
    var records = loadAll();
    var idx = records.findIndex(function (r) { return r.id === rec.id; });
    if (idx >= 0) records[idx] = rec; else records.push(rec);
    saveAll(records);
    state.id = rec.id;
    var blob = new Blob([JSON.stringify(rec, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    var slug = (rec.testNumber || rec.projectName || "drainage-pressure-test")
      .toString().replace(/[^a-z0-9\-_]+/gi, "-").replace(/^-+|-+$/g, "") || "record";
    a.href = URL.createObjectURL(blob);
    a.download = slug + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function setDensity(name) {
    var allowed = { compact: 1, cozy: 1, comfortable: 1 };
    if (!allowed[name]) name = "cozy";
    document.body.setAttribute("data-density", name);
    document.querySelectorAll(".dr-density [data-density]").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-density") === name ? "true" : "false");
    });
    try { localStorage.setItem(DENSITY_KEY, name); } catch (e) {}
  }

  function todayDDMM() {
    var d = new Date();
    return String(d.getDate()).padStart(2, "0") + "/" +
           String(d.getMonth() + 1).padStart(2, "0") + "/" +
           d.getFullYear();
  }

  document.addEventListener("DOMContentLoaded", function () {
    pads.signature = setupSignaturePad("signature");
    document.querySelectorAll("[data-clear-sig]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var n = btn.getAttribute("data-clear-sig");
        if (pads[n]) pads[n].clear();
      });
    });

    saveBtn.addEventListener("click", saveToStorage);
    downloadBtn.addEventListener("click", downloadJson);
    printBtn.addEventListener("click", function () { window.print(); });
    newBtn.addEventListener("click", function () {
      if (!confirm("Start a new blank record? Unsaved changes will be lost.")) return;
      window.location.href = "drainage.html";
    });

    if (logoFileInput) {
      logoFileInput.addEventListener("change", function (e) {
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function (ev) { setLogoDataUrl(ev.target.result); };
        reader.readAsDataURL(f);
        logoFileInput.value = "";
      });
    }
    if (logoResetBtn) logoResetBtn.addEventListener("click", function () { setLogoDataUrl(""); });
    if (logoBox) {
      logoBox.addEventListener("click", function (e) {
        if (e.target === logoFileInput) return;
        if (logoFileInput) logoFileInput.click();
      });
    }

    var stored;
    try { stored = localStorage.getItem(DENSITY_KEY); } catch (e) { stored = null; }
    setDensity(stored || "cozy");
    document.querySelectorAll(".dr-density [data-density]").forEach(function (b) {
      b.addEventListener("click", function () { setDensity(b.getAttribute("data-density")); });
    });

    document.querySelectorAll('input[pattern="\\d{2}/\\d{2}/\\d{4}"]').forEach(function (el) {
      el.addEventListener("input", function () {
        var digits = el.value.replace(/\D/g, "").slice(0, 8);
        var out = digits;
        if (digits.length > 4) out = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4);
        else if (digits.length > 2) out = digits.slice(0, 2) + "/" + digits.slice(2);
        el.value = out;
      });
    });

    form.querySelectorAll('input[name="result"]').forEach(function (r) {
      r.addEventListener("change", applyResultStyling);
    });

    var id = getQueryParam("id");
    if (id) {
      var rec = loadAll().filter(function (r) { return r.id === id; })[0];
      if (rec) { populate(rec); return; }
    }

    var t = todayDDMM();
    var ds = form.querySelector('[name="dateStart"]');
    var sd = form.querySelector('[name="signatureDate"]');
    if (ds && !ds.value) ds.value = t;
    if (sd && !sd.value) sd.value = t;
    applyResultStyling();
  });
})();
