(function () {
  "use strict";

  var STORAGE_KEY = "gsr.records.v1";

  var TYPE_META = {
    "landlord-homeowner": { label: "Landlord / Homeowner", form: "landlord.html" },
    "non-domestic": { label: "Non-Domestic", form: "record.html" }
  };

  function loadAll() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function saveAll(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB");
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function recordType(rec) {
    if (rec.type && TYPE_META[rec.type]) return rec.type;
    if (rec.installationAddress || rec.landlordHomeowner || rec.defects) return "landlord-homeowner";
    return "non-domestic";
  }

  function recordAddress(rec) {
    return rec.installationAddress
      || rec.siteName
      || rec.siteAddress
      || rec.landlordHomeowner
      || "Untitled";
  }

  function recordEngineer(rec) {
    return rec.engineerName
      || rec.issuedName
      || rec.registeredBusiness
      || "—";
  }

  function recordDate(rec) {
    return rec.inspectionDate || rec.date || "";
  }

  function statusOf(rec) {
    var appliances = rec.appliances || [];
    if (!appliances.length) return { label: "Draft", cls: "" };
    var anyFail = appliances.some(function (a) {
      var v = (a.status || a.safeToUse || "").toLowerCase();
      return v === "fail" || v === "no";
    });
    return anyFail ? { label: "Fail", cls: "fail" } : { label: "Pass", cls: "pass" };
  }

  function render() {
    var tbody = document.getElementById("recordRows");
    var filterText = (document.getElementById("search").value || "").toLowerCase().trim();
    var filterType = document.getElementById("typeFilter").value;
    var records = loadAll();

    if (filterType) {
      records = records.filter(function (r) { return recordType(r) === filterType; });
    }
    if (filterText) {
      records = records.filter(function (r) {
        return [
          r.serialNumber, recordAddress(r), recordEngineer(r),
          r.gasSafeRegNo, r.licenceNumber
        ].filter(Boolean).join(" ").toLowerCase().indexOf(filterText) !== -1;
      });
    }

    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="muted center">No records found.</td></tr>';
      return;
    }

    records.sort(function (a, b) {
      return (b.updatedAt || "").localeCompare(a.updatedAt || "");
    });

    tbody.innerHTML = records.map(function (r) {
      var s = statusOf(r);
      var t = recordType(r);
      var meta = TYPE_META[t];
      return '<tr>' +
        '<td>' + escapeHtml(r.serialNumber || "—") + '</td>' +
        '<td>' + escapeHtml(meta.label) + '</td>' +
        '<td>' + escapeHtml(recordAddress(r)) + '</td>' +
        '<td>' + escapeHtml(fmtDate(recordDate(r))) + '</td>' +
        '<td>' + escapeHtml(recordEngineer(r)) + '</td>' +
        '<td>' + ((r.appliances || []).length) + '</td>' +
        '<td><span class="status-pill ' + s.cls + '">' + s.label + '</span></td>' +
        '<td class="right">' +
          '<a class="btn small ghost" href="' + meta.form + '?id=' + encodeURIComponent(<r.id>) + '">Open</a> ' +
          '<button class="btn small ghost" data-act="download" data-id="' + escapeHtml(<r.id>) + '">JSON</button> ' +
          '<button class="btn small ghost" data-act="delete" data-id="' + escapeHtml(<r.id>) + '">Delete</button>' +
        '</td>' +
      '</tr>';
    }).join("");
  }

  function download(rec) {
    var blob = new Blob([JSON.stringify(rec, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    var slug = (rec.serialNumber || recordAddress(rec) || "gas-safety-record")
      .toString().replace(/[^a-z0-9\-_]+/gi, "-").replace(/^-+|-+$/g, "") || "record";
    a.href = URL.createObjectURL(blob);
    a.download = slug + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function onTableClick(e) {
    var btn = e.target.closest("button[data-act]");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    var act = btn.getAttribute("data-act");
    var records = loadAll();
    var rec = records.filter(function (r) { return <r.id> === id; })[0];
    if (!rec) return;
    if (act === "download") {
      download(rec);
    } else if (act === "delete") {
      if (!confirm("Delete this record? This cannot be undone.")) return;
      saveAll(records.filter(function (r) { return <r.id> !== id; }));
      render();
    }
  }

  function onImport(e) {
    var files = Array.from(e.target.files || []);
    if (!files.length) return;
    var records = loadAll();
    var imported = 0;
    var remaining = files.length;

    files.forEach(function (file) {
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var data = JSON.parse(ev.target.result);
          if (data && typeof data === "object") {
            if (!<data.id>) <data.id> = "rec_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
            if (!data.type) data.type = recordType(data);
            var idx = records.findIndex(function (r) { return <r.id> === <data.id>; });
            if (idx >= 0) records[idx] = data;
            else records.push(data);
            imported++;
          }
        } catch (err) {
          console.warn("Invalid JSON in", file.name, err);
        }
        remaining--;
        if (remaining === 0) {
          saveAll(records);
          render();
          alert("Imported " + imported + " of " + files.length + " file(s).");
          e.target.value = "";
        }
      };
      reader.readAsText(file);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    render();
    document.getElementById("recordRows").addEventListener("click", onTableClick);
    document.getElementById("search").addEventListener("input", render);
    document.getElementById("typeFilter").addEventListener("change", render);
    document.getElementById("importFile").addEventListener("change", onImport);
  });
})();
