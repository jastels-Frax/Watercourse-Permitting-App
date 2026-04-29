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
  const saved = CA.saveRecord({ ...currentRecord, status: 'draft' });
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
  `;

  document.getElementById('section-nav')
    .addEventListener('click', e => {
      const tab = e.target.closest('.nav-tab');
      if (tab) showSection(tab.dataset.section);
    });

  showSection('id');
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
