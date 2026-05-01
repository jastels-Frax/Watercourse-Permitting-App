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

let settings      = { assessor: '' };

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
const btnSaveSettings = document.getElementById('btn-save-settings');
const modalUnsaved    = document.getElementById('modal-unsaved');
const btnModalDraft   = document.getElementById('btn-modal-draft');
const btnModalDiscard = document.getElementById('btn-modal-discard');
const btnModalCancel  = document.getElementById('btn-modal-cancel');

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
        <button class="btn btn-ghost" id="btn-edit" type="button">Edit</button>
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

  const ws = record.watershed || '';
  const pr = record.priority  || '';

  panel.innerHTML = `
    <div class="field-stack">

      <div class="field-row">
        <label class="field-label">
          <span>Crossing ID <span class="req">*</span></span>
          <input class="field-input" type="text" id="f-crossing-id"
                 value="${esc(record.crossingId)}" autocomplete="off" />
        </label>
        <label class="field-label">
          <span>Assessor <span class="req">*</span></span>
          <input class="field-input" type="text" id="f-assessor"
                 value="${esc(record.assessor)}" autocomplete="name" />
        </label>
      </div>

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
        <span>Watershed</span>
        <select class="field-input" id="f-watershed">
          <option value="">— select —</option>
          <option value="Salmon/Debert"      ${ws === 'Salmon/Debert'      ? 'selected' : ''}>Salmon / Debert</option>
          <option value="Phillip/Wallace"    ${ws === 'Phillip/Wallace'    ? 'selected' : ''}>Phillip / Wallace</option>
          <option value="Economy"            ${ws === 'Economy'            ? 'selected' : ''}>Economy</option>
          <option value="Tidnish/Shinimicas" ${ws === 'Tidnish/Shinimicas' ? 'selected' : ''}>Tidnish / Shinimicas</option>
          <option value="Kelly/Maccan/Hebert"${ws === 'Kelly/Maccan/Hebert'? 'selected' : ''}>Kelly / Maccan / Hebert</option>
          <option value="Missaguash"         ${ws === 'Missaguash'         ? 'selected' : ''}>Missaguash</option>
          <option value="Other"              ${ws === 'Other'              ? 'selected' : ''}>Other</option>
        </select>
      </label>

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
// SECTION 2 — Fish Habitat Assessment
// ═══════════════════════════════════════════════════════════════════════════════

function initSectionFish(record) {
  const panel = document.querySelector('#section-panels .form-section[data-section="fish"]');
  if (!panel) return;

  const sub = record.substrate || {};
  const hab = record.hab       || {};
  const dc  = record.depthContinuity || '';
  const fc  = record.flowCondition   || '';
  const fb  = record.fishBearing     || '';

  function sv(key) { return sub[key] != null ? sub[key] : ''; }

  panel.innerHTML = `
    <div class="field-stack">

      <label class="field-label">
        <span>Watershed Area (km²)</span>
        <input class="field-input" type="number" id="f-watershed-area"
               step="0.01" min="0" value="${record.watershedArea ?? ''}" />
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
                 ${record.channelConnectivity ? 'checked' : ''} />
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
                 ${record.fishObserved ? 'checked' : ''} />
          <span class="toggle-track" aria-hidden="true"></span>
        </label>
      </div>
      <div class="toggle-row">
        <span>Fish sign (carcasses, redds, scales)</span>
        <label class="toggle-wrap" aria-label="Fish sign observed">
          <input type="checkbox" id="f-fish-sign"
                 ${record.fishSign ? 'checked' : ''} />
          <span class="toggle-track" aria-hidden="true"></span>
        </label>
      </div>
      <div class="toggle-row">
        <span>Spawning redds observed</span>
        <label class="toggle-wrap" aria-label="Spawning redds observed">
          <input type="checkbox" id="f-redds-observed"
                 ${record.reddsObserved ? 'checked' : ''} />
          <span class="toggle-track" aria-hidden="true"></span>
        </label>
      </div>

      <label class="field-label">
        <span>Fish observation notes</span>
        <textarea class="field-input" id="f-fish-obs-notes"
                  rows="2">${esc(record.fishObsNotes)}</textarea>
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

  // Watershed area → reach distance guidance chip
  document.getElementById('f-watershed-area')
    .addEventListener('input', updateReachChip);
  updateReachChip();

  // Substrate inputs → running total
  const SUB_IDS = [
    'f-sub-bedrock', 'f-sub-boulder', 'f-sub-cobble', 'f-sub-gravel',
    'f-sub-sand',    'f-sub-silt',    'f-sub-clay',   'f-sub-organic',
  ];
  SUB_IDS.forEach(id =>
    document.getElementById(id)?.addEventListener('input', refreshSubTotal)
  );
  refreshSubTotal();

  // Fish-bearing selection drives the section checkmark
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
    numSpan.textContent = '—';
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

  const vm = record.velocityMethod || '';

  function nv(val) { return val != null ? val : ''; }

  panel.innerHTML = `
    <div class="field-stack">

      <p class="sub-head">Channel Dimensions</p>

      <div class="field-row">
        <label class="field-label">
          <span>Bankfull Width (m)</span>
          <input class="field-input" type="number" id="f-bankfull-width"
                 step="0.01" min="0" value="${nv(record.bankfullWidth)}" />
        </label>
        <label class="field-label">
          <span>Wetted Width (m)</span>
          <input class="field-input" type="number" id="f-wetted-width"
                 step="0.01" min="0" value="${nv(record.wettedWidth)}" />
        </label>
      </div>

      <div class="field-row">
        <label class="field-label">
          <span>Channel Depth (m)</span>
          <input class="field-input" type="number" id="f-channel-depth"
                 step="0.01" min="0" value="${nv(record.channelDepth)}" />
        </label>
        <label class="field-label">
          <span>Bank Height (m)</span>
          <input class="field-input" type="number" id="f-bank-height"
                 step="0.01" min="0" value="${nv(record.bankHeight)}" />
        </label>
      </div>

      <p class="sub-head">Water Chemistry</p>

      <div class="field-row">
        <label class="field-label">
          <span>Dissolved Oxygen (mg/L)</span>
          <input class="field-input" type="number" id="f-dissolved-oxygen"
                 step="0.01" min="0" value="${nv(record.dissolvedOxygen)}" />
        </label>
        <label class="field-label">
          <span>DO Saturation (%)</span>
          <input class="field-input" type="number" id="f-do-saturation"
                 step="0.1" min="0" max="200" value="${nv(record.doSaturation)}" />
        </label>
      </div>

      <label class="field-label">
        <span>pH (4.0 – 10.0)</span>
        <input class="field-input" type="number" id="f-ph"
               step="0.1" min="4" max="10" value="${nv(record.ph)}" />
      </label>

      <p class="sub-head">Slope and Flow</p>

      <label class="field-label">
        <span>Watercourse Slope (%)</span>
        <input class="field-input" type="number" id="f-watercourse-slope"
               step="0.1" min="0" value="${nv(record.watercourseSlope)}" />
      </label>

      <div class="field-row">
        <label class="field-label">
          <span>Flow Velocity (m/s) — float or meter</span>
          <input class="field-input" type="number" id="f-flow-velocity"
                 step="0.01" min="0" value="${nv(record.flowVelocity)}" />
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
                 ${record.crossingPresent ? 'checked' : ''} />
          <span class="toggle-track" aria-hidden="true"></span>
        </label>
      </div>

      <div id="crossing-detail"${!record.crossingPresent ? ' hidden' : ''}>
        <div class="field-stack">

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

        </div>
      </div>

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
  `;

  document.getElementById('f-crossing-present').addEventListener('change', e => {
    document.getElementById('crossing-detail').hidden = !e.target.checked;
    updateSectionCheckmarks();
  });

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
 * Shows a "Saved" toast and refreshes section checkmarks.
 */
function saveRecord() {
  if (!currentRecord) return;
  const data  = collectFormData();
  const saved = CA.saveRecord({ ...data, status: 'draft' });
  currentRecord = saved;
  formDirty     = false;
  updateSectionCheckmarks();
  toast('Draft saved', 'success');
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
 * Saves the record as complete, locks the form, updates the footer.
 */
function finalizeSubmit() {
  const data  = collectFormData();
  const saved = CA.saveRecord({ ...data, status: 'complete' });
  currentRecord = saved;
  formDirty     = false;
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
  const fAssessor   = document.getElementById('f-assessor');
  const fDate       = document.getElementById('f-date');
  const fTime       = document.getElementById('f-time');
  const fLat        = document.getElementById('f-lat');
  const fLon        = document.getElementById('f-lon');
  const fWatershed  = document.getElementById('f-watershed');
  const fPriority   = document.getElementById('f-priority');
  const fSar        = document.getElementById('f-sar-polygon');
  const fNotes      = document.getElementById('f-notes');

  if (fCrossingId) data.crossingId = fCrossingId.value.trim();
  if (fAssessor)   data.assessor   = fAssessor.value.trim();
  if (fDate)       data.date       = fDate.value;
  if (fTime)       data.time       = fTime.value;
  if (fLat)        data.lat        = fLat.value  !== '' ? parseFloat(fLat.value)  : null;
  if (fLon)        data.lon        = fLon.value  !== '' ? parseFloat(fLon.value)  : null;
  if (fWatershed)  data.watershed  = fWatershed.value;
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

  // Section 2 — Fish Habitat Assessment
  const fWatershedArea = document.getElementById('f-watershed-area');
  if (fWatershedArea) {
    data.watershedArea = fWatershedArea.value !== '' ? parseFloat(fWatershedArea.value) : null;
  }

  const fDepthCont = document.getElementById('f-depth-continuity');
  const fChanConn  = document.getElementById('f-channel-connectivity');
  const fFlowCond  = document.getElementById('f-flow-condition');
  if (fDepthCont) data.depthContinuity     = fDepthCont.value;
  if (fChanConn)  data.channelConnectivity = fChanConn.checked;
  if (fFlowCond)  data.flowCondition       = fFlowCond.value;

  // Substrate — clone nested object then overwrite individual keys
  data.substrate = { ...(currentRecord.substrate || {}) };
  const SUB_KEYS = ['bedrock','boulder','cobble','gravel','sand','silt','clay','organic'];
  SUB_KEYS.forEach(key => {
    const el = document.getElementById(`f-sub-${key}`);
    if (el) data.substrate[key] = el.value !== '' ? parseFloat(el.value) : null;
  });
  const fEmbed = document.getElementById('f-embeddedness');
  if (fEmbed) data.substrate.embeddedness = fEmbed.value !== '' ? parseFloat(fEmbed.value) : null;

  // Habitat features — clone nested object then overwrite
  data.hab = { ...(currentRecord.hab || {}) };
  ['pools','riffles','runs','lwd','undercut','overhang'].forEach(key => {
    const el = document.getElementById(`f-hab-${key}`);
    if (el) data.hab[key] = el.checked;
  });

  const fFishObs      = document.getElementById('f-fish-observed');
  const fFishSign     = document.getElementById('f-fish-sign');
  const fRedds        = document.getElementById('f-redds-observed');
  const fFishObsNotes = document.getElementById('f-fish-obs-notes');
  const fFishBearing  = document.getElementById('f-fish-bearing');
  if (fFishObs)      data.fishObserved  = fFishObs.checked;
  if (fFishSign)     data.fishSign      = fFishSign.checked;
  if (fRedds)        data.reddsObserved = fRedds.checked;
  if (fFishObsNotes) data.fishObsNotes  = fFishObsNotes.value;
  if (fFishBearing)  data.fishBearing   = fFishBearing.value;

  // Section 3 — Watercourse Geometry and Slope
  const geoNum = (id) => {
    const el = document.getElementById(id);
    return el ? (el.value !== '' ? parseFloat(el.value) : null) : undefined;
  };
  const bfw = geoNum('f-bankfull-width');    if (bfw  !== undefined) data.bankfullWidth    = bfw;
  const wtw = geoNum('f-wetted-width');      if (wtw  !== undefined) data.wettedWidth      = wtw;
  const chd = geoNum('f-channel-depth');     if (chd  !== undefined) data.channelDepth     = chd;
  const bkh = geoNum('f-bank-height');       if (bkh  !== undefined) data.bankHeight       = bkh;
  const dox = geoNum('f-dissolved-oxygen');  if (dox  !== undefined) data.dissolvedOxygen  = dox;
  const dos = geoNum('f-do-saturation');     if (dos  !== undefined) data.doSaturation     = dos;
  const ph  = geoNum('f-ph');               if (ph   !== undefined) data.ph               = ph;
  const slp = geoNum('f-watercourse-slope'); if (slp  !== undefined) data.watercourseSlope = slp;
  const fv  = geoNum('f-flow-velocity');    if (fv   !== undefined) data.flowVelocity     = fv;
  const fvm = document.getElementById('f-velocity-method');
  if (fvm) data.velocityMethod = fvm.value;

  // Section 4 — Existing Crossing Condition
  const fCrossingPresent   = document.getElementById('f-crossing-present');
  const fStructureType     = document.getElementById('f-structure-type');
  const fStructureMat      = document.getElementById('f-structure-material');
  const fBarrelCond        = document.getElementById('f-barrel-condition');
  const fBlockage          = document.getElementById('f-blockage');
  const fDryBarrel         = document.getElementById('f-dry-barrel');
  const fDamageNotes       = document.getElementById('f-structural-damage-notes');
  const fFishPassageRating = document.getElementById('f-fish-passage-rating');

  if (fCrossingPresent)   data.crossingPresent      = fCrossingPresent.checked;
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
    if (!record.fishBearing) {
      errors.push({ section: 'fish', fieldId: 'f-fish-bearing',
        message: 'Fish-bearing determination is required.' });
    }
    // Substrate total must equal 100 if any value was entered
    const sub     = record.substrate || {};
    const SUB_KEYS = ['bedrock','boulder','cobble','gravel','sand','silt','clay','organic'];
    const filled  = SUB_KEYS.map(k => sub[k]).filter(v => v != null);
    if (filled.length > 0) {
      const total = filled.reduce((a, b) => a + b, 0);
      if (total !== 100) {
        errors.push({ section: 'fish', fieldId: 'f-sub-total',
          message: `Substrate total is ${total}% — must equal 100%.` });
      }
    }
  }

  // Section 3 — Watercourse Geometry and Slope (gated: watercourse confirmed)
  if (record.watercoursePresent === true) {
    if (!record.velocityMethod) {
      errors.push({ section: 'geo', fieldId: 'f-velocity-method',
        message: 'Velocity measurement method is required.' });
    }
  }

  // Section 4 — Crossing Condition (gated: watercourse confirmed)
  if (record.watercoursePresent === true) {
    if (!record.fishPassageRating) {
      errors.push({ section: 'crossing', fieldId: 'f-fish-passage-rating',
        message: 'Fish passage rating is required.' });
    }
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

  // Section 2 — Fish Habitat Assessment (complete when fish-bearing determination is set)
  const fFishBearing = document.getElementById('f-fish-bearing');
  if (fFishBearing) setSectionComplete('fish', fFishBearing.value !== '');

  // Section 3 — Watercourse Geometry (complete when velocity method is selected)
  const fVelMethod = document.getElementById('f-velocity-method');
  if (fVelMethod) setSectionComplete('geo', fVelMethod.value !== '');

  // Section 4 — Crossing Condition (complete when fish passage rating is set)
  const fFishPassageRating = document.getElementById('f-fish-passage-rating');
  if (fFishPassageRating) setSectionComplete('crossing', fFishPassageRating.value !== '');
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
      <p class="hero-tagline">L8006 NS-NB Reliability Intertie</p>
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

  // Tap any card to reopen that record
  document.getElementById('record-list')
    .addEventListener('click', e => {
      const card = e.target.closest('[data-record-id]');
      if (!card) return;
      const rec = CA.getRecord(card.dataset.recordId);
      if (rec) openRecord(rec);
    });
}

/**
 * renderRecordCard(record) → HTML string
 * Shows crossing ID, SAR flag, priority tier, status badge, date, watershed.
 */
function renderRecordCard(r) {
  const statusClass = r.status === 'complete' ? 'badge-complete' : 'badge-draft';
  const statusLabel = r.status === 'complete' ? 'Complete' : 'Draft';
  const sarBadge      = r.sarPolygon
    ? '<span class="badge badge-sar">SAR</span>' : '';
  const priorityBadge = r.priority
    ? `<span class="badge badge-${esc(r.priority.toLowerCase())}">${esc(r.priority)}</span>` : '';

  return `
    <button class="record-card" data-record-id="${esc(r.id)}"
            aria-label="Open record ${esc(r.crossingId)}">
      <div class="rc-header">
        <span class="rc-id">${esc(r.crossingId || '—')}</span>
        ${sarBadge}${priorityBadge}
        <span class="badge ${statusClass}">${statusLabel}</span>
      </div>
      <div class="rc-meta">
        <span>${esc(r.date || '—')}</span>
        ${r.watershed ? `<span class="rc-dot"></span><span>${esc(r.watershed)}</span>` : ''}
      </div>
    </button>
  `;
}

// ── List actions ───────────────────────────────────────────────────────────────

/**
 * newRecord()
 * Creates a fresh record pre-populated with today's date, current time, and
 * the next auto-incremented Crossing ID, then opens it in the form view.
 */
function newRecord() {
  openRecord(CA.createRecord({ assessor: settings.assessor }));
}

/**
 * exportCSV() / exportGeoJSON()
 * Stubs — full implementation in Part 13.
 */
function exportCSV() {
  toast('CSV export — coming in Part 13', 'warn');
}

function exportGeoJSON() {
  toast('GeoJSON export — coming in Part 13', 'warn');
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

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS DRAWER
// ═══════════════════════════════════════════════════════════════════════════════

function openDrawer() {
  sAssessor.value = settings.assessor;
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

btnSaveSettings.addEventListener('click', () => {
  settings.assessor = sAssessor.value.trim();
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
