/* app.js — Crossing Assessor
   Part 3a: app shell, view switching, back-button unsaved-change guard.
   Later parts add form rendering and list rendering on top of this shell.
*/

'use strict';

// ── Settings key (record storage lives in data.js / CA namespace) ─────────────
const SETTINGS_KEY = 'ca_settings';

// ═══════════════════════════════════════════════════════════════════════════════
// SECTIONS
// ═══════════════════════════════════════════════════════════════════════════════

const SECTIONS = [
  { id: 'id',       label: 'ID'       },
  { id: 'wc',       label: 'WC'       },
  { id: 'fish',     label: 'Fish'     },
  { id: 'geo',      label: 'Geo'      },
  { id: 'crossing', label: 'Crossing' },
  { id: 'wetland',  label: 'Wetland'  },
  { id: 'photos',   label: 'Photos'   },
  { id: 'permits',  label: 'Permits'  },
];

// Nav tabs hidden when watercoursePresent !== true (null or false)
const WC_GATED = ['fish', 'geo', 'crossing'];

// ═══════════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════════

let settings      = { assessor: '', projectId: '', watershedPrimary: '', watershedSecondary: '', priority: '' };

// NSE primary watershed list — alphabetical, "Other" appended last
const WATERSHED_OPTIONS = [
  'Annapolis', 'Antigonish', 'Aspy', 'Avon', 'Baddeck', 'Barrington', 'Bear',
  "Bras d'Or", 'Cheticamp', 'Clyde', 'Cornwallis', 'East River Sheet Harbour',
  'Economy', 'Gaspereau', 'Gold', 'Guysborough', 'Indian', 'Jordan', 'Kennecook',
  'LaHave', "L'Ardoise", 'Liscomb', 'Liverpool', 'Lockeport', 'Mahone', 'Margaree',
  'Mersey', 'Meteghan', 'Middle (Cape Breton)', 'Mira', 'Moser', 'Musquodoboit',
  'Parrsboro', 'Petite Rivière', 'Philip', 'Port Mouton', 'Pubnico', 'Sackville',
  'Salmon (Colchester)', 'Salmon (Yarmouth)', 'Shubenacadie', 'St. Marys',
  'Stewiacke', 'Tangier', 'Tidnish', 'Tusket', 'Wallace',
];

// Which view is currently shown: 'list' | 'form'
let currentView   = 'list';

// The record object currently open in the form (null when on list view).
// This is a working copy in memory; it is NOT automatically saved on change.
let currentRecord = null;

// True once the user has altered any field since the form was opened.
// Reset to false whenever the form is opened or the record is saved.
let formDirty     = false;

// Which section tab is active while in form view.
let activeSection = 'id';

// Which reach (0-based) is currently displayed in Fish and Geo sections.
let activeReachIdx = 0;

// ═══════════════════════════════════════════════════════════════════════════════
// DOM REFS
// ═══════════════════════════════════════════════════════════════════════════════

const viewList        = document.getElementById('view-list');
const viewForm        = document.getElementById('view-form');
const headerTitle     = document.getElementById('header-title');
const btnBack         = document.getElementById('btn-back');
const btnMenu         = document.getElementById('btn-menu');
const drawerOverlay   = document.getElementById('drawer-overlay');
const settingsDrawer  = document.getElementById('settings-drawer');
const btnDrawerClose  = document.getElementById('btn-drawer-close');
const sAssessor       = document.getElementById('s-assessor');
const sProjectId      = document.getElementById('s-project-id');
const sWatershedPrimary      = document.getElementById('s-watershed-primary');
const sWatershedPrimaryOther = document.getElementById('s-watershed-primary-other');
const sWatershedSecondary    = document.getElementById('s-watershed-secondary');
const sPriority       = document.getElementById('s-priority');
const btnSaveSettings = document.getElementById('btn-save-settings');
const modalUnsaved    = document.getElementById('modal-unsaved');
const btnModalDraft   = document.getElementById('btn-modal-draft');
const btnModalDiscard = document.getElementById('btn-modal-discard');
const btnModalCancel  = document.getElementById('btn-modal-cancel');
const modalConfirm     = document.getElementById('modal-confirm');
const btnConfirmOk     = document.getElementById('btn-confirm-ok');
const btnConfirmCancel = document.getElementById('btn-confirm-cancel');

// ═══════════════════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  showView('list');       // always start on the record list
});

// ═══════════════════════════════════════════════════════════════════════════════
// VIEW SWITCHING  —  showView(name)
//
// Single source of truth for what is on screen. Updates:
//   • Which <section> is visible (hidden attribute)
//   • Back button visibility
//   • Header title text
//   • Triggers a re-render of the newly active view
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * showView('list' | 'form')
 * Switches the visible view. Callers must ensure currentRecord is set before
 * calling showView('form').
 */
function showView(name) {
  currentView = name;
  const onForm = name === 'form';

  // Toggle view visibility using the HTML `hidden` attribute so that
  // CSS [hidden] { display:none } keeps it out of the layout *and* tab order.
  viewList.toggleAttribute('hidden', onForm);
  viewForm.toggleAttribute('hidden', !onForm);

  // Back button is only meaningful in form view
  btnBack.toggleAttribute('hidden', !onForm);

  // Header title: brand name on list, crossing ID on form
  if (onForm) {
    headerTitle.textContent = currentRecord?.crossingId || 'New Record';
  } else {
    headerTitle.textContent = 'Crossing Assessor';
    renderList();   // always refresh the list when returning to it
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// OPEN / EXIT RECORD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * openRecord(record)
 * Load a record into the form view. Resets the dirty flag.
 * The record is a plain object (from CA.createRecord or CA.getRecord);
 * it is not yet saved to storage by this call.
 */
function openRecord(record) {
  if (!record.reaches || !record.reaches.length) {
    record.reaches = [migrateToReach(record)];
  }
  activeReachIdx = 0;
  currentRecord = record;
  formDirty     = false;
  showView('form');
  renderForm(record);
}

/**
 * exitForm()
 * Unconditionally close the form and return to the list.
 * Only call this after resolving any unsaved-changes concern.
 */
function exitForm() {
  currentRecord = null;
  formDirty     = false;
  showView('list');
}

// ═══════════════════════════════════════════════════════════════════════════════
// BACK BUTTON — with unsaved-change guard
// ═══════════════════════════════════════════════════════════════════════════════

btnBack.addEventListener('click', handleBack);

function handleBack() {
  if (!formDirty) {
    // Nothing changed — leave immediately, no prompt needed
    exitForm();
    return;
  }

  // Form is dirty: ask what to do before discarding changes
  openUnsavedModal(
    /* onSaveDraft  */ () => { saveDraft(); exitForm(); },
    /* onDiscard    */ () => exitForm()
    // onCancel is handled inside openUnsavedModal (dismiss only)
  );
}

// ── Dirty tracking ─────────────────────────────────────────────────────────────
// Event delegation on the form view container catches every input change from
// any field regardless of when it is added to the DOM (form renders lazily).
viewForm.addEventListener('input',  () => { formDirty = true; });
viewForm.addEventListener('change', () => { formDirty = true; });

// ═══════════════════════════════════════════════════════════════════════════════
// SAVE DRAFT (shell version — form collection added in Part 3b+)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * saveDraft()
 * Persists the current in-memory record as a draft.
 * In Part 3b+ this will first call collectFormData() to capture field values.
 * Returns the saved record (with updatedAt stamped by CA.saveRecord).
 */
function saveDraft() {
  if (!currentRecord) return null;
  const data  = collectFormData();
  const saved = CA.saveRecord({ ...data, status: 'draft' });
  currentRecord = saved;
  formDirty     = false;
  toast(`Draft saved — ${saved.crossingId}`, 'success');
  return saved;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORM RENDERER — section navigator + per-section panels
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * renderForm(record)
 * Renders the sticky section-nav strip and one panel per section into
 * #view-form. Only the active section panel is visible at any time.
 * Wires tab clicks to showSection(). Section content is filled in by
 * later parts (3c+); stubs are shown until then.
 */
function renderForm(record) {
  console.log('[CA] renderForm:', record?.crossingId);
  viewForm.innerHTML = `
    <div id="sar-banner" class="sar-banner" hidden>
      ⚠ SAR Polygon — Species at Risk present or suspected
    </div>

    <nav class="section-nav" id="section-nav" aria-label="Form sections">
      ${SECTIONS.map(s => `
        <button class="nav-tab" data-section="${esc(s.id)}" type="button"
                aria-label="${esc(s.label)} section">
          <span class="nav-check" aria-hidden="true">✓</span>${esc(s.label)}
        </button>
      `).join('')}
    </nav>

    <div id="section-panels">
      ${SECTIONS.map(s => `
        <div class="form-section" data-section="${esc(s.id)}" hidden>
          <p class="section-stub">${esc(s.label)} — fields coming soon.</p>
        </div>
      `).join('')}
    </div>

    <footer class="form-footer" id="form-footer">
      <div id="footer-draft" class="footer-state">
        <button class="btn btn-secondary" id="btn-save-draft"  type="button">Save Draft</button>
        <button class="btn btn-primary"   id="btn-submit"      type="button">Submit</button>
      </div>
      <div id="footer-confirm" class="footer-state" hidden>
        <span class="footer-warn" id="footer-warn-text"></span>
        <button class="btn btn-ghost"  id="btn-fix-errors"    type="button">Fix Errors</button>
        <button class="btn btn-danger" id="btn-submit-anyway" type="button">Submit Anyway</button>
      </div>
      <div id="footer-complete" class="footer-state" hidden>
        <span class="lock-msg">Complete — record locked</span>
        <button class="btn btn-ghost" id="btn-edit"  type="button">Edit</button>
        <button class="btn btn-ghost" id="btn-print" type="button">Print</button>
      </div>
    </footer>
  `;

  document.getElementById('section-nav').addEventListener('click', e => {
    const tab = e.target.closest('.nav-tab');
    if (tab) showSection(tab.dataset.section);
  });

  document.getElementById('btn-save-draft')
    .addEventListener('click', saveRecord);
  document.getElementById('btn-submit')
    .addEventListener('click', submitRecord);
  document.getElementById('btn-edit')
    .addEventListener('click', editRecord);
  document.getElementById('btn-print')
    .addEventListener('click', () => exportSinglePDF(currentRecord));
  document.getElementById('btn-fix-errors')
    .addEventListener('click', () => { clearValidationErrors(); setFooterState('draft'); });
  document.getElementById('btn-submit-anyway')
    .addEventListener('click', () => { clearValidationErrors(); finalizeSubmit(); });

  showSection('id');
  initSectionId(record);
  initSectionWc(record);
  initSectionFish(record);
  initSectionGeo(record);
  initSectionCrossing(record);
  initSectionWetland(record);
  initSectionPhotos(record);
  initSectionPermits(record);
  // setFooterState runs last so it can disable inputs added by init functions
  setFooterState(record.status === 'complete' ? 'complete' : 'draft');
}

/**
 * showSection(sectionId)
 * Highlights the matching nav tab and makes its panel visible while hiding all
 * others. Scrolls the tab into view horizontally if the strip overflows.
 */
function showSection(sectionId) {
  console.log('[CA] showSection:', sectionId);
  activeSection = sectionId;

  document.querySelectorAll('#section-nav .nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.section === sectionId);
  });

  // Explicit setAttribute/removeAttribute for broad Safari compatibility —
  // toggleAttribute(name, force) was not supported before Safari 12.1.
  document.querySelectorAll('#section-panels .form-section').forEach(panel => {
    if (panel.dataset.section === sectionId) {
      panel.removeAttribute('hidden');
    } else {
      panel.setAttribute('hidden', '');
    }
  });

  document.querySelector(`#section-nav .nav-tab[data-section="${sectionId}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

/**
 * setSectionComplete(sectionId, bool)
 * Lights up (or clears) the ✓ badge on a nav tab.
 * Called by field-validation logic as fields are filled.
 */
function setSectionComplete(sectionId, bool) {
  const tab = document.querySelector(
    `#section-nav .nav-tab[data-section="${sectionId}"]`
  );
  if (tab) tab.classList.toggle('done', bool);
}

// ═══════════════════════════════════════════════════════════════════════════════
// WATERCOURSE CONDITIONAL SECTION VISIBILITY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * applyWatercourseFilter(present)
 * Shows or hides the WC-gated nav tabs (fish / geo / crossing) based on
 * whether a watercourse has been confirmed.
 *   present === true  → show all tabs
 *   present === null  → hide gated tabs (not yet confirmed)
 *   present === false → hide gated tabs + user sees locked message in WC panel
 * If the user is currently on a now-hidden tab they are redirected to 'wc'.
 */
function applyWatercourseFilter(present) {
  // Only hide gated tabs when user has explicitly answered No (false).
  // null (unanswered) leaves all 8 tabs visible.
  const show = present !== false;
  WC_GATED.forEach(id => {
    const tab = document.querySelector(`#section-nav .nav-tab[data-section="${id}"]`);
    if (tab) tab.hidden = !show;
  });
  if (!show && WC_GATED.includes(activeSection)) {
    showSection('wc');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 0 — Crossing Identification
// ═══════════════════════════════════════════════════════════════════════════════

function initSectionId(record) {
  const panel = document.querySelector('#section-panels .form-section[data-section="id"]');
  if (!panel) return;

  const pr        = record.priority          || '';
  const wsPrimary = record.watershedPrimary  || '';
  const wsSec     = record.watershedSecondary || '';
  const wsIsKnown = wsPrimary === '' || wsPrimary === 'Other' || WATERSHED_OPTIONS.includes(wsPrimary);
  const wsDrop    = wsIsKnown ? wsPrimary : 'Other';
  const wsOther   = wsIsKnown ? '' : wsPrimary;

  panel.innerHTML = `
    <div class="field-stack">

      <div class="field-row">
        <label class="field-label">
          <span>Crossing ID <span class="req">*</span></span>
          <input class="field-input" type="text" id="f-crossing-id"
                 value="${esc(record.crossingId)}" autocomplete="off" />
        </label>
        <label class="field-label">
          <span>Project ID</span>
          <input class="field-input" type="text" id="f-project-id"
                 value="${esc(record.projectId)}" autocomplete="off" />
        </label>
      </div>

      <label class="field-label">
        <span>Assessor <span class="req">*</span></span>
        <input class="field-input" type="text" id="f-assessor"
               value="${esc(record.assessor)}" autocomplete="name" />
      </label>

      <div class="field-row">
        <label class="field-label">
          <span>Date</span>
          <input class="field-input" type="date" id="f-date"
                 value="${esc(record.date)}" />
        </label>
        <label class="field-label">
          <span>Time</span>
          <input class="field-input" type="time" id="f-time"
                 value="${esc(record.time)}" />
        </label>
      </div>

      <div class="gps-row">
        <label class="field-label">
          <span>Latitude</span>
          <input class="field-input" type="number" id="f-lat"
                 step="0.000001" min="-90" max="90"
                 value="${record.lat ?? ''}" placeholder="44.000000" />
        </label>
        <label class="field-label">
          <span>Longitude</span>
          <input class="field-input" type="number" id="f-lon"
                 step="0.000001" min="-180" max="180"
                 value="${record.lon ?? ''}" placeholder="-63.000000" />
        </label>
        <button class="btn btn-secondary" id="btn-gps" type="button"
                aria-label="Use current GPS location">
          <span id="gps-spinner" aria-hidden="true" hidden>…</span>
          <span id="gps-icon">GPS</span>
        </button>
        <p class="gps-status" id="gps-status" hidden></p>
      </div>

      <label class="field-label">
        <span>Primary Watershed</span>
        <select class="field-input" id="f-watershed-primary">
          <option value="">— select —</option>
          ${WATERSHED_OPTIONS.map(opt =>
            `<option value="${esc(opt)}"${wsDrop === opt ? ' selected' : ''}>${esc(opt)}</option>`
          ).join('\n          ')}
          <option value="Other"${wsDrop === 'Other' ? ' selected' : ''}>Other</option>
        </select>
      </label>

      <div id="ws-other-wrap"${wsDrop !== 'Other' ? ' hidden' : ''}>
        <label class="field-label">
          <span>Specify primary watershed</span>
          <input class="field-input" type="text" id="f-watershed-primary-other"
                 value="${esc(wsOther)}" autocomplete="off" />
        </label>
      </div>

      <div id="ws-secondary-wrap"${!wsDrop ? ' hidden' : ''}>
        <label class="field-label">
          <span>Secondary Watershed (name)</span>
          <input class="field-input" type="text" id="f-watershed-secondary"
                 value="${esc(wsSec)}" autocomplete="off" />
        </label>
      </div>

      <label class="field-label">
        <span>Priority Tier</span>
        <select class="field-input" id="f-priority">
          <option value="">— select —</option>
          <option value="P1" ${pr === 'P1' ? 'selected' : ''}>P1 — High</option>
          <option value="P2" ${pr === 'P2' ? 'selected' : ''}>P2 — Medium</option>
          <option value="P3" ${pr === 'P3' ? 'selected' : ''}>P3 — Low</option>
        </select>
      </label>

      <div class="toggle-row">
        <span>SAR Polygon</span>
        <label class="toggle-wrap" aria-label="SAR polygon active">
          <input type="checkbox" id="f-sar-polygon" ${record.sarPolygon ? 'checked' : ''} />
          <span class="toggle-track" aria-hidden="true"></span>
        </label>
      </div>

      <label class="field-label">
        <span>Notes</span>
        <textarea class="field-input" id="f-notes" rows="3">${esc(record.notes)}</textarea>
      </label>

    </div>
  `;

  // Wire watershed primary dropdown → show/hide tier-2 inputs
  document.getElementById('f-watershed-primary').addEventListener('change', e => {
    const val = e.target.value;
    document.getElementById('ws-other-wrap').hidden    = val !== 'Other';
    document.getElementById('ws-secondary-wrap').hidden = !val;
  });

  // Wire GPS button
  document.getElementById('btn-gps').addEventListener('click', acquireGPS);

  // Wire SAR toggle — drive the banner and dirty flag
  document.getElementById('f-sar-polygon').addEventListener('change', e => {
    const banner = document.getElementById('sar-banner');
    if (banner) banner.hidden = !e.target.checked;
  });

  // Set initial banner visibility
  const banner = document.getElementById('sar-banner');
  if (banner) banner.hidden = !record.sarPolygon;

  // Keep header title in sync as crossing ID is typed
  document.getElementById('f-crossing-id').addEventListener('input', e => {
    headerTitle.textContent = e.target.value.trim() || 'New Record';
  });

  updateSectionCheckmarks();
}

/**
 * acquireGPS()
 * Calls navigator.geolocation.getCurrentPosition(), fills f-lat / f-lon,
 * and shows status feedback in the .gps-status element.
 */
function acquireGPS() {
  if (!navigator.geolocation) {
    showGpsStatus('Geolocation not supported by this browser.', 'error');
    return;
  }

  const btn     = document.getElementById('btn-gps');
  const spinner = document.getElementById('gps-spinner');
  const icon    = document.getElementById('gps-icon');

  if (btn)     btn.disabled  = true;
  if (spinner) spinner.hidden = false;
  if (icon)    icon.hidden    = true;
  showGpsStatus('Acquiring location…', '');

  navigator.geolocation.getCurrentPosition(
    pos => {
      const latVal = pos.coords.latitude.toFixed(6);
      const lonVal = pos.coords.longitude.toFixed(6);

      const latInput = document.getElementById('f-lat');
      const lonInput = document.getElementById('f-lon');
      if (latInput) {
        latInput.value = latVal;
        latInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (lonInput) {
        lonInput.value = lonVal;
        lonInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      showGpsStatus(`Acquired — ±${Math.round(pos.coords.accuracy)} m`, 'good');
      if (btn)     btn.disabled  = false;
      if (spinner) spinner.hidden = true;
      if (icon)    icon.hidden    = false;
    },
    err => {
      const msgs = {
        1: 'Location access denied. Check browser permissions.',
        2: 'Position unavailable. Move to an open area and try again.',
        3: 'Location request timed out.',
      };
      showGpsStatus(msgs[err.code] || 'Location error.', 'error');
      if (btn)     btn.disabled  = false;
      if (spinner) spinner.hidden = true;
      if (icon)    icon.hidden    = false;
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function showGpsStatus(msg, type) {
  const el = document.getElementById('gps-status');
  if (!el) return;
  el.textContent = msg;
  el.className   = `gps-status${type ? ' ' + type : ''}`;
  el.hidden      = !msg;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — Watercourse Confirmation
// ═══════════════════════════════════════════════════════════════════════════════

function initSectionWc(record) {
  const panel = document.querySelector('#section-panels .form-section[data-section="wc"]');
  if (!panel) return;

  const val = record.watercoursePresent === true  ? 'yes'
            : record.watercoursePresent === false ? 'no'
            : '';

  panel.innerHTML = `
    <div class="field-stack">

      <label class="field-label">
        <span>Watercourse present? <span class="req">*</span></span>
        <select class="field-input" id="f-wc-present">
          <option value="">— not yet assessed —</option>
          <option value="yes" ${val === 'yes' ? 'selected' : ''}>Yes — bed and bank confirmed</option>
          <option value="no"  ${val === 'no'  ? 'selected' : ''}>No — not a watercourse</option>
        </select>
      </label>

      <p class="wc-no-msg" id="wc-no-msg" ${val !== 'no' ? 'hidden' : ''}>
        No defined bed and bank — not a watercourse under the NS Environment Act.
      </p>

    </div>
  `;

  document.getElementById('f-wc-present').addEventListener('change', e => {
    const present = e.target.value === 'yes' ? true
                  : e.target.value === 'no'  ? false
                  : null;
    const noMsg = document.getElementById('wc-no-msg');
    if (noMsg) noMsg.hidden = present !== false;
    applyWatercourseFilter(present);
    updateSectionCheckmarks();
  });

  // Apply filter immediately based on saved value
  applyWatercourseFilter(record.watercoursePresent);
  updateSectionCheckmarks();
}

// ═══════════════════════════════════════════════════════════════════════════════
// REACH HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function migrateToReach(record) {
  const reach = CA.defaultReach(1);
  if (record.watershedArea     != null) reach.watershedArea     = record.watershedArea;
  if (record.depthContinuity)           reach.depthContinuity   = record.depthContinuity;
  if (record.channelConnectivity != null) reach.channelConnectivity = record.channelConnectivity;
  if (record.flowCondition)             reach.flowCondition     = record.flowCondition;
  if (record.substrate)                 reach.substrate         = { ...record.substrate };
  if (record.hab)                       reach.hab               = { ...record.hab };
  if (record.fishObserved != null)      reach.fishObserved      = record.fishObserved;
  if (record.fishSign != null)          reach.fishSign          = record.fishSign;
  if (record.reddsObserved != null)     reach.reddsObserved     = record.reddsObserved;
  if (record.fishObsNotes)              reach.fishObsNotes      = record.fishObsNotes;
  if (record.fishBearing)               reach.fishBearing       = record.fishBearing;
  if (record.bankfullWidth    != null)  reach.bankfullWidth     = record.bankfullWidth;
  if (record.wettedWidth      != null)  reach.wettedWidth       = record.wettedWidth;
  if (record.depthLeftBank    != null)  reach.depthLeftBank     = record.depthLeftBank;
  if (record.depthCentre      != null)  reach.depthCentre       = record.depthCentre;
  if (record.depthRightBank   != null)  reach.depthRightBank    = record.depthRightBank;
  if (record.depthThalweg     != null)  reach.depthThalweg      = record.depthThalweg;
  if (record.bankHeight       != null)  reach.bankHeight        = record.bankHeight;
  if (record.dissolvedOxygen  != null)  reach.dissolvedOxygen   = record.dissolvedOxygen;
  if (record.doSaturation     != null)  reach.doSaturation      = record.doSaturation;
  if (record.conductivity     != null)  reach.conductivity      = record.conductivity;
  if (record.waterTemp        != null)  reach.waterTemp         = record.waterTemp;
  if (record.ph               != null)  reach.ph                = record.ph;
  if (record.watercourseSlope != null)  reach.watercourseSlope  = record.watercourseSlope;
  if (record.flowVelocity     != null)  reach.flowVelocity      = record.flowVelocity;
  if (record.velocityMethod)            reach.velocityMethod    = record.velocityMethod;
  return reach;
}

function reachTabsHTML(record, sectionId) {
  const removeDisabled = record.reaches.length <= 1 ? ' disabled' : '';
  return `
    <div class="reach-controls" id="${sectionId}-reach-controls">
      <div class="reach-tabs" id="${sectionId}-reach-tabs">
        ${record.reaches.map((rch, i) => `
          <button type="button"
                  class="reach-tab${i === activeReachIdx ? ' active' : ''}"
                  data-reach-idx="${i}">${esc(rch.reachLabel)}</button>
        `).join('')}
      </div>
      <div class="reach-actions">
        <button type="button" class="btn btn-secondary btn-sm" id="${sectionId}-add-reach">+ Reach</button>
        <button type="button" class="btn btn-danger btn-sm"    id="${sectionId}-remove-reach"${removeDisabled}>✕ Remove</button>
      </div>
    </div>
    <label class="field-label reach-label-row">
      <span>Reach Label</span>
      <input class="field-input" type="text" id="${sectionId}-reach-label"
             value="${esc(record.reaches[activeReachIdx].reachLabel)}" />
    </label>
  `;
}

function bindReachControls(record, sectionId, reinitFn) {
  document.getElementById(`${sectionId}-reach-tabs`)?.addEventListener('click', e => {
    const btn = e.target.closest('.reach-tab');
    if (!btn) return;
    const newIdx = parseInt(btn.dataset.reachIdx, 10);
    if (newIdx !== activeReachIdx) switchReach(record, newIdx, reinitFn);
  });

  document.getElementById(`${sectionId}-add-reach`)?.addEventListener('click', () => {
    addReach(record, reinitFn);
  });

  document.getElementById(`${sectionId}-remove-reach`)?.addEventListener('click', () => {
    if (record.reaches.length <= 1) return;
    openConfirmModal(
      `Remove "${record.reaches[activeReachIdx].reachLabel}"? This cannot be undone.`,
      () => removeReach(record, reinitFn)
    );
  });

  document.getElementById(`${sectionId}-reach-label`)?.addEventListener('input', e => {
    record.reaches[activeReachIdx].reachLabel = e.target.value;
    const otherId = sectionId === 'fish' ? 'geo' : 'fish';
    refreshReachTabStrip(record, otherId);
    refreshReachTabStrip(record, sectionId);
  });
}

function readReachFromDOM() {
  const reach = {};
  function num(id) {
    const el = document.getElementById(id);
    return el ? (el.value !== '' ? parseFloat(el.value) : null) : undefined;
  }
  function str(id)  { const el = document.getElementById(id); return el ? el.value : undefined; }
  function chk(id)  { const el = document.getElementById(id); return el ? el.checked : undefined; }

  const wa = num('f-watershed-area');       if (wa !== undefined) reach.watershedArea     = wa;
  const dc = str('f-depth-continuity');     if (dc !== undefined) reach.depthContinuity   = dc;
  const cc = chk('f-channel-connectivity'); if (cc !== undefined) reach.channelConnectivity = cc;
  const fc = str('f-flow-condition');       if (fc !== undefined) reach.flowCondition     = fc;

  const sub = {};
  ['bedrock','boulder','cobble','gravel','sand','silt','clay','organic'].forEach(k => {
    const el = document.getElementById(`f-sub-${k}`);
    if (el) sub[k] = el.value !== '' ? parseFloat(el.value) : null;
  });
  const fEmbed = document.getElementById('f-embeddedness');
  if (fEmbed) sub.embeddedness = fEmbed.value !== '' ? parseFloat(fEmbed.value) : null;
  if (Object.keys(sub).length) reach.substrate = sub;

  const hab = {};
  ['pools','riffles','runs','lwd','undercut','overhang'].forEach(k => {
    const el = document.getElementById(`f-hab-${k}`);
    if (el) hab[k] = el.checked;
  });
  if (Object.keys(hab).length) reach.hab = hab;

  const fo = chk('f-fish-observed');  if (fo !== undefined) reach.fishObserved  = fo;
  const fs = chk('f-fish-sign');      if (fs !== undefined) reach.fishSign      = fs;
  const ro = chk('f-redds-observed'); if (ro !== undefined) reach.reddsObserved = ro;
  const fn = str('f-fish-obs-notes'); if (fn !== undefined) reach.fishObsNotes  = fn;
  const fb = str('f-fish-bearing');   if (fb !== undefined) reach.fishBearing   = fb;

  const bfw = num('f-bankfull-width');    if (bfw !== undefined) reach.bankfullWidth    = bfw;
  const wtw = num('f-wetted-width');      if (wtw !== undefined) reach.wettedWidth      = wtw;
  const dlb = num('f-depth-left-bank');   if (dlb !== undefined) reach.depthLeftBank    = dlb;
  const dce = num('f-depth-centre');      if (dce !== undefined) reach.depthCentre      = dce;
  const drb = num('f-depth-right-bank');  if (drb !== undefined) reach.depthRightBank   = drb;
  const dth = num('f-depth-thalweg');     if (dth !== undefined) reach.depthThalweg     = dth;
  const bkh = num('f-bank-height');       if (bkh !== undefined) reach.bankHeight       = bkh;
  const dox = num('f-dissolved-oxygen');  if (dox !== undefined) reach.dissolvedOxygen  = dox;
  const dos = num('f-do-saturation');     if (dos !== undefined) reach.doSaturation     = dos;
  const cnd = num('f-conductivity');      if (cnd !== undefined) reach.conductivity     = cnd;
  const wtp = num('f-water-temp');        if (wtp !== undefined) reach.waterTemp        = wtp;
  const phv = num('f-ph');               if (phv !== undefined) reach.ph               = phv;
  const slp = num('f-watercourse-slope'); if (slp !== undefined) reach.watercourseSlope = slp;
  const fv  = num('f-flow-velocity');     if (fv  !== undefined) reach.flowVelocity     = fv;
  const vm  = str('f-velocity-method');  if (vm  !== undefined) reach.velocityMethod   = vm;

  return reach;
}

function syncActiveReach(record) {
  const dom = readReachFromDOM();
  if (record.reaches && record.reaches[activeReachIdx]) {
    Object.assign(record.reaches[activeReachIdx], dom);
  }
}

function switchReach(record, newIdx, reinitFn) {
  syncActiveReach(record);
  activeReachIdx = newIdx;
  reinitFn(record);
}

function refreshReachTabStrip(record, sectionId) {
  const container = document.getElementById(`${sectionId}-reach-tabs`);
  if (!container) return;
  container.innerHTML = record.reaches.map((rch, i) => `
    <button type="button"
            class="reach-tab${i === activeReachIdx ? ' active' : ''}"
            data-reach-idx="${i}">${esc(rch.reachLabel)}</button>
  `).join('');
  const removeBtn = document.getElementById(`${sectionId}-remove-reach`);
  if (removeBtn) removeBtn.disabled = record.reaches.length <= 1;
}

function addReach(record, reinitFn) {
  syncActiveReach(record);
  record.reaches.push(CA.defaultReach(record.reaches.length + 1));
  activeReachIdx = record.reaches.length - 1;
  formDirty = true;
  reinitFn(record);
}

function removeReach(record, reinitFn) {
  if (record.reaches.length <= 1) return;
  syncActiveReach(record);
  record.reaches.splice(activeReachIdx, 1);
  if (activeReachIdx >= record.reaches.length) activeReachIdx = record.reaches.length - 1;
  formDirty = true;
  reinitFn(record);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Fish Habitat Assessment
// ═══════════════════════════════════════════════════════════════════════════════

function initSectionFish(record) {
  const panel = document.querySelector('#section-panels .form-section[data-section="fish"]');
  if (!panel) return;

  const reach = record.reaches[activeReachIdx] || CA.defaultReach(1);
  const sub = reach.substrate || {};
  const hab = reach.hab       || {};
  const dc  = reach.depthContinuity || '';
  const fc  = reach.flowCondition   || '';
  const fb  = reach.fishBearing     || '';

  function sv(key) { return sub[key] != null ? sub[key] : ''; }

  panel.innerHTML = `
    <div class="field-stack">

      ${reachTabsHTML(record, 'fish')}

      <label class="field-label">
        <span>Watershed Area (km²)</span>
        <input class="field-input" type="number" id="f-watershed-area"
               step="0.01" min="0" value="${reach.watershedArea ?? ''}" />
      </label>
      <div class="reach-chip" id="f-reach-chip"></div>

      <p class="sub-head">Channel Physical Characteristics</p>

      <label class="field-label">
        <span>Depth Continuity</span>
        <select class="field-input" id="f-depth-continuity">
          <option value="">— select —</option>
          <option value="Continuous"   ${dc === 'Continuous'   ? 'selected' : ''}>Continuous</option>
          <option value="Intermittent" ${dc === 'Intermittent' ? 'selected' : ''}>Intermittent</option>
          <option value="Ephemeral"    ${dc === 'Ephemeral'    ? 'selected' : ''}>Ephemeral</option>
        </select>
      </label>

      <div class="toggle-row">
        <span>Channel Connectivity</span>
        <label class="toggle-wrap" aria-label="Channel connectivity">
          <input type="checkbox" id="f-channel-connectivity"
                 ${reach.channelConnectivity ? 'checked' : ''} />
          <span class="toggle-track" aria-hidden="true"></span>
        </label>
      </div>

      <label class="field-label">
        <span>Flow Condition</span>
        <select class="field-input" id="f-flow-condition">
          <option value="">— select —</option>
          <option value="No flow"       ${fc === 'No flow'       ? 'selected' : ''}>No flow</option>
          <option value="Low flow"      ${fc === 'Low flow'      ? 'selected' : ''}>Low flow</option>
          <option value="Moderate flow" ${fc === 'Moderate flow' ? 'selected' : ''}>Moderate flow</option>
          <option value="High flow"     ${fc === 'High flow'     ? 'selected' : ''}>High flow</option>
          <option value="Flood"         ${fc === 'Flood'         ? 'selected' : ''}>Flood</option>
        </select>
      </label>

      <p class="sub-head">Substrate Composition</p>

      <div class="field-row-4">
        <label class="field-label"><span>Bedrock %</span>
          <input class="field-input" type="number" id="f-sub-bedrock"
                 min="0" max="100" step="1" value="${sv('bedrock')}" /></label>
        <label class="field-label"><span>Boulder %</span>
          <input class="field-input" type="number" id="f-sub-boulder"
                 min="0" max="100" step="1" value="${sv('boulder')}" /></label>
        <label class="field-label"><span>Cobble %</span>
          <input class="field-input" type="number" id="f-sub-cobble"
                 min="0" max="100" step="1" value="${sv('cobble')}" /></label>
        <label class="field-label"><span>Gravel %</span>
          <input class="field-input" type="number" id="f-sub-gravel"
                 min="0" max="100" step="1" value="${sv('gravel')}" /></label>
        <label class="field-label"><span>Sand %</span>
          <input class="field-input" type="number" id="f-sub-sand"
                 min="0" max="100" step="1" value="${sv('sand')}" /></label>
        <label class="field-label"><span>Silt %</span>
          <input class="field-input" type="number" id="f-sub-silt"
                 min="0" max="100" step="1" value="${sv('silt')}" /></label>
        <label class="field-label"><span>Clay %</span>
          <input class="field-input" type="number" id="f-sub-clay"
                 min="0" max="100" step="1" value="${sv('clay')}" /></label>
        <label class="field-label"><span>Organic %</span>
          <input class="field-input" type="number" id="f-sub-organic"
                 min="0" max="100" step="1" value="${sv('organic')}" /></label>
      </div>

      <div class="sub-total-bar" id="f-sub-total">
        <span class="sub-total-num" id="sub-total-num">—</span>
        <span>/ 100%</span>
      </div>

      <label class="field-label">
        <span>Substrate Embeddedness (%)</span>
        <input class="field-input" type="number" id="f-embeddedness"
               min="0" max="100" step="1" value="${sv('embeddedness')}" />
      </label>

      <p class="sub-head">Habitat Features</p>

      <div class="checkbox-grid">
        <label class="checkbox-label">
          <input type="checkbox" id="f-hab-pools"    ${hab.pools    ? 'checked' : ''} />
          Pools
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="f-hab-riffles"  ${hab.riffles  ? 'checked' : ''} />
          Riffles
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="f-hab-runs"     ${hab.runs     ? 'checked' : ''} />
          Runs
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="f-hab-lwd"      ${hab.lwd      ? 'checked' : ''} />
          Large woody debris
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="f-hab-undercut" ${hab.undercut ? 'checked' : ''} />
          Undercut banks
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="f-hab-overhang" ${hab.overhang ? 'checked' : ''} />
          Overhanging riparian veg.
        </label>
      </div>

      <p class="sub-head">Fish Observations</p>

      <div class="toggle-row">
        <span>Fish observed</span>
        <label class="toggle-wrap" aria-label="Fish observed">
          <input type="checkbox" id="f-fish-observed"
                 ${reach.fishObserved ? 'checked' : ''} />
          <span class="toggle-track" aria-hidden="true"></span>
        </label>
      </div>
      <div class="toggle-row">
        <span>Fish sign (carcasses, redds, scales)</span>
        <label class="toggle-wrap" aria-label="Fish sign observed">
          <input type="checkbox" id="f-fish-sign"
                 ${reach.fishSign ? 'checked' : ''} />
          <span class="toggle-track" aria-hidden="true"></span>
        </label>
      </div>
      <div class="toggle-row">
        <span>Spawning redds observed</span>
        <label class="toggle-wrap" aria-label="Spawning redds observed">
          <input type="checkbox" id="f-redds-observed"
                 ${reach.reddsObserved ? 'checked' : ''} />
          <span class="toggle-track" aria-hidden="true"></span>
        </label>
      </div>

      <label class="field-label">
        <span>Fish observation notes</span>
        <textarea class="field-input" id="f-fish-obs-notes"
                  rows="2">${esc(reach.fishObsNotes)}</textarea>
      </label>

      <p class="sub-head">Fish-Bearing Determination</p>

      <label class="field-label">
        <span>Determination <span class="req">*</span></span>
        <select class="field-input" id="f-fish-bearing">
          <option value="">— select —</option>
          <option value="confirmed"      ${fb === 'confirmed'      ? 'selected' : ''}>Confirmed fish-bearing</option>
          <option value="likely"         ${fb === 'likely'         ? 'selected' : ''}>Likely fish-bearing</option>
          <option value="non-unsuitable" ${fb === 'non-unsuitable' ? 'selected' : ''}>Confirmed non-fish-bearing</option>
          <option value="non-confirmed"  ${fb === 'non-confirmed'  ? 'selected' : ''}>Not confirmed fish-bearing</option>
          <option value="undetermined"   ${fb === 'undetermined'   ? 'selected' : ''}>Undetermined</option>
        </select>
      </label>

    </div>
  `;

  bindReachControls(record, 'fish', initSectionFish);

  document.getElementById('f-watershed-area')
    .addEventListener('input', updateReachChip);
  updateReachChip();

  const SUB_IDS = [
    'f-sub-bedrock', 'f-sub-boulder', 'f-sub-cobble', 'f-sub-gravel',
    'f-sub-sand',    'f-sub-silt',    'f-sub-clay',   'f-sub-organic',
  ];
  SUB_IDS.forEach(id =>
    document.getElementById(id)?.addEventListener('input', refreshSubTotal)
  );
  refreshSubTotal();

  document.getElementById('f-fish-bearing')
    .addEventListener('change', updateSectionCheckmarks);

  updateSectionCheckmarks();
}

/**
 * updateReachChip()
 * Reads #f-watershed-area and writes the appropriate reach distance text
 * into the #f-reach-chip element.
 * ≤ 2.5 km² → upstream 30 m / downstream 30 m
 * >  2.5 km² → upstream 60 m / downstream 100 m
 */
function updateReachChip() {
  const chip = document.getElementById('f-reach-chip');
  const wa   = document.getElementById('f-watershed-area');
  if (!chip || !wa) return;
  if (wa.value === '') {
    chip.textContent = 'Enter watershed area for reach distance guidance.';
    return;
  }
  const area = parseFloat(wa.value);
  if (isNaN(area) || area < 0) {
    chip.textContent = 'Enter a valid watershed area.';
    return;
  }
  if (area <= 2.5) {
    chip.textContent = '≤ 2.5 km² — Upstream reach: 30 m · Downstream reach: 30 m';
  } else {
    chip.textContent = '> 2.5 km² — Upstream reach: 60 m · Downstream reach: 100 m';
  }
}

/**
 * refreshSubTotal()
 * Reads the eight substrate percentage inputs and updates the #f-sub-total bar.
 * Adds class .ok when total === 100, .over otherwise (when any value is filled).
 */
function refreshSubTotal() {
  const SUB_IDS = [
    'f-sub-bedrock', 'f-sub-boulder', 'f-sub-cobble', 'f-sub-gravel',
    'f-sub-sand',    'f-sub-silt',    'f-sub-clay',   'f-sub-organic',
  ];
  let total     = 0;
  let anyFilled = false;
  SUB_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value !== '') {
      anyFilled = true;
      total    += parseFloat(el.value) || 0;
    }
  });

  const bar     = document.getElementById('f-sub-total');
  const numSpan = document.getElementById('sub-total-num');
  if (!bar || !numSpan) return;

  if (!anyFilled) {
    numSpan.textContent = '0%';
    bar.classList.remove('ok', 'over');
    return;
  }
  numSpan.textContent = `${total}%`;
  bar.classList.toggle('ok',   total === 100);
  bar.classList.toggle('over', total !== 100);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Watercourse Geometry and Slope
// ═══════════════════════════════════════════════════════════════════════════════

function initSectionGeo(record) {
  const panel = document.querySelector('#section-panels .form-section[data-section="geo"]');
  if (!panel) return;

  const reach = record.reaches[activeReachIdx] || CA.defaultReach(1);
  const vm = reach.velocityMethod || '';

  function nv(val) { return val != null ? val : ''; }

  panel.innerHTML = `
    <div class="field-stack">

      ${reachTabsHTML(record, 'geo')}

      <p class="sub-head">Channel Dimensions</p>

      <div class="field-row">
        <label class="field-label">
          <span>Bankfull Width (m)</span>
          <input class="field-input" type="number" id="f-bankfull-width"
                 step="0.01" min="0" value="${nv(reach.bankfullWidth)}" />
        </label>
        <label class="field-label">
          <span>Wetted Width (m)</span>
          <input class="field-input" type="number" id="f-wetted-width"
                 step="0.01" min="0" value="${nv(reach.wettedWidth)}" />
        </label>
      </div>

      <div class="field-row">
        <label class="field-label">
          <span>Left Bank Depth (m)</span>
          <input class="field-input" type="number" id="f-depth-left-bank"
                 step="0.01" min="0" value="${nv(reach.depthLeftBank)}" />
        </label>
        <label class="field-label">
          <span>Centre Depth (m)</span>
          <input class="field-input" type="number" id="f-depth-centre"
                 step="0.01" min="0" value="${nv(reach.depthCentre)}" />
        </label>
      </div>

      <div class="field-row">
        <label class="field-label">
          <span>Right Bank Depth (m)</span>
          <input class="field-input" type="number" id="f-depth-right-bank"
                 step="0.01" min="0" value="${nv(reach.depthRightBank)}" />
        </label>
        <label class="field-label">
          <span>Thalweg Depth (m)</span>
          <input class="field-input" type="number" id="f-depth-thalweg"
                 step="0.01" min="0" value="${nv(reach.depthThalweg)}" />
        </label>
      </div>

      <label class="field-label">
        <span>Bank Height (m)</span>
        <input class="field-input" type="number" id="f-bank-height"
               step="0.01" min="0" value="${nv(reach.bankHeight)}" />
      </label>

      <p class="sub-head">Water Chemistry</p>

      <div class="field-row">
        <label class="field-label">
          <span>Dissolved Oxygen (mg/L)</span>
          <input class="field-input" type="number" id="f-dissolved-oxygen"
                 step="0.01" min="0" value="${nv(reach.dissolvedOxygen)}" />
        </label>
        <label class="field-label">
          <span>DO Saturation (%)</span>
          <input class="field-input" type="number" id="f-do-saturation"
                 step="0.1" min="0" max="200" value="${nv(reach.doSaturation)}" />
        </label>
      </div>

      <div class="field-row">
        <label class="field-label">
          <span>Conductivity (µS/cm)</span>
          <input class="field-input" type="number" id="f-conductivity"
                 step="1" min="0" value="${nv(reach.conductivity)}" />
        </label>
        <label class="field-label">
          <span>Water Temp (°C)</span>
          <input class="field-input" type="number" id="f-water-temp"
                 step="0.1" value="${nv(reach.waterTemp)}" />
        </label>
      </div>

      <label class="field-label">
        <span>pH (4.0 – 10.0)</span>
        <input class="field-input" type="number" id="f-ph"
               step="0.1" min="4" max="10" value="${nv(reach.ph)}" />
      </label>

      <p class="sub-head">Slope and Flow</p>

      <label class="field-label">
        <span>Watercourse Slope (%)</span>
        <input class="field-input" type="number" id="f-watercourse-slope"
               step="0.1" min="0" value="${nv(reach.watercourseSlope)}" />
      </label>

      <div class="field-row">
        <label class="field-label">
          <span>Flow Velocity (m/s) — float or meter</span>
          <input class="field-input" type="number" id="f-flow-velocity"
                 step="0.01" min="0" value="${nv(reach.flowVelocity)}" />
        </label>
        <label class="field-label">
          <span>Velocity Method <span class="req">*</span></span>
          <select class="field-input" id="f-velocity-method">
            <option value="">— select —</option>
            <option value="Float method"  ${vm === 'Float method'  ? 'selected' : ''}>Float method</option>
            <option value="Flow meter"    ${vm === 'Flow meter'    ? 'selected' : ''}>Flow meter</option>
            <option value="Not measured"  ${vm === 'Not measured'  ? 'selected' : ''}>Not measured</option>
          </select>
        </label>
      </div>

    </div>
  `;

  bindReachControls(record, 'geo', initSectionGeo);

  document.getElementById('f-velocity-method')
    .addEventListener('change', updateSectionCheckmarks);

  updateSectionCheckmarks();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Existing Crossing Condition and Fish Passage
// ═══════════════════════════════════════════════════════════════════════════════

const FP_HELPER = {
  P:  'Passable — no significant barriers to fish movement.',
  PB: 'Partial barrier — fish passage impaired; seasonal or size-class dependent.',
  FB: 'Full barrier — blocks fish passage for all or most species and life stages.',
};

function initSectionCrossing(record) {
  const panel = document.querySelector('#section-panels .form-section[data-section="crossing"]');
  if (!panel) return;

  const cs  = record.crossingStatus    || '';
  const st  = record.structureType     || '';
  const sm  = record.structureMaterial || '';
  const bc  = record.barrelCondition   || '';
  const blk = record.blockage          || '';
  const fpr = record.fishPassageRating || '';

  function nv(val) { return val != null ? val : ''; }

  panel.innerHTML = `
    <div class="field-stack">

      <div class="toggle-row">
        <span>Existing crossing present</span>
        <label class="toggle-wrap" aria-label="Existing crossing present">
          <input type="checkbox" id="f-crossing-present"
                 ${record.crossingPresent ? 'checked' : ''}
                 data-touched="${record.crossingPresent !== null ? 'true' : 'false'}" />
          <span class="toggle-track" aria-hidden="true"></span>
        </label>
      </div>

      <div id="crossing-detail"${!record.crossingPresent ? ' hidden' : ''}>
        <div class="field-stack">

          <label class="field-label">
            <span>Crossing Status</span>
            <select class="field-input" id="f-crossing-status">
              <option value="">— select —</option>
              <option value="Existing – assess only"          ${cs === 'Existing – assess only'          ? 'selected' : ''}>Existing – assess only</option>
              <option value="Existing – replacement proposed" ${cs === 'Existing – replacement proposed' ? 'selected' : ''}>Existing – replacement proposed</option>
              <option value="New installation"               ${cs === 'New installation'               ? 'selected' : ''}>New installation</option>
            </select>
          </label>

          <label class="field-label">
            <span>Structure Type</span>
            <select class="field-input" id="f-structure-type">
              <option value="">— select —</option>
              <option value="Culvert – round"     ${st === 'Culvert – round'     ? 'selected' : ''}>Culvert – round</option>
              <option value="Culvert – pipe arch" ${st === 'Culvert – pipe arch' ? 'selected' : ''}>Culvert – pipe arch</option>
              <option value="Culvert – box"       ${st === 'Culvert – box'       ? 'selected' : ''}>Culvert – box</option>
              <option value="Bridge"              ${st === 'Bridge'              ? 'selected' : ''}>Bridge</option>
              <option value="Ford/causeway"       ${st === 'Ford/causeway'       ? 'selected' : ''}>Ford / causeway</option>
              <option value="Open bottom arch"    ${st === 'Open bottom arch'    ? 'selected' : ''}>Open bottom arch</option>
              <option value="Unknown"             ${st === 'Unknown'             ? 'selected' : ''}>Unknown</option>
              <option value="Other"               ${st === 'Other'               ? 'selected' : ''}>Other</option>
            </select>
          </label>

          <label class="field-label">
            <span>Structure Material</span>
            <select class="field-input" id="f-structure-material">
              <option value="">— select —</option>
              <option value="Corrugated metal" ${sm === 'Corrugated metal' ? 'selected' : ''}>Corrugated metal</option>
              <option value="HDPE"             ${sm === 'HDPE'             ? 'selected' : ''}>HDPE</option>
              <option value="Concrete"         ${sm === 'Concrete'         ? 'selected' : ''}>Concrete</option>
              <option value="Wood"             ${sm === 'Wood'             ? 'selected' : ''}>Wood</option>
              <option value="Unknown"          ${sm === 'Unknown'          ? 'selected' : ''}>Unknown</option>
              <option value="Other"            ${sm === 'Other'            ? 'selected' : ''}>Other</option>
            </select>
          </label>

          <div class="field-row">
            <label class="field-label">
              <span>Number of Barrels</span>
              <input class="field-input" type="number" id="f-num-barrels"
                     min="1" step="1" value="${nv(record.numBarrels)}" />
            </label>
            <label class="field-label">
              <span>Diameter / Span (m)</span>
              <input class="field-input" type="number" id="f-structure-diameter"
                     step="0.01" min="0" value="${nv(record.structureDiameter)}" />
            </label>
          </div>

          <label class="field-label">
            <span>Outlet Drop (m) <span class="field-note">&gt; 0.15 m = barrier threshold</span></span>
            <input class="field-input" type="number" id="f-outlet-drop"
                   step="0.01" min="0" value="${nv(record.outletDrop)}" />
          </label>
          <p class="outlet-warn" id="outlet-drop-warn" hidden>
            ⚠ Outlet drop exceeds 0.15 m — likely full barrier to fish passage.
          </p>

          <label class="field-label">
            <span>Barrel Condition</span>
            <select class="field-input" id="f-barrel-condition">
              <option value="">— select —</option>
              <option value="Good"                      ${bc === 'Good'                      ? 'selected' : ''}>Good</option>
              <option value="Fair – minor damage"       ${bc === 'Fair – minor damage'       ? 'selected' : ''}>Fair – minor damage</option>
              <option value="Poor – significant damage" ${bc === 'Poor – significant damage' ? 'selected' : ''}>Poor – significant damage</option>
              <option value="Collapsed / failed"        ${bc === 'Collapsed / failed'        ? 'selected' : ''}>Collapsed / failed</option>
            </select>
          </label>

          <label class="field-label">
            <span>Blockage</span>
            <select class="field-input" id="f-blockage">
              <option value="">— select —</option>
              <option value="None"     ${blk === 'None'     ? 'selected' : ''}>None</option>
              <option value="Partial"  ${blk === 'Partial'  ? 'selected' : ''}>Partial</option>
              <option value="Severe"   ${blk === 'Severe'   ? 'selected' : ''}>Severe</option>
              <option value="Complete" ${blk === 'Complete' ? 'selected' : ''}>Complete</option>
            </select>
          </label>

          <div class="toggle-row">
            <span>Dry barrel at baseflow</span>
            <label class="toggle-wrap" aria-label="Dry barrel at baseflow">
              <input type="checkbox" id="f-dry-barrel"
                     ${record.dryBarrel ? 'checked' : ''} />
              <span class="toggle-track" aria-hidden="true"></span>
            </label>
          </div>

          <label class="field-label">
            <span>Structural damage notes</span>
            <textarea class="field-input" id="f-structural-damage-notes"
                      rows="2">${esc(record.structuralDamageNotes)}</textarea>
          </label>

          <p class="sub-head">Fish Passage Rating</p>

          <label class="field-label">
            <span>Rating <span class="req">*</span></span>
            <select class="field-input" id="f-fish-passage-rating">
              <option value="">— select —</option>
              <option value="P"  ${fpr === 'P'  ? 'selected' : ''}>P — Passable</option>
              <option value="PB" ${fpr === 'PB' ? 'selected' : ''}>PB — Partial Barrier</option>
              <option value="FB" ${fpr === 'FB' ? 'selected' : ''}>FB — Full Barrier</option>
            </select>
          </label>
          <p class="passage-hint" id="fp-helper" hidden></p>

        </div>
      </div>

    </div>
  `;

  document.getElementById('f-crossing-present').addEventListener('change', e => {
    e.target.dataset.touched = 'true';
    document.getElementById('crossing-detail').hidden = !e.target.checked;
    updateSectionCheckmarks();
  });

  document.getElementById('f-crossing-status').addEventListener('change', updateSectionCheckmarks);

  document.getElementById('f-outlet-drop').addEventListener('input', refreshOutletWarn);
  refreshOutletWarn();

  const fprSelect = document.getElementById('f-fish-passage-rating');
  fprSelect.addEventListener('change', () => {
    updateFishPassageStyle();
    updateSectionCheckmarks();
  });
  updateFishPassageStyle();

  updateSectionCheckmarks();
}

/**
 * updateFishPassageStyle()
 * Applies colour class to the fish-passage-rating select and shows
 * the matching helper text paragraph.
 */
function updateFishPassageStyle() {
  const sel    = document.getElementById('f-fish-passage-rating');
  const helper = document.getElementById('fp-helper');
  if (!sel) return;

  sel.classList.remove('fp-pass', 'fp-partial', 'fp-barrier');
  if (helper) helper.classList.remove('pass', 'partial', 'barrier');

  const val = sel.value;
  const selCls    = val === 'P' ? 'fp-pass'  : val === 'PB' ? 'fp-partial' : val === 'FB' ? 'fp-barrier' : '';
  const hintCls   = val === 'P' ? 'pass'     : val === 'PB' ? 'partial'    : val === 'FB' ? 'barrier'    : '';

  if (selCls) sel.classList.add(selCls);
  if (helper) {
    if (hintCls) {
      helper.classList.add(hintCls);
      helper.textContent = FP_HELPER[val];
      helper.hidden = false;
    } else {
      helper.textContent = '';
      helper.hidden = true;
    }
  }
}

/**
 * refreshOutletWarn()
 * Shows an amber warning paragraph when outlet drop exceeds the 0.15 m barrier threshold.
 */
function refreshOutletWarn() {
  const input = document.getElementById('f-outlet-drop');
  const warn  = document.getElementById('outlet-drop-warn');
  if (!input || !warn) return;
  const val = parseFloat(input.value);
  warn.hidden = !(input.value !== '' && !isNaN(val) && val > 0.15);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — Wetland Assessment
// ═══════════════════════════════════════════════════════════════════════════════

function initSectionWetland(record) {
  const panel = document.querySelector('#section-panels .form-section[data-section="wetland"]');
  if (!panel) return;

  const wt  = record.wetlandType         || '';
  const wc  = record.wetlandConnectivity || '';
  const war = record.waaRequired         || '';

  panel.innerHTML = `
    <div class="field-stack">

      <div class="toggle-row">
        <span>Wetland interaction present</span>
        <label class="toggle-wrap" aria-label="Wetland interaction present">
          <input type="checkbox" id="f-wetland-present"
                 ${record.wetlandPresent ? 'checked' : ''}
                 data-touched="${record.wetlandPresent !== null ? 'true' : 'false'}" />
          <span class="toggle-track" aria-hidden="true"></span>
        </label>
      </div>

      <div id="wetland-detail"${!record.wetlandPresent ? ' hidden' : ''}>
        <div class="field-stack">

          <div class="toggle-row">
            <span>Wetland confirmed</span>
            <label class="toggle-wrap" aria-label="Wetland confirmed">
              <input type="checkbox" id="f-wetland-confirmed"
                     ${record.wetlandConfirmed ? 'checked' : ''} />
              <span class="toggle-track" aria-hidden="true"></span>
            </label>
          </div>

          <label class="field-label">
            <span>Wetland Type (CWCS)</span>
            <select class="field-input" id="f-wetland-type">
              <option value="">— select —</option>
              <option value="Bog"                ${wt === 'Bog'                ? 'selected' : ''}>Bog</option>
              <option value="Fen"                ${wt === 'Fen'                ? 'selected' : ''}>Fen</option>
              <option value="Marsh"              ${wt === 'Marsh'              ? 'selected' : ''}>Marsh</option>
              <option value="Swamp"              ${wt === 'Swamp'              ? 'selected' : ''}>Swamp</option>
              <option value="Shallow open water" ${wt === 'Shallow open water' ? 'selected' : ''}>Shallow open water</option>
              <option value="Unknown"            ${wt === 'Unknown'            ? 'selected' : ''}>Unknown</option>
            </select>
          </label>

          <div class="toggle-row">
            <span>WESP-AC assessment completed</span>
            <label class="toggle-wrap" aria-label="WESP-AC assessment completed">
              <input type="checkbox" id="f-wesp-ac"
                     ${record.wespAc ? 'checked' : ''} />
              <span class="toggle-track" aria-hidden="true"></span>
            </label>
          </div>

          <label class="field-label">
            <span>Wetland Connectivity to Watercourse</span>
            <select class="field-input" id="f-wetland-connectivity">
              <option value="">— select —</option>
              <option value="Directly connected"        ${wc === 'Directly connected'        ? 'selected' : ''}>Directly connected</option>
              <option value="Adjacent/likely connected" ${wc === 'Adjacent/likely connected' ? 'selected' : ''}>Adjacent / likely connected</option>
              <option value="No connection"             ${wc === 'No connection'             ? 'selected' : ''}>No connection</option>
              <option value="Unknown"                   ${wc === 'Unknown'                   ? 'selected' : ''}>Unknown</option>
            </select>
          </label>

          <p class="sub-head">Field Indicators</p>

          <div class="toggle-row">
            <span>Hydrophilic vegetation present</span>
            <label class="toggle-wrap" aria-label="Hydrophilic vegetation present">
              <input type="checkbox" id="f-hydrophilic-veg"
                     ${record.hydrophilicVeg ? 'checked' : ''} />
              <span class="toggle-track" aria-hidden="true"></span>
            </label>
          </div>

          <div class="toggle-row">
            <span>Hydric soils present</span>
            <label class="toggle-wrap" aria-label="Hydric soils present">
              <input type="checkbox" id="f-hydric-soils"
                     ${record.hydricSoils ? 'checked' : ''} />
              <span class="toggle-track" aria-hidden="true"></span>
            </label>
          </div>

          <p class="sub-head">Hydrological Indicators</p>

          <p class="field-group-label">Primary — strong evidence</p>
          <div class="checkbox-grid hydro-grid">
            <label class="checkbox-label">
              <input type="checkbox" id="f-hydro-water-marks"
                     ${record.hydroWaterMarks ? 'checked' : ''} />
              Water marks (staining on vegetation or structures)
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="f-hydro-drift-lines"
                     ${record.hydroDriftLines ? 'checked' : ''} />
              Drift lines (debris deposited by flowing water)
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="f-hydro-waterlogged-soil"
                     ${record.hydroWaterloggedSoil ? 'checked' : ''} />
              Waterlogged soil (saturation within 30 cm of surface)
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="f-hydro-standing-water"
                     ${record.hydroStandingWater ? 'checked' : ''} />
              Standing or flowing water observed
            </label>
          </div>

          <p class="field-group-label">Secondary — supporting evidence</p>
          <div class="checkbox-grid hydro-grid">
            <label class="checkbox-label">
              <input type="checkbox" id="f-hydro-water-stained-leaves"
                     ${record.hydroWaterStainedLeaves ? 'checked' : ''} />
              Water-stained leaves
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="f-hydro-oxidized-rhizospheres"
                     ${record.hydroOxidizedRhizospheres ? 'checked' : ''} />
              Oxidized rhizospheres (rust-coloured root channels in soil profile)
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="f-hydro-sediment-deposits"
                     ${record.hydroSedimentDeposits ? 'checked' : ''} />
              Sediment deposits on vegetation
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="f-hydro-algal-mats"
                     ${record.hydroAlgalMats ? 'checked' : ''} />
              Algal mats or crusts
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="f-hydro-iron-deposits"
                     ${record.hydroIronDeposits ? 'checked' : ''} />
              Iron deposits or seeps
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="f-hydro-drainage-patterns"
                     ${record.hydroDrainagePatterns ? 'checked' : ''} />
              Surface drainage patterns or flow channels
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="f-hydro-buttressed-roots"
                     ${record.hydroButtressedRoots ? 'checked' : ''} />
              Buttressed tree bases or adventitious roots
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="f-hydro-moss-lines"
                     ${record.hydroMossLines ? 'checked' : ''} />
              Moss lines on trees or stumps
            </label>
          </div>

          <p class="hydro-summary" id="hydro-indicator-summary"></p>

          <label class="field-label">
            <span>Dominant Vegetation Community</span>
            <input class="field-input" type="text" id="f-dominant-veg"
                   value="${esc(record.dominantVeg)}" autocomplete="off" />
          </label>

          <p class="sub-head">WAA Assessment</p>

          <label class="field-label">
            <span>WAA Likely Required <span class="req">*</span></span>
            <select class="field-input" id="f-waa-required">
              <option value="">— select —</option>
              <option value="no-mat"         ${war === 'no-mat'         ? 'selected' : ''}>No — no wetland mitigation activity required</option>
              <option value="yes-road"       ${war === 'yes-road'       ? 'selected' : ''}>Yes — road crossing WAA required</option>
              <option value="yes-excavation" ${war === 'yes-excavation' ? 'selected' : ''}>Yes — watercourse alteration in wetland required</option>
              <option value="unknown"        ${war === 'unknown'        ? 'selected' : ''}>Unknown — requires further assessment</option>
            </select>
          </label>

          <label class="field-label">
            <span>Wetland Notes</span>
            <textarea class="field-input" id="f-wetland-notes"
                      rows="2">${esc(record.wetlandNotes)}</textarea>
          </label>

        </div>
      </div>

    </div>
  `;

  document.getElementById('f-wetland-present').addEventListener('change', e => {
    e.target.dataset.touched = 'true';
    document.getElementById('wetland-detail').hidden = !e.target.checked;
    updateSectionCheckmarks();
  });

  document.getElementById('f-waa-required')
    .addEventListener('change', updateSectionCheckmarks);

  const PRIMARY_HYDRO_IDS = [
    'f-hydro-water-marks', 'f-hydro-drift-lines',
    'f-hydro-waterlogged-soil', 'f-hydro-standing-water',
  ];
  const SECONDARY_HYDRO_IDS = [
    'f-hydro-water-stained-leaves', 'f-hydro-oxidized-rhizospheres',
    'f-hydro-sediment-deposits', 'f-hydro-algal-mats',
    'f-hydro-iron-deposits', 'f-hydro-drainage-patterns',
    'f-hydro-buttressed-roots', 'f-hydro-moss-lines',
  ];
  const ALL_HYDRO_IDS = [...PRIMARY_HYDRO_IDS, ...SECONDARY_HYDRO_IDS];

  function refreshHydroSummary() {
    const summary = document.getElementById('hydro-indicator-summary');
    if (!summary) return;
    const primary   = PRIMARY_HYDRO_IDS.filter(id => document.getElementById(id)?.checked).length;
    const secondary = SECONDARY_HYDRO_IDS.filter(id => document.getElementById(id)?.checked).length;
    const total     = primary + secondary;
    summary.textContent = `${total} of 12 indicator${total === 1 ? '' : 's'} present (${primary} primary, ${secondary} secondary)`;
  }

  ALL_HYDRO_IDS.forEach(id => {
    document.getElementById(id)?.addEventListener('change', refreshHydroSummary);
  });
  refreshHydroSummary();

  updateSectionCheckmarks();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — Photography Checklist
// ═══════════════════════════════════════════════════════════════════════════════

function initSectionPhotos(record) {
  const panel = document.querySelector('#section-panels .form-section[data-section="photos"]');
  if (!panel) return;

  const ph = record.photos || {};

  const reaches = record.reaches || [];
  const showFishSign = reaches.some(rch => rch.fishObserved || rch.fishSign || rch.reddsObserved);
  const showDamage     = !!record.crossingPresent;
  const showWetland    = !!record.wetlandPresent;
  const showSar        = !!record.sarPolygon;
  const hasAdditional  = showFishSign || showDamage || showWetland || showSar;

  function chk(id, checked, label) {
    return `
      <label class="checkbox-label">
        <input type="checkbox" id="${esc(id)}" ${checked ? 'checked' : ''} />
        ${esc(label)}
      </label>`;
  }

  panel.innerHTML = `
    <div class="field-stack">

      <p class="msg msg-info">
        Take all required photos with your device camera app, then confirm below.
      </p>

      <p class="sub-head">Required (8 shots)</p>

      <ol class="photo-list">
        <li>Upstream channel view from crossing</li>
        <li>Downstream channel view from crossing</li>
        <li>Crossing structure — inlet face</li>
        <li>Crossing structure — outlet face</li>
        <li>Outlet drop close-up with tape measure</li>
        <li>Barrel interior from inlet end</li>
        <li>Upstream habitat — representative reach</li>
        <li>Downstream habitat — representative reach</li>
      </ol>

      <label class="checkbox-label checkbox-confirm">
        <input type="checkbox" id="f-photos-confirmed"
               ${record.photosConfirmed ? 'checked' : ''} />
        I confirm all required photos have been taken and are GPS-tagged in the device camera app.
      </label>

      ${hasAdditional ? `
        <p class="sub-head">Additional — if applicable</p>
        <div class="checkbox-list">
          ${showFishSign ? chk('f-photo-fish-sign', ph.fishSign, 'Fish or fish sign observed') : ''}
          ${showDamage   ? chk('f-photo-damage',    ph.damage,   'Structural damage or defects') : ''}
          ${showWetland  ? chk('f-photo-wetland',   ph.wetland,  'Wetland conditions at abutment areas') : ''}
          ${showSar      ? chk('f-photo-sar',       ph.sar,      'SAR species observed or suspected') : ''}
        </div>
      ` : ''}

    </div>
  `;

  document.getElementById('f-photos-confirmed')
    .addEventListener('change', updateSectionCheckmarks);

  updateSectionCheckmarks();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — Permitting Pathway
// ═══════════════════════════════════════════════════════════════════════════════

const NSECC_LABELS = {
  none:          'No submission required',
  notification:  'Notification',
  approval:      'Approval (s.109 NS Environment Act)',
  'waa-wetland': 'WAA / Wetland Alteration Approval',
  tbd:           'To be determined',
};

const DFO_LABELS = {
  none:      'No submission required',
  cop:       'Code of Practice (COP)',
  rfr:       'Request for Review (RfR)',
  'rfr-sara':'RfR + SARA authorization',
  tbd:       'To be determined',
};

/**
 * computePermitSuggestions(record)
 * Derives non-binding pathway suggestions from the assessment data.
 * Logic:
 *   - watercourse absent → none / none
 *   - fish confirmed/likely + SAR → RfR-SARA / Approval (+ WAA if applicable)
 *   - fish confirmed/likely + existing crossing → RfR / Approval (+ WAA)
 *   - fish confirmed/likely + new crossing → COP / Approval (+ WAA)
 *   - non-fish-bearing → none / none (+ WAA if applicable on NSECC side)
 *   - undetermined → tbd / tbd
 */
function computePermitSuggestions(record) {
  const BEARING_RANK = { confirmed: 5, likely: 4, 'non-confirmed': 3, undetermined: 2, 'non-unsuitable': 1 };
  const reaches = record.reaches || [];
  let fb = '';
  let bestRank = -1;
  reaches.forEach(rch => {
    const rank = BEARING_RANK[rch.fishBearing] || 0;
    if (rank > bestRank) { bestRank = rank; fb = rch.fishBearing || ''; }
  });
  const wc  = record.watercoursePresent;
  const sar = record.sarPolygon;
  const cp  = record.crossingPresent;
  const cs  = record.crossingStatus || '';
  const war = record.waaRequired;
  const od  = record.outletDrop;

  const fishConfirmed  = fb === 'confirmed' || fb === 'likely';
  const fishNone       = fb === 'non-unsuitable';
  const waaYes         = war === 'yes-road' || war === 'yes-excavation';
  const outletBarrier  = od != null && od > 0.15;
  const assessOnly     = cs === 'Existing – assess only';
  const replacement    = cs === 'Existing – replacement proposed';

  // ── DFO ──────────────────────────────────────────────────────────────────────
  let dfoVal, dfoHint;

  if (wc === false) {
    dfoVal  = 'none';
    dfoHint = 'No DFO submission — no watercourse confirmed at this location.';
  } else if (wc === true && sar) {
    dfoVal  = 'rfr-sara';
    dfoHint = 'SAR polygon flagged — Request for Review plus SARA s.73 authorization required.';
  } else if (wc === true && outletBarrier) {
    dfoVal  = 'rfr';
    dfoHint = 'Outlet drop exceeds 0.15 m — potential serious harm to fish under Fisheries Act s.35. Request for Review required regardless of fish-bearing status.';
  } else if (wc === true && fishConfirmed) {
    if (assessOnly) {
      dfoVal  = 'none';
      dfoHint = 'Assessment only — no physical works proposed at this crossing.';
    } else if (replacement || (!cs && cp)) {
      dfoVal  = 'rfr';
      dfoHint = 'Replacing an existing crossing in a fish-bearing watercourse — Request for Review required.';
    } else {
      dfoVal  = 'cop';
      dfoHint = 'New crossing in a fish-bearing watercourse — Code of Practice likely applies.';
    }
  } else if (wc === true && fishNone) {
    dfoVal  = 'none';
    dfoHint = 'Confirmed non-fish-bearing watercourse — no DFO submission required.';
  } else if (wc === true && (fb === 'non-confirmed' || fb === 'undetermined')) {
    dfoVal  = 'tbd';
    dfoHint = 'Fish-bearing status not confirmed — pathway cannot be determined until assessment is complete.';
  } else {
    dfoVal  = 'tbd';
    dfoHint = 'Complete Watercourse Confirmation and Fish Habitat sections to determine the DFO pathway.';
  }

  // ── NSECC ─────────────────────────────────────────────────────────────────────
  let nseccVal, nseccHint;

  if (wc === false) {
    nseccVal  = 'none';
    nseccHint = 'No NSECC submission — no watercourse confirmed at this location.';
  } else if (wc === true && fishConfirmed) {
    if (waaYes) {
      nseccVal  = 'waa-wetland';
      nseccHint = 'Fish-bearing watercourse with WAA component — Approval (s.109) plus Wetland Alteration Approval required.';
    } else if (assessOnly) {
      nseccVal  = 'notification';
      nseccHint = 'Assessment only — no physical works planned. NSECC Notification may suffice where no WAA is required.';
    } else {
      nseccVal  = 'approval';
      nseccHint = 'Permanent crossing works in a fish-bearing watercourse — Approval under NS Environment Act s.109 required.';
    }
  } else if (wc === true && fishNone) {
    if (waaYes) {
      nseccVal  = 'waa-wetland';
      nseccHint = 'Non-fish-bearing watercourse — no s.109 Approval required. Wetland Alteration Approval (WAA) required.';
    } else if (assessOnly) {
      nseccVal  = 'none';
      nseccHint = 'Assessment only — non-fish-bearing watercourse, no WAA required. No NSECC submission needed.';
    } else {
      nseccVal  = 'notification';
      nseccHint = 'Non-fish-bearing watercourse — low-risk activity, no WAA required. NSECC Notification may be sufficient.';
    }
  } else if (wc === true && (fb === 'non-confirmed' || fb === 'undetermined')) {
    nseccVal  = 'tbd';
    nseccHint = 'Fish-bearing status not confirmed — pathway cannot be determined until assessment is complete.';
  } else {
    nseccVal  = 'tbd';
    nseccHint = 'Complete Watercourse Confirmation and Fish Habitat sections to determine the NSECC pathway.';
  }

  return {
    nsecc: { value: nseccVal, hint: nseccHint },
    dfo:   { value: dfoVal,   hint: dfoHint  },
  };
}

function initSectionPermits(record) {
  const panel = document.querySelector('#section-panels .form-section[data-section="permits"]');
  if (!panel) return;

  const np = record.nseccPathway || '';
  const dp = record.dfoPathway   || '';
  const { nsecc, dfo } = computePermitSuggestions(record);

  function suggestBlock(suggested, labels) {
    return `
      <div class="permit-suggest">
        <div class="ps-row">
          <span class="ps-label">Suggested</span>
          <span class="ps-value">${esc(labels[suggested.value] || suggested.value)}</span>
        </div>
        <div class="ps-row">
          <span class="ps-label">Rationale</span>
          <span class="ps-rationale">${esc(suggested.hint)}</span>
        </div>
      </div>`;
  }

  panel.innerHTML = `
    <div class="field-stack">

      <p class="sub-head">NS Environment and Climate Change (NSECC)</p>

      <label class="field-label">
        <span>NSECC Pathway <span class="req">*</span></span>
        <select class="field-input" id="f-nsecc-pathway">
          <option value="">— select —</option>
          <option value="none"         ${np === 'none'         ? 'selected' : ''}>No submission required</option>
          <option value="notification" ${np === 'notification' ? 'selected' : ''}>Notification</option>
          <option value="approval"     ${np === 'approval'     ? 'selected' : ''}>Approval (s.109)</option>
          <option value="waa-wetland"  ${np === 'waa-wetland'  ? 'selected' : ''}>WAA / Wetland Alteration Approval</option>
          <option value="tbd"          ${np === 'tbd'          ? 'selected' : ''}>To be determined</option>
        </select>
      </label>
      ${suggestBlock(nsecc, NSECC_LABELS)}

      <p class="sub-head">Fisheries and Oceans Canada (DFO)</p>

      <label class="field-label">
        <span>DFO Pathway <span class="req">*</span></span>
        <select class="field-input" id="f-dfo-pathway">
          <option value="">— select —</option>
          <option value="none"     ${dp === 'none'     ? 'selected' : ''}>No submission required</option>
          <option value="cop"      ${dp === 'cop'      ? 'selected' : ''}>Code of Practice (COP)</option>
          <option value="rfr"      ${dp === 'rfr'      ? 'selected' : ''}>Request for Review (RfR)</option>
          <option value="rfr-sara" ${dp === 'rfr-sara' ? 'selected' : ''}>RfR + SARA authorization</option>
          <option value="tbd"      ${dp === 'tbd'      ? 'selected' : ''}>To be determined</option>
        </select>
      </label>
      ${suggestBlock(dfo, DFO_LABELS)}

    </div>
  `;

  document.getElementById('f-nsecc-pathway')
    .addEventListener('change', updateSectionCheckmarks);
  document.getElementById('f-dfo-pathway')
    .addEventListener('change', updateSectionCheckmarks);

  updateSectionCheckmarks();
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORM ACTIONS — save, submit, edit, validation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * setFooterState('draft' | 'confirm' | 'complete')
 * Shows the matching footer-state div and hides the others.
 * Locks or unlocks all form inputs.
 */
function setFooterState(state) {
  document.getElementById('footer-draft').hidden    = state !== 'draft';
  document.getElementById('footer-confirm').hidden  = state !== 'confirm';
  document.getElementById('footer-complete').hidden = state !== 'complete';
  const locked = state === 'complete';
  document.querySelectorAll(
    '#section-panels input, #section-panels select, #section-panels textarea'
  ).forEach(el => { el.disabled = locked; });
}

/**
 * saveRecord()
 * Saves current form state as a draft without leaving the form.
 * Runs validation and shows inline warnings for any incomplete required fields,
 * but always proceeds with the save regardless of errors. Footer stays in 'draft'.
 */
function saveRecord() {
  if (!currentRecord) return;
  const data   = collectFormData();
  const errors = validateForm(data);
  const saved  = CA.saveRecord({ ...data, status: 'draft' });
  currentRecord = saved;
  formDirty     = false;
  updateSectionCheckmarks();

  if (errors.length) {
    showValidationErrors(errors);
    toast(
      `Draft saved — ${errors.length} required field${errors.length === 1 ? '' : 's'} incomplete`,
      'warn'
    );
  } else {
    clearValidationErrors();
    toast(`Draft saved — ${saved.crossingId}`, 'success');
  }
}

/**
 * submitRecord()
 * Validates all required fields. If there are errors, shows inline messages
 * and switches the footer to the confirm state (warn-but-don't-block).
 * If clean, calls finalizeSubmit() directly.
 */
function submitRecord() {
  if (!currentRecord) return;
  const data   = collectFormData();
  const errors = validateForm(data);

  if (errors.length) {
    showValidationErrors(errors);
    const warnEl = document.getElementById('footer-warn-text');
    if (warnEl) {
      warnEl.textContent =
        `${errors.length} required field${errors.length === 1 ? '' : 's'} incomplete`;
    }
    setFooterState('confirm');
    return;
  }

  finalizeSubmit();
}

/**
 * finalizeSubmit()
 * Saves the record as complete, clears any inline errors, locks the form.
 */
function finalizeSubmit() {
  const data  = collectFormData();
  const saved = CA.saveRecord({ ...data, status: 'complete' });
  currentRecord = saved;
  formDirty     = false;
  clearValidationErrors();
  updateSectionCheckmarks();
  setFooterState('complete');
  toast(`Submitted — ${saved.crossingId}`, 'success');
}

/**
 * editRecord()
 * Re-opens a complete record for editing (resets status to draft).
 */
function editRecord() {
  if (!currentRecord) return;
  const saved = CA.saveRecord({ ...currentRecord, status: 'draft' });
  currentRecord = saved;
  formDirty     = false;
  clearValidationErrors();
  setFooterState('draft');
  toast('Record unlocked for editing', 'success');
}

/**
 * collectFormData()
 * Reads live field values from each section panel and merges into currentRecord.
 */
function collectFormData() {
  const data = { ...currentRecord };

  // Section 0 — Crossing Identification
  const fCrossingId = document.getElementById('f-crossing-id');
  const fProjectId  = document.getElementById('f-project-id');
  const fAssessor   = document.getElementById('f-assessor');
  const fDate       = document.getElementById('f-date');
  const fTime       = document.getElementById('f-time');
  const fLat        = document.getElementById('f-lat');
  const fLon        = document.getElementById('f-lon');
  const fWatershedPrimary      = document.getElementById('f-watershed-primary');
  const fWatershedPrimaryOther = document.getElementById('f-watershed-primary-other');
  const fWatershedSecondary    = document.getElementById('f-watershed-secondary');
  const fPriority   = document.getElementById('f-priority');
  const fSar        = document.getElementById('f-sar-polygon');
  const fNotes      = document.getElementById('f-notes');

  if (fCrossingId) data.crossingId = fCrossingId.value.trim();
  if (fProjectId)  data.projectId  = fProjectId.value.trim();
  if (fAssessor)   data.assessor   = fAssessor.value.trim();
  if (fDate)       data.date       = fDate.value;
  if (fTime)       data.time       = fTime.value;
  if (fLat)        data.lat        = fLat.value  !== '' ? parseFloat(fLat.value)  : null;
  if (fLon)        data.lon        = fLon.value  !== '' ? parseFloat(fLon.value)  : null;
  if (fWatershedPrimary) {
    if (fWatershedPrimary.value === 'Other') {
      data.watershedPrimary = fWatershedPrimaryOther?.value.trim() || 'Other';
    } else {
      data.watershedPrimary = fWatershedPrimary.value;
    }
  }
  if (fWatershedSecondary) data.watershedSecondary = fWatershedSecondary.value.trim();
  if (fPriority)   data.priority   = fPriority.value;
  if (fSar)        data.sarPolygon = fSar.checked;
  if (fNotes)      data.notes      = fNotes.value;

  // Section 1 — Watercourse Confirmation
  const fWcPresent = document.getElementById('f-wc-present');
  if (fWcPresent) {
    data.watercoursePresent = fWcPresent.value === 'yes' ? true
                            : fWcPresent.value === 'no'  ? false
                            : null;
  }

  // Sections 2 & 3 — Fish + Geo (stored per-reach)
  syncActiveReach(data);
  data.reaches = currentRecord.reaches.map(r => ({
    ...r,
    substrate: { ...(r.substrate || {}) },
    hab:       { ...(r.hab       || {}) },
  }));

  // Section 4 — Existing Crossing Condition
  const fCrossingPresent   = document.getElementById('f-crossing-present');
  const fCrossingStatus    = document.getElementById('f-crossing-status');
  const fStructureType     = document.getElementById('f-structure-type');
  const fStructureMat      = document.getElementById('f-structure-material');
  const fBarrelCond        = document.getElementById('f-barrel-condition');
  const fBlockage          = document.getElementById('f-blockage');
  const fDryBarrel         = document.getElementById('f-dry-barrel');
  const fDamageNotes       = document.getElementById('f-structural-damage-notes');
  const fFishPassageRating = document.getElementById('f-fish-passage-rating');

  if (fCrossingPresent)   data.crossingPresent      = fCrossingPresent.checked;
  if (fCrossingStatus)    data.crossingStatus        = fCrossingStatus.value;
  if (fStructureType)     data.structureType        = fStructureType.value;
  if (fStructureMat)      data.structureMaterial    = fStructureMat.value;
  if (fBarrelCond)        data.barrelCondition      = fBarrelCond.value;
  if (fBlockage)          data.blockage             = fBlockage.value;
  if (fDryBarrel)         data.dryBarrel            = fDryBarrel.checked;
  if (fDamageNotes)       data.structuralDamageNotes = fDamageNotes.value;
  if (fFishPassageRating) data.fishPassageRating    = fFishPassageRating.value;

  const crossNum = (id) => {
    const el = document.getElementById(id);
    return el ? (el.value !== '' ? parseFloat(el.value) : null) : undefined;
  };
  const nb = crossNum('f-num-barrels');        if (nb !== undefined) data.numBarrels        = nb;
  const sd = crossNum('f-structure-diameter'); if (sd !== undefined) data.structureDiameter = sd;
  const od = crossNum('f-outlet-drop');        if (od !== undefined) data.outletDrop        = od;

  // Section 5 — Wetland Assessment
  const fWetlandPresent   = document.getElementById('f-wetland-present');
  const fWetlandConfirmed = document.getElementById('f-wetland-confirmed');
  const fWetlandType      = document.getElementById('f-wetland-type');
  const fWespAc           = document.getElementById('f-wesp-ac');
  const fWetlandConn      = document.getElementById('f-wetland-connectivity');
  const fHydrophilicVeg   = document.getElementById('f-hydrophilic-veg');
  const fHydricSoils      = document.getElementById('f-hydric-soils');
  const fDominantVeg      = document.getElementById('f-dominant-veg');
  const fWaaRequired      = document.getElementById('f-waa-required');
  const fWetlandNotes     = document.getElementById('f-wetland-notes');

  if (fWetlandPresent)   data.wetlandPresent         = fWetlandPresent.checked;
  if (fWetlandConfirmed) data.wetlandConfirmed        = fWetlandConfirmed.checked;
  if (fWetlandType)      data.wetlandType             = fWetlandType.value;
  if (fWespAc)           data.wespAc                  = fWespAc.checked;
  if (fWetlandConn)      data.wetlandConnectivity     = fWetlandConn.value;
  if (fHydrophilicVeg)   data.hydrophilicVeg          = fHydrophilicVeg.checked;
  if (fHydricSoils)      data.hydricSoils             = fHydricSoils.checked;

  const hydroFieldMap = {
    hydroWaterMarks:           'f-hydro-water-marks',
    hydroDriftLines:           'f-hydro-drift-lines',
    hydroWaterloggedSoil:      'f-hydro-waterlogged-soil',
    hydroStandingWater:        'f-hydro-standing-water',
    hydroWaterStainedLeaves:   'f-hydro-water-stained-leaves',
    hydroOxidizedRhizospheres: 'f-hydro-oxidized-rhizospheres',
    hydroSedimentDeposits:     'f-hydro-sediment-deposits',
    hydroAlgalMats:            'f-hydro-algal-mats',
    hydroIronDeposits:         'f-hydro-iron-deposits',
    hydroDrainagePatterns:     'f-hydro-drainage-patterns',
    hydroButtressedRoots:      'f-hydro-buttressed-roots',
    hydroMossLines:            'f-hydro-moss-lines',
  };
  Object.entries(hydroFieldMap).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) data[key] = el.checked;
  });

  if (fDominantVeg)      data.dominantVeg             = fDominantVeg.value;
  if (fWaaRequired)      data.waaRequired             = fWaaRequired.value;
  if (fWetlandNotes)     data.wetlandNotes            = fWetlandNotes.value;

  // Section 6 — Photography Checklist
  const fPhotosConfirmed = document.getElementById('f-photos-confirmed');
  if (fPhotosConfirmed) data.photosConfirmed = fPhotosConfirmed.checked;

  // Preserve existing optional photo values then overwrite only what's in the DOM
  data.photos = { ...(currentRecord.photos || {}) };
  const optionalPhotoIdMap = {
    fishSign: 'f-photo-fish-sign',
    damage:   'f-photo-damage',
    wetland:  'f-photo-wetland',
    sar:      'f-photo-sar',
  };
  Object.entries(optionalPhotoIdMap).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) data.photos[key] = el.checked;
  });

  // Section 7 — Permitting Pathway
  const fNseccPathway = document.getElementById('f-nsecc-pathway');
  const fDfoPathway   = document.getElementById('f-dfo-pathway');
  if (fNseccPathway) data.nseccPathway = fNseccPathway.value;
  if (fDfoPathway)   data.dfoPathway   = fDfoPathway.value;

  return data;
}

/**
 * validateForm(record)
 * Returns [{section, fieldId, message}] for required fields that are empty.
 */
function validateForm(record) {
  const errors = [];

  // Section 0 — Crossing Identification
  if (!record.crossingId?.trim()) {
    errors.push({ section: 'id', fieldId: 'f-crossing-id', message: 'Crossing ID is required.' });
  }
  if (!record.assessor?.trim()) {
    errors.push({ section: 'id', fieldId: 'f-assessor', message: 'Assessor name is required.' });
  }

  // Section 1 — Watercourse Confirmation
  if (record.watercoursePresent === null || record.watercoursePresent === undefined) {
    errors.push({ section: 'wc', fieldId: 'f-wc-present', message: 'Watercourse confirmation is required.' });
  }

  // Section 2 — Fish Habitat Assessment (only relevant when watercourse is confirmed)
  if (record.watercoursePresent === true) {
    const hasAnyFishBearing = (record.reaches || []).some(rch => !!rch.fishBearing);
    if (!hasAnyFishBearing) {
      errors.push({ section: 'fish', fieldId: 'f-fish-bearing',
        message: 'Fish-bearing determination is required for at least one reach.' });
    }
    const SUB_KEYS = ['bedrock','boulder','cobble','gravel','sand','silt','clay','organic'];
    (record.reaches || []).forEach(rch => {
      const sub    = rch.substrate || {};
      const filled = SUB_KEYS.map(k => sub[k]).filter(v => v != null);
      if (filled.length > 0) {
        const total = filled.reduce((a, b) => a + b, 0);
        if (total !== 100) {
          errors.push({ section: 'fish', fieldId: 'f-sub-total',
            message: `${rch.reachLabel}: Substrate total is ${total}% — must equal 100%.` });
        }
      }
    });
  }

  // Section 3 — Watercourse Geometry and Slope (gated: watercourse confirmed)
  if (record.watercoursePresent === true) {
    const hasAnyVelocityMethod = (record.reaches || []).some(rch => !!rch.velocityMethod);
    if (!hasAnyVelocityMethod) {
      errors.push({ section: 'geo', fieldId: 'f-velocity-method',
        message: 'Velocity measurement method is required for at least one reach.' });
    }
  }

  // Section 4 — Crossing Condition (gated: watercourse confirmed)
  if (record.watercoursePresent === true) {
    if (!record.fishPassageRating) {
      errors.push({ section: 'crossing', fieldId: 'f-fish-passage-rating',
        message: 'Fish passage rating is required.' });
    }
  }

  // Section 5 — Wetland Assessment (always assessed; gated only by wetlandPresent)
  if (record.wetlandPresent === true && !record.waaRequired) {
    errors.push({ section: 'wetland', fieldId: 'f-waa-required',
      message: 'WAA likely required determination must be made.' });
  }

  // Section 7 — Permitting Pathway
  if (!record.nseccPathway) {
    errors.push({ section: 'permits', fieldId: 'f-nsecc-pathway',
      message: 'NSECC permitting pathway is required.' });
  }
  if (!record.dfoPathway) {
    errors.push({ section: 'permits', fieldId: 'f-dfo-pathway',
      message: 'DFO permitting pathway is required.' });
  }

  return errors;
}

/**
 * showValidationErrors(errors)
 * Inserts inline error <p> elements below each failing field and navigates
 * to the section containing the first error.
 */
function showValidationErrors(errors) {
  clearValidationErrors();
  if (!errors.length) return;
  showSection(errors[0].section);
  errors.forEach(({ fieldId, message }) => {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.classList.add('has-error');
    const msg = document.createElement('p');
    msg.className   = 'field-error';
    msg.id          = `err-${fieldId}`;
    msg.textContent = message;
    field.insertAdjacentElement('afterend', msg);
  });
}

function clearValidationErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.remove());
  document.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
}

/**
 * updateSectionCheckmarks()
 * Recomputes the ✓ badge on each nav tab based on required-field completeness.
 */
function updateSectionCheckmarks() {
  // Section 0 — Crossing Identification
  const crossingId = document.getElementById('f-crossing-id');
  const assessor   = document.getElementById('f-assessor');
  setSectionComplete('id', !!(crossingId?.value.trim() && assessor?.value.trim()));

  // Section 1 — Watercourse Confirmation
  const fWcPresent = document.getElementById('f-wc-present');
  if (fWcPresent) setSectionComplete('wc', fWcPresent.value !== '');

  // Section 2 — Fish Habitat Assessment (complete when any reach has fish-bearing set)
  {
    const fFishBearing = document.getElementById('f-fish-bearing');
    const activeHasFb  = !!(fFishBearing?.value);
    const otherFb      = (currentRecord?.reaches || []).some((r, i) => i !== activeReachIdx && !!r.fishBearing);
    if (fFishBearing || currentRecord?.reaches?.length) setSectionComplete('fish', activeHasFb || otherFb);
  }

  // Section 3 — Watercourse Geometry (complete when any reach has velocity method set)
  {
    const fVelMethod  = document.getElementById('f-velocity-method');
    const activeHasVm = !!(fVelMethod?.value);
    const otherVm     = (currentRecord?.reaches || []).some((r, i) => i !== activeReachIdx && !!r.velocityMethod);
    if (fVelMethod || currentRecord?.reaches?.length) setSectionComplete('geo', activeHasVm || otherVm);
  }

  // Section 4 — Crossing Condition
  // Complete when: touched AND (no crossing OR structure type + fish passage rating both set)
  const fCrossingPresent = document.getElementById('f-crossing-present');
  if (fCrossingPresent) {
    const touched = fCrossingPresent.dataset.touched === 'true';
    const present = fCrossingPresent.checked;
    const stType  = document.getElementById('f-structure-type')?.value;
    const fpr     = document.getElementById('f-fish-passage-rating')?.value;
    setSectionComplete('crossing', touched && (!present || (!!stType && !!fpr)));
  }

  // Section 5 — Wetland Assessment
  // Complete when: touched AND (no wetland OR wetland confirmed + type + WAA all set)
  const fWetlandPresent = document.getElementById('f-wetland-present');
  const fWaaRequired    = document.getElementById('f-waa-required');
  if (fWetlandPresent) {
    const touched    = fWetlandPresent.dataset.touched === 'true';
    const present    = fWetlandPresent.checked;
    const confirmed  = document.getElementById('f-wetland-confirmed')?.checked;
    const wType      = document.getElementById('f-wetland-type')?.value;
    const waa        = fWaaRequired ? fWaaRequired.value !== '' : false;
    setSectionComplete('wetland', touched && (!present || (confirmed && !!wType && waa)));
  }

  // Section 6 — Photography Checklist (complete when confirmation checkbox is checked)
  const fPhotosConfirmed = document.getElementById('f-photos-confirmed');
  if (fPhotosConfirmed) {
    setSectionComplete('photos', fPhotosConfirmed.checked);
  }

  // Section 7 — Permitting Pathway (complete when both pathways are selected)
  const fNseccPathway = document.getElementById('f-nsecc-pathway');
  const fDfoPathway   = document.getElementById('f-dfo-pathway');
  if (fNseccPathway && fDfoPathway) {
    setSectionComplete('permits', fNseccPathway.value !== '' && fDfoPathway.value !== '');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIST VIEW RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

function renderList() {
  // Sort by date descending; fall back to createdAt for same-day records
  const records = [...CA.loadRecords()].sort((a, b) => {
    const da = (a.date || a.createdAt || '').slice(0, 10);
    const db = (b.date || b.createdAt || '').slice(0, 10);
    if (db !== da) return db.localeCompare(da);
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  viewList.innerHTML = `
    <div class="home-hero">
      <img src="./assets/LOGO w TEXT black bg.jpg" class="hero-logo"
           alt="Fraxinus Environmental &amp; Geomatics" />
      <p class="hero-tagline">NTB Watercourse Assessment</p>
      <button class="btn btn-primary btn-lg" id="btn-new-record">
        + New Record
      </button>
    </div>

    <div class="list-header">
      <span class="list-count">
        ${records.length} crossing${records.length === 1 ? '' : 's'}
      </span>
      <div class="list-export">
        <button class="btn btn-ghost" id="btn-export-csv"     type="button">CSV</button>
        <button class="btn btn-ghost" id="btn-export-geojson" type="button">GeoJSON</button>
        <button class="btn btn-ghost" id="btn-export-pdf"     type="button">PDF</button>
        ${records.length > 0
          ? '<button class="btn btn-danger-ghost" id="btn-clear-all" type="button">Clear All</button>'
          : ''}
      </div>
    </div>

    <div class="record-list" id="record-list">
      ${records.length === 0
        ? `<p class="no-records">
             No crossings recorded yet.<br>
             Tap <strong>+ New Record</strong> to begin.
           </p>`
        : records.map(r => renderRecordCard(r)).join('')
      }
    </div>
  `;

  document.getElementById('btn-new-record')
    .addEventListener('click', newRecord);

  document.getElementById('btn-export-csv')
    .addEventListener('click', exportCSV);

  document.getElementById('btn-export-geojson')
    .addEventListener('click', exportGeoJSON);

  document.getElementById('btn-export-pdf')
    .addEventListener('click', exportAllPDF);

  if (records.length > 0) {
    document.getElementById('btn-clear-all').addEventListener('click', () => {
      openConfirmModal(
        `Delete all ${records.length} record${records.length === 1 ? '' : 's'}? This cannot be undone.`,
        () => {
          CA.loadRecords().forEach(r => CA.deleteRecord(r.id));
          renderList();
          toast('All records deleted', 'warn');
        }
      );
    });
  }

  // Tap a per-record action button or the card itself
  document.getElementById('record-list')
    .addEventListener('click', e => {
      const pdfBtn = e.target.closest('[data-pdf-id]');
      if (pdfBtn) {
        e.stopPropagation();
        const rec = CA.getRecord(pdfBtn.dataset.pdfId);
        if (rec) exportSinglePDF(rec);
        return;
      }
      const csvBtn = e.target.closest('[data-csv-id]');
      if (csvBtn) {
        e.stopPropagation();
        const rec = CA.getRecord(csvBtn.dataset.csvId);
        if (rec) exportSingleCSV(rec);
        return;
      }
      const deleteBtn = e.target.closest('[data-delete-id]');
      if (deleteBtn) {
        e.stopPropagation();
        const id  = deleteBtn.dataset.deleteId;
        const rec = CA.getRecord(id);
        const cid = rec?.crossingId || id;
        openConfirmModal(
          `Delete ${cid}? This cannot be undone.`,
          () => { CA.deleteRecord(id); renderList(); }
        );
        return;
      }
      const exportBtn = e.target.closest('[data-export-id]');
      if (exportBtn) {
        e.stopPropagation();
        const rec = CA.getRecord(exportBtn.dataset.exportId);
        if (rec) exportSingleGeoJSON(rec);
        return;
      }
      const card = e.target.closest('[data-record-id]');
      if (card) {
        const rec = CA.getRecord(card.dataset.recordId);
        if (rec) openRecord(rec);
      }
    });
}

/**
 * renderRecordCard(record) → HTML string
 * Shows crossing ID, SAR flag, priority tier, status badge, date, watershed.
 * Wrapped in a .record-card-row so the card button and single-record GeoJSON
 * export button sit side by side without nesting buttons (invalid HTML).
 */
function renderRecordCard(r) {
  const statusClass   = r.status === 'complete' ? 'badge-complete' : 'badge-draft';
  const statusLabel   = r.status === 'complete' ? 'Complete' : 'Draft';
  const sarBadge      = r.sarPolygon
    ? '<span class="badge badge-sar">SAR</span>' : '';
  const priorityBadge = r.priority
    ? `<span class="badge badge-${esc(r.priority.toLowerCase())}">${esc(r.priority)}</span>` : '';

  return `
    <div class="record-card-row">
      <button class="record-card" data-record-id="${esc(r.id)}"
              aria-label="Open record ${esc(r.crossingId)}">
        <div class="rc-header">
          <span class="rc-id">${esc(r.crossingId || '—')}</span>
          ${sarBadge}${priorityBadge}
          <span class="badge ${statusClass}">${statusLabel}</span>
        </div>
        <div class="rc-meta">
          <span>${esc(r.date || '—')}</span>
          ${r.watershedPrimary ? `<span class="rc-dot"></span><span>${esc(r.watershedPrimary)}</span>` : ''}
        </div>
      </button>
      <button class="rc-pdf-btn" data-pdf-id="${esc(r.id)}" type="button"
              aria-label="Print ${esc(r.crossingId)} as PDF">
        PDF
      </button>
      <button class="rc-csv-btn" data-csv-id="${esc(r.id)}" type="button"
              aria-label="Export ${esc(r.crossingId)} as CSV">
        CSV
      </button>
      <button class="rc-export-btn" data-export-id="${esc(r.id)}" type="button"
              aria-label="Export ${esc(r.crossingId)} as GeoJSON">
        ↓ GeoJSON
      </button>
      <button class="rc-delete-btn" data-delete-id="${esc(r.id)}" type="button"
              aria-label="Delete ${esc(r.crossingId)}">
        ✕
      </button>
    </div>
  `;
}

// ── List actions ───────────────────────────────────────────────────────────────

/**
 * newRecord()
 * Creates a fresh record pre-populated with today's date, current time, and
 * the next auto-incremented Crossing ID, then opens it in the form view.
 */
function newRecord() {
  openRecord(CA.createRecord({
    assessor:           settings.assessor,
    projectId:          settings.projectId          || '',
    watershedPrimary:   settings.watershedPrimary   || '',
    watershedSecondary: settings.watershedSecondary || '',
    priority:           settings.priority           || '',
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT — CSV and GeoJSON
// ═══════════════════════════════════════════════════════════════════════════════

/** YYYY-MM-DD string for today, used in export filenames. */
function dateFilename() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * triggerDownload(blob, filename)
 * Creates a temporary <a> with an object URL, clicks it, then cleans up.
 */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.style.cssText = 'position:absolute;left:-9999px;';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * buildGeoJSONBlob(records) → Blob
 * Serialises an array of records into a GeoJSON FeatureCollection Blob.
 * Records without lat/lon get null geometry (valid GeoJSON).
 * Coordinate order: [longitude, latitude] per RFC 7946.
 */
function buildGeoJSONBlob(records) {
  const features = records.map(r => ({
    type: 'Feature',
    geometry: (r.lat != null && r.lon != null)
      ? { type: 'Point', coordinates: [r.lon, r.lat] }
      : null,
    properties: CA.serializeForGeoJSON(r),
  }));
  return new Blob(
    [JSON.stringify({ type: 'FeatureCollection', features }, null, 2)],
    { type: 'application/geo+json' }
  );
}

/**
 * exportCSV()
 * Exports all records as a UTF-8 CSV (with BOM for Excel compatibility).
 * Free-text fields containing commas, quotes, or newlines are double-quote
 * escaped per RFC 4180. Null values become empty cells.
 */
function exportCSV() {
  const records = CA.loadRecords();
  if (!records.length) { toast('No records to export', 'warn'); return; }

  const rows    = records.flatMap(r => CA.serializeRecord(r));
  const headers = Object.keys(rows[0]);

  function csvCell(v) {
    if (v === null || v === undefined) return '';
    const s = String(v);
    // Quote cells that contain comma, double-quote, CR, or LF
    return (s.includes(',') || s.includes('"') || s.includes('\r') || s.includes('\n'))
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  }

  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h => csvCell(row[h])).join(',')),
  ].join('\r\n');

  // UTF-8 BOM (﻿) ensures Excel opens the file with correct encoding
  triggerDownload(
    new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }),
    `watercourse_crossings_${dateFilename()}.csv`
  );
  toast(`CSV exported — ${records.length} record${records.length === 1 ? '' : 's'}`, 'success');
}

/**
 * exportGeoJSON()
 * Exports all records as a GeoJSON FeatureCollection.
 */
function exportGeoJSON() {
  const records = CA.loadRecords();
  if (!records.length) { toast('No records to export', 'warn'); return; }

  triggerDownload(
    buildGeoJSONBlob(records),
    `watercourse_crossings_${dateFilename()}.geojson`
  );
  toast(`GeoJSON exported — ${records.length} record${records.length === 1 ? '' : 's'}`, 'success');
}

/**
 * exportSingleGeoJSON(record)
 * Exports one record as a single-feature GeoJSON FeatureCollection.
 * Filename: <crossingId>_<date>.geojson  (e.g. CR-001_2026-05-01.geojson)
 */
function exportSingleGeoJSON(record) {
  triggerDownload(
    buildGeoJSONBlob([record]),
    `${(record.crossingId || 'crossing').replace(/[^A-Za-z0-9_-]/g, '_')}_${dateFilename()}.geojson`
  );
  toast(`GeoJSON exported — ${record.crossingId}`, 'success');
}

/**
 * exportSingleCSV(record)
 * Exports one record as a single-row CSV using the same column structure
 * as the bulk export. Filename: <crossingId>_<date>.csv
 */
function exportSingleCSV(record) {
  const rows    = CA.serializeRecord(record);
  const headers = Object.keys(rows[0]);
  function csvCell(v) {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return (s.includes(',') || s.includes('"') || s.includes('\r') || s.includes('\n'))
      ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h => csvCell(row[h])).join(',')),
  ].join('\r\n');
  const safeId = (record.crossingId || 'crossing').replace(/[^A-Za-z0-9_-]/g, '_');
  triggerDownload(
    new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }),
    `${safeId}_${dateFilename()}.csv`
  );
  toast(`CSV exported — ${record.crossingId}`, 'success');
}

/**
 * exportPDF(records, filename)
 * Builds a jsPDF document for one or more records and downloads it.
 * Each record starts on a new page. Requires window.jspdf (loaded from lib/).
 */
function exportPDF(records, filename) {
  if (!window.jspdf) { toast('PDF library not loaded', 'warn'); return; }
  const { jsPDF } = window.jspdf;

  const PAGE_W = 210, PAGE_H = 297;
  const ML = 15, MR = 15, MT = 15;
  const CW = PAGE_W - ML - MR;          // content width 180mm
  const LABEL_W = 68;
  const VAL_X   = ML + LABEL_W + 2;
  const VAL_W   = CW - LABEL_W - 2;
  const BOTTOM  = PAGE_H - 12;          // 12mm bottom margin

  const C_GREEN  = [26,  107, 60];
  const C_LGREEN = [200, 230, 201];
  const C_DARK   = [17,  17,  17];
  const C_GRAY   = [100, 100, 100];
  const C_LGRAY  = [245, 245, 245];

  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

  if (window.OSWALD_FONTS) {
    doc.addFileToVFS('Oswald-Regular.ttf',   window.OSWALD_FONTS.regular);
    doc.addFont('Oswald-Regular.ttf',   'Oswald', 'normal');
    doc.addFileToVFS('Oswald-SemiBold.ttf', window.OSWALD_FONTS.semibold);
    doc.addFont('Oswald-SemiBold.ttf', 'Oswald', 'bold');
  }
  const PDF_FONT = window.OSWALD_FONTS ? 'Oswald' : 'helvetica';

  let y      = MT;
  let rowAlt = false;

  function needsPage(h) {
    if (y + h > BOTTOM) { doc.addPage(); y = MT; rowAlt = false; }
  }

  function sectionHeader(title) {
    needsPage(8);
    doc.setFillColor(...C_GREEN);
    doc.rect(ML, y, CW, 6, 'F');
    doc.setFont(PDF_FONT, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), ML + 2.5, y + 4.2);
    doc.setTextColor(...C_DARK);
    y += 7;
    rowAlt = false;
  }

  function subHead(title) {
    needsPage(6);
    doc.setFillColor(...C_LGREEN);
    doc.rect(ML, y, CW, 5, 'F');
    doc.setFont(PDF_FONT, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C_GREEN);
    doc.text(title, ML + 2.5, y + 3.5);
    doc.setTextColor(...C_DARK);
    y += 5.5;
  }

  function field(label, value) {
    const val = (value == null || value === '') ? '—' : String(value);
    const lines = doc.splitTextToSize(val, VAL_W);
    const ROW_H = Math.max(5, lines.length * 4.2 + 1);
    needsPage(ROW_H);
    if (rowAlt) { doc.setFillColor(...C_LGRAY); doc.rect(ML, y, CW, ROW_H, 'F'); }
    rowAlt = !rowAlt;
    doc.setFont(PDF_FONT, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C_GRAY);
    doc.text(label, ML + 2, y + 3.5);
    doc.setFont(PDF_FONT, 'normal');
    doc.setTextColor(val === '—' ? 170 : C_DARK[0], val === '—' ? 170 : C_DARK[1], val === '—' ? 170 : C_DARK[2]);
    doc.text(lines, VAL_X, y + 3.5);
    y += ROW_H;
  }

  function noteBlock(label, value) {
    if (!value) return;
    const lines = doc.splitTextToSize(String(value), CW - 5);
    const H = lines.length * 4.2 + 4;
    needsPage(H);
    doc.setFillColor(249, 249, 249);
    doc.rect(ML, y, CW, H, 'F');
    doc.setFillColor(...C_GREEN);
    doc.rect(ML, y, 1.5, H, 'F');
    doc.setFont(PDF_FONT, 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C_GRAY);
    doc.text(label + ':', ML + 3, y + 3.5);
    doc.setFont(PDF_FONT, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C_DARK);
    doc.text(lines, ML + 3, y + 7.5);
    y += H + 1;
  }

  function drawBox(x, bY, checked) {
    const S = 2.6;
    if (checked) {
      doc.setFillColor(...C_GREEN);
      doc.rect(x, bY, S, S, 'F');
    } else {
      doc.setLineWidth(0.25);
      doc.setDrawColor(160, 160, 160);
      doc.rect(x, bY, S, S, 'S');
    }
  }

  function checkRows(pairs) {
    const half = Math.ceil(pairs.length / 2);
    for (let i = 0; i < half; i++) {
      needsPage(5);
      const [lbl0, v0] = pairs[i];
      drawBox(ML + 2, y + 1, v0);
      doc.setFont(PDF_FONT, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...C_DARK);
      doc.text(lbl0, ML + 6.5, y + 3.5);
      if (pairs[i + half]) {
        const [lbl1, v1] = pairs[i + half];
        drawBox(ML + CW / 2 + 2, y + 1, v1);
        doc.text(lbl1, ML + CW / 2 + 6.5, y + 3.5);
      }
      y += 5;
    }
  }

  function bv(v) { return v === true ? 'Yes' : v === false ? 'No' : ''; }
  function nv(v, u) { return (v == null || v === '') ? '' : u ? `${v} ${u}` : String(v); }

  function renderRecord(r, idx, total) {
    rowAlt = false;
    const sub = r.substrate || {};
    const hab = r.hab       || {};
    const ph  = r.photos    || {};

    // ── Page header strip ──────────────────────────────────────────────────
    doc.setFillColor(...C_GREEN);
    doc.rect(0, 0, PAGE_W, 16, 'F');
    doc.setFont(PDF_FONT, 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('Watercourse Crossing Assessment', ML, 9);
    doc.setFont(PDF_FONT, 'normal');
    doc.setFontSize(7.5);
    doc.text(
      `NTB Watercourse Assessment  ·  Fraxinus Environmental & Geomatics  ·  Generated: ${new Date().toLocaleString('en-CA')}` +
      (total > 1 ? `  ·  Record ${idx + 1} of ${total}` : ''),
      ML, 13.5
    );
    doc.setTextColor(...C_DARK);
    y = 20;

    // ── 0: ID ──────────────────────────────────────────────────────────────
    sectionHeader('Crossing Identification');
    field('Crossing ID',        r.crossingId);
    field('Status',             r.status === 'complete' ? 'Complete' : 'Draft');
    field('Project ID',         r.projectId);
    field('Assessor',           r.assessor);
    field('Date',               r.date);
    field('Time',               r.time);
    field('Latitude',           r.lat != null ? String(r.lat) : '');
    field('Longitude',          r.lon != null ? String(r.lon) : '');
    field('Primary Watershed',  r.watershedPrimary);
    field('Secondary Watershed',r.watershedSecondary);
    field('Priority Tier',      r.priority);
    field('SAR Polygon',        bv(r.sarPolygon));
    noteBlock('Notes', r.notes);
    y += 2;

    // ── 1: WC ──────────────────────────────────────────────────────────────
    sectionHeader('Watercourse Confirmation');
    field('Watercourse Present',
      r.watercoursePresent === true  ? 'Yes — bed and bank confirmed' :
      r.watercoursePresent === false ? 'No — not a watercourse' : 'Not yet assessed');
    y += 2;

    // ── 2: Fish ────────────────────────────────────────────────────────────
    sectionHeader('Fish Habitat Assessment');
    const reaches = (r.reaches && r.reaches.length) ? r.reaches : [];
    if (!reaches.length) {
      field('Reach data', 'None recorded');
    } else {
      const CELL_W = CW / 4, CELL_H = 8;
      reaches.forEach(rch => {
        const rsub = rch.substrate || {};
        const rhab = rch.hab       || {};
        if (reaches.length > 1) subHead(rch.reachLabel);
        field('Watershed Area',       nv(rch.watershedArea, 'km²'));
        field('Depth Continuity',     rch.depthContinuity);
        field('Channel Connectivity', bv(rch.channelConnectivity));
        field('Flow Condition',       rch.flowCondition);

        subHead('Substrate Composition');
        const subCells = [
          ['Bedrock', rsub.bedrock], ['Boulder', rsub.boulder],
          ['Cobble',  rsub.cobble],  ['Gravel',  rsub.gravel],
          ['Sand',    rsub.sand],    ['Silt',    rsub.silt],
          ['Clay',    rsub.clay],    ['Organic', rsub.organic],
        ];
        for (let r2 = 0; r2 < 2; r2++) {
          needsPage(CELL_H);
          for (let c = 0; c < 4; c++) {
            const [lbl, val] = subCells[r2 * 4 + c];
            const cx = ML + c * CELL_W;
            doc.setFillColor(...C_LGRAY);
            doc.rect(cx, y, CELL_W - 0.5, CELL_H, 'F');
            doc.setFont(PDF_FONT, 'normal');
            doc.setFontSize(7);
            doc.setTextColor(...C_GRAY);
            doc.text(lbl, cx + CELL_W / 2, y + 3, { align: 'center' });
            doc.setFont(PDF_FONT, 'bold');
            doc.setFontSize(9);
            doc.setTextColor(...C_DARK);
            doc.text(
              (val != null && val !== '') ? `${val}%` : '—',
              cx + CELL_W / 2, y + 7, { align: 'center' }
            );
          }
          y += CELL_H + 0.5;
        }
        doc.setTextColor(...C_DARK);
        field('Embeddedness', rsub.embeddedness != null ? `${rsub.embeddedness}%` : '');

        subHead('Habitat Features');
        checkRows([
          ['Pools',              rhab.pools],
          ['Riffles',            rhab.riffles],
          ['Runs',               rhab.runs],
          ['Large woody debris', rhab.lwd],
          ['Undercut banks',     rhab.undercut],
          ['Overhanging riparian veg.', rhab.overhang],
        ]);

        subHead('Fish Observations');
        field('Fish Observed',  bv(rch.fishObserved));
        field('Fish Sign',      bv(rch.fishSign));
        field('Spawning Redds', bv(rch.reddsObserved));
        noteBlock('Obs. Notes', rch.fishObsNotes);

        subHead('Fish-Bearing Determination');
        field('Determination',  rch.fishBearing);
      });
    }
    y += 2;

    // ── 3: Geo ─────────────────────────────────────────────────────────────
    sectionHeader('Watercourse Geometry & Water Quality');
    if (!reaches.length) {
      field('Reach data', 'None recorded');
    } else {
      reaches.forEach(rch => {
        if (reaches.length > 1) subHead(rch.reachLabel);
        subHead('Channel Dimensions');
        field('Bankfull Width',     nv(rch.bankfullWidth,  'm'));
        field('Wetted Width',       nv(rch.wettedWidth,    'm'));
        field('Depth — Left Bank',  nv(rch.depthLeftBank, 'm'));
        field('Depth — Centre',     nv(rch.depthCentre,   'm'));
        field('Depth — Right Bank', nv(rch.depthRightBank,'m'));
        field('Depth — Thalweg',    nv(rch.depthThalweg,  'm'));
        field('Bank Height',        nv(rch.bankHeight,     'm'));
        subHead('Water Chemistry');
        field('Dissolved Oxygen',   nv(rch.dissolvedOxygen, 'mg/L'));
        field('DO Saturation',      nv(rch.doSaturation,    '%'));
        field('Conductivity',       nv(rch.conductivity,    'µS/cm'));
        field('Water Temperature',  nv(rch.waterTemp,       '°C'));
        field('pH',                 nv(rch.ph,              ''));
        subHead('Flow');
        field('Watercourse Slope',  nv(rch.watercourseSlope, '%'));
        field('Flow Velocity',      nv(rch.flowVelocity,     'm/s'));
        field('Velocity Method',    rch.velocityMethod);
      });
    }
    y += 2;

    // ── 4: Crossing ────────────────────────────────────────────────────────
    sectionHeader('Crossing Condition');
    field('Crossing Present',
      r.crossingPresent === true  ? 'Yes' :
      r.crossingPresent === false ? 'No'  : 'Not assessed');
    if (r.crossingPresent) {
      field('Crossing Status',    r.crossingStatus);
      field('Structure Type',     r.structureType);
      field('Structure Material', r.structureMaterial);
      field('Number of Barrels',  nv(r.numBarrels, ''));
      field('Structure Diameter', nv(r.structureDiameter, 'm'));
      field('Outlet Drop',        nv(r.outletDrop, 'm'));
      field('Barrel Condition',   r.barrelCondition);
      field('Blockage',           r.blockage);
      field('Dry Barrel',         bv(r.dryBarrel));
      field('Fish Passage Rating',r.fishPassageRating);
      noteBlock('Structural Damage Notes', r.structuralDamageNotes);
    }
    y += 2;

    // ── 5: Wetland ─────────────────────────────────────────────────────────
    sectionHeader('Wetland Assessment');
    field('Wetland Present',
      r.wetlandPresent === true  ? 'Yes' :
      r.wetlandPresent === false ? 'No'  : 'Not assessed');
    if (r.wetlandPresent) {
      field('Wetland Confirmed',    bv(r.wetlandConfirmed));
      field('Wetland Type',         r.wetlandType);
      field('WESP-AC Protocol',     bv(r.wespAc));
      field('Wetland Connectivity', r.wetlandConnectivity);
      field('Hydrophilic Veg.',     bv(r.hydrophilicVeg));
      field('Hydric Soils',         bv(r.hydricSoils));
      field('Dominant Vegetation',  r.dominantVeg);
      field('WAA Required',         r.waaRequired);
      subHead('Hydrological Indicators');
      checkRows([
        ['Water marks',           r.hydroWaterMarks],
        ['Drift lines',           r.hydroDriftLines],
        ['Waterlogged soil',      r.hydroWaterloggedSoil],
        ['Standing water',        r.hydroStandingWater],
        ['Water-stained leaves',  r.hydroWaterStainedLeaves],
        ['Oxidized rhizospheres', r.hydroOxidizedRhizospheres],
        ['Sediment deposits',     r.hydroSedimentDeposits],
        ['Algal mats',            r.hydroAlgalMats],
        ['Iron deposits',         r.hydroIronDeposits],
        ['Drainage patterns',     r.hydroDrainagePatterns],
        ['Buttressed roots',      r.hydroButtressedRoots],
        ['Moss lines',            r.hydroMossLines],
      ]);
      noteBlock('Wetland Notes', r.wetlandNotes);
    }
    y += 2;

    // ── 6: Photos ──────────────────────────────────────────────────────────
    sectionHeader('Photography');
    field('Required Photos Confirmed', bv(r.photosConfirmed));
    field('Fish / Fish Sign Photos',   bv(ph.fishSign));
    field('Structural Damage Photos',  bv(ph.damage));
    field('Wetland Photos',            bv(ph.wetland));
    field('SAR Photos',                bv(ph.sar));
    y += 2;

    // ── 7: Permits ─────────────────────────────────────────────────────────
    sectionHeader('Permitting Pathway');
    field('NSECC Pathway', NSECC_LABELS[r.nseccPathway] || r.nseccPathway || '');
    field('DFO Pathway',   DFO_LABELS[r.dfoPathway]     || r.dfoPathway   || '');
  }

  // Render all records
  records.forEach((r, i) => {
    if (i > 0) { doc.addPage(); y = MT; }
    renderRecord(r, i, records.length);
  });

  // Page numbers in footer
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont(PDF_FONT, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C_GRAY);
    doc.text(`Page ${p} of ${total}`, PAGE_W - MR, PAGE_H - 5, { align: 'right' });
  }

  doc.save(filename);
}

function exportSinglePDF(record) {
  const safeId = (record.crossingId || 'crossing').replace(/[^A-Za-z0-9_-]/g, '_');
  exportPDF([record], `${safeId}_${dateFilename()}.pdf`);
  toast(`PDF exported — ${record.crossingId}`, 'success');
}

function exportAllPDF() {
  const records = CA.loadRecords();
  if (!records.length) { toast('No records to export', 'warn'); return; }
  exportPDF(records, `watercourse_crossings_${dateFilename()}.pdf`);
  toast(`PDF exported — ${records.length} record${records.length === 1 ? '' : 's'}`, 'success');
}


// ═══════════════════════════════════════════════════════════════════════════════
// UNSAVED-CHANGES MODAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * openUnsavedModal(onSaveDraft, onDiscard)
 * Shows the modal and wires the three buttons. The callbacks are one-shot;
 * clicking any button dismisses the modal first, then runs its callback.
 */
function openUnsavedModal(onSaveDraft, onDiscard) {
  modalUnsaved.removeAttribute('hidden');

  function dismiss() {
    modalUnsaved.setAttribute('hidden', '');
    // Reset onclick handlers to avoid stale closures on the next call
    btnModalDraft.onclick   = null;
    btnModalDiscard.onclick = null;
    btnModalCancel.onclick  = null;
  }

  btnModalDraft.onclick   = () => { dismiss(); onSaveDraft?.(); };
  btnModalDiscard.onclick = () => { dismiss(); onDiscard?.();   };
  btnModalCancel.onclick  = dismiss;   // "Keep Editing" — just close modal

  // Clicking the backdrop also dismisses (Keep Editing behaviour)
  modalUnsaved.addEventListener('click', e => {
    if (e.target === modalUnsaved) dismiss();
  }, { once: true });
}

/**
 * openConfirmModal(message, onConfirm)
 * Generic two-button (Confirm / Cancel) confirmation modal.
 * Used by per-record delete and Clear All.
 */
function openConfirmModal(message, onConfirm) {
  document.getElementById('modal-confirm-msg').textContent = message;
  modalConfirm.removeAttribute('hidden');

  function dismiss() {
    modalConfirm.setAttribute('hidden', '');
    btnConfirmOk.onclick     = null;
    btnConfirmCancel.onclick = null;
  }

  btnConfirmOk.onclick     = () => { dismiss(); onConfirm(); };
  btnConfirmCancel.onclick = dismiss;
  modalConfirm.addEventListener('click', e => {
    if (e.target === modalConfirm) dismiss();
  }, { once: true });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS DRAWER
// ═══════════════════════════════════════════════════════════════════════════════

function openDrawer() {
  sAssessor.value  = settings.assessor;
  sProjectId.value = settings.projectId || '';
  sPriority.value  = settings.priority  || '';

  const wp        = settings.watershedPrimary || '';
  const wsIsKnown = wp === '' || wp === 'Other' || WATERSHED_OPTIONS.includes(wp);
  const wsDrop    = wsIsKnown ? wp : 'Other';
  const wsOther   = wsIsKnown ? '' : wp;
  sWatershedPrimary.value      = wsDrop;
  sWatershedPrimaryOther.value = wsOther;
  sWatershedSecondary.value    = settings.watershedSecondary || '';
  document.getElementById('s-ws-other-wrap').hidden    = wsDrop !== 'Other';
  document.getElementById('s-ws-secondary-wrap').hidden = !wsDrop;

  settingsDrawer.classList.add('open');
  drawerOverlay.classList.add('open');
  settingsDrawer.removeAttribute('aria-hidden');
  drawerOverlay.removeAttribute('aria-hidden');
  sAssessor.focus();
}

function closeDrawer() {
  settingsDrawer.classList.remove('open');
  drawerOverlay.classList.remove('open');
  settingsDrawer.setAttribute('aria-hidden', 'true');
  drawerOverlay.setAttribute('aria-hidden', 'true');
}

btnMenu.addEventListener('click', openDrawer);
btnDrawerClose.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);

sWatershedPrimary.addEventListener('change', () => {
  const val = sWatershedPrimary.value;
  document.getElementById('s-ws-other-wrap').hidden    = val !== 'Other';
  document.getElementById('s-ws-secondary-wrap').hidden = !val;
});

btnSaveSettings.addEventListener('click', () => {
  settings.assessor  = sAssessor.value.trim();
  settings.projectId = sProjectId.value.trim();
  settings.priority  = sPriority.value;
  const wpVal = sWatershedPrimary.value;
  settings.watershedPrimary   = (wpVal === 'Other')
    ? (sWatershedPrimaryOther.value.trim() || 'Other')
    : wpVal;
  settings.watershedSecondary = sWatershedSecondary.value.trim();
  saveSettings();
  closeDrawer();
  toast('Settings saved', 'success');
});

// ── Settings persistence ───────────────────────────────────────────────────────

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) settings = { ...settings, ...JSON.parse(raw) };
  } catch { /* keep defaults */ }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * toast(msg, type?)
 * type: 'success' | 'warn' | 'error'
 */
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className   = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 2900);
}

// ═══════════════════════════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════════════════════════

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;

  // Priority order: modal > drawer > form back
  if (!modalUnsaved.hasAttribute('hidden')) {
    modalUnsaved.setAttribute('hidden', '');
    return;
  }
  if (settingsDrawer.classList.contains('open')) {
    closeDrawer();
    return;
  }
  if (currentView === 'form') {
    handleBack();   // respects dirty flag — may open modal instead of exiting
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/** HTML-escape a value for safe insertion into innerHTML. */
function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
