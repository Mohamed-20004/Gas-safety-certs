(function () {
  "use strict";

  // In-page PDF generation. Bypasses the browser's print pipeline
  // entirely, so no URL / date / page-number headers or footers are
  // ever stamped on the output (iOS Safari offers no way to disable
  // them when printing).

  var CONFIGS = {
    landlord: {
      target: ".cert-page",
      splitAt: "#sec-appliances",
      fillRows: "#applianceBody > tr.ll-appl-main",
      orientation: "landscape",
      prefix: "Landlord_Gas_Safety_Record",
      serialField: 'input[name="serialNumber"]'
    },
    record: {
      target: ".page",
      orientation: "landscape",
      prefix: "Non_Domestic_Gas_Safety_Record",
      serialField: '[name="serialNumber"]'
    },
    drainage: {
      target: ".cert-page",
      orientation: "portrait",
      prefix: "Drainage_Pressure_Test",
      serialField: '[name="testNumber"]'
    }
  };

  function currentConfig() {
    var cls = document.body.classList;
    if (cls.contains("landlord")) return CONFIGS.landlord;
    if (cls.contains("record")) return CONFIGS.record;
    if (cls.contains("drainage")) return CONFIGS.drainage;
    return null;
  }

  // ---- clone fix-ups -------------------------------------------------
  // html2canvas renders form controls with offset baselines and drops
  // canvas bitmaps, so in the off-screen clone we swap every control
  // for a plain block carrying the same computed styles and text, and
  // every canvas for an <img> of its current pixels. The live page is
  // never touched.

  var STYLE_PROPS = [
    "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing",
    "color", "textTransform", "textAlign",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
    "borderTopStyle", "borderRightStyle", "borderBottomStyle", "borderLeftStyle",
    "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor",
    "borderTopLeftRadius", "borderTopRightRadius",
    "borderBottomLeftRadius", "borderBottomRightRadius",
    "backgroundColor", "backgroundImage"
  ];

  function makeTextBlock(origEl, doc) {
    var cs = window.getComputedStyle(origEl);
    var div = doc.createElement("div");
    STYLE_PROPS.forEach(function (p) { div.style[p] = cs[p]; });
    div.style.boxSizing = "border-box";
    div.style.width = origEl.offsetWidth + "px";
    div.style.height = origEl.offsetHeight + "px";
    div.style.overflow = "hidden";
    div.style.display = "flex";
    div.style.flexDirection = "column";

    var isTextarea = origEl.tagName === "TEXTAREA";
    div.style.justifyContent = isTextarea ? "flex-start" : "center";

    var value = "";
    if (origEl.tagName === "SELECT") {
      var opt = origEl.options[origEl.selectedIndex];
      value = opt ? opt.text : "";
    } else {
      value = origEl.value || "";
    }

    var inner = doc.createElement("div");
    inner.style.width = "100%";
    inner.style.whiteSpace = isTextarea ? "pre-wrap" : "nowrap";
    inner.style.wordBreak = isTextarea ? "break-word" : "normal";
    inner.style.textAlign = cs.textAlign;
    inner.style.lineHeight = isTextarea ? "1.45" : "1.2";
    inner.textContent = value;
    div.appendChild(inner);
    return div;
  }

  function makeCheckBlock(origEl, doc) {
    var cs = window.getComputedStyle(origEl);
    var div = doc.createElement("div");
    div.style.boxSizing = "border-box";
    div.style.width = origEl.offsetWidth + "px";
    div.style.height = origEl.offsetHeight + "px";
    div.style.flexShrink = "0";
    div.style.border = cs.borderTopWidth + " solid " + cs.borderTopColor;
    div.style.borderRadius = cs.borderTopLeftRadius;
    div.style.backgroundColor = origEl.checked ? "#fbbf00" : (cs.backgroundColor || "#fff");
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.justifyContent = "center";
    div.style.fontSize = Math.round(origEl.offsetHeight * 0.75) + "px";
    div.style.fontWeight = "700";
    div.style.color = "#0a0a0a";
    div.style.lineHeight = "1";
    div.textContent = origEl.checked ? "✓" : "";
    return div;
  }

  function fixupClone(origRoot, cloneRoot, cloneDoc) {
    var sel = "input, textarea, select, canvas";
    var origs = origRoot.querySelectorAll(sel);
    var clones = cloneRoot.querySelectorAll(sel);
    for (var i = 0; i < origs.length && i < clones.length; i++) {
      var o = origs[i], c = clones[i];
      if (!c.parentNode) continue;
      if (o.tagName === "CANVAS") {
        var img = cloneDoc.createElement("img");
        try { img.src = o.toDataURL("image/png"); } catch (e) { continue; }
        img.style.width = o.offsetWidth + "px";
        img.style.height = o.offsetHeight + "px";
        img.style.display = "block";
        c.parentNode.replaceChild(img, c);
      } else if (o.type === "checkbox") {
        c.parentNode.replaceChild(makeCheckBlock(o, cloneDoc), c);
      } else if (o.type === "radio" || o.type === "file" || o.type === "hidden") {
        c.style.visibility = "hidden";
      } else {
        c.parentNode.replaceChild(makeTextBlock(o, cloneDoc), c);
      }
    }
  }

  // ---- page geometry -------------------------------------------------

  function measureSlice1Height(el, splitSelector) {
    if (!splitSelector) return el.offsetHeight;
    var splitEl = document.querySelector(splitSelector);
    if (!splitEl) return el.offsetHeight;
    return splitEl.getBoundingClientRect().top - el.getBoundingClientRect().top;
  }

  // Nudge the cert's width so its first page's natural proportions
  // approach the A4 page, then the final image is stretched the last
  // few percent to fill the sheet exactly.
  function tuneWidth(el, cfg, targetAspect) {
    el.style.maxWidth = "none";
    for (var i = 0; i < 3; i++) {
      var h = measureSlice1Height(el, cfg.splitAt);
      if (h <= 0) break;
      var w = Math.round(h * targetAspect);
      w = Math.max(700, Math.min(2400, w));
      el.style.width = w + "px";
    }
  }

  function addStretchedPage(doc, canvas, pageW, pageH, isFirst) {
    if (!isFirst) doc.addPage();
    doc.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pageW, pageH);
  }

  function sliceCanvas(canvas, fromY, toY) {
    var h = Math.max(1, Math.round(toY - fromY));
    var out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = h;
    var ctx = out.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, Math.round(fromY), canvas.width, h, 0, 0, canvas.width, h);
    return out;
  }

  // ---- main ----------------------------------------------------------

  function generatePdf(btn) {
    var cfg = currentConfig();
    if (!cfg) return;
    if (typeof html2canvas !== "function" || !window.jspdf || !window.jspdf.jsPDF) {
      alert("PDF libraries did not load. Check your connection and reload the page.");
      return;
    }
    var el = document.querySelector(cfg.target);
    if (!el) return;

    var orig = btn.textContent;
    btn.textContent = "Generating…";
    btn.disabled = true;
    document.body.classList.add("pdf-capture");

    var prevZoom = el.style.zoom;
    var prevWidth = el.style.width;
    var prevMaxWidth = el.style.maxWidth;
    var grownRows = [];
    el.style.zoom = "1";

    function cleanup() {
      grownRows.forEach(function (pair) { pair[0].style.height = pair[1]; });
      el.style.zoom = prevZoom;
      el.style.width = prevWidth;
      el.style.maxWidth = prevMaxWidth;
      document.body.classList.remove("pdf-capture");
      btn.textContent = orig;
      btn.disabled = false;
    }

    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation: cfg.orientation, unit: "mm", format: "a4" });
    var pageW = doc.internal.pageSize.getWidth();
    var pageH = doc.internal.pageSize.getHeight();

    tuneWidth(el, cfg, pageW / pageH);

    var splitY = cfg.splitAt ? measureSlice1Height(el, cfg.splitAt) : null;

    // Grow the appliance rows so the second page fills A4 naturally —
    // taller rows with crisp text instead of a vertically stretched
    // bitmap.
    if (cfg.fillRows && splitY != null) {
      var target2H = el.offsetWidth * (pageH / pageW);
      var deficit = target2H - (el.offsetHeight - splitY);
      if (deficit > 40) {
        var rows = document.querySelectorAll(cfg.fillRows);
        if (rows.length) {
          var extra = deficit / rows.length;
          for (var ri = 0; ri < rows.length; ri++) {
            grownRows.push([rows[ri], rows[ri].style.height]);
            rows[ri].style.height = (rows[ri].offsetHeight + extra) + "px";
          }
        }
      }
    }

    // Cap the capture scale so the canvas stays under iOS Safari's
    // ~16.7M-pixel limit on very tall certs.
    var scale = Math.min(2, Math.sqrt(14000000 / Math.max(1, el.offsetWidth * el.offsetHeight)));
    if (!isFinite(scale) || scale <= 0) scale = 1;

    html2canvas(el, {
      scale: scale,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: Math.max(window.innerWidth, el.offsetWidth + 80),
      onclone: function (cloneDoc) {
        var cloneRoot = cloneDoc.querySelector(cfg.target);
        if (cloneRoot) fixupClone(el, cloneRoot, cloneDoc);
      }
    }).then(function (canvas) {
      if (splitY != null && splitY > 0 && splitY < el.offsetHeight) {
        var boundary = splitY * scale;
        addStretchedPage(doc, sliceCanvas(canvas, 0, boundary), pageW, pageH, true);
        addStretchedPage(doc, sliceCanvas(canvas, boundary, canvas.height), pageW, pageH, false);
      } else {
        addStretchedPage(doc, canvas, pageW, pageH, true);
      }

      var serialEl = document.querySelector(cfg.serialField);
      var serial = serialEl && serialEl.value ? serialEl.value : "";
      var slug = (cfg.prefix + (serial ? "_" + serial : ""))
        .replace(/[^a-z0-9_\-]+/gi, "_");
      doc.save(slug + ".pdf");
      cleanup();
    }).catch(function (err) {
      cleanup();
      alert("Could not generate the PDF: " + (err && err.message ? err.message : err));
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("pdfBtn");
    if (!btn) return;
    btn.addEventListener("click", function () { generatePdf(btn); });
  });
})();
