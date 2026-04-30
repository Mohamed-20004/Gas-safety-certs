(function () {
  "use strict";

  var STORAGE_KEY = "gsr.records.v1";
  var DENSITY_KEY = "gsr.record.density";
  var COL_KEY = "gsr.record.colWidths";

  var APPLIANCE_FIELDS = ["location", "type", "make", "model", "flueType", "operatingPressure"];
  var DEFAULT_APPLIANCE_ROWS = 8;
  var DEFAULT_WORK_ROWS = 8;

  var METER_CHECK_ITEMS = [
    { key: "ecvAccessible", label: "Is meter installation accessible?" },
    { key: "ecvHandle", label: "ECV handle secure & operates freely?" },
    { key: "regulator", label: "Regulator in good condition & sealed?" },
    { key: "meterCondition", label: "Meter & meter box in satisfactory condition?" },
    { key: "electricalBonding", label: "Equipotential bonding present & continuous (10 mm² min)?" },
    { key: "warningLabel", label: "Emergency contact / gas escape label displayed?" },
    { key: "meterVentilation", label: "Meter compartment ventilation adequate?" }
  ];

  var PIPEWORK_CHECK_ITEMS = [
    { key: "diagram", label: "Is a gas installation line diagram fixed near the primary meter?" },
    { key: "visualInspection", label: "Visual inspection of pipework satisfactory?" },
    { key: "supports", label: "Pipework adequately supported & protected?" },
    { key: "sleeving", label: "Pipework through walls/floors correctly sleeved?" },
    { key: "bonding", label: "Main equipotential bonding continuous?" },
    { key: "tightnessTest", label: "Tightness test completed per IGEM/UP/1B?" },
    { key: "purgeComplete", label: "Purge completed & recorded?" },
    { key: "emergencyIsolation", label: "Emergency isolation valves accessible & labelled?" }
  ];

  var YESNO_NA = ["", "Yes", "No", "N/A"];

  var form = document.getElementById("recordForm");
  var saveBtn = document.getElementById("saveBtn");
  var downloadBtn = document.getElementById("downloadBtn");
  var printBtn = document.getElementById("printBtn");
  var newBtn = document.getElementById("newBtn");
  var addApplianceBtn = document.getElementById("addApplianceBtn");
  var removeApplianceBtn = document.getElementById("removeApplianceBtn");
  var addWorkBtn = document.getElementById("addWorkBtn");
  var removeWorkBtn = document.getElementById("removeWorkBtn");
  var applianceBody = document.getElementById("applianceBody");
  var workBody = document.getElementById("workBody");
  var remedialBody = document.getElementById("remedialBody");
  var meterChecksEl = document.getElementById("meterChecks");
  var pipeworkChecksEl = document.getElementById("pipeworkChecks");
  var logoFileInput = document.getElementById("logoFile");
  var logoResetBtn = document.getElementById("logoReset");
  var logoImg = document.getElementById("logoImg");
  var logoDefault = document.getElementById("logoDefault");

  var state = {
    id: null, createdAt: null,
    signatures: { issued: "", received: "" },
    checks: { meter: {}, pipework: {} },
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

  function refreshApplianceNumbers() {
    Array.from(applianceBody.querySelectorAll("tr")).forEach(function (tr, i) {
      var num = tr.querySelector(".rec-num");
      if (num) num.textContent = i + 1;
    });
  }
  function refreshWorkNumbers(body) {
    Array.from(body.querySelectorAll("tr")).forEach(function (tr, i) {
      var num = tr.querySelector(".rec-num");
      if (num) num.textContent = i + 1;
    });
  }

  function addApplianceRow(data) {
    data = data || {};
    var tr = document.createElement("tr");
    var numTd = document.createElement("td");
    numTd.className = "rec-num";
    tr.appendChild(numTd);
    APPLIANCE_FIELDS.forEach(function (field) {
      var td = document.createElement("td");
      var ta = document.createElement("textarea");
      ta.rows = 1;
      ta.name = "appliance." + field;
      ta.value = data[field] || "";
      td.appendChild(ta);
      tr.appendChild(td);
    });
    applianceBody.appendChild(tr);
    refreshApplianceNumbers();
  }
  function removeApplianceRow() {
    var rows = applianceBody.querySelectorAll("tr");
    if (rows.length <= 1) return;
    rows[rows.length - 1].remove();
    refreshApplianceNumbers();
  }
  function readAppliances() {
    return Array.from(applianceBody.querySelectorAll("tr")).map(function (tr) {
      var obj = {};
      APPLIANCE_FIELDS.forEach(function (field, i) {
        var cell = tr.children[i + 1];
        var input = cell.querySelector("textarea, input");
        obj[field] = input ? input.value : "";
      });
      return obj;
    });
  }

  function addWorkRow(body, prefix, data) {
    data = data || "";
    var tr = document.createElement("tr");
    var numTd = document.createElement("td");
    numTd.className = "rec-num";
    tr.appendChild(numTd);
    var td = document.createElement("td");
    var ta = document.createElement("textarea");
    ta.rows = 1;
    ta.name = prefix + "." + (body.children.length + 1);
    ta.value = data;
    td.appendChild(ta);
    tr.appendChild(td);
    body.appendChild(tr);
    refreshWorkNumbers(body);
  }
  function removeWorkRow(body) {
    var rows = body.querySelectorAll("tr");
    if (rows.length <= 1) return;
    rows[rows.length - 1].remove();
    refreshWorkNumbers(body);
  }
  function readWork(body) {
    return Array.from(body.querySelectorAll("tr")).map(function (tr) {
      var ta = tr.querySelector("textarea");
      return ta ? ta.value : "";
    });
  }
  function writeWork(body, list) {
    body.innerHTML = "";
    var prefix = body.id === "workBody" ? "work" : "remedial";
    if (Array.isArray(list) && list.length) {
      list.forEach(function (val) { addWorkRow(body, prefix, val); });
    } else {
      for (var i = 0; i < DEFAULT_WORK_ROWS; i++) addWorkRow(body, prefix, "");
    }
  }

  function renderCheckList(container, items, stateKey) {
    container.innerHTML = "";
    items.forEach(function (item) {
      var row = document.createElement("div");
      row.className = "rec-qa-row";
      var label = document.createElement("div");
      label.className = "rec-qa-label";
      label.textContent = item.label;
      var sel = document.createElement("select");
      sel.setAttribute("data-check", stateKey + "." + item.key);
      YESNO_NA.forEach(function (opt) {
        var o = document.createElement("option");
        o.value = opt; o.textContent = opt || "—";
        sel.appendChild(o);
      });
      var current = (state.checks[stateKey] || {})[item.key];
      if (current) sel.value = current;
      sel.addEventListener("change", function () { state.checks[stateKey][item.key] = sel.value; });
      row.appendChild(label);
      row.appendChild(sel);
      container.appendChild(row);
    });
  }
  function readChecks(container, stateKey) {
    var out = {};
    container.querySelectorAll("select[data-check]").forEach(function (sel) {
      var key = sel.getAttribute("data-check").split(".")[1];
      out[key] = sel.value;
    });
    state.checks[stateKey] = out;
    return out;
  }

  function setupSignaturePad(name) {
    var wrap = document.querySelector('.rec-sig-pad[data-sig="' + name + '"]');
    if (!wrap) return null;
    var canvas = wrap.querySelector("canvas");
    var placeholder = wrap.querySelector(".rec-sig-placeholder");
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
      logoImg.src = dataUrl; logoImg.hidden = false; logoDefault.style.display = "none";
    } else {
      logoImg.removeAttribute("src"); logoImg.hidden = true; logoDefault.style.display = "";
    }
  }

  function collect() {
    var data = { id: state.id || uid(), type: "non-domestic" };
    new FormData(form).forEach(function (val, key) {
      if (key.indexOf("appliance.") === 0) return;
      if (key.indexOf("work.") === 0) return;
      if (key.indexOf("remedial.") === 0) return;
      data[key] = val;
    });
    data.appliances = readAppliances();
    data.workCarriedOut = readWork(workBody);
    data.remedialWork = readWork(remedialBody);
    data.checks = { meter: readChecks(meterChecksEl, "meter"), pipework: readChecks(pipeworkChecksEl, "pipework") };
    data.signatures = { issued: state.signatures.issued || "", received: state.signatures.received || "" };
    data.logoDataUrl = state.logoDataUrl || "";
    data.updatedAt = new Date().toISOString();
    if (!data.createdAt) data.createdAt = state.createdAt || data.updatedAt;
    return data;
  }

  function populate(rec) {
    if (!rec) return;
    state.id = rec.id || null;
    state.createdAt = rec.createdAt || null;
    state.checks = {
      meter: (rec.checks && rec.checks.meter) || {},
      pipework: (rec.checks && rec.checks.pipework) || {}
    };
    state.signatures = {
      issued: (rec.signatures && rec.signatures.issued) || "",
      received: (rec.signatures && rec.signatures.received) || ""
    };
    state.logoDataUrl = rec.logoDataUrl || "";

    Array.from(form.elements).forEach(function (el) {
      if (!el.name) return;
      if (/^(appliance|work|remedial)\./.test(el.name)) return;
      if (el.type === "file") return;
      if (rec[el.name] != null) el.value = rec[el.name];
    });

    applianceBody.innerHTML = "";
    var apps = Array.isArray(rec.appliances) ? rec.appliances : [];
    if (apps.length) apps.forEach(function (a) { addApplianceRow(a); });
    else for (var i = 0; i < DEFAULT_APPLIANCE_ROWS; i++) addApplianceRow();

    writeWork(workBody, rec.workCarriedOut);
    writeWork(remedialBody, rec.remedialWork);

    renderCheckList(meterChecksEl, METER_CHECK_ITEMS, "meter");
    renderCheckList(pipeworkChecksEl, PIPEWORK_CHECK_ITEMS, "pipework");

    setLogoDataUrl(state.logoDataUrl);

    if (pads.issued) pads.issued.load(state.signatures.issued);
    if (pads.received) pads.received.load(state.signatures.received);
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
    var slug = (rec.serialNumber || rec.siteAddress || rec.businessName || "non-domestic-record")
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
    document.querySelectorAll(".rec-density [data-density]").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-density") === name ? "true" : "false");
    });
    try { localStorage.setItem(DENSITY_KEY, name); } catch (e) {}
  }

  function loadColWidths() {
    try { return JSON.parse(localStorage.getItem(COL_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveColWidths(map) {
    try { localStorage.setItem(COL_KEY, JSON.stringify(map)); } catch (e) {}
  }
  function enableColumnResize(tableSelector) {
    var table = document.querySelector(tableSelector);
    if (!table) return;
    var widths = loadColWidths();
    var key = tableSelector;
    var savedRow = widths[key] || [];
    var ths = Array.prototype.slice.call(table.querySelectorAll("thead th"));
    ths.forEach(function (th, i) {
      if (savedRow[i]) th.style.width = savedRow[i] + "px";
      if (i === ths.length - 1) return;
      var handle = document.createElement("span");
      handle.className = "rec-resize-handle";
      th.appendChild(handle);
      handle.addEventListener("mousedown", function (e) {
        e.preventDefault(); e.stopPropagation();
        handle.classList.add("active");
        var startX = e.clientX;
        var startW = th.getBoundingClientRect().width;
        function onMove(ev) {
          var w = Math.max(40, startW + (ev.clientX - startX));
          th.style.width = w + "px";
        }
        function onUp() {
          handle.classList.remove("active");
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
          var current = loadColWidths();
          current[key] = ths.map(function (t) { return Math.round(t.getBoundingClientRect().width); });
          saveColWidths(current);
        }
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    });
  }
  function resetColumnWidths() {
    try { localStorage.removeItem(COL_KEY); } catch (e) {}
    document.querySelectorAll(".rec-appl-table thead th").forEach(function (th) { th.style.width = ""; });
  }

  function todayDDMM() {
    var d = new Date();
    return String(d.getDate()).padStart(2, "0") + "/" +
           String(d.getMonth() + 1).padStart(2, "0") + "/" +
           d.getFullYear();
  }

  document.addEventListener("DOMContentLoaded", function () {
    pads.issued = setupSignaturePad("issued");
    pads.received = setupSignaturePad("received");
    document.querySelectorAll("[data-clear-sig]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var name = btn.getAttribute("data-clear-sig");
        if (pads[name]) pads[name].clear();
      });
    });

    renderCheckList(meterChecksEl, METER_CHECK_ITEMS, "meter");
    renderCheckList(pipeworkChecksEl, PIPEWORK_CHECK_ITEMS, "pipework");

    addApplianceBtn.addEventListener("click", function () { addApplianceRow(); });
    removeApplianceBtn.addEventListener("click", function () { removeApplianceRow(); });
    addWorkBtn.addEventListener("click", function () {
      addWorkRow(workBody, "work", "");
      addWorkRow(remedialBody, "remedial", "");
    });
    removeWorkBtn.addEventListener("click", function () {
      removeWorkRow(workBody);
      removeWorkRow(remedialBody);
    });
    saveBtn.addEventListener("click", saveToStorage);
    downloadBtn.addEventListener("click", downloadJson);
    printBtn.addEventListener("click", function () { window.print(); });
    newBtn.addEventListener("click", function () {
      if (!confirm("Start a new blank record? Unsaved changes will be lost.")) return;
      window.location.href = "record.html";
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

    var stored;
    try { stored = localStorage.getItem(DENSITY_KEY); } catch (e) { stored = null; }
    setDensity(stored || "cozy");
    document.querySelectorAll(".rec-density [data-density]").forEach(function (b) {
      b.addEventListener("click", function () { setDensity(b.getAttribute("data-density")); });
    });
    var resetBtn = document.getElementById("resetCols");
    if (resetBtn) resetBtn.addEventListener("click", resetColumnWidths);

    enableColumnResize(".rec-appl-table");

    document.querySelectorAll('input[pattern="\\d{2}/\\d{2}/\\d{4}"]').forEach(function (el) {
      el.addEventListener("input", function () {
        var digits = el.value.replace(/\D/g, "").slice(0, 8);
        var out = digits;
        if (digits.length > 4) out = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4);
        else if (digits.length > 2) out = digits.slice(0, 2) + "/" + digits.slice(2);
        el.value = out;
      });
    });

    var id = getQueryParam("id");
    if (id) {
      var rec = loadAll().filter(function (r) { return r.id === id; })[0];
      if (rec) { populate(rec); return; }
    }

    for (var i = 0; i < DEFAULT_APPLIANCE_ROWS; i++) addApplianceRow();
    for (var j = 0; j < DEFAULT_WORK_ROWS; j++) {
      addWorkRow(workBody, "work", "");
      addWorkRow(remedialBody, "remedial", "");
    }

    var t = todayDDMM();
    var insp = form.querySelector('[name="inspectionDate"]');
    var iss = form.querySelector('[name="issuedDate"]');
    var rcv = form.querySelector('[name="receivedDate"]');
    if (insp && !insp.value) insp.value = t;
    if (iss && !iss.value) iss.value = t;
    if (rcv && !rcv.value) rcv.value = t;
  });
})();
