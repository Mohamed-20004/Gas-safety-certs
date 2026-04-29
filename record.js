(function () {
  "use strict";

  var STORAGE_KEY = "gsr.records.v1";

  var APPLIANCE_FIELDS = [
    "location", "type", "makeModel", "owner", "inspected",
    "flueType", "operatingPressure", "safetyDevice", "ventilation",
    "flueFlow", "spillage", "combustion", "serviced", "status"
  ];

  var TRIPLE_OPTS = ["", "Pass", "Fail", "N/A", "N/I"];

  var METER_CHECK_ITEMS = [
    { key: "ecvAccessible", label: "Emergency Control Valve (ECV) accessible & correctly labelled" },
    { key: "ecvHandle", label: "ECV handle secure & operates freely" },
    { key: "regulator", label: "Regulator in good condition & sealed" },
    { key: "meterCondition", label: "Meter & meter box in satisfactory condition" },
    { key: "electricalBonding", label: "Equipotential bonding present & continuous (10 mm² min)" },
    { key: "warningLabel", label: "Emergency contact notice / gas escape label displayed" },
    { key: "meterVentilation", label: "Meter compartment ventilation adequate" }
  ];

  var PIPEWORK_CHECK_ITEMS = [
    { key: "visualInspection", label: "Visual inspection of pipework satisfactory" },
    { key: "supports", label: "Pipework adequately supported & protected" },
    { key: "sleeving", label: "Pipework through walls/floors correctly sleeved" },
    { key: "bonding", label: "Main equipotential bonding continuous" },
    { key: "identification", label: "Pipework identified (yellow ochre) where required" },
    { key: "tightnessTest", label: "Tightness test completed per IGEM/UP/1B" },
    { key: "letByTest", label: "Let-by test satisfactory" },
    { key: "purgeComplete", label: "Purge completed & recorded" },
    { key: "emergencyIsolation", label: "Emergency isolation valves accessible & labelled" }
  ];

  var form = document.getElementById("recordForm");
  var saveBtn = document.getElementById("saveBtn");
  var downloadBtn = document.getElementById("downloadBtn");
  var printBtn = document.getElementById("printBtn");
  var newBtn = document.getElementById("newBtn");
  var addApplianceBtn = document.getElementById("addApplianceBtn");
  var applianceBody = document.getElementById("applianceBody");
  var meterChecksEl = document.getElementById("meterChecks");
  var pipeworkChecksEl = document.getElementById("pipeworkChecks");

  var state = { id: null, signatures: { issued: "", received: "" }, checks: { meter: {}, pipework: {} } };

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

  function makeApplianceCell(name, value) {
    if (name === "inspected" || name === "serviced" || name === "safetyDevice" ||
        name === "ventilation" || name === "flueFlow" || name === "spillage") {
      var sel = document.createElement("select");
      sel.name = "appliance." + name;
      TRIPLE_OPTS.forEach(function (opt) {
        var o = document.createElement("option");
        o.value = opt; o.textContent = opt || "—";
        if (opt === value) o.selected = true;
        sel.appendChild(o);
      });
      return sel;
    }
    if (name === "status") {
      var sel2 = document.createElement("select");
      sel2.name = "appliance.status";
      ["", "Pass", "Fail"].forEach(function (opt) {
        var o = document.createElement("option");
        o.value = opt; o.textContent = opt || "—";
        if (opt === value) o.selected = true;
        sel2.appendChild(o);
      });
      return sel2;
    }
    if (name === "owner") {
      var sel3 = document.createElement("select");
      sel3.name = "appliance.owner";
      ["", "Landlord", "Tenant", "Client", "Other"].forEach(function (opt) {
        var o = document.createElement("option");
        o.value = opt; o.textContent = opt || "—";
        if (opt === value) o.selected = true;
        sel3.appendChild(o);
      });
      return sel3;
    }
    var inp = document.createElement("input");
    inp.type = "text";
    inp.name = "appliance." + name;
    inp.value = value || "";
    return inp;
  }

  function addApplianceRow(data) {
    data = data || {};
    var tr = document.createElement("tr");
    APPLIANCE_FIELDS.forEach(function (field) {
      var td = document.createElement("td");
      td.appendChild(makeApplianceCell(field, data[field]));
      tr.appendChild(td);
    });
    var tdDel = document.createElement("td");
    var del = document.createElement("button");
    del.type = "button";
    del.className = "row-del";
    del.title = "Remove appliance";
    del.textContent = "×";
    del.addEventListener("click", function () { tr.remove(); });
    tdDel.appendChild(del);
    tr.appendChild(tdDel);
    applianceBody.appendChild(tr);
  }

  function readAppliances() {
    var rows = Array.from(applianceBody.querySelectorAll("tr"));
    return rows.map(function (tr) {
      var obj = {};
      APPLIANCE_FIELDS.forEach(function (field, i) {
        var cell = tr.children[i];
        var input = cell.querySelector("input, select");
        obj[field] = input ? input.value : "";
      });
      return obj;
    }).filter(function (a) {
      return Object.values(a).some(function (v) { return (v || "").trim() !== ""; });
    });
  }

  function renderCheckList(container, items, stateKey) {
    container.innerHTML = "";
    items.forEach(function (item) {
      var row = document.createElement("div");
      row.className = "check-row";
      var label = document.createElement("div");
      label.className = "label";
      label.textContent = item.label;
      var sel = document.createElement("select");
      sel.setAttribute("data-check", stateKey + "." + item.key);
      TRIPLE_OPTS.forEach(function (opt) {
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
    var wrap = document.querySelector('.sig-canvas-wrap[data-sig="' + name + '"]');
    var canvas = wrap.querySelector("canvas");
    var placeholder = wrap.querySelector(".sig-placeholder");
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
      strokes.forEach(function (stroke) {
        if (stroke.length < 2) return;
        ctx.beginPath(); ctx.moveTo(stroke[0].x, stroke[0].y);
        for (var i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
        ctx.stroke();
      });
      placeholder.style.display = strokes.length ? "none" : "flex";
    }
    function pointerPos(e) {
      var rect = canvas.getBoundingClientRect();
      var cx, cy;
      if (e.touches && e.touches[0]) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
      else { cx = e.clientX; cy = e.clientY; }
      return { x: cx - rect.left, y: cy - rect.top };
    }
    function start(e) { e.preventDefault(); drawing = true; last = pointerPos(e); current = [last]; }
    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      var p = pointerPos(e);
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      current.push(p); last = p; placeholder.style.display = "none";
    }
    function end() {
      if (!drawing) return;
      drawing = false;
      if (current && current.length > 1) strokes.push(current);
      current = null;
      updateDataUrl();
    }
    function updateDataUrl() {
      if (!strokes.length) { state.signatures[name] = ""; placeholder.style.display = "flex"; return; }
      try { state.signatures[name] = canvas.toDataURL("image/png"); }
      catch (e) { state.signatures[name] = ""; }
    }
    function clear() { strokes = []; redraw(); updateDataUrl(); }

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
      loadDataUrl: function (dataUrl) {
        strokes = [];
        if (!dataUrl) { redraw(); updateDataUrl(); return; }
        var img = new Image();
        img.onload = function () {
          var rect = canvas.getBoundingClientRect();
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
          placeholder.style.display = "none";
          state.signatures[name] = dataUrl;
        };
        img.src = dataUrl;
      }
    };
  }

  var pads = {};

  function collect() {
    var data = { id: state.id || uid(), type: "non-domestic" };
    new FormData(form).forEach(function (val, key) {
      if (key.indexOf("appliance.") === 0) return;
      data[key] = val;
    });
    data.appliances = readAppliances();
    data.checks = { meter: readChecks(meterChecksEl, "meter"), pipework: readChecks(pipeworkChecksEl, "pipework") };
    data.declaration = document.getElementById("declarationText").textContent.trim();
    data.signatures = { issued: state.signatures.issued || "", received: state.signatures.received || "" };
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
    Array.from(form.elements).forEach(function (el) {
      if (!el.name || el.name.indexOf("appliance.") === 0) return;
      if (el.type === "file") return;
      if (rec[el.name] != null) el.value = rec[el.name];
    });
    applianceBody.innerHTML = "";
    (rec.appliances || []).forEach(addApplianceRow);
    if ((rec.appliances || []).length === 0) addApplianceRow();
    renderCheckList(meterChecksEl, METER_CHECK_ITEMS, "meter");
    renderCheckList(pipeworkChecksEl, PIPEWORK_CHECK_ITEMS, "pipework");
    if (pads.issued) pads.issued.loadDataUrl(state.signatures.issued);
    if (pads.received) pads.received.loadDataUrl(state.signatures.received);
  }

  function saveToStorage() {
    var rec = collect();
    var records = loadAll();
    var idx = records.findIndex(function (r) { return r.id === rec.id; });
    if (idx >= 0) records[idx] = rec; else records.push(rec);
    saveAll(records);
    state.id = rec.id;
    state.createdAt = rec.createdAt;
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, "", window.location.pathname + "?id=" + encodeURIComponent(rec.id));
    }
    var original = saveBtn.textContent;
    saveBtn.textContent = "Saved ✓"; saveBtn.disabled = true;
    setTimeout(function () { saveBtn.textContent = original; saveBtn.disabled = false; }, 1200);
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
    var slug = (rec.serialNumber || rec.siteName || "gas-safety-record")
      .toString().replace(/[^a-z0-9\-_]+/gi, "-").replace(/^-+|-+$/g, "") || "record";
    a.href = URL.createObjectURL(blob);
    a.download = slug + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
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
    saveBtn.addEventListener("click", saveToStorage);
    downloadBtn.addEventListener("click", downloadJson);
    printBtn.addEventListener("click", function () { window.print(); });
    newBtn.addEventListener("click", function () {
      if (!confirm("Start a new blank record? Unsaved changes will be lost.")) return;
      window.location.href = "record.html";
    });
    var today = new Date().toISOString().slice(0, 10);
    var id = getQueryParam("id");
    if (id) {
      var rec = loadAll().filter(function (r) { return r.id === id; })[0];
      if (rec) { populate(rec); return; }
    }
    document.getElementById("inspectionDate").value = today;
    document.getElementById("issuedDate").value = today;
    document.getElementById("receivedDate").value = today;
    addApplianceRow();
  });
})();
