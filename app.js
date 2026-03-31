/* app.js — NTB Watercourse Permitting
   Vanilla ES6+. No frameworks. All data on-device in localStorage.
*/

// ── Storage keys ──────────────────────────────────────────────────────────────
const STORAGE_KEY  = 'culvert_survey_records';
const SETTINGS_KEY = 'culvert_settings';

// ── App state ─────────────────────────────────────────────────────────────────
let records         = [];
let settings        = { surveyor: '', company: '', projectNumber: '', projectName: '' };
let editingRecordId = null;   // null = new survey, string id = editing existing
let formSnapshot    = {};     // field values captured at form-open time

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
const sName           = document.getElementById('s-surveyor');
const sCompany        = document.getElementById('s-company');
const sProjectNum     = document.getElementById('s-project-num');
const sProjectName    = document.getElementById('s-project-name');
const btnSaveSettings = document.getElementById('btn-save-settings');

// Home screen
const recordsList  = document.getElementById('records-list');
const recordCount  = document.getElementById('record-count');
const btnExportAll = document.getElementById('btn-export-all');

// Survey form
const form        = document.getElementById('survey-form');
const btnSubmit   = document.getElementById('btn-submit');
const metaSection = document.getElementById('meta-section');

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

// Unsaved-changes modal
const unsavedModal    = document.getElementById('unsaved-modal');
const btnModalSave    = document.getElementById('btn-modal-save');
const btnModalDiscard = document.getElementById('btn-modal-discard');
const btnModalCancel  = document.getElementById('btn-modal-cancel');

// ── Boot ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadRecords();
  renderRecords();
  updateSlope();
  registerSW();
  goHome();
});

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
      .catch(err => console.warn('SW:', err));
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SCREEN NAVIGATION
// ══════════════════════════════════════════════════════════════════════════════

function goHome() {
  screenHome.style.display = 'block';
  screenForm.style.display = 'none';
  btnBack.style.display    = 'none';
  headerTitle.textContent  = 'NTB Watercourse Permitting';
  editingRecordId          = null;
}

function goForm() {
  editingRecordId = null;
  screenHome.style.display = 'none';
  screenForm.style.display = 'block';
  btnBack.style.display    = 'inline-flex';
  headerTitle.textContent  = 'New Survey';
  btnSubmit.innerHTML      = '&#10003; Save Survey';

  prefillMetadata();
  const hasSettings = settings.surveyor || settings.company ||
                      settings.projectNumber || settings.projectName;
  metaSection.open = !hasSettings;

  gpsAccuracy.textContent = '';
  gpsAccuracy.className   = 'gps-accuracy';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  fSiteId.focus();
  snapshotForm();
}

function goFormEdit(record) {
  editingRecordId = record.id;
  screenHome.style.display = 'none';
  screenForm.style.display = 'block';
  btnBack.style.display    = 'inline-flex';
  headerTitle.textContent  = `Editing: ${record.siteId}`;
  btnSubmit.innerHTML      = '&#10003; Update Survey';

  // Fill metadata
  fMetaSurveyor.value     = record.surveyor      || '';
  fMetaCompany.value      = record.company       || '';
  fMetaProjectNum.value   = record.projectNumber || '';
  fMetaProjectName.value  = record.projectName   || '';
  fMetaDate.value         = record.date          || todayISO();
  fMetaFlow.value         = record.flowCondition || '';
  fMetaWeather.value      = record.weather       || '';
  fMetaWeatherNotes.value = record.weatherNotes  || '';
  fNotes.value            = record.notes         || '';

  // Fill measurements
  fSiteId.value    = record.siteId    || '';
  fDiameter.value  = record.diameter  != null ? record.diameter  : '';
  fLat.value       = record.lat       != null ? record.lat       : '';
  fLon.value       = record.lon       != null ? record.lon       : '';
  fElevA.value     = record.elevA     != null ? record.elevA     : '';
  fElevB.value     = record.elevB     != null ? record.elevB     : '';
  fDistL.value     = record.distL     != null ? record.distL     : '';
  fVelocity.value  = record.velocity  != null ? record.velocity  : '';
  fChanWidth.value = record.chanWidth != null ? record.chanWidth : '';
  fChanDepth.value = record.chanDepth != null ? record.chanDepth : '';

  // Open metadata so user can review/edit all fields
  metaSection.open = true;

  gpsAccuracy.textContent = '';
  gpsAccuracy.className   = 'gps-accuracy';
  updateSlope();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  fSiteId.focus();
  snapshotForm();
}

btnNewSurvey.addEventListener('click', goForm);

// ══════════════════════════════════════════════════════════════════════════════
// CHANGE DETECTION
// Snapshot all field values on form open; compare on back/cancel.
// ══════════════════════════════════════════════════════════════════════════════

function snapshotForm() {
  formSnapshot = {
    surveyor:     fMetaSurveyor.value,
    company:      fMetaCompany.value,
    projectNum:   fMetaProjectNum.value,
    projectName:  fMetaProjectName.value,
    date:         fMetaDate.value,
    flow:         fMetaFlow.value,
    weather:      fMetaWeather.value,
    weatherNotes: fMetaWeatherNotes.value,
    notes:        fNotes.value,
    siteId:       fSiteId.value,
    diameter:     fDiameter.value,
    lat:          fLat.value,
    lon:          fLon.value,
    elevA:        fElevA.value,
    elevB:        fElevB.value,
    distL:        fDistL.value,
    velocity:     fVelocity.value,
    chanWidth:    fChanWidth.value,
    chanDepth:    fChanDepth.value,
  };
}

function hasUnsavedChanges() {
  return (
    fMetaSurveyor.value     !== formSnapshot.surveyor     ||
    fMetaCompany.value      !== formSnapshot.company      ||
    fMetaProjectNum.value   !== formSnapshot.projectNum   ||
    fMetaProjectName.value  !== formSnapshot.projectName  ||
    fMetaDate.value         !== formSnapshot.date         ||
    fMetaFlow.value         !== formSnapshot.flow         ||
    fMetaWeather.value      !== formSnapshot.weather      ||
    fMetaWeatherNotes.value !== formSnapshot.weatherNotes ||
    fNotes.value            !== formSnapshot.notes        ||
    fSiteId.value           !== formSnapshot.siteId       ||
    fDiameter.value         !== formSnapshot.diameter     ||
    fLat.value              !== formSnapshot.lat          ||
    fLon.value              !== formSnapshot.lon          ||
    fElevA.value            !== formSnapshot.elevA        ||
    fElevB.value            !== formSnapshot.elevB        ||
    fDistL.value            !== formSnapshot.distL        ||
    fVelocity.value         !== formSnapshot.velocity     ||
    fChanWidth.value        !== formSnapshot.chanWidth    ||
    fChanDepth.value        !== formSnapshot.chanDepth
  );
}

// ── Back button ───────────────────────────────────────────────────────────────
btnBack.addEventListener('click', () => {
  if (!hasUnsavedChanges()) {
    clearForm();
    goHome();
    return;
  }
  openUnsavedModal();
});

// ══════════════════════════════════════════════════════════════════════════════
// UNSAVED-CHANGES MODAL
// ══════════════════════════════════════════════════════════════════════════════

function openUnsavedModal()  { unsavedModal.style.display = 'flex'; }
function closeUnsavedModal() { unsavedModal.style.display = 'none'; }

// "Keep Editing" — dismiss modal, stay on form
btnModalCancel.addEventListener('click', closeUnsavedModal);

// Click on the backdrop — treat same as "Keep Editing"
unsavedModal.addEventListener('click', e => {
  if (e.target === unsavedModal) closeUnsavedModal();
});

// "Discard Changes" — abandon and go home
btnModalDiscard.addEventListener('click', () => {
  closeUnsavedModal();
  clearForm();
  goHome();
});

// "Save" — attempt save; if validation passes, goes home automatically
btnModalSave.addEventListener('click', () => {
  closeUnsavedModal();
  saveForm();
});

// Escape key: close modal if open, then close settings drawer if open
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (unsavedModal.style.display === 'flex') { closeUnsavedModal(); return; }
    if (settingsDrawer.classList.contains('open')) closeSettings();
  }
});

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
  sName.value        = settings.surveyor      || '';
  sCompany.value     = settings.company       || '';
  sProjectNum.value  = settings.projectNumber || '';
  sProjectName.value = settings.projectName   || '';
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
  btnGps.disabled         = true;
  btnGps.textContent      = '…';
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
// FORM SAVE — handles both new records and edits in place
// ══════════════════════════════════════════════════════════════════════════════

function saveForm() {
  if (!fSiteId.value.trim()) {
    fSiteId.classList.add('error');
    showToast('Transect ID is required.', 'error');
    return false;
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

  // All editable fields collected once, used for both new and edit paths
  const fields = {
    date:          fMetaDate.value        || todayISO(),
    surveyor:      fMetaSurveyor.value.trim(),
    company:       fMetaCompany.value.trim(),
    projectNumber: fMetaProjectNum.value.trim(),
    projectName:   fMetaProjectName.value.trim(),
    flowCondition: fMetaFlow.value,
    weather:       fMetaWeather.value,
    weatherNotes:  fMetaWeatherNotes.value.trim(),
    siteId:        fSiteId.value.trim(),
    diameter:      D,
    lat:           fLat.value      !== '' ? parseFloat(fLat.value)      : null,
    lon:           fLon.value      !== '' ? parseFloat(fLon.value)      : null,
    elevA:         fElevA.value    !== '' ? parseFloat(fElevA.value)    : null,
    elevB:         fElevB.value    !== '' ? parseFloat(fElevB.value)    : null,
    distL:         fDistL.value    !== '' ? parseFloat(fDistL.value)    : null,
    velocity:      fVelocity.value !== '' ? parseFloat(fVelocity.value) : null,
    chanWidth:     fChanWidth.value!== '' ? parseFloat(fChanWidth.value): null,
    chanDepth:     fChanDepth.value!== '' ? parseFloat(fChanDepth.value): null,
    slopePct,
    slopeDeg,
    minBDist,
    notes:         fNotes.value.trim(),
  };

  if (editingRecordId !== null) {
    // ── Edit: overwrite in place, preserve original id + timestamp + position ─
    const idx = records.findIndex(r => r.id === editingRecordId);
    if (idx !== -1) {
      records[idx] = {
        id:         records[idx].id,
        timestamp:  records[idx].timestamp,   // original creation time preserved
        lastEdited: new Date().toISOString(),  // updated on every edit
        ...fields,
      };
      persistRecords();
      renderRecords();
      clearForm();
      goHome();
      showToast(`Updated "${fields.siteId}"`, 'success');
    }
  } else {
    // ── New: prepend to records array ────────────────────────────────────────
    const record = {
      id:        generateId(),
      timestamp: new Date().toISOString(),
      ...fields,
    };
    records.unshift(record);
    persistRecords();
    renderRecords();
    clearForm();
    goHome();
    showToast(`Saved "${record.siteId}"`, 'success');
  }

  return true;
}

form.addEventListener('submit', e => {
  e.preventDefault();
  saveForm();
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
  // Re-snapshot so hasUnsavedChanges() is false until the user types again
  snapshotForm();
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

    const coordText   = (r.lat != null && r.lon != null)
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
    const timeLabel  = surveyDate ? `${surveyDate} · logged ${ts}` : ts;

    const editedLabel = r.lastEdited
      ? `Edited ${new Date(r.lastEdited).toLocaleString(undefined, {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        })}`
      : null;

    const safeId = esc(r.id);

    return `
      <div class="record-item" data-id="${safeId}">
        <div class="record-site">${esc(r.siteId)}</div>
        <div class="record-slope">${esc(slopeText)}</div>
        <div class="record-meta">${metaHtml}</div>
        <div class="record-actions">
          <button class="btn btn-secondary btn-sm"
                  onclick="editRecord('${safeId}')"
                  title="Edit survey">&#9998; Edit</button>
          <button class="btn btn-secondary btn-sm"
                  onclick="exportRecord('${safeId}')"
                  title="Export to CSV">&#8659; CSV</button>
          <button class="btn btn-danger btn-sm btn-icon"
                  onclick="deleteRecord('${safeId}')"
                  title="Delete survey">&#10005;</button>
        </div>
        <div class="record-timestamp">${esc(timeLabel)}</div>
        ${editedLabel ? `<div class="record-edited">${esc(editedLabel)}</div>` : ''}
      </div>`;
  }).join('');
}

// ── Edit ──────────────────────────────────────────────────────────────────────
function editRecord(id) {
  const rec = records.find(r => r.id === id);
  if (!rec) return;
  goFormEdit(rec);
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
window.editRecord   = editRecord;
