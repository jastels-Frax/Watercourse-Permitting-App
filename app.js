/* app.js — Culvert Survey
   Vanilla ES6+. No frameworks. All data lives in localStorage.
   Screens: home → form. Settings in a slide-in drawer.
*/

// ── Storage keys ─────────────────────────────────────────────────────────────
const STORAGE_KEY  = 'culvert_survey_records';
const SETTINGS_KEY = 'culvert_settings';

// ── State ────────────────────────────────────────────────────────────────────
let records  = [];   // survey records, newest first
let settings = { surveyor: '', company: '', projectNumber: '', projectName: '' };

// ── DOM refs — navigation & chrome ───────────────────────────────────────────
const screenHome      = document.getElementById('screen-home');
const screenForm      = document.getElementById('screen-form');
const headerTitle     = document.getElementById('header-title');
const btnBack         = document.getElementById('btn-back');
const btnNewSurvey    = document.getElementById('btn-new-survey');
const btnSettingsOpen = document.getElementById('btn-settings');
const btnSettingsClose= document.getElementById('btn-settings-close');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsDrawer  = document.getElementById('settings-drawer');

// DOM refs — settings drawer fields
const sName           = document.getElementById('s-surveyor');
const sCompany        = document.getElementById('s-company');
const sProjectNum     = document.getElementById('s-project-num');
const sProjectName    = document.getElementById('s-project-name');
const btnSaveSettings = document.getElementById('btn-save-settings');

// DOM refs — home screen
const recordsList     = document.getElementById('records-list');
const recordCount     = document.getElementById('record-count');
const btnExportAll    = document.getElementById('btn-export-all');

// DOM refs — survey form
const form            = document.getElementById('survey-form');
const metaSection     = document.getElementById('meta-section');

// Metadata fields
const fMetaSurveyor   = document.getElementById('f-meta-surveyor');
const fMetaCompany    = document.getElementById('f-meta-company');
const fMetaProjectNum = document.getElementById('f-meta-project-num');
const fMetaProjectName= document.getElementById('f-meta-project-name');
const fMetaDate       = document.getElementById('f-meta-date');
const fMetaFlow       = document.getElementById('f-meta-flow');
const fMetaWeather    = document.getElementById('f-meta-weather');
const fMetaWeatherNotes = document.getElementById('f-meta-weather-notes');
const fNotes          = document.getElementById('f-notes');

// Measurement fields
const fSiteId         = document.getElementById('f-site-id');
const fDiameter       = document.getElementById('f-diameter');
const fLat            = document.getElementById('f-lat');
const fLon            = document.getElementById('f-lon');
const fElevA          = document.getElementById('f-elev-a');
const fElevB          = document.getElementById('f-elev-b');
const fDistL          = document.getElementById('f-dist-l');
const fVelocity       = document.getElementById('f-velocity');
const fChanWidth      = document.getElementById('f-chan-width');
const fChanDepth      = document.getElementById('f-chan-depth');

// Computed display
const dispSlope       = document.getElementById('disp-slope');
const dispDeg         = document.getElementById('disp-deg');
const dispMinDist     = document.getElementById('disp-min-dist');

// Other form controls
const btnGps          = document.getElementById('btn-gps');
const gpsAccuracy     = document.getElementById('gps-accuracy');
const btnClear        = document.getElementById('btn-clear');

// ── Initialization ────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadRecords();
  renderRecords();
  updateSlope();
  registerServiceWorker();
  showScreen('home');
});

// ── Service Worker ────────────────────────────────────────────────────────────
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
      .catch(err => console.warn('SW registration failed:', err));
  }
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

function saveSettingsToStorage() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function openSettings() {
  // Populate drawer fields from current settings
  sName.value        = settings.surveyor      || '';
  sCompany.value     = settings.company       || '';
  sProjectNum.value  = settings.projectNumber || '';
  sProjectName.value = settings.projectName   || '';

  // visibility/pointer-events are controlled purely by CSS classes — no
  // display:none involved, so CSS transitions fire reliably on all browsers
  settingsOverlay.classList.add('open');
  settingsDrawer.classList.add('open');
  sName.focus();
}

function closeSettings() {
  settingsDrawer.classList.remove('open');
  settingsOverlay.classList.remove('open');
}

btnSettingsOpen.addEventListener('click', openSettings);
btnSettingsClose.addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', closeSettings);

// Close drawer on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && settingsDrawer.classList.contains('open')) {
    closeSettings();
  }
});

btnSaveSettings.addEventListener('click', () => {
  settings.surveyor      = sName.value.trim();
  settings.company       = sCompany.value.trim();
  settings.projectNumber = sProjectNum.value.trim();
  settings.projectName   = sProjectName.value.trim();
  saveSettingsToStorage();
  closeSettings();
  showToast('Settings saved.', 'success');
});

// ══════════════════════════════════════════════════════════════════════════════
// SCREEN NAVIGATION
// ══════════════════════════════════════════════════════════════════════════════

function showScreen(name) {
  const onHome = name === 'home';
  screenHome.hidden = !onHome;
  screenForm.hidden =  onHome;
  btnBack.hidden    =  onHome;
  headerTitle.textContent = onHome ? 'Culvert Survey' : 'New Survey';

  if (!onHome) {
    prefillMetadata();
    // Open the metadata section if no settings are saved yet; close it if they are
    const hasSettings = settings.surveyor || settings.company ||
                        settings.projectNumber || settings.projectName;
    metaSection.open = !hasSettings;
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

// Pre-fill metadata fields from saved settings + today's date
function prefillMetadata() {
  fMetaSurveyor.value    = settings.surveyor      || '';
  fMetaCompany.value     = settings.company       || '';
  fMetaProjectNum.value  = settings.projectNumber || '';
  fMetaProjectName.value = settings.projectName   || '';
  fMetaDate.value        = todayISO();
  fMetaFlow.value        = '';
  fMetaWeather.value     = '';
  fMetaWeatherNotes.value= '';
}

// Returns YYYY-MM-DD for today in the local timezone
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// True if any measurement or notes field has been touched
function formIsDirty() {
  return [fSiteId, fDiameter, fLat, fLon, fElevA, fElevB,
          fDistL, fVelocity, fChanWidth, fChanDepth,
          fNotes, fMetaWeatherNotes]
    .some(el => el.value.trim() !== '');
}

// ══════════════════════════════════════════════════════════════════════════════
// localStorage — RECORDS
// ══════════════════════════════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════════════════════════════
// GPS
// ══════════════════════════════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════════════════════════════
// LIVE SLOPE CALCULATION
// ══════════════════════════════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════════════════════════════
// FORM SAVE
// ══════════════════════════════════════════════════════════════════════════════

form.addEventListener('submit', e => {
  e.preventDefault();
  if (!validateForm()) return;

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
    // metadata
    date:         fMetaDate.value          || todayISO(),
    surveyor:     fMetaSurveyor.value.trim(),
    company:      fMetaCompany.value.trim(),
    projectNumber:fMetaProjectNum.value.trim(),
    projectName:  fMetaProjectName.value.trim(),
    flowCondition:fMetaFlow.value,
    weather:      fMetaWeather.value,
    weatherNotes: fMetaWeatherNotes.value.trim(),
    // site
    siteId:       fSiteId.value.trim(),
    diameter:     D,
    // gps
    lat:          fLat.value      !== '' ? parseFloat(fLat.value)      : null,
    lon:          fLon.value      !== '' ? parseFloat(fLon.value)      : null,
    // elevations
    elevA:        fElevA.value    !== '' ? parseFloat(fElevA.value)    : null,
    elevB:        fElevB.value    !== '' ? parseFloat(fElevB.value)    : null,
    distL:        fDistL.value    !== '' ? parseFloat(fDistL.value)    : null,
    // hydraulics
    velocity:     fVelocity.value !== '' ? parseFloat(fVelocity.value) : null,
    chanWidth:    fChanWidth.value!== '' ? parseFloat(fChanWidth.value): null,
    chanDepth:    fChanDepth.value!== '' ? parseFloat(fChanDepth.value): null,
    // computed
    slopePct,
    slopeDeg,
    minBDist,
    // notes
    notes:        fNotes.value.trim()
  };

  records.unshift(record);
  saveRecords();
  renderRecords();
  clearForm();
  showScreen('home');
  showToast(`Survey "${record.siteId}" saved!`, 'success');
});

function validateForm() {
  const valid = fSiteId.value.trim() !== '';
  fSiteId.classList.toggle('error', !valid);
  if (!valid) showToast('Transect ID is required.', 'error');
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
  // Restore settings-backed metadata fields after form.reset()
  prefillMetadata();
}

// ══════════════════════════════════════════════════════════════════════════════
// RENDER RECORDS (home screen)
// ══════════════════════════════════════════════════════════════════════════════

function renderRecords() {
  const count = records.length;
  recordCount.textContent = count === 1 ? '1 survey' : `${count} surveys`;
  btnExportAll.style.display = count === 0 ? 'none' : '';

  if (count === 0) {
    recordsList.innerHTML =
      '<p class="no-records">No surveys saved yet.<br>' +
      'Tap <strong>+ New Survey</strong> to begin.</p>';
    return;
  }

  recordsList.innerHTML = records.map(r => {
    const slopeText = r.slopePct !== null ? r.slopePct.toFixed(2) + '%' : '—';

    const coordText = (r.lat !== null && r.lon !== null)
      ? `${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}`
      : 'No coordinates';

    const diamText    = r.diameter !== null ? `${r.diameter} m dia.` : '';
    const projectLine = [r.surveyor, r.projectName].filter(Boolean).join(' · ');
    const coordLine   = [coordText, diamText].filter(Boolean).join(' · ');

    // Build meta HTML — show project line only if present
    const metaHtml = projectLine
      ? `${escHtml(projectLine)}<br>${escHtml(coordLine)}`
      : escHtml(coordLine);

    const ts = new Date(r.timestamp).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    // Show survey date if it differs from the timestamp date
    const surveyDate = r.date
      ? new Date(r.date + 'T12:00:00').toLocaleDateString(undefined,
          { month: 'short', day: 'numeric', year: 'numeric' })
      : null;
    const timeLabel = surveyDate ? `${surveyDate} · logged ${ts}` : ts;

    return `
      <div class="record-item" data-id="${r.id}">
        <div class="record-site">${escHtml(r.siteId)}</div>
        <div class="record-slope">${escHtml(slopeText)}</div>
        <div class="record-meta">${metaHtml}</div>
        <div class="record-actions">
          <button class="btn btn-secondary btn-sm"
                  onclick="exportRecord('${r.id}')"
                  aria-label="Export ${escHtml(r.siteId)} to CSV"
                  title="Export this survey to CSV">&#8659; CSV</button>
          <button class="btn btn-danger btn-sm btn-icon"
                  onclick="deleteRecord('${r.id}')"
                  aria-label="Delete ${escHtml(r.siteId)}"
                  title="Delete this survey">&#10005;</button>
        </div>
        <div class="record-timestamp">${escHtml(timeLabel)}</div>
      </div>`;
  }).join('');
}

// ── Delete ─────────────────────────────────────────────────────────────────
function deleteRecord(id) {
  const rec = records.find(r => r.id === id);
  if (!rec) return;
  if (!confirm(`Delete survey "${rec.siteId}"?`)) return;
  records = records.filter(r => r.id !== id);
  saveRecords();
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

function csvEsc(v) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

function recordToRow(r) {
  return [
    r.timestamp,
    r.date            ?? '',
    r.surveyor        ?? '',
    r.company         ?? '',
    r.projectNumber   ?? '',
    r.projectName     ?? '',
    r.siteId,
    r.diameter        ?? '',
    r.lat             ?? '',
    r.lon             ?? '',
    r.elevA           ?? '',
    r.elevB           ?? '',
    r.distL           ?? '',
    r.minBDist !== null && r.minBDist !== undefined ? r.minBDist.toFixed(3) : '',
    r.slopePct !== null && r.slopePct !== undefined ? r.slopePct.toFixed(4) : '',
    r.slopeDeg !== null && r.slopeDeg !== undefined ? r.slopeDeg.toFixed(4) : '',
    r.velocity        ?? '',
    r.chanWidth       ?? '',
    r.chanDepth       ?? '',
    r.flowCondition   ?? '',
    r.weather         ?? '',
    r.weatherNotes    ?? '',
    r.notes           ?? ''
  ].map(csvEsc).join(',');
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

function buildCSV(subset) {
  const headerRow = CSV_HEADERS.map(h => `"${h}"`).join(',');
  return [headerRow, ...subset.map(recordToRow)].join('\r\n');
}

// Export single record
function exportRecord(id) {
  const rec = records.find(r => r.id === id);
  if (!rec) return;
  const safeName = rec.siteId.replace(/[^a-z0-9_-]/gi, '_');
  const dateStr  = (rec.date || new Date(rec.timestamp).toISOString()).slice(0, 10);
  downloadCSV(buildCSV([rec]), `culvert-${safeName}-${dateStr}.csv`);
  showToast(`Exported "${rec.siteId}" to CSV.`, 'success');
}

// Export all records
btnExportAll.addEventListener('click', () => {
  if (records.length === 0) { showToast('No surveys to export.', 'error'); return; }
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCSV(buildCSV(records), `culvert-survey-all-${dateStr}.csv`);
  showToast(`Exported ${records.length} survey(s) to CSV.`, 'success');
});

// ══════════════════════════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════════════════════════

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

// Expose to inline onclick handlers in rendered HTML
window.deleteRecord = deleteRecord;
window.exportRecord = exportRecord;
