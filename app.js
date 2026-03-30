/* app.js — Culvert Survey v2
   Vanilla ES6+. No frameworks. All data on-device in localStorage.
*/

// ── Storage keys ──────────────────────────────────────────────────────────────
const STORAGE_KEY  = 'culvert_survey_records';
const SETTINGS_KEY = 'culvert_settings';

// ── App state ─────────────────────────────────────────────────────────────────
let records  = [];
let settings = { surveyor: '', company: '', projectNumber: '', projectName: '' };

// ── DOM refs ──────────────────────────────────────────────────────────────────

// Navigation / chrome
const screenHome       = document.getElementById('screen-home');
const screenForm       = document.getElementById('screen-form');
const headerTitle      = document.getElementById('header-title');
const btnBack          = document.getElementById('btn-back');
const btnNewSurvey     = document.getElementById('btn-new-survey');
const btnOpenSettings  = document.getElementById('btn-settings');
const btnCloseSettings = document.getElementById('btn-settings-close');
const settingsOverlay  = document.getElementById('settings-overlay');
const settingsDrawer   = document.getElementById('settings-drawer');

// Settings drawer inputs
const sName        = document.getElementById('s-surveyor');
const sCompany     = document.getElementById('s-company');
const sProjectNum  = document.getElementById('s-project-num');
const sProjectName = document.getElementById('s-project-name');
const btnSaveSettings = document.getElementById('btn-save-settings');

// Home screen
const recordsList  = document.getElementById('records-list');
const recordCount  = document.getElementById('record-count');
const btnExportAll = document.getElementById('btn-export-all');

// Survey form
const form         = document.getElementById('survey-form');
const metaSection  = document.getElementById('meta-section');

// Metadata fields
const fMetaSurveyor     = document.getElementById('f-meta-surveyor');
const fMetaCompany      = document.getElementById('f-meta-company');
const fMetaProjectNum   = document.getElementById('f-meta-project-num');
const fMetaProjectName  = document.getElementById('f-meta-project-name');
const fMetaDate         = document.getElementById('f-meta-date');
const fMetaFlow         = document.getElementById('f-meta-flow');
const fMetaWeather      = document.getElementById('f-meta-weather');
const fMetaWeatherNotes = document.getElementById('f-meta-weather-notes');
const fNotes            = document.getElementById('f-notes');

// Measurement fields
const fSiteId    = document.getElementById('f-site-id');
const fDiameter  = document.getElementById('f-diameter');
const fLat       = document.getElementById('f-lat');
const fLon       = document.getElementById('f-lon');
const fElevA     = document.getElementById('f-elev-a');
const fElevB     = document.getElementById('f-elev-b');
const fDistL     = document.getElementById('f-dist-l');
const fVelocity  = document.getElementById('f-velocity');
const fChanWidth = document.getElementById('f-chan-width');
const fChanDepth = document.getElementById('f-chan-depth');

// Computed display
const dispSlope   = document.getElementById('disp-slope');
const dispDeg     = document.getElementById('disp-deg');
const dispMinDist = document.getElementById('disp-min-dist');

// Other form controls
const btnGps      = document.getElementById('btn-gps');
const gpsAccuracy = document.getElementById('gps-accuracy');
const btnClear    = document.getElementById('btn-clear');

// ── Boot ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadRecords();
  renderRecords();
  updateSlope();
  registerSW();
  goHome();           // start on the home screen
});

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
      .catch(err => console.warn('SW:', err));
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SCREEN NAVIGATION
// Two screens — home and form — toggled with style.display (block / none).
// Using inline style rather than the HTML `hidden` attribute avoids any
// browser-default `display:none !important` conflicts with CSS classes.
// ══════════════════════════════════════════════════════════════════════════════

function goHome() {
  screenHome.style.display = 'block';
  screenForm.style.display = 'none';
  btnBack.style.display    = 'none';          // ← hidden on home screen
  headerTitle.textContent  = 'Culvert Survey';
}

function goForm() {
  screenHome.style.display = 'none';
  screenForm.style.display = 'block';
  btnBack.style.display    = 'inline-flex';   // ← shown on form screen
  headerTitle.textContent  = 'New Survey';

  // Pre-fill from saved settings; set date to today
  prefillMetadata();

  // Collapse metadata section if settings are already saved, open it if not
  const hasSettings = settings.surveyor || settings.company ||
                      settings.projectNumber || settings.projectName;
  metaSection.open = !hasSettings;

  window.scrollTo({ top: 0, behavior: 'smooth' });
  fSiteId.focus();
}

btnNewSurvey.addEventListener('click', goForm);

btnBack.addEventListener('click', () => {
  if (formIsDirty() && !confirm('Discard unsaved data and return to home?')) return;
  clearForm();
  goHome();
});

function formIsDirty() {
  return [fSiteId, fDiameter, fLat, fLon, fElevA, fElevB,
          fDistL, fVelocity, fChanWidth, fChanDepth,
          fNotes, fMetaWeatherNotes]
    .some(el => el.value.trim() !== '');
}

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS DRAWER
// ══════════════════════════════════════════════════════════════════════════════

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) settings = { ...settings, ...JSON.parse(raw) };
  } catch { /* keep defaults */ }
}

function persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function openSettings() {
  // Populate the drawer with the currently-saved values
  sName.value        = settings.surveyor      || '';
  sCompany.value     = settings.company       || '';
  sProjectNum.value  = settings.projectNumber || '';
  sProjectName.value = settings.projectName   || '';

  // Add .open — CSS transitions handle the slide-in and fade-in
  settingsOverlay.classList.add('open');
  settingsDrawer.classList.add('open');
  sName.focus();
}

function closeSettings() {
  settingsDrawer.classList.remove('open');
  settingsOverlay.classList.remove('open');
}

btnOpenSettings.addEventListener('click', openSettings);
btnCloseSettings.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', closeSettings);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && settingsDrawer.classList.contains('open')) closeSettings();
});

btnSaveSettings.addEventListener('click', () => {
  settings.surveyor      = sName.value.trim();
  settings.company       = sCompany.value.trim();
  settings.projectNumber = sProjectNum.value.trim();
  settings.projectName   = sProjectName.value.trim();
  persistSettings();
  closeSettings();
  showToast('Settings saved.', 'success');
});

// ══════════════════════════════════════════════════════════════════════════════
// METADATA PRE-FILL
// Called every time the form screen opens, and after Clear.
// ══════════════════════════════════════════════════════════════════════════════

function prefillMetadata() {
  fMetaSurveyor.value     = settings.surveyor      || '';
  fMetaCompany.value      = settings.company       || '';
  fMetaProjectNum.value   = settings.projectNumber || '';
  fMetaProjectName.value  = settings.projectName   || '';
  fMetaDate.value         = todayISO();
  fMetaFlow.value         = '';
  fMetaWeather.value      = '';
  fMetaWeatherNotes.value = '';
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function pad(n) { return String(n).padStart(2, '0'); }

// ══════════════════════════════════════════════════════════════════════════════
// localStorage — RECORDS
// ══════════════════════════════════════════════════════════════════════════════

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    records = raw ? JSON.parse(raw) : [];
  } catch { records = []; }
}

function persistRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// ══════════════════════════════════════════════════════════════════════════════
// GPS
// ══════════════════════════════════════════════════════════════════════════════

btnGps.addEventListener('click', () => {
  if (!navigator.geolocation) {
    showToast('Geolocation not supported.', 'error');
    return;
  }
  btnGps.disabled     = true;
  btnGps.textContent  = '…';
  gpsAccuracy.textContent = 'Acquiring fix…';
  gpsAccuracy.className   = 'gps-accuracy';

  navigator.geolocation.getCurrentPosition(
    pos => {
      fLat.value = pos.coords.latitude.toFixed(6);
      fLon.value = pos.coords.longitude.toFixed(6);
      const acc  = pos.coords.accuracy;
      gpsAccuracy.textContent = `±${acc.toFixed(1)} m`;
      gpsAccuracy.className   = 'gps-accuracy ' + (acc <= 10 ? 'good' : 'poor');
      btnGps.disabled    = false;
      btnGps.textContent = 'Get Fix';
    },
    err => {
      gpsAccuracy.textContent = 'GPS error: ' + err.message;
      gpsAccuracy.className   = 'gps-accuracy poor';
      btnGps.disabled    = false;
      btnGps.textContent = 'Get Fix';
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// LIVE SLOPE
// ══════════════════════════════════════════════════════════════════════════════

[fElevA, fElevB, fDistL, fDiameter].forEach(el => el.addEventListener('input', updateSlope));

function updateSlope() {
  const A = parseFloat(fElevA.value);
  const B = parseFloat(fElevB.value);
  const L = parseFloat(fDistL.value);
  const D = parseFloat(fDiameter.value);

  if (!isNaN(A) && !isNaN(B) && !isNaN(L) && L > 0) {
    const pct = ((A - B) / L) * 100;
    const deg = Math.atan((A - B) / L) * (180 / Math.PI);
    dispSlope.value = pct.toFixed(3) + ' %';
    dispDeg.value   = deg.toFixed(3) + '°';
  } else {
    dispSlope.value = '—';
    dispDeg.value   = '—';
  }

  dispMinDist.textContent = (!isNaN(D) && D > 0)
    ? ((3 * D) + 3.5).toFixed(2) + ' m'
    : '—';
}

// ══════════════════════════════════════════════════════════════════════════════
// FORM SAVE
// ══════════════════════════════════════════════════════════════════════════════

form.addEventListener('submit', e => {
  e.preventDefault();

  if (!fSiteId.value.trim()) {
    fSiteId.classList.add('error');
    showToast('Transect ID is required.', 'error');
    return;
  }
  fSiteId.classList.remove('error');

  const A = parseFloat(fElevA.value);
  const B = parseFloat(fElevB.value);
  const L = parseFloat(fDistL.value);
  const D = fDiameter.value !== '' ? parseFloat(fDiameter.value) : null;

  let slopePct = null, slopeDeg = null;
  if (!isNaN(A) && !isNaN(B) && !isNaN(L) && L > 0) {
    slopePct = ((A - B) / L) * 100;
    slopeDeg = Math.atan((A - B) / L) * (180 / Math.PI);
  }
  const minBDist = (D !== null && D > 0) ? (3 * D) + 3.5 : null;

  const record = {
    id:           generateId(),
    timestamp:    new Date().toISOString(),
    date:         fMetaDate.value || todayISO(),
    surveyor:     fMetaSurveyor.value.trim(),
    company:      fMetaCompany.value.trim(),
    projectNumber:fMetaProjectNum.value.trim(),
    projectName:  fMetaProjectName.value.trim(),
    flowCondition:fMetaFlow.value,
    weather:      fMetaWeather.value,
    weatherNotes: fMetaWeatherNotes.value.trim(),
    siteId:       fSiteId.value.trim(),
    diameter:     D,
    lat:          fLat.value      !== '' ? parseFloat(fLat.value)      : null,
    lon:          fLon.value      !== '' ? parseFloat(fLon.value)      : null,
    elevA:        fElevA.value    !== '' ? parseFloat(fElevA.value)    : null,
    elevB:        fElevB.value    !== '' ? parseFloat(fElevB.value)    : null,
    distL:        fDistL.value    !== '' ? parseFloat(fDistL.value)    : null,
    velocity:     fVelocity.value !== '' ? parseFloat(fVelocity.value) : null,
    chanWidth:    fChanWidth.value!== '' ? parseFloat(fChanWidth.value): null,
    chanDepth:    fChanDepth.value!== '' ? parseFloat(fChanDepth.value): null,
    slopePct,
    slopeDeg,
    minBDist,
    notes:        fNotes.value.trim()
  };

  records.unshift(record);
  persistRecords();
  renderRecords();
  clearForm();
  goHome();
  showToast(`Saved "${record.siteId}"`, 'success');
});

// ── Clear form ────────────────────────────────────────────────────────────────
btnClear.addEventListener('click', () => { clearForm(); showToast('Form cleared.', 'info'); });

function clearForm() {
  form.reset();
  gpsAccuracy.textContent = '';
  gpsAccuracy.className   = 'gps-accuracy';
  updateSlope();
  form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
  // Re-apply settings-backed defaults after form.reset() wipes them
  prefillMetadata();
}

// ══════════════════════════════════════════════════════════════════════════════
// RENDER RECORDS (home screen list)
// ══════════════════════════════════════════════════════════════════════════════

function renderRecords() {
  const n = records.length;
  recordCount.textContent    = n === 1 ? '1 survey' : `${n} surveys`;
  btnExportAll.style.display = n === 0 ? 'none' : '';

  if (n === 0) {
    recordsList.innerHTML =
      '<p class="no-records">No surveys saved yet.<br>' +
      'Tap <strong>+ New Survey</strong> to begin.</p>';
    return;
  }

  recordsList.innerHTML = records.map(r => {
    const slopeText = r.slopePct != null ? r.slopePct.toFixed(2) + '%' : '—';

    const coordText = (r.lat != null && r.lon != null)
      ? `${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}`
      : 'No coordinates';
    const diamText    = r.diameter != null ? `${r.diameter} m dia.` : '';
    const projectLine = [r.surveyor, r.projectName].filter(Boolean).join(' · ');
    const coordLine   = [coordText, diamText].filter(Boolean).join(' · ');
    const metaHtml    = projectLine
      ? `${esc(projectLine)}<br>${esc(coordLine)}`
      : esc(coordLine);

    const ts = new Date(r.timestamp).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    const surveyDate = r.date
      ? new Date(r.date + 'T12:00:00').toLocaleDateString(undefined,
          { month: 'short', day: 'numeric', year: 'numeric' })
      : null;
    const timeLabel = surveyDate ? `${surveyDate} · logged ${ts}` : ts;

    // Safe record id for use in inline onclick — only alphanumeric + base36 chars
    const safeId = esc(r.id);

    return `
      <div class="record-item" data-id="${safeId}">
        <div class="record-site">${esc(r.siteId)}</div>
        <div class="record-slope">${esc(slopeText)}</div>
        <div class="record-meta">${metaHtml}</div>
        <div class="record-actions">
          <button class="btn btn-secondary btn-sm"
                  onclick="exportRecord('${safeId}')"
                  title="Export to CSV">&#8659; CSV</button>
          <button class="btn btn-danger btn-sm btn-icon"
                  onclick="deleteRecord('${safeId}')"
                  title="Delete survey">&#10005;</button>
        </div>
        <div class="record-timestamp">${esc(timeLabel)}</div>
      </div>`;
  }).join('');
}

// ── Delete ────────────────────────────────────────────────────────────────────
function deleteRecord(id) {
  const rec = records.find(r => r.id === id);
  if (!rec) return;
  if (!confirm(`Delete survey "${rec.siteId}"?`)) return;
  records = records.filter(r => r.id !== id);
  persistRecords();
  renderRecords();
  showToast('Survey deleted.', 'info');
}

// ══════════════════════════════════════════════════════════════════════════════
// CSV EXPORT
// ══════════════════════════════════════════════════════════════════════════════

const CSV_HEADERS = [
  'Timestamp', 'Date', 'Surveyor', 'Company', 'Project Number', 'Project Name',
  'Transect ID', 'Culvert Diam (m)',
  'Latitude', 'Longitude',
  'Elev A (m)', 'Elev B (m)', 'Dist L (m)', 'Min B Distance (m)',
  'Slope (%)', 'Slope (deg)',
  'Velocity (m/s)', 'Width (m)', 'Depth (m)',
  'Flow Condition', 'Weather', 'Weather Notes', 'Notes'
];

function q(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }

function toRow(r) {
  return [
    r.timestamp,
    r.date            ?? '',
    r.surveyor        ?? '',
    r.company         ?? '',
    r.projectNumber   ?? '',
    r.projectName     ?? '',
    r.siteId          ?? '',
    r.diameter        ?? '',
    r.lat             ?? '',
    r.lon             ?? '',
    r.elevA           ?? '',
    r.elevB           ?? '',
    r.distL           ?? '',
    r.minBDist   != null ? r.minBDist.toFixed(3)  : '',
    r.slopePct   != null ? r.slopePct.toFixed(4)  : '',
    r.slopeDeg   != null ? r.slopeDeg.toFixed(4)  : '',
    r.velocity        ?? '',
    r.chanWidth       ?? '',
    r.chanDepth       ?? '',
    r.flowCondition   ?? '',
    r.weather         ?? '',
    r.weatherNotes    ?? '',
    r.notes           ?? ''
  ].map(q).join(',');
}

function buildCSV(rows) {
  return [CSV_HEADERS.map(q).join(','), ...rows.map(toRow)].join('\r\n');
}

function triggerDownload(csvStr, filename) {
  const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url, download: filename, style: 'display:none'
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportRecord(id) {
  const rec = records.find(r => r.id === id);
  if (!rec) return;
  const name    = rec.siteId.replace(/[^a-z0-9_-]/gi, '_');
  const dateStr = (rec.date || rec.timestamp).slice(0, 10);
  triggerDownload(buildCSV([rec]), `culvert-${name}-${dateStr}.csv`);
  showToast(`Exported "${rec.siteId}"`, 'success');
}

btnExportAll.addEventListener('click', () => {
  if (!records.length) { showToast('No surveys to export.', 'error'); return; }
  const dateStr = new Date().toISOString().slice(0, 10);
  triggerDownload(buildCSV(records), `culvert-survey-all-${dateStr}.csv`);
  showToast(`Exported ${records.length} survey(s)`, 'success');
});

// ══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════════════════════════════════

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className   = `toast ${type}`;
  t.textContent = msg;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 2750);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Expose for inline onclick handlers in rendered HTML
window.deleteRecord = deleteRecord;
window.exportRecord = exportRecord;
