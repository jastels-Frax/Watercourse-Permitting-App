/* app.js — Culvert Survey
   Vanilla ES6+. No frameworks. All data lives in localStorage.
   Two screens: home (surveys list) and form (data entry).
*/

// ── Storage key ──────────────────────────────────────────────────────────────
const STORAGE_KEY = 'culvert_survey_records';

// ── State ────────────────────────────────────────────────────────────────────
let records = [];   // array of record objects, newest first

// ── DOM refs ─────────────────────────────────────────────────────────────────
const screenHome    = document.getElementById('screen-home');
const screenForm    = document.getElementById('screen-form');
const headerTitle   = document.getElementById('header-title');
const btnBack       = document.getElementById('btn-back');
const btnNewSurvey  = document.getElementById('btn-new-survey');

const form          = document.getElementById('survey-form');
const fSiteId       = document.getElementById('f-site-id');
const fDiameter     = document.getElementById('f-diameter');
const fLat          = document.getElementById('f-lat');
const fLon          = document.getElementById('f-lon');
const fElevA        = document.getElementById('f-elev-a');
const fElevB        = document.getElementById('f-elev-b');
const fDistL        = document.getElementById('f-dist-l');
const fVelocity     = document.getElementById('f-velocity');
const fChanWidth    = document.getElementById('f-chan-width');
const fChanDepth    = document.getElementById('f-chan-depth');
const fNotes        = document.getElementById('f-notes');

const dispSlope     = document.getElementById('disp-slope');
const dispDeg       = document.getElementById('disp-deg');
const dispMinDist   = document.getElementById('disp-min-dist');

const btnGps        = document.getElementById('btn-gps');
const gpsAccuracy   = document.getElementById('gps-accuracy');
const btnClear      = document.getElementById('btn-clear');
const btnExportAll  = document.getElementById('btn-export-all');
const recordsList   = document.getElementById('records-list');
const recordCount   = document.getElementById('record-count');

// ── Initialization ────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadRecords();
  renderRecords();
  updateSlope();
  registerServiceWorker();
  showScreen('home');
});

// ── Service Worker registration ───────────────────────────────────────────────
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  }
}

// ── Screen navigation ─────────────────────────────────────────────────────────
function showScreen(name) {
  const onHome = name === 'home';
  screenHome.hidden = !onHome;
  screenForm.hidden =  onHome;
  btnBack.hidden    =  onHome;
  headerTitle.textContent = onHome ? 'Culvert Survey' : 'New Survey';

  if (!onHome) {
    // Scroll to top of form and focus first field
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fSiteId.focus();
  }
}

btnNewSurvey.addEventListener('click', () => showScreen('form'));

btnBack.addEventListener('click', () => {
  if (formIsDirty()) {
    if (!confirm('Discard unsaved data and return to home?')) return;
  }
  clearForm();
  showScreen('home');
});

// Returns true if the user has typed anything into the form
function formIsDirty() {
  return [fSiteId, fDiameter, fLat, fLon, fElevA, fElevB,
          fDistL, fVelocity, fChanWidth, fChanDepth, fNotes]
    .some(el => el.value.trim() !== '');
}

// ── localStorage helpers ──────────────────────────────────────────────────────
function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    records = raw ? JSON.parse(raw) : [];
  } catch {
    records = [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// ── GPS ───────────────────────────────────────────────────────────────────────
btnGps.addEventListener('click', () => {
  if (!navigator.geolocation) {
    showToast('Geolocation not supported on this device.', 'error');
    return;
  }

  btnGps.disabled = true;
  btnGps.textContent = '…';
  gpsAccuracy.textContent = 'Acquiring fix…';
  gpsAccuracy.className = 'gps-accuracy';

  navigator.geolocation.getCurrentPosition(
    pos => {
      fLat.value = pos.coords.latitude.toFixed(6);
      fLon.value = pos.coords.longitude.toFixed(6);

      const acc = pos.coords.accuracy;
      gpsAccuracy.textContent = `±${acc.toFixed(1)} m`;
      gpsAccuracy.className = 'gps-accuracy ' + (acc <= 10 ? 'good' : 'poor');

      btnGps.disabled = false;
      btnGps.textContent = 'Get Fix';
    },
    err => {
      gpsAccuracy.textContent = 'GPS error: ' + err.message;
      gpsAccuracy.className = 'gps-accuracy poor';
      btnGps.disabled = false;
      btnGps.textContent = 'Get Fix';
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
});

// ── Live slope calculation ────────────────────────────────────────────────────
[fElevA, fElevB, fDistL, fDiameter].forEach(el => {
  el.addEventListener('input', updateSlope);
});

function updateSlope() {
  const A = parseFloat(fElevA.value);
  const B = parseFloat(fElevB.value);
  const L = parseFloat(fDistL.value);
  const D = parseFloat(fDiameter.value);

  if (!isNaN(A) && !isNaN(B) && !isNaN(L) && L > 0) {
    const slopePct = ((A - B) / L) * 100;
    const slopeDeg = Math.atan((A - B) / L) * (180 / Math.PI);
    dispSlope.value = slopePct.toFixed(3) + ' %';
    dispDeg.value   = slopeDeg.toFixed(3) + '°';
  } else {
    dispSlope.value = '—';
    dispDeg.value   = '—';
  }

  if (!isNaN(D) && D > 0) {
    dispMinDist.textContent = ((3 * D) + 3.5).toFixed(2) + ' m';
  } else {
    dispMinDist.textContent = '—';
  }
}

// ── Form save ─────────────────────────────────────────────────────────────────
form.addEventListener('submit', e => {
  e.preventDefault();
  if (!validateForm()) return;

  const A = parseFloat(fElevA.value);
  const B = parseFloat(fElevB.value);
  const L = parseFloat(fDistL.value);

  let slopePct = null;
  let slopeDeg = null;
  if (!isNaN(A) && !isNaN(B) && !isNaN(L) && L > 0) {
    slopePct = ((A - B) / L) * 100;
    slopeDeg = Math.atan((A - B) / L) * (180 / Math.PI);
  }

  const record = {
    id:        generateId(),
    timestamp: new Date().toISOString(),
    siteId:    fSiteId.value.trim(),
    diameter:  fDiameter.value !== '' ? parseFloat(fDiameter.value) : null,
    lat:       fLat.value !== '' ? parseFloat(fLat.value) : null,
    lon:       fLon.value !== '' ? parseFloat(fLon.value) : null,
    elevA:     fElevA.value !== '' ? parseFloat(fElevA.value) : null,
    elevB:     fElevB.value !== '' ? parseFloat(fElevB.value) : null,
    distL:     fDistL.value !== '' ? parseFloat(fDistL.value) : null,
    velocity:  fVelocity.value !== '' ? parseFloat(fVelocity.value) : null,
    chanWidth: fChanWidth.value !== '' ? parseFloat(fChanWidth.value) : null,
    chanDepth: fChanDepth.value !== '' ? parseFloat(fChanDepth.value) : null,
    notes:     fNotes.value.trim(),
    slopePct,
    slopeDeg
  };

  records.unshift(record);
  saveRecords();
  renderRecords();
  clearForm();
  showScreen('home');
  showToast(`Survey "${record.siteId}" saved!`, 'success');
});

function validateForm() {
  let valid = true;

  if (!fSiteId.value.trim()) {
    fSiteId.classList.add('error');
    valid = false;
  } else {
    fSiteId.classList.remove('error');
  }

  if (!valid) showToast('Site ID is required.', 'error');
  return valid;
}

// ── Clear / reset form ────────────────────────────────────────────────────────
btnClear.addEventListener('click', () => {
  clearForm();
  showToast('Form cleared.', 'info');
});

function clearForm() {
  form.reset();
  gpsAccuracy.textContent = '';
  gpsAccuracy.className = 'gps-accuracy';
  updateSlope();
  form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
}

// ── Render records list (home screen) ─────────────────────────────────────────
function renderRecords() {
  const count = records.length;
  recordCount.textContent = count === 1 ? '1 survey' : `${count} surveys`;
  btnExportAll.style.display = count === 0 ? 'none' : '';

  if (count === 0) {
    recordsList.innerHTML =
      '<p class="no-records">No surveys saved yet.<br>Tap <strong>+ New Survey</strong> to begin.</p>';
    return;
  }

  recordsList.innerHTML = records.map(r => {
    const slopeText = r.slopePct !== null
      ? r.slopePct.toFixed(2) + '%'
      : '—';

    const coordText = (r.lat !== null && r.lon !== null)
      ? `${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}`
      : 'No coordinates';

    const ts = new Date(r.timestamp).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const diamText = r.diameter !== null ? `${r.diameter} m dia.` : '';
    const detailParts = [coordText, diamText].filter(Boolean).join(' · ');

    return `
      <div class="record-item" data-id="${r.id}">
        <div class="record-site">${escHtml(r.siteId)}</div>
        <div class="record-slope">${escHtml(slopeText)}</div>
        <div class="record-meta">${escHtml(detailParts)}</div>
        <div class="record-actions">
          <button class="btn btn-secondary btn-sm"
                  onclick="exportRecord('${r.id}')"
                  aria-label="Export ${escHtml(r.siteId)} to CSV"
                  title="Export this survey to CSV">&#8659; CSV</button>
          <button class="btn btn-danger btn-sm btn-icon"
                  onclick="deleteRecord('${r.id}')"
                  aria-label="Delete ${escHtml(r.siteId)}"
                  title="Delete this survey">✕</button>
        </div>
        <div class="record-timestamp">${escHtml(ts)}</div>
      </div>`;
  }).join('');
}

// ── Delete record ─────────────────────────────────────────────────────────────
function deleteRecord(id) {
  const rec = records.find(r => r.id === id);
  if (!rec) return;
  if (!confirm(`Delete survey "${rec.siteId}"?`)) return;

  records = records.filter(r => r.id !== id);
  saveRecords();
  renderRecords();
  showToast('Survey deleted.', 'info');
}

// ── CSV export helpers ────────────────────────────────────────────────────────
const CSV_HEADERS = [
  'Timestamp', 'Site ID', 'Diameter (m)',
  'Latitude', 'Longitude',
  'Elevation A (m)', 'Elevation B (m)', 'Distance L (m)',
  'Slope (%)', 'Slope (deg)',
  'Velocity (m/s)', 'Channel Width (m)', 'Channel Depth (m)',
  'Notes'
];

function recordToRow(r) {
  return [
    r.timestamp,
    r.siteId,
    r.diameter   ?? '',
    r.lat        ?? '',
    r.lon        ?? '',
    r.elevA      ?? '',
    r.elevB      ?? '',
    r.distL      ?? '',
    r.slopePct !== null ? r.slopePct.toFixed(4) : '',
    r.slopeDeg !== null ? r.slopeDeg.toFixed(4) : '',
    r.velocity   ?? '',
    r.chanWidth  ?? '',
    r.chanDepth  ?? '',
    r.notes.replace(/"/g, '""')
  ].map(v => `"${v}"`).join(',');
}

function downloadCSV(csvStr, filename) {
  const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Export a single record
function exportRecord(id) {
  const rec = records.find(r => r.id === id);
  if (!rec) return;

  const csv      = [CSV_HEADERS.map(h => `"${h}"`).join(','), recordToRow(rec)].join('\r\n');
  const safeName = rec.siteId.replace(/[^a-z0-9_-]/gi, '_');
  const dateStr  = new Date(rec.timestamp).toISOString().slice(0, 10);
  downloadCSV(csv, `culvert-${safeName}-${dateStr}.csv`);
  showToast(`Exported "${rec.siteId}" to CSV.`, 'success');
}

// Export all records
btnExportAll.addEventListener('click', () => {
  if (records.length === 0) {
    showToast('No surveys to export.', 'error');
    return;
  }

  const rows    = records.map(recordToRow);
  const csv     = [CSV_HEADERS.map(h => `"${h}"`).join(','), ...rows].join('\r\n');
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCSV(csv, `culvert-survey-all-${dateStr}.csv`);
  showToast(`Exported ${records.length} survey(s) to CSV.`, 'success');
});

// ── Toast helper ──────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2750);
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Expose to inline onclick handlers
window.deleteRecord  = deleteRecord;
window.exportRecord  = exportRecord;
