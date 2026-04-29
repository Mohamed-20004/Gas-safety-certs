(function () {
  "use strict";

  var STORAGE_KEY = "gsr.records.v1";
  var TYPE = "landlord-homeowner";

  var DEFECT_ROWS = 5;

  var APPLIANCE_FIELDS = [
    "location", "type", "manufacturer", "model",
    "owned", "inspected", "flueType",
    "operatingPressure", "safetyDevice", "ventilation",
    "flueCondition", "flueOperation", "combustion",
    "serviced", "safeToUse"
  ];

  var YN  = ["", "Yes", "No"];
  var PFA = ["", "Pass", "Fail", "N/A"];

  var APPLIANCE_FIELD_TYPES = {
    location: "text", type: "text", manufacturer: "text", model: "text",
    operatingPressure: "text", combustion: "text",
    owned: YN, inspected: YN, ventilation: YN, serviced: YN, safeToUse: YN,
    flueType: "text",
    safetyDevice: PFA, flueCondition: PFA, flueOperation: PFA
  };

  var form = document.getElementById("recordForm");
  var saveBtn = document.getElementById("saveBtn");
  var downloadBtn = document.getElementById("downloadBtn");
  var printBtn = document.getElementById("printBtn");
  var newBtn = document.getElementById("newBtn");
  var addApplianceBtn = document.getElementById("addApplianceBtn");
  var applianceBody = document.getElementById("applianceBody");
  var defectsBody = document.querySelector("#defectsTable tbody");
  var logoFileInput = document.getElementById("logoFile");
  var logoResetBtn = document.getElementById("logoReset");
  var logoImg = document.getElementById("logoImg");
  var logoDefault = document.getElementById("logoDefault");

  var state = { id: null, createdAt: null, signatures: { issued: "", received: "" }, logoDataUrl: "" };
  var pads = {};

  function uid() { return "rec_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8); }
  function loadAll() {
    try { var r = localStorage.getItem(STORAGE_KEY); var a = r ? JSON.parse(r) : []; return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function saveAll(rs) { localStorage.setItem(STORAGE_KEY, JSON.stringify(rs)); }
  function getQueryParam(name) {
    var m = new RegExp("[?&]" + name + "=([^&]*)").exec(location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function buildDefects() {
    defectsBody.innerHTML = "";
    for (var i = 1; i <= DEFECT_ROWS; i++) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="num">' + i + '</td>' +
        '<td><input type="text" name="defect.text.' + i + '"></td>' +
        '<td class="warn-cell"><select name="defect.warn.' + i + '"><option></option><option>Yes</option><option>No</option></select></td>';
      defectsBody.appendChild(tr);
    }
  }
  function readDefects() {
    var out = [];
    for (var i = 1; i <= DEFECT_ROWS; i++) {
      var t = form.querySelector('input[name="defect.text.' + i + '"]');
      var w = form.querySelector('select[name="defect.warn.' + i + '"]');
      out.push({ n: i, text: t ? t.value : "", warningNotice: w ? w.value : "" });
    }
    return out;
  }
  function writeDefects(defects) {
    if (!Array.isArray(defects)) return;
    defects.forEach(function (d) {
      var t = form.querySelector('input[name="defect.text.' + d.n + '"]');
      var w = form.querySelector('select[name="defect.warn.' + d.n + '"]');
      if (t) t.value = d.text || "";
      if (w) w.value = d.warningNotice || "";
    });
  }

  function readPipework() {
    var keys = ["visual", "supplyVisual", "ecvAccess", "tightness", "bonding"];
    var out = {};
    keys.forEach(function (k) {
      var el = form.querySelector('select[name="pipe.' + k + '"]');
      out[k] = el ? el.value : "";
    });
    return out;
  }
  function writePipework(p) {
    if (!p) return;
    Object.keys(p).forEach(function (k) {
      var el = form.querySelector('select[name="pipe.' + k + '"]');
      if (el) el.value = p[k] || "";
    });
  }

  function makeCell(field, value) {
    var spec = APPLIANCE_FIELD_TYPES[field];
    if (Array.isArray(spec)) {
      var sel = document.createElement("select");
      sel.name = "appliance." + field;
      spec.forEach(function (opt) {
        var o = document.createElement("option");
        o.value = opt; o.textContent = opt || "—";
        if (opt === value) o.selected = true;
        sel.appendChild(o);
      });
      return sel;
    }
    var inp = document.createElement("input");
    inp.type = "text"; inp.name = "appliance." + field; inp.value = value || "";
    return inp;
  }

  function refreshApplianceNumbers() {
    Array.from(applianceBody.querySelectorAll("tr.ll-appl-main")).forEach(function (tr, i) {
      var numCell = tr.querySelector(".ll-appl-num");
      if (numCell) numCell.textContent = (i + 1);
    });
  }

  function addApplianceRow(data) {
    data = data || {};
    var co = data.coAlarm || {};

    var main = document.createElement("tr");
    main.className = "ll-appl-main";
    var numTd = document.createElement("td");
    numTd.className = "ll-appl-num";
    numTd.textContent = applianceBody.querySelectorAll("tr.ll-appl-main").length + 1;
    main.appendChild(numTd);

    APPLIANCE_FIELDS.forEach(function (field) {
      var td = document.createElement("td");
      td.appendChild(makeCell(field, data[field]));
      main.appendChild(td);
    });

    var delTd = document.createElement("td");
    delTd.className = "ll-appl-del";
    var delBtn = document.createElement("button");
    delBtn.type = "button"; delBtn.title = "Remove appliance"; delBtn.textContent = "×";
    delBtn.addEventListener("click", function () {
      main.remove(); coRow.remove(); refreshApplianceNumbers();
    });
    delTd.appendChild(delBtn);
    main.appendChild(delTd);

    var coRow = document.createElement("tr");
    coRow.className = "ll-co-row";
    var coLabel = document.createElement("td");
    coLabel.className = "ll-co-label";
    coLabel.textContent = "Audible CO Alarm";
    coRow.appendChild(coLabel);

    var coCellTd = document.createElement("td");
    coCellTd.colSpan = APPLIANCE_FIELDS.length + 1;
    var grid = document.createElement("div");
    grid.className = "ll-co-cell";

    function coBlock(headLabel, name, options) {
      var sub = document.createElement("div"); sub.className = "ll-co-sub";
      var head = document.createElement("div"); head.className = "ll-co-sub-head"; head.textContent = headLabel;
      sub.appendChild(head);
      var sel = document.createElement("select"); sel.name = "co." + name;
      options.forEach(function (opt) {
        var o = document.createElement("option");
        o.value = opt; o.textContent = opt || "—";
        if (opt === co[name]) o.selected = true;
        sel.appendChild(o);
      });
      sub.appendChild(sel);
      return sub;
    }
    grid.appendChild(coBlock("Approved CO alarm fitted?", "fitted", YN));
    grid.appendChild(coBlock("Is CO alarm In Date?", "inDate", YN));
    grid.appendChild(coBlock("CO alarm test satisfactory?", "testOk", YN));
    coCellTd.appendChild(grid);
    coRow.appendChild(coCellTd);

    applianceBody.appendChild(main);
    applianceBody.appendChild(coRow);
  }

  function readAppliances() {
    var mains = Array.from(applianceBody.querySelectorAll("tr.ll-appl-main"));
    return mains.map(function (tr, idx) {
      var obj = { n: idx + 1 };
      APPLIANCE_FIELDS.forEach(function (field, i) {
        var cell = tr.children[i + 1];
        var input = cell.querySelector("input, select");
        obj[field] = input ? input.value : "";
      });
      var coRow = tr.nextElementSibling;
      if (coRow && coRow.classList.contains("ll-co-row")) {
        var co = {};
        coRow.querySelectorAll("select[name^='co.']").forEach(function (sel) {
          co[sel.name.split(".")[1]] = sel.value;
        });
        obj.coAlarm = co;
      } else {
        obj.coAlarm = {};
      }
      return obj;
    }).filter(function (a) {
      var stripped = Object.assign({}, a); delete stripped.n; delete stripped.coAlarm;
      var coVals = Object.values(a.coAlarm || {}).join("");
      return Object.values(stripped).some(function (v) { return (v || "").trim() !== ""; }) || coVals !== "";
    });
  }

  function setupSignaturePad(name) {
    var wrap = document.querySelector('.ll-sig-pad[data-sig="' + name + '"]');
    var canvas = wrap.querySelector("canvas");
    var placeholder = wrap.querySelector(".ll-sig-placeholder");
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

  logoFileInput.addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function (ev) { setLogoDataUrl(ev.target.result); };
    reader.readAsDataURL(f);
    logoFileInput.value = "";
  });
  logoResetBtn.addEventListener("click", function () { setLogoDataUrl(""); });

  function collect() {
    var data = {
      id: <state.id> || uid(), type: TYPE,
      createdAt: state.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    new FormData(form).forEach(function (val, key) {
      if (key.indexOf("appliance.") === 0) return;
      if (key.indexOf("co.") === 0) return;
      if (key.indexOf("defect.") === 0) return;
      if (key.indexOf("pipe.") === 0) return;
      data[key] = val;
    });
    data.defects = readDefects();
    data.pipework = readPipework();
    data.appliances = readAppliances();
    data.signatures = { issued: state.signatures.issued || "", received: state.signatures.received || "" };
    data.logoDataUrl = state.logoDataUrl || "";
    return data;
  }

  function populate(rec) {
    if (!rec) return;
    <state.id> = <rec.id> || null;
    state.createdAt = rec.createdAt || null;
    state.signatures = {
      issued: (rec.signatures && rec.signatures.issued) || "",
      received: (rec.signatures && rec.signatures.received) || ""
    };
    state.logoDataUrl = rec.logoDataUrl || "";

    Array.from(form.elements).forEach(function (el) {
      if (!el.name) return;
      if (/^(appliance|co|defect|pipe)\./.test(el.name)) return;
      if (el.type === "file") return;
      if (rec[el.name] != null && rec[el.name] !== "") el.value = rec[el.name];
    });

    writeDefects(rec.defects);
    writePipework(rec.pipework);

    applianceBody.innerHTML = "";
    (rec.appliances || []).forEach(addApplianceRow);
    if (!(rec.appliances || []).length) addApplianceRow();

    setLogoDataUrl(state.logoDataUrl);

    if (pads.issued) pads.issued.load(state.signatures.issued);
    if (pads.received) pads.received.load(state.signatures.received);
  }

  function saveToStorage() {
    var rec = collect();
    var records = loadAll();
    var idx = records.findIndex(function (r) { return <r.id> === <rec.id>; });
    if (idx >= 0) records[idx] = rec; else records.push(rec);
    saveAll(records);
    <state.id> = <rec.id>; state.createdAt = rec.createdAt;
    if (history && history.replaceState) {
      history.replaceState({}, "", location.pathname + "?id=" + encodeURIComponent(<rec.id>));
    }
    var orig = saveBtn.textContent;
    saveBtn.textContent = "Saved ✓"; saveBtn.disabled = true;
    setTimeout(function () { saveBtn.textContent = orig; saveBtn.disabled = false; }, 1200);
  }

  function downloadJson() {
    var rec = collect();
    var records = loadAll();
    var idx = records.findIndex(function (r) { return <r.id> === <rec.id>; });
    if (idx >= 0) records[idx] = rec; else records.push(rec);
    saveAll(records);
    <state.id> = <rec.id>;
    var blob = new Blob([JSON.stringify(rec, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    var slug = (rec.serialNumber || rec.installationAddress || "landlord-gas-safety-record")
      .toString().replace(/[^a-z0-9\-_]+/gi, "-").replace(/^-+|-+$/g, "") || "record";
    a.href = URL.createObjectURL(blob);
    a.download = slug + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  document.addEventListener("DOMContentLoaded", function () {
    buildDefects();
    pads.issued = setupSignaturePad("issued");
    pads.received = setupSignaturePad("received");
    document.querySelectorAll("[data-clear-sig]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var n = btn.getAttribute("data-clear-sig");
        if (pads[n]) pads[n].clear();
      });
    });
    addApplianceBtn.addEventListener("click", function () { addApplianceRow(); });
    saveBtn.addEventListener("click", saveToStorage);
    downloadBtn.addEventListener("click", downloadJson);
    printBtn.addEventListener("click", function () { window.print(); });
    newBtn.addEventListener("click", function () {
      if (!confirm("Start a new blank record? Unsaved changes will be lost.")) return;
      location.href = "landlord.html";
    });
    var today = new Date().toISOString().slice(0, 10);
    var id = getQueryParam("id");
    if (id) {
      var rec = loadAll().filter(function (r) { return <r.id> === id; })[0];
      if (rec) { populate(rec); return; }
    }
    document.getElementById("dateField").value = today;
    addApplianceRow();
  });
})();
