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

  function addCanvasPage(doc, canvas, pageW, pageH, isFirst) {
    if (!isFirst) doc.addPage();
    var imgW = pageW;
    var imgH = canvas.height * (pageW / canvas.width);
    if (imgH > pageH) {
      imgH = pageH;
      imgW = canvas.width * (pageH / canvas.height);
    }
    var x = (pageW - imgW) / 2;
    doc.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", x, 0, imgW, imgH);
  }

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
    el.style.zoom = "1";

    function cleanup() {
      el.style.zoom = prevZoom;
      document.body.classList.remove("pdf-capture");
      btn.textContent = orig;
      btn.disabled = false;
    }

    // Measure the page-2 boundary at zoom 1, before capture.
    var splitY = null;
    if (cfg.splitAt) {
      var splitEl = document.querySelector(cfg.splitAt);
      if (splitEl) {
        splitY = splitEl.getBoundingClientRect().top - el.getBoundingClientRect().top;
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
      logging: false
    }).then(function (canvas) {
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({ orientation: cfg.orientation, unit: "mm", format: "a4" });
      var pageW = doc.internal.pageSize.getWidth();
      var pageH = doc.internal.pageSize.getHeight();

      if (splitY != null && splitY > 0) {
        var boundary = splitY * scale;
        addCanvasPage(doc, sliceCanvas(canvas, 0, boundary), pageW, pageH, true);
        addCanvasPage(doc, sliceCanvas(canvas, boundary, canvas.height), pageW, pageH, false);
      } else {
        addCanvasPage(doc, canvas, pageW, pageH, true);
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
